import type { AircraftType } from "../aircraft/AircraftConfig";
import type { MissionResult, Rank } from "./types";
import { campaignById } from "./catalog";

export const SAVE_KEY = "spirit-campaign-v1";
export const rankOrder: Rank[] = ["C", "B", "A", "S"];
export interface MissionRecord {
  score: number;
  time: number;
  rank: Rank;
  completions: number;
}
export interface SaveData {
  saveVersion: 1;
  credits: number;
  selectedAircraft: AircraftType;
  completed: Record<string, MissionRecord>;
  upgrades: Record<AircraftType, Record<string, number>>;
  rewardedRuns: string[];
}
const fresh = (): SaveData => ({
  saveVersion: 1,
  credits: 0,
  selectedAircraft: "B2",
  completed: {},
  upgrades: { B2: {}, F35: {} },
  rewardedRuns: [],
});
const number = (v: unknown, fallback = 0, max = 1e9) =>
  typeof v === "number" && Number.isFinite(v)
    ? Math.max(0, Math.min(max, v))
    : fallback;
const object = (v: unknown): Record<string, unknown> =>
  v !== null && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
export class SaveManager {
  data = fresh();
  warning = "";
  private readonly storage?: Pick<
    Storage,
    "getItem" | "setItem" | "removeItem"
  >;
  constructor(storage?: Pick<Storage, "getItem" | "setItem" | "removeItem">) {
    try {
      this.storage =
        storage ??
        (typeof localStorage !== "undefined" ? localStorage : undefined);
      const text = this.storage?.getItem(SAVE_KEY);
      if (text) this.data = SaveManager.parse(text);
    } catch {
      this.warning =
        "Saving is unavailable. Progress is kept for this session.";
    }
  }
  static parse(text: string): SaveData {
    let raw: Record<string, unknown>;
    try {
      raw = object(JSON.parse(text));
    } catch {
      return fresh();
    }
    // Unknown future versions are not interpreted as spendable credits.
    if (raw.saveVersion !== undefined && raw.saveVersion !== 1) return fresh();
    const data = fresh();
    data.credits = Math.floor(number(raw.credits));
    data.selectedAircraft = raw.selectedAircraft === "F35" ? "F35" : "B2";
    for (const [id, value] of Object.entries(object(raw.completed))) {
      if (!campaignById(id)) continue;
      const record = object(value);
      data.completed[id] = {
        score: number(record.score),
        time: Math.max(0.01, number(record.time, 99999)),
        rank: rankOrder.includes(record.rank as Rank)
          ? (record.rank as Rank)
          : "C",
        completions: Math.max(1, Math.floor(number(record.completions, 1))),
      };
    }
    for (const aircraft of ["B2", "F35"] as const) {
      for (const [id, level] of Object.entries(
        object(object(raw.upgrades)[aircraft]),
      )) {
        if (
          /^[a-z-]+$/.test(id) &&
          !["constructor", "prototype", "__proto__"].includes(id)
        )
          data.upgrades[aircraft][id] = Math.max(
            1,
            Math.floor(number(level, 1, 5)),
          );
      }
    }
    data.rewardedRuns = Array.isArray(raw.rewardedRuns)
      ? raw.rewardedRuns
          .filter(
            (id): id is string => typeof id === "string" && id.length < 100,
          )
          .slice(-100)
      : [];
    return data;
  }
  persist() {
    try {
      this.storage?.setItem(SAVE_KEY, JSON.stringify(this.data));
    } catch {
      this.warning =
        "Storage is full or blocked. Progress is kept for this session.";
    }
  }
  select(aircraft: AircraftType) {
    this.data.selectedAircraft = aircraft;
    this.persist();
  }
  unlocked(prerequisite?: string) {
    return !prerequisite || Boolean(this.data.completed[prerequisite]);
  }
  award(result: MissionResult) {
    if (this.data.rewardedRuns.includes(result.runId)) return false;
    const old = this.data.completed[result.missionId];
    this.data.completed[result.missionId] = {
      score: Math.max(old?.score ?? 0, result.score),
      time: Math.min(old?.time ?? Infinity, result.time),
      rank: rankOrder[
        Math.max(
          rankOrder.indexOf(old?.rank ?? "C"),
          rankOrder.indexOf(result.rank),
        )
      ],
      completions: (old?.completions ?? 0) + 1,
    };
    this.data.credits += Math.max(0, Math.floor(result.credits));
    this.data.rewardedRuns = [...this.data.rewardedRuns, result.runId].slice(
      -100,
    );
    this.persist();
    return true;
  }
  reset() {
    this.data = fresh();
    this.persist();
  }
}
export const save = new SaveManager();
