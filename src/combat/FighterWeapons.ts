import * as THREE from "three";
import { Bomb } from "./Bomb";
import { WeaponManager, defaultWeapons } from "./WeaponManager";
import type { FlightModel } from "../physics/FlightModel";
import type { GroundTarget } from "../world/GroundTarget";
import { segmentSphere, segmentTerrain } from "./collision";

class PrecisionWeapon extends Bomb {
  constructor(
    flight: FlightModel,
    readonly target: GroundTarget,
  ) {
    super(flight);
  }
  override update(dt: number) {
    this.age += dt;
    this.previous.copy(this.position);
    const aim = this.target.bounds
      .getCenter(new THREE.Vector3())
      .sub(this.position);
    this.velocity.lerp(
      aim.normalize().multiplyScalar(480),
      1 - Math.exp(-dt * 4),
    );
    this.position.addScaledVector(this.velocity, dt);
    this.root.position.copy(this.position);
    this.root.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 0, -1),
      this.velocity.clone().normalize(),
    );
  }
}
type Tracer = {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  previous: THREE.Vector3;
  age: number;
};
export class FighterWeapons extends WeaponManager {
  override tuning = { ...defaultWeapons, bombs: 4 };
  override bombs = 4;
  override selected = "AIR-TO-AIR";
  override message = "TAB · SELECT AIR TARGET / G · SELECT GROUND TARGET";
  cannonAmmo = 360;
  cannonHeld = false;
  groundTarget: GroundTarget | null = null;
  private cooldown = 0;
  private strikeCooldown = 0;
  private muzzleTime = 0;
  private readonly tracers: Tracer[] = [];
  private readonly tracerGeometry = new THREE.BoxGeometry(0.5, 0.5, 30);
  private readonly tracerMaterial = new THREE.MeshBasicMaterial({
    color: "#fff4a3",
  });
  readonly muzzle = new THREE.Mesh(
    new THREE.IcosahedronGeometry(1.8),
    new THREE.MeshBasicMaterial({ color: "#fff1b0" }),
  );
  cycleGround() {
    const alive = this.ground.filter((t) => !t.destroyed);
    this.groundTarget =
      alive[(alive.indexOf(this.groundTarget!) + 1) % alive.length] ?? null;
    this.selected = "PRECISION STRIKE";
  }
  override drop(flight: FlightModel) {
    this.selected = "PRECISION STRIKE";
    if (!this.groundTarget || this.groundTarget.destroyed) {
      this.message = "G · DESIGNATE A GROUND TARGET";
      return false;
    }
    if (flight.position.distanceTo(this.groundTarget.position) > 7000) {
      this.message = "STRIKE TARGET OUT OF RANGE";
      return false;
    }
    if (!this.bombs || this.strikeCooldown > 0) {
      this.message = this.bombs ? "STRIKE BAY CYCLING" : "STRIKE WEAPONS EMPTY";
      return false;
    }
    this.bombs--;
    this.strikeCooldown = 0.8 * this.tuning.cooldown;
    this.add(new PrecisionWeapon(flight, this.groundTarget));
    this.sound("bomb");
    this.message = "GUIDED STRIKE AWAY";
    return true;
  }
  override fire(
    flight: FlightModel,
    target: Parameters<WeaponManager["fire"]>[1],
  ) {
    this.selected = "AIR-TO-AIR";
    if (!target) {
      this.message = "NO LOCK · KEEP TARGET AHEAD TO ACQUIRE";
      return false;
    }
    const fired = super.fire(flight, target);
    this.selected = "AIR-TO-AIR";
    return fired;
  }
  tick(dt: number, flight: FlightModel) {
    this.cooldown -= dt;
    this.strikeCooldown -= dt;
    this.muzzleTime -= dt;
    if (this.cannonHeld && this.cannonAmmo > 0 && this.cooldown <= 0) {
      this.cooldown = 0.075 * this.tuning.cooldown;
      this.shots++;
      this.cannonAmmo--;
      this.selected = "CANNON";
      const mesh = new THREE.Mesh(this.tracerGeometry, this.tracerMaterial);
      mesh.position
        .set(1.5, 0.2, -11)
        .applyQuaternion(flight.orientation)
        .add(flight.position);
      mesh.quaternion.copy(flight.orientation);
      // Small arcade aim assistance inside the reticle, still requiring a close, forward target.
      let direction = flight.forward.clone();
      const assist = this.enemies.find(
        (t) =>
          !t.destroyed &&
          t.position.distanceTo(flight.position) < 1400 &&
          t.position.clone().sub(flight.position).normalize().dot(direction) >
            0.99,
      );
      if (assist)
        direction = assist.position
          .clone()
          .addScaledVector(
            assist.velocity,
            assist.position.distanceTo(flight.position) / 2400,
          )
          .sub(mesh.position)
          .normalize();
      this.tracers.push({
        mesh,
        velocity: direction.multiplyScalar(2400),
        previous: mesh.position.clone(),
        age: 0,
      });
      this.root.add(mesh, this.muzzle);
      this.muzzleTime = 0.045;
      this.sound("cannon");
      this.message = "CANNON · SHORT-RANGE BURST";
    }
    this.muzzle.position
      .set(1.5, 0.2, -12)
      .applyQuaternion(flight.orientation)
      .add(flight.position);
    this.muzzle.visible = this.muzzleTime > 0;
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const t = this.tracers[i];
      t.age += dt;
      t.previous.copy(t.mesh.position);
      t.mesh.position.addScaledVector(t.velocity, dt);
      let hit = false;
      for (const enemy of this.enemies) {
        if (enemy.destroyed) continue;
        if (
          segmentSphere(
            t.previous.clone().sub(enemy.previousPosition),
            t.mesh.position.clone().sub(enemy.position),
            new THREE.Vector3(),
            enemy.radius + 4,
          ) !== null
        ) {
          const before = enemy.health;
          enemy.takeDamage(18 * this.tuning.damage * this.tuning.cannonDamage);
          if (enemy.health < before) {
            this.hits++;
            this.cannonHits++;
            this.hitTime = 0.2;
          }
          this.effects.sparks(t.mesh.position);
          hit = true;
          break;
        }
      }
      if (
        hit ||
        t.age > 0.6 ||
        segmentTerrain(t.previous, t.mesh.position, this.height) !== null
      ) {
        t.mesh.removeFromParent();
        this.tracers.splice(i, 1);
      }
    }
  }
  override reset() {
    super.reset();
    this.bombs = this.tuning.bombs;
    this.cannonAmmo = this.tuning.cannon;
    this.cannonHeld = false;
    this.groundTarget = null;
    this.cooldown = this.strikeCooldown = this.muzzleTime = 0;
    this.muzzle.visible = false;
    this.tracers.forEach((t) => t.mesh.removeFromParent());
    this.tracers.length = 0;
    this.selected = "AIR-TO-AIR";
    this.message = "TAB · SELECT AIR TARGET / G · SELECT GROUND TARGET";
  }
  dispose() {
    this.reset();
    this.tracerGeometry.dispose();
    this.tracerMaterial.dispose();
    this.muzzle.geometry.dispose();
    (this.muzzle.material as THREE.Material).dispose();
  }
  get tracerCount() {
    return this.tracers.length;
  }
}
