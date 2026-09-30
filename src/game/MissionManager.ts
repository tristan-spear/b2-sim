import { CombatSystem } from "../combat/CombatSystem";
import { F35TrainingMission } from "../missions/F35TrainingMission";
import type { FlightModel } from "../physics/FlightModel";
import type { CombatSound } from "../combat/WeaponManager";
import { CombatHUD } from "../hud/CombatHUD";
import { FighterHUD } from "../hud/FighterHUD";

export interface MissionDefinition {
  id: string;
  aircraft: "B2" | "F35";
  title: string;
  briefing: string;
  create: (
    flight: FlightModel,
    sound: (kind: CombatSound) => void,
  ) => CombatSystem;
  createHUD: (
    parent: HTMLElement,
    combat: CombatSystem,
    action: (code: string) => void,
    reset: () => void,
  ) => CombatHUD;
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
