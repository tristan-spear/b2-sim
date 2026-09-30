import { Vector3 } from "three";

export type TargetKind = "aircraft" | "small" | "hangar" | "radar" | "command";
export abstract class Damageable {
  readonly position = new Vector3();
  readonly velocity = new Vector3();
  health: number;
  destroyed = false;
  flash = 0;
  onDestroyed?: (target: Damageable) => void;
  constructor(
    readonly id: string,
    readonly kind: TargetKind,
    readonly maxHealth: number,
    readonly points: number,
  ) {
    this.health = maxHealth;
  }
  takeDamage(amount: number) {
    if (this.destroyed || !Number.isFinite(amount) || amount <= 0) return;
    this.health = Math.max(0, this.health - amount);
    this.flash = 0.18;
    if (this.health === 0) this.destroy();
  }
  destroy() {
    if (this.destroyed) return;
    this.health = 0;
    this.destroyed = true;
    this.onDestroyed?.(this);
  }
  reset() {
    this.health = this.maxHealth;
    this.destroyed = false;
    this.flash = 0;
  }
}
