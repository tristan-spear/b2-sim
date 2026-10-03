import * as THREE from "three";
import type { FlightModel } from "../physics/FlightModel";
import { disposeTree } from "../game/dispose";

type Point = [number, number, number];
type Section = [z: number, width: number, height: number, centerY: number];

/** Smooth longitudinal sections with a welded radial seam for even lighting. */
function fuselage(sections: Section[]) {
  const profile = new THREE.CatmullRomCurve3(
    sections.map(([z, w, h]) => new THREE.Vector3(w, h, z)),
  );
  const centers = new THREE.CatmullRomCurve3(
    sections.map(([z, , , y]) => new THREE.Vector3(0, y, z)),
  );
  const vertices: number[] = [],
    indices: number[] = [];
  const rings = 96,
    sides = 64;
  for (let row = 0; row <= rings; row++) {
    const p = profile.getPoint(row / rings),
      center = centers.getPoint(row / rings);
    for (let i = 0; i < sides; i++) {
      const angle = (i / sides) * Math.PI * 2;
      vertices.push(
        Math.cos(angle) * p.x,
        center.y + Math.sin(angle) * p.y,
        p.z,
      );
    }
  }
  for (let row = 0; row < rings; row++) {
    for (let i = 0; i < sides; i++) {
      const a = row * sides + i,
        b = row * sides + ((i + 1) % sides);
      indices.push(a, b, a + sides, b, b + sides, a + sides);
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

/** Detailed procedural airframe. Replacement assets use +Y up, -Z forward. */
export class F35Aircraft {
  readonly root = new THREE.Group();
  readonly model = new THREE.Group();
  private readonly exhaust = new THREE.MeshBasicMaterial({
    color: "#8bbdff",
    transparent: true,
    opacity: 0.65,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    vertexColors: true,
  });
  private readonly plume = new THREE.Group();
  constructor() {
    this.root.add(this.model);
    this.model.name = "F-35 detailed airframe";
    const body = new THREE.MeshStandardMaterial({
      color: "#778087",
      metalness: 0.38,
      roughness: 0.57,
    });
    const edge = new THREE.MeshStandardMaterial({
      color: "#91999d",
      metalness: 0.32,
      roughness: 0.62,
    });
    const panel = new THREE.MeshStandardMaterial({
      color: "#606a71",
      metalness: 0.35,
      roughness: 0.64,
    });
    const dark = new THREE.MeshStandardMaterial({
      color: "#111820",
      metalness: 0.25,
      roughness: 0.72,
      side: THREE.DoubleSide,
    });
    const metal = new THREE.MeshStandardMaterial({
      color: "#4e5359",
      metalness: 0.85,
      roughness: 0.36,
      side: THREE.DoubleSide,
    });
    const seam = new THREE.LineBasicMaterial({
      color: "#39464e",
      transparent: true,
      opacity: 0.55,
    });
    const mesh = (
      geometry: THREE.BufferGeometry,
      material: THREE.Material,
      name: string,
      position: Point = [0, 0, 0],
    ) => {
      const part = new THREE.Mesh(geometry, material);
      part.name = name;
      part.position.set(...position);
      this.model.add(part);
      return part;
    };
    const line = (points: Point[], closed = false) => {
      const geometry = new THREE.BufferGeometry().setFromPoints(
        points.map((p) => new THREE.Vector3(...p)),
      );
      this.model.add(
        closed
          ? new THREE.LineLoop(geometry, seam)
          : new THREE.Line(geometry, seam),
      );
    };
    const plate = (
      points: [number, number][],
      thickness: number,
      material: THREE.Material,
      name: string,
    ) => {
      const geometry = new THREE.ExtrudeGeometry(
        new THREE.Shape(points.map((p) => new THREE.Vector2(...p))),
        {
          depth: thickness,
          bevelEnabled: true,
          bevelSegments: 3,
          steps: 1,
          bevelSize: 0.035,
          bevelThickness: 0.035,
        },
      );
      geometry.rotateX(Math.PI / 2);
      return mesh(geometry, material, name);
    };

    mesh(
      fuselage([
        [-10.3, 0.015, 0.015, -0.12],
        [-9.3, 0.45, 0.3, -0.06],
        [-7.5, 1.02, 0.64, 0],
        [-5.6, 1.45, 0.94, 0],
        [-3.2, 1.88, 1.13, -0.06],
        [-0.5, 2.13, 1.22, -0.08],
        [2.6, 1.94, 1.19, -0.02],
        [5.3, 1.5, 0.99, 0],
        [7.7, 1.12, 0.86, 0],
        [8.05, 1.05, 0.82, 0],
      ]),
      body,
      "Sculpted fuselage",
    );
    mesh(
      fuselage([
        [-10.32, 0.005, 0.005, -0.12],
        [-9.3, 0.46, 0.31, -0.06],
        [-7.5, 1.035, 0.655, 0],
      ]),
      panel,
      "Radar nose cone",
    );
    line(
      Array.from({ length: 64 }, (_, i): Point => {
        const a = (i / 64) * Math.PI * 2;
        return [Math.cos(a) * 1.042, Math.sin(a) * 0.662, -7.5];
      }),
      true,
    );

    const sill = mesh(
      new THREE.SphereGeometry(1, 48, 24),
      panel,
      "Canopy sill",
      [0, 0.99, -4.65],
    );
    sill.scale.set(1.04, 0.48, 2.7);
    const glass = mesh(
      new THREE.SphereGeometry(1, 64, 32),
      new THREE.MeshPhysicalMaterial({
        color: "#8d7854",
        metalness: 0.68,
        roughness: 0.16,
        clearcoat: 1,
        clearcoatRoughness: 0.08,
      }),
      "Tinted canopy",
      [0, 1.11, -4.75],
    );
    glass.scale.set(0.92, 0.83, 2.46);
    const bow = new THREE.CatmullRomCurve3(
      Array.from({ length: 25 }, (_, i) => {
        const a = (i / 24) * Math.PI;
        return new THREE.Vector3(
          Math.cos(a) * 0.87,
          1.18 + Math.sin(a) * 0.74,
          -3.85,
        );
      }),
    );
    mesh(
      new THREE.TubeGeometry(bow, 32, 0.045, 8, false),
      edge,
      "Canopy rear frame",
    );
    mesh(
      fuselage([
        [-2.8, 0.46, 0.23, 1],
        [-1.1, 0.66, 0.3, 1.07],
        [2.8, 0.58, 0.24, 1.06],
        [6.3, 0.06, 0.03, 0.86],
      ]),
      body,
      "Dorsal fairing",
    );

    for (const side of [-1, 1]) {
      const wing = plate(
        [
          [side * 1.45, -3.45],
          [side * 6.65, 0.8],
          [side * 6.5, 2.8],
          [side * 2.0, 3.15],
          [side * 1.4, 1.5],
        ],
        0.16,
        body,
        "Swept main wing",
      );
      wing.position.y = 0.08;
      mesh(
        fuselage([
          [-4.8, 0.03, 0.03, 0],
          [-2.8, 0.65, 0.37, 0.05],
          [0, 1.0, 0.43, 0.02],
          [2.8, 0.6, 0.25, 0],
          [4.2, 0.02, 0.02, 0],
        ]),
        body,
        "Blended wing shoulder",
        [side * 1.65, 0, 0],
      );
      const strip = plate(
        [
          [side * 2.15, -2.87],
          [side * 6.65, 0.8],
          [side * 6.63, 1.02],
          [side * 2.15, -2.6],
        ],
        0.025,
        edge,
        "Wing leading-edge coating",
      );
      strip.position.y = 0.13;
      line([
        [side * 2.65, 0.125, 2.05],
        [side * 6.44, 0.125, 1.85],
        [side * 6.4, 0.125, 2.7],
      ]);
      line([
        [side * 4.45, 0.13, 1.95],
        [side * 4.45, 0.13, 2.91],
      ]);
      line([
        [side * 3.0, 0.13, -1.83],
        [side * 3.12, 0.13, 1.95],
      ]);
      const tail = plate(
        [
          [side * 1.25, 4.45],
          [side * 4.35, 6.15],
          [side * 4.08, 8.05],
          [side * 1.15, 7.38],
        ],
        0.13,
        body,
        "Horizontal stabilizer",
      );
      tail.position.y = -0.06;
      line([
        [side * 1.85, -0.01, 6.65],
        [side * 4.13, -0.01, 7.2],
      ]);

      // Explicit Y/Z profile keeps fin sweep independent of outward cant.
      const finShape = new THREE.Shape([
        new THREE.Vector2(3.65, 0),
        new THREE.Vector2(5.15, 3.5),
        new THREE.Vector2(6.65, 3.68),
        new THREE.Vector2(7.35, 0),
      ]);
      const finGeometry = new THREE.ExtrudeGeometry(finShape, {
        depth: 0.1,
        bevelEnabled: true,
        bevelSize: 0.025,
        bevelThickness: 0.025,
        bevelSegments: 2,
      });
      finGeometry.applyMatrix4(
        new THREE.Matrix4().set(
          0,
          side * 0.46,
          side,
          side * 1.42,
          0,
          1,
          0,
          0.48,
          1,
          0,
          0,
          0,
          0,
          0,
          0,
          1,
        ),
      );
      const finMaterial = body.clone();
      finMaterial.side = THREE.DoubleSide;
      mesh(finGeometry, finMaterial, "Canted vertical stabilizer");
      line([
        [side * 1.77, 1.02, 6.72],
        [side * 2.95, 3.55, 6.32],
        [side * 3.1, 3.87, 6.48],
      ]);

      // Hollow lips and dark recessed ducts replace solid intake blocks.
      const ductShape = new THREE.Shape([
        new THREE.Vector2(-0.44, -0.56),
        new THREE.Vector2(0.48, -0.39),
        new THREE.Vector2(0.57, 0.35),
        new THREE.Vector2(-0.32, 0.55),
      ]);
      ductShape.holes.push(
        new THREE.Path([
          new THREE.Vector2(-0.29, -0.4),
          new THREE.Vector2(-0.2, 0.39),
          new THREE.Vector2(0.41, 0.24),
          new THREE.Vector2(0.34, -0.27),
        ]),
      );
      const intake = mesh(
        new THREE.ExtrudeGeometry(ductShape, {
          depth: 1.05,
          bevelEnabled: true,
          bevelSize: 0.04,
          bevelThickness: 0.04,
          bevelSegments: 3,
        }),
        edge,
        "Intake lip and duct",
        [side * 1.82, -0.22, -4.0],
      );
      intake.scale.x = side;
      intake.rotation.y = side * -0.12;
      mesh(new THREE.PlaneGeometry(0.84, 0.98), dark, "Intake interior", [
        side * 1.82,
        -0.22,
        -3.8,
      ]);
      mesh(
        fuselage([
          [-3.7, 0.49, 0.53, -0.22],
          [-1.8, 0.57, 0.61, -0.25],
          [1.8, 0.37, 0.4, -0.24],
          [4.2, 0.02, 0.02, -0.14],
        ]),
        body,
        "Intake fairing",
        [side * 1.79, 0, 0],
      );

      line(
        [
          [side * 0.35, -1.2, -2.5],
          [side * 0.65, -1.2, -2.2],
          [side * 0.92, -1.16, -2.5],
          [side * 1.1, -1.1, 2.7],
          [side * 0.75, -1.16, 2.4],
          [side * 0.4, -1.2, 2.7],
        ],
        true,
      );
      line([
        [side * 0.48, 1.39, -0.4],
        [side * 0.46, 1.38, 1.6],
        [side * 0.26, 1.4, 1.9],
        [side * 0.12, 1.4, 1.7],
      ]);
      for (let i = 0; i < 5; i++) {
        const vent = mesh(
          new THREE.BoxGeometry(0.28, 0.02, 0.055),
          dark,
          "Cooling vent",
          [side * 0.94, 1.085, 2.35 + i * 0.14],
        );
        vent.rotation.z = side * -0.35;
      }
      const light = mesh(
        new THREE.SphereGeometry(0.06, 12, 8),
        new THREE.MeshBasicMaterial({
          color: side < 0 ? "#ff5045" : "#75ffc2",
        }),
        "Wingtip navigation light",
        [side * 6.59, 0.05, 1.45],
      );
      light.scale.z = 2.2;
    }

    const sensor = mesh(
      new THREE.SphereGeometry(1, 8, 4),
      metal,
      "Chin sensor housing",
      [0, -0.64, -6.75],
    );
    sensor.scale.set(0.35, 0.3, 0.6);
    const nozzle = mesh(
      new THREE.CylinderGeometry(0.88, 1.12, 1.48, 64, 1, true),
      metal,
      "Exhaust nozzle",
      [0, 0, 8.2],
    );
    nozzle.rotation.x = Math.PI / 2;
    const interior = mesh(
      new THREE.CylinderGeometry(0.77, 0.85, 1.2, 48, 1, true),
      dark,
      "Exhaust interior",
      [0, 0, 8.2],
    );
    interior.rotation.x = Math.PI / 2;
    mesh(
      new THREE.TorusGeometry(0.87, 0.045, 10, 64),
      metal,
      "Nozzle rim",
      [0, 0, 8.95],
    );
    for (let i = 0; i < 20; i++) {
      const angle = (i / 20) * Math.PI * 2,
        vertices: number[] = [];
      for (const [z, radius] of [
        [7.52, 1.13],
        [8.87, 0.9],
      ] as const) {
        for (const offset of [-0.135, 0.135]) {
          vertices.push(
            Math.cos(angle + offset) * radius,
            Math.sin(angle + offset) * radius,
            z,
          );
        }
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(vertices, 3),
      );
      geometry.setIndex([0, 1, 2, 1, 3, 2]);
      geometry.computeVertexNormals();
      mesh(geometry, metal, "Nozzle petal");
    }
    const glowGeometry = new THREE.CircleGeometry(0.76, 48);
    const glowColors: number[] = [];
    for (let i = 0; i < glowGeometry.attributes.position.count; i++) {
      glowColors.push(1, 1, 1, i === 0 ? 1 : 0.15);
    }
    glowGeometry.setAttribute(
      "color",
      new THREE.Float32BufferAttribute(glowColors, 4),
    );
    mesh(glowGeometry, this.exhaust, "Engine glow", [0, 0, 8.5]);
    const flameGeometry = new THREE.ConeGeometry(0.7, 3.4, 48, 16, true);
    const flameColors: number[] = [];
    for (let i = 0; i < flameGeometry.attributes.position.count; i++) {
      const t = (flameGeometry.attributes.position.getY(i) + 1.7) / 3.4;
      flameColors.push(0.65, 0.8, 1, 0.55 * Math.pow(1 - t, 2));
    }
    flameGeometry.setAttribute(
      "color",
      new THREE.Float32BufferAttribute(flameColors, 4),
    );
    const flame = new THREE.Mesh(flameGeometry, this.exhaust);
    flame.rotation.x = Math.PI / 2;
    flame.position.z = 1.7;
    this.plume.position.z = 8.95;
    this.plume.add(flame);
    this.model.add(this.plume);
    this.model.traverse((o) => {
      if (o instanceof THREE.Mesh && o.material !== this.exhaust) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
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
      0.18 + flight.throttle * 0.5 + Math.sin(time * 35) * 0.035;
    this.plume.scale.z = 0.45 + flight.throttle * 0.75;
  }
}
