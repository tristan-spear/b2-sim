import * as THREE from "three";
import type { FlightModel } from "../physics/FlightModel";
import type { EnemyAircraft } from "../enemies/EnemyAircraft";
export class Missile {
  readonly kind = "missile";
  readonly root = new THREE.Group();
  readonly position = new THREE.Vector3();
  readonly previous = new THREE.Vector3();
  readonly direction = new THREE.Vector3();
  readonly speed = 650;
  readonly lifetime = 14;
  readonly turnRate = 2.1;
  readonly damage = 110;
  age = 0;
  trailTime = 0;
  private readonly orientation = new THREE.Quaternion();
  private readonly desired = new THREE.Quaternion();
  constructor(
    flight: FlightModel,
    readonly target: EnemyAircraft | null,
  ) {
    this.position
      .set(9, -3, -10)
      .applyQuaternion(flight.orientation)
      .add(flight.position);
    this.previous.copy(this.position);
    this.orientation.copy(flight.orientation);
    this.direction.copy(flight.forward);
    const material = new THREE.MeshStandardMaterial({
      color: "#ddd9c4",
      metalness: 0.3,
    });
    const body = new THREE.Mesh(new THREE.ConeGeometry(0.9, 7, 6), material);
    body.rotation.x = -Math.PI / 2;
    const fin = new THREE.Mesh(new THREE.BoxGeometry(4, 0.2, 2), material);
    fin.position.z = 2;
    this.root.add(body, fin);
    this.root.position.copy(this.position);
    this.root.quaternion.copy(this.orientation);
  }
  update(dt: number) {
    this.age += dt;
    this.previous.copy(this.position);
    if (this.target && !this.target.destroyed) {
      const leadTime = Math.min(
        1.2,
        this.position.distanceTo(this.target.position) / this.speed,
      );
      const desired = this.target.position
        .clone()
        .addScaledVector(this.target.velocity, leadTime)
        .sub(this.position)
        .normalize();
      this.desired.setFromUnitVectors(new THREE.Vector3(0, 0, -1), desired);
      this.orientation.rotateTowards(this.desired, this.turnRate * dt);
    }
    this.direction.set(0, 0, -1).applyQuaternion(this.orientation);
    this.position.addScaledVector(this.direction, this.speed * dt);
    this.root.position.copy(this.position);
    this.root.quaternion.copy(this.orientation);
  }
}
