import { Mission } from "../combat/Mission";
import type { Damageable } from "../combat/Damageable";
import { ObjectiveSystem } from "./ObjectiveSystem";
import type { CampaignMissionConfig, MissionResult, Rank } from "./types";

export class CampaignState extends Mission {
  readonly objectives: ObjectiveSystem;
  failed = false;
  failure = "";
  groundKills = 0;
  bossComponents = 0;
  runId = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
  constructor(readonly config: CampaignMissionConfig) {
    super(Infinity);
    this.objectives = new ObjectiveSystem(config.objectives);
  }
  override record(target: Damageable) {
    if (this.failed || this.complete) return;
    const before = this.destroyed;
    super.record(target);
    if (this.destroyed > before && target.kind !== "aircraft")
      this.groundKills++;
    if (
      this.destroyed > before &&
      this.config.ground.some((g) => g.id === target.id && g.phase)
    )
      this.bossComponents++;
  }
  fail(reason: string) {
    if (!this.complete) {
      this.failed = true;
      this.failure = reason;
    }
  }
  result(stats: {
    shots: number;
    hits: number;
    damage: number;
    maxHealth: number;
    boss: boolean;
    cannonHits: number;
  }): MissionResult {
    const accuracy = stats.shots ? Math.min(1, stats.hits / stats.shots) : 0;
    const optionalTotal = this.objectives.entries.filter(
      (o) => o.config.optional,
    ).length;
    const optional = this.objectives.entries.filter(
      (o) => o.config.optional && o.complete,
    ).length;
    const damageFraction = stats.damage / stats.maxHealth;
    const targetCount = this.config.air.length + this.config.ground.length;
    const possibleScore =
      this.config.air.length * 500 +
      this.config.ground.reduce(
        (total, target) =>
          total +
          { small: 100, hangar: 250, radar: 300, command: 750 }[target.kind],
        0,
      );
    const performance =
      Math.min(1, this.config.parTime / Math.max(1, this.time)) * 32 +
      Math.max(0, 1 - damageFraction) * 28 +
      Math.min(1, accuracy / 0.6) * 20 +
      Math.min(1, this.destroyed / Math.max(1, targetCount)) * 4 +
      Math.min(1, this.score / Math.max(1, possibleScore)) * 6 +
      (optionalTotal ? optional / optionalTotal : 1) * 10;
    const rank: Rank =
      performance >= 84
        ? "S"
        : performance >= 68
          ? "A"
          : performance >= 48
            ? "B"
            : "C";
    const practice =
      this.config.id === "f35-01" && stats.cannonHits > 0 ? 300 : 0;
    const base =
      this.config.reward +
      this.aircraft * 150 +
      this.groundKills * 100 +
      this.bossComponents * 250 +
      (stats.boss ? 1500 : 0) +
      optional * 500 +
      practice;
    return {
      missionId: this.config.id,
      runId: this.runId,
      score: this.score,
      time: this.time,
      air: this.aircraft,
      ground: this.groundKills,
      bossComponents: this.bossComponents,
      boss: stats.boss,
      accuracy,
      damageTaken: stats.damage,
      damageFraction,
      optional,
      optionalTotal,
      rank,
      credits: Math.round(base * { C: 1, B: 1.1, A: 1.25, S: 1.5 }[rank]),
    };
  }
  override reset() {
    super.reset();
    this.objectives.reset();
    this.failed = false;
    this.failure = "";
    this.groundKills = this.bossComponents = 0;
    this.runId =
      globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
  }
}
