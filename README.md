# Spirit — flight simulator

A playable browser flight demo built with **Three.js, TypeScript, and Vite**. No React, backend, paid API, or downloaded aircraft assets. The world, aircraft, clouds, decals, and sound are generated locally; fonts are bundled.

## Run

Requires Node.js 22.12+ (tested with Node 24).

```sh
npm install
npm run dev
```

Open the URL printed by Vite, usually **http://localhost:5173**. Flight starts immediately. The app pauses when the window loses focus.

```sh
npm run build      # Type-check and build into dist/
npm run preview    # Serve the production build
npm test           # Deterministic flight-model and terrain tests
npm run test:browser # Chrome smoke test; keep the dev server running
npm run format     # Format source and tests
```

The browser check uses an installed Google Chrome through Playwright. It tests actual keyboard controls, all cameras, orbit drag/zoom, pause, reset, settings, sound, collision recovery, and a narrow viewport. Screenshots are written to the OS temporary directory.

## Controls

| Input                  | Action                                 |
| ---------------------- | -------------------------------------- |
| W / S                  | Pitch down / up                        |
| A / D                  | Bank left / right                      |
| Q / E                  | Yaw left / right                       |
| Shift / Ctrl           | Increase / decrease throttle           |
| C                      | Cycle Chase → Cinematic → Nose → Orbit |
| R                      | Reset aircraft and flight statistics   |
| P or Escape            | Pause / resume                         |
| H                      | Hide / show instruments                |
| M                      | Enable / mute engine audio             |
| Drag / scroll in Orbit | Rotate / zoom around the aircraft      |

Buttons support the same camera, pause, sound, and reset actions. Coarse-pointer devices get touch flight controls. The help button contains a complete control reference and render-quality selector.

Start with small bank inputs. Speed responds gradually; holding a bank generates a turn. Releasing the controls gently stabilizes the wing. Below approximately 204 knots, lift falls off and the aircraft sinks. Terrain or water contact ends the flight; press **R** to fly again.

## Organization

- `src/physics/FlightModel.ts`: fixed-step flight state, angular inertia, bank turns, throttle, simplified stall and terrain contact. SI units internally.
- `src/aircraft/Aircraft.ts`: generated 52 m flying wing, fairings, cockpit, elevons, and exhaust. Visuals are independent of physics.
- `src/aircraft/FlightController.ts`: keyboard/touch input, shortcut handling, and focus cleanup.
- `src/camera/CameraController.ts`: damped relative chase offsets, cinematic, nose, and orbit views; speed-sensitive FOV.
- `src/environment/Terrain.ts`: bounded 7×7 streamed tile grid, three detail levels, skirts, colored terrain, procedural surface detail, and water.
- `src/environment/Sky.ts`: atmospheric gradient, directional sun, inexpensive sprite glare, and aircraft shadows.
- `src/environment/Clouds.ts`: 200 instanced cloud billboards, rendered in one draw call.
- `src/hud/HUD.ts`: HTML/SVG instruments, compass, controls, and dialogs. HUD refresh is capped at 15 Hz.
- `src/utils/noise.ts`: deterministic terrain height shared by rendering and collision.
- `src/utils/Audio.ts`: optional synthesized engine/wind audio, started only after user interaction.
- `src/main.ts`: composition and render loop, with 120 Hz fixed physics steps.

### Replace the aircraft

Load a GLB using Three.js `GLTFLoader` and pass its scene to `aircraft.setModel(gltf.scene)`. Normalize the replacement to **52 m wingspan, +Y up, −Z forward**, centered at its flight origin. Generated mesh effects are removed when replacing the visual. The flight controller and cameras continue using `aircraft.root`.

### Performance and scope

Balanced quality caps pixel ratio at 1.5; High caps it at 2; Low caps it at 1 and disables shadows. The initial chase view renders roughly 70,000 triangles with about 50 draw calls. Actual frame rate depends on resolution, GPU, and browser; use Low for integrated or software-rendered graphics.

Terrain tiles are generated incrementally and old geometry is disposed. Its seeded noise eventually repeats over very long distances, but the player does not encounter a fixed world edge. The simplified flight envelope limits pitch and bank: this is a forgiving flying experience, with no combat, takeoff, landing, realistic aerodynamics, or cockpit systems. The environment is fictional and inspired by mountain ranges rather than geographic data.

The development build exposes a read-only `window.__flightDebug` snapshot for tuning and browser checks. It is omitted from production.
