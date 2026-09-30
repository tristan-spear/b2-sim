import { PerspectiveCamera, Vector3 } from "three";
import type { CombatSystem } from "../combat/CombatSystem";
import type { FlightModel } from "../physics/FlightModel";
const duration = (seconds: number) =>
  `${Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0")}:${Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0")}`;
export class CombatHUD {
  readonly root = document.createElement("div");
  private readonly markers = new Map<string, HTMLElement>();
  private readonly elements = new Map<string, HTMLElement>();
  private elapsed = 1;
  private readonly projected = new Vector3();
  private readonly local = new Vector3();
  constructor(
    parent: HTMLElement,
    private readonly combat: CombatSystem,
    action: (code: string) => void,
    reset: () => void,
  ) {
    parent.classList.add("combat-mode");
    this.root.className = "combat-hud";
    this.root.innerHTML = `
      <section class="mission-panel"><div class="eyebrow">MISSION / 001 <span id="mission-clock">00:00</span></div><h2>TRAINING STRIKE</h2><p>Fictional test range · live exercise</p><div id="objectives"></div></section>
      <section class="weapons-panel"><div class="eyebrow">ARMAMENT <span id="combat-score">SCORE 0</span></div><div class="weapon-buttons"><button id="drop-bomb" title="Drop bomb · Space"><kbd>SPACE</kbd> BOMB <b id="bomb-count">8</b></button><button id="fire-missile" title="Fire missile · F"><kbd>F</kbd> MISSILE <b id="missile-count">6</b></button></div><div id="selected-weapon"></div><div id="weapon-message"></div><button id="cycle-target"><kbd>TAB</kbd> CYCLE AIR TARGET</button><div id="target-info"></div></section>
      <div id="combat-popup" role="status"></div><div id="hit-marker">✕<small>HIT</small></div><div id="bomb-pipper" class="world-marker bomb-pipper"><i></i><span>IMPACT</span></div>
      <div class="strike-hint">SPACE · DROP &nbsp; F · FIRE &nbsp; TAB · LOCK &nbsp; R · RESTART<br><span>Place the IMPACT ring on a ground marker before release.</span></div>
      <div id="mission-complete" class="pause-overlay" hidden><div class="pause-card"><div class="eyebrow">TRAINING STRIKE / DEBRIEF</div><h2>MISSION COMPLETE</h2><p id="mission-results"></p><button id="restart-mission" class="primary-button">Restart mission ↗</button></div></div>`;
    parent.append(this.root);
    this.root
      .querySelectorAll<HTMLElement>("[id]")
      .forEach((el) => this.elements.set(el.id, el));
    this.el("drop-bomb").onclick = () => action("Space");
    this.el("fire-missile").onclick = () => action("KeyF");
    this.el("cycle-target").onclick = () => action("Tab");
    this.el("restart-mission").onclick = reset;
    for (const t of [...combat.compound.targets, ...combat.enemies.aircraft]) {
      const marker = document.createElement("div");
      marker.className = `world-marker ${t.kind === "aircraft" ? "air-marker" : "ground-marker"}`;
      marker.innerHTML = `<i></i><span>${t.id}</span>`;
      this.root.append(marker);
      this.markers.set(t.id, marker);
    }
  }
  protected el(id: string) {
    return this.elements.get(id)!;
  }
  private place(el: HTMLElement, position: Vector3, camera: PerspectiveCamera) {
    this.projected.copy(position).project(camera);
    this.local.copy(position).applyMatrix4(camera.matrixWorldInverse);
    const off =
      this.local.z > 0 ||
      Math.abs(this.projected.x) > 0.94 ||
      Math.abs(this.projected.y) > 0.8;
    const x = this.local.z > 0 ? -this.projected.x : this.projected.x;
    const y = this.local.z > 0 ? -this.projected.y : this.projected.y;
    el.style.left = `${(Math.max(-0.92, Math.min(0.92, x)) * 0.5 + 0.5) * 100}%`;
    el.style.top = `${(-Math.max(-0.76, Math.min(0.62, y)) * 0.5 + 0.5) * 100}%`;
    el.classList.toggle("offscreen", off);
  }
  update(dt: number, flight: FlightModel, camera: PerspectiveCamera) {
    camera.updateMatrixWorld();
    for (const t of [
      ...this.combat.compound.targets,
      ...this.combat.enemies.aircraft,
    ]) {
      const el = this.markers.get(t.id)!;
      el.hidden = t.destroyed;
      el.classList.toggle(
        "distant",
        t.kind !== "aircraft" &&
          t.kind !== "radar" &&
          t.kind !== "command" &&
          flight.position.distanceTo(t.position) > 2500,
      );
      const selected = this.combat.targeting.selected === t;
      el.classList.toggle("selected", selected);
      if (!el.hidden) {
        const position = t.position.clone();
        if (t.kind !== "aircraft") position.y += 65;
        this.place(el, position, camera);
        // Keep a single off-screen navigation cue for each mission objective / selected bandit.
        if (
          el.classList.contains("offscreen") &&
          !selected &&
          t.kind !== "radar" &&
          t.kind !== "command"
        )
          el.hidden = true;
      }
    }
    this.elapsed += dt;
    if (this.elapsed < 0.1) return;
    this.elapsed = 0;
    const { weapons: w, mission: m, targeting: t } = this.combat;
    this.el("bomb-count").textContent = String(w.bombs);
    this.el("missile-count").textContent = String(w.missiles);
    this.el("combat-score").textContent = `SCORE ${m.score.toLocaleString()}`;
    this.el("mission-clock").textContent = duration(m.time);
    this.el("selected-weapon").textContent = `SELECTED: ${w.selected}`;
    this.el("weapon-message").textContent = w.message;
    this.el("drop-bomb").classList.toggle("active", w.selected === "BOMB");
    this.el("fire-missile").classList.toggle(
      "active",
      w.selected === "MISSILE",
    );
    this.el("objectives").innerHTML = [
      [m.radar, "Radar destroyed"],
      [
        m.aircraft >= m.requiredAircraft,
        `Enemy aircraft ${Math.min(m.requiredAircraft, m.aircraft)}/${m.requiredAircraft}`,
      ],
      [m.command, "Command building destroyed"],
    ]
      .map(
        ([done, label]) =>
          `<div class="${done ? "done" : ""}">${done ? "✓" : "□"} &nbsp;${label}</div>`,
      )
      .join("");
    const target = t.selected;
    this.el("target-info").innerHTML = target
      ? `<b>${target.id}</b><span>${(flight.position.distanceTo(target.position) / 1000).toFixed(1)} km · ${target.health}/${target.maxHealth} HP</span><strong>${t.valid(flight.position) ? "LOCKED" : "OUT OF RANGE"}</strong>`
      : `<span>NO AIR TARGET</span><small>Lock range 6.5 km · TAB to acquire</small>`;
    this.el("combat-popup").textContent = m.popupTime > 0 ? m.popup : "";
    this.el("combat-popup").style.opacity = String(Math.min(1, m.popupTime));
    this.el("hit-marker").hidden = w.hitTime <= 0;
    const impact = w.predict(flight);
    this.place(this.el("bomb-pipper"), impact, camera);
    const nearby = this.combat.compound.targets.some(
      (target) =>
        !target.destroyed && target.bounds.distanceToPoint(impact) < 95,
    );
    this.el("bomb-pipper").classList.toggle("on-target", nearby);
    this.el("bomb-pipper").querySelector("span")!.textContent = nearby
      ? "RELEASE"
      : "IMPACT";
    this.el("mission-complete").hidden = !m.complete;
    this.el("mission-results").textContent =
      `Final score: ${m.score.toLocaleString()} · Targets destroyed: ${m.destroyed} · Mission time: ${duration(m.time)}`;
  }
}
