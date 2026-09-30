import type { FlightModel } from "../physics/FlightModel";
import type { EnemyAircraft } from "../enemies/EnemyAircraft";
import { TargetManager } from "./TargetManager";
import { Vector3 } from "three";

export class FighterTargeting extends TargetManager {
  progress = 0;
  constructor(
    enemies: EnemyAircraft[],
    private readonly flight: FlightModel,
  ) {
    super(enemies);
  }
  get inCone() {
    return (
      !!this.selected &&
      !this.selected.destroyed &&
      this.flight.position.distanceTo(this.selected.position) < this.range &&
      this.selected.position
        .clone()
        .sub(this.flight.position)
        .normalize()
        .dot(this.flight.forward) > 0.35
    );
  }
  tick(dt: number) {
    this.progress = this.inCone ? Math.min(1, this.progress + dt / 0.65) : 0;
  }
  override valid(_position: Vector3) {
    return this.inCone && this.progress >= 1;
  }
  override cycle() {
    super.cycle();
    this.progress = 0;
  }
  override reset() {
    super.reset();
    this.progress = 0;
  }
}
