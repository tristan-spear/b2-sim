import * as THREE from "three";
import { random } from "../utils/math";
import type { EnvironmentConfig } from "../campaign/types";

interface Cloud {
  x: number;
  y: number;
  z: number;
  width: number;
  height: number;
  rotation: number;
}
export class Clouds {
  readonly mesh: THREE.InstancedMesh;
  private readonly clouds: Cloud[] = [];
  private readonly dummy = new THREE.Object3D();
  private readonly rotation = new THREE.Quaternion();
  private readonly axis = new THREE.Vector3(0, 0, 1);
  private readonly rng = random(91832);
  constructor() {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext("2d")!;
    // A reusable, softly lit vapor texture keeps the entire cloud field to one draw call.
    for (let i = 0; i < 65; i++) {
      const x = 100 + this.rng() * 310,
        y = 100 + this.rng() * 70,
        radius = 25 + this.rng() * 60;
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
      gradient.addColorStop(0, "rgba(255,246,222,.14)");
      gradient.addColorStop(0.45, "rgba(243,230,207,.08)");
      gradient.addColorStop(1, "rgba(227,215,197,0)");
      ctx.fillStyle = gradient;
      ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
      opacity: 0.57,
      fog: true,
      side: THREE.DoubleSide,
    });
    this.mesh = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(1, 1),
      material,
      200,
    );
    this.mesh.frustumCulled = false;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    for (let i = 0; i < 200; i++)
      this.clouds.push({
        x: (this.rng() - 0.5) * 34000,
        y: i < 150 ? 1250 + this.rng() * 900 : 3300 + this.rng() * 700,
        z: (this.rng() - 0.5) * 34000,
        width: 900 + this.rng() * 1700,
        height: 260 + this.rng() * 550,
        rotation: (this.rng() - 0.5) * 0.14,
      });
  }
  configure(config: EnvironmentConfig) {
    this.mesh.count = Math.round(200 * config.clouds);
    const material = this.mesh.material as THREE.MeshBasicMaterial;
    material.color.set(
      config.time === "night"
        ? "#526786"
        : config.time === "storm"
          ? "#718293"
          : "#ffffff",
    );
    material.opacity = config.time === "storm" ? 0.85 : 0.57;
  }
  update(camera: THREE.Camera, position: THREE.Vector3, time: number) {
    this.clouds.forEach((cloud, i) => {
      let x = cloud.x + time * 5,
        z = cloud.z;
      x =
        position.x +
        ((((x - position.x + 51000) % 34000) + 34000) % 34000) -
        17000;
      z =
        position.z +
        ((((z - position.z + 51000) % 34000) + 34000) % 34000) -
        17000;
      this.dummy.position.set(x, cloud.y, z);
      this.rotation.setFromAxisAngle(this.axis, cloud.rotation);
      this.dummy.quaternion.copy(camera.quaternion).multiply(this.rotation);
      this.dummy.scale.set(cloud.width, cloud.height, 1);
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this.dummy.matrix);
    });
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
