import { Euler, PerspectiveCamera, Quaternion, Vector3 } from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import type { FlightModel } from "../physics/FlightModel";
import { damp } from "../utils/math";
import { terrainHeight } from "../utils/noise";

export const cameraNames = ["Chase", "Cinematic", "Nose", "Orbit"] as const;
export class CameraController {
  readonly camera = new PerspectiveCamera(
    48,
    innerWidth / innerHeight,
    0.35,
    62000,
  );
  readonly orbit: OrbitControls;
  mode = 0;
  private readonly offset = new Vector3();
  private readonly desired = new Vector3();
  private readonly target = new Vector3();
  private readonly look = new Vector3();
  private readonly previousPosition = new Vector3();
  private readonly delta = new Vector3();
  private readonly rotation = new Quaternion();
  private readonly viewRotation = new Quaternion();
  private readonly previousViewRotation = new Quaternion();
  private orbitTransition = 0;
  private readonly euler = new Euler(0, 0, 0, "YXZ");
  constructor(canvas: HTMLCanvasElement) {
    this.orbit = new OrbitControls(this.camera, canvas);
    this.orbit.enabled = false;
    this.orbit.enableDamping = true;
    this.orbit.dampingFactor = 0.08;
    this.orbit.minDistance = 20;
    this.orbit.maxDistance = 350;
    this.orbit.enablePan = false;
  }
  setMode(mode: number, flight: FlightModel) {
    if (mode < 0 || mode >= cameraNames.length) return;
    this.mode = mode;
    this.orbit.enabled = false;
    this.orbitTransition = mode === 3 ? 1.2 : 0;
    this.previousPosition.copy(flight.position);
  }
  update(dt: number, flight: FlightModel, snap = false) {
    // Follow translation directly; damp the relative offset so cruise speed does
    // not stretch the camera 50+ metres farther behind the aircraft.
    if (!snap) {
      this.delta.subVectors(flight.position, this.previousPosition);
      this.camera.position.add(this.delta);
      this.look.add(this.delta);
    }
    if (snap && this.mode === 3) this.orbitTransition = 1.2;
    if (this.mode === 3 && this.orbitTransition <= 0) {
      this.orbit.target.copy(flight.position);
      this.orbit.update();
      this.look.copy(flight.position);
    } else {
      this.euler.set(
        flight.pitch * (this.mode === 2 ? 1 : 0.35),
        flight.yaw,
        this.mode === 2 ? flight.roll : 0,
      );
      this.rotation.setFromEuler(this.euler);
      this.offset
        .set(
          this.mode === 1 || this.mode === 3 ? 34 : 0,
          this.mode === 2 ? 2.2 : this.mode === 1 || this.mode === 3 ? 58 : 36,
          this.mode === 2
            ? -13
            : this.mode === 1 || this.mode === 3
              ? 146
              : 105,
        )
        .multiplyScalar(
          this.mode === 2 ? 1 : Math.max(1, 0.95 / this.camera.aspect),
        )
        .applyQuaternion(this.rotation);
      this.desired.copy(flight.position).add(this.offset);
      this.desired.y = Math.max(
        this.desired.y,
        terrainHeight(this.desired.x, this.desired.z) + 12,
        116,
      );
      this.target
        .set(
          0,
          this.mode === 2 ? 2.2 : 4,
          this.mode === 2 ? -400 : this.mode === 3 ? 0 : -55,
        )
        .applyQuaternion(this.rotation)
        .add(flight.position);
      const alpha = snap
        ? 1
        : 1 - Math.exp(-dt * (this.mode === 1 ? 1.8 : this.mode === 2 ? 9 : 4));
      this.camera.position.lerp(this.desired, alpha);
      this.look.lerp(this.target, snap ? 1 : 1 - Math.exp(-dt * 5));
      this.camera.up.set(0, 1, 0);
      if (this.mode === 2) this.camera.up.applyQuaternion(this.rotation);
      this.previousViewRotation.copy(this.camera.quaternion);
      this.camera.lookAt(this.look);
      this.viewRotation.copy(this.camera.quaternion);
      this.camera.quaternion
        .copy(this.previousViewRotation)
        .slerp(this.viewRotation, snap ? 1 : 1 - Math.exp(-dt * 9));
      if (this.mode === 3) {
        this.orbitTransition -= dt;
        if (this.orbitTransition <= 0) this.orbit.enabled = true;
      }
    }
    this.previousPosition.copy(flight.position);
    const fov =
      (this.mode === 2 ? 64 : this.mode === 1 ? 49 : 47) +
      (flight.speed - 180) * 0.032;
    this.camera.fov = damp(this.camera.fov, fov, 1.5, dt);
    this.camera.updateProjectionMatrix();
  }
  resize() {
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
  }
}
