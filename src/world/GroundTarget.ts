import * as THREE from "three";
import { Damageable, type TargetKind } from "../combat/Damageable";

export class GroundTarget extends Damageable {
  readonly root = new THREE.Group();
  readonly bounds = new THREE.Box3();
  readonly material = new THREE.MeshStandardMaterial({
    color: "#acac94",
    roughness: 0.95,
  });
  private collapse = 0;
  constructor(
    id: string,
    kind: Exclude<TargetKind, "aircraft">,
    position: THREE.Vector3,
    readonly size: THREE.Vector3,
  ) {
    super(
      id,
      kind,
      kind === "command" ? 200 : kind === "hangar" ? 150 : 100,
      { small: 100, hangar: 250, radar: 300, command: 750 }[kind],
    );
    this.position.copy(position);
    this.root.position.copy(position);
    this.bounds.setFromCenterAndSize(
      position.clone().add(new THREE.Vector3(0, size.y / 2, 0)),
      size,
    );
    const box = (
      w: number,
      h: number,
      d: number,
      y: number,
      material = this.material,
    ) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
      mesh.position.y = y;
      mesh.castShadow = mesh.receiveShadow = true;
      this.root.add(mesh);
      return mesh;
    };
    const dark = new THREE.MeshStandardMaterial({
      color: "#374b4a",
      roughness: 0.9,
    });
    if (kind === "radar") {
      box(22, 12, 22, 6);
      box(6, size.y - 18, 6, size.y / 2);
      const dish = new THREE.Mesh(
        new THREE.SphereGeometry(18, 10, 6, 0, Math.PI),
        dark,
      );
      dish.position.y = size.y - 12;
      dish.rotation.x = -0.4;
      this.root.add(dish);
    } else {
      box(size.x, size.y, size.z, size.y / 2);
      box(size.x + 5, 4, size.z + 5, size.y + 2, dark);
      const door = box(size.x * 0.55, size.y * 0.65, 1, size.y * 0.33, dark);
      door.position.z = size.z / 2 + 0.6;
      if (kind === "command") box(size.x * 0.35, 14, size.z * 0.45, size.y + 9);
    }
    // Include roof overhangs and the radar dish in the collision volume.
    this.root.updateMatrixWorld(true);
    this.bounds.setFromObject(this.root);
  }
  update(dt: number) {
    this.flash = Math.max(0, this.flash - dt);
    this.material.emissive.setHex(this.flash > 0 ? 0xaa5522 : 0);
    if (this.destroyed) {
      this.collapse = Math.min(1, this.collapse + dt * 1.5);
      this.root.scale.y = 1 - this.collapse * 0.85;
      this.root.rotation.z = this.collapse * 0.09;
      this.material.color.setHex(0x41423e);
    }
  }
  override reset() {
    super.reset();
    this.collapse = 0;
    this.root.scale.setScalar(1);
    this.root.rotation.set(0, 0, 0);
    this.material.color.set("#acac94");
    this.material.emissive.setHex(0);
  }
}
