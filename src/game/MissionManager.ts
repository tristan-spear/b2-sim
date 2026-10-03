import { CombatSystem } from "../combat/CombatSystem";
import { F35TrainingMission } from "../missions/F35TrainingMission";
import type { FlightModel } from "../physics/FlightModel";
import type { CombatSound } from "../combat/WeaponManager";
import { CombatHUD } from "../hud/CombatHUD";
import { FighterHUD } from "../hud/FighterHUD";
import type { AircraftType } from "../aircraft/AircraftConfig";
import { campaign } from "../campaign/catalog";
import { CampaignCombat } from "../campaign/CampaignCombat";
import { CampaignHUD } from "../hud/CampaignHUD";
import type { CampaignMissionConfig } from "../campaign/types";

export interface MissionDefinition {
  id: string;
  aircraft: AircraftType;
  title: string;
  briefing: string;
  campaign?: CampaignMissionConfig;
  create: (
    flight: FlightModel,
    sound: (kind: CombatSound) => void,
  ) => CombatSystem;
  createHUD: (
    parent: HTMLElement,
    combat: CombatSystem,
    action: (code: string) => void,
    reset: () => void,
  ) => Pick<CombatHUD, "update">;
}
export class MissionManager {
  private readonly definitions = new Map<string, MissionDefinition>();
  register(mission: MissionDefinition) {
    if (this.definitions.has(mission.id))
      throw new Error(`Duplicate mission: ${mission.id}`);
    this.definitions.set(mission.id, mission);
  }
  forAircraft(aircraft: MissionDefinition["aircraft"]) {
    return [...this.definitions.values()].filter(
      (m) => m.aircraft === aircraft,
    );
  }
  get(id: string) {
    const mission = this.definitions.get(id);
    if (!mission) throw new Error(`Unknown mission: ${id}`);
    return mission;
  }
  resolve(id: string, aircraft: AircraftType) {
    const mission = this.get(id);
    if (mission.aircraft !== aircraft)
      throw new Error(`Mission ${id} is not available for ${aircraft}`);
    return mission;
  }
}
export const missions = new MissionManager();
missions.register({
  id: "b2-training",
  aircraft: "B2",
  title: "Training strike",
  briefing:
    "A quiet approach. A decisive strike. Neutralize the radar, command site, and three aircraft over Sierra Range.",
  create: (flight, sound) => new CombatSystem(flight, sound),
  createHUD: (parent, combat, action, reset) =>
    new CombatHUD(parent, combat, action, reset),
});
for (const config of campaign)
  missions.register({
    id: config.id,
    aircraft: config.aircraft,
    title: config.name,
    briefing: config.description,
    campaign: config,
    create: (flight, sound) => new CampaignCombat(flight, sound, config),
    createHUD: (parent, combat, action, reset) =>
      new CampaignHUD(parent, combat as CampaignCombat, action, reset),
  });
missions.register({
  id: "f35-training",
  aircraft: "F35",
  title: "Air superiority / strike training",
  briefing:
    "Own the airspace. Eliminate four hostile fighters, then destroy the designated radar and command targets.",
  create: (flight, sound) => new F35TrainingMission(flight, sound),
  createHUD: (parent, combat, action, reset) =>
    new FighterHUD(parent, combat as F35TrainingMission, action, reset),
});
