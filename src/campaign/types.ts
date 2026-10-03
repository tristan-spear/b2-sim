import type { AircraftType } from "../aircraft/AircraftConfig";
import type { TargetKind } from "../combat/Damageable";

export type TerrainType =
  | "legacy"
  | "desert"
  | "mountains"
  | "canyon"
  | "forest"
  | "coastline"
  | "islands"
  | "city"
  | "snow";
export type TimeOfDay =
  "sunrise" | "morning" | "midday" | "afternoon" | "sunset" | "night" | "storm";
export type Point = [number, number, number];
export interface EnvironmentConfig {
  terrain: TerrainType;
  time: TimeOfDay;
  label: string;
  weather: "clear" | "rain" | "snow";
  clouds: number;
}
export type ObjectiveType =
  | "DESTROY_TARGET"
  | "DESTROY_TARGETS"
  | "DESTROY_AIRCRAFT"
  | "SURVIVE"
  | "DEFEND"
  | "REACH_LOCATION"
  | "ESCAPE_AREA"
  | "DESTROY_BOSS"
  | "CHECKPOINTS";
export interface ObjectiveConfig {
  id: string;
  type: ObjectiveType;
  label: string;
  targets?: string[];
  count?: number;
  seconds?: number;
  locations?: Point[];
  radius?: number;
  optional?: boolean;
  after?: string[];
}
export type DefenseType = "aa" | "battery" | "heavy";
export interface GroundConfig {
  id: string;
  kind: Exclude<TargetKind, "aircraft">;
  x: number;
  z: number;
  health?: number;
  defense?: DefenseType;
  size?: Point;
  moving?: boolean;
  phase?: number;
}
export interface AirConfig {
  id: string;
  wave: number;
  role?: "fighter" | "strike" | "boss";
  health?: number;
}
export interface CampaignMissionConfig {
  id: string;
  aircraft: AircraftType;
  number: number;
  name: string;
  description: string;
  environment: EnvironmentConfig;
  spawn: Point;
  objectives: ObjectiveConfig[];
  ground: GroundConfig[];
  air: AirConfig[];
  boss?: "iron-shield" | "raven-one";
  reward: number;
  parTime: number;
  prerequisite?: string;
  friendly?: { id: string; position: Point }[];
  bombs: number;
  missiles: number;
}
export type Rank = "C" | "B" | "A" | "S";
export interface MissionResult {
  missionId: string;
  runId: string;
  score: number;
  time: number;
  air: number;
  ground: number;
  bossComponents: number;
  boss: boolean;
  accuracy: number;
  damageTaken: number;
  damageFraction: number;
  optional: number;
  optionalTotal: number;
  rank: Rank;
  credits: number;
}
