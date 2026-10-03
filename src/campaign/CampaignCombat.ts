import * as THREE from "three";
import { CombatSystem } from "../combat/CombatSystem";
import { FighterWeapons } from "../combat/FighterWeapons";
import { FighterTargeting } from "../combat/FighterTargeting";
import { WeaponManager, type CombatSound } from "../combat/WeaponManager";
import { EnemyManager } from "../enemies/EnemyManager";
import { CampaignFighter } from "../enemies/CampaignFighter";
import type { FlightModel } from "../physics/FlightModel";
import { CampaignCompound } from "./CampaignGround";
import { CampaignState } from "./CampaignState";
import { PlayerHealth } from "./PlayerHealth";
import { EnemyFire } from "../combat/EnemyFire";
import { BossController } from "./BossController";
import type { CampaignMissionConfig, MissionResult } from "./types";
import { upgradeManager, type UpgradeProfile } from "./UpgradeManager";
import { aircraftConfigs } from "../aircraft/AircraftConfig";
import { GroundTarget } from "../world/GroundTarget";
import { terrainHeight } from "../utils/noise";

export class CampaignCombat extends CombatSystem {
  declare readonly mission: CampaignState;
  declare readonly compound: CampaignCompound;
  readonly player: PlayerHealth;
  readonly hostileFire: EnemyFire;
  readonly boss: BossController;
  readonly friendly: GroundTarget[] = [];
  readonly profile: UpgradeProfile;
  result?: MissionResult;
  radio = "";
  radioTime = 8;
  boostTime = 0;
  boostCooldown = 0;
  private nextWaveTime = 0;
  private damageSmokeTime = 0;
  private finale = 0;
  private finaleBurst = 0;
  private previousPhase = 0;
  private introTime = 0;
  private markers = new THREE.Group();
  private gates: { mesh: THREE.Mesh; objective: string; index: number }[] = [];
  constructor(
    flight: FlightModel,
    sound: (kind: CombatSound) => void,
    readonly definition: CampaignMissionConfig,
  ) {
    const enemies = new EnemyManager(
      definition.air.map(
        (a, i) => new CampaignFighter(i, a, flight, definition.number),
      ),
    );
    const fighter = definition.aircraft === "F35";
    super(flight, sound, {
      enemies,
      compound: new CampaignCompound(definition.ground),
      mission: new CampaignState(definition),
      targeting: fighter
        ? new FighterTargeting(enemies.aircraft, flight)
        : undefined,
      weapons: fighter ? FighterWeapons : WeaponManager,
    });
    this.profile = upgradeManager.profile(
      aircraftConfigs[definition.aircraft],
      definition.bombs,
      definition.missiles,
    );
    this.weapons.configure(this.profile.weapons);
    this.player = new PlayerHealth(
      this.profile.health,
      this.profile.resistance,
    );
    this.hostileFire = new EnemyFire(
      flight,
      this.player,
      this.effects,
      sound,
      definition.number,
    );
    this.boss = new BossController(
      definition.boss,
      this.compound.targets,
      this.fighters,
    );
    this.root.add(this.hostileFire.root, this.markers);
    for (const config of definition.friendly ?? []) {
      const position = new THREE.Vector3(...config.position);
      position.y = Math.max(114, terrainHeight(position.x, position.z)) + 5;
      const target = new GroundTarget(
        config.id,
        "command",
        position,
        new THREE.Vector3(150, 90, 150),
        450,
      );
      target.material.color.set("#4eaa9d");
      target.onDestroyed = () => {
        this.effects.spawn(target.position, "large", flight.position);
        this.sound("explosion");
      };
      this.friendly.push(target);
      this.root.add(target.root);
    }
    for (const objective of definition.objectives) {
      if (
        objective.type !== "CHECKPOINTS" &&
        objective.type !== "REACH_LOCATION"
      )
        continue;
      for (const [index, point] of (objective.locations ?? []).entries()) {
        const mesh = new THREE.Mesh(
          new THREE.TorusGeometry(objective.radius ?? 500, 9, 6, 48),
          new THREE.MeshBasicMaterial({
            color: "#b8eecf",
            transparent: true,
            opacity: 0.55,
          }),
        );
        mesh.position.set(...point);
        this.markers.add(mesh);
        this.gates.push({ mesh, objective: objective.id, index });
      }
    }
    this.activateInitial();
    this.briefing();
  }
  private briefing() {
    this.radio = `CONTROL // ${this.definition.name.toUpperCase()} · ${this.definition.aircraft === "B2" ? "Check your impact ring. Prioritize the ground objectives." : "Contacts ahead. TAB to acquire, F to launch."}`;
  }
  get fighters() {
    return this.enemies.aircraft as CampaignFighter[];
  }
  get failed() {
    return this.mission.failed;
  }
  get concluding() {
    return this.finale > 0;
  }
  get cinematic() {
    if (!this.definition.boss || (this.introTime <= 0 && !this.concluding))
      return null;
    const target =
      this.definition.boss === "iron-shield"
        ? this.compound.targets.at(-1)!.position
        : this.fighters.at(-1)!.position;
    return {
      target,
      large: this.definition.boss === "iron-shield",
      blend: this.concluding
        ? Math.min(1, this.finale)
        : Math.sin((1 - this.introTime / 3.5) * Math.PI),
    };
  }
  private activateInitial() {
    this.fighters
      .filter((a) => a.definition.wave === 0)
      .forEach((a) => a.activate());
  }
  override setTrigger(held: boolean) {
    if (this.weapons instanceof FighterWeapons) this.weapons.cannonHeld = held;
  }
  override action(code: string) {
    if (code === "KeyC") this.introTime = 0;
    if (this.failed || this.mission.complete || this.finale) return;
    if (code === "KeyG" && this.weapons instanceof FighterWeapons)
      this.weapons.cycleGround();
    else if (code === "KeyB" && this.profile.boost && this.boostCooldown <= 0) {
      this.boostTime = this.profile.boost.duration;
      this.boostCooldown = 15;
      this.radio = "AFTERBURNER // Boost engaged";
      this.radioTime = 2;
    } else super.action(code);
  }
  private waves(dt: number) {
    this.nextWaveTime = Math.max(0, this.nextWaveTime - dt);
    const waiting = this.fighters.filter((a) => !a.active);
    if (!waiting.length) return;
    const next = Math.min(...waiting.map((a) => a.definition.wave));
    const eligible =
      this.definition.boss === "iron-shield"
        ? this.boss.phase > next
        : this.fighters
            .filter((a) => a.definition.wave < next)
            .every((a) => a.destroyed);
    if (!eligible || this.nextWaveTime > 0) return;
    waiting
      .filter((a) => a.definition.wave === next)
      .forEach((a) => {
        a.activate();
        a.strikeTarget =
          this.friendly[a.index % Math.max(1, this.friendly.length)];
      });
    this.nextWaveTime = 8;
    this.radio = waiting.some((a) => a.definition.role === "boss")
      ? "RAVEN ONE // Your escorts were only the beginning."
      : `CONTROL // Reinforcement wave ${next + 1}. New contacts inbound.`;
    this.radioTime = 6;
    this.sound(
      waiting.some((a) => a.definition.role === "boss") ? "boss" : "warning",
    );
  }
  override update(dt: number) {
    if (this.failed || this.mission.complete) return;
    if (this.flight.crashed) {
      this.fail("Terrain contact. Aircraft lost.");
      return;
    }
    this.radioTime = Math.max(0, this.radioTime - dt);
    this.introTime = Math.max(0, this.introTime - dt);
    this.boostTime = Math.max(0, this.boostTime - dt);
    this.boostCooldown = Math.max(0, this.boostCooldown - dt);
    this.flight.boost =
      this.boostTime > 0 ? (this.profile.boost?.force ?? 1) : 1;
    this.player.update(dt);
    if (this.targeting instanceof FighterTargeting) {
      const before = this.targeting.valid(this.flight.position);
      this.targeting.tick(dt);
      if (!before && this.targeting.valid(this.flight.position))
        this.sound("lock");
    }
    if (this.weapons instanceof FighterWeapons)
      this.weapons.tick(dt, this.flight);
    super.update(dt);
    this.boss.update();
    this.waves(dt);
    if (this.boss.active && this.boss.phase !== this.previousPhase) {
      if (this.previousPhase === 0) this.introTime = 3.5;
      this.previousPhase = this.boss.phase;
      this.radio = `${this.boss.name} // PHASE ${this.boss.phase} · ${this.boss.instruction}`;
      this.radioTime = 7;
      this.sound("boss");
    }
    if (!this.boss.defeated)
      this.hostileFire.update(
        dt,
        this.compound.targets,
        this.fighters,
        this.definition.boss ? this.boss.phase : 0,
      );
    this.friendly.forEach((f) => f.update(dt));
    this.damageSmokeTime += dt;
    if (this.damageSmokeTime > 0.25) {
      this.damageSmokeTime = 0;
      if (this.player.health < this.player.max * 0.35) {
        this.effects.smoke(this.flight.position);
        this.effects.shake = Math.max(this.effects.shake, 0.25);
      }
      this.fighters
        .filter((a) => a.active && !a.destroyed && a.health < a.maxHealth * 0.4)
        .forEach((a) => this.effects.smoke(a.position));
    }
    this.mission.objectives.update({
      time: this.mission.time,
      position: this.flight.position,
      targets: this.compound.targets,
      airKills: this.mission.aircraft,
      bossDefeated: this.boss.defeated,
      friendly: this.friendly,
    });
    for (const gate of this.gates) {
      const objective = this.mission.objectives.entries.find(
        (o) => o.config.id === gate.objective,
      )!;
      gate.mesh.visible =
        objective.active &&
        !objective.complete &&
        gate.index === objective.progress;
    }
    if (this.player.destroyed)
      this.fail("Aircraft integrity lost to hostile fire.");
    else if (this.mission.objectives.failed)
      this.fail("A protected district was destroyed.");
    else if (this.mission.time > 1200)
      this.fail("Operation window expired. Reposition and try again.");
    else if (this.mission.objectives.complete) {
      if (this.definition.boss) {
        this.finale += dt;
        this.finaleBurst += dt;
        if (this.finaleBurst > 0.55 && this.finale < 3.5) {
          this.finaleBurst = 0;
          const location =
            this.definition.boss === "iron-shield"
              ? this.compound.targets.at(-1)!.position
              : this.fighters.at(-1)!.position;
          this.effects.spawn(
            location
              .clone()
              .add(
                new THREE.Vector3(
                  Math.sin(this.finale * 10) * 100,
                  40,
                  Math.cos(this.finale * 8) * 100,
                ),
              ),
            "large",
            this.flight.position,
          );
          this.sound("explosion");
        }
        this.radio = `${this.boss.name} // TARGET DESTROYED`;
        this.radioTime = 4;
      }
      if (!this.definition.boss || this.finale >= 4) this.finish();
    }
  }
  fail(reason: string) {
    if (this.failed || this.mission.complete) return;
    this.mission.fail(reason);
    this.setTrigger(false);
    this.flight.boost = 1;
    this.sound("failed");
    this.effects.spawn(this.flight.position, "aircraft", this.flight.position);
  }
  private finish() {
    this.mission.complete = true;
    this.setTrigger(false);
    this.flight.boost = 1;
    this.result = this.mission.result({
      shots: this.weapons.shots,
      hits: this.weapons.hits,
      damage: this.player.damageTaken,
      maxHealth: this.player.max,
      boss: this.boss.defeated,
      cannonHits: this.weapons.cannonHits,
    });
    this.sound("complete");
  }
  override reset() {
    super.reset();
    this.player?.reset();
    this.hostileFire?.reset();
    this.friendly?.forEach((f) => f.reset());
    this.boss?.reset();
    this.activateInitial();
    this.result = undefined;
    this.boostTime =
      this.boostCooldown =
      this.nextWaveTime =
      this.damageSmokeTime =
      this.finale =
      this.finaleBurst =
      this.previousPhase =
        0;
    this.flight.boost = 1;
    this.radioTime = 6;
    this.introTime = 0;
    this.briefing();
  }
  override dispose() {
    super.dispose();
    if (this.weapons instanceof FighterWeapons) this.weapons.dispose();
    this.hostileFire.dispose();
  }
  override get diagnostics() {
    return {
      ...super.diagnostics,
      campaign: this.definition.id,
      health: this.player.health,
      maxHealth: this.player.max,
      failed: this.failed,
      failure: this.mission.failure,
      result: this.result,
      boss: this.definition.boss
        ? {
            name: this.boss.name,
            active: this.boss.active,
            phase: this.boss.phase,
            health: this.boss.health,
            defeated: this.boss.defeated,
          }
        : null,
      hostileShots: this.hostileFire.shots.length,
      incoming: this.hostileFire.incoming,
      objectives: this.mission.objectives.entries.map((o) => ({
        id: o.config.id,
        type: o.config.type,
        progress: o.progress,
        total: o.total,
        active: o.active,
        complete: o.complete,
      })),
      cannon:
        this.weapons instanceof FighterWeapons ? this.weapons.cannonAmmo : 0,
      friendly: this.friendly.map((f) => ({ id: f.id, health: f.health })),
      enemies: this.fighters.map((a) => ({
        id: a.id,
        active: a.active,
        wave: a.definition.wave,
        behavior: a.behavior,
      })),
    };
  }
}
