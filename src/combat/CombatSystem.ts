import * as THREE from "three";
import { EnemyManager } from "../enemies/EnemyManager";
import { TargetCompound } from "../world/TargetCompound";
import { terrainHeight } from "../utils/noise";
import type { FlightModel } from "../physics/FlightModel";
import { ExplosionSystem } from "./Explosion";
import { Mission } from "./Mission";
import { TargetManager } from "./TargetManager";
import { WeaponManager, type CombatSound } from "./WeaponManager";
export class CombatSystem {
  readonly root = new THREE.Group();
  readonly enemies: EnemyManager;
  readonly compound: Pick<
    TargetCompound,
    "root" | "targets" | "update" | "reset"
  >;
  readonly effects = new ExplosionSystem();
  readonly mission: Mission;
  readonly targeting: TargetManager;
  readonly weapons: WeaponManager;
  private smokeTime = 0;
  constructor(
    protected readonly flight: FlightModel,
    protected readonly sound: (kind: CombatSound) => void,
    options?: {
      enemies: EnemyManager;
      compound: CombatSystem["compound"];
      mission: Mission;
      targeting?: TargetManager;
      weapons?: typeof WeaponManager;
    },
  ) {
    this.enemies = options?.enemies ?? new EnemyManager();
    this.compound = options?.compound ?? new TargetCompound();
    this.mission = options?.mission ?? new Mission();
    this.targeting =
      options?.targeting ?? new TargetManager(this.enemies.aircraft);
    const Weapons = options?.weapons ?? WeaponManager;
    this.weapons = new Weapons(
      this.compound.targets,
      this.enemies.aircraft,
      terrainHeight,
      this.effects,
      sound,
    );
    this.root.add(
      this.enemies.root,
      this.compound.root,
      this.effects.root,
      this.weapons.root,
    );
    [...this.enemies.aircraft, ...this.compound.targets].forEach((target) => {
      target.onDestroyed = (t) => {
        this.mission.record(t);
        this.effects.spawn(
          t.position,
          t.kind === "aircraft"
            ? "aircraft"
            : t.kind === "command"
              ? "large"
              : "bomb",
          this.flight.position,
        );
      };
    });
  }
  setTrigger(_held: boolean) {}
  dispose() {
    this.reset();
    this.effects.dispose();
  }
  action(code: string) {
    if (this.mission.complete || this.flight.crashed) return;
    if (code === "Space") this.weapons.drop(this.flight);
    if (code === "KeyF")
      this.weapons.fire(
        this.flight,
        this.targeting.valid(this.flight.position)
          ? this.targeting.selected
          : null,
      );
    if (code === "Tab") {
      this.targeting.cycle();
      if (this.targeting.valid(this.flight.position)) this.sound("lock");
    }
  }
  update(dt: number) {
    this.enemies.update(dt);
    this.compound.update(dt);
    this.weapons.update(dt, this.flight.position);
    this.targeting.update();
    this.mission.update(dt, this.enemies.aircraft);
    this.effects.update(dt);
    this.smokeTime += dt;
    if (this.smokeTime >= 0.4) {
      this.smokeTime = 0;
      this.compound.targets.forEach((t) => {
        if (t.destroyed) this.effects.smoke(t.position);
      });
    }
  }
  reset() {
    this.targeting.reset();
    this.weapons.reset();
    this.effects.reset();
    this.enemies.reset();
    this.compound.reset();
    this.mission.reset();
    this.smokeTime = 0;
  }
  get diagnostics() {
    return {
      bombs: this.weapons.bombs,
      missiles: this.weapons.missiles,
      projectiles: this.weapons.projectiles.map((p) => ({
        kind: p.kind,
        position: p.position.toArray(),
        age: p.age,
      })),
      score: this.mission.score,
      mission: {
        radar: this.mission.radar,
        aircraft: this.mission.aircraft,
        command: this.mission.command,
        complete: this.mission.complete,
        time: this.mission.time,
      },
      targets: [...this.compound.targets, ...this.enemies.aircraft].map(
        (t) => ({
          id: t.id,
          position: t.position.toArray(),
          health: t.health,
          destroyed: t.destroyed,
        }),
      ),
      selected: this.targeting.selected?.id ?? null,
      locked: this.targeting.valid(this.flight.position),
      particles: this.effects.count,
      lastImpact: this.weapons.lastImpact?.toArray() ?? null,
    };
  }
}
