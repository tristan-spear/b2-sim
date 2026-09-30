# Spirit — flight and combat prototype

A playable browser flight and arcade combat prototype built with **Three.js, TypeScript, and Vite**. No React, backend, paid API, or downloaded aircraft assets. The world, aircraft, clouds, decals, and sound are generated locally; fonts are bundled.

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
npm test           # Flight, terrain, combat, and complete mission tests
npm run test:browser # Flight regression smoke test; keep the dev server running
npm run test:combat  # Play an entire combat mission with keyboard input
npm run format     # Format source and tests
```

The browser check uses an installed Google Chrome through Playwright. It tests actual keyboard controls, all cameras, orbit drag/zoom, pause, reset, settings, sound, collision recovery, and a narrow viewport. Screenshots are written to the OS temporary directory.

## Controls

| Input                  | Action                                   |
| ---------------------- | ---------------------------------------- |
| W / S                  | Pitch down / up                          |
| A / D                  | Bank left / right                        |
| Q / E                  | Yaw left / right                         |
| Shift / Ctrl           | Increase / decrease throttle             |
| C                      | Cycle Chase → Cinematic → Nose → Orbit   |
| Space                  | Drop a bomb (8 available)                |
| F                      | Fire a missile (6 available)             |
| Tab                    | Cycle enemy aircraft / acquire lock      |
| R                      | Restart mission, aircraft, targets, ammo |
| P or Escape            | Pause / resume                           |
| H                      | Hide / show instruments                  |
| M                      | Enable / mute engine and combat audio    |
| Drag / scroll in Orbit | Rotate / zoom around the aircraft        |

Buttons support the same camera, pause, sound, and reset actions. Coarse-pointer devices get touch flight controls. Combat buttons also work on touchscreens. The help button contains a complete control reference and render-quality selector.

Start with small bank inputs. Speed responds gradually; holding a bank generates a turn. Releasing the controls gently stabilizes the wing. Below approximately 204 knots, lift falls off and the aircraft sinks. Terrain or water contact ends the flight; press **R** to fly again.

## Training Strike

Destroy the radar tower, intercept three patrol aircraft, and destroy the command building. The HUD tracks objectives, score, target health/range, and elapsed mission time. Completion shows the final score, target count, and time, with a restart button. **R restarts the entire mission**, including ammo, enemies, wrecks, score, and effects; it also recovers from a crash.

The fictional range is directly ahead of the starting aircraft. Keep level and watch the **IMPACT** ring: it predicts where an unguided bomb will hit, including inherited aircraft velocity, gravity, terrain, and building roofs. It turns green and reads **RELEASE** near a target. Drop before you pass overhead. Bombs have a forgiving 190 m blast radius and a 0.65 s release cooldown.

**Tab** selects a bandit. **LOCKED** means it is alive and within 6.5 km; **F** launches a missile toward it. Missiles turn gradually and lead moving targets. Without a valid lock, they fly straight. They travel at 650 m/s, expire after 14 s, and have a 0.8 s launch cooldown. Patrol aircraft respawn after 14 s, allowing another interception if you miss. Ground targets remain wrecked until restart. Enemies do not fire back in this prototype.

Scores: aircraft 500, small building 100, hangar 250, radar 300, command 750. Every new enemy life can earn points; a wreck cannot score twice. Generated missile, bomb, explosion, and lock audio uses the existing **M** sound toggle and requires no assets.

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
- `src/combat/`: reusable health, swept collision tests, ballistic bombs, homing missiles, target selection, bounded explosion/trail effects, scoring/objectives, and the combat coordinator.
- `src/enemies/`: low-poly patrol aircraft and respawn management.
- `src/world/`: eight damageable structures and a graded training compound with roads.
- `src/hud/CombatHUD.ts`: projected target brackets, bomb predictor, weapon controls, objectives, and debrief. Text refresh is capped at 10 Hz.
- `src/utils/Audio.ts`: optional synthesized engine/wind and combat audio, started only after user interaction.
- `src/main.ts`: composition and render loop, with 120 Hz fixed physics steps.

### Replace the aircraft

Load a GLB using Three.js `GLTFLoader` and pass its scene to `aircraft.setModel(gltf.scene)`. Normalize the replacement to **52 m wingspan, +Y up, −Z forward**, centered at its flight origin. Generated mesh effects are removed when replacing the visual. The flight controller and cameras continue using `aircraft.root`.

### Performance and scope

Balanced quality caps pixel ratio at 1.5; High caps it at 2; Low caps it at 1 and disables shadows. The initial chase view renders roughly 70,000 triangles with about 100 draw calls before combat effects. Actual frame rate depends on resolution, GPU, and browser; use Low for integrated or software-rendered graphics.

Terrain tiles are generated incrementally and old geometry is disposed. Its seeded noise eventually repeats over very long distances, but the player does not encounter a fixed world edge. The simplified flight envelope limits pitch and bank: this is a forgiving flying experience, with arcade combat, but no takeoff, landing, realistic aerodynamics, or cockpit systems. The environment is fictional and inspired by mountain ranges rather than geographic data.

Combat effects are bounded to 360 particles and four short-lived point lights. Projectile meshes/materials and expired particle materials are disposed; shared particle geometry is retained. Projectile collision uses swept bounding volumes and terrain samples rather than mesh triangle raycasts. Combat shares the 120 Hz flight step and freezes during pause, help, crash, and mission completion.

The development build exposes a read-only `window.__flightDebug` snapshot (including combat state) for tuning and browser checks. It is omitted from production.
