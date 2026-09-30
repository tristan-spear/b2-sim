import * as THREE from "three";
import { GroundTarget } from "./GroundTarget";
import { terrainHeight } from "../utils/noise";

export class TargetCompound {
  readonly root = new THREE.Group();
  readonly targets: GroundTarget[] = [];
  constructor() {
    const roadMaterial = new THREE.MeshStandardMaterial({
      color: "#646b60",
      roughness: 1,
    });
    // Roads follow the existing terrain; foundations accommodate local slopes.
    const road = (x: number, z: number, w: number, d: number) => {
      const geometry = new THREE.PlaneGeometry(
        w,
        d,
        Math.ceil(w / 25),
        Math.ceil(d / 25),
      );
      geometry.rotateX(-Math.PI / 2);
      const p = geometry.attributes.position;
      for (let i = 0; i < p.count; i++)
        p.setY(i, terrainHeight(x + p.getX(i), z + p.getZ(i)) + 3);
      geometry.computeVertexNormals();
      const mesh = new THREE.Mesh(geometry, roadMaterial);
      mesh.position.set(x, 0, z);
      mesh.receiveShadow = true;
      this.root.add(mesh);
    };
    road(600, -1750, 24, 1150);
    road(600, -1670, 600, 22);
    road(600, -2170, 600, 22);
    const add = (
      id: string,
      kind: "small" | "hangar" | "radar" | "command",
      x: number,
      z: number,
      w: number,
      h: number,
      d: number,
    ) => {
      const floor = Math.max(
        ...[-w / 2, w / 2].flatMap((dx) =>
          [-d / 2, d / 2].map((dz) => terrainHeight(x + dx, z + dz)),
        ),
      );
      const foundation = new THREE.Mesh(
        new THREE.BoxGeometry(w + 14, 90, d + 14),
        roadMaterial,
      );
      foundation.position.set(x, floor - 42, z);
      this.root.add(foundation);
      const target = new GroundTarget(
        id,
        kind,
        new THREE.Vector3(x, floor + 3, z),
        new THREE.Vector3(w, h, d),
      );
      this.targets.push(target);
      this.root.add(target.root);
    };
    add("RADAR", "radar", 600, -1330, 42, 78, 42);
    add("COMMAND", "command", 600, -2240, 100, 42, 80);
    add("HANGAR 01", "hangar", 380, -1870, 110, 38, 100);
    add("HANGAR 02", "hangar", 820, -1870, 110, 38, 100);
    for (let i = 0; i < 4; i++)
      add(
        `RANGE ${i + 1}`,
        "small",
        i % 2 ? 800 : 400,
        i < 2 ? -1550 : -2050,
        55,
        26,
        48,
      );
  }
  update(dt: number) {
    this.targets.forEach((t) => t.update(dt));
  }
  reset() {
    this.targets.forEach((t) => t.reset());
  }
}
