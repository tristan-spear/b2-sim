import * as THREE from "three";
import type { FlightModel } from "../physics/FlightModel";
import { disposeTree } from "../game/dispose";

/** Stylized, original placeholder. Replacement assets use +Y up, -Z forward. */
export class F35Aircraft {
  readonly root = new THREE.Group();
  readonly model = new THREE.Group();
  private readonly exhaust = new THREE.MeshBasicMaterial({
    color: "#83d5ff",
    transparent: true,
    opacity: 0.65,
  });
  constructor() {
    this.root.add(this.model);
    const body = new THREE.MeshStandardMaterial({
      color: "#79888e",
      metalness: 0.48,
      roughness: 0.48,
      flatShading: true,
    });
    const dark = new THREE.MeshStandardMaterial({
      color: "#14252e",
      metalness: 0.65,
      roughness: 0.3,
    });
    const hull = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 8), body);
    hull.scale.set(2.3, 1.25, 10.2);
    this.model.add(hull);
    const canopy = new THREE.Mesh(
      new THREE.SphereGeometry(1, 12, 8),
      new THREE.MeshStandardMaterial({
        color: "#ba9a5e",
        metalness: 0.8,
        roughness: 0.15,
      }),
    );
    canopy.position.set(0, 1.05, -3.9);
    canopy.scale.set(1.05, 0.9, 2.65);
    this.model.add(canopy);
    const panel = (points: number[][]) => {
      const shape = new THREE.Shape(
        points.map((p) => new THREE.Vector2(p[0], p[1])),
      );
      const geometry = new THREE.ExtrudeGeometry(shape, {
        depth: 0.22,
        bevelEnabled: false,
      });
      geometry.rotateX(Math.PI / 2);
      return new THREE.Mesh(geometry, body);
    };
    for (const side of [-1, 1]) {
      const wing = panel([
        [side * 1.6, -3],
        [side * 7.6, 2.5],
        [side * 6.7, 4.4],
        [side * 1.4, 3.7],
      ]);
      const tail = panel([
        [side * 1.5, 5],
        [side * 4.8, 7.7],
        [side * 4, 9],
        [side * 1.3, 8],
      ]);
      const fin = panel([
        [0, 0],
        [0, 4.3],
        [side * 3.1, 6],
        [side * 3.2, 2.5],
      ]);
      fin.position.set(side * 1.8, 0.5, 3.2);
      fin.rotation.z = side * 1.14;
      const intake = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.1, 3), dark);
      intake.position.set(side * 1.8, -0.1, -1.7);
      intake.rotation.y = side * -0.18;
      this.model.add(wing, tail, fin, intake);
    }
    const nozzle = new THREE.Mesh(
      new THREE.CylinderGeometry(1.15, 1.3, 2, 12, 1, true),
      dark,
    );
    nozzle.rotation.x = Math.PI / 2;
    nozzle.position.z = 8.2;
    const flame = new THREE.Mesh(
      new THREE.ConeGeometry(0.85, 3.2, 12),
      this.exhaust,
    );
    flame.rotation.x = Math.PI / 2;
    flame.position.z = 10.1;
    this.model.add(nozzle, flame);
    this.model.traverse((o) => {
      o.castShadow = true;
      o.receiveShadow = true;
    });
  }
  setModel(model: THREE.Object3D) {
    disposeTree(this.model);
    this.root.add(this.model);
    this.model.add(model);
  }
  update(flight: FlightModel, time: number) {
    this.root.position.copy(flight.position);
    this.root.quaternion.copy(flight.orientation);
    this.exhaust.opacity =
      0.2 + flight.throttle * 0.6 + Math.sin(time * 35) * 0.06;
  }
}
