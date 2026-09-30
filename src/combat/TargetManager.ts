import { Vector3 } from "three";
import type { EnemyAircraft } from "../enemies/EnemyAircraft";
export class TargetManager {
  selected: EnemyAircraft | null = null;
  readonly range = 6500;
  constructor(private readonly aircraft: EnemyAircraft[]) {}
  cycle() {
    const available = this.aircraft.filter((a) => !a.destroyed);
    const next =
      available[(available.indexOf(this.selected!) + 1) % available.length] ??
      null;
    this.selected?.setSelected(false);
    this.selected = next;
    next?.setSelected(true);
  }
  valid(position: Vector3) {
    return (
      !!this.selected &&
      !this.selected.destroyed &&
      position.distanceTo(this.selected.position) <= this.range
    );
  }
  update() {
    if (this.selected?.destroyed) this.reset();
  }
  reset() {
    this.selected?.setSelected(false);
    this.selected = null;
  }
}
