# Solfront

> Mars will not surrender.

Solfront is a browser-native 3D space-combat game. Pilot a Martian fighter, defend Ares orbital station through ten escalating Terran assault waves, and destroy the invading command ship.

The game runs entirely in the browser with local assets and supports both English and French interfaces.

## Features

- Large orbital combat arena with enemies approaching from every direction.
- Third-person inertial flight with boost, lateral thrust and combat evasion.
- Hull, shield, energy and weapon-temperature management.
- Fighter, interceptor and bomber classes followed by a dreadnought boss encounter.
- Enemy state machine with pursuit, attack, patrol and evasion behaviours.
- Tactical radar, target locking, combat telemetry and station integrity tracking.
- Ten escalating waves, score tracking, victory and defeat states.
- Persistent English and French interface selection under **Options**.
- Local NASA planetary imagery and locally hosted Poly Pizza spacecraft models.

## Run locally

Requirements: Node.js 20 or newer.

```bash
npm install
npm run dev
```

Production validation:

```bash
npm run lint
npm run build
npm run preview
```

## Controls

| Input | Action |
| --- | --- |
| `W` or `Z` | Accelerate |
| `S` | Brake / reverse |
| `A` or `Q`, and `D` | Lateral thrusters |
| Mouse | Pitch and yaw |
| Left click | Fire laser cannons |
| Right click | Lock a target |
| `Shift` | Boost, consuming energy |
| `Space` | Combat evade |
| `R` | Select the nearest enemy |
| `Esc` | Pause or resume |

Click the flight area once after deployment to link mouse control. Both AZERTY and QWERTY keyboard layouts are supported.

## Technology

- React 19 and TypeScript
- Vite 8
- Three.js, React Three Fiber and Drei
- Zustand
- Tailwind CSS 4
- Oxlint

There is no backend, account system, multiplayer service or runtime dependency on a third-party asset host.

## Project structure

```text
src/
  components/
    game/       # Three.js canvas, entities, effects and mission director
    hud/        # Radar, crosshair, target lock and telemetry
    screens/    # Menu, briefing, pause and mission outcomes
  data/         # Enemy and wave definitions
  hooks/        # Flight input and targeting
  stores/       # Game, player and persisted settings state
  systems/      # AI, combat, collision, waves and runtime registry
  types/        # Shared game types
  i18n.ts       # English and French interface dictionaries
```

Per-frame transforms live in a mutable runtime registry rather than React state. Zustand carries mission state, player telemetry and user settings without forcing the React tree to render at the Three.js frame rate.

## Asset credits and licences

### NASA planetary imagery

Planetary textures are stored locally under `public/textures/planets/`.

| Local asset | Official source | Credit |
| --- | --- | --- |
| `earth.jpg` | [Blue Marble Next Generation](https://visibleearth.nasa.gov/images/73909/december-blue-marble-next-generation-w-topography-and-bathymetry) | NASA Earth Observatory / Reto Stöckli |
| `earth-clouds.png` | [Blue Marble: Clouds](https://visibleearth.nasa.gov/images/57747/blue-marble-clouds) | NASA Goddard / Reto Stöckli |
| `moon.jpg` | [NASA CGI Moon Kit](https://svs.gsfc.nasa.gov/4720/) | NASA SVS / Ernie Wright / LRO WAC |
| `mars.jpg` | [NASA/JPL Mars Texture Map](https://space.jpl.nasa.gov/tmaps/mars.html) | NASA / JPL / USGS Viking imagery |

### Poly Pizza spacecraft

Spacecraft models are stored locally under `public/models/ships/` and normalized or faction-tinted at runtime.

| In-game use | Model | Licence |
| --- | --- | --- |
| Martian fighter | [Spaceship by Liz Reddington](https://poly.pizza/m/5nWeu4IQXVX) | Creative Commons Attribution |
| Earth fighter | [Spaceship by Quaternius](https://poly.pizza/m/uCeLfsdmNP) | CC0 / Public Domain |
| Earth interceptor | [Space Craft Speeder by Kenney](https://poly.pizza/m/mlQBUQRUpM) | CC0 / Public Domain |
| Earth bomber | [Spaceship by Quaternius](https://poly.pizza/m/xNbtFQwirO) | CC0 / Public Domain |
| Terran command ship | [Colored Freighter by Jacques Fourie](https://poly.pizza/m/d0P6-jqeIzK) | Creative Commons Attribution |

The licences above apply to their respective assets. No separate licence is granted for the Solfront source code unless one is added explicitly.
