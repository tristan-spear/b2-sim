import * as THREE from "three";
import type { FlightModel } from "../physics/FlightModel";
export class Bomb {
  readonly kind = "bomb";
  readonly root = new THREE.Group();
  readonly position = new THREE.Vector3();
  readonly previous = new THREE.Vector3();
  readonly velocity = new THREE.Vector3();
  age = 0;
  readonly lifetime = 60;
  constructor(flight: FlightModel) {
    this.position
      .set(0, -6, 0)
      .applyQuaternion(flight.orientation)
      .add(flight.position);
    this.previous.copy(this.position);
    this.velocity.copy(flight.velocity);
    const material = new THREE.MeshStandardMaterial({
      color: "#333e36",
      roughness: 0.6,
    });
    const body = new THREE.Mesh(
      new THREE.CapsuleGeometry(1.4, 5, 2, 6),
      material,
    );
    body.rotation.x = Math.PI / 2;
    const fins = new THREE.Mesh(new THREE.BoxGeometry(5, 0.3, 2), material);
    fins.position.z = 3;
    this.root.add(body, fins);
    this.root.position.copy(this.position);
  }
  update(dt: number) {
    this.age += dt;
    this.previous.copy(this.position);
    this.position.addScaledVector(this.velocity, dt);
    this.position.y -= 0.5 * 9.81 * dt * dt;
    this.velocity.y -= 9.81 * dt;
    this.root.position.copy(this.position);
    this.root.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 0, -1),
      this.velocity.clone().normalize(),
    );
  }
}
