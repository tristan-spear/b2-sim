import * as THREE from "three";
import { GroundTarget } from "../world/GroundTarget";
import { terrainHeight } from "../utils/noise";
import type { GroundConfig } from "./types";

export class CampaignGround extends GroundTarget {
  vulnerable = true;
  private age = 0;
  readonly turret = new THREE.Group();
  private readonly initial = new THREE.Vector3();
  constructor(readonly definition: GroundConfig) {
    const size =
      definition.size ??
      (definition.kind === "radar"
        ? [50, 90, 50]
        : definition.defense
          ? [55, 25, 55]
          : [100, 50, 85]);
    const floor = Math.max(
      114,
      ...[-size[0] / 2, size[0] / 2].flatMap((dx) =>
        [-size[2] / 2, size[2] / 2].map((dz) =>
          terrainHeight(definition.x + dx, definition.z + dz),
        ),
      ),
    );
    super(
      definition.id,
      definition.kind,
      new THREE.Vector3(definition.x, floor + 4, definition.z),
      new THREE.Vector3(...size),
      definition.health,
    );
    this.initial.copy(this.position);
    const foundation = new THREE.Mesh(
      new THREE.CylinderGeometry(size[0] * 0.85, size[0], 100, 8),
      new THREE.MeshStandardMaterial({ color: "#49535b", roughness: 0.95 }),
    );
    foundation.position.y = -47;
    this.root.add(foundation);
    const glow = new THREE.Mesh(
      new THREE.BoxGeometry(size[0] * 0.8, 4, 3),
      new THREE.MeshBasicMaterial({
        color: definition.phase ? "#ff8569" : "#d8b37c",
      }),
    );
    glow.position.set(0, size[1] * 0.65, size[2] / 2 + 2);
    this.root.add(glow);
    if (definition.defense) {
      const gunMaterial = new THREE.MeshStandardMaterial({
        color: "#46565a",
        metalness: 0.6,
        roughness: 0.4,
      });
      const base = new THREE.Mesh(
        new THREE.CylinderGeometry(size[0] * 0.3, size[0] * 0.35, 15, 10),
        gunMaterial,
      );
      this.turret.position.y = size[1] + 12;
      this.turret.add(base);
      for (const side of [-1, 1]) {
        const gun = new THREE.Mesh(
          new THREE.BoxGeometry(
            definition.defense === "battery" ? 12 : 5,
            6,
            definition.defense === "heavy" ? 85 : 40,
          ),
          gunMaterial,
        );
        gun.position.set(side * 12, 6, -22);
        gun.rotation.x = -0.35;
        this.turret.add(gun);
      }
      this.root.add(this.turret);
    }
    if (definition.phase === 3) {
      const armor = new THREE.MeshStandardMaterial({
        color: "#455564",
        metalness: 0.65,
        roughness: 0.45,
      });
      const reactor = new THREE.Mesh(
        new THREE.CylinderGeometry(60, 80, 150, 12),
        new THREE.MeshStandardMaterial({
          color: "#652f24",
          emissive: "#ff642d",
          emissiveIntensity: 1.1,
          metalness: 0.5,
          roughness: 0.3,
        }),
      );
      reactor.position.y = size[1] + 60;
      this.root.add(reactor);
      for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2;
        const plate = new THREE.Mesh(new THREE.BoxGeometry(60, 130, 18), armor);
        plate.position.set(
          Math.sin(angle) * 102,
          size[1] + 18,
          Math.cos(angle) * 102,
        );
        plate.rotation.y = angle;
        this.root.add(plate);
      }
      for (const y of [size[1] + 15, size[1] + 100]) {
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(88, 7, 6, 32),
          new THREE.MeshBasicMaterial({ color: "#ed9d53" }),
        );
        ring.rotation.x = Math.PI / 2;
        ring.position.y = y;
        this.root.add(ring);
      }
      this.root.updateMatrixWorld(true);
      this.bounds.setFromObject(this.root);
    }
  }
  override takeDamage(amount: number) {
    if (this.vulnerable) super.takeDamage(amount);
  }
  override update(dt: number) {
    super.update(dt);
    this.age += dt;
    if (this.definition.moving && !this.destroyed) {
      const previous = this.position.clone();
      this.position.x = this.initial.x + Math.sin(this.age * 0.018) * 1300;
      this.position.z = this.initial.z - this.age * 13;
      this.position.y =
        Math.max(114, terrainHeight(this.position.x, this.position.z)) + 4;
      const delta = this.position.clone().sub(previous);
      this.velocity.copy(delta).divideScalar(Math.max(dt, 1e-6));
      this.bounds.translate(delta);
      this.root.position.copy(this.position);
    }
  }
  override reset() {
    super.reset();
    this.age = 0;
    this.vulnerable = true;
    if (this.initial) {
      this.bounds.translate(this.initial.clone().sub(this.position));
      this.position.copy(this.initial);
      this.root.position.copy(this.initial);
    }
  }
}
export class CampaignCompound {
  readonly root = new THREE.Group();
  readonly targets: CampaignGround[];
  constructor(configs: GroundConfig[]) {
    this.targets = configs.map((config) => new CampaignGround(config));
    this.targets.forEach((t) => this.root.add(t.root));
    if (configs.some((c) => c.phase)) {
      const material = new THREE.MeshStandardMaterial({
        color: "#526274",
        roughness: 0.8,
        metalness: 0.25,
      });
      // A continuous fortress perimeter ties the separately damageable weak points together.
      const wall = new THREE.InstancedMesh(
        new THREE.BoxGeometry(1, 1, 1),
        material,
        30,
      );
      const dummy = new THREE.Object3D();
      for (let i = 0; i < 30; i++) {
        const side = i < 15 ? -1 : 1,
          z = 200 - (i % 15) * 260,
          x = 600 + side * 920;
        dummy.position.set(x, terrainHeight(x, z) + 75, z);
        dummy.scale.set(65, 150, 245);
        dummy.updateMatrix();
        wall.setMatrixAt(i, dummy.matrix);
      }
      this.root.add(wall);
    }
  }
  update(dt: number) {
    this.targets.forEach((t) => t.update(dt));
  }
  reset() {
    this.targets.forEach((t) => t.reset());
  }
}
