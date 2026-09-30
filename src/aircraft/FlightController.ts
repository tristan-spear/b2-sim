import { neutralInput, type FlightInput } from "../physics/FlightModel";

const controlledKeys = new Set([
  "Space",
  "KeyF",
  "KeyG",
  "Tab",
  "KeyW",
  "KeyS",
  "KeyA",
  "KeyD",
  "KeyQ",
  "KeyE",
  "ShiftLeft",
  "ShiftRight",
  "ControlLeft",
  "ControlRight",
  "KeyC",
  "KeyR",
  "KeyP",
  "KeyH",
  "KeyM",
  "Escape",
]);
export class FlightController {
  private readonly lifecycle = new AbortController();
  private readonly keys = new Set<string>();
  private readonly touch = new Set<string>();
  readonly input: FlightInput = neutralInput();
  constructor(onAction: (code: string) => void) {
    const signal = this.lifecycle.signal;
    window.addEventListener(
      "keydown",
      (e) => {
        if (document.querySelector("dialog[open]")) return;
        if (
          e.target instanceof HTMLInputElement ||
          e.target instanceof HTMLSelectElement
        )
          return;
        if (!controlledKeys.has(e.code)) return;
        // Keep native browser shortcuts (including reload/new tab) usable.
        if (
          e.metaKey ||
          e.altKey ||
          (e.ctrlKey &&
            ![
              "ControlLeft",
              "ControlRight",
              "KeyW",
              "KeyS",
              "KeyA",
              "KeyD",
              "KeyQ",
              "KeyE",
            ].includes(e.code))
        )
          return;
        e.preventDefault();
        this.keys.add(e.code);
        if (!e.repeat) onAction(e.code);
      },
      { signal },
    );
    window.addEventListener("keyup", (e) => this.keys.delete(e.code), {
      signal,
    });
    window.addEventListener("blur", () => this.clear(), { signal });
    document.addEventListener("visibilitychange", () => this.clear(), {
      signal,
    });
  }
  dispose() {
    this.lifecycle.abort();
    this.clear();
  }
  clear() {
    this.keys.clear();
    this.touch.clear();
  }
  bindTouch(root: HTMLElement) {
    root.querySelectorAll<HTMLButtonElement>("[data-key]").forEach((button) => {
      const key = button.dataset.key!;
      button.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        button.setPointerCapture(e.pointerId);
        this.touch.add(key);
        button.classList.add("pressed");
      });
      const release = () => {
        this.touch.delete(key);
        button.classList.remove("pressed");
      };
      button.addEventListener("pointerup", release);
      button.addEventListener("pointercancel", release);
      button.addEventListener("lostpointercapture", release);
    });
  }
  sample() {
    const has = (code: string) =>
      Number(this.keys.has(code) || this.touch.has(code));
    this.input.pitch = has("KeyS") - has("KeyW");
    this.input.roll = has("KeyA") - has("KeyD");
    this.input.yaw = has("KeyQ") - has("KeyE");
    this.input.throttle =
      Math.max(has("ShiftLeft"), has("ShiftRight")) -
      Math.max(has("ControlLeft"), has("ControlRight"));
    return this.input;
  }
}
