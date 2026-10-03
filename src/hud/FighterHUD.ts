import type { PerspectiveCamera } from "three";
import { CombatHUD } from "./CombatHUD";
import type { FlightModel } from "../physics/FlightModel";
import type { CombatSystem } from "../combat/CombatSystem";
import type { FighterWeapons } from "../combat/FighterWeapons";
import type { FighterTargeting } from "../combat/FighterTargeting";

export class FighterHUD extends CombatHUD {
  constructor(
    parent: HTMLElement,
    private readonly fighter: CombatSystem & {
      weapons: FighterWeapons;
      targeting: FighterTargeting;
    },
    action: (code: string) => void,
    reset: () => void,
  ) {
    super(parent, fighter, action, reset);
    parent.classList.add("fighter-mode");
    parent.querySelector(".aircraft-info h1")!.textContent =
      "F–35 Lightning II";
    parent.querySelector(".aircraft-info .eyebrow")!.textContent =
      "AV–002 / MULTIROLE FIGHTER";
    parent.querySelector(".aircraft-subtitle")!.textContent =
      "FAST HANDS. CLEAR SKIES.";
    parent.querySelector(".session")!.textContent =
      "AIR SUPERIORITY / STRIKE TRAINING";
    parent.querySelector(".mission-panel h2")!.textContent = "AIR SUPERIORITY";
    parent.querySelector(".mission-panel p")!.textContent =
      "Clear four bandits. Strike both sites.";
    parent.querySelector(".strike-hint")!.innerHTML =
      "TAB · AIR TARGET &nbsp; F · MISSILE &nbsp; LMB · CANNON<br>G · GROUND TARGET &nbsp; SPACE · PRECISION STRIKE &nbsp; ESC · PAUSE";
    parent.querySelector("#help-dialog > p")!.textContent =
      "Responsive fighter controls. Keep an air target ahead until the lock ring fills.";
    parent.querySelector(".help-tip")!.textContent =
      "TAB selects air targets; F fires a locked missile. G selects ground targets; SPACE releases a precision weapon. Hold left mouse for cannon (except Orbit camera). Clear all six targets to complete the mission. ESC opens the pause menu.";
    this.el("drop-bomb").childNodes[1].textContent = " STRIKE ";
    this.el("drop-bomb").title = "Release precision strike · Space";
    this.el("fire-missile").title = "Fire locked air-to-air missile · F";
    this.el("mission-complete").querySelector(".eyebrow")!.textContent =
      "AIR SUPERIORITY / DEBRIEF";
    const controls = document.createElement("div");
    controls.className = "fighter-extra";
    controls.innerHTML =
      '<button id="cycle-ground"><kbd>G</kbd> GROUND TARGET</button><button id="fire-cannon">HOLD · CANNON <b id="cannon-count">360</b></button><div id="ground-info"></div>';
    this.el("target-info").after(controls);
    controls.querySelector<HTMLButtonElement>("#cycle-ground")!.onclick = () =>
      action("KeyG");
    const ring = document.createElement("div");
    ring.className = "fighter-reticle";
    ring.innerHTML = '<i></i><span id="lock-status">SCAN</span>';
    this.root.append(ring);
  }
  override update(dt: number, flight: FlightModel, camera: PerspectiveCamera) {
    super.update(dt, flight, camera);
    const { targeting: t, weapons: w } = this.fighter;
    const status = !t.selected
      ? "SCAN"
      : flight.position.distanceTo(t.selected.position) >= t.range
        ? "OUT OF RANGE"
        : t.valid(flight.position)
          ? "LOCKED"
          : t.inCone
            ? `ACQUIRING ${Math.round(t.progress * 100)}%`
            : "TURN TO TARGET";
    this.root.querySelector("#lock-status")!.textContent = status;
    this.root
      .querySelector<HTMLElement>(".fighter-reticle")!
      .style.setProperty("--lock-progress", `${t.progress * 360}deg`);
    this.root
      .querySelector<HTMLElement>(".fighter-reticle")!
      .classList.toggle("locked", t.valid(flight.position));
    this.root.querySelector("#cannon-count")!.textContent = String(
      w.cannonAmmo,
    );
    const target = t.selected;
    this.el("target-info").innerHTML = target
      ? `<b>TARGET · ${target.id}</b><span>${(flight.position.distanceTo(target.position) / 1000).toFixed(1)} km · HEALTH ${Math.round((target.health / target.maxHealth) * 100)}%</span><strong>${status}</strong>`
      : "NO AIR TARGET · TAB TO SELECT";
    const ground = w.groundTarget;
    this.root
      .querySelectorAll<HTMLElement>(".ground-marker")
      .forEach((marker) => {
        marker.classList.toggle(
          "selected",
          marker.querySelector("span")?.textContent === ground?.id,
        );
      });
    this.root.querySelector("#ground-info")!.textContent = ground
      ? `${ground.id} · ${ground.destroyed ? "DESTROYED" : `${(flight.position.distanceTo(ground.position) / 1000).toFixed(1)} km · ${ground.health} HP`}`
      : "NO GROUND DESIGNATION";
    this.el("fire-missile").classList.toggle(
      "active",
      w.selected === "AIR-TO-AIR",
    );
    this.el("drop-bomb").classList.toggle(
      "active",
      w.selected === "PRECISION STRIKE",
    );
  }
}
