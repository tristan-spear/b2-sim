import { BufferGeometry, Material, Object3D, Texture } from "three";

/** Dispose an owned scene tree, including shared geometry and texture maps once. */
export function disposeTree(root: Object3D) {
  const resources = new Set<BufferGeometry | Material | Texture>();
  root.traverse((object) => {
    const mesh = object as Object3D & {
      geometry?: BufferGeometry;
      material?: Material | Material[];
    };
    if (mesh.geometry) resources.add(mesh.geometry);
    for (const material of mesh.material ? [mesh.material].flat() : []) {
      resources.add(material);
      for (const value of Object.values(material))
        if (value instanceof Texture) resources.add(value);
    }
  });
  resources.forEach((resource) => resource.dispose());
  root.removeFromParent();
  root.clear();
}
