import * as THREE from "three";
export type ExplosionKind = "missile" | "aircraft" | "bomb" | "large";
interface Particle {
  mesh: THREE.Mesh<THREE.IcosahedronGeometry, THREE.MeshBasicMaterial>;
  velocity: THREE.Vector3;
  age: number;
  life: number;
  size: number;
  smoke: boolean;
  debris: boolean;
}
interface Flash {
  light: THREE.PointLight;
  age: number;
  power: number;
}
// Bounded shared geometry keeps sustained combat and persistent smoke affordable.
export class ExplosionSystem {
  readonly root = new THREE.Group();
  private readonly geometry = new THREE.IcosahedronGeometry(1, 0);
  private readonly particles: Particle[] = [];
  private readonly lights: Flash[] = [];
  shake = 0;
  spawn(position: THREE.Vector3, kind: ExplosionKind, viewer: THREE.Vector3) {
    const size = { missile: 12, aircraft: 26, bomb: 48, large: 70 }[kind];
    for (let i = 0; i < 24; i++) {
      const smoke = i > 8;
      this.particle(
        position,
        new THREE.Vector3(
          Math.random() - 0.5,
          Math.random() * 0.8,
          Math.random() - 0.5,
        ).multiplyScalar(size * (smoke ? 0.7 : 2.4)),
        smoke ? "#424743" : i % 2 ? "#ffb847" : "#fff1b0",
        smoke ? 4 : 0.8,
        size * (smoke ? 0.16 : 0.09),
        smoke,
      );
    }
    if (kind === "aircraft" || kind === "large") {
      for (let i = 0; i < 5; i++) {
        this.particle(
          position,
          new THREE.Vector3(
            Math.random() - 0.5,
            Math.random(),
            Math.random() - 0.5,
          ).multiplyScalar(size * 2),
          "#62675e",
          3.5,
          size * 0.07,
          false,
          true,
        );
      }
    }
    if (this.lights.length >= 4) this.root.remove(this.lights.shift()!.light);
    const light = new THREE.PointLight(0xffa74c, size * size * 35, size * 9, 2);
    light.position.copy(position).y += 12;
    this.lights.push({ light, age: 0, power: light.intensity });
    this.root.add(light);
    this.shake = Math.max(
      this.shake,
      Math.max(0, 1 - position.distanceTo(viewer) / 1700) * size * 0.025,
    );
  }
  private particle(
    position: THREE.Vector3,
    velocity: THREE.Vector3,
    color: string,
    life: number,
    size: number,
    smoke: boolean,
    debris = false,
  ) {
    if (this.particles.length >= 360) this.remove(0);
    const mesh = new THREE.Mesh(
      this.geometry,
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: smoke ? 0.5 : 1,
        depthWrite: false,
      }),
    );
    mesh.position.copy(position);
    mesh.scale.setScalar(size);
    this.root.add(mesh);
    this.particles.push({ mesh, velocity, age: 0, life, size, smoke, debris });
  }
  trail(position: THREE.Vector3) {
    this.particle(
      position,
      new THREE.Vector3(0, 2, 0),
      "#dad8c8",
      1.7,
      2,
      true,
    );
  }
  smoke(position: THREE.Vector3) {
    this.particle(
      position,
      new THREE.Vector3(5, 26, 0),
      "#393e3a",
      8,
      14,
      true,
    );
  }
  private remove(index: number) {
    const [p] = this.particles.splice(index, 1);
    this.root.remove(p.mesh);
    p.mesh.material.dispose();
  }
  update(dt: number) {
    this.shake *= Math.exp(-dt * 5);
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.age += dt;
      if (p.age >= p.life) {
        this.remove(i);
        continue;
      }
      if (!p.smoke) p.velocity.y -= 35 * dt;
      p.mesh.position.addScaledVector(p.velocity, dt);
      p.mesh.rotation.x += dt * (p.debris ? 5 : 1);
      p.mesh.scale.setScalar(
        p.size * (1 + p.age * (p.debris ? 0 : p.smoke ? 0.6 : 3)),
      );
      p.mesh.material.opacity = (p.smoke ? 0.5 : 1) * (1 - p.age / p.life);
    }
    for (let i = this.lights.length - 1; i >= 0; i--) {
      const f = this.lights[i];
      f.age += dt;
      f.light.intensity = f.power * Math.max(0, 1 - f.age / 0.4);
      if (f.age >= 0.4) {
        this.root.remove(f.light);
        this.lights.splice(i, 1);
      }
    }
  }
  reset() {
    while (this.particles.length) this.remove(0);
    this.lights.forEach((f) => this.root.remove(f.light));
    this.lights.length = 0;
    this.shake = 0;
  }
  get count() {
    return this.particles.length;
  }
}
