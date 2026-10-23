import * as THREE from 'three'
import type { Game } from './Game'
import type { Hud, Line, SectorId } from '../store'
import { Structure, type GunConfig } from './entities'
import { clamp, rand, smoothstep, UP } from './math'
import { buildDreadnought, buildGenerator, buildTurret } from './models/ships'
import { buildAresStation, buildPlatform, buildPylon, buildShipyard, buildYardCore, makeShieldMaterial } from './models/stations'
import { createPlanet, loadPlanetTextures, loadTexture, type PlanetKind } from './world/planet'
import { createAsteroidField, createPhobos } from './world/scenery'
import type { Target } from './types'

export interface Mission {
  id: SectorId
  playerStart: { pos: THREE.Vector3; dir: THREE.Vector3 }
  /** Direction toward the sun for this sector. */
  sun: THREE.Vector3
  /** Point the menu camera orbits. */
  orbit: { center: THREE.Vector3; radius: number; height: number }
  start(): void
  update(dt: number): void
  objective(): Line[]
  bar(): Hud['bar']
  /** World point the HUD marks as the current objective. */
  focus(): THREE.Vector3 | null
  onKill?(t: Target): void
}

type EnemyKind = 'hornet' | 'lance' | 'atlas'

const v3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z)
const DOWN = v3(0, -1, 0)

/** Tiny scheduler so mission scripts read top to bottom. */
class Timers {
  private list: { t: number; fn: () => void }[] = []
  later(t: number, fn: () => void) {
    this.list.push({ t, fn })
  }
  update(dt: number) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const e = this.list[i]
      e.t -= dt
      if (e.t <= 0) {
        this.list.splice(i, 1)
        e.fn()
      }
    }
  }
}

async function addPlanet(g: Game, kind: PlanetKind, radius: number, pos: THREE.Vector3, segments = 160) {
  const tex = await loadPlanetTextures(kind)
  const p = createPlanet(kind, radius, tex, segments)
  p.group.position.copy(pos)
  g.missionGroup.add(p.group)
  g.planets.push(p)
  g.obstacles.push({ p: pos.clone(), r: radius * 1.02 })
  return p
}

function makeGun(head: THREE.Object3D, o: { range: number; rate: number; damage: number; speed: number }): GunConfig {
  return { head, ...o, muzzle: v3(1.6, 0, -19), timer: rand(0, 1.5), burst: 0 }
}

/** Mount a turret on a parent, standing along `normal`, and register it. */
function mountTurret(g: Game, parent: THREE.Object3D, at: THREE.Vector3, normal: THREE.Vector3, opts: { team: 'mars' | 'terra'; hp: number; gun: { range: number; rate: number; damage: number; speed: number } }) {
  const root = buildTurret()
  root.position.copy(at)
  root.quaternion.setFromUnitVectors(UP, normal.clone().normalize())
  parent.add(root)
  const s = new Structure({ team: opts.team, kind: 'turret', name: 'n.turret', root, hp: opts.hp, radius: 9, spheres: [{ p: v3(0, 4, 0), r: 9 }] })
  s.gun = makeGun(root.getObjectByName('head')!, opts.gun)
  g.addStructure(s)
  return s
}

/** Random point around a centre, kept above the planet side. */
function spawnPoint(center: THREE.Vector3, dist: number, base?: THREE.Vector3) {
  const d = base ? base.clone() : v3(rand(-1, 1), rand(-0.15, 0.55), rand(-1, 1))
  d.normalize()
  return center.clone().addScaledVector(d, dist).add(v3(rand(-160, 160), rand(-90, 90), rand(-160, 160)))
}

function towards(from: THREE.Vector3, to: THREE.Vector3) {
  return to.clone().sub(from).normalize()
}

function terraAlive(g: Game) {
  let n = 0
  for (const s of g.ships) if (s.alive && s.team === 'terra') n++
  return n
}

function blink(blinkers: THREE.Mesh[], t: number) {
  for (let i = 0; i < blinkers.length; i++) blinkers[i].visible = Math.sin(t * 3 + i * 1.7) > 0.55
}

function nearestAlive(list: Structure[], from: THREE.Vector3) {
  let best: Structure | null = null
  let bd = Infinity
  for (const s of list) {
    if (!s.alive) continue
    const d = s.position.distanceToSquared(from)
    if (d < bd) {
      bd = d
      best = s
    }
  }
  return best
}

export async function buildMission(id: SectorId, g: Game, menu = false): Promise<Mission> {
  if (id === 'selene') return buildSelene(g)
  if (id === 'gaia') return buildGaia(g)
  return buildAres(g, menu)
}

/* ------------------------------------------------------------------ */
/* Sector 1 · Ares: defend the station over Mars                        */
/* ------------------------------------------------------------------ */

async function buildAres(g: Game, menu: boolean): Promise<Mission> {
  const timers = new Timers()
  const center = v3(0, 0, 0)
  g.arenaCenter.copy(center)
  g.arenaRadius = 2600

  await addPlanet(g, 'mars', 2600, v3(0, -3800, 0))
  const moonTex = await loadTexture('/textures/planets/moon.jpg')
  const phobos = createPhobos(120, moonTex)
  phobos.position.set(1800, 400, -2200)
  g.missionGroup.add(phobos)
  g.obstacles.push({ p: phobos.position.clone(), r: 130 })
  g.updaters.push((dt) => (phobos.rotation.y += dt * 0.01))

  const model = buildAresStation()
  g.missionGroup.add(model.group)
  const station = new Structure({ team: 'mars', kind: 'station', name: 'n.station', root: model.group, hp: 5000, radius: 130, spheres: model.hitSpheres, targetable: false })
  g.addStructure(station)
  g.bomberTarget = station
  const ring = model.spinners[0]?.obj ?? model.group
  for (const slot of model.turretSlots) {
    const onRing = Math.abs(slot.x) > 100
    const t = mountTurret(g, onRing ? ring : model.group, slot, slot.y < -1 ? DOWN : UP, { team: 'mars', hp: 1, gun: { range: 1200, rate: 0.18, damage: 4, speed: 900 } })
    t.invulnerable = true
    t.targetable = false
  }
  g.updaters.push((dt) => {
    for (const s of model.spinners) s.obj.rotation.y += s.speed * dt
    blink(model.blinkers, g.time)
  })

  const waves: [EnemyKind, number][][] = [
    [['hornet', 6]],
    [['hornet', 6], ['lance', 2]],
    [['hornet', 4], ['atlas', 3]],
    [['hornet', 8], ['lance', 4], ['atlas', 2]],
  ]
  const waveComms = [null, 'c.ares.wave2', 'c.ares.wave3', 'c.ares.wave4'] as const
  let wave = -1
  let phase: 'gap' | 'fight' | 'clear' | 'lost' = 'gap'
  let gap = 5
  let warnedLow = false

  station.onDeath = () => {
    phase = 'lost'
    g.fx.bigExplosion(station.position, 260, g.camera)
    g.shake(1.4)
    timers.later(2.6, () => g.fail('station'))
  }

  const spawnWave = (i: number) => {
    const base = v3(rand(-1, 1), rand(0, 0.5), rand(-1, -0.2))
    for (const [kind, n] of waves[i]) {
      for (let k = 0; k < n; k++) {
        const p = spawnPoint(center, 2200, base)
        g.spawnEnemy(kind, p, towards(p, center))
      }
    }
    const c = waveComms[i]
    if (c) g.comm('who.ares', c)
    if (i === 2) timers.later(4, () => g.comm('who.kade', 'c.kade.taunt1'))
  }

  // menu: endless 3 v 3 skirmish around an invulnerable station
  const menuUpdate = () => {
    let mars = 0
    for (const s of g.ships) if (s.alive && s.team === 'mars') mars++
    if (mars < 3) {
      const p = spawnPoint(center, 1400)
      g.spawnShip('wingman', 'mars', p, towards(p, center), 'fighter')
    }
    if (terraAlive(g) < 3) {
      const p = spawnPoint(center, 1500)
      g.spawnEnemy(Math.random() < 0.7 ? 'hornet' : 'lance', p, towards(p, center), false)
    }
  }

  return {
    id: 'ares',
    playerStart: { pos: v3(-380, 70, 460), dir: v3(0.15, -0.04, -1).normalize() },
    sun: v3(1, 0.28, -0.45).normalize(),
    orbit: { center: center.clone(), radius: 640, height: 120 },
    start() {
      if (menu) {
        station.invulnerable = true
        g.bomberTarget = null
        return
      }
      g.comm('who.ares', 'c.ares.intro')
      timers.later(5, () => g.comm('who.vega', 'c.vega.intro'))
    },
    update(dt) {
      timers.update(dt)
      if (menu) return menuUpdate()
      if (phase === 'lost' || phase === 'clear') return
      if (!warnedLow && station.hp < station.maxHp * 0.4) {
        warnedLow = true
        g.comm('who.ares', 'c.ares.stationLow')
      }
      if (phase === 'gap') {
        gap -= dt
        if (gap <= 0) {
          wave++
          phase = 'fight'
          spawnWave(wave)
        }
      } else if (terraAlive(g) === 0) {
        if (wave >= waves.length - 1) {
          phase = 'clear'
          station.invulnerable = true
          g.comm('who.ares', 'c.ares.clear')
          timers.later(3.5, () => g.sectorComplete())
        } else {
          phase = 'gap'
          gap = 4
        }
      }
    },
    objective() {
      if (phase === 'gap' && wave >= 0) return [{ key: 'hud.waveClear' }, { key: 'hud.defend' }]
      return [{ key: 'hud.wave', params: { n: Math.max(1, wave + 1), total: waves.length } }, { key: 'hud.defend' }]
    },
    bar: () => (menu ? null : { label: 'n.station', value: Math.max(0, station.hp / station.maxHp), friendly: true }),
    focus: () => null,
  }
}

/* ------------------------------------------------------------------ */
/* Sector 2 · Selene: break the shipyard shield over the Moon           */
/* ------------------------------------------------------------------ */

async function buildSelene(g: Game): Promise<Mission> {
  const timers = new Timers()
  const center = v3(0, 100, 0)
  g.arenaCenter.copy(center)
  g.arenaRadius = 2500

  await Promise.all([addPlanet(g, 'moon', 2000, v3(0, -3200, 0)), addPlanet(g, 'earth', 9000, v3(-40000, 8000, -90000), 128)])
  const field = createAsteroidField({ center: center.clone(), inner: 1400, outer: 3200, height: 600, count: 500, seed: 42, color: 0x8a8580 })
  g.missionGroup.add(field.group)
  g.obstacles.push(...field.obstacles)
  g.updaters.push((dt) => field.update(dt))

  const yard = buildShipyard()
  g.missionGroup.add(yard.group)
  const hull = new Structure({ team: 'terra', kind: 'station', name: 'n.yard', root: yard.group, hp: 1, radius: 260, spheres: yard.hitSpheres, targetable: false })
  hull.invulnerable = true
  g.addStructure(hull)
  g.updaters.push(() => blink(yard.blinkers, g.time))

  // reactor core in its shield bubble
  const coreRoot = buildYardCore()
  coreRoot.position.set(0, 160, 60)
  g.missionGroup.add(coreRoot)
  const core = new Structure({ team: 'terra', kind: 'core', name: 'n.core', root: coreRoot, hp: 1500, radius: 26, spheres: [{ p: v3(0, 0, 0), r: 26 }] })
  core.invulnerable = true
  g.addStructure(core)
  const shieldMat = makeShieldMaterial()
  const shield = new THREE.Mesh(new THREE.SphereGeometry(70, 48, 32), shieldMat)
  coreRoot.add(shield)
  core.shieldMesh = shield
  core.shieldRadius = 70
  let shieldFade = 1
  g.updaters.push((dt) => {
    coreRoot.rotation.y += dt * 0.3
    shieldMat.uniforms.uTime.value = g.time
    if (core.shieldMesh === null && shieldFade > 0) {
      shieldFade = Math.max(0, shieldFade - dt * 0.8)
      shieldMat.uniforms.uOpacity.value = shieldFade
      shield.scale.setScalar(1 + (1 - shieldFade) * 0.4)
      if (shieldFade === 0) shield.visible = false
    }
  })

  // four pylons feeding the shield
  const pylons: Structure[] = []
  const beamMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.2, 2.6, 4.5), toneMapped: false, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false })
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4
    const root = buildPylon()
    root.position.set(Math.cos(a) * 600, 40 + (i % 2) * 90, 60 + Math.sin(a) * 600)
    root.lookAt(coreRoot.position.x, root.position.y, coreRoot.position.z)
    g.missionGroup.add(root)
    const s = new Structure({ team: 'terra', kind: 'pylon', name: 'n.pylon', root, hp: 600, radius: 40, spheres: [{ p: v3(0, 40, 0), r: 30 }] })
    g.addStructure(s)
    pylons.push(s)
    const from = root.localToWorld(v3(0, 78, 0))
    const len = from.distanceTo(coreRoot.position)
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, len, 8, 1, true), beamMat)
    beam.position.copy(from).add(coreRoot.position).multiplyScalar(0.5)
    beam.quaternion.setFromUnitVectors(UP, towards(from, coreRoot.position))
    g.missionGroup.add(beam)
    s.onDeath = () => {
      beam.visible = false
      g.fx.explode(from, 40, g.camera)
    }
  }
  g.updaters.push(() => (beamMat.opacity = 0.65 + Math.sin(g.time * 14) * 0.2))

  const turrets: Structure[] = []
  for (const [x, z] of [[-60, -200], [60, -200], [-60, 200], [60, 200]]) {
    turrets.push(mountTurret(g, yard.group, v3(x, 44, z), UP, { team: 'terra', hp: 250, gun: { range: 1300, rate: 0.2, damage: 5, speed: 850 } }))
  }

  let phase: 'pylons' | 'core' | 'done' = 'pylons'
  let spawnTimer = 6
  const dead = (l: Structure[]) => l.filter((s) => !s.alive).length

  core.onDeath = () => {
    phase = 'done'
    g.fx.bigExplosion(core.position, 220, g.camera)
    g.shake(1.2)
    g.comm('who.ares', 'c.ares.seleneClear')
    for (const t of turrets) t.gun = null
    timers.later(4.5, () => g.sectorComplete())
  }

  return {
    id: 'selene',
    playerStart: { pos: v3(0, 260, 1500), dir: v3(0, -0.08, -1).normalize() },
    sun: v3(-0.7, 0.35, 0.6).normalize(),
    orbit: { center: center.clone(), radius: 900, height: 200 },
    start() {
      g.comm('who.ares', 'c.ares.selene')
      timers.later(5, () => g.comm('who.kade', 'c.kade.selene'))
      for (let i = 0; i < 6; i++) {
        const p = spawnPoint(center, 1700, v3(0, 0.2, -1))
        g.spawnEnemy('hornet', p, towards(p, center))
      }
    },
    update(dt) {
      timers.update(dt)
      if (phase === 'done') return
      if (phase === 'pylons' && pylons.every((p) => !p.alive)) {
        phase = 'core'
        core.invulnerable = false
        core.shieldMesh = null
        g.fx.shieldHit(core.position)
        g.comm('who.ares', 'c.ares.shieldDown')
      }
      spawnTimer -= dt
      if (spawnTimer <= 0) {
        spawnTimer = 4
        if (terraAlive(g) < 8) {
          const r = Math.random()
          const p = spawnPoint(center, 1900)
          g.spawnEnemy(r < 0.6 ? 'hornet' : r < 0.85 ? 'lance' : 'atlas', p, towards(p, center))
        }
      }
    },
    objective() {
      if (phase === 'pylons') return [{ key: 'hud.pylons', params: { n: dead(pylons) } }, { key: 'hud.turrets', params: { n: dead(turrets) } }]
      return [{ key: 'hud.core' }, { key: 'hud.turrets', params: { n: dead(turrets) } }]
    },
    bar() {
      if (phase === 'pylons') return { label: 'n.pylon', value: (4 - dead(pylons)) / 4, friendly: false }
      return { label: 'n.core', value: Math.max(0, core.hp / core.maxHp), friendly: false }
    },
    focus() {
      if (phase === 'pylons') return nearestAlive(pylons, g.player?.position ?? center)?.position ?? null
      return phase === 'core' ? core.position : null
    },
  }
}

/* ------------------------------------------------------------------ */
/* Sector 3 · Gaia: the Hegemon dreadnought over Earth                  */
/* ------------------------------------------------------------------ */

async function buildGaia(g: Game): Promise<Mission> {
  const timers = new Timers()
  const center = v3(0, 200, -800)
  g.arenaCenter.copy(center)
  g.arenaRadius = 2800

  await Promise.all([addPlanet(g, 'earth', 7000, v3(0, -9000, 0), 200), addPlanet(g, 'moon', 4200, v3(52000, 9000, -70000), 96)])

  for (const [x, y, z, r] of [[-1100, -250, 500, 0.4], [1300, -380, -300, 1.9], [-300, -520, -2200, 3.1]]) {
    const p = buildPlatform()
    p.position.set(x, y, z)
    p.rotation.set(0.2, r, -0.15)
    p.scale.setScalar(2)
    g.missionGroup.add(p)
    g.obstacles.push({ p: p.position.clone(), r: 70 })
    g.updaters.push((dt) => (p.rotation.y += dt * 0.02))
  }

  // the dreadnought, kept hidden until it warps in
  const cap = buildDreadnought()
  const capFinal = v3(0, 300, -1800)
  cap.group.rotation.y = Math.PI / 2
  cap.group.position.copy(capFinal)
  cap.group.visible = false
  g.missionGroup.add(cap.group)
  const capFwd = v3(0, 0, -1).applyQuaternion(cap.group.quaternion)
  const capStart = capFinal.clone().addScaledVector(capFwd, -6000)
  const hull = new Structure({ team: 'terra', kind: 'station', name: 'n.hegemon', root: cap.group, hp: 1, radius: 230, spheres: cap.hullSpheres, targetable: false })
  hull.invulnerable = true

  const turrets: Structure[] = []
  const generators: Structure[] = []
  let reactor: Structure | null = null

  const exposeIf = () => {
    if (turrets.every((t) => !t.alive) && generators.some((s) => s.invulnerable)) {
      for (const s of generators) {
        s.invulnerable = false
        s.targetable = true
      }
      g.comm('who.ares', 'c.ares.generators')
    }
    if (reactor && generators.every((s) => !s.alive) && reactor.invulnerable) {
      reactor.invulnerable = false
      reactor.targetable = true
      g.comm('who.ares', 'c.ares.reactor')
    }
  }

  const armCapital = () => {
    g.addStructure(hull)
    for (const slot of cap.turretSlots) {
      const t = mountTurret(g, cap.group, slot, UP, { team: 'terra', hp: 400, gun: { range: 1400, rate: 0.14, damage: 6, speed: 850 } })
      t.onDeath = exposeIf
      turrets.push(t)
    }
    for (const slot of cap.generatorSlots) {
      const root = buildGenerator()
      root.position.copy(slot)
      cap.group.add(root)
      const s = new Structure({ team: 'terra', kind: 'generator', name: 'n.generator', root, hp: 700, radius: 16, spheres: [{ p: v3(0, 14, 0), r: 14 }], targetable: false })
      s.invulnerable = true
      s.onDeath = exposeIf
      g.addStructure(s)
      generators.push(s)
    }
    const rRoot = buildYardCore()
    rRoot.position.copy(cap.reactorSlot)
    rRoot.scale.setScalar(0.6)
    cap.group.add(rRoot)
    reactor = new Structure({ team: 'terra', kind: 'reactor', name: 'n.reactor', root: rRoot, hp: 1200, radius: 16, spheres: [{ p: v3(0, 0, 0), r: 24 }], targetable: false })
    reactor.invulnerable = true
    reactor.onDeath = () => {
      phase = 'dying'
      dying = 0
      g.slowmo(2, 0.25)
      g.shake(1.6)
      g.fx.bigExplosion(reactor!.position, 160, g.camera)
      g.comm('who.ares', 'c.ares.win')
      timers.later(3, () => g.comm('who.kade', 'c.kade.end'))
      for (const t of turrets) t.gun = null
      let k = 0
      for (const s of g.ships) if (s.alive && s.team === 'terra') timers.later(0.5 + k++ * 0.25, () => g.destroyShip(s))
      timers.later(8.5, () => g.victory())
    }
    g.addStructure(reactor)
  }

  let phase: 'waveA' | 'waveB' | 'perk' | 'arrive' | 'boss' | 'dying' = 'waveA'
  let arrive = 0
  let dying = 0
  let chain = 0
  let hangarTimer = 5
  let started = false

  const spawn = (list: [EnemyKind, number][]) => {
    const base = v3(rand(-1, 1), rand(0, 0.4), rand(-1, 0))
    for (const [kind, n] of list) {
      for (let k = 0; k < n; k++) {
        const p = spawnPoint(center, 2100, base)
        g.spawnEnemy(kind, p, towards(p, center))
      }
    }
  }

  const engineGlow = (k: number) => {
    // brief exhaust plume while the hull decelerates out of warp
    for (const e of cap.engines) {
      const w = cap.group.localToWorld(e.clone())
      g.fx.exhaust(w, capFwd.clone().multiplyScalar(-200 * k), capFwd.clone().negate(), new THREE.Color(1.5, 3.5, 8), 6 * k)
    }
  }

  const hangar = v3()
  const _w = v3()

  return {
    id: 'gaia',
    playerStart: { pos: v3(0, 300, 900), dir: v3(0, -0.05, -1).normalize() },
    sun: v3(0.55, 0.45, -0.7).normalize(),
    orbit: { center: center.clone(), radius: 900, height: 200 },
    start() {
      g.comm('who.ares', 'c.ares.gaia')
      timers.later(5, () => g.comm('who.kade', 'c.kade.gaia'))
      spawn([['hornet', 6], ['lance', 2]])
      started = true
    },
    update(dt) {
      timers.update(dt)
      if (!started) return
      if (phase === 'waveA' && terraAlive(g) === 0) {
        phase = 'waveB'
        timers.later(2.5, () => spawn([['hornet', 6], ['lance', 3], ['atlas', 2]]))
        g.bomberTarget = null
      } else if (phase === 'waveB' && terraAlive(g) === 0 && !timersPending()) {
        phase = 'perk'
        timers.later(2, () => {
          g.offerPerks('resume')
          phase = 'arrive'
          arrive = 0
          cap.group.position.copy(capStart)
          cap.group.visible = true
          g.audioWarp()
          g.comm('who.ares', 'c.ares.hegemon')
        })
      } else if (phase === 'arrive') {
        arrive += dt
        const k = smoothstep(0, 3.2, arrive)
        cap.group.position.lerpVectors(capStart, capFinal, 1 - Math.pow(1 - k, 4))
        engineGlow(1 - k)
        if (arrive >= 3.2) {
          phase = 'boss'
          cap.group.position.copy(capFinal)
          g.fx.warpFlash(cap.group.position, 900, g.camera)
          g.shake(1)
          armCapital()
          g.arenaCenter.copy(capFinal).add(v3(0, 0, 600))
        }
      } else if (phase === 'boss') {
        cap.group.position.addScaledVector(capFwd, 4 * dt)
        hangarTimer -= dt
        if (hangarTimer <= 0) {
          hangarTimer = 6
          if (terraAlive(g) < 8) {
            cap.group.localToWorld(hangar.copy(cap.hangar))
            const dir = capFwd.clone().add(DOWN).normalize()
            g.spawnEnemy('hornet', hangar, dir, false).velocity.copy(dir).multiplyScalar(120)
          }
        }
      } else if (phase === 'dying') {
        dying += dt
        chain -= dt
        cap.group.position.y -= dt * clamp(dying * 4, 0, 18)
        cap.group.rotation.z += dt * 0.025
        if (chain <= 0 && dying < 6) {
          chain = rand(0.12, 0.3)
          const s = cap.hullSpheres[Math.floor(Math.random() * cap.hullSpheres.length)]
          _w.copy(s.p).add(v3(rand(-1, 1), rand(-1, 1), rand(-1, 1)).multiplyScalar(s.r * 0.6))
          cap.group.localToWorld(_w)
          g.fx.explode(_w, rand(30, 70), g.camera)
          g.shake(0.25)
        }
        if (dying >= 6 && cap.group.visible) {
          g.fx.bigExplosion(cap.group.position, 700, g.camera)
          g.shake(2)
          cap.group.visible = false
          g.removeStructure(hull)
        }
      }
    },
    objective() {
      if (phase === 'waveA' || phase === 'waveB') return [{ key: 'hud.wave', params: { n: phase === 'waveA' ? 1 : 2, total: 2 } }]
      if (phase === 'perk' || phase === 'arrive') return [{ key: 'hud.incoming' }]
      const tDead = turrets.filter((t) => !t.alive).length
      const gDead = generators.filter((s) => !s.alive).length
      const lines: Line[] = [{ key: 'hud.turrets', params: { n: tDead } }]
      if (tDead === 4) lines.push({ key: 'hud.generators', params: { n: gDead } })
      if (gDead === 2) lines.push({ key: 'hud.reactor' })
      return lines
    },
    bar() {
      if (phase !== 'boss' && phase !== 'dying') return null
      let hp = 0
      let max = 0
      for (const s of [...turrets, ...generators, ...(reactor ? [reactor] : [])]) {
        hp += Math.max(0, s.hp)
        max += s.maxHp
      }
      return { label: 'n.hegemon', value: max ? hp / max : 1, friendly: false }
    },
    focus() {
      if (phase !== 'boss') return null
      const from = g.player?.position ?? center
      return (nearestAlive(turrets, from) ?? nearestAlive(generators, from) ?? (reactor?.alive ? reactor : null))?.position ?? null
    },
  }

  function timersPending() {
    return terraAlive(g) > 0
  }
}


