import { CombatSystem } from "../combat/CombatSystem";
import { FighterWeapons } from "../combat/FighterWeapons";
import { FighterTargeting } from "../combat/FighterTargeting";
import { Mission } from "../combat/Mission";
import type { CombatSound } from "../combat/WeaponManager";
import { EnemyManager } from "../enemies/EnemyManager";
import { FighterEnemy } from "../enemies/FighterEnemy";
import type { FlightModel } from "../physics/FlightModel";
import { StrikeTargets } from "./StrikeTargets";

export class F35TrainingMission extends CombatSystem {
  declare readonly weapons: FighterWeapons;
  declare readonly targeting: FighterTargeting;
  constructor(flight: FlightModel, sound: (kind: CombatSound) => void) {
    const enemies = new EnemyManager(
      Array.from({ length: 4 }, (_, i) => new FighterEnemy(i, flight)),
    );
    super(flight, sound, {
      enemies,
      compound: new StrikeTargets(),
      mission: new Mission(4),
      targeting: new FighterTargeting(enemies.aircraft, flight),
      weapons: FighterWeapons,
    });
  }
  override setTrigger(held: boolean) {
    this.weapons.cannonHeld = held;
  }
  override dispose() {
    super.dispose();
    this.weapons.dispose();
  }
  override action(code: string) {
    if (this.mission.complete || this.flight.crashed) return;
    if (code === "KeyG") this.weapons.cycleGround();
    else super.action(code);
  }
  override update(dt: number) {
    const locked = this.targeting.valid(this.flight.position);
    this.targeting.tick(dt);
    if (!locked && this.targeting.valid(this.flight.position))
      this.sound("lock");
    this.weapons.tick(dt, this.flight);
    super.update(dt);
  }
  override get diagnostics() {
    return {
      ...super.diagnostics,
      cannon: this.weapons.cannonAmmo,
      tracers: this.weapons.tracerCount,
      groundTarget: this.weapons.groundTarget?.id ?? null,
      lockProgress: this.targeting.progress,
      ai: this.enemies.aircraft.map((a) => (a as FighterEnemy).behavior),
    };
  }
}
