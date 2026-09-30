import test from "node:test";
import assert from "node:assert/strict";
import { Mesh, PointLight, Vector3 } from "three";
import { ExplosionSystem, type ExplosionKind } from "../src/combat/Explosion";

function advance(effects: ExplosionSystem, seconds: number) {
  for (let time = 0; time < seconds; time += 1 / 120)
    effects.update(Math.min(1 / 120, seconds - time));
}

const lights = (effects: ExplosionSystem) =>
  effects.root.children.filter(
    (child): child is PointLight => child instanceof PointLight,
  );

test("explosion sources have increasing core size, light reach and bounded nearby shake", () => {
  let previousSize = 0,
    previousReach = 0,
    previousShake = 0;
  for (const kind of [
    "missile",
    "aircraft",
    "bomb",
    "large",
  ] as ExplosionKind[]) {
    const effects = new ExplosionSystem();
    const position = new Vector3(10, 20, 30);
    effects.spawn(position, kind, position);
    const core = effects.root.children[0] as Mesh;
    const light = lights(effects)[0];
    assert.ok(core.scale.x > previousSize);
    assert.ok(light.distance > previousReach);
    assert.ok(effects.shake > previousShake && effects.shake <= 2.6);
    assert.equal(light.castShadow, false);
    assert.deepEqual(position.toArray(), [10, 20, 30]);
    previousSize = core.scale.x;
    previousReach = light.distance;
    previousShake = effects.shake;
    effects.reset();
    effects.spawn(position, kind, new Vector3(10000, 20, 30));
    assert.equal(effects.shake, 0);
  }
});

test("fireball expands, impact lighting fades quickly, and smoke lingers then clears", () => {
  const effects = new ExplosionSystem();
  effects.spawn(new Vector3(), "bomb", new Vector3());
  const fireball = effects.root.children[1] as Mesh;
  const radius = fireball.scale.x;
  const initialShake = effects.shake;
  const light = lights(effects)[0];
  const intensity = light.intensity;
  advance(effects, 0.25);
  assert.ok(fireball.scale.x > radius * 1.5);
  assert.ok(light.intensity < intensity * 0.2);
  assert.ok(effects.shake < initialShake * 0.3);
  advance(effects, 0.5);
  assert.equal(lights(effects).length, 0);
  advance(effects, 4.25);
  assert.ok(
    effects.count >= 18,
    "Dense smoke should survive past the old four-second lifetime",
  );
  advance(effects, 5);
  assert.equal(effects.count, 0);
  assert.equal(effects.root.children.length, 0);
});

test("sustained explosions stay within budget and recycle resources across reset", () => {
  const effects = new ExplosionSystem();
  for (let i = 0; i < 100; i++) {
    effects.spawn(new Vector3(), "large", new Vector3());
    effects.trail(new Vector3());
    effects.smoke(new Vector3());
    assert.ok(effects.count <= 360);
    assert.ok(lights(effects).length <= 4);
  }
  const meshes = effects.root.children.filter(
    (child): child is Mesh => child instanceof Mesh,
  );
  const materials = new Set(meshes.map((mesh) => mesh.material));
  const flashLights = new Set(lights(effects));
  effects.reset();
  assert.equal(effects.count, 0);
  assert.equal(effects.shake, 0);
  assert.equal(effects.root.children.length, 0);
  effects.spawn(new Vector3(), "large", new Vector3());
  for (const child of effects.root.children) {
    if (child instanceof Mesh) assert.ok(materials.has(child.material));
    if (child instanceof PointLight) assert.ok(flashLights.has(child));
  }
  advance(effects, 10);
  assert.equal(effects.root.children.length, 0);
});

test("missile trail and ongoing wreck smoke retain their existing motion and lifetime", () => {
  const effects = new ExplosionSystem();
  effects.trail(new Vector3());
  effects.smoke(new Vector3());
  const [trail, plume] = effects.root.children as Mesh[];
  advance(effects, 1);
  assert.ok(trail.position.distanceTo(new Vector3(0, 2, 0)) < 1e-10);
  assert.ok(plume.position.distanceTo(new Vector3(5, 26, 0)) < 1e-10);
  assert.ok(Math.abs(trail.scale.x - 3.2) < 1e-10);
  assert.ok(Math.abs(plume.scale.x - 22.4) < 1e-10);
  advance(effects, 0.8);
  assert.equal(effects.count, 1);
  advance(effects, 6.3);
  assert.equal(effects.count, 0);
});
