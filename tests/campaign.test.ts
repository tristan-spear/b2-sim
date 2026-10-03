import test from "node:test";
import assert from "node:assert/strict";
import { Vector3 } from "three";
import { SaveManager, SAVE_KEY } from "../src/campaign/SaveManager";
import { UpgradeManager } from "../src/campaign/UpgradeManager";
import { campaign } from "../src/campaign/catalog";
import { CampaignCombat } from "../src/campaign/CampaignCombat";
import { aircraftConfigs } from "../src/aircraft/AircraftConfig";
import { FlightModel } from "../src/physics/FlightModel";
import { setTerrainPreset, terrainHeight } from "../src/utils/noise";
import { ObjectiveSystem } from "../src/campaign/ObjectiveSystem";
import { PlayerHealth } from "../src/campaign/PlayerHealth";
import { GroundTarget } from "../src/world/GroundTarget";
import { disposeTree } from "../src/game/dispose";

const memory = () => {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
  };
};
const dt = 1 / 120;
function scenario(id: string) {
  const config = campaign.find((c) => c.id === id)!;
  setTerrainPreset(config.environment.terrain);
  const flight = new FlightModel(
    aircraftConfigs[config.aircraft].flight,
    config.spawn,
  );
  const combat = new CampaignCombat(flight, () => {}, config);
  return {
    config,
    flight,
    combat,
    tick: (seconds: number) => {
      for (let t = 0; t < seconds; t += dt) combat.update(dt);
    },
    dispose: () => {
      combat.dispose();
      disposeTree(combat.root);
      setTerrainPreset("legacy");
    },
  };
}

test("save repairs missing and malformed fields, preserves best records, and pays a run once", () => {
  const storage = memory(),
    save = new SaveManager(storage);
  assert.equal(save.unlocked("b2-01"), false);
  const s = scenario("b2-01");
  s.combat.mission.time = 100;
  const result = s.combat.mission.result({
    shots: 4,
    hits: 4,
    damage: 0,
    maxHealth: 300,
    boss: false,
    cannonHits: 0,
  });
  assert.equal(save.award(result), true);
  assert.equal(save.award(result), false);
  assert.equal(save.data.credits, result.credits);
  assert.equal(new SaveManager(storage).unlocked("b2-01"), true);
  save.award({ ...result, runId: "replay", score: 10, time: 200, rank: "C" });
  assert.equal(save.data.completed["b2-01"].time, 100);
  assert.notEqual(save.data.completed["b2-01"].rank, "C");
  const damaged = SaveManager.parse(
    '{"saveVersion":1,"credits":-12,"upgrades":{"B2":{"armor":999}},"completed":{"b2-01":{}}}',
  );
  assert.equal(damaged.credits, 0);
  assert.equal(damaged.upgrades.B2.armor, 5);
  assert.equal(damaged.completed["b2-01"].rank, "C");
  assert.equal(SaveManager.parse("not json").credits, 0);
  assert.equal(
    SaveManager.parse('{"saveVersion":99,"credits":999}').credits,
    0,
  );
  assert.ok(storage.getItem(SAVE_KEY));
  s.dispose();
});

test("upgrades spend credits, enforce aircraft and tier gates, persist and alter real tuning", () => {
  const storage = memory(),
    save = new SaveManager(storage),
    upgrades = new UpgradeManager(save);
  assert.equal(upgrades.purchase("B2", "armor"), false);
  save.data.credits = 10000;
  const initial = upgrades.profile(aircraftConfigs.B2, 12, 6);
  assert.equal(upgrades.purchase("B2", "armor"), true);
  assert.equal(
    upgrades.purchase("B2", "armor"),
    false,
    "Tier III requires mission completion",
  );
  assert.equal(upgrades.purchase("B2", "missiles"), false);
  for (const id of [
    "engine",
    "handling",
    "damage",
    "capacity",
    "cooldown",
    "blast",
  ])
    assert.equal(upgrades.purchase("B2", id), true);
  const tuned = upgrades.profile(aircraftConfigs.B2, 12, 6);
  assert.ok(
    tuned.health > initial.health && tuned.resistance > initial.resistance,
  );
  assert.ok(
    tuned.flight.acceleration > initial.flight.acceleration &&
      tuned.flight.rollRate > initial.flight.rollRate,
  );
  assert.equal(tuned.weapons.bombs, 13);
  assert.ok(
    tuned.weapons.damage > 1 &&
      tuned.weapons.cooldown < 1 &&
      tuned.weapons.blastRadius > 190,
  );
  assert.equal(
    new UpgradeManager(new SaveManager(storage)).level("B2", "armor"),
    2,
  );
});

test("all ten campaign definitions construct with matching environments and safe spawn clearance", () => {
  assert.equal(campaign.length, 10);
  assert.equal(new Set(campaign.map((c) => c.id)).size, 10);
  for (const config of campaign) {
    const s = scenario(config.id);
    assert.ok(
      s.flight.altitude >
        terrainHeight(s.flight.position.x, s.flight.position.z) + 200,
      config.id,
    );
    assert.equal(s.combat.weapons.bombs, config.bombs);
    assert.equal(
      s.combat.mission.objectives.entries.length,
      config.objectives.length,
    );
    s.tick(0.2);
    assert.equal(s.combat.failed, false, config.id);
    assert.equal(s.combat.mission.complete, false, config.id);
    assert.ok(s.combat.compound.targets.every((t) => t.position.y >= 114));
    s.dispose();
  }
});

test("objective dependencies, checkpoints, escape and protected sites behave independently", () => {
  const objectives = new ObjectiveSystem([
    { id: "air", type: "DESTROY_AIRCRAFT", count: 2, label: "Air" },
    {
      id: "gates",
      type: "CHECKPOINTS",
      locations: [
        [0, 500, 0],
        [0, 500, -1000],
      ],
      radius: 100,
      label: "Gates",
      after: ["air"],
    },
    {
      id: "escape",
      type: "ESCAPE_AREA",
      locations: [[0, 500, 0]],
      radius: 2000,
      label: "Exit",
      after: ["gates"],
    },
  ]);
  const context = {
    time: 0,
    position: new Vector3(0, 500, 0),
    targets: [],
    airKills: 0,
    bossDefeated: false,
    friendly: [],
  };
  objectives.update(context);
  assert.equal(objectives.entries[1].progress, 0);
  context.airKills = 2;
  objectives.update(context);
  assert.equal(objectives.entries[1].progress, 1);
  context.position.z = -1000;
  objectives.update(context);
  assert.equal(objectives.complete, false);
  context.position.z = -2100;
  objectives.update(context);
  assert.equal(objectives.complete, true);
  const site = new GroundTarget(
    "SAFE",
    "command",
    new Vector3(),
    new Vector3(10, 10, 10),
  );
  const defense = new ObjectiveSystem([
    {
      id: "defend",
      type: "DEFEND",
      targets: ["SAFE"],
      label: "Defend",
      after: ["unmet"],
    },
  ]);
  site.takeDamage(999);
  defense.update({ ...context, friendly: [site] });
  assert.equal(defense.failed, true);
  disposeTree(site.root);
});

test("armor mitigates visible projectile damage and destroyed player fails the mission", () => {
  const health = new PlayerHealth(300, 0.2);
  health.hit(100, new Vector3(1, 2, 3));
  assert.equal(health.health, 220);
  assert.equal(health.damageTaken, 80);
  assert.ok(health.flash > 0);
  const s = scenario("b2-02");
  s.tick(8);
  assert.ok(
    s.combat.hostileFire.shots.length > 0,
    "Defenses fire visible projectiles",
  );
  s.combat.player.hit(99999, s.flight.position);
  s.tick(0.1);
  assert.equal(s.combat.failed, true);
  s.combat.reset();
  assert.equal(s.combat.failed, false);
  assert.equal(s.combat.player.health, s.combat.player.max);
  assert.equal(s.combat.hostileFire.shots.length, 0);
  s.dispose();
});

test("Iron Shield exposes component phases and requires multiple real bomb hits on the core", () => {
  const s = scenario("b2-05"),
    c = s.combat;
  const core = c.compound.targets.at(-1)!;
  core.takeDamage(9999);
  assert.equal(
    core.health,
    core.maxHealth,
    "Core shield blocks premature damage",
  );
  for (const phase of [1, 2, 3]) {
    assert.equal(c.boss.phase, phase);
    for (const target of c.compound.targets.filter(
      (t) => t.definition.phase === phase,
    )) {
      let attempts = 0;
      while (!target.destroyed && attempts++ < 5) {
        c.player.reset(); // Each controlled bombing pass starts with a fresh airframe.
        // Drop a real ballistic weapon just above the roof; collision, damage and phases run normally.
        s.flight.position.copy(target.bounds.getCenter(new Vector3()));
        s.flight.position.y = target.bounds.max.y + 55;
        s.flight.velocity.set(0, 0, 0);
        s.flight.orientation.identity();
        c.action("Space");
        s.tick(3.5);
      }
      assert.equal(
        target.destroyed,
        true,
        JSON.stringify({
          target: target.id,
          health: target.health,
          failed: c.mission.failure,
          bombs: c.weapons.bombs,
        }),
      );
    }
  }
  s.tick(4.1);
  assert.equal(c.boss.defeated, true);
  assert.equal(c.mission.complete, true);
  assert.ok(c.result!.credits > 4000);
  assert.ok(
    c.fighters.some((a) => a.active),
    "Fortress calls reinforcements",
  );
  s.dispose();
});

test("Raven activates after escorts, changes flight/attack phase with damage and completes its finale", () => {
  const s = scenario("f35-05"),
    c = s.combat,
    ace = c.fighters.at(-1)!;
  assert.equal(ace.active, false);
  c.fighters
    .filter((a) => a.definition.role !== "boss")
    .forEach((a) => a.takeDamage(100));
  s.tick(0.2);
  assert.equal(ace.active, true);
  assert.equal(c.boss.phase, 1);
  ace.takeDamage(250);
  s.tick(0.1);
  assert.equal(c.boss.phase, 2);
  assert.equal(ace.bossPhase, 2);
  ace.takeDamage(220);
  s.tick(0.1);
  assert.equal(c.boss.phase, 3);
  ace.takeDamage(300);
  s.tick(4.5);
  assert.equal(c.mission.complete, true);
  assert.equal(c.result!.boss, true);
  c.reset();
  assert.equal(ace.active, false);
  assert.equal(c.boss.defeated, false);
  assert.equal(c.result, undefined);
  s.dispose();
});

test("fighter guided strikes, locks and afterburner remain connected to campaign loadouts", () => {
  const s = scenario("f35-04");
  const c = s.combat;
  c.action("KeyB");
  assert.ok(c.boostTime > 0);
  s.tick(0.1);
  assert.ok(s.flight.boost > 1);
  c.action("KeyG");
  c.action("Space");
  s.tick(1);
  c.action("KeyG");
  c.action("Space");
  s.tick(16);
  assert.ok(
    c.compound.targets
      .filter((t) => ["ISLAND RADAR", "MISSILE INSTALLATION"].includes(t.id))
      .every((t) => t.destroyed),
    JSON.stringify({
      failure: c.mission.failure,
      targets: c.diagnostics.targets,
      bombs: c.weapons.bombs,
    }),
  );
  assert.equal(c.mission.complete, false);
  c.reset();
  assert.equal(c.weapons.shots, 0);
  assert.equal(c.boostTime, 0);
  s.dispose();
});

test("all ten objective sequences can finish, pay a result, and reset for replay", () => {
  // Controlled encounter integration, separate from the real-input browser sorties.
  for (const config of campaign) {
    const s = scenario(config.id),
      c = s.combat;
    for (let pass = 0; pass < 90 && !c.mission.complete; pass++) {
      c.player.reset();
      c.fighters
        .filter((a) => a.active && !a.destroyed)
        .forEach((a) => a.takeDamage(a.maxHealth));
      c.compound.targets
        .filter((t) => t.vulnerable && !t.destroyed)
        .forEach((t) => t.takeDamage(t.maxHealth));
      const waypoint = c.mission.objectives.entries.find(
        (o) => o.active && !o.complete && o.config.locations,
      );
      if (waypoint)
        s.flight.position.set(
          ...waypoint.config.locations![
            Math.min(waypoint.progress, waypoint.config.locations!.length - 1)
          ],
        );
      s.tick(1);
      assert.equal(c.failed, false, `${config.id}: ${c.mission.failure}`);
    }
    assert.equal(c.mission.complete, true, config.id);
    assert.equal(c.result?.missionId, config.id);
    assert.ok(c.result!.credits >= config.reward);
    c.reset();
    assert.equal(c.mission.complete, false);
    assert.equal(
      c.mission.objectives.entries.every((o) => !o.complete),
      true,
    );
    assert.equal(c.hostileFire.shots.length, 0);
    s.dispose();
  }
});

test("convoy moves, protected-site loss fails City Defense, and blocked storage keeps session progress", () => {
  const coast = scenario("b2-04");
  const convoy = coast.combat.compound.targets.find(
    (t) => t.definition.moving,
  )!;
  const initial = convoy.position.clone(),
    bounds = convoy.bounds.clone();
  coast.tick(1);
  assert.ok(convoy.position.distanceTo(initial) > 10);
  assert.notDeepEqual(convoy.bounds.min.toArray(), bounds.min.toArray());
  coast.combat.reset();
  assert.deepEqual(convoy.position.toArray(), initial.toArray());
  coast.dispose();
  const city = scenario("f35-03");
  city.combat.friendly[2].takeDamage(999);
  city.tick(0.1);
  assert.equal(city.combat.failed, true);
  assert.match(city.combat.mission.failure, /district/);
  city.dispose();
  const save = new SaveManager({
    getItem: () => null,
    setItem: () => {
      throw new Error("Blocked");
    },
    removeItem: () => {},
  });
  save.data.credits = 2000;
  const upgrades = new UpgradeManager(save);
  assert.equal(upgrades.purchase("F35", "armor"), true);
  assert.match(save.warning, /session/);
  assert.equal(upgrades.level("F35", "armor"), 2);
});

test("City Defense strike waves threaten all three districts with visible projectile hits", () => {
  const s = scenario("f35-03");
  s.combat.fighters
    .filter((enemy) => enemy.definition.wave === 0)
    .forEach((enemy) => enemy.takeDamage(9999));
  s.tick(0.1);
  const secondWave = s.combat.fighters.filter(
    (enemy) => enemy.definition.wave === 1,
  );
  assert.deepEqual(
    secondWave.map((enemy) => enemy.strikeTarget?.id),
    ["HOSPITAL", "POWER GRID"],
  );
  for (
    let time = 0;
    time < 50 &&
    s.combat.friendly
      .slice(0, 2)
      .some((site) => site.health === site.maxHealth);
    time += dt
  ) {
    s.combat.player.reset();
    s.combat.update(dt);
  }
  assert.ok(
    s.combat.friendly.slice(0, 2).every((site) => site.health < site.maxHealth),
    "Both strike aircraft land actual projectile hits",
  );
  secondWave.forEach((enemy) => enemy.takeDamage(9999));
  s.tick(0.1);
  const finalStrike = s.combat.fighters.find(
    (enemy) =>
      enemy.definition.wave === 2 && enemy.definition.role === "strike",
  )!;
  assert.equal(finalStrike.active, true);
  assert.equal(finalStrike.strikeTarget?.id, "EVACUATION");
  for (
    let time = 0;
    time < 50 && s.combat.friendly[2].health === s.combat.friendly[2].maxHealth;
    time += dt
  ) {
    s.combat.player.reset();
    s.combat.update(dt);
  }
  assert.ok(s.combat.friendly[2].health < s.combat.friendly[2].maxHealth);
  s.dispose();
});
