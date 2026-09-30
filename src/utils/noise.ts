import { random } from "./math";

// Seeded gradient noise keeps terrain and collision heights identical everywhere.
const rng = random(4701);
const permutation = Array.from({ length: 256 }, (_, i) => i);
for (let i = 255; i > 0; i--) {
  const j = Math.floor(rng() * (i + 1));
  [permutation[i], permutation[j]] = [permutation[j], permutation[i]];
}
const p = [...permutation, ...permutation];
const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
function grad(h: number, x: number, y: number) {
  return (h & 1 ? -x : x) + (h & 2 ? -y : y);
}
export function noise(x: number, y: number) {
  const ix = Math.floor(x) & 255,
    iy = Math.floor(y) & 255;
  x -= Math.floor(x);
  y -= Math.floor(y);
  const u = fade(x),
    v = fade(y);
  return lerp(
    lerp(grad(p[p[ix] + iy], x, y), grad(p[p[ix + 1] + iy], x - 1, y), u),
    lerp(
      grad(p[p[ix] + iy + 1], x, y - 1),
      grad(p[p[ix + 1] + iy + 1], x - 1, y - 1),
      u,
    ),
    v,
  );
}
export function fbm(x: number, y: number, octaves = 5) {
  let result = 0,
    amplitude = 0.5;
  for (let i = 0; i < octaves; i++) {
    result += noise(x, y) * amplitude;
    x = x * 2.03 + 31.4;
    y = y * 2.03 + 17.1;
    amplitude *= 0.5;
  }
  return result;
}
export function terrainHeight(x: number, z: number) {
  const river = Math.sin(z * 0.00024) * 1700 + Math.sin(z * 0.00067) * 430;
  const distance = Math.abs(x - river);
  const valley = 1 - Math.exp((-distance * distance) / 1500000);
  const ridge = 1 - Math.abs(noise(x * 0.00019 + 12, z * 0.00019 - 4));
  const mountains =
    300 + Math.pow(ridge, 2.4) * 1500 + fbm(x * 0.00085, z * 0.00085) * 650;
  return (
    65 +
    valley * Math.max(80, mountains) +
    fbm(x * 0.0015, z * 0.0015, 3) * 70 * valley
  );
}
