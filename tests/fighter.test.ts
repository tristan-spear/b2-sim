import test from "node:test";
import assert from "node:assert/strict";
import {
  FlightModel,
  fighterFlight,
  neutralInput,
} from "../src/physics/FlightModel";
import { F35TrainingMission } from "../src/missions/F35TrainingMission";
import { terrainHeight } from "../src/utils/noise";
import { FighterEnemy } from "../src/enemies/FighterEnemy";

const step = 1 / 120;
function advance(combat: F35TrainingMission, seconds: number) {
  for (let t = 0; t < seconds; t += step) combat.update(step);
}

test("fighter profile changes handling without changing bomber defaults", () => {
  const bomber = new FlightModel(),
    fighter = new FlightModel(fighterFlight);
  const input = { ...neutralInput(), pitch: 0.5, roll: 0.5, throttle: 1 };
  for (let i = 0; i < 120; i++) {
    bomber.update(step, input, terrainHeight);
    fighter.update(step, input, terrainHeight);
  }
  assert.ok(fighter.pitch > bomber.pitch * 2);
  assert.ok(fighter.roll > bomber.roll * 2);
  assert.ok(fighter.speed > bomber.speed * 1.4);
  fighter.reset();
  bomber.reset();
  assert.equal(bomber.speed, 210);
  assert.equal(fighter.speed, 310);
});

test("fighter locks require time and a forward target; rejected launches conserve ammunition", () => {
  const flight = new FlightModel(fighterFlight),
    combat = new F35TrainingMission(flight, () => {});
  combat.action("KeyF");
  assert.equal(combat.weapons.missiles, 6);
  combat.action("Tab");
  combat.action("KeyF");
  assert.equal(combat.weapons.missiles, 6);
  advance(combat, 0.7);
  assert.equal(combat.targeting.valid(flight.position), true);
  combat.action("KeyF");
  assert.equal(combat.weapons.missiles, 5);
  flight.forward.set(0, 0, 1);
  combat.targeting.tick(step);
  assert.equal(combat.targeting.valid(flight.position), false);
  advance(combat, 8);
  assert.ok(
    combat.enemies.aircraft.some((t) => t.destroyed),
    "Guided missile intercepts an active fighter",
  );
  combat.dispose();
});

test("precision strikes destroy designated sites and restart clears all fighter resources", () => {
  const flight = new FlightModel(fighterFlight),
    combat = new F35TrainingMission(flight, () => {});
  combat.action("Space");
  assert.equal(combat.weapons.bombs, 4);
  combat.action("KeyG");
  combat.action("Space");
  advance(combat, 1);
  combat.action("KeyG");
  combat.action("Space");
  advance(combat, 12);
  assert.equal(combat.mission.radar, true);
  assert.equal(combat.mission.command, true);
  assert.equal(
    combat.mission.complete,
    false,
    "Ground targets alone do not complete fighter mission",
  );
  combat.setTrigger(true);
  advance(combat, 0.2);
  assert.ok(combat.weapons.cannonAmmo < 360);
  combat.reset();
  assert.equal(combat.weapons.cannonAmmo, 360);
  assert.equal(combat.weapons.bombs, 4);
  assert.equal(combat.weapons.missiles, 6);
  assert.equal(combat.weapons.tracerCount, 0);
  assert.equal(combat.weapons.projectiles.length, 0);
  assert.equal(combat.effects.count, 0);
  assert.equal(combat.weapons.cannonHeld, false);
  assert.equal(combat.weapons.groundTarget, null);
  assert.equal(combat.mission.score, 0);
  combat.dispose();
});

test("fighter AI chases, breaks away, and never respawns mission kills", () => {
  const flight = new FlightModel(fighterFlight),
    enemy = new FighterEnemy(0, flight);
  enemy.update(step);
  assert.equal(enemy.behavior, "CHASE");
  const first = enemy.position.clone();
  for (let i = 0; i < 14 / step; i++) enemy.update(step);
  assert.ok(enemy.position.distanceTo(first) > 100);
  assert.equal(enemy.behavior, "BREAK");
  enemy.takeDamage(100);
  for (let i = 0; i < 30 / step; i++) enemy.update(step);
  assert.equal(enemy.destroyed, true);
  assert.equal(enemy.root.visible, false);
  enemy.reset();
  assert.equal(enemy.destroyed, false);
  assert.equal(enemy.health, 100);
});
