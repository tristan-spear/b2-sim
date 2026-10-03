import type { CampaignGround } from "./CampaignGround";
import type { CampaignFighter } from "../enemies/CampaignFighter";
import type { CampaignMissionConfig } from "./types";

export class BossController {
  phase = 1;
  defeated = false;
  active = false;
  constructor(
    readonly kind: CampaignMissionConfig["boss"],
    private readonly ground: CampaignGround[],
    private readonly aircraft: CampaignFighter[],
  ) {
    this.update();
  }
  get name() {
    return this.kind === "iron-shield" ? "IRON SHIELD" : "RAVEN ONE";
  }
  get health() {
    if (this.kind === "iron-shield")
      return (
        this.ground.reduce((n, t) => n + t.health, 0) /
        this.ground.reduce((n, t) => n + t.maxHealth, 0)
      );
    const ace = this.aircraft.find((a) => a.definition.role === "boss");
    return ace ? ace.health / ace.maxHealth : 1;
  }
  get instruction() {
    return this.kind === "iron-shield"
      ? [
          "RADAR ARRAYS EXPOSED · Break the shield",
          "DEFENSE RING EXPOSED · Turrets and launch tower",
          "COMMAND CORE EXPOSED · Finish the installation",
        ][this.phase - 1]
      : [
          "MISSILE DUEL · Watch the approach",
          "ACE PURSUIT · Faster turns and double volleys",
          "FINAL ATTACK · Unstable evasive pattern",
        ][this.phase - 1];
  }
  update() {
    if (!this.kind) return;
    if (this.kind === "iron-shield") {
      this.active = true;
      this.phase = this.ground
        .filter((t) => t.definition.phase === 1)
        .some((t) => !t.destroyed)
        ? 1
        : this.ground
              .filter((t) => t.definition.phase === 2)
              .some((t) => !t.destroyed)
          ? 2
          : 3;
      this.ground.forEach((t) => {
        t.vulnerable = t.definition.phase === this.phase;
        t.material.emissive.setHex(t.vulnerable && !t.destroyed ? 0x291309 : 0);
      });
      this.defeated = this.ground.every((t) => t.destroyed);
    } else {
      const ace = this.aircraft.find((a) => a.definition.role === "boss");
      this.active = Boolean(ace?.active);
      if (ace) {
        this.phase =
          ace.health / ace.maxHealth > 0.66
            ? 1
            : ace.health / ace.maxHealth > 0.33
              ? 2
              : 3;
        ace.bossPhase = this.phase;
        this.defeated = ace.active && ace.destroyed;
      }
    }
  }
  reset() {
    this.phase = 1;
    this.defeated = this.active = false;
    this.update();
  }
}
