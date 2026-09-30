import * as THREE from "three";
import {
  aircraftConfigs,
  type AircraftType,
  type AircraftVisual,
} from "../aircraft/AircraftConfig";
import { missions } from "../game/MissionManager";
import { disposeTree } from "../game/dispose";

export class MainMenu {
  readonly root = document.createElement("main");
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(
    40,
    innerWidth / innerHeight,
    0.1,
    500,
  );
  selected: AircraftType = "B2";
  private aircraft?: AircraftVisual;
  private time = 0;
  constructor(start: (type: AircraftType) => void) {
    this.root.className = "main-menu";
    this.root.innerHTML = `
      <header class="menu-header"><a class="menu-brand" href="#">✦ &nbsp; SPIRIT<span>FLIGHT OPERATIONS</span></a><span class="menu-status"><i></i> SIERRA RANGE · ONLINE</span><span class="menu-version">PROTOTYPE / 02</span></header>
      <section class="menu-intro"><div class="menu-eyebrow">YOUR AIRCRAFT. YOUR MISSION.</div><h1>THE SKY<br>IS YOURS<span>.</span></h1><p>Two airframes. Two ways to own the horizon.</p></section>
      <div class="preview-caption"><span id="preview-number">01 / 02</span><div id="preview-name">B–2 Spirit</div><small id="preview-tagline">The art of going unseen.</small><span class="preview-line"></span></div>
      <section class="menu-bottom"><div class="aircraft-selection"><div class="menu-section-label">01 <span>SELECT YOUR AIRCRAFT</span><small>FLIGHT LINE / 2 AVAILABLE</small></div><div class="aircraft-cards">${Object.values(
        aircraftConfigs,
      )
        .map(
          (a, index) =>
            `<button class="aircraft-card" data-aircraft="${a.id}" aria-pressed="${a.id === this.selected}"><div class="card-top"><span>AV–00${index + 1} / ${a.role}</span><b class="selection-indicator">${a.id === this.selected ? "✓ SELECTED" : "SELECT ↗"}</b></div><h2>${a.name}</h2><div class="aircraft-stats">${["SPEED", "AGILITY", "STRIKE", "AIR COMBAT"].map((label, i) => `<div><span>${label}</span><b>${a.stats[i]}</b></div>`).join("")}</div></button>`,
        )
        .join("")}</div></div>
      <div class="launch-panel"><div class="menu-section-label">02 <span>MISSION / 001</span></div><h2 id="brief-title"></h2><p id="brief-description"></p><button id="start-mission" class="start-button">START <span>→</span></button></div></section>
      <footer class="menu-footer"><span>FICTIONAL TRAINING EXERCISES</span><span>W A S D · FLIGHT &nbsp; / &nbsp; ESC · PAUSE & SETTINGS</span><span>BUILT TO DISAPPEAR.</span></footer>`;
    document.querySelector("#app")!.append(this.root);
    this.root.querySelector<HTMLAnchorElement>(".menu-brand")!.onclick = (e) =>
      e.preventDefault();
    this.root
      .querySelectorAll<HTMLButtonElement>("[data-aircraft]")
      .forEach((button) => {
        button.onclick = () =>
          this.select(button.dataset.aircraft as AircraftType);
      });
    this.root.querySelector<HTMLButtonElement>("#start-mission")!.onclick =
      () => start(this.selected);
    this.scene.background = new THREE.Color("#101d24");
    this.scene.fog = new THREE.Fog("#101d24", 100, 250);
    this.scene.add(new THREE.HemisphereLight("#cce7ef", "#18212b", 3));
    const key = new THREE.DirectionalLight("#f8e4bf", 5);
    key.position.set(-35, 55, 30);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight("#79d4ff", 4);
    rim.position.set(35, 10, -40);
    this.scene.add(rim);
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(600, 600),
      new THREE.MeshStandardMaterial({
        color: "#16262c",
        roughness: 0.65,
        metalness: 0.45,
      }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -6;
    this.scene.add(floor);
    const grid = new THREE.GridHelper(320, 32, "#37545c", "#233c44");
    grid.position.y = -5.95;
    this.scene.add(grid);
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(33, 33.15, 100),
      new THREE.MeshBasicMaterial({
        color: "#b8d7cd",
        transparent: true,
        opacity: 0.45,
        side: THREE.DoubleSide,
      }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = -5.85;
    this.scene.add(ring);
    this.camera.position.set(58, 36, 70);
    this.camera.lookAt(-10, 0, 0);
    this.select(this.selected);
  }
  select(type: AircraftType) {
    this.selected = type;
    const config = aircraftConfigs[type],
      mission = missions.get(config.mission);
    if (this.aircraft) disposeTree(this.aircraft.root);
    this.aircraft = config.createModel();
    this.aircraft.root.scale.setScalar(config.previewScale);
    this.scene.add(this.aircraft.root);
    this.root
      .querySelectorAll<HTMLButtonElement>("[data-aircraft]")
      .forEach((button) => {
        const selected = button.dataset.aircraft === type;
        button.setAttribute("aria-pressed", String(selected));
        button.querySelector(".selection-indicator")!.textContent = selected
          ? "✓ SELECTED"
          : "SELECT ↗";
      });
    this.root.querySelector("#preview-number")!.textContent =
      type === "B2" ? "01 / 02" : "02 / 02";
    this.root.querySelector("#preview-name")!.textContent = config.name;
    this.root.querySelector("#preview-tagline")!.textContent = config.tagline;
    this.root.querySelector("#brief-title")!.textContent = mission.title;
    this.root.querySelector("#brief-description")!.textContent =
      mission.briefing;
  }
  update(dt: number) {
    if (!matchMedia("(prefers-reduced-motion: reduce)").matches)
      this.time += dt;
    if (this.aircraft) {
      this.aircraft.root.rotation.y = -0.5 + Math.sin(this.time * 0.12) * 0.35;
      this.aircraft.root.position.y = Math.sin(this.time * 0.6) * 0.35;
    }
  }
  resize() {
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.position.set(innerWidth < 700 ? 75 : 58, 36, 70);
    this.camera.lookAt(innerWidth < 700 ? 0 : -10, 0, 0);
    this.camera.updateProjectionMatrix();
  }
  show() {
    this.root.hidden = false;
    this.root.classList.remove("leaving");
    this.root.querySelector<HTMLButtonElement>("#start-mission")!.focus();
  }
  hide() {
    this.root.hidden = true;
  }
}
