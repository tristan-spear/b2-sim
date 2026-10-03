# Spirit — arcade flight campaign

A playable browser flight and arcade combat prototype built with **Three.js, TypeScript, and Vite**. No React, backend, paid API, or downloaded aircraft assets. The world, aircraft, clouds, decals, and sound are generated locally; fonts are bundled.

## Run

Requires Node.js 22.12+ (tested with Node 24).

```sh
npm install
npm run dev
```

Open the URL printed by Vite, usually **http://localhost:5173**. Select an aircraft → START → choose an unlocked mission → prepare upgrades → START MISSION. Each aircraft has its own five-operation campaign. The app pauses when the window loses focus.

```sh
npm run build      # Type-check and build into dist/
npm run preview    # Serve the production build
npm test           # Flight, terrain, combat, and complete mission tests
npm run test:browser # Flight regression smoke test; keep the dev server running
npm run test:combat  # Play the preserved B-2 combat mission with keyboard input
npm run test:fighter # Play the F-35 mission and switch aircraft without refreshing
npm run test:lifecycle # Repeated mission transitions and GPU resource cleanup
npm run test:campaign # All ten campaign missions: menus, environments, loading, cleanup
npm run test:campaign-play # Fly both opening campaigns; verify rewards, unlocks and upgrades
npm run test:campaign-lifecycle # City GPU cleanup, crash/retry and mobile layouts
npm run test:campaign-boss # Keyboard-controlled Raven One duel and all three boss phases
npm run format     # Format source and tests
```

The browser check uses an installed Google Chrome through Playwright. It tests actual keyboard controls, all cameras, orbit drag/zoom, pause, reset, settings, sound, collision recovery, and a narrow viewport. Screenshots are written to the OS temporary directory.

## Controls

| Input                  | Action                                       |
| ---------------------- | -------------------------------------------- |
| W / S                  | Pitch down / up                              |
| A / D                  | Bank left / right                            |
| Q / E                  | Yaw left / right                             |
| Shift / Ctrl           | Increase / decrease throttle                 |
| C                      | Cycle Chase → Cinematic → Nose → Orbit       |
| Space                  | B-2: bomb; F-35: guided ground strike        |
| F                      | Fire an air-to-air missile                   |
| Tab                    | Cycle enemy aircraft / acquire lock          |
| G (F-35)               | Cycle designated ground targets              |
| Left mouse (F-35)      | Hold cannon burst (360 rounds; not in Orbit) |
| B (F-35)               | Temporary afterburner; 15-second recharge    |
| R                      | Restart mission, aircraft, targets, ammo     |
| P or Escape            | Pause / resume                               |
| H                      | Hide / show instruments                      |
| M                      | Enable / mute engine and combat audio        |
| Drag / scroll in Orbit | Rotate / zoom around the aircraft            |

Buttons support the same camera, pause, sound, and reset actions. Coarse-pointer devices get touch flight controls. Combat buttons also work on touchscreens. The help button contains a complete control reference and render-quality selector.

Start with small bank inputs. Speed responds gradually; holding a bank generates a turn. Releasing the controls gently stabilizes the wing. Below approximately 204 knots, lift falls off and the aircraft sinks. Terrain or water contact ends the flight; press **R** to fly again.

## Campaign

| Operation | B-2 / heavy strike                                                     | F-35 / air combat                                                       |
| --------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| 01        | Desert Strike — afternoon dunes, installations, radar, extraction      | Sky Patrol — morning hills, three intercepts, cannon practice bonus     |
| 02        | Mountain Fortress — morning valley, fortified depots, missile defenses | Canyon Run — midday canyon, checkpoints, fighters and ground defenses   |
| 03        | Night Raid — moonlit forest, radar network, optional fuel stores       | City Defense — lit city, three attack waves, three protected districts  |
| 04        | Coastal Assault — sunset coast, moving convoy, defenses, extraction    | Storm Front — rainy islands, radar, missile site, reinforcement wave    |
| 05        | Iron Shield — snowy fortress, phased weak points, reinforcements       | Raven One — sunrise above clouds, escorts followed by a three-phase ace |

Completing an operation unlocks the next one for that aircraft. Completed missions remain replayable. Credits, best score, fastest completion, highest rank, upgrades and selected aircraft are stored locally in a versioned `spirit-campaign-v1` save. No backend or account is required. Missing or malformed fields recover to safe defaults; blocked browser storage displays a warning and uses session-only progress. Development builds offer a two-click reset in the campaign footer.

Both aircraft start with Level I armor, engine, handling, damage, capacity and weapon-cycling upgrades. B-2 adds payload, blast radius, heavy armor and efficiency; F-35 adds missile capacity/damage, cannon package, dogfight handling and afterburner. Purchases install automatically, affect the next sortie and persist on reload. Level II is available initially; completing operations raises the cap to Level V. B-2 handling gains remain deliberately modest. Ammunition varies by mission and installed upgrades; check the loadout panel.

Rank considers time, damage sustained, accuracy, target coverage, score and optional objectives. Completion pays mission credits plus target, boss and optional bonuses, with B/A/S rank multipliers. A debrief is paid only once per run; replays can earn new rewards. Failure grants no completion reward. Debriefs support next mission, replay, upgrades and home; failures support retry, upgrades and home.

Campaign enemies fire visible, avoidable projectiles. Ground batteries launch slow-turning missiles; destroying supporting radar suppresses non-boss battery launches. Watch the incoming-missile warning and directional damage indicator. Low integrity produces smoke and warning effects without crippling the controls. Strike aircraft attack friendly city districts with actual projectiles; losing any protected district fails that operation.

Iron Shield exposes radar arrays, then its turret/launch ring, then its command core. Shielded sections cannot be damaged out of order. Raven One activates after the escorts and changes pursuit, firing and evasion behavior as its health falls. Both encounters have cinematic introductions and destruction sequences; C skips the introduction camera. All weapons, systems and opponents are fictional arcade abstractions.

## Preserved training missions (development regression)

In development, open `/?training=1` to launch the original B-2 or F-35 training scenario directly from aircraft selection. These retain their original flight tuning, weapons, targets and mission flow and do not grant campaign progression. The production menu offers the ten campaign operations.

### Original B-2 Training Strike

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
- `src/enemies/`: original patrols plus campaign pursuit, strike, break-away and ace behaviors.
- `src/world/`: eight damageable structures and a graded training compound with roads.
- `src/hud/CombatHUD.ts`: projected target brackets, bomb predictor, weapon controls, objectives, and debrief. Text refresh is capped at 10 Hz.
- `src/utils/Audio.ts`: optional synthesized engine/wind and combat audio, started only after user interaction.
- `src/main.ts`: application entry point.
- `src/game/GameManager.ts`: persistent renderer/world, home/loading/playing states, and session transitions.
- `src/game/GameSession.ts`: mission lifetime, 120 Hz simulation, pause/restart, input cleanup, HUD, and camera ownership.
- `src/aircraft/AircraftConfig.ts`: aircraft factories and qualitative stats, flight/camera profiles, default mission IDs.
- `src/game/MissionManager.ts`: extensible mission registry with aircraft association, briefing, combat and HUD factories.
- `src/missions/F35TrainingMission.ts`: four active, non-respawning fighter enemies and two designated strike sites; reuses damage, missiles, explosions, score and collision infrastructure.
- `src/menu/MainMenu.ts`: interactive flight line and original procedural aircraft previews.
- `src/menu/CampaignMenu.ts`: mission selection, unlocks, best records and loadout purchases.
- `src/campaign/catalog.ts`: ten declarative mission definitions; no mission-specific logic in `main.ts`.
- `src/campaign/`: versioned saves, upgrades, reusable objectives, health, phased bosses and campaign combat/results.
- `src/combat/EnemyFire.ts`: bounded pooled hostile projectiles, readable missile warnings and swept damage checks.
- `src/environment/MissionScenery.ts`: instanced forests/city, rain, snow and lightning; mission-owned resource disposal.
- `src/hud/CampaignHUD.ts`: composition of existing bomber/fighter HUDs with health, objectives, boss status and debrief.

## Aircraft and missions

The preserved B-2 training scenario has unchanged bomber tuning, eight bombs, six missiles, eight ground structures, three patrolling/respawning aircraft, and the existing instruments/cameras/effects. Campaign missions reuse these systems and add configured targets, hostile fire, health and progression.

The preserved F-35 training scenario is Air Superiority / Strike Training: four hostile aircraft and two ground sites. In either training or campaign, TAB selects an aircraft; keep it ahead until LOCKED, then press F. G selects a ground site and SPACE releases a guided strike. Hold left mouse (or the cannon button) for short-range bursts. Cannon is disabled in Orbit to preserve drag controls. Missiles require a lock and conserve ammo on rejected shots. Campaign enemies maneuver and fire back; mission kills never respawn.

The fighter uses an original procedural placeholder with swept wings, twin canted fins, canopy, and exhaust. `F35Aircraft.setModel()` accepts a replacement scene with +Y up and -Z forward. No external model fetch or license dependency is introduced.

ESC/P opens Resume, Restart Mission, and Return to Main Menu. Completion and crash panels also allow returning home. Sessions abort global input listeners, dispose OrbitControls and scene resources, clear projectiles/particles/score/locks, and remove HUD/dialog elements. Terrain, sky, clouds, menu scene and the single audio context intentionally persist between missions.

To add a campaign operation, add a `CampaignMissionConfig` to `src/campaign/catalog.ts` with a stable unique ID, aircraft, prerequisite, environment, spawn, objectives, enemies, rewards and loadout. `MissionManager` registers the catalog automatically; `GameManager` validates aircraft compatibility and unlock state before allocating resources. The next-mission action follows prerequisite links. Reuse objective types and their `after` dependencies for sequencing, or extend `ObjectiveSystem` for a new objective mechanic. Adding missions beyond the current five also requires updating the menu's five-operation copy. Add another aircraft through its config/model and optional behavior factories. Keep old save IDs stable or add an explicit migration when changing the version.

`npm test` exercises save recovery/idempotence, upgrade caps and live stats, every mission's configuration and objective sequence, hostile projectile damage to the player and all three protected city sites, protected-site failure, guided strikes, actual ballistic bomb collision against phased Iron Shield components, and Raven's phase/finale transitions. Some tests intentionally drive state or damage directly to isolate logic. Browser campaign smoke tests use an isolated unlocked save to load all ten maps; campaign-play uses actual keyboard/mouse weapons to complete the opening B-2 and F-35 missions, then verifies rewards, unlocks, a purchased upgrade and reload persistence. The boss browser test flies the escorts and all three Raven phases with keyboard-controlled banked turns, locks and missiles through the final debrief. These checks do not represent a full human balance playthrough of every later operation.

Pause freezes the camera as well as simulation. Tab navigates the pause actions, Shift+Tab moves backward, and Enter/Space activates the focused button. Flight input resumes after closing the overlay; Orbit controls are restored after restarting or resuming.

### Replace the aircraft

Load a GLB using Three.js `GLTFLoader` and pass its scene to `aircraft.setModel(gltf.scene)`. Normalize the replacement to **52 m wingspan, +Y up, −Z forward**, centered at its flight origin. Generated mesh effects are removed when replacing the visual. The flight controller and cameras continue using `aircraft.root`.

### Performance and scope

Balanced quality caps pixel ratio at 1.5; High caps it at 2; Low caps it at 1 and disables shadows. The initial chase view renders roughly 70,000 triangles with about 100 draw calls before combat effects. Actual frame rate depends on resolution, GPU, and browser; use Low for integrated or software-rendered graphics.

Terrain tiles are generated incrementally and old geometry is disposed. Its seeded noise eventually repeats over very long distances, but the player does not encounter a fixed world edge. The simplified flight envelope limits pitch and bank: this is a forgiving flying experience, with arcade combat, but no takeoff, landing, realistic aerodynamics, or cockpit systems. The environment is fictional and inspired by mountain ranges rather than geographic data.

Combat effects are bounded to 360 particles and four short-lived point lights. Projectile meshes/materials and expired particle materials are disposed; shared particle geometry is retained. Projectile collision uses swept bounding volumes and terrain samples rather than mesh triangle raycasts. Combat shares the 120 Hz flight step and freezes during pause, help, crash, and mission completion.

The development build exposes a read-only `window.__flightDebug` snapshot (including combat state) for tuning and browser checks. It is omitted from production.
