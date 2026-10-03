import assert from "node:assert/strict";

export async function playCampaign(page) {
  const state = () => page.evaluate(() => window.__flightDebug);
  const saved = () =>
    page.evaluate(() => JSON.parse(localStorage.getItem("spirit-campaign-v1")));
  const setKey = async (previous, next) => {
    if (previous !== next) {
      if (previous) await page.keyboard.up(previous);
      if (next) await page.keyboard.down(next);
    }
    return next;
  };
  await page.locator('[data-mission="f35-01"]').click();
  await page.locator("#launch-campaign").click();
  await page.waitForFunction(() => window.__flightDebug.state === "playing");
  await page.waitForTimeout(1500);
  await page.mouse.move(720, 490);
  await page.mouse.down();
  await page.waitForTimeout(1600);
  await page.mouse.up();
  assert.ok((await state()).combat.cannon < 360, "Cannon fires in campaign");
  let yawKey = null,
    pitchKey = null;
  const shotAt = new Map();
  const started = Date.now();
  while (
    (await state()).state !== "complete" &&
    Date.now() - started < 110000
  ) {
    const d = await state();
    assert.equal(d.combat.failed, false, d.combat.failure);
    const target = d.combat.targets.find(
      (t) => t.id === d.combat.selected && !t.destroyed,
    );
    if (!target) {
      await page.keyboard.press("Tab");
      await page.waitForTimeout(60);
      continue;
    }
    const [dx, dy, dz] = target.position.map(
      (value, i) => value - d.position[i],
    );
    const desired = (Math.atan2(dx, -dz) * 180) / Math.PI;
    const difference = ((desired - d.heading + 540) % 360) - 180;
    const pitch = Math.atan2(dy, Math.hypot(dx, dz));
    yawKey = await setKey(
      yawKey,
      Math.abs(difference) > 9 ? (difference > 0 ? "e" : "q") : null,
    );
    pitchKey = await setKey(
      pitchKey,
      Math.abs(pitch - d.pitch) > 0.1 ? (pitch > d.pitch ? "s" : "w") : null,
    );
    if (d.combat.locked && Date.now() - (shotAt.get(target.id) ?? 0) > 12000) {
      await page.keyboard.press("f");
      shotAt.set(target.id, Date.now());
    }
    await page.waitForTimeout(90);
  }
  if (yawKey) await page.keyboard.up(yawKey);
  if (pitchKey) await page.keyboard.up(pitchKey);
  let d = await state();
  assert.equal(d.state, "complete", JSON.stringify(d.combat));
  assert.equal(d.combat.result.air, 3);
  await page.locator("#mission-complete").waitFor({ state: "visible" });
  await page.waitForTimeout(200);
  assert.match(await page.locator("#result-rank").textContent(), /^[SABC]$/);
  const credits = (await saved()).credits;
  assert.ok(credits > 1000);
  await page.waitForTimeout(300);
  assert.equal((await saved()).credits, credits);
  await page.screenshot({ path: "/tmp/spirit-campaign-debrief.png" });
  await page.locator("#next-mission").click();
  assert.match(
    await page.locator(".sortie-brief h2").textContent(),
    /Canyon Run/,
  );
  assert.equal(await page.locator(".hud").count(), 0);
  await page.locator('[data-upgrade="armor"]').click();
  assert.equal((await saved()).upgrades.F35.armor, 2);
  assert.equal((await saved()).credits, credits - 700);
  await page.reload({ waitUntil: "networkidle" });
  assert.equal((await saved()).upgrades.F35.armor, 2);
  await page.locator("#start-mission").click();
  assert.equal(await page.locator('[data-mission="f35-02"]').isEnabled(), true);
  assert.equal(
    await page.locator('[data-mission="f35-03"]').isEnabled(),
    false,
  );
  await page.locator('[data-mission="f35-01"]').click();
  await page.locator("#launch-campaign").click();
  await page.waitForFunction(() => window.__flightDebug.state === "playing");
  assert.ok(
    (await state()).combat.maxHealth > 180,
    "Purchased armor affects the live aircraft",
  );
  await page.keyboard.press("Escape");
  await page.locator("#pause-overlay .return-home").click();
  await page.locator('[data-aircraft="B2"]').click();
  await page.locator("#start-mission").click();
  await page.locator('[data-mission="b2-01"]').click();
  await page.locator("#launch-campaign").click();
  await page.waitForFunction(() => window.__flightDebug.state === "playing");
  const released = new Set();
  const bomberStart = Date.now();
  while (
    (await state()).state !== "complete" &&
    Date.now() - bomberStart < 85000
  ) {
    d = await state();
    assert.equal(d.combat.failed, false, d.combat.failure);
    for (const target of d.combat.targets.filter((t) => t.id !== "AA SENTRY")) {
      if (
        !released.has(target.id) &&
        Math.abs(d.predictedImpact[2] - target.position[2]) < 65
      ) {
        await page.keyboard.press("Space");
        released.add(target.id);
      }
    }
    await page.waitForTimeout(60);
  }
  d = await state();
  assert.equal(d.state, "complete", JSON.stringify(d.combat));
  assert.equal(d.combat.result.ground, 4);
  assert.ok((await saved()).completed["b2-01"]);
  await page.locator("#mission-complete").waitFor({ state: "visible" });
  await page.screenshot({ path: "/tmp/spirit-desert-debrief.png" });
  await page.locator("#mission-complete .campaign-home").click();
  await page.locator("#start-mission").click();
  assert.equal(await page.locator('[data-mission="b2-02"]').isEnabled(), true);
  console.log(
    JSON.stringify({
      campaignPlay:
        "Real keyboard/mouse F-35 interception and B-2 bombing/extraction completed; rewards paid once; next mission, armor purchase, refresh persistence and live upgrade effect verified",
      bomber: d.combat.result,
      save: await saved(),
    }),
  );
}
