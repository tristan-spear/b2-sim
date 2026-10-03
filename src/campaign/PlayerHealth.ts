import { Vector3 } from "three";
export class PlayerHealth {
  health: number;
  damageTaken = 0;
  flash = 0;
  readonly lastSource = new Vector3();
  constructor(
    readonly max: number,
    readonly resistance: number,
  ) {
    this.health = max;
  }
  get destroyed() {
    return this.health <= 0;
  }
  hit(amount: number, source: Vector3) {
    if (this.destroyed || !Number.isFinite(amount) || amount <= 0) return;
    const damage = Math.min(this.health, amount * (1 - this.resistance));
    this.health -= damage;
    this.damageTaken += damage;
    this.flash = Math.min(1, this.flash + 0.45);
    this.lastSource.copy(source);
  }
  update(dt: number) {
    this.flash = Math.max(0, this.flash - dt * 1.5);
  }
  reset() {
    this.health = this.max;
    this.damageTaken = this.flash = 0;
    this.lastSource.set(0, 0, 0);
  }
}
