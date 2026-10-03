import { aircraftConfigs, type AircraftType } from "../aircraft/AircraftConfig";
import { campaign, campaignById } from "../campaign/catalog";
import { save } from "../campaign/SaveManager";
import { upgradeManager } from "../campaign/UpgradeManager";

const clock = (time?: number) =>
  time === undefined
    ? "—"
    : `${Math.floor(time / 60)}:${String(Math.floor(time % 60)).padStart(2, "0")}`;
export class CampaignMenu {
  readonly root = document.createElement("section");
  aircraft: AircraftType = save.data.selectedAircraft;
  selected = `${this.aircraft.toLowerCase()}-01`;
  private stage: "missions" | "loadout" = "missions";
  private confirmReset = false;
  constructor(
    parent: HTMLElement,
    private readonly launch: (aircraft: AircraftType, mission: string) => void,
  ) {
    this.root.className = "campaign-screen";
    this.root.hidden = true;
    parent.append(this.root);
  }
  show(
    aircraft: AircraftType,
    stage: "missions" | "loadout" = "missions",
    missionId?: string,
  ) {
    this.aircraft = aircraft;
    this.stage = stage;
    if (missionId) this.selected = missionId;
    if (campaignById(this.selected)?.aircraft !== aircraft)
      this.selected = `${aircraft.toLowerCase()}-01`;
    this.root.hidden = false;
    for (const sibling of this.root.parentElement!.children)
      if (sibling !== this.root) (sibling as HTMLElement).inert = true;
    this.render();
    this.root
      .querySelector<HTMLButtonElement>("button:not([disabled])")
      ?.focus();
  }
  hide() {
    this.root.hidden = true;
    for (const sibling of this.root.parentElement!.children)
      (sibling as HTMLElement).inert = false;
  }
  private render() {
    const missions = campaign.filter((m) => m.aircraft === this.aircraft);
    const mission = campaignById(this.selected)!;
    const recordCount = missions.filter(
      (m) => save.data.completed[m.id],
    ).length;
    this.root.innerHTML = `<header class="campaign-header"><button class="text-button" id="campaign-back">← ${this.stage === "missions" ? "AIRCRAFT" : "MISSIONS"}</button><div><span class="menu-eyebrow">${this.stage === "missions" ? "OPERATIONS / CAMPAIGN" : "FLIGHT PREPARATION"}</span><h1>${aircraftConfigs[this.aircraft].name}</h1></div><div class="credit-balance"><small>AVAILABLE CREDITS</small><b>${save.data.credits.toLocaleString()} <span>CR</span></b></div></header><p class="save-warning" role="status">${save.warning}</p><div class="campaign-content"></div><footer class="campaign-footer"><span>${recordCount} / 5 OPERATIONS COMPLETE · PROGRESS SAVED LOCALLY</span>${import.meta.env.DEV ? '<button id="reset-save" class="text-button">Reset local progress</button>' : ""}</footer>`;
    this.root.querySelector<HTMLButtonElement>("#campaign-back")!.onclick =
      () => {
        if (this.stage === "loadout") {
          this.stage = "missions";
          this.render();
        } else this.hide();
      };
    const reset = this.root.querySelector<HTMLButtonElement>("#reset-save");
    if (reset)
      reset.onclick = () => {
        if (!this.confirmReset) {
          this.confirmReset = true;
          reset.textContent = "Confirm: erase credits, records and upgrades";
          return;
        }
        save.reset();
        this.confirmReset = false;
        this.stage = "missions";
        this.selected = `${this.aircraft.toLowerCase()}-01`;
        this.render();
      };
    const content = this.root.querySelector<HTMLElement>(".campaign-content")!;
    if (this.stage === "missions") {
      content.innerHTML = `<div class="campaign-heading"><h2>Choose your next horizon.</h2><p>Five operations. One aircraft. Make every sortie count.</p></div><div class="mission-cards">${missions
        .map((m) => {
          const unlocked = save.unlocked(m.prerequisite),
            best = save.data.completed[m.id];
          return `<button class="mission-card terrain-${m.environment.terrain} ${unlocked ? "" : "locked"}" data-mission="${m.id}" ${unlocked ? "" : "disabled"}><div class="mission-art"><span>${m.boss ? "BOSS OPERATION" : `MISSION 0${m.number}`}</span><b>${best?.rank ?? (unlocked ? "↗" : "⌑")}</b></div><div class="mission-card-body"><small>${m.environment.label} / ${m.environment.time}</small><h3>${m.name}</h3><div class="difficulty">${"★".repeat(m.number)}${"☆".repeat(5 - m.number)}</div><p>${m.description}</p><div class="mission-record"><span>BEST SCORE <b>${best?.score.toLocaleString() ?? "—"}</b></span><span>BEST TIME <b>${clock(best?.time)}</b></span><span>RANK <b>${best?.rank ?? "—"}</b></span></div><strong>${unlocked ? (best ? "REPLAY / PREPARE LOADOUT →" : "PREPARE LOADOUT →") : `LOCKED · Complete Mission ${m.number - 1}`}</strong></div></button>`;
        })
        .join("")}</div>`;
      content.querySelectorAll<HTMLButtonElement>("[data-mission]").forEach(
        (button) =>
          (button.onclick = () => {
            this.selected = button.dataset.mission!;
            this.stage = "loadout";
            this.render();
          }),
      );
    } else {
      const profile = upgradeManager.profile(
        aircraftConfigs[this.aircraft],
        mission.bombs,
        mission.missiles,
      );
      content.innerHTML = `<div class="loadout-layout"><aside class="sortie-brief"><span class="menu-eyebrow">MISSION 0${mission.number} / ${mission.environment.time}</span><h2>${mission.name}</h2><p>${mission.description}</p><ul>${mission.objectives.map((o) => `<li>${o.label}</li>`).join("")}</ul><div class="loadout-stats"><span>INTEGRITY <b>${profile.health}</b></span><span>BOMBS / STRIKES <b>${profile.weapons.bombs}</b></span><span>MISSILES <b>${profile.weapons.missiles}</b></span>${this.aircraft === "F35" ? `<span>CANNON <b>${profile.weapons.cannon}</b></span>` : ""}</div><p class="loadout-tip">${this.aircraft === "B2" ? "SPACE: bomb · F: missile · TAB: air target. Line up the IMPACT ring before releasing." : "TAB: lock · F: missile · LMB: cannon · G + SPACE: ground strike · B: afterburner."}<br>ESC pauses. Destroy radar to suppress guided ground fire.</p><button class="start-button" id="launch-campaign">START MISSION <span>→</span></button></aside><section><div class="campaign-heading"><h2>Make it your aircraft.</h2><p>Installed upgrades apply automatically. Level ${upgradeManager.cap(this.aircraft)} available; complete operations to unlock higher tiers.</p></div><div class="upgrade-grid">${upgradeManager
        .list(this.aircraft)
        .map((u) => {
          const level = upgradeManager.level(this.aircraft, u.id),
            cost = upgradeManager.cost(this.aircraft, u.id),
            cap = upgradeManager.cap(this.aircraft);
          return `<article class="upgrade-card"><div><h3>${u.name}</h3><span class="upgrade-level">${"▰".repeat(level)}${"▱".repeat(5 - level)} · ${level}/5</span></div><p>${u.description}</p><button data-upgrade="${u.id}" ${level >= cap || save.data.credits < cost ? "disabled" : ""}>${level === 5 ? "MAX LEVEL" : level >= cap ? "COMPLETE MORE MISSIONS" : `${cost.toLocaleString()} CR · UPGRADE`}</button></article>`;
        })
        .join("")}</div></section></div>`;
      content.querySelector<HTMLButtonElement>("#launch-campaign")!.onclick =
        () => {
          if (save.unlocked(mission.prerequisite))
            this.launch(this.aircraft, mission.id);
        };
      content.querySelectorAll<HTMLButtonElement>("[data-upgrade]").forEach(
        (button) =>
          (button.onclick = () => {
            upgradeManager.purchase(this.aircraft, button.dataset.upgrade!);
            this.render();
          }),
      );
    }
  }
}
