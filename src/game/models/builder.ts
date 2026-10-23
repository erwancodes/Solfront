import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { makeDarkMaterial, makeGlassMaterial, makeGlowMaterial, makeHullMaterial } from '../materials'

export type Bucket = 'hull' | 'dark' | 'glass' | 'glow'

export interface Section {
  z: number
  w: number
  h: number
  x?: number
  y?: number
  /** Superellipse exponent: 2 = ellipse, 4+ = rounded box. */
  n?: number
}

export interface Xform {
  p?: [number, number, number]
  r?: [number, number, number]
  s?: [number, number, number] | number
}

const _m = new THREE.Matrix4()
const _q = new THREE.Quaternion()
const _e = new THREE.Euler()
const _v = new THREE.Vector3()
const _s = new THREE.Vector3()

function xformMatrix(t?: Xform) {
  if (!t) return _m.identity()
  _e.set(...(t.r ?? [0, 0, 0]))
  _q.setFromEuler(_e)
  _v.set(...(t.p ?? [0, 0, 0]))
  if (typeof t.s === 'number') _s.setScalar(t.s)
  else _s.set(...(t.s ?? [1, 1, 1]))
  return _m.compose(_v, _q, _s)
}

function flipWinding(g: THREE.BufferGeometry) {
  const pos = g.attributes.position.array as Float32Array
  const nor = g.attributes.normal.array as Float32Array
  for (let i = 0; i < pos.length; i += 9) {
    for (let k = 0; k < 3; k++) {
      const a = i + 3 + k
      const b = i + 6 + k
      let t = pos[a]
      pos[a] = pos[b]
      pos[b] = t
      t = nor[a]
      nor[a] = nor[b]
      nor[b] = t
    }
  }
}

function normalise(g: THREE.BufferGeometry) {
  let geo = g.index ? g.toNonIndexed() : g
  if (!geo.attributes.normal) geo.computeVertexNormals()
  for (const key of Object.keys(geo.attributes)) {
    if (key !== 'position' && key !== 'normal') geo.deleteAttribute(key)
  }
  geo.morphAttributes = {}
  if (geo === g) geo = g.clone()
  return geo
}

/**
 * Collects primitive parts into one merged geometry per material bucket.
 * A finished ship is four draw calls regardless of how many parts it has.
 */
export class ModelBuilder {
  private parts: Record<Bucket, THREE.BufferGeometry[]> = { hull: [], dark: [], glass: [], glow: [] }

  add(geometry: THREE.BufferGeometry, bucket: Bucket, color: THREE.ColorRepresentation, t?: Xform, mirrorX = false) {
    const base = normalise(geometry)
    base.applyMatrix4(xformMatrix(t))
    this.push(base, bucket, color)
    if (mirrorX) {
      const m = base.clone()
      m.applyMatrix4(new THREE.Matrix4().makeScale(-1, 1, 1))
      flipWinding(m)
      this.push(m, bucket, color)
    }
    geometry.dispose()
    return this
  }

  private push(g: THREE.BufferGeometry, bucket: Bucket, color: THREE.ColorRepresentation) {
    const c = new THREE.Color(color)
    const n = g.attributes.position.count
    const arr = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) {
      arr[i * 3] = c.r
      arr[i * 3 + 1] = c.g
      arr[i * 3 + 2] = c.b
    }
    g.setAttribute('color', new THREE.BufferAttribute(arr, 3))
    this.parts[bucket].push(g)
  }

  build(mats: Materials) {
    const group = new THREE.Group()
    for (const key of Object.keys(this.parts) as Bucket[]) {
      const list = this.parts[key]
      if (!list.length) continue
      const merged = mergeGeometries(list, false)
      if (!merged) continue
      merged.computeBoundingSphere()
      const mesh = new THREE.Mesh(merged, mats[key])
      mesh.name = key
      mesh.frustumCulled = true
      group.add(mesh)
      for (const g of list) g.dispose()
    }
    return group
  }
}

export interface Materials {
  hull: THREE.Material
  dark: THREE.Material
  glass: THREE.Material
  glow: THREE.Material
}

let shared: Materials | null = null
export function sharedMaterials(): Materials {
  if (!shared) {
    const glow = makeGlowMaterial(0xffffff, 1)
    glow.vertexColors = true
    shared = {
      hull: makeHullMaterial(),
      dark: makeDarkMaterial(),
      glass: makeGlassMaterial(),
      glow,
    }
  }
  return shared
}

/** Lofted hull through superellipse cross-sections placed along +Z. */
export function loft(sections: Section[], segments = 20, caps = true) {
  const pos: number[] = []
  const idx: number[] = []
  const ring = segments
  const pt = (s: Section, t: number): [number, number, number] => {
    const n = s.n ?? 2.6
    const c = Math.cos(t)
    const si = Math.sin(t)
    const x = (s.w / 2) * Math.sign(c) * Math.pow(Math.abs(c), 2 / n)
    const y = (s.h / 2) * Math.sign(si) * Math.pow(Math.abs(si), 2 / n)
    return [x + (s.x ?? 0), y + (s.y ?? 0), s.z]
  }
  for (const s of sections) {
    for (let j = 0; j < ring; j++) pos.push(...pt(s, (j / ring) * Math.PI * 2))
  }
  for (let i = 0; i < sections.length - 1; i++) {
    for (let j = 0; j < ring; j++) {
      const a = i * ring + j
      const b = i * ring + ((j + 1) % ring)
      const c = (i + 1) * ring + j
      const d = (i + 1) * ring + ((j + 1) % ring)
      idx.push(a, b, c, b, d, c)
    }
  }
  const body = new THREE.BufferGeometry()
  body.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  body.setIndex(idx)
  body.computeVertexNormals()
  if (!caps) return body

  const capGeo = (s: Section, start: boolean) => {
    const cp: number[] = []
    const cx = s.x ?? 0
    const cy = s.y ?? 0
    for (let j = 0; j < ring; j++) {
      const p0 = pt(s, (j / ring) * Math.PI * 2)
      const p1 = pt(s, (((j + 1) % ring) / ring) * Math.PI * 2)
      if (start) cp.push(cx, cy, s.z, ...p1, ...p0)
      else cp.push(cx, cy, s.z, ...p0, ...p1)
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(cp, 3))
    g.computeVertexNormals()
    return g
  }
  const merged = mergeGeometries([body.toNonIndexed(), capGeo(sections[0], true), capGeo(sections[sections.length - 1], false)])!
  return merged
}

/** Flat plate (wing, fin) from an outline in the X/Z plane, given thickness in Y. */
export function plate(outline: [number, number][], thickness: number, bevel = 0.06) {
  const shape = new THREE.Shape()
  outline.forEach(([x, z], i) => (i === 0 ? shape.moveTo(x, z) : shape.lineTo(x, z)))
  shape.closePath()
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(0.001, thickness - bevel * 2),
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 1,
    curveSegments: 4,
  })
  // shape Y -> world Z, extrusion -> world -Y
  g.rotateX(Math.PI / 2)
  g.translate(0, thickness / 2 - bevel, 0)
  return g
}

export const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d)
/** Cylinder along Z. */
export const cylZ = (rTop: number, rBottom: number, len: number, seg = 16) => {
  const g = new THREE.CylinderGeometry(rTop, rBottom, len, seg)
  g.rotateX(Math.PI / 2)
  return g
}
export const sphere = (r: number, w = 16, h = 12) => new THREE.SphereGeometry(r, w, h)
export const torus = (r: number, tube: number, rs = 12, ts = 48) => new THREE.TorusGeometry(r, tube, rs, ts)
