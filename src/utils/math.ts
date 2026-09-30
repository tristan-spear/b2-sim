export const clamp = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, v));
export const damp = (a: number, b: number, rate: number, dt: number) =>
  a + (b - a) * (1 - Math.exp(-rate * dt));
export const degrees = (r: number) => (r * 180) / Math.PI;
export const wrap = (v: number, max: number) => ((v % max) + max) % max;
export function random(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
