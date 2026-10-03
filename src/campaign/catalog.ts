import type {
  AirConfig,
  CampaignMissionConfig,
  EnvironmentConfig,
  GroundConfig,
  ObjectiveConfig,
  Point,
} from "./types";

const env = (
  terrain: EnvironmentConfig["terrain"],
  time: EnvironmentConfig["time"],
  label: string,
  clouds = 0.6,
  weather: EnvironmentConfig["weather"] = "clear",
): EnvironmentConfig => ({ terrain, time, label, clouds, weather });
const ground = (
  id: string,
  kind: GroundConfig["kind"],
  x: number,
  z: number,
  extra: Partial<GroundConfig> = {},
): GroundConfig => ({ id, kind, x, z, ...extra });
const destroy = (
  id: string,
  label: string,
  targets: string[],
  optional = false,
): ObjectiveConfig => ({
  id,
  type: targets.length > 1 ? "DESTROY_TARGETS" : "DESTROY_TARGET",
  label,
  targets,
  optional,
});
const air = (
  count: number,
  wave = 0,
  role: AirConfig["role"] = "fighter",
): AirConfig[] =>
  Array.from({ length: count }, (_, i) => ({
    id: `${role === "strike" ? "STRIKER" : "BANDIT"} ${wave + 1}-${i + 1}`,
    wave,
    role,
  }));
const kills = (count: number): ObjectiveConfig => ({
  id: "air",
  type: "DESTROY_AIRCRAFT",
  label: "Clear hostile aircraft",
  count,
});
const escape = (
  after: string[],
  location: Point = [600, 2400, -6500],
): ObjectiveConfig => ({
  id: "escape",
  type: "REACH_LOCATION",
  label: "Reach the extraction gate",
  locations: [location],
  radius: 1100,
  after,
});
const b2 = (
  number: number,
  name: string,
  description: string,
  environment: EnvironmentConfig,
  ground: GroundConfig[],
  objectives: ObjectiveConfig[],
  enemies: AirConfig[] = [],
): CampaignMissionConfig => ({
  id: `b2-0${number}`,
  aircraft: "B2",
  number,
  name,
  description,
  environment,
  spawn: [
    600,
    environment.terrain === "snow"
      ? 3100
      : environment.terrain === "desert"
        ? 1800
        : 2600,
    4200,
  ],
  ground,
  objectives,
  air: enemies,
  reward: 900 + number * 250,
  parTime: 180 + number * 50,
  prerequisite: number > 1 ? `b2-0${number - 1}` : undefined,
  bombs: number === 5 ? 20 : 10 + number * 2,
  missiles: 6,
});
const f35 = (
  number: number,
  name: string,
  description: string,
  environment: EnvironmentConfig,
  ground: GroundConfig[],
  objectives: ObjectiveConfig[],
  enemies: AirConfig[],
): CampaignMissionConfig => ({
  id: `f35-0${number}`,
  aircraft: "F35",
  number,
  name,
  description,
  environment,
  spawn: [
    600,
    number === 5 ? 3900 : environment.terrain === "canyon" ? 1000 : 2400,
    4200,
  ],
  ground,
  objectives,
  air: enemies,
  reward: 900 + number * 250,
  parTime: 130 + number * 40,
  prerequisite: number > 1 ? `f35-0${number - 1}` : undefined,
  bombs: 4,
  missiles: number === 1 ? 6 : number === 5 ? 14 : 8 + number,
});

export const campaign: CampaignMissionConfig[] = [
  b2(
    1,
    "Desert Strike",
    "A quiet approach over the dunes. Bomb three supply installations and their radar, then follow the extraction beacon. Light defenses leave room to learn your release point.",
    env("desert", "afternoon", "Saffron Desert", 0.2),
    [
      ground("SUPPLY ALPHA", "small", 600, -1000),
      ground("SUPPLY BRAVO", "hangar", 600, -1600),
      ground("SUPPLY CHARLIE", "small", 600, -2200),
      ground("RADAR", "radar", 600, -2850),
      ground("AA SENTRY", "small", 980, -1800, { defense: "aa" }),
    ],
    [
      destroy("supplies", "Destroy supply installations", [
        "SUPPLY ALPHA",
        "SUPPLY BRAVO",
        "SUPPLY CHARLIE",
      ]),
      destroy("radar", "Destroy the radar station", ["RADAR"]),
      escape(["supplies", "radar"], [600, 1800, -6000]),
    ],
  ),
  b2(
    2,
    "Mountain Fortress",
    "Follow the valley to two hardened depots and the communications tower. Radar supports the missile battery: taking it out buys a quieter bombing run.",
    env("mountains", "morning", "Kestrel Valley", 0.55),
    [
      ground("DEPOT WEST", "hangar", 300, -1000, { health: 240 }),
      ground("DEPOT EAST", "hangar", 850, -1900, { health: 240 }),
      ground("COMMS", "radar", 600, -2850),
      ground("FIRE CONTROL", "radar", 1200, -2200),
      ground("AA WEST", "small", 0, -1700, { defense: "aa" }),
      ground("BATTERY", "small", 1100, -2700, { defense: "battery" }),
    ],
    [
      destroy("depots", "Destroy fortified depots", [
        "DEPOT WEST",
        "DEPOT EAST",
      ]),
      destroy("comms", "Destroy communications tower", ["COMMS"]),
      {
        id: "survive",
        type: "SURVIVE",
        seconds: 45,
        label: "Survive the defense network",
      },
    ],
    air(2),
  ),
  b2(
    3,
    "Night Raid",
    "Moonlight reveals a forest radar network. Silence its arrays and command center. Optional fuel stores earn extra credits, but every additional pass is a risk.",
    env("forest", "night", "Blackpine Highlands", 0.4),
    [
      ground("ARRAY NORTH", "radar", 250, -600),
      ground("ARRAY SOUTH", "radar", 900, -1900),
      ground("COMMAND", "command", 600, -3000, { health: 300 }),
      ground("FUEL WEST", "small", 150, -2500),
      ground("FUEL EAST", "small", 1100, -3100),
      ground("BATTERY NORTH", "small", 1200, -900, { defense: "battery" }),
      ground("BATTERY SOUTH", "small", -150, -2800, { defense: "battery" }),
      ground("AA RIDGE", "small", 700, -2400, { defense: "aa" }),
    ],
    [
      destroy("radar", "Silence the radar network", [
        "ARRAY NORTH",
        "ARRAY SOUTH",
      ]),
      destroy("command", "Destroy command center", ["COMMAND"]),
      destroy(
        "fuel",
        "Optional: destroy fuel stores",
        ["FUEL WEST", "FUEL EAST"],
        true,
      ),
    ],
    air(3),
  ),
  b2(
    4,
    "Coastal Assault",
    "Sweep the coastal defenses, strike the relay and catch the moving convoy. A second fighter patrol responds after the first falls. Extract over open water.",
    env("coastline", "sunset", "Ember Coast", 0.65),
    [
      ground("COASTAL AA", "small", 600, -700, {
        defense: "heavy",
        health: 260,
      }),
      ground("COASTAL BATTERY", "small", 600, -1800, { defense: "battery" }),
      ground("RELAY", "command", 1000, -2800, { health: 300 }),
      ground("RADAR", "radar", 1000, -900),
      ground("CONVOY 1", "small", 300, -2800, {
        moving: true,
        size: [35, 20, 70],
      }),
      ground("CONVOY 2", "small", 350, -3100, {
        moving: true,
        size: [35, 20, 70],
      }),
    ],
    [
      destroy("defenses", "Destroy coastal defenses", [
        "COASTAL AA",
        "COASTAL BATTERY",
      ]),
      destroy("relay", "Destroy the communications relay", ["RELAY"]),
      destroy("convoy", "Destroy the moving convoy", ["CONVOY 1", "CONVOY 2"]),
      escape(["defenses", "relay", "convoy"], [-2600, 2100, -6500]),
    ],
    [...air(2), ...air(2, 1)],
  ),
  {
    ...b2(
      5,
      "Iron Shield",
      "A fortress above the snowline. Expose its weak points in sequence: radar arrays, defense ring, then the command core. Preserve your payload for the final pass.",
      env("snow", "storm", "Whitefall Citadel", 1, "snow"),
      [
        ground("ARRAY WEST", "radar", 50, -400, {
          phase: 1,
          health: 170,
          size: [90, 140, 90],
        }),
        ground("ARRAY EAST", "radar", 1150, -400, {
          phase: 1,
          health: 170,
          size: [90, 140, 90],
        }),
        ground("BASTION WEST", "hangar", 100, -1300, {
          phase: 2,
          defense: "heavy",
          health: 260,
          size: [150, 100, 150],
        }),
        ground("BASTION EAST", "hangar", 1100, -1300, {
          phase: 2,
          defense: "heavy",
          health: 260,
          size: [150, 100, 150],
        }),
        ground("LAUNCH TOWER", "hangar", 600, -2100, {
          phase: 2,
          defense: "battery",
          health: 280,
          size: [100, 170, 100],
        }),
        ground("IRON SHIELD CORE", "command", 600, -3200, {
          phase: 3,
          health: 750,
          size: [300, 200, 280],
        }),
      ],
      [
        destroy("arrays", "Destroy outer radar arrays", [
          "ARRAY WEST",
          "ARRAY EAST",
        ]),
        {
          ...destroy("ring", "Destroy turrets and missile tower", [
            "BASTION WEST",
            "BASTION EAST",
            "LAUNCH TOWER",
          ]),
          after: ["arrays"],
        },
        {
          id: "boss",
          type: "DESTROY_BOSS",
          label: "Destroy Iron Shield command core",
          after: ["ring"],
        },
      ],
      [...air(2, 1), ...air(2, 2)],
    ),
    boss: "iron-shield",
    parTime: 520,
  },
  f35(
    1,
    "Sky Patrol",
    "Three contacts over the green hills. Hold a target ahead to acquire a missile lock, or close to cannon range. Optional cannon practice earns a bonus.",
    env("forest", "morning", "Verdant Downs", 0.35),
    [],
    [kills(3)],
    air(3),
  ),
  f35(
    2,
    "Canyon Run",
    "Fly the canyon gates while clearing three fighters and two gun positions. The checkpoint ribbon follows the low passage; climb when you need room to fight.",
    env("canyon", "midday", "Redstone Canyon", 0.15),
    [
      ground("CANYON AA", "small", 950, -600, { defense: "aa" }),
      ground("PASS AA", "small", 900, -3000, { defense: "aa" }),
    ],
    [
      kills(3),
      {
        id: "gates",
        type: "CHECKPOINTS",
        label: "Navigate canyon gates",
        locations: [
          [600, 800, 2300],
          [300, 800, 500],
          [750, 800, -1800],
        ],
        radius: 480,
      },
      destroy("guns", "Destroy both ground defenses", ["CANYON AA", "PASS AA"]),
    ],
    air(3),
  ),
  {
    ...f35(
      3,
      "City Defense",
      "Three friendly districts are under attack. Intercept successive fighter and strike waves before their visible attack runs reach the city. All three sites must survive.",
      env("city", "night", "Lumen City", 0.4),
      [],
      [
        kills(7),
        {
          id: "defend",
          type: "DEFEND",
          label: "Protect all three districts",
          targets: ["HOSPITAL", "POWER GRID", "EVACUATION"],
          after: ["air"],
        },
      ],
      [...air(3), ...air(2, 1, "strike"), ...air(1, 2, "strike"), ...air(1, 2)],
    ),
    friendly: [
      { id: "HOSPITAL", position: [-1300, 0, -600] },
      { id: "POWER GRID", position: [1600, 0, -1500] },
      { id: "EVACUATION", position: [100, 0, -2800] },
    ],
  },
  f35(
    4,
    "Storm Front",
    "Break a radar screen across the islands. Destroy the missile installation and fight through two aggressive air waves in the storm. Radar destruction suppresses long-range launches.",
    env("islands", "storm", "Tempest Archipelago", 1, "rain"),
    [
      ground("ISLAND RADAR", "radar", 600, -900),
      ground("MISSILE INSTALLATION", "hangar", 1200, -2300, {
        defense: "battery",
        health: 250,
      }),
      ground("ISLAND AA", "small", 900, -1300, { defense: "aa" }),
    ],
    [
      kills(6),
      destroy("radar", "Destroy the island radar", ["ISLAND RADAR"]),
      destroy("battery", "Destroy missile installation", [
        "MISSILE INSTALLATION",
      ]),
    ],
    [...air(3), ...air(3, 1)],
  ),
  {
    ...f35(
      5,
      "Raven One",
      "Clear the escorts above the cloud layer. Then face RAVEN ONE, an experimental ace that becomes more aggressive as its airframe breaks apart. Keep moving and conserve missiles.",
      env("mountains", "sunrise", "Crown Peaks", 0.95),
      [],
      [
        {
          id: "escorts",
          type: "DESTROY_AIRCRAFT",
          label: "Eliminate Raven's escorts",
          count: 3,
        },
        {
          id: "boss",
          type: "DESTROY_BOSS",
          label: "Defeat RAVEN ONE",
          after: ["escorts"],
        },
      ],
      [...air(3), { id: "RAVEN ONE", role: "boss", wave: 1, health: 680 }],
    ),
    boss: "raven-one",
    parTime: 360,
  },
];
export const campaignById = (id: string) => campaign.find((m) => m.id === id);
export const nextCampaignMission = (id: string) =>
  campaign.find((m) => m.prerequisite === id);
