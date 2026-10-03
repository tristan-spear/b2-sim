import { PerspectiveCamera, Vector3 } from "three";
import { CombatHUD } from "./CombatHUD";
import { FighterHUD } from "./FighterHUD";
import type { CampaignCombat } from "../campaign/CampaignCombat";
import type { FighterWeapons } from "../combat/FighterWeapons";
import type { FighterTargeting } from "../combat/FighterTargeting";
import type { FlightModel } from "../physics/FlightModel";
import { nextCampaignMission } from "../campaign/catalog";

export class CampaignHUD {
  readonly base: CombatHUD;
  private readonly panel = document.createElement("div");
  private readonly navigation = document.createElement("div");
  private readonly lead = document.createElement("div");
  private elapsed = 1;
  private shownResult = "";
  private failedShown = false;
  private readonly friendlyMarkers = new Map<string, HTMLElement>();
  constructor(
    private readonly parent: HTMLElement,
    private readonly combat: CampaignCombat,
    action: (code: string) => void,
    reset: () => void,
  ) {
    this.base =
      combat.definition.aircraft === "F35"
        ? new FighterHUD(
            parent,
            combat as CampaignCombat & {
              weapons: FighterWeapons;
              targeting: FighterTargeting;
            },
            action,
            reset,
          )
        : new CombatHUD(parent, combat, action, reset);
    parent.classList.add("campaign-mode");
    parent.querySelector(".session")!.textContent =
      `${combat.definition.name.toUpperCase()} / ${combat.definition.environment.label.toUpperCase()}`;
    parent.querySelector(".mission-panel h2")!.textContent =
      combat.definition.name.toUpperCase();
    parent.querySelector(".mission-panel p")!.textContent =
      `${combat.definition.environment.label} · ${combat.definition.environment.time}`;
    parent.querySelector(".mission-panel .eyebrow")!.firstChild!.textContent =
      `MISSION / 00${combat.definition.number} `;
    this.panel.className = "campaign-feedback";
    this.panel.innerHTML = `<div class="integrity-panel"><span>AIRCRAFT INTEGRITY <b id="integrity-value">100%</b></span><div class="integrity-track"><i id="integrity-fill"></i></div><small id="integrity-warning"></small>${combat.profile.boost ? '<button id="boost-button">B · AFTERBURNER</button>' : ""}</div><div id="incoming-warning" role="status"></div><div id="damage-direction">▼</div><div id="damage-flash"></div><div id="radio-message" role="status"></div><div id="boss-panel" hidden><span id="boss-name"></span><div><i id="boss-health"></i></div><small id="boss-phase"></small></div><div id="friendly-status"></div><div id="campaign-failed" class="pause-overlay" hidden><div class="pause-card"><div class="eyebrow">SORTIE LOST</div><h2>MISSION FAILED</h2><p id="failure-reason"></p><button id="retry-campaign" class="primary-button">Retry mission ↗</button><button class="text-button result-upgrades">Upgrades</button><button class="text-button campaign-home">Main menu</button></div></div>`;
    parent.append(this.panel);
    this.navigation.className = "world-marker navigation-marker";
    this.navigation.innerHTML = "<i></i><span></span>";
    this.panel.append(this.navigation);
    this.lead.className = "target-lead";
    this.panel.append(this.lead);
    for (const friendly of combat.friendly) {
      const marker = document.createElement("div");
      marker.className = "world-marker friendly-marker";
      marker.innerHTML = "<i></i><span></span>";
      this.panel.append(marker);
      this.friendlyMarkers.set(friendly.id, marker);
    }
    this.el("retry-campaign").onclick = reset;
    this.panel
      .querySelector<HTMLButtonElement>("#boost-button")
      ?.addEventListener("click", () => action("KeyB"));
    const complete = parent.querySelector("#mission-complete .pause-card")!;
    complete.innerHTML =
      '<div class="eyebrow">OPERATION DEBRIEF</div><h2>MISSION COMPLETE</h2><div class="result-rank" id="result-rank"></div><div id="mission-results"></div><div class="result-actions"><button class="primary-button" id="next-mission">Next mission →</button><button class="text-button" id="restart-mission">Replay</button><button class="text-button result-upgrades">Upgrades</button><button class="text-button campaign-home">Main menu</button></div>';
    // Keep the base HUD's cached result elements; its old detached nodes are harmless,
    // while the campaign debrief is rendered once from the persisted result.
    parent.querySelector<HTMLButtonElement>("#restart-mission")!.onclick =
      reset;
    parent.querySelector("#help-dialog > p")!.textContent =
      "Complete objectives, earn credits and improve your aircraft between sorties.";
    parent.querySelector(".help-tip")!.textContent +=
      " Campaign: destroy radar to suppress missile batteries. Follow checkpoint and extraction beacons. B engages the F-35 afterburner. Armor and loadout upgrades are installed in the campaign menu.";
  }
  private el(id: string) {
    return this.panel.querySelector<HTMLElement>(`#${id}`)!;
  }
  private project(
    element: HTMLElement,
    point: Vector3,
    camera: PerspectiveCamera,
  ) {
    const projected = point.clone().project(camera),
      local = point.clone().applyMatrix4(camera.matrixWorldInverse);
    const off =
      local.z > 0 ||
      Math.abs(projected.x) > 0.88 ||
      Math.abs(projected.y) > 0.68;
    const sign = local.z > 0 ? -1 : 1;
    element.style.left = `${(Math.max(-0.88, Math.min(0.88, projected.x * sign)) * 0.5 + 0.5) * 100}%`;
    element.style.top = `${(-Math.max(-0.68, Math.min(0.68, projected.y * sign)) * 0.5 + 0.5) * 100}%`;
    element.classList.toggle("offscreen", off);
    return !off;
  }
  update(dt: number, flight: FlightModel, camera: PerspectiveCamera) {
    this.base.update(dt, flight, camera);
    const c = this.combat;
    this.el("damage-flash").style.opacity = String(c.player.flash * 0.4);
    this.elapsed += dt;
    if (this.elapsed < 0.1) return;
    this.elapsed = 0;
    this.parent.querySelector("#objectives")!.innerHTML =
      c.mission.objectives.entries
        .map(
          (o) =>
            `<div class="${o.complete ? "done" : ""} ${o.active ? "" : "objective-pending"}">${o.complete ? "✓" : "□"} ${o.config.label}${o.total > 1 ? ` <b>${Math.min(o.total, Math.floor(o.progress))}/${o.total}</b>` : ""}</div>`,
        )
        .join("");
    const integrity = Math.round((c.player.health / c.player.max) * 100);
    this.el("integrity-value").textContent = `${integrity}%`;
    this.el("integrity-fill").style.width = `${integrity}%`;
    this.panel.classList.toggle("critical", integrity < 35);
    this.el("integrity-warning").textContent =
      integrity < 35
        ? "CRITICAL DAMAGE · BREAK AWAY"
        : c.player.flash > 0
          ? "HOSTILE IMPACT"
          : `${Math.ceil(c.player.health)} / ${c.player.max}`;
    this.el("incoming-warning").textContent = c.hostileFire.incoming
      ? "⚠ INCOMING MISSILE · TURN TO EVADE"
      : "";
    this.el("radio-message").textContent = c.radioTime > 0 ? c.radio : "";
    const source =
      c.player.flash > 0 ? c.player.lastSource : c.hostileFire.nearest?.source;
    this.el("damage-direction").hidden = !source;
    if (source) {
      const bearing =
        (Math.atan2(
          source.x - flight.position.x,
          -(source.z - flight.position.z),
        ) *
          180) /
        Math.PI;
      this.el("damage-direction").style.transform =
        `translateX(-50%) rotate(${bearing - flight.heading}deg)`;
    }
    this.el("boss-panel").hidden = !c.boss.active || !c.definition.boss;
    this.el("boss-name").textContent = c.boss.name;
    this.el("boss-health").style.width = `${Math.max(0, c.boss.health) * 100}%`;
    this.el("boss-phase").textContent =
      `PHASE ${c.boss.phase} / ${c.boss.instruction}`;
    this.el("friendly-status").textContent = c.friendly
      .map((f) => `${f.id} ${Math.round((f.health / f.maxHealth) * 100)}%`)
      .join(" · ");
    for (const friendly of c.friendly) {
      const marker = this.friendlyMarkers.get(friendly.id)!;
      this.project(
        marker,
        friendly.position.clone().add(new Vector3(0, 130, 0)),
        camera,
      );
      marker.querySelector("span")!.textContent =
        `${friendly.id} · ${Math.round((friendly.health / friendly.maxHealth) * 100)}%`;
    }
    const boost = this.panel.querySelector<HTMLButtonElement>("#boost-button");
    if (boost) {
      boost.textContent =
        c.boostTime > 0
          ? `BOOST ${c.boostTime.toFixed(1)}s`
          : c.boostCooldown > 0
            ? `RECHARGING ${Math.ceil(c.boostCooldown)}s`
            : "B · AFTERBURNER";
      boost.disabled = c.boostCooldown > 0;
    }
    const nav = c.mission.objectives.entries.find(
      (o) => o.active && !o.complete && o.config.locations,
    );
    this.navigation.hidden = !nav;
    if (nav) {
      const point = new Vector3(
        ...nav.config.locations![
          Math.min(nav.progress, nav.config.locations!.length - 1)
        ],
      );
      this.project(this.navigation, point, camera);
      this.navigation.querySelector("span")!.textContent =
        `${nav.config.type === "CHECKPOINTS" ? `GATE ${nav.progress + 1}` : "EXTRACTION"} · ${(point.distanceTo(flight.position) / 1000).toFixed(1)} km`;
    }
    const target = c.targeting.selected;
    this.lead.hidden = !target || c.definition.aircraft !== "F35";
    if (target) {
      const position = target.position
        .clone()
        .addScaledVector(
          target.velocity,
          target.position.distanceTo(flight.position) / 2400,
        );
      this.lead.hidden =
        !this.project(this.lead, position, camera) ||
        c.definition.aircraft !== "F35";
    }
    if (c.definition.boss === "iron-shield")
      this.base.root
        .querySelectorAll<HTMLElement>(".ground-marker")
        .forEach((marker) => {
          const target = c.compound.targets.find(
            (g) => g.id === marker.querySelector("span")?.textContent,
          );
          marker.classList.toggle("shielded", !!target && !target.vulnerable);
        });
    this.el("campaign-failed").hidden = !c.failed;
    if (c.failed) {
      this.el("failure-reason").textContent = c.mission.failure;
      this.parent.querySelector<HTMLElement>("#pause-overlay")!.hidden = true;
      if (!this.failedShown) {
        this.failedShown = true;
        this.el("retry-campaign").focus();
      }
    } else this.failedShown = false;
    if (c.result && this.shownResult !== c.result.runId) {
      const r = c.result;
      this.shownResult = r.runId;
      this.parent.querySelector("#result-rank")!.textContent = r.rank;
      this.parent.querySelector("#mission-results")!.innerHTML =
        `<div class="result-grid"><span>SCORE<b>${r.score.toLocaleString()}</b></span><span>TIME<b>${Math.floor(r.time / 60)}:${String(Math.floor(r.time % 60)).padStart(2, "0")}</b></span><span>AIR / GROUND<b>${r.air} / ${r.ground}</b></span><span>ACCURACY<b>${Math.round(r.accuracy * 100)}%</b></span><span>DAMAGE TAKEN<b>${Math.round(r.damageTaken)}</b></span><span>OPTIONALS<b>${r.optional} / ${r.optionalTotal}</b></span></div><div class="result-credits">+${r.credits.toLocaleString()} CR</div>`;
      const next =
        this.parent.querySelector<HTMLButtonElement>("#next-mission")!;
      next.hidden = !nextCampaignMission(c.definition.id);
      (next.hidden
        ? this.parent.querySelector<HTMLElement>("#restart-mission")!
        : next
      ).focus();
    }
  }
}
