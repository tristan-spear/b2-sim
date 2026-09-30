import * as THREE from "three";
import type {
  AircraftConfig,
  AircraftVisual,
} from "../aircraft/AircraftConfig";
import { FlightController } from "../aircraft/FlightController";
import { CameraController } from "../camera/CameraController";
import { FlightModel } from "../physics/FlightModel";
import { HUD } from "../hud/HUD";
import type { CombatHUD } from "../hud/CombatHUD";
import type { CombatSystem } from "../combat/CombatSystem";
import type { EngineAudio } from "../utils/Audio";
import { terrainHeight } from "../utils/noise";
import { missions } from "./MissionManager";
import { disposeTree } from "./dispose";

export class GameSession {
  readonly flight: FlightModel;
  readonly aircraft: AircraftVisual;
  readonly combat: CombatSystem;
  readonly cameras: CameraController;
  readonly hud: HUD;
  readonly combatHUD: CombatHUD;
  readonly controls: FlightController;
  paused = false;
  private helpOpen = false;
  private time = 0;
  private accumulator = 0;
  private wasCrashed = false;
  private readonly lifecycle = new AbortController();
  private disposed = false;
  constructor(
    readonly config: AircraftConfig,
    private readonly renderer: THREE.WebGLRenderer,
    readonly scene: THREE.Scene,
    private readonly audio: EngineAudio,
    home: () => void,
  ) {
    this.flight = new FlightModel(config.flight);
    this.aircraft = config.createModel();
    this.cameras = new CameraController(renderer.domElement, config.camera);
    const mission = missions.get(config.mission);
    if (mission.aircraft !== config.id)
      throw new Error("Aircraft / mission mismatch");
    this.combat = mission.create(this.flight, (kind) => audio.playCombat(kind));
    scene.add(this.aircraft.root, this.combat.root);
    this.hud = new HUD({
      camera: (mode) => this.setCamera(mode),
      pause: () => this.togglePause(),
      reset: () => this.reset(),
      sound: async () => {
        try {
          const enabled = await audio.toggle();
          if (!this.disposed) this.hud.setSound(enabled);
        } catch (e) {
          console.warn("Audio unavailable", e);
        }
      },
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
        this.helpOpen = open;
        this.clearInput();
      },
    });
    this.hud.setSound(audio.enabled);
    this.combatHUD = mission.createHUD(
      this.hud.root,
      this.combat,
      (code) => this.action(code),
      () => this.reset(),
    );
    this.controls = new FlightController((code) => {
      if (code === "Escape" || code === "KeyP") {
        this.togglePause();
        return;
      }
      if (code === "KeyR") {
        this.reset();
        return;
      }
      if (this.paused || this.helpOpen) return;
      this.action(code);
      if (code === "KeyC") this.setCamera((this.cameras.mode + 1) % 4);
      if (code === "KeyH") this.hud.toggle();
      if (code === "KeyM")
        this.hud.root.querySelector<HTMLButtonElement>("#sound")!.click();
    });
    this.controls.bindTouch(this.hud.root);
    for (const selector of [
      "#pause-overlay .pause-card",
      "#mission-complete .pause-card",
    ]) {
      const button = document.createElement("button");
      button.className = "text-button return-home";
      button.textContent = "Return to main menu";
      button.onclick = home;
      this.hud.root.querySelector(selector)!.append(button);
    }
    const signal = this.lifecycle.signal;
    const trigger = (e: PointerEvent) => {
      if (e.button === 0 && !this.stopped && this.cameras.mode !== 3)
        this.combat.setTrigger(true);
    };
    renderer.domElement.addEventListener("pointerdown", trigger, { signal });
    this.hud.root
      .querySelector("#fire-cannon")
      ?.addEventListener("pointerdown", (e) => trigger(e as PointerEvent), {
        signal,
      });
    window.addEventListener("pointerup", () => this.combat.setTrigger(false), {
      signal,
    });
    window.addEventListener(
      "pointercancel",
      () => this.combat.setTrigger(false),
      { signal },
    );
    window.addEventListener("blur", () => this.pause(), { signal });
    document.addEventListener(
      "visibilitychange",
      () => {
        if (document.hidden) this.pause();
      },
      { signal },
    );
    this.aircraft.update(this.flight, 0);
    this.cameras.update(1 / 60, this.flight, true);
  }
  get stopped() {
    return (
      this.paused ||
      this.helpOpen ||
      this.flight.crashed ||
      this.combat.mission.complete
    );
  }
  private action(code: string) {
    if (!this.stopped) this.combat.action(code);
  }
  private clearInput() {
    this.controls?.clear();
    this.combat.setTrigger(false);
    this.accumulator = 0;
  }
  pause() {
    this.hud.show();
    this.paused = true;
    this.clearInput();
    this.hud.setPaused(true, this.flight.crashed);
    this.cameras.orbit.enabled = false;
  }
  togglePause() {
    if (this.helpOpen) return;
    if (this.paused) {
      this.paused = false;
      this.clearInput();
      this.hud.setPaused(false, this.flight.crashed);
      this.cameras.setMode(this.cameras.mode, this.flight);
    } else this.pause();
  }
  reset() {
    this.flight.reset();
    this.combat.reset();
    this.clearInput();
    this.paused = this.wasCrashed = false;
    this.time = 0;
    this.hud.setPaused(false);
    this.cameras.update(1 / 60, this.flight, true);
  }
  private setCamera(mode: number) {
    this.combat.setTrigger(false);
    this.cameras.setMode(mode, this.flight);
    this.hud.setCamera(mode);
  }
  update(dt: number, fps: number, now: number) {
    if (!this.stopped) {
      this.accumulator += dt;
      const input = this.controls.sample();
      while (this.accumulator >= 1 / 120) {
        this.flight.update(1 / 120, input, terrainHeight);
        if (!this.flight.crashed) this.combat.update(1 / 120);
        this.accumulator -= 1 / 120;
        if (this.flight.crashed || this.combat.mission.complete) {
          this.clearInput();
          this.hud.show();
          break;
        }
      }
      this.time += dt;
    } else this.accumulator = 0;
    this.aircraft.update(this.flight, this.time);
    this.cameras.update(dt, this.flight);
    this.aircraft.root.visible = this.cameras.mode !== 2;
    this.audio.update(this.flight, this.stopped);
    this.hud.update(
      this.flight,
      terrainHeight(this.flight.position.x, this.flight.position.z),
      fps,
      now,
    );
    if (this.flight.crashed && !this.wasCrashed) {
      this.wasCrashed = true;
      this.hud.show();
      this.hud.setPaused(false, true);
    }
    this.combatHUD.update(dt, this.flight, this.cameras.camera);
  }
  dispose() {
    this.disposed = true;
    this.lifecycle.abort();
    this.controls.dispose();
    this.cameras.orbit.dispose();
    this.audio.update(this.flight, true);
    this.hud.root.querySelector<HTMLDialogElement>("dialog")?.close();
    this.hud.root.remove();
    this.combat.dispose();
    disposeTree(this.combat.root);
    disposeTree(this.aircraft.root);
  }
  get diagnostics() {
    const f = this.flight;
    return {
      aircraft: this.config.id,
      combat: this.combat.diagnostics,
      position: f.position.toArray(),
      speed: f.speed,
      throttle: f.throttle,
      pitch: f.pitch,
      roll: f.roll,
      heading: f.heading,
      altitude: f.altitude,
      verticalSpeed: f.verticalSpeed,
      crashed: f.crashed,
      paused: this.paused,
      camera: this.cameras.mode,
    };
  }
}
