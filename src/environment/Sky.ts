import * as THREE from "three";

export class Sky {
  readonly root = new THREE.Group();
  readonly sunDirection = new THREE.Vector3(-0.36, 0.085, -0.92).normalize();
  readonly sunlight = new THREE.DirectionalLight("#ffdab0", 3.2);
  private readonly dome: THREE.Mesh;
  private readonly sun: THREE.Sprite;
  constructor(scene: THREE.Scene) {
    scene.fog = new THREE.FogExp2("#c2b5a1", 0.000075);
    scene.add(new THREE.HemisphereLight("#c4dae2", "#706247", 2.25));
    const material = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        sunDirection: { value: this.sunDirection },
        horizonColor: { value: new THREE.Color("#c2b5a1") },
      },
      vertexShader: `varying vec3 vDirection; void main(){vDirection=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader: `varying vec3 vDirection; uniform vec3 sunDirection; uniform vec3 horizonColor;
        void main(){vec3 d=normalize(vDirection);float h=max(d.y,0.);vec3 horizon=vec3(.73,.51,.35);vec3 zenith=vec3(.085,.21,.29);vec3 col=mix(horizon,zenith,pow(h,.45));
        float s=max(dot(d,sunDirection),0.);col+=vec3(.5,.27,.09)*pow(s,12.)+vec3(.8,.46,.15)*pow(s,160.);
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
  update(position: THREE.Vector3) {
    this.dome.position.copy(position);
    this.sun.position.copy(position).addScaledVector(this.sunDirection, 35000);
    this.sunlight.position
      .copy(position)
      .addScaledVector(this.sunDirection, 180);
    this.sunlight.target.position.copy(position);
  }
}
