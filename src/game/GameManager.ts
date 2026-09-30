import * as THREE from "three";
import { aircraftConfigs, type AircraftType } from "../aircraft/AircraftConfig";
import { MainMenu } from "../menu/MainMenu";
import { GameSession } from "./GameSession";
import { Terrain } from "../environment/Terrain";
import { Sky } from "../environment/Sky";
import { Clouds } from "../environment/Clouds";
import { EngineAudio } from "../utils/Audio";
import { damp } from "../utils/math";

export type GameState = "home" | "loading" | "playing" | "paused" | "complete";
export class GameManager {
  private readonly renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: "high-performance",
  });
  private readonly scene = new THREE.Scene();
  // World and renderer persist across missions; only mission-owned resources are replaced.
  private readonly terrain = new Terrain();
  private readonly sky = new Sky(this.scene);
  private readonly clouds = new Clouds();
  private readonly audio = new EngineAudio();
  private readonly menu: MainMenu;
  private readonly loading = document.createElement("div");
  private session?: GameSession;
  private phase: "home" | "loading" | "playing" = "home";
  private last = 0;
  private fps = 60;
  private time = 0;
  constructor() {
    const app = document.querySelector("#app")!;
    const r = this.renderer;
    r.domElement.className = "scene";
    r.domElement.tabIndex = -1;
    r.domElement.setAttribute(
      "aria-label",
      "3D flight simulator. W/S pitch, A/D bank, Q/E yaw.",
    );
    r.setSize(innerWidth, innerHeight);
    r.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.12;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    app.append(r.domElement);
    const vignette = document.createElement("div");
    vignette.className = "vignette";
    app.append(vignette);
    this.scene.add(this.terrain.root, this.clouds.mesh);
    this.menu = new MainMenu((type) => void this.start(type));
    this.loading.className = "loading-screen";
    this.loading.hidden = true;
    this.loading.innerHTML =
      '<span class="menu-eyebrow">SPIRIT / FLIGHT OPERATIONS</span><h2>LOADING MISSION…</h2><div class="loading-track"></div>';
    this.loading.setAttribute("role", "status");
    app.append(this.loading);
    window.addEventListener("resize", () => {
      r.setSize(innerWidth, innerHeight);
      this.menu.resize();
      this.session?.cameras.resize();
    });
    r.domElement.addEventListener("webglcontextlost", (event) => {
      event.preventDefault();
      r.setAnimationLoop(null);
      this.loading.hidden = false;
      this.loading.textContent =
        "Graphics connection interrupted. Reload to return to the sky.";
    });
    r.setAnimationLoop((now) => this.frame(now));
    this.menu.resize();
    if (import.meta.env.DEV)
      Object.defineProperty(window, "__flightDebug", {
        get: () => ({
          state: this.state,
          selected: this.menu.selected,
          ...this.session?.diagnostics,
          tiles: this.terrain.tileCount,
          drawCalls: r.info.render.calls,
          triangles: r.info.render.triangles,
          geometries: r.info.memory.geometries,
          textures: r.info.memory.textures,
        }),
      });
  }
  get state(): GameState {
    return this.phase !== "playing"
      ? this.phase
      : this.session?.paused
        ? "paused"
        : this.session?.combat.mission.complete
          ? "complete"
          : "playing";
  }
  private async start(type: AircraftType) {
    if (this.phase !== "home") return;
    this.phase = "loading";
    this.menu.root.classList.add("leaving");
    this.loading.hidden = false;
    await new Promise((resolve) => setTimeout(resolve, 450));
    try {
      this.session = new GameSession(
        aircraftConfigs[type],
        this.renderer,
        this.scene,
        this.audio,
        () => this.home(),
      );
      this.sky.update(this.session.flight.position);
      this.terrain.update(this.session.flight.position);
      this.renderer.domElement.classList.add("mission-enter");
      this.menu.hide();
      this.phase = "playing";
      this.last = performance.now();
      this.renderer.domElement.focus();
    } catch (error) {
      console.error(error);
      this.phase = "home";
      this.menu.show();
      this.loading.textContent =
        "Mission could not load. Reload and try again.";
      return;
    }
    this.loading.hidden = true;
  }
  private home() {
    this.session?.dispose();
    this.session = undefined;
    this.renderer.domElement.classList.remove("mission-enter");
    this.renderer.renderLists.dispose();
    this.phase = "home";
    this.menu.show();
    this.last = performance.now();
  }
  private frame(now: number) {
    const dt = this.last
      ? Math.max(0, Math.min((now - this.last) / 1000, 0.1))
      : 0;
    this.last = now;
    if (dt) this.fps = damp(this.fps, 1 / dt, 2, dt);
    const s = this.session;
    if (this.phase === "playing" && s) {
      s.update(dt, this.fps, now);
      if (!s.stopped) this.time += dt;
      this.sky.update(s.flight.position);
      this.terrain.update(s.flight.position);
      this.clouds.update(s.cameras.camera, s.flight.position, this.time);
      const camera = s.cameras.camera,
        position = camera.position.clone();
      if (!s.stopped) {
        camera.position.x += Math.sin(now * 0.07) * s.combat.effects.shake;
        camera.position.y +=
          Math.cos(now * 0.09) * s.combat.effects.shake * 0.6;
      }
      this.renderer.render(this.scene, camera);
      camera.position.copy(position);
    } else {
      this.menu.update(dt);
      this.renderer.render(this.menu.scene, this.menu.camera);
    }
  }
}
