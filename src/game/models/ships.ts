import * as THREE from 'three'
import { mulberry32 } from '../math'
import { ModelBuilder, box, cylZ, loft, plate, sharedMaterials, sphere, type Section } from './builder'

export type ShipKind = 'vanguard' | 'wingman' | 'hornet' | 'lance' | 'atlas'

export interface ShipModel {
  group: THREE.Group
  /** Local gun muzzle positions. */
  muzzles: THREE.Vector3[]
  /** Local engine exhaust positions. */
  engines: THREE.Vector3[]
  engineColor: THREE.Color
  radius: number
}

const MARS = {
  hull: 0xd9d3c9,
  rust: 0xa33a1c,
  yellow: 0xf6e016,
  dark: 0x2a2c2f,
  engine: new THREE.Color(1.0, 0.62, 0.24),
}
const TERRA = {
  hull: 0xbcc5cf,
  navy: 0x24324a,
  white: 0xeef1f4,
  dark: 0x23272d,
  engine: new THREE.Color(0.35, 0.72, 1.0),
}

const hdr = (c: THREE.Color, k: number) => c.clone().multiplyScalar(k)
const v3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)

function vanguard(livery: 'player' | 'wingman'): ShipModel {
  const b = new ModelBuilder()
  const hull = livery === 'player' ? MARS.hull : 0x8f8a83
  const wing = livery === 'player' ? MARS.rust : 0x6e2a17
  const fuselage: Section[] = [
    { z: -9.6, w: 0.12, h: 0.1, y: -0.05, n: 2.4 },
    { z: -8.2, w: 0.9, h: 0.55, n: 2.6 },
    { z: -5.5, w: 1.6, h: 1.0, y: 0.05, n: 2.8 },
    { z: -2, w: 2.1, h: 1.35, y: 0.1, n: 3 },
    { z: 1.5, w: 2.4, h: 1.3, y: 0.05, n: 3.2 },
    { z: 4.5, w: 2.2, h: 1.1, n: 3.2 },
    { z: 6.1, w: 1.7, h: 0.85, n: 3 },
  ]
  b.add(loft(fuselage, 24), 'hull', hull)
  b.add(
    loft([
      { z: -5.4, w: 0.15, h: 0.1, y: 0.42 },
      { z: -4.2, w: 0.85, h: 0.62, y: 0.55 },
      { z: -2, w: 1.0, h: 0.82, y: 0.66 },
      { z: -0.2, w: 0.55, h: 0.42, y: 0.6 },
    ], 18),
    'glass',
    0xffffff,
  )
  // wings, with a stripe of signal yellow near the tip
  b.add(plate([[1, -1.5], [7.2, 2.8], [7.4, 4.2], [1, 4.6]], 0.28), 'hull', wing, { p: [0, -0.1, 0], r: [0, 0, -0.05] }, true)
  b.add(plate([[5, 1.32], [5.6, 1.74], [5.6, 4.27], [5, 4.33]], 0.31, 0.03), 'hull', MARS.yellow, { p: [0, -0.1, 0], r: [0, 0, -0.05] }, true)
  // wingtip cannons
  b.add(cylZ(0.13, 0.19, 4.6, 10), 'dark', MARS.dark, { p: [7.0, -0.32, 1.6] }, true)
  b.add(box(0.55, 0.5, 2.6), 'dark', MARS.dark, { p: [7.0, -0.32, 3.2] }, true)
  // engines
  b.add(cylZ(0.72, 0.66, 4.2, 18), 'hull', hull, { p: [1.35, -0.05, 4.6] }, true)
  b.add(cylZ(0.6, 0.8, 0.9, 18), 'dark', MARS.dark, { p: [1.35, -0.05, 7.0] }, true)
  b.add(cylZ(0.52, 0.52, 0.06, 18), 'glow', hdr(MARS.engine, 7), { p: [1.35, -0.05, 7.4] }, true)
  // canted tail fins
  b.add(plate([[0, 3], [2.2, 5.5], [2.2, 6.5], [0, 6.4]], 0.18), 'hull', wing, { p: [0.85, 0.45, 0], r: [0, 0, Math.PI / 2 - 0.38] }, true)
  // intakes, spine, belly
  b.add(box(0.5, 0.62, 2.6), 'dark', MARS.dark, { p: [1.15, -0.2, -1.4] }, true)
  b.add(box(0.36, 0.1, 5.4), 'hull', wing, { p: [0, 0.74, 2.0] })
  b.add(box(0.28, 0.06, 0.9), 'hull', MARS.yellow, { p: [0, 0.3, -7.0], r: [0.12, 0, 0] })
  b.add(box(1.5, 0.24, 6.2), 'dark', MARS.dark, { p: [0, -0.62, 0.4] })
  // nav lights
  b.add(sphere(0.12, 8, 6), 'glow', new THREE.Color(4, 0.2, 0.15), { p: [-7.45, -0.1, 4.2] })
  b.add(sphere(0.12, 8, 6), 'glow', new THREE.Color(0.2, 4, 0.6), { p: [7.45, -0.1, 4.2] })
  const group = b.build(sharedMaterials())
  return {
    group,
    muzzles: [v3(-7.0, -0.32, -0.8), v3(7.0, -0.32, -0.8)],
    engines: [v3(-1.35, -0.05, 7.6), v3(1.35, -0.05, 7.6)],
    engineColor: MARS.engine,
    radius: 5.5,
  }
}

function hornet(): ShipModel {
  const b = new ModelBuilder()
  b.add(
    loft([
      { z: -5.2, w: 0.3, h: 0.3 },
      { z: -3.6, w: 1.5, h: 1.35 },
      { z: 0, w: 2.3, h: 2.1 },
      { z: 2.6, w: 2.1, h: 1.9 },
      { z: 3.8, w: 1.3, h: 1.2 },
    ], 22),
    'hull',
    TERRA.hull,
  )
  b.add(loft([{ z: -4.6, w: 0.3, h: 0.2, y: 0.35 }, { z: -3.2, w: 1.0, h: 0.7, y: 0.65 }, { z: -1.4, w: 0.9, h: 0.6, y: 0.85 }], 14), 'glass', 0xffffff)
  // four blades in an X
  for (const tilt of [0.45, -0.45]) {
    b.add(plate([[0.8, -1], [5.4, 1.1], [5.5, 2.9], [0.8, 3.1]], 0.22), 'hull', TERRA.navy, { r: [0, 0, tilt] }, true)
    const tx = 5.45 * Math.cos(tilt)
    const ty = 5.45 * Math.sin(tilt)
    b.add(cylZ(0.14, 0.2, 3.8, 10), 'dark', TERRA.dark, { p: [tx, ty, 0.9] }, true)
    b.add(box(0.34, 0.34, 1.1), 'hull', TERRA.white, { p: [tx, ty, 2.5] }, true)
  }
  b.add(cylZ(0.9, 1.1, 1.4, 18), 'dark', TERRA.dark, { p: [0, 0, 4.2] })
  b.add(cylZ(0.75, 0.75, 0.06, 18), 'glow', hdr(TERRA.engine, 7), { p: [0, 0, 4.9] })
  b.add(box(0.2, 0.2, 2.2), 'hull', TERRA.white, { p: [0, 1.05, 0.6] })
  b.add(sphere(0.1, 8, 6), 'glow', new THREE.Color(4, 0.2, 0.15), { p: [0, 1.2, 1.8] })
  const tx = 5.45 * Math.cos(0.45)
  const ty = 5.45 * Math.sin(0.45)
  return {
    group: b.build(sharedMaterials()),
    muzzles: [v3(tx, ty, -1), v3(-tx, -ty, -1), v3(-tx, ty, -1), v3(tx, -ty, -1)],
    engines: [v3(0, 0, 5)],
    engineColor: TERRA.engine,
    radius: 5.2,
  }
}

function lance(): ShipModel {
  const b = new ModelBuilder()
  b.add(
    loft([
      { z: -11, w: 0.1, h: 0.08 },
      { z: -8, w: 0.75, h: 0.5 },
      { z: -3, w: 1.35, h: 0.95 },
      { z: 2, w: 1.55, h: 1.05 },
      { z: 5, w: 1.25, h: 0.9 },
      { z: 6.2, w: 0.95, h: 0.75 },
    ], 20),
    'hull',
    TERRA.white,
  )
  b.add(loft([{ z: -6.5, w: 0.1, h: 0.1, y: 0.3 }, { z: -4.5, w: 0.7, h: 0.5, y: 0.5 }, { z: -2.5, w: 0.6, h: 0.4, y: 0.5 }], 12), 'glass', 0xffffff)
  b.add(plate([[0.6, -0.5], [5.2, 4.6], [5.2, 5.8], [0.6, 5.2]], 0.16), 'hull', TERRA.navy, { r: [0, 0, 0.06] }, true)
  b.add(plate([[0.5, -6], [2.1, -4.6], [2.1, -4.1], [0.5, -4.1]], 0.12), 'hull', TERRA.navy, {}, true)
  b.add(plate([[0, 2.5], [1.8, 5.2], [1.8, 6.2], [0, 6.2]], 0.14), 'hull', TERRA.navy, { p: [0, 0.4, 0], r: [0, 0, Math.PI / 2] })
  b.add(cylZ(0.1, 0.14, 3, 8), 'dark', TERRA.dark, { p: [0.85, -0.3, -5.5] }, true)
  b.add(cylZ(0.7, 0.85, 1.2, 16), 'dark', TERRA.dark, { p: [0, 0, 6.6] })
  b.add(cylZ(0.6, 0.6, 0.06, 16), 'glow', hdr(TERRA.engine, 8), { p: [0, 0, 7.2] })
  return {
    group: b.build(sharedMaterials()),
    muzzles: [v3(0.85, -0.3, -7.1), v3(-0.85, -0.3, -7.1)],
    engines: [v3(0, 0, 7.3)],
    engineColor: TERRA.engine,
    radius: 4.6,
  }
}

function atlas(): ShipModel {
  const b = new ModelBuilder()
  b.add(
    loft([
      { z: -6.5, w: 2, h: 1.2, n: 4 },
      { z: -4.2, w: 4.6, h: 2.1, n: 4 },
      { z: 2, w: 5.6, h: 2.5, n: 4.5 },
      { z: 6, w: 5.1, h: 2.3, n: 4.5 },
      { z: 7.2, w: 4, h: 1.8, n: 4 },
    ], 24),
    'hull',
    TERRA.hull,
  )
  b.add(loft([{ z: -5.8, w: 0.6, h: 0.2, y: 0.6 }, { z: -4.4, w: 2.4, h: 0.7, y: 0.95 }, { z: -2.8, w: 2.2, h: 0.6, y: 1.05 }], 16), 'glass', 0xffffff)
  b.add(cylZ(1.0, 1.05, 10, 18), 'hull', TERRA.navy, { p: [4.1, 0, 1] }, true)
  b.add(sphere(1.0, 16, 10), 'hull', TERRA.navy, { p: [4.1, 0, -4], s: [1, 1, 1.6] }, true)
  b.add(box(1.6, 0.5, 3.2), 'dark', TERRA.dark, { p: [2.9, 0, 1.5] }, true)
  b.add(box(2.6, 0.7, 6.5), 'dark', TERRA.dark, { p: [0, -1.25, 0.5] })
  b.add(box(5.2, 0.15, 1.2), 'hull', TERRA.white, { p: [0, 1.25, 3.2] })
  b.add(cylZ(0.75, 0.9, 1.0, 16), 'dark', TERRA.dark, { p: [4.1, 0, 6.4] }, true)
  b.add(cylZ(0.62, 0.62, 0.06, 16), 'glow', hdr(TERRA.engine, 7), { p: [4.1, 0, 6.95] }, true)
  b.add(cylZ(0.62, 0.75, 0.8, 16), 'dark', TERRA.dark, { p: [1.4, 0, 7.4] }, true)
  b.add(cylZ(0.5, 0.5, 0.06, 16), 'glow', hdr(TERRA.engine, 7), { p: [1.4, 0, 7.85] }, true)
  b.add(box(0.5, 0.5, 2.2), 'dark', TERRA.dark, { p: [0, -0.6, -6.4] })
  return {
    group: b.build(sharedMaterials()),
    muzzles: [v3(0, -0.6, -7.6)],
    engines: [v3(4.1, 0, 7.1), v3(-4.1, 0, 7.1), v3(1.4, 0, 8), v3(-1.4, 0, 8)],
    engineColor: TERRA.engine,
    radius: 7.5,
  }
}

const cache = new Map<ShipKind, ShipModel>()

export function getShipModel(kind: ShipKind): ShipModel {
  let base = cache.get(kind)
  if (!base) {
    base =
      kind === 'vanguard' ? vanguard('player') : kind === 'wingman' ? vanguard('wingman') : kind === 'hornet' ? hornet() : kind === 'lance' ? lance() : atlas()
    cache.set(kind, base)
  }
  return {
    group: base.group.clone(),
    muzzles: base.muzzles.map((m) => m.clone()),
    engines: base.engines.map((m) => m.clone()),
    engineColor: base.engineColor,
    radius: base.radius,
  }
}

/* ------------------------------------------------------------------ */
/* Capital ship                                                        */
/* ------------------------------------------------------------------ */

export interface CapitalModel {
  group: THREE.Group
  turretSlots: THREE.Vector3[]
  generatorSlots: THREE.Vector3[]
  reactorSlot: THREE.Vector3
  hangar: THREE.Vector3
  engines: THREE.Vector3[]
  hullSpheres: { p: THREE.Vector3; r: number }[]
}

export function buildDreadnought(): CapitalModel {
  const b = new ModelBuilder()
  const rnd = mulberry32(7331)
  const sections: Section[] = [
    { z: -215, w: 18, h: 10, n: 3 },
    { z: -175, w: 72, h: 30, n: 3.4 },
    { z: -60, w: 112, h: 44, n: 3.6 },
    { z: 80, w: 122, h: 50, n: 3.8 },
    { z: 170, w: 102, h: 46, n: 3.8 },
    { z: 205, w: 82, h: 40, n: 3.6 },
  ]
  b.add(loft(sections, 32), 'hull', TERRA.hull)
  b.add(box(42, 20, 270), 'hull', 0x7d8792, { p: [0, -27, 30] })
  b.add(box(20, 14, 200), 'hull', 0x9aa4ae, { p: [0, 24, -10] })
  // bridge tower
  b.add(box(44, 36, 34), 'hull', TERRA.hull, { p: [0, 40, 125] })
  b.add(box(64, 10, 20), 'hull', 0xa9b2bb, { p: [0, 62, 118] })
  b.add(box(60, 1.6, 0.6), 'glow', new THREE.Color(3, 3.2, 3.4), { p: [0, 62, 107.8] })
  b.add(box(10, 30, 10), 'hull', TERRA.navy, { p: [0, 80, 130] })
  b.add(cylZ(0.6, 0.6, 30, 6), 'dark', TERRA.dark, { p: [0, 98, 130], r: [Math.PI / 2, 0, 0] })
  // engine bank
  for (const [x, y] of [[-32, 10], [0, 10], [32, 10], [-32, -14], [0, -14], [32, -14]]) {
    b.add(cylZ(12, 14, 26), 'dark', TERRA.dark, { p: [x, y, 212] })
    b.add(cylZ(10.5, 10.5, 0.4), 'glow', hdr(TERRA.engine, 6), { p: [x, y, 225.4] })
  }
  // hangar mouth
  b.add(box(36, 12, 4), 'glow', new THREE.Color(0.6, 1.2, 2.2), { p: [0, -30, -106] })
  b.add(box(44, 18, 10), 'dark', TERRA.dark, { p: [0, -30, -100] })
  // navy livery bands
  for (const z of [-120, -20, 60]) b.add(box(2, 2, 6), 'hull', TERRA.navy, { p: [0, 0, z], s: [60, 26, 1] })
  // surface detail: boxes along the upper and lower hull
  const halfAt = (z: number) => {
    for (let i = 0; i < sections.length - 1; i++) {
      const a = sections[i]
      const c = sections[i + 1]
      if (z >= a.z && z <= c.z) {
        const t = (z - a.z) / (c.z - a.z)
        return { w: (a.w + (c.w - a.w) * t) / 2, h: (a.h + (c.h - a.h) * t) / 2 }
      }
    }
    return { w: 10, h: 5 }
  }
  for (let i = 0; i < 170; i++) {
    const z = -170 + rnd() * 360
    const { w, h } = halfAt(z)
    const top = rnd() > 0.35
    const x = (rnd() * 2 - 1) * w * 0.7
    const sx = 3 + rnd() * 12
    const sy = 1.5 + rnd() * 6
    const sz = 3 + rnd() * 16
    const y = (top ? 1 : -1) * (h * Math.sqrt(Math.max(0, 1 - Math.pow(Math.abs(x) / w, 3))) * 0.92 + sy / 2 - 1)
    const tone = rnd()
    b.add(box(sx, sy, sz), tone > 0.75 ? 'dark' : 'hull', tone > 0.75 ? TERRA.dark : tone > 0.4 ? 0x9aa3ad : 0xc7ced5, { p: [x, y, z] })
  }
  // window rows on the flanks
  for (let i = 0; i < 140; i++) {
    const z = -150 + rnd() * 320
    const { w } = halfAt(z)
    const side = rnd() > 0.5 ? 1 : -1
    const y = -10 + rnd() * 18
    b.add(box(0.5, 0.9, 2.2), 'glow', new THREE.Color(2.4, 2.1, 1.6), { p: [side * (w * 0.985), y, z] })
  }
  const group = b.build(sharedMaterials())
  const hullSpheres: { p: THREE.Vector3; r: number }[] = []
  for (let z = -190; z <= 200; z += 30) {
    const { w, h } = halfAt(z)
    hullSpheres.push({ p: v3(0, 0, z), r: Math.min(w, h * 1.5) })
    if (w > 30) {
      hullSpheres.push({ p: v3(w * 0.55, 0, z), r: h })
      hullSpheres.push({ p: v3(-w * 0.55, 0, z), r: h })
    }
  }
  hullSpheres.push({ p: v3(0, 45, 125), r: 30 })
  return {
    group,
    turretSlots: [v3(-46, 25, -90), v3(46, 25, -90), v3(-52, 28, 30), v3(52, 28, 30)],
    generatorSlots: [v3(-34, 26, 165), v3(34, 26, 165)],
    reactorSlot: v3(0, -40, 150),
    hangar: v3(0, -30, -112),
    engines: [v3(-32, 10, 226), v3(0, 10, 226), v3(32, 10, 226), v3(-32, -14, 226), v3(0, -14, 226), v3(32, -14, 226)],
    hullSpheres,
  }
}

export function buildTurret(): THREE.Group {
  const b = new ModelBuilder()
  b.add(cylZ(7, 8, 4, 20), 'hull', 0x8c96a1, { r: [Math.PI / 2, 0, 0] })
  b.add(sphere(6, 20, 10), 'hull', 0xaab3bc, { p: [0, 2, 0], s: [1, 0.6, 1] })
  const base = b.build(sharedMaterials())
  const head = new ModelBuilder()
  head.add(box(7, 4, 7), 'hull', 0x9aa4ae)
  head.add(cylZ(0.9, 1.1, 18, 10), 'dark', TERRA.dark, { p: [1.6, 0, -10] }, true)
  head.add(box(1.6, 1.6, 1), 'glow', hdr(TERRA.engine, 4), { p: [0, 0.6, -3.6] })
  const h = head.build(sharedMaterials())
  h.name = 'head'
  h.position.y = 5
  base.add(h)
  return base
}

export function buildGenerator(): THREE.Group {
  const b = new ModelBuilder()
  b.add(cylZ(9, 11, 6, 24), 'hull', 0x8c96a1, { r: [Math.PI / 2, 0, 0] })
  b.add(cylZ(3, 3, 18, 12), 'dark', TERRA.dark, { p: [0, 10, 0], r: [Math.PI / 2, 0, 0] })
  b.add(sphere(6, 24, 16), 'glow', hdr(TERRA.engine, 5), { p: [0, 22, 0] })
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2
    b.add(box(1.2, 16, 1.2), 'hull', TERRA.white, { p: [Math.cos(a) * 7, 12, Math.sin(a) * 7], r: [Math.sin(a) * 0.3, 0, -Math.cos(a) * 0.3] })
  }
  return b.build(sharedMaterials())
}

export { MARS as MARS_COLORS, TERRA as TERRA_COLORS }
