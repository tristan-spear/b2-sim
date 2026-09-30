import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
const browser = await chromium.launch({
  channel: "chrome",
  headless: true,
  args: ["--enable-webgl", "--ignore-gpu-blocklist"],
});
const page = await browser.newPage({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
});
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
page.on("console", (message) => {
  if (message.type() === "error") errors.push(message.text());
});
const state = () => page.evaluate(() => window.__flightDebug);
const hold = async (key, ms) => {
  await page.keyboard.down(key);
  await page.waitForTimeout(ms);
  await page.keyboard.up(key);
};
try {
  await page.goto("http://localhost:5173/", { waitUntil: "networkidle" });
  await page.waitForFunction(() => window.__flightDebug !== undefined);
  await page.waitForTimeout(1500);
  assert.equal((await state()).crashed, false);
  await page.screenshot({ path: "/tmp/spirit-initial.png" });
  if (process.argv.includes("--render-only")) {
    assert.deepEqual(errors, []);
    console.log(
      JSON.stringify({
        passed: "Final WebGL render",
        state: await state(),
        errors,
      }),
    );
    const touchPage = await browser.newPage({
      viewport: { width: 390, height: 844 },
      hasTouch: true,
      isMobile: true,
    });
    await touchPage.goto("http://localhost:5173/", {
      waitUntil: "networkidle",
    });
    await touchPage.waitForFunction(() => window.__flightDebug !== undefined);
    const throttle = touchPage.locator('[data-key="ShiftLeft"]');
    const box = await throttle.boundingBox();
    assert.ok(box);
    await touchPage.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await touchPage.mouse.down();
    await touchPage.waitForTimeout(1200);
    await touchPage.mouse.up();
    assert.ok(
      await touchPage.evaluate(() => window.__flightDebug.throttle > 0.75),
    );
    assert.ok(await touchPage.locator("#throttle").isVisible());
    await touchPage.screenshot({ path: "/tmp/spirit-touch.png" });
    console.log("Touch throttle and narrow-screen HUD passed.");
  } else {
    const cruise = await state();
    await hold("d", 1200);
    const bank = await state();
    assert.ok(bank.roll < -0.2);
    assert.ok(bank.heading > 0);
    await page.screenshot({ path: "/tmp/spirit-bank.png" });
    await page.keyboard.press("r");
    await hold("s", 1100);
    const climb = await state();
    assert.ok(climb.pitch > 0.1);
    assert.ok(climb.altitude > 2400);
    await page.keyboard.press("r");
    await hold("w", 1100);
    assert.ok((await state()).altitude < 2400);
    await page.keyboard.press("r");
    await hold("a", 900);
    assert.ok((await state()).roll > 0.15);
    await page.keyboard.press("r");
    await hold("q", 1100);
    assert.ok((await state()).heading > 350);
    await page.keyboard.press("r");
    await hold("e", 1100);
    assert.ok((await state()).heading > 0 && (await state()).heading < 10);
    await page.keyboard.press("r");
    await hold("Shift", 1100);
    assert.ok((await state()).throttle > 0.75);
    await hold("Control", 1600);
    assert.ok((await state()).throttle < 0.65);
    await page.keyboard.press("r");
    for (let mode = 1; mode < 4; mode++) {
      await page.keyboard.press("c");
      await page.waitForTimeout(1600);
      assert.equal((await state()).camera, mode);
      await page.screenshot({ path: `/tmp/spirit-camera-${mode}.png` });
    }
    await page.mouse.move(700, 400);
    await page.mouse.down();
    await page.mouse.move(940, 480, { steps: 12 });
    await page.mouse.up();
    await page.mouse.wheel(0, -180);
    await page.waitForTimeout(500);
    await page.locator('[data-camera="0"]').click();
    assert.equal((await state()).camera, 0);
    await page.keyboard.press("p");
    const paused = await state();
    assert.equal(paused.paused, true);
    await page.waitForTimeout(500);
    assert.deepEqual((await state()).position, paused.position);
    await page.locator("#resume").click();
    assert.equal((await state()).paused, false);
    await page.locator("#help").click();
    assert.equal(
      await page.locator("#help-dialog").evaluate((el) => el.open),
      true,
    );
    await page.locator("#quality").selectOption("low");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(100);
    assert.equal(
      await page.locator("#help-dialog").evaluate((el) => el.open),
      false,
    );
    await page.keyboard.press("h");
    assert.ok(
      await page
        .locator(".hud")
        .evaluate((el) => el.classList.contains("hud-hidden")),
    );
    await page.locator("#show-hud").click();
    await page.locator("#sound").click();
    await page.waitForTimeout(150);
    assert.equal(
      await page.locator("#sound").getAttribute("aria-pressed"),
      "true",
    );
    await page.keyboard.press("m");
    await page.waitForTimeout(150);
    assert.equal(
      await page.locator("#sound").getAttribute("aria-pressed"),
      "false",
    );
    await page.keyboard.press("r");
    await hold("w", 2000);
    await page.keyboard.down("w");
    await page.waitForFunction(
      () => window.__flightDebug.crashed,
      {},
      { timeout: 40000 },
    );
    await page.keyboard.up("w");
    assert.equal(
      await page.locator("#pause-title").textContent(),
      "Meet the sky again.",
    );
    await page.locator("#reset").click();
    assert.equal((await state()).crashed, false);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(700);
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
    );
    await page.screenshot({ path: "/tmp/spirit-mobile.png" });
    assert.deepEqual(errors, []);
    console.log(
      JSON.stringify({
        passed:
          "Rendering, all flight keys, all cameras, orbit drag/zoom, pause, reset, help/escape, quality, HUD, sound, collision, responsive width",
        cruise,
        bank,
        climb,
        errors,
      }),
    );
  }
} finally {
  await browser.close();
}
