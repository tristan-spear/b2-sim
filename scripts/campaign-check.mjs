import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
const browser = await chromium.launch({
  channel: "chrome",
  headless: true,
  args: ["--enable-webgl", "--ignore-gpu-blocklist"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
page.on("console", (message) => {
  if (message.type() === "error") errors.push(message.text());
});
try {
  await page.goto("http://localhost:5173", { waitUntil: "networkidle" });
  await page.locator("#start-mission").click();
  assert.equal(await page.locator("[data-mission]").count(), 5);
  assert.equal(await page.locator("[data-mission]:disabled").count(), 4);
  await page.locator('[data-mission="b2-01"]').click();
  assert.equal(await page.locator("[data-upgrade]").count(), 10);
  assert.ok(await page.locator("#launch-campaign").isVisible());
  await page.screenshot({ path: "/tmp/spirit-campaign-loadout.png" });
  await page.locator("#campaign-back").click();
  await page.screenshot({ path: "/tmp/spirit-campaign-missions.png" });
  await page.locator("#campaign-back").click();
  await page.locator('[data-aircraft="F35"]').click();
  await page.reload({ waitUntil: "networkidle" });
  assert.equal(
    await page.locator('[data-aircraft="F35"]').getAttribute("aria-pressed"),
    "true",
  );
  await page.locator("#start-mission").click();
  assert.equal(await page.locator("[data-mission]:disabled").count(), 4);
  if (process.argv.includes("--campaign-smoke")) {
    // Isolated browser fixture: expose all operations for visual/cleanup QA.
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
      save.data.credits = 15000;
      save.persist();
    });
    await page.reload({ waitUntil: "networkidle" });
    const snapshots = [];
    for (const aircraft of ["B2", "F35"])
      for (let n = 1; n <= 5; n++) {
        await page.locator(`[data-aircraft="${aircraft}"]`).click();
        await page.locator("#start-mission").click();
        await page
          .locator(`[data-mission="${aircraft.toLowerCase()}-0${n}"]`)
          .click();
        await page.locator("#launch-campaign").click();
        await page.waitForFunction(
          () => window.__flightDebug.state === "playing",
        );
        await page.waitForTimeout(1800);
        const d = await page.evaluate(() => window.__flightDebug);
        assert.equal(d.combat.campaign, `${aircraft.toLowerCase()}-0${n}`);
        assert.equal(d.combat.failed, false);
        assert.ok(await page.locator("#integrity-value").isVisible());
        await page.screenshot({
          path: `/tmp/spirit-${aircraft.toLowerCase()}-${n}.png`,
        });
        await page.keyboard.press("Escape");
        await page.locator("#pause-overlay .return-home").click();
        assert.equal(await page.locator(".hud").count(), 0);
        snapshots.push({
          mission: d.combat.campaign,
          environment: d.environment,
          targets: d.combat.targets.length,
          drawCalls: d.drawCalls,
        });
      }
    console.log(JSON.stringify({ campaignSmoke: snapshots }));
    await page.locator('[data-aircraft="F35"]').click();
    await page.locator("#start-mission").click();
  }
  if (process.argv.includes("--campaign-play"))
    await (await import("./campaign-play.mjs")).playCampaign(page);
  if (process.argv.includes("--campaign-lifecycle"))
    await (
      await import("./campaign-lifecycle.mjs")
    ).checkCampaignLifecycle(page);
  if (process.argv.includes("--campaign-boss"))
    await (await import("./campaign-boss.mjs")).playBoss(page);
  assert.deepEqual(errors, []);
  console.log(
    "Campaign menus: 5 missions per aircraft, unlock gates, loadout, saved aircraft selection, no runtime errors.",
  );
} finally {
  await browser.close();
}
