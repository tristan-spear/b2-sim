import { Euler, Quaternion, Vector3 } from "three";
import { clamp, damp, degrees, wrap } from "../utils/math";

export interface FlightInput {
  pitch: number;
  roll: number;
  yaw: number;
  throttle: number;
}
export const neutralInput = (): FlightInput => ({
  pitch: 0,
  roll: 0,
  yaw: 0,
  throttle: 0,
});
export class FlightModel {
  readonly position = new Vector3();
  readonly velocity = new Vector3();
  readonly orientation = new Quaternion();
  readonly forward = new Vector3(0, 0, -1);
  speed = 210;
  throttle = 0.64;
  pitch = 0;
  roll = 0;
  yaw = 0;
  verticalSpeed = 0;
  distance = 0;
  elapsed = 0;
  crashed = false;
  private pitchRate = 0;
  private rollRate = 0;
  private yawRate = 0;
  private readonly rotation = new Euler(0, 0, 0, "YXZ");
  private readonly desiredVelocity = new Vector3();

  constructor() {
    this.reset();
  }
  get altitude() {
    return this.position.y;
  }
  get heading() {
    return wrap(-degrees(this.yaw), 360);
  }
  get stalled() {
    return this.speed < 105;
  }
  reset() {
    this.position.set(600, 2400, 4200);
    this.velocity.set(0, 0, -210);
    this.speed = 210;
    this.throttle = 0.64;
    this.pitch = this.roll = this.yaw = this.verticalSpeed = 0;
    this.pitchRate = this.rollRate = this.yawRate = 0;
    this.elapsed = this.distance = 0;
    this.crashed = false;
    this.orientation.identity();
    this.forward.set(0, 0, -1);
  }
  update(
    dt: number,
    input: FlightInput,
    groundHeight: (x: number, z: number) => number,
  ) {
    if (this.crashed || dt <= 0) return;
    dt = Math.min(dt, 1 / 30);
    this.throttle = clamp(this.throttle + input.throttle * dt * 0.16, 0, 1);
    const authority = clamp(this.speed / 140, 0.35, 1);
    // Damped angular rates and gentle stability assistance retain the bomber's weight.
    this.pitchRate = damp(
      this.pitchRate,
      input.pitch * 0.27 * authority,
      2.2,
      dt,
    );
    this.rollRate = damp(this.rollRate, input.roll * 0.64 * authority, 2.7, dt);
    this.pitch = clamp(this.pitch + this.pitchRate * dt, -0.65, 0.62);
    this.roll = clamp(this.roll + this.rollRate * dt, -1.18, 1.18);
    if (!input.roll) this.roll = damp(this.roll, 0, 0.15, dt);
    if (!input.pitch) this.pitch = damp(this.pitch, 0, 0.065, dt);
    // A bank generates a coordinated turn; rudder adds a smaller, slower yaw input.
    const bankTurn = (9.81 * Math.tan(this.roll)) / Math.max(this.speed, 70);
    this.yawRate = damp(
      this.yawRate,
      bankTurn + input.yaw * 0.095 * authority,
      1.5,
      dt,
    );
    this.yaw =
      wrap(this.yaw + this.yawRate * dt + Math.PI, Math.PI * 2) - Math.PI;
    const targetSpeed =
      68 +
      this.throttle * 222 -
      Math.sin(this.pitch) * 58 -
      Math.abs(this.roll) * 7;
    this.speed = damp(this.speed, targetSpeed, 0.13, dt);
    const stallSink = Math.max(0, 1 - this.speed / 105) * 90;
    if (this.stalled) this.pitch = damp(this.pitch, -0.14, 0.1, dt);
    if (this.altitude > 10500) this.pitch = damp(this.pitch, -0.06, 0.4, dt);
    this.rotation.set(this.pitch, this.yaw, this.roll);
    this.orientation.setFromEuler(this.rotation);
    this.forward.set(0, 0, -1).applyQuaternion(this.orientation);
    this.desiredVelocity.copy(this.forward).multiplyScalar(this.speed);
    this.desiredVelocity.y -= stallSink;
    this.velocity.lerp(this.desiredVelocity, 1 - Math.exp(-1.7 * dt));
    this.position.addScaledVector(this.velocity, dt);
    this.verticalSpeed = this.velocity.y;
    this.distance += this.velocity.length() * dt;
    this.elapsed += dt;
    const floor =
      Math.max(110, groundHeight(this.position.x, this.position.z)) + 4;
    if (this.position.y < floor) {
      this.position.y = floor;
      this.crashed = true;
      this.velocity.set(0, 0, 0);
      this.verticalSpeed = 0;
    }
  }
}
