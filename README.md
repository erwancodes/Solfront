# Solfront

> Mars tient la dernière ligne.

Solfront is a 3D space-combat game that runs in the browser. You fly a Martian fighter through a three-sector campaign:

1. **Mars:** defend Ares station, in low orbit, against four Terran waves.
2. **Moon:** take down the shield of the Selene shipyard above the far side.
3. **Earth:** bring down the Hegemon dreadnought above the clouds.

Ships, stations, effects and sound are generated in code. The planets and the sky use real textures (credits below). The interface is available in French and English.

## Live demo

[Play Solfront on Vercel](https://solfront-eight.vercel.app)

## Features

- **Campaign:** three sectors with their own objectives and a briefing before each, then victory and defeat screens. You can resume the current sector.
- **Planets:** Earth, the Moon and Mars, with atmosphere and terminator shaders. Earth also has night lights, clouds and specular oceans. The sky is a Milky Way panorama.
- **Procedural models:** fighters, interceptors, bombers, the Hegemon dreadnought, Ares station, and the Selene shipyard with its pylons and reactor.
- **Flight:** inertial flight with throttle, boost, roll and a sideways dodge. Lasers build heat and can overheat. You also have homing missiles with a lock-on.
- **Enemy AI:** enemies attack in roles (pursuit, attack runs, escort, bombing) and evade. Your wingman Vega flies with you, and the Wingmen perk brings a second one, Orion.
- **Perks:** between sectors you pick one modification out of three (afterburner, swarm missiles, cryo cooling, Aegis shield, and more).
- **Effects:** bloom, engine trails, explosions with shockwaves, camera shake and slow motion on big kills.
- **HUD:** target lock with lead marker, off-screen arrows, objective markers, comms, kill feed, combo and score.
- **Options:** difficulty (Recruit, Pilot, Ace), mouse sensitivity, Y-axis inversion, volume and language. Your best score is saved locally.
- **Input:** keyboard and mouse, or a gamepad. If the browser refuses pointer lock, a free-mouse mode takes over.

## Run locally

You need Node.js 22 or newer.

```bash
npm install
npm run dev
```

Production checks:

```bash
npm run lint
npm run build
npm run preview
```

## Controls

| Input | Action |
| --- | --- |
| Mouse | Aim and steer |
| Left click | Lasers |
| Right click or `F` | Missile (hold the target in the reticle to lock) |
| `W` / `S` | Throttle up / down |
| `Shift` | Boost |
| `Q` or `A`, `E` or `D` | Roll |
| `Space` | Dodge |
| `R` | Next target |
| `Esc` or `P` | Pause |

Click the screen once after launch to capture the mouse. Both AZERTY and QWERTY layouts work.

## Technology

- Three.js r185, with custom shaders and post-processing
- TypeScript
- React 19, for the interface only
- Zustand
- Vite 8
- Oxlint

There is no backend. Every asset is served locally.

## Project structure

```text
src/
  game/
    Game.ts       # loop, player flight, combat, camera, HUD frame
    missions.ts   # the three sectors and the menu skirmish
    ai.ts         # enemy and wingman behaviour
    models/       # procedural ships and stations
    world/        # planets, sky, scenery
    fx/           # lasers, trails, explosions, particles
    audio.ts      # synthesised sound (Web Audio)
    input.ts      # keyboard, mouse, gamepad, pointer lock
  ui/             # React screens and stylesheet
  i18n.ts         # French and English strings
  store.ts        # interface state
legacy/           # the previous version, kept for reference
```

The game runs outside React. Each frame, Three.js updates the scene and the HUD writes straight to the DOM. React only renders the menus and other screens.

## Asset credits and licences

### Textures

| File | Source | Credit / licence |
| --- | --- | --- |
| `planets/earth.jpg` | [Blue Marble Next Generation](https://visibleearth.nasa.gov/images/73909/december-blue-marble-next-generation-w-topography-and-bathymetry) | NASA Earth Observatory / Reto Stöckli (public domain) |
| `planets/earth-clouds.jpg` | [Blue Marble: Clouds](https://visibleearth.nasa.gov/images/57747/blue-marble-clouds) | NASA Goddard / Reto Stöckli (public domain) |
| `planets/earth-night.jpg` | [Solar System Scope](https://www.solarsystemscope.com/textures/) | Solar System Scope, based on NASA imagery (CC BY 4.0) |
| `planets/earth-normal.jpg`, `planets/earth-specular.jpg` | [three.js examples](https://github.com/mrdoob/three.js/tree/dev/examples/textures/planets) | three.js authors (MIT) |
| `planets/mars.jpg` | [Solar System Scope](https://www.solarsystemscope.com/textures/) | Solar System Scope, based on NASA/JPL imagery (CC BY 4.0) |
| `planets/moon.jpg` | [Solar System Scope](https://www.solarsystemscope.com/textures/) | Solar System Scope, based on NASA LRO imagery (CC BY 4.0) |
| `sky/milky-way.jpg` | [Solar System Scope](https://www.solarsystemscope.com/textures/) | Solar System Scope, based on ESO/S. Brunier (CC BY 4.0) |

The textures were resized to 4096 px (8192 px for the sky) and re-encoded. Nothing else was changed.

### Fonts

[Panchang](https://www.fontshare.com/fonts/panchang) and [Switzer](https://www.fontshare.com/fonts/switzer) are by the Indian Type Foundry and are served by Fontshare under the ITF Free Font License.

### Code-generated content

All ships, stations, effects and sounds are generated in code. No third-party 3D model is used.

These licences cover only the assets listed above. The Solfront source code has no licence unless one is added.
