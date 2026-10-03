import * as THREE from "three";

export type ExplosionKind = "missile" | "aircraft" | "bomb" | "large";
type Layer =
  "flash" | "fire" | "smoke" | "spark" | "debris" | "trail" | "plume";
interface Particle {
  mesh: THREE.Mesh<THREE.IcosahedronGeometry, THREE.MeshBasicMaterial>;
  velocity: THREE.Vector3;
  age: number;
  life: number;
  size: number;
  layer: Layer;
}
interface Flash {
  light: THREE.PointLight;
  age: number;
  power: number;
}
const sizes: Record<ExplosionKind, number> = {
  missile: 12 * 1.7,
  aircraft: 26 * 1.7,
  bomb: 48 * 1.7,
  large: 70 * 1.7,
};
const hot = new THREE.Color("#fff3c4").multiplyScalar(2.2);
const flame = new THREE.Color("#ffb347").multiplyScalar(1.5);
const ember = new THREE.Color("#ad3f16");
const soot = new THREE.Color("#424743");
const up = new THREE.Vector3(0, 1, 0);
const maxParticles = 360;

// Shared faceted geometry and recycled meshes/materials keep the original hard
// particle budget, including trails and persistent smoke. No shadow-casting lights.
export class ExplosionSystem {
  readonly root = new THREE.Group();
  private readonly geometry = new THREE.IcosahedronGeometry(1, 0);
  private readonly billowGeometry = new THREE.IcosahedronGeometry(1, 1);
  private readonly particles: Particle[] = [];
  private readonly pool: Particle[] = [];
  private readonly lights: Flash[] = [];
  private readonly lightPool: THREE.PointLight[] = [];
  private readonly sparkDirection = new THREE.Vector3();
  shake = 0;

  constructor() {
    // Subtle baked face shading adds volume without a lighting pass per puff.
    const normals = this.billowGeometry.getAttribute("normal");
    const colors = new Float32Array(normals.count * 3);
    for (let i = 0; i < normals.count; i += 3) {
      const shade = 0.78 + 0.18 * Math.max(0, normals.getY(i));
      colors.fill(shade, i * 3, (i + 3) * 3);
    }
    this.billowGeometry.setAttribute(
      "color",
      new THREE.BufferAttribute(colors, 3),
    );
  }

  spawn(position: THREE.Vector3, kind: ExplosionKind, viewer: THREE.Vector3) {
    const size = sizes[kind];
    const direction = () => {
      const angle = Math.random() * Math.PI * 2;
      const y = Math.random() * 1.35 - 0.35;
      const radial = Math.sqrt(1 - y * y);
      return new THREE.Vector3(
        Math.cos(angle) * radial,
        y,
        Math.sin(angle) * radial,
      );
    };
    this.particle(
      position,
      new THREE.Vector3(),
      "#fff5d7",
      0.18,
      size * 0.28,
      "flash",
    );
    // Overlapping lobes expand, rise and cool independently instead of reading
    // as one uniformly scaled sphere. The hot center burns out first.
    this.particle(
      position,
      new THREE.Vector3(0, size * 0.16, 0),
      "#fff1b0",
      0.65,
      size * 0.27,
      "fire",
    );
    for (let i = 0; i < 10; i++) {
      this.particle(
        position,
        direction().multiplyScalar(size * (0.65 + Math.random() * 0.4)),
        "#ffb847",
        0.75 + Math.random() * 0.4,
        size * (0.12 + Math.random() * 0.07),
        "fire",
      );
    }
    for (let i = 0; i < 18; i++) {
      const velocity = direction().multiplyScalar(
        size * (0.18 + Math.random() * 0.3),
      );
      velocity.y = Math.abs(velocity.y) + size * 0.08;
      this.particle(
        position,
        velocity,
        i % 3 === 0 ? "#66675e" : "#363b38",
        6 + Math.random() * 3,
        size * (0.12 + Math.random() * 0.09),
        "smoke",
      );
    }
    for (let i = 0; i < 24; i++) {
      this.particle(
        position,
        direction().multiplyScalar(size * (1.1 + Math.random() * 1.4)),
        i % 3 ? "#ffb847" : "#fff1b0",
        0.4 + Math.random() * 0.8,
        size * (0.007 + Math.random() * 0.007),
        "spark",
      );
    }
    for (
      let i = 0;
      i < (kind === "large" ? 10 : kind === "aircraft" ? 8 : 6);
      i++
    ) {
      const velocity = direction().multiplyScalar(
        size * (0.6 + Math.random() * 0.65),
      );
      velocity.y = Math.abs(velocity.y) + size * 0.3;
      this.particle(
        position,
        velocity,
        i % 2 ? "#62675e" : "#383c38",
        1.8 + Math.random() * 1.6,
        size * (0.018 + Math.random() * 0.025),
        "debris",
      );
    }
    if (this.lights.length >= 4) this.removeLight(0);
    const light =
      this.lightPool.pop() ?? new THREE.PointLight(0xffc078, 0, 0, 2);
    light.color.setHex(0xffc078);
    light.intensity = size * size * 30;
    light.distance = size * 7;
    light.position.copy(position).y += Math.max(12, size * 0.2);
    this.lights.push({ light, age: 0, power: light.intensity });
    this.root.add(light);
    const proximity = Math.max(0, 1 - position.distanceTo(viewer) / 1700);
    this.shake = Math.max(this.shake, Math.min(2.6, proximity * size * 0.024));
  }

  private particle(
    position: THREE.Vector3,
    velocity: THREE.Vector3,
    color: string,
    life: number,
    size: number,
    layer: Layer,
  ) {
    if (this.particles.length >= maxParticles) {
      // Prefer retiring old smoke over interrupting a fresh impact or fireball.
      const smoke = this.particles.findIndex(
        (p) =>
          p.layer === "smoke" || p.layer === "plume" || p.layer === "trail",
      );
      this.remove(smoke < 0 ? 0 : smoke);
    }
    const p = this.pool.pop() ?? {
      mesh: new THREE.Mesh(
        this.geometry,
        new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false }),
      ),
      velocity: new THREE.Vector3(),
      age: 0,
      life: 0,
      size: 0,
      layer,
    };
    const billow = layer === "fire" || layer === "smoke";
    p.mesh.geometry = billow ? this.billowGeometry : this.geometry;
    const material = p.mesh.material;
    if (material.vertexColors !== billow) {
      material.vertexColors = billow;
      material.needsUpdate = true;
    }
    material.blending =
      layer === "flash" || layer === "spark"
        ? THREE.AdditiveBlending
        : THREE.NormalBlending;
    material.color.set(color);
    if (layer === "flash" || layer === "spark")
      material.color.multiplyScalar(2.2);
    if (layer === "fire") material.color.copy(hot);
    material.opacity =
      layer === "smoke" ? 0 : layer === "trail" || layer === "plume" ? 0.5 : 1;
    p.mesh.position.copy(position);
    const legacySmoke = layer === "trail" || layer === "plume";
    p.mesh.rotation.set(
      legacySmoke ? 0 : Math.random() * Math.PI,
      legacySmoke ? 0 : Math.random() * Math.PI,
      0,
    );
    p.mesh.scale.setScalar(size);
    p.velocity.copy(velocity);
    p.age = 0;
    p.life = life;
    p.size = size;
    p.layer = layer;
    this.root.add(p.mesh);
    this.particles.push(p);
  }

  trail(position: THREE.Vector3) {
    this.particle(
      position,
      new THREE.Vector3(0, 2, 0),
      "#dad8c8",
      1.7,
      2,
      "trail",
    );
  }
  sparks(position: THREE.Vector3) {
    for (let i = 0; i < 5; i++)
      this.particle(
        position,
        new THREE.Vector3(
          (Math.random() - 0.5) * 60,
          Math.random() * 45,
          (Math.random() - 0.5) * 60,
        ),
        "#ffc86b",
        0.35,
        1.3,
        "spark",
      );
  }
  smoke(position: THREE.Vector3) {
    this.particle(
      position,
      new THREE.Vector3(5, 26, 0),
      "#393e3a",
      8,
      14,
      "plume",
    );
  }
  private remove(index: number) {
    const [p] = this.particles.splice(index, 1);
    this.root.remove(p.mesh);
    this.pool.push(p);
  }
  private removeLight(index: number) {
    const [f] = this.lights.splice(index, 1);
    this.root.remove(f.light);
    f.light.intensity = 0;
    this.lightPool.push(f.light);
  }

  update(dt: number) {
    this.shake *= Math.exp(-dt * 5.5);
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.age += dt;
      if (p.age >= p.life) {
        this.remove(i);
        continue;
      }
      const t = p.age / p.life;
      const material = p.mesh.material;
      let scale = 1;
      switch (p.layer) {
        case "flash":
          scale = 1 + 2 * t;
          material.opacity = (1 - t) ** 2;
          break;
        case "fire":
          p.velocity.multiplyScalar(Math.exp(-dt * 1.1));
          p.velocity.y += p.size * dt * 0.45;
          scale = 1 + 1.65 * (1 - Math.exp(-p.age * 7));
          material.color
            .copy(t < 0.32 ? hot : flame)
            .lerp(
              t < 0.32 ? flame : ember,
              t < 0.32 ? t / 0.32 : (t - 0.32) / 0.68,
            );
          material.opacity = 1 - THREE.MathUtils.smoothstep(t, 0.35, 1);
          break;
        case "smoke":
          p.velocity.multiplyScalar(Math.exp(-dt * 0.65));
          p.velocity.y += p.size * dt * 0.32;
          p.velocity.x += p.size * dt * 0.025;
          scale = 1 + 1.6 * (1 - Math.exp(-p.age * 0.55));
          material.color.lerp(soot, 1 - Math.exp(-dt * 0.7));
          material.opacity =
            0.78 *
            THREE.MathUtils.smoothstep(p.age, 0.08, 0.65) *
            (1 - THREE.MathUtils.smoothstep(t, 0.45, 1));
          break;
        case "spark":
          p.velocity.multiplyScalar(Math.exp(-dt * 0.65));
          p.velocity.y -= 35 * dt;
          material.color.lerp(flame, 1 - Math.exp(-dt * 3));
          material.opacity = (1 - t) ** 0.7;
          p.mesh.quaternion.setFromUnitVectors(
            up,
            this.sparkDirection.copy(p.velocity).normalize(),
          );
          p.mesh.scale.set(p.size, p.size * (2 + 4 * (1 - t)), p.size);
          break;
        case "debris":
          p.velocity.y -= 35 * dt;
          material.opacity = 1 - THREE.MathUtils.smoothstep(t, 0.55, 1);
          p.mesh.scale.set(p.size, p.size * 0.55, p.size * 1.4);
          break;
        case "trail":
        case "plume":
          // Keep the existing missile trails and wreck smoke unchanged.
          scale = 1 + p.age * 0.6;
          material.opacity = 0.5 * (1 - t);
          break;
      }
      p.mesh.position.addScaledVector(p.velocity, dt);
      if (p.layer !== "spark") {
        p.mesh.rotation.x +=
          dt * (p.layer === "debris" ? 5 : p.layer === "smoke" ? 0.12 : 1);
        if (p.layer !== "debris") p.mesh.scale.setScalar(p.size * scale);
      }
    }
    for (let i = this.lights.length - 1; i >= 0; i--) {
      const f = this.lights[i];
      f.age += dt;
      f.light.intensity =
        f.power * Math.exp(-f.age * 9) * Math.max(0, 1 - f.age / 0.55);
      f.light.color.setHex(f.age < 0.08 ? 0xffd9a0 : 0xffa74c);
      if (f.age >= 0.55) this.removeLight(i);
    }
  }
  reset() {
    while (this.particles.length) this.remove(this.particles.length - 1);
    while (this.lights.length) this.removeLight(this.lights.length - 1);
    this.shake = 0;
  }
  dispose() {
    this.reset();
    this.pool.forEach((p) => p.mesh.material.dispose());
    this.pool.length = 0;
    this.lightPool.length = 0;
    this.geometry.dispose();
    this.billowGeometry.dispose();
  }
  get count() {
    return this.particles.length;
  }
}
