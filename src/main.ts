import * as THREE from "three";
import { Aircraft } from "./aircraft/Aircraft";
import { FlightController } from "./aircraft/FlightController";
import { CameraController } from "./camera/CameraController";
import { Clouds } from "./environment/Clouds";
import { Sky } from "./environment/Sky";
import { Terrain } from "./environment/Terrain";
import { CombatSystem } from "./combat/CombatSystem";
import { CombatHUD } from "./hud/CombatHUD";
import { HUD } from "./hud/HUD";
import { FlightModel } from "./physics/FlightModel";
import { EngineAudio } from "./utils/Audio";
import { terrainHeight } from "./utils/noise";
import { damp } from "./utils/math";
import "@fontsource/dm-sans/latin-400.css";
import "@fontsource/dm-sans/latin-500.css";
import "@fontsource/barlow-condensed/latin-400.css";
import "@fontsource/ibm-plex-mono/latin-400.css";
import "./style.css";

function boot() {
  const app = document.querySelector<HTMLDivElement>("#app")!;
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: "high-performance",
  });
  renderer.domElement.className = "scene";
  renderer.domElement.setAttribute(
    "aria-label",
    "3D flight simulator. W/S pitch, A/D bank, Q/E yaw.",
  );
  renderer.domElement.tabIndex = -1;
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  app.append(renderer.domElement);
  const vignette = document.createElement("div");
  vignette.className = "vignette";
  app.append(vignette);
  const scene = new THREE.Scene(),
    flight = new FlightModel(),
    aircraft = new Aircraft(),
    terrain = new Terrain(),
    sky = new Sky(scene),
    clouds = new Clouds(),
    cameras = new CameraController(renderer.domElement),
    audio = new EngineAudio(),
    combat = new CombatSystem(flight, (kind) => audio.playCombat(kind));
  scene.add(aircraft.root, terrain.root, clouds.mesh, combat.root);
  let paused = false,
    helpOpen = false,
    time = 0,
    accumulator = 0,
    last = 0,
    fps = 60,
    wasCrashed = false;
  const togglePause = () => {
    if (flight.crashed || helpOpen || combat.mission.complete) return;
    paused = !paused;
    controls.clear();
    hud.setPaused(paused);
  };
  const reset = () => {
    flight.reset();
    combat.reset();
    paused = false;
    wasCrashed = false;
    accumulator = 0;
    controls.clear();
    hud.setPaused(false);
    cameras.update(1 / 60, flight, true);
  };
  const setCamera = (mode: number) => {
    cameras.setMode(mode, flight);
    hud.setCamera(mode);
  };
  const sound = async () => {
    try {
      hud.setSound(await audio.toggle());
    } catch (error) {
      console.warn("Engine audio unavailable", error);
    }
  };
  const hud = new HUD({
    camera: setCamera,
    pause: togglePause,
    reset,
    sound,
    quality: (quality) => {
      renderer.setPixelRatio(
        Math.min(
          devicePixelRatio,
          quality === "high" ? 2 : quality === "low" ? 1 : 1.5,
        ),
      );
      renderer.shadowMap.enabled = quality !== "low";
    },
    help: (open) => {
      helpOpen = open;
      controls.clear();
    },
  });
  const combatAction = (code: string) => {
    if (!paused && !helpOpen && !flight.crashed) combat.action(code);
  };
  const combatHUD = new CombatHUD(hud.root, combat, combatAction, reset);
  const controls = new FlightController((code) => {
    combatAction(code);
    if (code === "KeyC") setCamera((cameras.mode + 1) % 4);
    if (code === "KeyR") reset();
    if (code === "KeyP" || code === "Escape") togglePause();
    if (code === "KeyH") hud.toggle();
    if (code === "KeyM") void sound();
  });
  controls.bindTouch(hud.root);
  aircraft.update(flight, 0);
  cameras.update(1 / 60, flight, true);
  sky.update(flight.position);
  window.addEventListener("resize", () => {
    renderer.setSize(innerWidth, innerHeight);
    cameras.resize();
  });
  window.addEventListener("blur", () => {
    if (!paused && !flight.crashed) {
      paused = true;
      hud.setPaused(true);
    }
  });
  document.addEventListener("visibilitychange", () => {
    last = performance.now();
    accumulator = 0;
    if (document.hidden) {
      paused = true;
      controls.clear();
      hud.setPaused(true, flight.crashed);
    }
  });
  renderer.domElement.addEventListener("webglcontextlost", (event) => {
    event.preventDefault();
    renderer.setAnimationLoop(null);
    showError(
      "The graphics connection was interrupted. Reload to return to the sky.",
    );
  });
  // Fixed physics steps make control response independent of monitor refresh rate.
  renderer.setAnimationLoop((now) => {
    if (!last) last = now;
    const dt = Math.max(0, Math.min((now - last) / 1000, 0.1));
    last = now;
    if (dt > 0) fps = damp(fps, 1 / Math.max(dt, 0.001), 2, dt);
    const stopped =
      paused || helpOpen || flight.crashed || combat.mission.complete;
    if (!stopped) {
      accumulator += dt;
      const input = controls.sample();
      while (accumulator >= 1 / 120) {
        flight.update(1 / 120, input, terrainHeight);
        if (!flight.crashed) combat.update(1 / 120);
        accumulator -= 1 / 120;
        if (flight.crashed || combat.mission.complete) {
          accumulator = 0;
          break;
        }
      }
      time += dt;
    } else accumulator = 0;
    aircraft.update(flight, time);
    cameras.update(dt, flight);
    aircraft.root.visible = cameras.mode !== 2;
    sky.update(flight.position);
    terrain.update(flight.position);
    clouds.update(cameras.camera, flight.position, time);
    audio.update(flight, stopped);
    hud.update(
      flight,
      terrainHeight(flight.position.x, flight.position.z),
      fps,
      now,
    );
    if (flight.crashed && !wasCrashed) {
      wasCrashed = true;
      hud.setPaused(false, true);
    }
    // Apply shake only for this render, so camera smoothing never accumulates it.
    const cameraPosition = cameras.camera.position.clone();
    if (!stopped) {
      const shake = combat.effects.shake;
      cameras.camera.position.x += Math.sin(now * 0.07) * shake;
      cameras.camera.position.y += Math.cos(now * 0.09) * shake * 0.6;
    }
    combatHUD.update(dt, flight, cameras.camera);
    renderer.render(scene, cameras.camera);
    cameras.camera.position.copy(cameraPosition);
  });
  // Read-only diagnostics for tuning and automated smoke tests.
  if (import.meta.env.DEV)
    Object.defineProperty(window, "__flightDebug", {
      get: () => ({
        combat: combat.diagnostics,
        position: flight.position.toArray(),
        speed: flight.speed,
        throttle: flight.throttle,
        pitch: flight.pitch,
        roll: flight.roll,
        heading: flight.heading,
        altitude: flight.altitude,
        verticalSpeed: flight.verticalSpeed,
        crashed: flight.crashed,
        paused,
        camera: cameras.mode,
        tiles: terrain.tileCount,
        drawCalls: renderer.info.render.calls,
        triangles: renderer.info.render.triangles,
      }),
    });
}
function showError(message: string) {
  const panel = document.createElement("div");
  panel.className = "error-screen";
  const title = document.createElement("h1");
  title.textContent = "A clear sky needs WebGL 2.";
  const text = document.createElement("p");
  text.textContent = message;
  const retry = document.createElement("button");
  retry.textContent = "Try again";
  retry.onclick = () => location.reload();
  panel.append(title, text, retry);
  document.body.append(panel);
}
try {
  boot();
} catch (error) {
  console.error(error);
  showError(
    "The simulator could not start. Try a current browser with hardware acceleration enabled.",
  );
}
