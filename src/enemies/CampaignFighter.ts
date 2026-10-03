import * as THREE from "three";
import { EnemyAircraft } from "./EnemyAircraft";
import type { FlightModel } from "../physics/FlightModel";
import type { AirConfig } from "../campaign/types";
import type { Damageable } from "../combat/Damageable";
import { terrainHeight } from "../utils/noise";

export class CampaignFighter extends EnemyAircraft {
  active = false;
  behavior = "WAITING";
  bossPhase = 1;
  private age = 0;
  private readonly direction = new THREE.Vector3(0, 0, -1);
  private readonly desired = new THREE.Quaternion();
  strikeTarget?: Damageable;
  constructor(
    index: number,
    readonly definition: AirConfig,
    private readonly player: FlightModel,
    readonly difficulty: number,
  ) {
    super(index, definition);
    if (definition.role === "boss") {
      for (const child of [...this.root.children]) {
        this.root.remove(child);
        (child as THREE.Mesh).geometry.dispose();
      }
      this.root.scale.setScalar(1.8);
      this.material.color.set("#272939");
      const hull = new THREE.Mesh(
        new THREE.ConeGeometry(5, 34, 5),
        this.material,
      );
      hull.rotation.x = -Math.PI / 2;
      const wingShape = new THREE.Shape();
      wingShape.moveTo(0, -15);
      wingShape.lineTo(24, 9);
      wingShape.lineTo(11, 12);
      wingShape.lineTo(0, 4);
      wingShape.lineTo(-11, 12);
      wingShape.lineTo(-24, 9);
      wingShape.closePath();
      const wings = new THREE.Mesh(
        new THREE.ExtrudeGeometry(wingShape, {
          depth: 1.4,
          bevelEnabled: false,
        }),
        this.material,
      );
      wings.rotation.x = Math.PI / 2;
      this.root.add(hull, wings);
      for (const side of [-1, 1]) {
        const fin = new THREE.Mesh(
          new THREE.BoxGeometry(1, 9, 10),
          this.material,
        );
        fin.position.set(side * 7, 4, 10);
        fin.rotation.z = -side * 0.45;
        this.root.add(fin);
      }
      const glow = new THREE.Mesh(
        new THREE.BoxGeometry(20, 1.5, 4),
        new THREE.MeshBasicMaterial({ color: "#ed6477" }),
      );
      glow.position.z = 8;
      this.root.add(glow);
    }
    this.reset();
  }
  activate() {
    this.active = true;
    this.destroyed = false;
    this.health = this.maxHealth;
    this.root.visible = true;
    this.age = 0;
    const offset = new THREE.Vector3(
      ((this.index % 3) - 1) * 450,
      (this.index % 3) * 100,
      -1500 - (this.index % 3) * 600,
    ).applyQuaternion(this.player.orientation);
    this.position.copy(this.player.position).add(offset);
    this.position.y = Math.max(
      this.position.y,
      terrainHeight(this.position.x, this.position.z) + 400,
    );
    this.previousPosition.copy(this.position);
    this.root.position.copy(this.position);
    this.root.quaternion.copy(this.player.orientation);
    this.direction.copy(this.player.forward);
    this.velocity.copy(this.direction).multiplyScalar(220);
  }
  override takeDamage(amount: number) {
    if (this.active) super.takeDamage(amount);
  }
  override update(dt: number) {
    this.previousPosition.copy(this.position);
    if (!this.active || this.destroyed) {
      this.root.visible = false;
      return;
    }
    this.age += dt;
    const distance = this.position.distanceTo(this.player.position),
      cycle = (this.age + this.index * 2.6) % 17;
    const destination = new THREE.Vector3();
    const boss = this.definition.role === "boss";
    if (
      this.definition.role === "strike" &&
      this.strikeTarget &&
      !this.strikeTarget.destroyed
    ) {
      this.behavior = "STRIKE RUN";
      destination.copy(this.strikeTarget.position);
      destination.y += 600;
      if (this.position.distanceTo(destination) < 550) {
        destination.x += Math.sin(this.age * 0.4) * 1400;
        destination.z += Math.cos(this.age * 0.4) * 1400;
      }
    } else if (distance > 7500) {
      this.behavior = "PATROL";
      destination
        .copy(this.player.position)
        .add(
          new THREE.Vector3(
            Math.sin(this.age * 0.15) * 2000,
            250,
            Math.cos(this.age * 0.15) * 2000,
          ),
        );
    } else if (cycle > 11.5 && cycle < 15) {
      this.behavior = "BREAK";
      destination.copy(this.position).addScaledVector(this.direction, 1800);
      destination.x += Math.sin(this.age * 0.8 + this.index) * 1700;
      destination.y =
        this.player.altitude + Math.sin(this.age * 0.45) * (boss ? 600 : 300);
    } else {
      this.behavior = distance < 800 ? "REPOSITION" : "PURSUIT";
      destination
        .copy(this.player.position)
        .addScaledVector(this.player.forward, -500)
        .addScaledVector(this.player.velocity, 0.6);
      if (distance < 800) {
        destination.x += Math.cos(this.age * 0.6 + this.index) * 950;
        destination.z += Math.sin(this.age * 0.6 + this.index) * 950;
      }
      if (boss && this.bossPhase === 3)
        destination.y += Math.sin(this.age * 1.8) * 350;
    }
    destination.y = Math.max(
      destination.y,
      terrainHeight(this.position.x, this.position.z) + 350,
    );
    const direction = destination.sub(this.position).normalize();
    this.desired.setFromUnitVectors(new THREE.Vector3(0, 0, -1), direction);
    this.root.quaternion.rotateTowards(
      this.desired,
      dt * (0.38 + this.difficulty * 0.07 + (boss ? this.bossPhase * 0.12 : 0)),
    );
    this.direction.set(0, 0, -1).applyQuaternion(this.root.quaternion);
    const speed =
      (this.behavior === "BREAK" ? 290 : 225) +
      this.difficulty * 9 +
      (boss ? this.bossPhase * 25 : 0);
    this.velocity.copy(this.direction).multiplyScalar(speed);
    this.position.addScaledVector(this.velocity, dt);
    this.root.position.copy(this.position);
    this.flash = Math.max(0, this.flash - dt);
    this.material.emissive.setHex(
      this.flash > 0 ? 0xff9933 : boss && this.bossPhase === 3 ? 0x50131c : 0,
    );
  }
  override reset() {
    super.reset();
    this.active = false;
    this.destroyed = true;
    this.root.visible = false;
    this.age = 0;
    this.bossPhase = 1;
    this.behavior = "WAITING";
  }
}
