import { random } from "./math";
import type { TerrainType } from "../campaign/types";
let preset: TerrainType = "legacy";
export const setTerrainPreset = (type: TerrainType) => {
  preset = type;
};
export const getTerrainPreset = () => preset;

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
  if (preset !== "legacy") {
    const broad = fbm(x * 0.00035, z * 0.00035, 4);
    const detail = fbm(x * 0.0012, z * 0.0012, 3);
    switch (preset) {
      case "desert":
        return (
          270 +
          Math.sin(x * 0.0014 + Math.sin(z * 0.0007)) * 85 +
          broad * 220 +
          detail * 60
        );
      case "forest":
        return (
          350 +
          broad * 420 +
          detail * 110 +
          Math.max(0, Math.abs(x) - 3000) * 0.045
        );
      case "canyon": {
        const center = 500 + Math.sin(z * 0.00075) * 450;
        const wall = Math.min(
          1,
          Math.max(0, (Math.abs(x - center) - 600) / 450),
        );
        return 190 + wall * wall * 1250 + detail * 55;
      }
      case "coastline":
        return (
          30 +
          Math.max(0, Math.tanh((x + 500 + Math.sin(z * 0.0008) * 600) / 850)) *
            (420 + broad * 600) +
          detail * 50
        );
      case "islands":
        return (
          -130 +
          Math.max(0, Math.sin(x * 0.0006 + 0.9) * Math.cos(z * 0.00045)) *
            800 +
          detail * 130
        );
      case "city":
        return 150 + broad * 35;
      case "snow":
      case "mountains": {
        const valley =
          1 -
          Math.exp(-(((x - 500 - Math.sin(z * 0.00045) * 450) / 1800) ** 2));
        return (
          (preset === "snow" ? 1050 : 380) +
          valley * (1250 + broad * 750) +
          detail * 200
        );
      }
    }
  }
  const river = Math.sin(z * 0.00024) * 1700 + Math.sin(z * 0.00067) * 430;
  const distance = Math.abs(x - river);
  const valley = 1 - Math.exp((-distance * distance) / 1500000);
  const ridge = 1 - Math.abs(noise(x * 0.00019 + 12, z * 0.00019 - 4));
  const mountains =
    300 + Math.pow(ridge, 2.4) * 1500 + fbm(x * 0.00085, z * 0.00085) * 650;
  const naturalHeight =
    65 +
    valley * Math.max(80, mountains) +
    fbm(x * 0.0015, z * 0.0015, 3) * 70 * valley;
  // A small graded training range; smoothly meets the original procedural world.
  const distanceToRange = Math.max(
    Math.abs(x - 600) / 450,
    Math.abs(z + 1800) / 650,
  );
  const blend = Math.max(0, Math.min(1, (1.45 - distanceToRange) / 0.45));
  const smooth = blend * blend * (3 - 2 * blend);
  return lerp(naturalHeight, 1280, smooth);
}
