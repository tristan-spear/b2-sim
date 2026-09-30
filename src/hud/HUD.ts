import type { FlightModel } from "../physics/FlightModel";
import { cameraNames } from "../camera/CameraController";
import { degrees, wrap } from "../utils/math";

const icons = {
  wing: '<svg viewBox="0 0 64 40" fill="currentColor"><path d="M32 1 1 31l17-3 6 6 8-5 8 5 6-6 17 3Z"/></svg>',
  sound:
    '<svg viewBox="0 0 24 24"><path d="m11 5-5 4H3v6h3l5 4zM15 8c3 2 3 6 0 8m3-11c5 4 5 10 0 14"/></svg>',
  pause: '<svg viewBox="0 0 24 24"><path d="M8 5v14M16 5v14"/></svg>',
  expand:
    '<svg viewBox="0 0 24 24"><path d="M9 4H4v5m11-5h5v5M4 15v5h5m11-5v5h-5"/></svg>',
  help: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 0 1 5 0c0 2-2.5 2-2.5 4m0 3v.2"/></svg>',
};
export interface HUDEvents {
  camera: (mode: number) => void;
  pause: () => void;
  reset: () => void;
  sound: () => void;
  quality: (value: string) => void;
  help: (open: boolean) => void;
}
export class HUD {
  readonly root = document.createElement("div");
  private readonly elements = new Map<string, HTMLElement>();
  private lastUpdate = 0;
  private helpDialog: HTMLDialogElement;
  private hidden = false;
  constructor(private readonly events: HUDEvents) {
    this.root.className = "hud";
    this.root.innerHTML = `
      <header class="topbar">
        <a class="brand" href="#" aria-label="Spirit flight simulator">${icons.wing}<div>SPIRIT<small>FLIGHT SIMULATOR</small></div></a>
        <div class="session"><span class="live-dot"></span> TRAINING STRIKE <span class="session-divider"></span><span class="weather">GOLDEN HOUR <span class="sun-symbol">☼</span></span></div>
        <nav class="toolbar" aria-label="Simulator options">
          <button id="sound" class="icon-button muted" aria-label="Enable engine and combat sound" aria-pressed="false" title="Engine sound · M">${icons.sound}</button>
          <button id="pause" class="icon-button" aria-label="Pause flight" aria-pressed="false" title="Pause · P">${icons.pause}</button>
          <button id="fullscreen" class="icon-button" aria-label="Toggle fullscreen" title="Fullscreen">${icons.expand}</button>
          <button id="help" class="icon-button" aria-label="Controls and settings" title="Controls and settings">${icons.help}</button>
        </nav>
      </header>
      <div class="location"><div class="eyebrow"><span class="tiny-cross">+</span> SIERRA RANGE</div><p>A little closer to the sky.</p><span>GOLDEN HOUR <b> / </b> PROCEDURAL WORLD</span></div>
      <div class="flight-status"><span id="status-dot" class="live-dot"></span><span id="status">FLIGHT SYSTEMS NOMINAL</span><small id="fps">60 FPS</small></div>
      <div class="compass"><div class="compass-heading"><span>HDG</span><b id="heading">000</b><span>°</span></div><div class="compass-window"><div id="compass-track"></div></div><div class="compass-pointer"></div></div>
      <div class="flight-instruments">
        <div class="tape speed-tape"><div class="instrument-label">AIRSPEED <small>KTS</small></div><div class="tape-body"><div id="speed-ticks" class="tick-list"></div><div class="tape-number"><span id="speed">408</span><i></i></div></div><div class="tape-caption">TRUE AIRSPEED</div></div>
        <div class="aim"><span class="aim-left"></span><span class="aim-dot"></span><span class="aim-right"></span><span class="aim-bottom"></span></div>
        <div class="pitch-ladder"><div id="pitch-ladder-inner">${[-20, -10, 0, 10, 20].map((n) => `<div class="pitch-line ${n === 0 ? "zero" : ""}" style="top:${100 - n * 4}px"><span>${n === 0 ? "" : n}</span><i></i><i></i><span>${n === 0 ? "" : n}</span></div>`).join("")}</div></div>
        <div class="tape altitude-tape"><div class="instrument-label">ALTITUDE <small>FT</small></div><div class="tape-body"><div id="altitude-ticks" class="tick-list"></div><div class="tape-number"><i></i><span id="altitude">7,874</span></div></div><div class="tape-caption">MEAN SEA LEVEL</div></div>
      </div>
      <div id="warning" class="warning" role="status"></div>
      <section class="aircraft-info"><div class="eyebrow"><span class="live-dot"></span> AV–001 <span class="muted-text">/</span> FLYING WING</div><h1>B–2 Spirit</h1><div class="aircraft-subtitle">HEAVY AIRFRAME. LIGHT TOUCH.</div><div class="engine-row"><span>THR</span><div class="throttle-track"><div id="throttle-bar"></div></div><b id="throttle">64<span>%</span></b></div><div class="aircraft-data"><div><span>VERTICAL SPEED</span><b id="vertical-speed">+0 <small>FT/MIN</small></b></div><div><span>FLIGHT TIME</span><b id="flight-time">00:00</b></div><div><span>DISTANCE</span><b id="distance">0.0 <small>NM</small></b></div></div></section>
      <div class="camera-panel"><div class="eyebrow">YOUR PERSPECTIVE <span class="muted-text">/</span> <kbd>C</kbd> TO CYCLE</div><nav class="camera-switch" aria-label="Camera mode">${cameraNames.map((name, i) => `<button data-camera="${i}" aria-pressed="${i === 0}" class="${i === 0 ? "active" : ""}"><span>0${i + 1}</span>${name}</button>`).join("")}</nav><p id="camera-hint">Follow the feeling.</p></div>
      <section class="attitude-panel"><div class="eyebrow">ATTITUDE</div><div class="attitude"><svg viewBox="0 0 140 140" aria-label="Artificial horizon"><defs><clipPath id="horizon-clip"><circle cx="70" cy="70" r="49"/></clipPath></defs><circle class="outer-ring" cx="70" cy="70" r="65"/><path class="bank-ticks" d="M70 5v7M37.5 13.7l3.5 6M13.7 37.5l6 3.5M5 70h7M102.5 13.7l-3.5 6M126.3 37.5l-6 3.5M135 70h-7"/><g clip-path="url(#horizon-clip)"><g id="horizon-roll"><g id="horizon-pitch"><path fill="#a9c6c321" d="M-100-150h340V70H-100z"/><path fill="#bfa57b2b" d="M-100 70h340v200H-100z"/><path class="horizon-line" d="M-100 70h340M52 51h36M60 33h20M52 89h36M60 107h20"/></g></g></g><circle class="inner-ring" cx="70" cy="70" r="49"/><path class="fixed-wing" d="M35 70h24l5 5m41-5H81l-5 5"/><circle cx="70" cy="70" r="2" fill="#e4e6c8"/><path fill="#d7dfba" d="m70 16-4 7h8z"/></svg><span id="pitch-readout">0.0°</span></div><div class="attitude-caption">PITCH <span id="bank-readout">BANK 0°</span></div></section>
      <footer class="controls-bar"><div class="control-pair"><kbd>W</kbd><kbd>S</kbd><span>Pitch</span></div><div class="control-pair"><kbd>A</kbd><kbd>D</kbd><span>Roll</span></div><div class="control-pair"><kbd>Q</kbd><kbd>E</kbd><span>Yaw</span></div><div class="control-pair throttle-controls"><kbd>SHIFT</kbd><kbd>CTRL</kbd><span>Throttle</span></div><div class="control-pair"><kbd>R</kbd><span>Reset</span></div><div class="control-pair"><kbd>P</kbd><span>Pause</span></div><button id="hide-hud">H <span>Hide HUD</span></button><span class="footer-tag">BUILT TO DISAPPEAR.</span></footer>
      <div class="touch-controls" aria-label="Touch flight controls"><div><button data-key="KeyQ" aria-label="Yaw left">↶</button><button data-key="KeyW" aria-label="Pitch down">↓</button><button data-key="KeyE" aria-label="Yaw right">↷</button><button data-key="KeyA" aria-label="Roll left">◁</button><button data-key="KeyS" aria-label="Pitch up">↑</button><button data-key="KeyD" aria-label="Roll right">▷</button></div><div><button data-key="ShiftLeft" aria-label="Increase throttle">THR +</button><button data-key="ControlLeft" aria-label="Decrease throttle">THR −</button></div></div>
      <div id="pause-overlay" class="pause-overlay" hidden><div class="pause-card"><div class="eyebrow" id="pause-eyebrow">TAKE A BREATH</div><h2 id="pause-title">Holding the moment.</h2><p id="pause-description">Your flight is paused. The sky can wait.</p><button id="resume" class="primary-button">Resume flight <span>↗</span></button><button id="reset" class="text-button">Restart mission</button></div></div>
      <dialog id="help-dialog"><button id="close-help" class="close-button" aria-label="Close controls">×</button><div class="eyebrow">FLIGHT MANUAL / 001</div><h2>Find your wings.</h2><p>Small inputs. Wide turns. Let the aircraft settle.</p><div class="help-grid"><span>Pitch down / up</span><div><kbd>W</kbd> <kbd>S</kbd></div><span>Bank left / right</span><div><kbd>A</kbd> <kbd>D</kbd></div><span>Yaw left / right</span><div><kbd>Q</kbd> <kbd>E</kbd></div><span>Increase / decrease throttle</span><div><kbd>SHIFT</kbd> <kbd>CTRL</kbd></div><span>Drop bomb / fire missile</span><div><kbd>SPACE</kbd> <kbd>F</kbd></div><span>Cycle air target</span><kbd>TAB</kbd><span>Cycle camera</span><kbd>C</kbd><span>Restart mission / rearm</span><kbd>R</kbd><span>Pause / resume</span><kbd>P</kbd><span>Toggle HUD / sound</span><div><kbd>H</kbd> <kbd>M</kbd></div></div><p class="help-tip">Bank to turn. Below 204 knots, the wing loses lift. In Orbit mode, drag to look around and scroll to zoom.</p><label class="quality-label">Render quality<select id="quality"><option value="high">High · full detail</option><option value="balanced" selected>Balanced · recommended</option><option value="low">Low · best performance</option></select></label><button id="ready" class="primary-button">Back to the sky <span>↗</span></button></dialog>
      <button id="show-hud" hidden>Show instruments <kbd>H</kbd></button>`;
    document.querySelector("#app")!.append(this.root);
    this.root
      .querySelectorAll<HTMLElement>("[id]")
      .forEach((el) => this.elements.set(el.id, el));
    this.helpDialog = this.el("help-dialog") as HTMLDialogElement;
    this.el("pause").onclick = events.pause;
    this.el("resume").onclick = events.pause;
    this.el("reset").onclick = events.reset;
    this.el("sound").onclick = events.sound;
    this.el("help").onclick = () => this.showHelp();
    this.el("close-help").onclick = () => this.helpDialog.close();
    this.el("ready").onclick = () => this.helpDialog.close();
    this.helpDialog.addEventListener("close", () => events.help(false));
    this.el("hide-hud").onclick = () => this.toggle();
    this.el("show-hud").onclick = () => this.toggle();
    this.root.querySelector<HTMLAnchorElement>(".brand")!.onclick = (e) =>
      e.preventDefault();
    this.el("fullscreen").onclick = async () => {
      try {
        if (document.fullscreenElement) await document.exitFullscreen();
        else await document.documentElement.requestFullscreen();
      } catch {
        this.el("fullscreen").title =
          "Fullscreen is unavailable in this browser";
      }
    };
    this.el("quality").onchange = (e) =>
      events.quality((e.target as HTMLSelectElement).value);
    this.root
      .querySelectorAll<HTMLButtonElement>("[data-camera]")
      .forEach(
        (button) =>
          (button.onclick = () => events.camera(Number(button.dataset.camera))),
      );
  }
  private el(id: string) {
    return this.elements.get(id)!;
  }
  showHelp() {
    this.events.help(true);
    this.helpDialog.showModal();
  }
  show() {
    this.hidden = false;
    this.root.classList.remove("hud-hidden");
    this.el("show-hud").hidden = true;
  }
  toggle() {
    this.hidden = !this.hidden;
    this.root.classList.toggle("hud-hidden", this.hidden);
    this.el("show-hud").hidden = !this.hidden;
  }
  setCamera(mode: number) {
    this.root
      .querySelectorAll<HTMLButtonElement>("[data-camera]")
      .forEach((button, i) => {
        button.classList.toggle("active", i === mode);
        button.setAttribute("aria-pressed", String(i === mode));
      });
    this.el("camera-hint").textContent = [
      "Follow the feeling.",
      "A wider kind of freedom.",
      "Nothing between you and the horizon.",
      "Drag to orbit · Scroll to explore",
    ][mode];
  }
  setSound(enabled: boolean) {
    const button = this.el("sound");
    button.classList.toggle("muted", !enabled);
    button.setAttribute("aria-pressed", String(enabled));
    button.setAttribute(
      "aria-label",
      enabled ? "Mute engine sound" : "Enable engine and combat sound",
    );
  }
  setPaused(paused: boolean, crashed = false) {
    this.el("pause-overlay").hidden = !paused && !crashed;
    this.el("pause").setAttribute("aria-pressed", String(paused));
    this.el("pause").setAttribute(
      "aria-label",
      paused ? "Resume flight" : "Pause flight",
    );
    this.el("pause-eyebrow").textContent = crashed
      ? "FLIGHT ENDED"
      : "TAKE A BREATH";
    this.el("pause-title").textContent = crashed
      ? "Meet the sky again."
      : "Holding the moment.";
    this.el("pause-description").textContent = crashed
      ? "Terrain contact. Reset your aircraft and take another flight."
      : "Your flight is paused. The sky can wait.";
    this.el("resume").hidden = crashed;
    this.el("reset").className = crashed ? "primary-button" : "text-button";
  }
  update(flight: FlightModel, ground: number, fps: number, now: number) {
    if (now - this.lastUpdate < 66) return;
    this.lastUpdate = now;
    const speed = flight.speed * 1.94384,
      altitude = flight.altitude * 3.28084;
    this.el("speed").textContent = Math.round(speed).toString();
    this.el("altitude").textContent =
      Math.round(altitude).toLocaleString("en-US");
    this.el("heading").textContent = String(
      Math.round(flight.heading) % 360,
    ).padStart(3, "0");
    const vertical = Math.round((flight.verticalSpeed * 196.85) / 10) * 10;
    this.el("vertical-speed").innerHTML =
      `${vertical >= 0 ? "+" : ""}${vertical.toLocaleString("en-US")} <small>FT/MIN</small>`;
    this.el("throttle").innerHTML =
      `${Math.round(flight.throttle * 100)}<span>%</span>`;
    this.el("throttle-bar").style.width = `${flight.throttle * 100}%`;
    this.el("flight-time").textContent =
      `${String(Math.floor(flight.elapsed / 60)).padStart(2, "0")}:${String(Math.floor(flight.elapsed % 60)).padStart(2, "0")}`;
    this.el("distance").innerHTML =
      `${(flight.distance / 1852).toFixed(1)} <small>NM</small>`;
    this.el("horizon-roll").setAttribute(
      "transform",
      `rotate(${-degrees(flight.roll)},70,70)`,
    );
    this.el("horizon-pitch").setAttribute(
      "transform",
      `translate(0,${degrees(flight.pitch) * 1.6})`,
    );
    this.el("pitch-readout").textContent =
      `${degrees(flight.pitch).toFixed(1)}°`;
    this.el("bank-readout").textContent =
      `BANK ${Math.round(Math.abs(degrees(flight.roll)))}°`;
    this.el("pitch-ladder-inner").style.transform =
      `rotate(${-degrees(flight.roll)}deg) translateY(${degrees(flight.pitch) * 4}px)`;
    const base = Math.floor(flight.heading / 10) * 10;
    let compass = "";
    for (let n = -6; n <= 6; n++) {
      const value = wrap(base + n * 10, 360);
      const cardinal: Record<number, string> = {
        0: "N",
        90: "E",
        180: "S",
        270: "W",
      };
      compass += `<span style="left:${180 + (base + n * 10 - flight.heading) * 3}px" class="${cardinal[value] ? "cardinal" : ""}"><i></i>${cardinal[value] ?? String(value).padStart(3, "0")}</span>`;
    }
    this.el("compass-track").innerHTML = compass;
    this.renderTape("speed-ticks", speed, 20, false);
    this.renderTape("altitude-ticks", altitude, 200, true);
    this.el("fps").textContent = `${Math.round(fps)} FPS`;
    const agl = flight.altitude - Math.max(ground, 110),
      warning = flight.crashed
        ? "TERRAIN CONTACT"
        : flight.stalled
          ? "LOW AIRSPEED · INCREASE THROTTLE"
          : agl < 220
            ? "TERRAIN · PULL UP"
            : "";
    this.el("warning").textContent = warning;
    this.el("warning").classList.toggle("visible", Boolean(warning));
    this.el("status").textContent = flight.crashed
      ? "FLIGHT ENDED"
      : flight.stalled
        ? "LOW AIRSPEED"
        : agl < 220
          ? "LOW ALTITUDE"
          : "FLIGHT SYSTEMS NOMINAL";
    this.el("status-dot").classList.toggle("caution", Boolean(warning));
  }
  private renderTape(
    id: string,
    value: number,
    step: number,
    altitude: boolean,
  ) {
    let html = "";
    const base = Math.floor(value / step) * step;
    for (let n = -3; n <= 3; n++) {
      const number = base + n * step;
      if (number < 0) continue;
      html += `<span style="top:${90 - ((number - value) / step) * 32}px"><b>${altitude ? number.toLocaleString("en-US") : number}</b><i></i></span>`;
    }
    this.el(id).innerHTML = html;
  }
}
