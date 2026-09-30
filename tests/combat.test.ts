import test from "node:test";
import assert from "node:assert/strict";
import { Box3, Vector3 } from "three";
import { CombatSystem } from "../src/combat/CombatSystem";
import { Bomb } from "../src/combat/Bomb";
import { Missile } from "../src/combat/Missile";
import {
  segmentBox,
  segmentSphere,
  segmentTerrain,
} from "../src/combat/collision";
import { FlightModel, neutralInput } from "../src/physics/FlightModel";
import { terrainHeight } from "../src/utils/noise";
const dt = 1 / 120;
function advance(combat: CombatSystem, seconds: number) {
  for (let i = 0; i < seconds / dt; i++) combat.update(dt);
}
function bombTarget(combat: CombatSystem, flight: FlightModel, id: string) {
  const target = combat.compound.targets.find((t) => t.id === id)!;
  flight.reset();
  const fall = Math.sqrt(
    (2 * (flight.position.y - 6 - target.bounds.max.y)) / 9.81,
  );
  flight.position.x = target.position.x;
  flight.position.z = target.position.z + flight.velocity.z * -fall;
  combat.action("Space");
  advance(combat, fall + 1);
  assert.equal(
    target.destroyed,
    true,
    `${id} should be destroyed by an actual ballistic bomb`,
  );
}
test("bomb inherits velocity, follows analytic gravity and does not mutate flight state", () => {
  const flight = new FlightModel();
  flight.velocity.set(90, 12, -210);
  const bomb = new Bomb(flight),
    initial = bomb.position.clone();
  for (let i = 0; i < 240; i++) bomb.update(dt);
  assert.ok(
    Math.abs(bomb.position.y - (initial.y + 24 - 0.5 * 9.81 * 4)) < 1e-7,
  );
  assert.ok(Math.abs(bomb.position.z - initial.z + 420) < 1e-7);
  assert.equal(flight.velocity.y, 12);
});
test("swept tests catch thin buildings, moving-target crossings, and terrain", () => {
  assert.equal(
    segmentBox(
      new Vector3(-100, 0, 0),
      new Vector3(100, 0, 0),
      new Box3(new Vector3(-1, -1, -1), new Vector3(1, 1, 1)),
    ),
    0.495,
  );
  assert.ok(
    segmentSphere(
      new Vector3(-100, 0, 0),
      new Vector3(100, 0, 0),
      new Vector3(),
      10,
    )! < 0.5,
  );
  assert.equal(
    segmentSphere(
      new Vector3(-100, 11, 0),
      new Vector3(100, 11, 0),
      new Vector3(),
      10,
    ),
    null,
  );
  const t = segmentTerrain(
    new Vector3(0, 200, 0),
    new Vector3(0, 0, 0),
    () => 120,
  )!;
  assert.ok(Math.abs(t - 0.4) < 0.0001);
});
test("cooldowns, ammo limits and terrain impact remove bombs", () => {
  const flight = new FlightModel(),
    combat = new CombatSystem(flight, () => {});
  combat.action("Space");
  combat.action("Space");
  assert.equal(combat.weapons.bombs, 7);
  assert.equal(combat.weapons.projectiles.length, 1);
  advance(combat, 30);
  assert.equal(combat.weapons.projectiles.length, 0);
  const hit = combat.weapons.lastImpact!;
  assert.ok(Math.abs(hit.y - Math.max(110, terrainHeight(hit.x, hit.z))) < 0.1);
  for (let i = 0; i < 10; i++) {
    combat.action("Space");
    advance(combat, 0.7);
  }
  assert.equal(combat.weapons.bombs, 0);
  assert.ok(combat.weapons.projectiles.length <= 7);
});
test("all ground target types take blast damage, collapse and award score only once", () => {
  for (const id of ["RADAR", "COMMAND", "HANGAR 01", "RANGE 1"]) {
    const flight = new FlightModel(),
      combat = new CombatSystem(flight, () => {});
    bombTarget(combat, flight, id);
    const target = combat.compound.targets.find((t) => t.id === id)!;
    const score = combat.mission.score;
    target.takeDamage(1000);
    target.destroy();
    assert.equal(combat.mission.score, score);
    assert.ok(score >= target.points);
    assert.ok(target.root.scale.y < 0.5);
    assert.ok(combat.weapons.projectiles.length === 0);
  }
});
test("missile turns gradually, homes on moving patrol aircraft and expires without a target", () => {
  const flight = new FlightModel(),
    combat = new CombatSystem(flight, () => {});
  const missile = new Missile(flight, combat.enemies.aircraft[1]);
  const initial = missile.direction.clone();
  missile.update(dt);
  assert.ok(initial.angleTo(missile.direction) <= missile.turnRate * dt + 1e-7);
  combat.action("Tab");
  assert.equal(combat.targeting.valid(flight.position), true);
  combat.action("KeyF");
  combat.action("KeyF");
  assert.equal(combat.weapons.missiles, 5);
  const original = combat.enemies.aircraft[0].position.clone();
  advance(combat, 8);
  assert.equal(combat.enemies.aircraft[0].destroyed, true);
  assert.ok(original.distanceTo(combat.enemies.aircraft[0].position) > 100);
  assert.equal(combat.mission.score, 500);
  assert.equal(combat.targeting.selected, null);
  combat.action("KeyF");
  advance(combat, 15);
  assert.equal(combat.weapons.projectiles.length, 0);
  assert.equal(combat.enemies.aircraft[0].destroyed, false);
});
test("playable mission: ballistic strikes and three patrol interceptions complete and restart cleanly", () => {
  const flight = new FlightModel(),
    combat = new CombatSystem(flight, () => {});
  bombTarget(combat, flight, "RADAR");
  assert.equal(combat.mission.radar, true);
  bombTarget(combat, flight, "COMMAND");
  assert.equal(combat.mission.command, true);
  flight.reset();
  flight.position.z = 1000;
  // Actual target cycling and missile guidance; enemies continue to patrol each step.
  for (let i = 0; i < 3; i++) {
    combat.action("Tab");
    assert.ok(combat.targeting.valid(flight.position));
    combat.action("KeyF");
    for (let j = 0; j < 14 / dt && combat.mission.aircraft <= i; j++)
      combat.update(dt);
    assert.equal(combat.mission.aircraft, i + 1);
  }
  assert.equal(combat.mission.complete, true);
  assert.ok(combat.mission.score >= 2550);
  const final = combat.mission.time;
  advance(combat, 1);
  assert.equal(combat.mission.time, final);
  combat.reset();
  assert.equal(combat.mission.score, 0);
  assert.equal(combat.mission.complete, false);
  assert.equal(combat.mission.time, 0);
  assert.equal(combat.weapons.bombs, 8);
  assert.equal(combat.weapons.missiles, 6);
  assert.equal(combat.weapons.projectiles.length, 0);
  assert.equal(combat.effects.count, 0);
  assert.equal(combat.targeting.selected, null);
  for (const t of [...combat.enemies.aircraft, ...combat.compound.targets]) {
    assert.equal(t.destroyed, false);
    assert.equal(t.health, t.maxHealth);
  }
});
test("default cruise can intercept all bandits while flight physics continue", () => {
  const flight = new FlightModel(),
    combat = new CombatSystem(flight, () => {});
  for (let i = 0; i < 3; i++) {
    combat.action("Tab");
    combat.action("KeyF");
    for (let j = 0; j < 14 / dt && combat.mission.aircraft <= i; j++) {
      flight.update(dt, neutralInput(), terrainHeight);
      combat.update(dt);
    }
    assert.equal(combat.mission.aircraft, i + 1);
    assert.equal(flight.crashed, false);
  }
});
