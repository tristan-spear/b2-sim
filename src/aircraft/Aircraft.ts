import * as THREE from "three";
import type { FlightModel } from "../physics/FlightModel";

const outline: [number, number][] = [
  [0, -11],
  [26, 9],
  [17, 7.5],
  [13, 10],
  [9, 6.9],
  [5, 10],
  [0, 7.4],
  [-5, 10],
  [-9, 6.9],
  [-13, 10],
  [-17, 7.5],
  [-26, 9],
];

// Cross-sections create a tapered fairing that blends into the flying wing.
function fairing(sections: [number, number, number][]) {
  const vertices: number[] = [];
  const indices: number[] = [];
  const segments = 8;
  for (const [z, width, height] of sections) {
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI;
      vertices.push(
        Math.cos(angle) * width,
        0.35 + Math.sin(angle) * height,
        z,
      );
    }
  }
  for (let row = 0; row < sections.length - 1; row++) {
    for (let i = 0; i < segments; i++) {
      const a = row * (segments + 1) + i,
        b = a + segments + 1;
      indices.push(a, a + 1, b, a + 1, b + 1, b);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(vertices, 3),
  );
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

export class Aircraft {
  readonly root = new THREE.Group();
  readonly model = new THREE.Group();
  private readonly exhaust: THREE.Mesh[] = [];
  private readonly elevons: THREE.Group[] = [];
  constructor() {
    this.root.add(this.model);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: "#444b4c",
      roughness: 0.62,
      metalness: 0.25,
    });
    const edgeMat = new THREE.MeshStandardMaterial({
      color: "#252d30",
      roughness: 0.8,
      metalness: 0.35,
    });
    // Radial triangulation produces a broad wing with a raised blended centerbody.
    const vertices: number[] = [];
    const center = new THREE.Vector3(0, 1.8, 1.5);
    for (let i = 0; i < outline.length; i++) {
      const a = outline[i],
        b = outline[(i + 1) % outline.length];
      vertices.push(center.x, center.y, center.z, b[0], 0, b[1], a[0], 0, a[1]);
      vertices.push(0, -0.8, 1.5, a[0], -0.12, a[1], b[0], -0.12, b[1]);
      vertices.push(
        a[0],
        0,
        a[1],
        a[0],
        -0.12,
        a[1],
        b[0],
        0,
        b[1],
        b[0],
        0,
        b[1],
        a[0],
        -0.12,
        a[1],
        b[0],
        -0.12,
        b[1],
      );
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(vertices, 3),
    );
    geometry.computeVertexNormals();
    const wing = new THREE.Mesh(geometry, bodyMat);
    wing.material.side = THREE.DoubleSide;
    wing.castShadow = wing.receiveShadow = true;
    this.model.add(wing);
    const hull = new THREE.Mesh(
      fairing([
        [-10.8, 0, 0],
        [-7.2, 1.35, 0.9],
        [-4.5, 2.1, 2.2],
        [-1, 2.8, 2.15],
        [3.5, 2.4, 1.6],
        [7.4, 0.4, 0.12],
      ]),
      bodyMat,
    );
    hull.castShadow = true;
    this.model.add(hull);
    const cockpit = new THREE.Mesh(
      fairing([
        [-7.05, 0.15, 0.1],
        [-5.5, 1.2, 0.5],
        [-4.45, 1.32, 0.25],
      ]),
      new THREE.MeshStandardMaterial({
        color: "#1d333b",
        metalness: 0.85,
        roughness: 0.16,
      }),
    );
    cockpit.position.set(0, 1.55, 0);
    this.model.add(cockpit);
    const frame = new THREE.Mesh(
      new THREE.BoxGeometry(0.13, 0.08, 3.6),
      bodyMat,
    );
    frame.position.set(0, 2.3, -5.6);
    frame.scale.z = 0.55;
    this.model.add(frame);
    for (const side of [-1, 1]) {
      const nacelle = new THREE.Mesh(
        fairing([
          [-3.8, 0.3, 0.1],
          [-2.2, 1.75, 0.9],
          [1, 1.9, 1.05],
          [6.5, 1.55, 0.15],
        ]),
        bodyMat,
      );
      nacelle.position.set(side * 4.1, 0.45, 0);
      this.model.add(nacelle);
      const intake = new THREE.Mesh(
        new THREE.BoxGeometry(2.7, 0.46, 1.1),
        edgeMat,
      );
      intake.position.set(side * 4.1, 1.4, -2.85);
      intake.rotation.x = -0.18;
      this.model.add(intake);
      const nozzle = new THREE.Mesh(
        new THREE.BoxGeometry(3.15, 0.24, 1.8),
        edgeMat,
      );
      nozzle.position.set(side * 4.1, 0.72, 6.2);
      this.model.add(nozzle);
      const glow = new THREE.Mesh(
        new THREE.PlaneGeometry(2.65, 0.15),
        new THREE.MeshBasicMaterial({
          color: "#b2896e",
          transparent: true,
          opacity: 0.42,
          side: THREE.DoubleSide,
        }),
      );
      glow.position.set(side * 4.1, 0.73, 7.12);
      this.model.add(glow);
      this.exhaust.push(glow);
      const elevon = new THREE.Group();
      elevon.position.set(side * 13.3, 0.03, 7.3);
      const panel = new THREE.Mesh(
        new THREE.BoxGeometry(4.5, 0.085, 1.05),
        bodyMat,
      );
      panel.rotation.y = side * -0.46;
      panel.castShadow = true;
      elevon.add(panel);
      this.model.add(elevon);
      this.elevons.push(elevon);
      const lines = [
        [side * 2, 1.1, -6.8, side * 21, 0.13, 7.2],
        [side * 6, 0.95, 0, side * 16, 0.23, 7.4],
        [side * 8, 0.42, 5.4, side * 11, 0.18, 8.2],
      ];
      const lineGeom = new THREE.BufferGeometry();
      lineGeom.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(lines.flat(), 3),
      );
      this.model.add(
        new THREE.LineSegments(
          lineGeom,
          new THREE.LineBasicMaterial({
            color: "#788182",
            transparent: true,
            opacity: 0.38,
          }),
        ),
      );
    }
    const marking = document.createElement("canvas");
    marking.width = 256;
    marking.height = 128;
    const ctx = marking.getContext("2d")!;
    ctx.fillStyle = "#a0a6a2";
    ctx.font = "24px monospace";
    ctx.textAlign = "center";
    ctx.fillText("SPIRIT", 128, 56);
    ctx.font = "14px monospace";
    ctx.fillText("AV · 001", 128, 82);
    const decal = new THREE.Mesh(
      new THREE.PlaneGeometry(4, 2),
      new THREE.MeshBasicMaterial({
        map: new THREE.CanvasTexture(marking),
        transparent: true,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
      }),
    );
    decal.rotation.x = -Math.PI / 2;
    decal.position.set(-10, 0.83, 3.4);
    this.model.add(decal);
  }
  /** Replace generated geometry with a GLTF scene; normalize to 52 m span, +Y up, -Z forward. */
  setModel(model: THREE.Object3D) {
    this.model.clear();
    this.exhaust.length = 0;
    this.elevons.length = 0;
    this.model.add(model);
  }
  update(flight: FlightModel, time: number) {
    this.root.position.copy(flight.position);
    this.root.quaternion.copy(flight.orientation);
    const vibration = Math.max(0, flight.speed - 230) / 100;
    this.model.position.y = Math.sin(time * 39) * 0.018 * vibration;
    this.exhaust.forEach((glow) => {
      (glow.material as THREE.MeshBasicMaterial).opacity =
        0.15 + flight.throttle * 0.3 + Math.sin(time * 21) * 0.025;
    });
    this.elevons.forEach((panel, i) => {
      panel.rotation.x = flight.pitch * 0.2 + flight.roll * (i ? -0.12 : 0.12);
    });
  }
}
