import { Group } from "three";
import { EnemyAircraft } from "./EnemyAircraft";
export class EnemyManager {
  readonly root = new Group();
  constructor(
    readonly aircraft = Array.from(
      { length: 3 },
      (_, i) => new EnemyAircraft(i),
    ),
  ) {
    this.root.add(...this.aircraft.map((a) => a.root));
  }
  update(dt: number) {
    this.aircraft.forEach((a) => a.update(dt));
  }
  reset() {
    this.aircraft.forEach((a) => a.reset());
  }
}
