import { Vector3 } from "three";
import type { Damageable } from "../combat/Damageable";
import type { ObjectiveConfig } from "./types";

export interface ObjectiveContext {
  time: number;
  position: Vector3;
  targets: Damageable[];
  airKills: number;
  bossDefeated: boolean;
  friendly: Damageable[];
}
export class ObjectiveSystem {
  readonly entries: {
    config: ObjectiveConfig;
    progress: number;
    total: number;
    complete: boolean;
    active: boolean;
  }[];
  failed = false;
  constructor(configs: ObjectiveConfig[]) {
    this.entries = configs.map((config) => ({
      config,
      progress: 0,
      total:
        config.count ??
        config.seconds ??
        config.targets?.length ??
        config.locations?.length ??
        1,
      complete: false,
      active: !config.after?.length,
    }));
  }
  get complete() {
    return this.entries.every((o) => o.config.optional || o.complete);
  }
  update(context: ObjectiveContext) {
    // Protected sites are vulnerable immediately, including before the destroy objective completes.
    this.failed = this.entries.some(
      (o) =>
        o.config.type === "DEFEND" &&
        context.friendly.some(
          (t) => o.config.targets?.includes(t.id) && t.destroyed,
        ),
    );
    for (const o of this.entries) {
      o.active = (o.config.after ?? []).every(
        (id) => this.entries.find((p) => p.config.id === id)?.complete,
      );
      if (!o.active || o.complete) continue;
      const c = o.config;
      switch (c.type) {
        case "DESTROY_TARGET":
        case "DESTROY_TARGETS":
          o.progress = (c.targets ?? []).filter((id) =>
            context.targets.some((t) => t.id === id && t.destroyed),
          ).length;
          break;
        case "DESTROY_AIRCRAFT":
          o.progress = context.airKills;
          break;
        case "SURVIVE":
          o.progress = context.time;
          break;
        case "DESTROY_BOSS":
          o.progress = Number(context.bossDefeated);
          break;
        case "DEFEND":
          o.progress = context.friendly.filter(
            (t) => c.targets?.includes(t.id) && !t.destroyed,
          ).length;
          break;
        case "REACH_LOCATION":
        case "CHECKPOINTS": {
          const point = c.locations?.[o.progress];
          if (
            point &&
            context.position.distanceTo(new Vector3(...point)) <=
              (c.radius ?? 600)
          )
            o.progress++;
          break;
        }
        case "ESCAPE_AREA": {
          const point = c.locations?.[0];
          if (
            point &&
            context.position.distanceTo(new Vector3(...point)) >=
              (c.radius ?? 5000)
          )
            o.progress = o.total;
          break;
        }
      }
      o.complete = o.progress >= o.total;
    }
  }
  reset() {
    this.failed = false;
    this.entries.forEach((o) => {
      o.progress = 0;
      o.complete = false;
      o.active = !o.config.after?.length;
    });
  }
}
