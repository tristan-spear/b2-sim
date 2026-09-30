import test from "node:test";
import assert from "node:assert/strict";
import {
  FlightModel,
  neutralInput,
  type FlightInput,
} from "../src/physics/FlightModel";
import { terrainHeight } from "../src/utils/noise";

const flat = () => 0;
function simulate(
  flight: FlightModel,
  seconds: number,
  input: Partial<FlightInput> = {},
  step = 1 / 120,
) {
  const controls = { ...neutralInput(), ...input };
  for (let i = 0; i < Math.round(seconds / step); i++)
    flight.update(step, controls, flat);
}

test("cruise moves forward and maintains altitude without input", () => {
  const f = new FlightModel();
  simulate(f, 30);
  assert.ok(f.position.z < -2000);
  assert.equal(f.altitude, 2400);
  assert.ok(f.speed > 200 && f.speed < 220);
  assert.equal(f.crashed, false);
});
test("throttle responds gradually, is bounded, and controls speed", () => {
  const f = new FlightModel();
  simulate(f, 1, { throttle: 1 });
  assert.ok(f.throttle > 0.79 && f.throttle < 0.81);
  assert.ok(f.speed < 220);
  simulate(f, 40, { throttle: 1 });
  assert.equal(f.throttle, 1);
  assert.ok(f.speed > 280);
  simulate(f, 30, { throttle: -1 });
  assert.equal(f.throttle, 0);
  assert.ok(f.speed < 100);
  assert.ok(f.verticalSpeed < 0);
});
test("banking turns with inertia, and release gradually levels the wing", () => {
  const f = new FlightModel();
  simulate(f, 1, { roll: -1 });
  assert.ok(f.roll < -0.35);
  assert.ok(f.heading > 0 && f.heading < 5);
  simulate(f, 2, { roll: -1 });
  assert.ok(f.heading > 5);
  assert.ok(f.roll >= -1.18);
  const bank = f.roll;
  simulate(f, 0.1);
  assert.ok(Math.abs(f.roll - bank) < 0.1);
  simulate(f, 20);
  assert.ok(Math.abs(f.roll) < 0.1);
});
test("pitch input climbs and descends with limited rates", () => {
  const up = new FlightModel();
  simulate(up, 2, { pitch: 1 });
  assert.ok(up.altitude > 2430);
  assert.ok(up.pitch < 0.62);
  assert.ok(up.verticalSpeed > 40);
  const down = new FlightModel();
  simulate(down, 2, { pitch: -1 });
  assert.ok(down.altitude < 2370);
  assert.ok(down.verticalSpeed < -40);
});
test("rudder changes heading in the requested direction", () => {
  const f = new FlightModel();
  simulate(f, 3, { yaw: 1 });
  assert.ok(f.heading > 340 && f.heading < 360);
  assert.equal(f.roll, 0);
});
test("low speed loses lift and sustained throttle restores it", () => {
  const f = new FlightModel();
  f.speed = 80;
  f.throttle = 0;
  simulate(f, 5);
  assert.ok(f.stalled);
  assert.ok(f.altitude < 2300);
  simulate(f, 25, { throttle: 1 });
  assert.equal(f.stalled, false);
  assert.ok(f.speed > 260);
});
test("collision ends flight and reset restores all state", () => {
  const f = new FlightModel();
  f.position.y = 111;
  f.update(1 / 120, neutralInput(), () => 200);
  assert.equal(f.crashed, true);
  const pos = f.position.clone();
  simulate(f, 1, { pitch: 1 });
  assert.ok(f.position.equals(pos));
  f.reset();
  assert.equal(f.crashed, false);
  assert.equal(f.altitude, 2400);
  assert.equal(f.elapsed, 0);
  assert.equal(f.roll, 0);
  assert.equal(f.throttle, 0.64);
});
test("simulation is consistent across supported integration steps", () => {
  const a = new FlightModel(),
    b = new FlightModel();
  simulate(a, 10, { roll: 0.2, pitch: 0.1 }, 1 / 120);
  simulate(b, 10, { roll: 0.2, pitch: 0.1 }, 1 / 60);
  assert.ok(a.position.distanceTo(b.position) < 4);
  assert.ok(Math.abs(a.heading - b.heading) < 0.1);
});
test("terrain is deterministic, continuous, and initial flight clears it", () => {
  for (let x = -20000; x <= 20000; x += 1200)
    for (let z = -20000; z <= 20000; z += 1400) {
      const h = terrainHeight(x, z);
      assert.ok(Number.isFinite(h) && h > 0 && h < 2400);
      assert.equal(h, terrainHeight(x, z));
      assert.ok(Math.abs(h - terrainHeight(x + 0.001, z)) < 0.01);
    }
  assert.ok(2400 - terrainHeight(600, 4200) > 500);
});
test("long flight stays finite with bounded attitude and nonzero forward speed", () => {
  const f = new FlightModel();
  f.position.y = 8000;
  for (let i = 0; i < 120 * 300; i++) {
    f.update(
      1 / 120,
      {
        pitch: Math.sin(i * 0.001) * 0.04,
        roll: Math.sin(i * 0.002) * 0.3,
        yaw: 0,
        throttle: 0,
      },
      flat,
    );
    assert.ok(Number.isFinite(f.position.lengthSq()));
    assert.ok(f.speed > 50);
    assert.ok(Math.abs(f.roll) <= 1.18);
  }
  assert.equal(f.crashed, false);
});
