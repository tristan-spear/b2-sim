import { Quaternion, Vector3 } from "three";
import { EnemyAircraft } from "./EnemyAircraft";
import type { FlightModel } from "../physics/FlightModel";
import { terrainHeight } from "../utils/noise";

export class FighterEnemy extends EnemyAircraft {
  behavior = "PATROL";
  private age = 0;
  private readonly direction = new Vector3(0, 0, -1);
  private readonly desired = new Quaternion();
  constructor(
    index: number,
    private readonly player: FlightModel,
  ) {
    super(index);
    this.reset();
  }
  override reset() {
    super.reset();
    this.age = 0;
    this.behavior = "PATROL";
    // reset is also invoked by the base constructor before derived fields exist.
    this.direction?.set(0, 0, -1);
    this.position.set(
      600 + this.index * 280,
      2400 + this.index * 110,
      3150 - this.index * 650,
    );
    this.previousPosition.copy(this.position);
    this.velocity.set(0, 0, -240);
    this.root.position.copy(this.position);
    this.root.quaternion.identity();
  }
  override update(dt: number) {
    this.previousPosition.copy(this.position);
    if (this.destroyed) {
      this.root.visible = false;
      return;
    }
    this.age += dt;
    const distance = this.position.distanceTo(this.player.position);
    const phase = (this.age + this.index * 3) % 19;
    const destination = new Vector3();
    if (distance < 6500) {
      this.behavior =
        phase > 13 ? "BREAK" : distance < 650 ? "MANEUVER" : "CHASE";
      if (this.behavior === "BREAK") {
        destination.copy(this.position).addScaledVector(this.direction, 1300);
        destination.x += Math.sin(this.age * 0.35 + this.index) * 1100;
        destination.y = this.player.altitude + 200;
      } else {
        destination
          .copy(this.player.position)
          .addScaledVector(this.player.velocity, 0.8);
        if (distance < 650) {
          destination.x += Math.cos(this.age * 0.5 + this.index) * 950;
          destination.z += Math.sin(this.age * 0.5 + this.index) * 950;
        }
      }
    } else {
      this.behavior = "PATROL";
      destination.set(
        600 + Math.sin(this.age * 0.12 + this.index) * 1600,
        2400 + this.index * 110,
        1600 + Math.cos(this.age * 0.12 + this.index) * 1600,
      );
    }
    destination.y = Math.max(
      destination.y,
      terrainHeight(this.position.x, this.position.z) + 450,
    );
    const toward = destination.sub(this.position).normalize();
    this.desired.setFromUnitVectors(new Vector3(0, 0, -1), toward);
    this.root.quaternion.rotateTowards(this.desired, dt * 0.55);
    this.direction.set(0, 0, -1).applyQuaternion(this.root.quaternion);
    this.velocity
      .copy(this.direction)
      .multiplyScalar(this.behavior === "BREAK" ? 285 : 235);
    this.position.addScaledVector(this.velocity, dt);
    this.root.position.copy(this.position);
    this.flash = Math.max(0, this.flash - dt);
    this.material.emissive.setHex(this.flash > 0 ? 0xff9933 : 0);
  }
}
