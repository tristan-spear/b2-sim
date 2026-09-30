import {
  Group,
  Vector3,
  Mesh,
  CylinderGeometry,
  MeshStandardMaterial,
} from "three";
import { GroundTarget } from "../world/GroundTarget";
import { terrainHeight } from "../utils/noise";

export class StrikeTargets {
  readonly root = new Group();
  readonly targets: GroundTarget[] = [];
  constructor() {
    for (const [kind, x, z] of [
      ["radar", 250, 900],
      ["command", 1200, -350],
    ] as const) {
      const y = Math.max(
        ...[-70, 70].flatMap((dx) =>
          [-70, 70].map((dz) => terrainHeight(x + dx, z + dz)),
        ),
      );
      const target = new GroundTarget(
        kind.toUpperCase(),
        kind,
        new Vector3(x, y + 4, z),
        new Vector3(kind === "radar" ? 42 : 85, kind === "radar" ? 78 : 40, 65),
      );
      const pad = new Mesh(
        new CylinderGeometry(100, 110, 100, 8),
        new MeshStandardMaterial({ color: "#566563", roughness: 1 }),
      );
      pad.position.set(x, y - 48, z);
      this.targets.push(target);
      this.root.add(pad, target.root);
    }
  }
  update(dt: number) {
    this.targets.forEach((t) => t.update(dt));
  }
  reset() {
    this.targets.forEach((t) => t.reset());
  }
}
