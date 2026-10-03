import assert from "node:assert/strict";

export async function checkCampaignLifecycle(page) {
  const state = () => page.evaluate(() => window.__flightDebug);
  // Isolated QA save; never alters a user's existing browser profile.
  await page.evaluate(async () => {
    const { save } = await import("/src/campaign/SaveManager.ts");
    for (const aircraft of ["b2", "f35"])
      for (let n = 1; n <= 5; n++)
        save.data.completed[`${aircraft}-0${n}`] = {
          score: 1000,
          time: 120,
          rank: "B",
          completions: 1,
        };
    save.persist();
  });
  await page.reload({ waitUntil: "networkidle" });
  const launch = async (id) => {
    await page
      .locator(`[data-aircraft="${id.startsWith("b2") ? "B2" : "F35"}"]`)
      .click();
    await page.locator("#start-mission").click();
    await page.locator(`[data-mission="${id}"]`).click();
    await page.locator("#launch-campaign").click();
    await page.waitForFunction(() => window.__flightDebug.state === "playing");
  };
  const home = async () => {
    await page.keyboard.press("Escape");
    await page.locator("#pause-overlay .return-home").click();
    await page.waitForTimeout(250);
    assert.equal(await page.locator(".hud").count(), 0);
    assert.equal((await state()).combat, undefined);
  };
  const memory = [];
  for (let cycle = 0; cycle < 6; cycle++) {
    // City allocates window textures, friendly targets, scenery and enemy waves.
    await launch("f35-03");
    await page.keyboard.press("Tab");
    await page.waitForTimeout(1400);
    await page.keyboard.press("f");
    await page.mouse.move(720, 470);
    await page.mouse.down();
    await page.waitForTimeout(350);
    await page.mouse.up();
    const d = await state();
    assert.ok(
      d.combat.missiles < 11,
      "Single missile action reaches current session",
    );
    assert.ok(d.combat.cannon < 360);
    assert.equal(await page.locator(".hud").count(), 1);
    await page.keyboard.press("h");
    await home();
    const menu = await state();
    memory.push([menu.geometries, menu.textures]);
  }
  assert.deepEqual(
    memory.at(-1),
    memory[0],
    "Mission-specific GPU resources are released between sorties",
  );

  await launch("f35-02");
  const credits = await page.evaluate(
    () => JSON.parse(localStorage.getItem("spirit-campaign-v1")).credits,
  );
  await page.keyboard.down("w");
  await page.waitForFunction(
    () => window.__flightDebug.combat.failed,
    undefined,
    { timeout: 20000 },
  );
  await page.keyboard.up("w");
  await page.locator("#campaign-failed").waitFor({ state: "visible" });
  assert.match(await page.locator("#failure-reason").textContent(), /Terrain/);
  assert.equal(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("spirit-campaign-v1")).credits,
    ),
    credits,
  );
  await page.screenshot({ path: "/tmp/spirit-campaign-failed.png" });
  await page.locator("#retry-campaign").click();
  await page.waitForFunction(() => !window.__flightDebug.combat.failed);
  assert.equal((await state()).combat.health, (await state()).combat.maxHealth);
  assert.equal((await state()).combat.missiles, 10);
  await home();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator("#start-mission").click();
  await page.screenshot({ path: "/tmp/spirit-campaign-mobile-missions.png" });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
  await page.locator('[data-mission="f35-01"]').click();
  await page.locator("#launch-campaign").scrollIntoViewIfNeeded();
  await page.screenshot({ path: "/tmp/spirit-campaign-mobile-loadout.png" });
  await page.locator("#launch-campaign").click();
  await page.waitForFunction(() => window.__flightDebug.state === "playing");
  await page.waitForTimeout(1000);
  await page.screenshot({ path: "/tmp/spirit-campaign-mobile-flight.png" });
  assert.ok(await page.locator("#integrity-value").isVisible());
  await home();
  console.log(
    JSON.stringify({
      campaignLifecycle:
        "Six city sorties, stable GPU resources, single HUD/controls, hidden-HUD pause, terrain failure/retry without rewards, responsive mission/loadout/flight",
      memory,
    }),
  );
}
