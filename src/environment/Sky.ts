import * as THREE from "three";
import type { EnvironmentConfig } from "../campaign/types";

export class Sky {
  readonly root = new THREE.Group();
  readonly sunDirection = new THREE.Vector3(-0.36, 0.085, -0.92).normalize();
  readonly sunlight = new THREE.DirectionalLight("#ffdab0", 3.2);
  private readonly dome: THREE.Mesh;
  private readonly sun: THREE.Sprite;
  private readonly ambient = new THREE.HemisphereLight(
    "#c4dae2",
    "#706247",
    2.25,
  );
  private readonly scene: THREE.Scene;
  constructor(scene: THREE.Scene) {
    this.scene = scene;
    scene.fog = new THREE.FogExp2("#c2b5a1", 0.000075);
    scene.add(this.ambient);
    const material = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        sunDirection: { value: this.sunDirection },
        horizonColor: { value: new THREE.Color("#c2b5a1") },
        skyBottom: { value: new THREE.Color(0.73, 0.51, 0.35) },
        skyTop: { value: new THREE.Color(0.085, 0.21, 0.29) },
        glowStrength: { value: 1 },
      },
      vertexShader: `varying vec3 vDirection; void main(){vDirection=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader: `varying vec3 vDirection; uniform vec3 sunDirection; uniform vec3 horizonColor; uniform vec3 skyBottom; uniform vec3 skyTop; uniform float glowStrength;
        void main(){vec3 d=normalize(vDirection);float h=max(d.y,0.);vec3 col=mix(skyBottom,skyTop,pow(h,.45));
        float s=max(dot(d,sunDirection),0.);col+=(vec3(.5,.27,.09)*pow(s,12.)+vec3(.8,.46,.15)*pow(s,160.))*glowStrength;
        col=mix(horizonColor,col,smoothstep(0.,.08,d.y));gl_FragColor=vec4(col,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        }`,
    });
    this.dome = new THREE.Mesh(
      new THREE.SphereGeometry(50000, 32, 16),
      material,
    );
    this.dome.renderOrder = -10;
    this.root.add(this.dome);
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 256;
    const ctx = canvas.getContext("2d")!;
    const glow = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
    glow.addColorStop(0, "rgba(255,250,222,1)");
    glow.addColorStop(0.11, "rgba(255,244,211,1)");
    glow.addColorStop(0.14, "rgba(255,220,163,.7)");
    glow.addColorStop(0.3, "rgba(255,202,130,.18)");
    glow.addColorStop(1, "rgba(255,190,125,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, 256, 256);
    this.sun = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: new THREE.CanvasTexture(canvas),
        transparent: true,
        depthWrite: false,
        fog: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    this.sun.scale.setScalar(8500);
    this.root.add(this.sun);
    this.sunlight.castShadow = true;
    this.sunlight.shadow.mapSize.set(1024, 1024);
    this.sunlight.shadow.camera.left = -65;
    this.sunlight.shadow.camera.right = 65;
    this.sunlight.shadow.camera.top = 65;
    this.sunlight.shadow.camera.bottom = -65;
    this.sunlight.shadow.camera.near = 1;
    this.sunlight.shadow.camera.far = 350;
    this.sunlight.shadow.normalBias = 0.12;
    this.sunlight.shadow.bias = -0.0001;
    scene.add(this.sunlight, this.sunlight.target, this.root);
  }
  configure(config: EnvironmentConfig) {
    const presets = {
      sunrise: ["#dbac87", "#be785d", "#263951", "#ffd7a3", 0.09, 2.6, 1.6],
      morning: ["#bdced2", "#a9c7d8", "#326887", "#fff0ce", 0.38, 3.1, 2.1],
      midday: ["#c5c8b7", "#a4c5d8", "#2f648d", "#fff5dd", 0.85, 3.6, 2.0],
      afternoon: ["#bda17c", "#c39566", "#345565", "#ffcd8c", 0.16, 3.2, 1.9],
      sunset: ["#c18986", "#df8e62", "#403657", "#ffb780", 0.07, 2.6, 1.5],
      night: ["#172436", "#172f49", "#060d1c", "#92bce9", 0.3, 0.65, 0.65],
      storm: ["#596570", "#4d5a6a", "#192638", "#bdc9dc", 0.24, 1.2, 1.25],
    } as const;
    const [fog, bottom, top, light, elevation, intensity, ambient] =
      presets[config.time];
    this.scene.fog = new THREE.FogExp2(
      fog,
      config.time === "storm"
        ? 0.00012
        : config.time === "night"
          ? 0.000085
          : 0.000065,
    );
    const uniforms = (this.dome.material as THREE.ShaderMaterial).uniforms;
    uniforms.horizonColor.value.set(fog);
    uniforms.skyBottom.value.set(bottom);
    uniforms.skyTop.value.set(top);
    uniforms.glowStrength.value =
      config.time === "night" ? 0.04 : config.time === "storm" ? 0.1 : 1;
    this.sunDirection.set(-0.36, elevation, -0.92).normalize();
    this.sunlight.color.set(light);
    this.sunlight.intensity = intensity;
    this.ambient.color.set(config.time === "night" ? "#7594bf" : "#c4dae2");
    this.ambient.groundColor.set(
      config.terrain === "desert" ? "#9a7547" : "#38434b",
    );
    this.ambient.intensity = ambient;
    this.sun.material.color.set(light);
    this.sun.material.opacity =
      config.time === "storm" ? 0.2 : config.time === "night" ? 0.4 : 1;
    this.sun.scale.setScalar(config.time === "night" ? 3500 : 8500);
  }
  update(position: THREE.Vector3) {
    this.dome.position.copy(position);
    this.sun.position.copy(position).addScaledVector(this.sunDirection, 35000);
    this.sunlight.position
      .copy(position)
      .addScaledVector(this.sunDirection, 180);
    this.sunlight.target.position.copy(position);
  }
}
