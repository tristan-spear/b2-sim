import * as THREE from "three";
import type { FlightModel } from "../physics/FlightModel";
import type { CampaignFighter } from "../enemies/CampaignFighter";
import type { CampaignGround } from "../campaign/CampaignGround";
import type { PlayerHealth } from "../campaign/PlayerHealth";
import type { GroundTarget } from "../world/GroundTarget";
import type { ExplosionSystem } from "./Explosion";
import type { CombatSound } from "./WeaponManager";
import { segmentSphere, segmentTerrain } from "./collision";
import { terrainHeight } from "../utils/noise";

interface Shot {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  source: THREE.Vector3;
  age: number;
  trail: number;
  missile: boolean;
  damage: number;
  friendly?: GroundTarget;
}
export class EnemyFire {
  readonly root = new THREE.Group();
  readonly shots: Shot[] = [];
  private readonly pool: Shot[] = [];
  private readonly geometry = new THREE.SphereGeometry(1, 6, 4);
  private readonly bulletMaterial = new THREE.MeshBasicMaterial({
    color: "#ff9365",
  });
  private readonly missileMaterial = new THREE.MeshBasicMaterial({
    color: "#ffdb93",
  });
  private readonly cooldowns = new Map<string, number>();
  private age = 0;
  private warningCooldown = 0;
  private damageCooldown = 0;
  private previousPlayer = new THREE.Vector3();
  constructor(
    private readonly flight: FlightModel,
    private readonly health: PlayerHealth,
    private readonly effects: ExplosionSystem,
    private readonly sound: (kind: CombatSound) => void,
    readonly difficulty: number,
  ) {
    this.previousPlayer.copy(flight.position);
  }
  get incoming() {
    return this.shots.some((s) => s.missile && !s.friendly);
  }
  get nearest() {
    return this.shots
      .filter((s) => !s.friendly)
      .sort(
        (a, b) =>
          a.mesh.position.distanceToSquared(this.flight.position) -
          b.mesh.position.distanceToSquared(this.flight.position),
      )[0];
  }
  private ready(id: string, interval: number) {
    const next = this.cooldowns.get(id);
    if (next === undefined) {
      this.cooldowns.set(id, this.age + 3 + this.cooldowns.size * 0.5);
      return false;
    }
    if (this.age < next) return false;
    this.cooldowns.set(id, this.age + interval);
    return true;
  }
  private fire(
    source: THREE.Vector3,
    missile: boolean,
    damage: number,
    friendly?: GroundTarget,
    spread = 0,
  ) {
    if (this.shots.length >= 80) return;
    const shot = this.pool.pop() ?? {
      mesh: new THREE.Mesh(this.geometry, this.bulletMaterial),
      velocity: new THREE.Vector3(),
      source: new THREE.Vector3(),
      age: 0,
      trail: 0,
      missile,
      damage,
    };
    const target = friendly?.position ?? this.flight.position;
    const speed = missile
      ? 470 + this.difficulty * 12
      : 610 + this.difficulty * 25;
    const aim = target.clone();
    if (!friendly && !missile)
      aim.addScaledVector(
        this.flight.velocity,
        (source.distanceTo(target) / speed) * 0.9,
      );
    aim.x += Math.sin(this.age * 2.7 + spread) * (missile ? 0 : 70);
    aim.y += Math.cos(this.age + spread) * (missile ? 0 : 35);
    shot.velocity.copy(aim).sub(source).normalize().multiplyScalar(speed);
    shot.mesh.position.copy(source);
    shot.mesh.material = missile ? this.missileMaterial : this.bulletMaterial;
    shot.mesh.scale.set(
      missile ? 3.5 : 3,
      missile ? 3.5 : 3,
      missile ? 18 : 24,
    );
    shot.source.copy(source);
    shot.age = shot.trail = 0;
    shot.missile = missile;
    shot.damage = damage;
    shot.friendly = friendly;
    this.shots.push(shot);
    this.root.add(shot.mesh);
    this.effects.sparks(source);
    this.sound(missile ? "missile" : "enemy");
  }
  update(
    dt: number,
    ground: CampaignGround[],
    enemies: CampaignFighter[],
    bossPhase = 0,
  ) {
    this.age += dt;
    this.warningCooldown -= dt;
    this.damageCooldown -= dt;
    const radars = ground.filter((g) => g.kind === "radar");
    const radarSupport = !radars.length || radars.some((g) => !g.destroyed);
    for (const g of ground) {
      const defense = g.definition.defense;
      if (!defense || g.destroyed) continue;
      const missile = defense === "battery";
      if (missile && !radarSupport && !bossPhase) continue;
      const range = missile ? 6500 : defense === "heavy" ? 3800 : 2900;
      const distance = g.position.distanceTo(this.flight.position);
      g.turret.rotation.y = Math.atan2(
        g.position.x - this.flight.position.x,
        g.position.z - this.flight.position.z,
      );
      if (
        distance > range ||
        !this.ready(
          g.id,
          missile ? 9 - this.difficulty * 0.5 : 6 - this.difficulty * 0.55,
        )
      )
        continue;
      const source = g.position
        .clone()
        .add(new THREE.Vector3(0, g.size.y + 30, 0));
      const count = defense === "heavy" ? 3 : 1;
      for (let i = 0; i < count; i++)
        this.fire(
          source,
          missile,
          missile ? 42 : defense === "heavy" ? 25 : 17,
          undefined,
          i * 2,
        );
    }
    for (const enemy of enemies) {
      if (!enemy.active || enemy.destroyed) continue;
      const boss = enemy.definition.role === "boss";
      const friendly =
        enemy.definition.role === "strike"
          ? (enemy.strikeTarget as GroundTarget | undefined)
          : undefined;
      const target = friendly?.position ?? this.flight.position;
      const range = friendly ? 3400 : 4200;
      const direction = target.clone().sub(enemy.position).normalize();
      const ahead = new THREE.Vector3(0, 0, -1)
        .applyQuaternion(enemy.root.quaternion)
        .dot(direction);
      if (
        enemy.position.distanceTo(target) > range ||
        ahead < (friendly ? 0.1 : 0.5) ||
        !this.ready(
          enemy.id,
          boss ? 4.8 - enemy.bossPhase * 0.65 : 7 - this.difficulty * 0.65,
        )
      )
        continue;
      const missile =
        !friendly &&
        (boss || (this.difficulty >= 3 && Math.floor(this.age) % 2 === 0));
      for (let i = 0; i < (boss && enemy.bossPhase >= 2 ? 2 : 1); i++)
        this.fire(
          enemy.position.clone().addScaledVector(direction, 30 + i * 20),
          missile,
          friendly ? 45 : missile ? 34 : 14,
          friendly,
          i,
        );
    }
    for (let i = this.shots.length - 1; i >= 0; i--) {
      const s = this.shots[i],
        previous = s.mesh.position.clone();
      s.age += dt;
      s.trail += dt;
      if (s.missile && s.age < 7) {
        const target = s.friendly?.position ?? this.flight.position;
        const current = new THREE.Quaternion().setFromUnitVectors(
          new THREE.Vector3(0, 0, -1),
          s.velocity.clone().normalize(),
        );
        const desired = new THREE.Quaternion().setFromUnitVectors(
          new THREE.Vector3(0, 0, -1),
          target.clone().sub(previous).normalize(),
        );
        current.rotateTowards(desired, dt * 0.38);
        s.velocity
          .set(0, 0, -1)
          .applyQuaternion(current)
          .multiplyScalar(470 + this.difficulty * 12);
      }
      s.mesh.position.addScaledVector(s.velocity, dt);
      s.mesh.quaternion.setFromUnitVectors(
        new THREE.Vector3(0, 0, -1),
        s.velocity.clone().normalize(),
      );
      if (s.missile && s.trail > 0.09) {
        this.effects.trail(s.mesh.position);
        s.trail = 0;
      }
      const target = s.friendly?.position ?? this.flight.position;
      const oldTarget = s.friendly?.position ?? this.previousPlayer;
      const hit =
        segmentSphere(
          previous.clone().sub(oldTarget),
          s.mesh.position.clone().sub(target),
          new THREE.Vector3(),
          s.friendly ? 95 : s.missile ? 32 : 26,
        ) !== null;
      if (hit) {
        if (s.friendly) s.friendly.takeDamage(s.damage);
        else {
          this.health.hit(s.damage, s.source);
          this.effects.shake = Math.max(this.effects.shake, 1.3);
          if (this.damageCooldown <= 0) {
            this.sound("damage");
            this.damageCooldown = 0.4;
          }
        }
        this.effects.sparks(s.mesh.position);
      }
      if (
        hit ||
        s.age > (s.missile ? 10 : 7) ||
        segmentTerrain(previous, s.mesh.position, terrainHeight) !== null
      ) {
        s.mesh.removeFromParent();
        this.pool.push(s);
        this.shots.splice(i, 1);
      }
    }
    if (this.incoming && this.warningCooldown <= 0) {
      this.sound("warning");
      this.warningCooldown = 2.5;
    }
    this.previousPlayer.copy(this.flight.position);
  }
  reset() {
    this.shots.forEach((s) => {
      s.mesh.removeFromParent();
      this.pool.push(s);
    });
    this.shots.length = 0;
    this.cooldowns.clear();
    this.age = this.warningCooldown = this.damageCooldown = 0;
    this.previousPlayer.copy(this.flight.position);
  }
  dispose() {
    this.reset();
    this.pool.length = 0;
    this.geometry.dispose();
    this.bulletMaterial.dispose();
    this.missileMaterial.dispose();
    this.root.removeFromParent();
  }
}
