import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
if (process.argv.includes("--campaign")) {
  await import("./campaign-check.mjs");
  process.exit(0);
}
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
  await page.goto("http://localhost:5173/?training=1", { waitUntil: "networkidle" });
  await page.waitForFunction(() => window.__flightDebug !== undefined);
  assert.equal((await state()).state, "home");
  await page.screenshot({ path: "/tmp/spirit-menu.png" });
  if (process.argv.includes("--fighter"))
    await page.locator('[data-aircraft="F35"]').click();
  await page.locator("#start-mission").click();
  await page.waitForFunction(() => window.__flightDebug.state === "playing");
  await page.waitForTimeout(1500);
  assert.equal((await state()).crashed, false);
  await page.screenshot({ path: "/tmp/spirit-initial.png" });
  if (process.argv.includes("--fighter")) {
    assert.equal((await state()).aircraft, "F35");
    assert.equal((await state()).combat.targets.length, 6);
    await hold("d", 700);
    assert.ok((await state()).roll < -0.7, "Fighter banks rapidly");
    await page.keyboard.press("r");
    await hold("s", 700);
    assert.ok((await state()).pitch > 0.35, "Fighter pitches rapidly");
    await page.keyboard.press("r");
    await hold("Shift", 1000);
    assert.ok((await state()).speed > 330, "Fighter accelerates");
    await page.keyboard.press("r");
    await page.keyboard.press("Escape");
    const frozen = await state();
    await page.keyboard.press("f");
    await page.keyboard.press("w");
    await page.waitForTimeout(200);
    assert.deepEqual((await state()).position, frozen.position);
    assert.deepEqual((await state()).cameraPosition, frozen.cameraPosition);
    assert.equal((await state()).combat.missiles, 6);
    await page.locator("#resume").click();
    await page.keyboard.press("f");
    assert.equal(
      (await state()).combat.missiles,
      6,
      "No missile expended without lock",
    );
    await page.keyboard.press("r");
    await page.mouse.move(700, 480);
    await page.mouse.down();
    await page.waitForTimeout(1400);
    await page.mouse.up();
    const cannon = await state();
    assert.ok(cannon.combat.cannon < 360);
    assert.ok(
      cannon.combat.targets.some(
        (t) => t.id.startsWith("BANDIT") && t.health < 100,
      ),
      "Cannon damages moving enemy",
    );
    await page.keyboard.press("g");
    await page.keyboard.press("Space");
    await page.waitForTimeout(1000);
    await page.keyboard.press("g");
    await page.keyboard.press("Space");
    assert.equal((await state()).combat.bombs, 2);
    const started = Date.now();
    let currentTarget = null;
    let lastShot = 0;
    let yawKey = null;
    let pitchKey = null;
    const setKey = async (previous, next) => {
      if (previous !== next) {
        if (previous) await page.keyboard.up(previous);
        if (next) await page.keyboard.down(next);
      }
      return next;
    };
    while (
      !(await state()).combat.mission.complete &&
      Date.now() - started < 100000
    ) {
      const d = await state();
      assert.equal(d.crashed, false);
      const alive = d.combat.targets.filter(
        (t) => t.id.startsWith("BANDIT") && !t.destroyed,
      );
      if (!alive.length) {
        yawKey = await setKey(yawKey, null);
        pitchKey = await setKey(pitchKey, null);
        await page.waitForTimeout(100);
        continue;
      }
      if (
        !d.combat.selected ||
        !alive.some((t) => t.id === d.combat.selected)
      ) {
        await page.keyboard.press("Tab");
        await page.waitForTimeout(50);
        continue;
      }
      const target = alive.find((t) => t.id === d.combat.selected);
      const [dx, dy, dz] = target.position.map((v, i) => v - d.position[i]);
      const desiredHeading = (Math.atan2(dx, -dz) * 180) / Math.PI;
      const difference = ((desiredHeading - d.heading + 540) % 360) - 180;
      const desiredPitch = Math.atan2(dy, Math.hypot(dx, dz));
      yawKey = await setKey(
        yawKey,
        Math.abs(difference) > 9 ? (difference > 0 ? "e" : "q") : null,
      );
      pitchKey = await setKey(
        pitchKey,
        Math.abs(desiredPitch - d.pitch) > 0.1
          ? desiredPitch > d.pitch
            ? "s"
            : "w"
          : null,
      );
      if (
        d.combat.locked &&
        (currentTarget !== target.id || Date.now() - lastShot > 17000)
      ) {
        await page.keyboard.press("f");
        currentTarget = target.id;
        lastShot = Date.now();
      }
      await page.waitForTimeout(90);
    }
    if (yawKey) await page.keyboard.up(yawKey);
    if (pitchKey) await page.keyboard.up(pitchKey);
    const completed = await state();
    console.log(
      JSON.stringify({
        fighterResult: completed,
        cannonDamage: cannon.combat.targets.map((t) => [t.id, t.health]),
      }),
    );
    assert.equal(completed.combat.mission.aircraft, 4);
    assert.equal(completed.combat.mission.radar, true);
    assert.equal(completed.combat.mission.command, true);
    assert.equal(completed.combat.mission.complete, true);
    await page.locator("#mission-complete").waitFor({ state: "visible" });
    await page.screenshot({ path: "/tmp/spirit-fighter-complete.png" });
    await page.locator("#mission-complete .return-home").click();
    assert.equal((await state()).state, "home");
    await page.locator('[data-aircraft="B2"]').click();
    await page.locator("#start-mission").click();
    await page.waitForFunction(() => window.__flightDebug.state === "playing");
    assert.equal((await state()).aircraft, "B2");
    assert.equal((await state()).combat.bombs, 8);
    assert.equal((await state()).combat.targets.length, 11);
    await page.keyboard.press("Tab");
    await page.keyboard.press("f");
    assert.equal(
      (await state()).combat.missiles,
      5,
      "No duplicate controls after switching",
    );
    await page.keyboard.press("Escape");
    await page.locator("#pause-overlay .return-home").click();
    await page.locator('[data-aircraft="F35"]').click();
    await page.locator("#start-mission").click();
    await page.waitForFunction(() => window.__flightDebug.state === "playing");
    assert.equal((await state()).combat.cannon, 360);
    assert.equal((await state()).combat.score, 0);
    assert.equal((await state()).combat.projectiles.length, 0);
    await page.screenshot({ path: "/tmp/spirit-fighter.png" });
    assert.deepEqual(errors, []);
    console.log(
      "Fighter handling, cannon hits, locks, missile kills, both precision strikes, full mission, menu switching and clean restart passed.",
    );
  } else if (process.argv.includes("--lifecycle")) {
    await page.keyboard.press("Escape");
    await page.locator("#pause-overlay .return-home").click();
    const memory = [];
    for (let i = 0; i < 6; i++) {
      await page.locator('[data-aircraft="F35"]').click();
      await page.locator("#start-mission").click();
      await page.waitForFunction(
        () => window.__flightDebug.state === "playing",
      );
      await page.keyboard.press("Tab");
      await page.waitForTimeout(700);
      await page.keyboard.press("f");
      assert.equal((await state()).combat.missiles, 5);
      await page.keyboard.press("g");
      await page.keyboard.press("Space");
      await page.mouse.move(700, 450);
      await page.mouse.down();
      await page.waitForTimeout(150);
      await page.mouse.up();
      await page.keyboard.press("h");
      await page.keyboard.press("Escape");
      assert.ok(await page.locator("#pause-overlay").isVisible());
      await page.locator("#pause-overlay .return-home").click();
      await page.waitForTimeout(150);
      const d = await state();
      memory.push([d.geometries, d.textures]);
      assert.equal(await page.locator(".hud").count(), 0);
      assert.equal(d.combat, undefined);
    }
    assert.deepEqual(
      memory.at(-1),
      memory[0],
      "GPU resources stay stable after repeated missions",
    );
    await page.screenshot({ path: "/tmp/spirit-fighter-menu.png" });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(350);
    await page.screenshot({ path: "/tmp/spirit-mobile-menu.png" });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
    );
    await page.locator("#start-mission").click();
    await page.waitForFunction(() => window.__flightDebug.state === "playing");
    await page.waitForTimeout(700);
    await page.screenshot({ path: "/tmp/spirit-fighter-mobile.png" });
    assert.deepEqual(errors, []);
    console.log(
      JSON.stringify({
        passed:
          "Six complete lifecycle cycles with stable GPU counts, single HUD/controls, hidden-HUD pause recovery, responsive menu",
        memory,
      }),
    );
  } else if (process.argv.includes("--combat")) {
    await page.keyboard.press("r");
    await page.keyboard.press("p");
    const pausedCombat = (await state()).combat;
    await page.keyboard.press("w");
    await page.keyboard.press("f");
    await page.waitForTimeout(250);
    assert.deepEqual(
      (await state()).combat,
      pausedCombat,
      "Combat must freeze while paused",
    );
    await page.keyboard.press("p");
    await page.locator("#help").click();
    await page.keyboard.press("f");
    assert.equal((await state()).combat.missiles, 6);
    await page.locator("#ready").click();
    await page.waitForTimeout(150);
    await page.keyboard.press("Tab");
    assert.equal((await state()).combat.locked, true);
    await page.keyboard.press("f");
    assert.equal((await state()).combat.missiles, 5);
    await page.screenshot({ path: "/tmp/spirit-combat-lock.png" });
    let radarReleased = false,
      commandReleased = false,
      shots = 1;
    const started = Date.now();
    while (
      !(await state()).combat.mission.complete &&
      Date.now() - started < 65000
    ) {
      const current = await state();
      // Normal level-flight release points, based on gravity and building roof altitude.
      if (!radarReleased && current.position[2] < 1710) {
        await page.keyboard.press("Space");
        radarReleased = true;
      }
      if (!commandReleased && current.position[2] < 825) {
        await page.keyboard.press("Space");
        commandReleased = true;
      }
      if (shots < 3 && current.combat.mission.aircraft >= shots) {
        await page.keyboard.press("Tab");
        assert.equal((await state()).combat.locked, true);
        await page.keyboard.press("f");
        shots++;
      }
      await page.waitForTimeout(80);
    }
    const completed = await state();
    assert.equal(completed.combat.mission.radar, true);
    assert.equal(completed.combat.mission.command, true);
    assert.equal(completed.combat.mission.aircraft, 3);
    assert.equal(completed.combat.mission.complete, true);
    assert.equal(completed.crashed, false);
    assert.ok(completed.combat.score >= 2550);
    assert.equal(completed.combat.bombs, 6);
    assert.equal(completed.combat.missiles, 3);
    await page.locator("#mission-complete").waitFor({ state: "visible" });
    assert.ok(await page.locator("#mission-complete").isVisible());
    assert.match(
      await page.locator("#mission-results").textContent(),
      /Final score:.*Targets destroyed:.*Mission time:/,
    );
    await page.screenshot({ path: "/tmp/spirit-mission-complete.png" });
    await page.waitForTimeout(250);
    assert.equal(
      (await state()).combat.mission.time,
      completed.combat.mission.time,
    );
    await page.locator("#restart-mission").click();
    const reset = (await state()).combat;
    assert.equal(reset.score, 0);
    assert.equal(reset.bombs, 8);
    assert.equal(reset.missiles, 6);
    assert.equal(reset.mission.complete, false);
    assert.equal(reset.projectiles.length, 0);
    assert.ok(reset.targets.every((t) => !t.destroyed && t.health > 0));
    // Restart must also clean active missiles, trails and lock state.
    await page.keyboard.press("Tab");
    await page.keyboard.press("f");
    await page.keyboard.press("Space");
    await page.waitForTimeout(250);
    await page.keyboard.press("r");
    const clean = (await state()).combat;
    assert.equal(clean.projectiles.length, 0);
    assert.equal(clean.particles, 0);
    assert.equal(clean.selected, null);
    assert.equal(clean.bombs, 8);
    assert.equal(clean.missiles, 6);
    assert.deepEqual(errors, []);
    console.log(
      JSON.stringify({
        passed:
          "Keyboard combat mission, pause/help gating, bomb radar/command strikes, 3 moving-aircraft missile kills, HUD objectives, completion freeze, restart and rearm",
        completed: completed.combat,
        errors,
      }),
    );
  } else if (process.argv.includes("--render-only")) {
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
    await touchPage.goto("http://localhost:5173/?training=1", {
      waitUntil: "networkidle",
    });
    await touchPage.waitForFunction(() => window.__flightDebug !== undefined);
    await touchPage.locator("#start-mission").click();
    await touchPage.waitForFunction(
      () => window.__flightDebug.state === "playing",
    );
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
    assert.deepEqual((await state()).cameraPosition, paused.cameraPosition);
    assert.equal(
      await page
        .locator("#resume")
        .evaluate((el) => el === document.activeElement),
      true,
    );
    await page.keyboard.press("Tab");
    assert.equal(
      await page
        .locator("#reset")
        .evaluate((el) => el === document.activeElement),
      true,
    );
    await page.keyboard.press("Tab");
    assert.equal(
      await page
        .locator("#pause-overlay .return-home")
        .evaluate((el) => el === document.activeElement),
      true,
    );
    await page.keyboard.press("Tab");
    await page.keyboard.press("Space");
    assert.equal((await state()).paused, false);
    assert.equal(
      (await state()).combat.bombs,
      paused.combat.bombs,
      "Space activates Resume without dropping a bomb",
    );
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
