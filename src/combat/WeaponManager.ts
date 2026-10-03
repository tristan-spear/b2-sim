import * as THREE from "three";
import { Bomb } from "./Bomb";
import { Missile } from "./Missile";
import {
  segmentBox,
  segmentSphere,
  segmentTerrain,
  type HeightSampler,
} from "./collision";
import type { FlightModel } from "../physics/FlightModel";
import type { GroundTarget } from "../world/GroundTarget";
import type { EnemyAircraft } from "../enemies/EnemyAircraft";
import type { ExplosionSystem } from "./Explosion";
export type CombatSound =
  | "bomb"
  | "missile"
  | "explosion"
  | "lock"
  | "cannon"
  | "warning"
  | "damage"
  | "enemy"
  | "boss"
  | "complete"
  | "failed";
export interface WeaponTuning {
  bombs: number;
  missiles: number;
  cannon: number;
  damage: number;
  missileDamage: number;
  cannonDamage: number;
  blastRadius: number;
  cooldown: number;
}
export const defaultWeapons: WeaponTuning = {
  bombs: 8,
  missiles: 6,
  cannon: 360,
  damage: 1,
  missileDamage: 1,
  cannonDamage: 1,
  blastRadius: 190,
  cooldown: 1,
};
export class WeaponManager {
  tuning: WeaponTuning = { ...defaultWeapons };
  shots = 0;
  hits = 0;
  cannonHits = 0;
  configure(tuning: WeaponTuning) {
    this.tuning = { ...tuning };
    this.reset();
  }
  readonly root = new THREE.Group();
  readonly projectiles: (Bomb | Missile)[] = [];
  bombs = 8;
  missiles = 6;
  selected = "BOMB";
  hitTime = 0;
  message = "TAB TO SELECT AN AIR TARGET";
  lastImpact: THREE.Vector3 | null = null;
  private bombCooldown = 0;
  private missileCooldown = 0;
  constructor(
    protected readonly ground: GroundTarget[],
    protected readonly enemies: EnemyAircraft[],
    protected readonly height: HeightSampler,
    protected readonly effects: ExplosionSystem,
    protected readonly sound: (kind: CombatSound) => void,
  ) {}
  drop(flight: FlightModel) {
    this.selected = "BOMB";
    if (!this.bombs || this.bombCooldown > 0) {
      this.message = this.bombs
        ? "BOMB RACK CYCLING"
        : "BOMBS EMPTY · R TO REARM";
      return false;
    }
    this.bombs--;
    this.bombCooldown = 0.65 * this.tuning.cooldown;
    this.add(new Bomb(flight));
    this.sound("bomb");
    this.message = "BOMB AWAY";
    return true;
  }
  fire(flight: FlightModel, target: EnemyAircraft | null) {
    this.selected = "MISSILE";
    if (!this.missiles || this.missileCooldown > 0) {
      this.message = this.missiles
        ? "MISSILE RAIL CYCLING"
        : "MISSILES EMPTY · R TO REARM";
      return false;
    }
    this.missiles--;
    this.missileCooldown = 0.8 * this.tuning.cooldown;
    this.add(new Missile(flight, target));
    this.sound("missile");
    this.message = target ? "MISSILE AWAY" : "MISSILE AWAY · UNGUIDED";
    return true;
  }
  protected add(projectile: Bomb | Missile) {
    this.shots++;
    this.projectiles.push(projectile);
    this.root.add(projectile.root);
  }
  private remove(index: number) {
    const [p] = this.projectiles.splice(index, 1);
    this.root.remove(p.root);
    p.root.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.geometry.dispose();
        (o.material as THREE.Material).dispose();
      }
    });
  }
  update(dt: number, viewer: THREE.Vector3) {
    this.bombCooldown = Math.max(0, this.bombCooldown - dt);
    this.missileCooldown = Math.max(0, this.missileCooldown - dt);
    this.hitTime = Math.max(0, this.hitTime - dt);
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.update(dt);
      let fraction =
        segmentTerrain(p.previous, p.position, this.height) ?? Infinity;
      let victim: EnemyAircraft | null = null;
      for (const target of this.ground) {
        if (target.destroyed) continue;
        const t = segmentBox(p.previous, p.position, target.bounds);
        if (t !== null && t < fraction) fraction = t;
      }
      if (p instanceof Missile) {
        for (const enemy of this.enemies) {
          if (enemy.destroyed) continue;
          const a = p.previous.clone().sub(enemy.previousPosition),
            b = p.position.clone().sub(enemy.position);
          const t = segmentSphere(a, b, new THREE.Vector3(), enemy.radius + 8);
          if (t !== null && t < fraction) {
            fraction = t;
            victim = enemy;
          }
        }
        p.trailTime += dt;
        if (p.trailTime >= 0.05) {
          this.effects.trail(p.position);
          p.trailTime = 0;
        }
      }
      if (fraction !== Infinity) {
        const impact = p.previous.clone().lerp(p.position, fraction);
        this.lastImpact = impact.clone();
        this.effects.spawn(impact, p.kind, viewer);
        this.sound("explosion");
        if (p instanceof Bomb) {
          let damaged = false;
          for (const target of this.ground) {
            if (target.destroyed) continue;
            const distance = target.bounds.distanceToPoint(impact);
            if (distance < this.tuning.blastRadius) {
              const before = target.health;
              target.takeDamage(
                320 *
                  this.tuning.damage *
                  (1 - distance / this.tuning.blastRadius),
              );
              if (target.health < before) {
                damaged = true;
                this.hitTime = 0.35;
              }
            }
          }
          if (damaged) this.hits++;
        } else if (victim) {
          const before = victim.health;
          victim.takeDamage(
            p.damage * this.tuning.damage * this.tuning.missileDamage,
          );
          if (victim.health < before) {
            this.hits++;
            this.hitTime = 0.35;
          }
        }
        this.remove(i);
      } else if (p.age >= p.lifetime) this.remove(i);
    }
  }
  predict(flight: FlightModel) {
    const position = new THREE.Vector3(0, -6, 0)
        .applyQuaternion(flight.orientation)
        .add(flight.position),
      velocity = flight.velocity.clone(),
      previous = position.clone();
    for (let i = 0; i < 300; i++) {
      previous.copy(position);
      position.addScaledVector(velocity, 0.2);
      position.y -= 0.5 * 9.81 * 0.04;
      velocity.y -= 9.81 * 0.2;
      let t = segmentTerrain(previous, position, this.height) ?? Infinity;
      for (const target of this.ground)
        if (!target.destroyed)
          t = Math.min(
            t,
            segmentBox(previous, position, target.bounds) ?? Infinity,
          );
      if (t !== Infinity) return previous.lerp(position, t);
    }
    return position;
  }
  reset() {
    while (this.projectiles.length) this.remove(0);
    this.bombs = this.tuning.bombs;
    this.missiles = this.tuning.missiles;
    this.shots = this.hits = this.cannonHits = 0;
    this.bombCooldown = this.missileCooldown = this.hitTime = 0;
    this.selected = "BOMB";
    this.message = "TAB TO SELECT AN AIR TARGET";
    this.lastImpact = null;
  }
}
