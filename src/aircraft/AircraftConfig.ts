import { Aircraft } from "./Aircraft";
import { F35Aircraft } from "./F35Aircraft";
import {
  bomberFlight,
  fighterFlight,
  type FlightTuning,
  type FlightModel,
} from "../physics/FlightModel";
import {
  bomberCamera,
  fighterCamera,
  type CameraTuning,
} from "../camera/CameraController";
import type { Object3D } from "three";

export type AircraftType = "B2" | "F35";
export interface AircraftVisual {
  root: Object3D;
  update(flight: FlightModel, time: number): void;
}
export interface AircraftConfig {
  id: AircraftType;
  name: string;
  role: string;
  tagline: string;
  stats: string[];
  mission: string;
  flight: FlightTuning;
  camera: CameraTuning;
  previewScale: number;
  createModel: () => AircraftVisual;
}
export const aircraftConfigs: Record<AircraftType, AircraftConfig> = {
  B2: {
    id: "B2",
    name: "B–2 Spirit",
    role: "STEALTH BOMBER",
    tagline: "The art of going unseen.",
    stats: ["Medium", "Low", "Very high", "Low"],
    mission: "b2-01",
    flight: bomberFlight,
    camera: bomberCamera,
    previewScale: 1,
    createModel: () => new Aircraft(),
  },
  F35: {
    id: "F35",
    name: "F–35 Lightning II",
    role: "MULTIROLE FIGHTER",
    tagline: "Take control of the sky.",
    stats: ["High", "High", "Medium", "High"],
    mission: "f35-01",
    flight: fighterFlight,
    camera: fighterCamera,
    previewScale: 2.1,
    createModel: () => new F35Aircraft(),
  },
};
