import test from "node:test";
import assert from "node:assert/strict";
import { MissionManager, missions } from "../src/game/MissionManager";

test("mission registry supports additional levels and rejects incompatible launches", () => {
  const registry = new MissionManager();
  const first = missions.get("b2-training");
  const second = { ...first, id: "b2-test-level-2", title: "Second level" };
  registry.register(first);
  registry.register(second);
  registry.register(missions.get("f35-training"));
  assert.deepEqual(
    registry.forAircraft("B2").map((m) => m.id),
    [first.id, second.id],
  );
  assert.equal(registry.resolve(second.id, "B2"), second);
  assert.throws(() => registry.resolve(second.id, "F35"), /not available/);
  assert.throws(() => registry.resolve("missing", "B2"), /Unknown mission/);
  assert.throws(() => registry.register(second), /Duplicate mission/);
  assert.equal(registry.forAircraft("F35").length, 1);
});
