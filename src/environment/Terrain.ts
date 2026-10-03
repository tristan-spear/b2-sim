import * as THREE from "three";
import { fbm, terrainHeight } from "../utils/noise";
import { setTerrainPreset } from "../utils/noise";
import type { TerrainType } from "../campaign/types";

const TILE = 6000;
interface Tile {
  mesh: THREE.Mesh;
  x: number;
  z: number;
  resolution: number;
}
export class Terrain {
  private preset: TerrainType = "legacy";
  configure(preset: TerrainType, position: THREE.Vector3) {
    this.preset = preset;
    setTerrainPreset(preset);
    for (const tile of this.tiles.values()) {
      tile.mesh.geometry.dispose();
      tile.mesh.children.forEach((child) =>
        (child as THREE.Mesh).geometry.dispose(),
      );
      tile.mesh.removeFromParent();
    }
    this.tiles.clear();
    this.centerX = this.centerZ = Infinity;
    (this.water.material as THREE.MeshStandardMaterial).color.set(
      preset === "islands" || preset === "coastline" ? "#31576b" : "#718e88",
    );
    this.update(position, true);
  }
  readonly root = new THREE.Group();
  private readonly tiles = new Map<string, Tile>();
  private readonly material: THREE.MeshStandardMaterial;
  private readonly water: THREE.Mesh;
  private centerX = Infinity;
  private centerZ = Infinity;
  private queue: { x: number; z: number; resolution: number }[] = [];
  constructor() {
    this.material = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.96,
      metalness: 0,
    });
    this.material.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader
        .replace(
          "#include <common>",
          "#include <common>\nvarying vec3 vTerrainPos;",
        )
        .replace(
          "#include <begin_vertex>",
          "#include <begin_vertex>\nvTerrainPos = (modelMatrix * vec4(position, 1.0)).xyz;",
        );
      shader.fragmentShader = shader.fragmentShader
        .replace(
          "#include <common>",
          `#include <common>
        varying vec3 vTerrainPos;
        float terrainHash(vec2 p) { return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
        float terrainNoise(vec2 p) { vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(terrainHash(i),terrainHash(i+vec2(1,0)),f.x),mix(terrainHash(i+vec2(0,1)),terrainHash(i+1.),f.x),f.y); }
      `,
        )
        .replace(
          "#include <color_fragment>",
          `#include <color_fragment>
        float textureDetail = terrainNoise(vTerrainPos.xz * 0.024) * 0.5 + terrainNoise(vTerrainPos.xz * 0.095) * 0.3 + terrainNoise(vTerrainPos.xz * 0.31) * 0.2;
        diffuseColor.rgb *= 0.79 + textureDetail * 0.38;
      `,
        );
    };
    const waterMaterial = new THREE.MeshStandardMaterial({
      color: "#718e88",
      metalness: 0.6,
      roughness: 0.25,
    });
    this.water = new THREE.Mesh(
      new THREE.PlaneGeometry(100000, 100000),
      waterMaterial,
    );
    this.water.rotation.x = -Math.PI / 2;
    this.water.position.y = 110;
    this.root.add(this.water);
    this.update(new THREE.Vector3(600, 2400, 4200), true);
  }
  private createTile(x: number, z: number, resolution: number) {
    const geometry = new THREE.PlaneGeometry(
      TILE,
      TILE,
      resolution,
      resolution,
    );
    geometry.rotateX(-Math.PI / 2);
    const position = geometry.attributes.position;
    const colors = new Float32Array(position.count * 3);
    const normals = new Float32Array(position.count * 3);
    const normal = new THREE.Vector3();
    const low = new THREE.Color("#576550"),
      mid = new THREE.Color("#777460"),
      high = new THREE.Color("#a29a85"),
      snow = new THREE.Color("#cbc8b3"),
      color = new THREE.Color();
    const palette: Partial<Record<TerrainType, string[]>> = {
      desert: ["#b99159", "#bc9467", "#977351", "#d1b185"],
      canyon: ["#9b6545", "#b2744c", "#8b563f", "#d7a277"],
      forest: ["#315b39", "#597342", "#6d7656", "#a5b08e"],
      city: ["#35474b", "#4f5b59", "#616765", "#828d85"],
      snow: ["#a1b6c2", "#c5d3dd", "#e7e9ec", "#f5f6f6"],
      islands: ["#54816b", "#67816d", "#868675", "#c1b99a"],
      coastline: ["#817657", "#71745d", "#b09879", "#cbc4ad"],
    };
    const colorsForPreset = palette[this.preset];
    if (colorsForPreset)
      [low, mid, high, snow].forEach((c, i) => c.set(colorsForPreset[i]));
    for (let i = 0; i < position.count; i++) {
      const wx = position.getX(i) + x * TILE,
        wz = position.getZ(i) + z * TILE;
      const height = terrainHeight(wx, wz);
      position.setY(i, height);
      // World-space derivatives agree on both sides of every tile boundary.
      normal
        .set(
          terrainHeight(wx - 100, wz) - terrainHeight(wx + 100, wz),
          200,
          terrainHeight(wx, wz - 100) - terrainHeight(wx, wz + 100),
        )
        .normalize()
        .toArray(normals, i * 3);
      const variation = fbm(wx * 0.0015 + 80, wz * 0.0015, 3);
      color
        .copy(low)
        .lerp(
          mid,
          THREE.MathUtils.clamp((height - 250) / 1000 + variation, 0, 1),
        );
      color.lerp(high, THREE.MathUtils.clamp((height - 950) / 1200, 0, 0.8));
      color.lerp(
        snow,
        THREE.MathUtils.clamp((height - 1630 + variation * 220) / 380, 0, 0.85),
      );
      color.toArray(colors, i * 3);
    }
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
    // Vertical skirts hide mismatched edges between neighboring LOD resolutions.
    const skirtVertices: number[] = [],
      skirtColors: number[] = [],
      skirtNormals: number[] = [];
    for (let edge = 0; edge < 4; edge++)
      for (let j = 0; j < resolution; j++) {
        const a =
          edge === 0
            ? j
            : edge === 1
              ? resolution * (resolution + 1) + j
              : edge === 2
                ? j * (resolution + 1)
                : j * (resolution + 1) + resolution;
        const b = a + (edge < 2 ? 1 : resolution + 1);
        for (const [index, down] of [
          [a, 0],
          [b, 0],
          [a, 1],
          [b, 0],
          [b, 1],
          [a, 1],
        ]) {
          skirtVertices.push(
            position.getX(index),
            position.getY(index) - down * 180,
            position.getZ(index),
          );
          skirtColors.push(
            colors[index * 3],
            colors[index * 3 + 1],
            colors[index * 3 + 2],
          );
          skirtNormals.push(
            normals[index * 3],
            normals[index * 3 + 1],
            normals[index * 3 + 2],
          );
        }
      }
    const skirt = new THREE.BufferGeometry();
    skirt.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(skirtVertices, 3),
    );
    skirt.setAttribute(
      "color",
      new THREE.Float32BufferAttribute(skirtColors, 3),
    );
    skirt.setAttribute(
      "normal",
      new THREE.Float32BufferAttribute(skirtNormals, 3),
    );
    const mesh = new THREE.Mesh(geometry, this.material);
    mesh.position.set(x * TILE, 0, z * TILE);
    mesh.receiveShadow = true;
    const skirtMesh = new THREE.Mesh(skirt, this.material);
    skirtMesh.material.side = THREE.DoubleSide;
    mesh.add(skirtMesh);
    this.root.add(mesh);
    this.tiles.set(`${x},${z}`, { mesh, x, z, resolution });
  }
  update(position: THREE.Vector3, immediate = false) {
    const cx = Math.round(position.x / TILE),
      cz = Math.round(position.z / TILE);
    this.water.position.x = position.x;
    this.water.position.z = position.z;
    if (cx !== this.centerX || cz !== this.centerZ) {
      this.centerX = cx;
      this.centerZ = cz;
      this.queue = [];
      for (const [key, tile] of this.tiles) {
        if (Math.abs(tile.x - cx) > 3 || Math.abs(tile.z - cz) > 3) {
          this.root.remove(tile.mesh);
          tile.mesh.geometry.dispose();
          tile.mesh.children.forEach((child) =>
            (child as THREE.Mesh).geometry.dispose(),
          );
          this.tiles.delete(key);
        }
      }
      for (let radius = 0; radius <= 3; radius++)
        for (let dx = -radius; dx <= radius; dx++)
          for (let dz = -radius; dz <= radius; dz++) {
            if (Math.max(Math.abs(dx), Math.abs(dz)) !== radius) continue;
            const x = cx + dx,
              z = cz + dz,
              resolution = radius <= 1 ? 72 : radius === 2 ? 40 : 24;
            const existing = this.tiles.get(`${x},${z}`);
            if (!existing || existing.resolution !== resolution)
              this.queue.push({ x, z, resolution });
          }
    }
    // Build at most one tile per frame while flying to avoid boundary stalls.
    const count = immediate ? this.queue.length : 1;
    for (let i = 0; i < count; i++) {
      const tile = this.queue.shift();
      if (!tile) break;
      const key = `${tile.x},${tile.z}`,
        old = this.tiles.get(key);
      if (old) {
        this.root.remove(old.mesh);
        old.mesh.geometry.dispose();
        old.mesh.children.forEach((child) =>
          (child as THREE.Mesh).geometry.dispose(),
        );
        this.tiles.delete(key);
      }
      this.createTile(tile.x, tile.z, tile.resolution);
    }
  }
  get tileCount() {
    return this.tiles.size;
  }
}
