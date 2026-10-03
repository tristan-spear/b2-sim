import type { AircraftType, AircraftConfig } from "../aircraft/AircraftConfig";
import { SaveManager, save } from "./SaveManager";

export interface UpgradeDefinition {
  id: string;
  name: string;
  description: string;
  cost: number;
  aircraft?: AircraftType;
}
export const upgrades: UpgradeDefinition[] = [
  {
    id: "armor",
    name: "Armor",
    description: "+18% integrity and 3% damage resistance per level",
    cost: 700,
  },
  {
    id: "engine",
    name: "Engine",
    description: "+4% thrust, +8% acceleration and throttle response",
    cost: 850,
  },
  {
    id: "handling",
    name: "Maneuverability",
    description: "Smoother pitch, roll and turns; stronger gains for fighters",
    cost: 800,
  },
  {
    id: "damage",
    name: "Weapon damage",
    description: "+10% bomb, missile and cannon damage",
    cost: 950,
  },
  {
    id: "capacity",
    name: "Weapon capacity",
    description: "+1 bomb, +1 missile and +45 cannon rounds",
    cost: 900,
  },
  {
    id: "cooldown",
    name: "Weapon cycling",
    description: "8% shorter weapon cooldowns per level",
    cost: 650,
  },
  {
    id: "payload",
    name: "Bomb payload",
    description: "+2 bombs per level",
    cost: 700,
    aircraft: "B2",
  },
  {
    id: "blast",
    name: "Blast power",
    description: "+10% blast radius per level",
    cost: 1100,
    aircraft: "B2",
  },
  {
    id: "heavy-armor",
    name: "Heavy armor",
    description: "+12% integrity and 2% damage resistance",
    cost: 950,
    aircraft: "B2",
  },
  {
    id: "efficiency",
    name: "Engine efficiency",
    description: "+10% acceleration and +2% sustained thrust",
    cost: 800,
    aircraft: "B2",
  },
  {
    id: "missiles",
    name: "Missile capacity",
    description: "+2 air-to-air missiles per level",
    cost: 850,
    aircraft: "F35",
  },
  {
    id: "missile-damage",
    name: "Missile damage",
    description: "+12% missile damage per level",
    cost: 1000,
    aircraft: "F35",
  },
  {
    id: "cannon",
    name: "Cannon package",
    description: "+10% cannon damage and +75 rounds",
    cost: 650,
    aircraft: "F35",
  },
  {
    id: "dogfight",
    name: "Dogfight handling",
    description: "+6% response and turning power per level",
    cost: 1000,
    aircraft: "F35",
  },
  {
    id: "afterburner",
    name: "Afterburner",
    description: "B: temporary boost. Upgrades extend duration and thrust",
    cost: 1000,
    aircraft: "F35",
  },
];
export class UpgradeManager {
  constructor(readonly progress: SaveManager = save) {}
  list(aircraft: AircraftType) {
    return upgrades.filter((u) => !u.aircraft || u.aircraft === aircraft);
  }
  level(aircraft: AircraftType, id: string) {
    return this.progress.data.upgrades[aircraft][id] ?? 1;
  }
  cost(aircraft: AircraftType, id: string) {
    const def = this.list(aircraft).find((u) => u.id === id);
    return def
      ? Math.round(def.cost * this.level(aircraft, id) ** 1.35)
      : Infinity;
  }
  cap(aircraft: AircraftType) {
    return Math.min(
      5,
      2 +
        Object.keys(this.progress.data.completed).filter((id) =>
          id.startsWith(aircraft.toLowerCase()),
        ).length,
    );
  }
  purchase(aircraft: AircraftType, id: string) {
    const cost = this.cost(aircraft, id),
      level = this.level(aircraft, id);
    if (
      level >= this.cap(aircraft) ||
      this.progress.data.credits < cost ||
      !Number.isFinite(cost)
    )
      return false;
    this.progress.data.credits -= cost;
    this.progress.data.upgrades[aircraft][id] = level + 1;
    this.progress.persist();
    return true;
  }
  profile(config: AircraftConfig, bombs: number, missiles: number) {
    const type = config.id,
      n = (id: string) => this.level(type, id) - 1;
    const fighter = type === "F35";
    const handling =
      1 + n("handling") * (fighter ? 0.075 : 0.035) + n("dogfight") * 0.06;
    return {
      flight: {
        ...config.flight,
        thrust:
          config.flight.thrust *
          (1 + n("engine") * 0.04 + n("efficiency") * 0.02),
        acceleration:
          config.flight.acceleration *
          (1 + n("engine") * 0.08 + n("efficiency") * 0.1),
        throttleResponse: 1 + n("engine") * 0.08,
        pitchRate: config.flight.pitchRate * handling,
        rollRate: config.flight.rollRate * handling,
        bankForce: config.flight.bankForce * handling,
        yawRate: config.flight.yawRate * handling,
      },
      health: Math.round(
        (fighter ? 180 : 300) *
          (1 + n("armor") * 0.18 + n("heavy-armor") * 0.12),
      ),
      resistance: Math.min(0.28, n("armor") * 0.03 + n("heavy-armor") * 0.02),
      weapons: {
        bombs: bombs + n("capacity") + n("payload") * 2,
        missiles: missiles + n("capacity") + n("missiles") * 2,
        cannon: 360 + n("capacity") * 45 + n("cannon") * 75,
        damage: 1 + n("damage") * 0.1,
        missileDamage: 1 + n("missile-damage") * 0.12,
        cannonDamage: 1 + n("cannon") * 0.1,
        blastRadius: 190 * (1 + n("blast") * 0.1),
        cooldown: 1 - n("cooldown") * 0.08,
      },
      boost: fighter
        ? {
            duration: 3 + n("afterburner") * 0.7,
            force: 1.3 + n("afterburner") * 0.04,
          }
        : undefined,
    };
  }
}
export const upgradeManager = new UpgradeManager();
export type UpgradeProfile = ReturnType<UpgradeManager["profile"]>;
