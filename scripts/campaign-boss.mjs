import assert from "node:assert/strict";

export async function playBoss(page) {
  await page.evaluate(async () => {
    const { save } = await import("/src/campaign/SaveManager.ts");
    for (let n = 1; n <= 4; n++)
      save.data.completed[`f35-0${n}`] = {
        score: 1000,
        time: 120,
        rank: "B",
        completions: 1,
      };
    save.persist();
  });
  await page.reload({ waitUntil: "networkidle" });
  await page.locator("#start-mission").click();
  await page.locator('[data-mission="f35-05"]').click();
  await page.locator("#launch-campaign").click();
  await page.waitForFunction(() => window.__flightDebug.state === "playing");
  const state = () => page.evaluate(() => window.__flightDebug);
  const held = { yaw: null, pitch: null, roll: null };
  const key = async (axis, next) => {
    if (held[axis] === next) return;
    if (held[axis]) await page.keyboard.up(held[axis]);
    if (next) await page.keyboard.down(next);
    held[axis] = next;
  };
  const shots = new Map(),
    phases = new Set();
  const start = Date.now();
  while (Date.now() - start < 300000) {
    const d = await state();
    assert.equal(d.combat.failed, false, JSON.stringify(d.combat));
    if (d.state === "complete") break;
    if (d.combat.boss.active) {
      if (!phases.has(d.combat.boss.phase))
        await page.screenshot({
          path: `/tmp/spirit-raven-phase-${d.combat.boss.phase}.png`,
        });
      phases.add(d.combat.boss.phase);
    }
    const target = d.combat.targets.find(
      (t) => t.id === d.combat.selected && !t.destroyed,
    );
    if (!target) {
      await page.keyboard.press("Tab");
      await page.waitForTimeout(80);
      continue;
    }
    const [dx, dy, dz] = target.position.map((v, i) => v - d.position[i]);
    const bearing = (Math.atan2(dx, -dz) * 180) / Math.PI;
    const delta = ((bearing - d.heading + 540) % 360) - 180;
    const pitch = Math.atan2(dy, Math.hypot(dx, dz));
    const bank = Math.abs(delta) > 35 ? -Math.sign(delta) * 1.1 : 0;
    await key(
      "roll",
      Math.abs(bank - d.roll) > 0.12 ? (bank > d.roll ? "a" : "d") : null,
    );
    await key("yaw", Math.abs(delta) > 7 ? (delta > 0 ? "e" : "q") : null);
    await key(
      "pitch",
      Math.abs(pitch - d.pitch) > 0.08 ? (pitch > d.pitch ? "s" : "w") : null,
    );
    const inFlight = d.combat.projectiles.some((p) => p.kind === "missile");
    if (
      d.combat.locked &&
      !inFlight &&
      Date.now() - (shots.get(target.id) ?? 0) > 1300
    ) {
      await page.keyboard.press("f");
      shots.set(target.id, Date.now());
    }
    await page.waitForTimeout(80);
  }
  await key("yaw", null);
  await key("pitch", null);
  await key("roll", null);
  const d = await state();
  assert.equal(d.state, "complete", JSON.stringify(d.combat));
  assert.deepEqual([...phases].sort(), [1, 2, 3]);
  assert.equal(d.combat.result.boss, true);
  await page.locator("#mission-complete").waitFor({ state: "visible" });
  await page.screenshot({ path: "/tmp/spirit-raven-complete.png" });
  console.log(
    JSON.stringify({
      ravenPlay:
        "Real keyboard missile duel, escorts, all three ace phases, cinematic finale and rewards",
      result: d.combat.result,
      remainingMissiles: d.combat.missiles,
    }),
  );
}
