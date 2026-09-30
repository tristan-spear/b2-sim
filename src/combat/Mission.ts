import type { Damageable } from "./Damageable";
export class Mission {
  constructor(readonly requiredAircraft = 3) {}
  score = 0;
  time = 0;
  destroyed = 0;
  aircraft = 0;
  radar = false;
  command = false;
  complete = false;
  popup = "";
  popupTime = 0;
  private readonly credited = new Set<Damageable>();
  record(target: Damageable) {
    if (this.complete || !target.destroyed || this.credited.has(target)) return;
    this.credited.add(target);
    this.score += target.points;
    this.destroyed++;
    if (target.kind === "aircraft") this.aircraft++;
    if (target.kind === "radar") this.radar = true;
    if (target.kind === "command") this.command = true;
    this.popup = `+${target.points} ${target.kind === "aircraft" ? "AIRCRAFT" : target.id} DESTROYED`;
    this.popupTime = 3;
    this.complete =
      this.radar && this.command && this.aircraft >= this.requiredAircraft;
  }
  update(dt: number, targets: Damageable[]) {
    if (!this.complete) this.time += dt;
    this.popupTime = Math.max(0, this.popupTime - dt);
    // A new life can earn points again; repeated damage on the same wreck cannot.
    targets.forEach((t) => {
      if (!t.destroyed) this.credited.delete(t);
    });
  }
  reset() {
    this.score =
      this.time =
      this.destroyed =
      this.aircraft =
      this.popupTime =
        0;
    this.radar = this.command = this.complete = false;
    this.popup = "";
    this.credited.clear();
  }
}
