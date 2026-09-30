import { Box3, Vector3 } from "three";
export type HeightSampler = (x: number, z: number) => number;
// Swept tests prevent tunneling, including when a projectile crosses a whole target in one step.
export function segmentBox(a: Vector3, b: Vector3, box: Box3): number | null {
  let lo = 0,
    hi = 1;
  for (const axis of ["x", "y", "z"] as const) {
    const d = b[axis] - a[axis];
    if (Math.abs(d) < 1e-9) {
      if (a[axis] < box.min[axis] || a[axis] > box.max[axis]) return null;
    } else {
      const u = (box.min[axis] - a[axis]) / d,
        v = (box.max[axis] - a[axis]) / d;
      lo = Math.max(lo, Math.min(u, v));
      hi = Math.min(hi, Math.max(u, v));
      if (lo > hi) return null;
    }
  }
  return lo;
}
export function segmentSphere(
  a: Vector3,
  b: Vector3,
  center: Vector3,
  radius: number,
): number | null {
  const d = b.clone().sub(a),
    offset = a.clone().sub(center);
  const c = offset.lengthSq() - radius * radius;
  if (c <= 0) return 0;
  const length = d.lengthSq(),
    dot = offset.dot(d),
    discriminant = dot * dot - length * c;
  if (length === 0 || discriminant < 0) return null;
  const t = (-dot - Math.sqrt(discriminant)) / length;
  return t >= 0 && t <= 1 ? t : null;
}
export function segmentTerrain(
  a: Vector3,
  b: Vector3,
  height: HeightSampler,
): number | null {
  const point = new Vector3(),
    steps = Math.max(1, Math.ceil(a.distanceTo(b) / 15));
  for (let i = 0; i <= steps; i++) {
    point.lerpVectors(a, b, i / steps);
    if (point.y <= Math.max(110, height(point.x, point.z))) {
      let lo = Math.max(0, (i - 1) / steps),
        hi = i / steps;
      for (let j = 0; j < 12; j++) {
        const mid = (lo + hi) / 2;
        point.lerpVectors(a, b, mid);
        if (point.y > Math.max(110, height(point.x, point.z))) lo = mid;
        else hi = mid;
      }
      return hi;
    }
  }
  return null;
}
