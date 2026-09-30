import * as THREE from "three";
import { Damageable } from "../combat/Damageable";

export class EnemyAircraft extends Damageable {
  readonly root = new THREE.Group();
  readonly previousPosition = new THREE.Vector3();
  readonly radius = 23;
  private readonly material = new THREE.MeshStandardMaterial({
    color: "#6c7c7c",
    roughness: 0.6,
    metalness: 0.3,
  });
  private phase = 0;
  private respawnTime = 0;
  constructor(readonly index: number) {
    super(`BANDIT 0${index + 1}`, "aircraft", 100, 500);
    const body = new THREE.Mesh(
      new THREE.ConeGeometry(3.5, 25, 6),
      this.material,
    );
    body.rotation.x = -Math.PI / 2;
    const wing = new THREE.Mesh(new THREE.BoxGeometry(32, 1, 7), this.material);
    wing.position.z = 3;
    const tail = new THREE.Mesh(new THREE.BoxGeometry(12, 1, 4), this.material);
    tail.position.z = 10;
    const fin = new THREE.Mesh(new THREE.BoxGeometry(1, 6, 6), this.material);
    fin.position.set(0, 3, 9);
    this.root.add(body, wing, tail, fin);
    this.root.traverse((o) => {
      o.castShadow = true;
    });
    this.reset();
  }
  private patrol() {
    const radius = 1250 + this.index * 200;
    this.position.set(
      600 + Math.sin(this.phase) * radius,
      2350 + this.index * 160,
      -1100 + Math.cos(this.phase) * radius,
    );
  }
  update(dt: number) {
    this.previousPosition.copy(this.position);
    if (this.destroyed) {
      this.respawnTime += dt;
      this.root.visible = this.respawnTime < 0.18;
      if (this.respawnTime >= 14) this.reset();
      return;
    }
    this.phase += (dt * 135) / (1250 + this.index * 200);
    this.patrol();
    this.velocity
      .subVectors(this.position, this.previousPosition)
      .divideScalar(Math.max(dt, 1e-6));
    this.root.position.copy(this.position);
    this.root.rotation.y = Math.atan2(-this.velocity.x, -this.velocity.z);
    this.root.rotation.z = -0.2;
    this.flash = Math.max(0, this.flash - dt);
    this.material.emissive.setHex(this.flash > 0 ? 0xff9933 : 0);
  }
  setSelected(selected: boolean) {
    this.material.color.set(selected ? "#e6b777" : "#6c7c7c");
  }
  override reset() {
    super.reset();
    this.phase = this.index * 1.7;
    this.respawnTime = 0;
    this.patrol();
    this.previousPosition.copy(this.position);
    this.velocity.set(
      135 * Math.cos(this.phase),
      0,
      -135 * Math.sin(this.phase),
    );
    this.root.position.copy(this.position);
    this.root.visible = true;
    this.material.emissive.setHex(0);
    this.setSelected(false);
  }
}
