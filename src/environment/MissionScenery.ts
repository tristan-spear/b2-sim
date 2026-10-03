import * as THREE from "three";
import { terrainHeight } from "../utils/noise";
import { random } from "../utils/math";
import { disposeTree } from "../game/dispose";
import type { EnvironmentConfig } from "../campaign/types";

export class MissionScenery {
  readonly root = new THREE.Group();
  private weather?: THREE.Points;
  private readonly lightning = new THREE.DirectionalLight("#a4c9ff", 0);
  constructor(readonly config: EnvironmentConfig) {
    const rng = random(8503),
      dummy = new THREE.Object3D();
    if (config.terrain === "city") {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 128;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "#131d2e";
      ctx.fillRect(0, 0, 128, 128);
      for (let y = 5; y < 128; y += 10)
        for (let x = 4; x < 128; x += 10) {
          ctx.fillStyle =
            rng() > 0.35 ? (rng() > 0.5 ? "#c2d4ba" : "#f4b968") : "#172438";
          ctx.fillRect(x, y, 4, 5);
        }
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      const material = new THREE.MeshStandardMaterial({
        color: "#455463",
        roughness: 0.45,
        metalness: 0.3,
        map: texture,
        emissiveMap: texture,
        emissive: "#e5ca9d",
        emissiveIntensity: 0.65,
      });
      const buildings = new THREE.InstancedMesh(
        new THREE.BoxGeometry(1, 1, 1),
        material,
        484,
      );
      for (let i = 0; i < 484; i++) {
        const x = ((i % 22) - 10) * 340 + (rng() - 0.5) * 90,
          z = (Math.floor(i / 22) - 13) * 350;
        const height = 50 + rng() ** 2 * 500;
        dummy.position.set(x, terrainHeight(x, z) + height / 2, z);
        dummy.scale.set(80 + rng() * 110, height, 80 + rng() * 110);
        dummy.updateMatrix();
        buildings.setMatrixAt(i, dummy.matrix);
      }
      buildings.receiveShadow = true;
      this.root.add(buildings);
      const roads = new THREE.InstancedMesh(
        new THREE.BoxGeometry(1, 1, 1),
        new THREE.MeshBasicMaterial({ color: "#51626a" }),
        44,
      );
      for (let i = 0; i < 44; i++) {
        const horizontal = i >= 22;
        const p = ((i % 22) - 10) * 345 + 150;
        dummy.position.set(
          horizontal ? 0 : p,
          173,
          horizontal ? p - 1000 : -1000,
        );
        dummy.scale.set(horizontal ? 8000 : 14, 2, horizontal ? 14 : 8000);
        dummy.updateMatrix();
        roads.setMatrixAt(i, dummy.matrix);
      }
      this.root.add(roads);
    }
    if (config.terrain === "forest") {
      const trees = new THREE.InstancedMesh(
        new THREE.ConeGeometry(1, 1, 5),
        new THREE.MeshStandardMaterial({ color: "#244837", roughness: 1 }),
        900,
      );
      for (let i = 0; i < 900; i++) {
        const x = (rng() - 0.5) * 13000,
          z = (rng() - 0.5) * 13000;
        const h = 30 + rng() * 65;
        dummy.position.set(x, terrainHeight(x, z) + h / 2, z);
        dummy.scale.set(h * 0.3, h, h * 0.3);
        dummy.updateMatrix();
        trees.setMatrixAt(i, dummy.matrix);
      }
      this.root.add(trees);
    }
    if (config.weather !== "clear") {
      const positions = new Float32Array(420 * 3);
      for (let i = 0; i < positions.length; i += 3) {
        positions[i] = (rng() - 0.5) * 1600;
        positions[i + 1] = rng() * 1000 - 500;
        positions[i + 2] = (rng() - 0.5) * 1600;
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute(
        "position",
        new THREE.BufferAttribute(positions, 3),
      );
      this.weather = new THREE.Points(
        geometry,
        new THREE.PointsMaterial({
          color: "#cfdee9",
          transparent: true,
          opacity: 0.45,
          size: config.weather === "snow" ? 3.5 : 1.8,
          depthWrite: false,
        }),
      );
      this.root.add(this.weather, this.lightning);
    }
  }
  update(dt: number, position: THREE.Vector3, time: number) {
    if (this.weather) {
      this.weather.position.copy(position);
      const p = this.weather.geometry.attributes.position;
      for (let i = 0; i < p.count; i++)
        p.setY(
          i,
          ((p.getY(i) +
            500 -
            dt * (this.config.weather === "snow" ? 35 : 450) +
            1000) %
            1000) -
            500,
        );
      p.needsUpdate = true;
      this.lightning.intensity =
        time % 13 > 12.7 && time % 13 < 12.85 ? 2.8 : 0;
    }
  }
  dispose() {
    disposeTree(this.root);
  }
}
