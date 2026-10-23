import * as THREE from 'three'
import type { Target } from './types'

/**
 * Combat overlay drawn on a 2D canvas over the WebGL view: aim circle, nose
 * cross, target brackets with lead pips, lock diamond, off-screen arrows,
 * radar, hit marker and damage arcs. Everything is flat, no glows.
 */

const INK = '#f1eee8'
const ENEMY = '#e0532a'
const ACCENT = '#f6e016'
const FRIEND = '#9fd0ff'

export interface HudFrame {
  camera: THREE.PerspectiveCamera
  /** Player world position and orientation; null while dead or in menus. */
  player: { position: THREE.Vector3; quaternion: THREE.Quaternion } | null
  aimPoint: THREE.Vector3
  nosePoint: THREE.Vector3
  targets: Target[]
  selected: Target | null
  lead: THREE.Vector3 | null
  /** 0..1 lock progress on the selected target. */
  lock: number
  hitMarker: number
  kill: number
  /** World directions damage came from, with remaining life 0..1. */
  damage: { dir: THREE.Vector3; t: number }[]
  missiles: THREE.Vector3[]
  radarRange: number
  lang: 'fr' | 'en'
  objectivePoint: THREE.Vector3 | null
}

const _v = new THREE.Vector3()
const _q = new THREE.Quaternion()

export class HudCanvas {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private w = 1
  private h = 1
  private dpr = 1

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')!
  }

  resize(w: number, h: number) {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2)
    this.w = w
    this.h = h
    this.canvas.width = Math.round(w * this.dpr)
    this.canvas.height = Math.round(h * this.dpr)
    this.canvas.style.width = `${w}px`
    this.canvas.style.height = `${h}px`
  }

  clear() {
    this.ctx.setTransform(1, 0, 0, 1, 0, 0)
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
  }

  /** Screen position of a world point; z > 1 means behind the camera. */
  private project(p: THREE.Vector3, cam: THREE.PerspectiveCamera) {
    _v.copy(p).applyMatrix4(cam.matrixWorldInverse)
    const behind = _v.z > 0
    _v.applyMatrix4(cam.projectionMatrix)
    let x = (_v.x * 0.5 + 0.5) * this.w
    let y = (-_v.y * 0.5 + 0.5) * this.h
    if (behind) {
      x = this.w - x
      y = this.h - y
    }
    return { x, y, behind }
  }

  draw(f: HudFrame) {
    this.clear()
    const c = this.ctx
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
    c.lineCap = 'round'
    c.lineJoin = 'round'
    if (!f.player) return
    const cam = f.camera
    const cx = this.w / 2
    const cy = this.h / 2
    const s = Math.min(this.w, this.h) / 900

    // aim circle
    const aim = this.project(f.aimPoint, cam)
    c.strokeStyle = INK
    c.globalAlpha = 0.9
    c.lineWidth = 1.6
    c.beginPath()
    c.arc(aim.x, aim.y, 16 * s + 4, 0, Math.PI * 2)
    c.stroke()
    c.fillStyle = INK
    c.fillRect(aim.x - 1.2, aim.y - 1.2, 2.4, 2.4)

    // nose cross: where the hull points, the ship catches up to the circle
    const nose = this.project(f.nosePoint, cam)
    if (!nose.behind) {
      c.globalAlpha = 0.65
      c.lineWidth = 2
      const r = 9 * s + 3
      c.beginPath()
      c.moveTo(nose.x - r, nose.y)
      c.lineTo(nose.x - r * 0.35, nose.y)
      c.moveTo(nose.x + r * 0.35, nose.y)
      c.lineTo(nose.x + r, nose.y)
      c.moveTo(nose.x, nose.y + r * 0.35)
      c.lineTo(nose.x, nose.y + r)
      c.stroke()
    }

    // hit marker
    if (f.hitMarker > 0) {
      c.globalAlpha = f.hitMarker
      c.strokeStyle = f.kill > 0 ? ACCENT : INK
      c.lineWidth = f.kill > 0 ? 3 : 2
      const a = 10 * s + 6
      const b = a + 8
      c.beginPath()
      for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        c.moveTo(aim.x + dx * a, aim.y + dy * a)
        c.lineTo(aim.x + dx * b, aim.y + dy * b)
      }
      c.stroke()
    }

    // targets
    c.font = `500 ${Math.round(12 + s * 2)}px Switzer, system-ui, sans-serif`
    c.textBaseline = 'top'
    for (const t of f.targets) {
      if (!t.alive || !t.targetable) continue
      const p = this.project(t.position, cam)
      const dist = t.position.distanceTo(cam.position)
      const sel = t === f.selected
      const friendly = t.team === 'mars'
      const col = sel ? ACCENT : friendly ? FRIEND : ENEMY
      const onScreen = !p.behind && p.x > 0 && p.x < this.w && p.y > 0 && p.y < this.h
      if (!onScreen) {
        if (!friendly || sel) this.arrow(p.x, p.y, p.behind, col, sel)
        continue
      }
      const px = Math.max(10, (t.radius / Math.max(1, dist)) * (this.h / (2 * Math.tan((cam.fov * Math.PI) / 360))))
      const r = Math.min(160, px + 6)
      c.globalAlpha = friendly && !sel ? 0.6 : 1
      c.strokeStyle = col
      c.lineWidth = sel ? 2.4 : 1.8
      this.bracket(p.x, p.y, r)
      if (sel || (!friendly && dist < 900)) {
        c.fillStyle = col
        c.fillText(`${Math.round(dist)}`, p.x + r + 6, p.y - r)
        // hull ticks under the bracket
        const hp = Math.max(0, t.hp / t.maxHp)
        c.globalAlpha = 0.35
        c.fillRect(p.x - r, p.y + r + 5, r * 2, 3)
        c.globalAlpha = 1
        c.fillRect(p.x - r, p.y + r + 5, r * 2 * hp, 3)
      }
      if (sel && f.lock > 0) {
        // lock diamond closing in
        const k = f.lock >= 1 ? 1 : f.lock
        const d = r + 6 + (1 - k) * 40
        c.globalAlpha = f.lock >= 1 ? 1 : 0.5 + k * 0.5
        c.strokeStyle = f.lock >= 1 ? ENEMY : ACCENT
        c.lineWidth = f.lock >= 1 ? 3 : 2
        c.beginPath()
        c.moveTo(p.x, p.y - d)
        c.lineTo(p.x + d, p.y)
        c.lineTo(p.x, p.y + d)
        c.lineTo(p.x - d, p.y)
        c.closePath()
        c.stroke()
      }
    }

    // lead pip
    if (f.lead && f.selected?.alive) {
      const p = this.project(f.lead, cam)
      if (!p.behind) {
        c.globalAlpha = 1
        c.strokeStyle = ACCENT
        c.lineWidth = 2
        c.beginPath()
        c.arc(p.x, p.y, 5, 0, Math.PI * 2)
        c.stroke()
      }
    }

    // objective marker
    if (f.objectivePoint) {
      const p = this.project(f.objectivePoint, cam)
      const on = !p.behind && p.x > 0 && p.x < this.w && p.y > 0 && p.y < this.h
      c.globalAlpha = 0.9
      if (on) {
        c.fillStyle = ACCENT
        c.beginPath()
        c.moveTo(p.x, p.y - 12)
        c.lineTo(p.x + 7, p.y - 24)
        c.lineTo(p.x - 7, p.y - 24)
        c.closePath()
        c.fill()
      } else this.arrow(p.x, p.y, p.behind, ACCENT, false)
    }

    // damage arcs around the centre
    for (const d of f.damage) {
      _q.copy(cam.quaternion).invert()
      _v.copy(d.dir).applyQuaternion(_q)
      const ang = Math.atan2(-_v.y, _v.x)
      c.globalAlpha = d.t * 0.9
      c.strokeStyle = ENEMY
      c.lineWidth = 6
      c.beginPath()
      c.arc(cx, cy, 120 * s + 40, ang - 0.3, ang + 0.3)
      c.stroke()
    }

    // incoming missiles: red chevrons toward each
    for (const m of f.missiles) {
      const p = this.project(m, cam)
      const on = !p.behind && p.x > 0 && p.x < this.w && p.y > 0 && p.y < this.h
      if (on) {
        c.globalAlpha = 1
        c.strokeStyle = ENEMY
        c.lineWidth = 2
        c.beginPath()
        c.arc(p.x, p.y, 8, 0, Math.PI * 2)
        c.stroke()
      } else this.arrow(p.x, p.y, p.behind, ENEMY, true)
    }

    this.radar(f, s)
    c.globalAlpha = 1
  }

  private bracket(x: number, y: number, r: number) {
    const c = this.ctx
    const l = Math.max(5, r * 0.4)
    c.beginPath()
    for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      c.moveTo(x + dx * r, y + dy * (r - l))
      c.lineTo(x + dx * r, y + dy * r)
      c.lineTo(x + dx * (r - l), y + dy * r)
    }
    c.stroke()
  }

  /** Triangle at the edge of the screen pointing at something off view. */
  private arrow(x: number, y: number, behind: boolean, col: string, big: boolean) {
    const c = this.ctx
    const cx = this.w / 2
    const cy = this.h / 2
    let dx = x - cx
    let dy = y - cy
    if (behind && Math.abs(dx) < 1 && Math.abs(dy) < 1) dy = 1
    const len = Math.hypot(dx, dy) || 1
    dx /= len
    dy /= len
    const m = 46
    const k = Math.min((cx - m) / Math.max(0.001, Math.abs(dx)), (cy - m) / Math.max(0.001, Math.abs(dy)))
    const px = cx + dx * k
    const py = cy + dy * k
    const sz = big ? 13 : 9
    c.globalAlpha = big ? 1 : 0.85
    c.fillStyle = col
    c.beginPath()
    c.moveTo(px + dx * sz, py + dy * sz)
    c.lineTo(px - dy * sz * 0.7 - dx * sz * 0.4, py + dx * sz * 0.7 - dy * sz * 0.4)
    c.lineTo(px + dy * sz * 0.7 - dx * sz * 0.4, py - dx * sz * 0.7 - dy * sz * 0.4)
    c.closePath()
    c.fill()
  }

  private radar(f: HudFrame, s: number) {
    const c = this.ctx
    const p = f.player!
    const R = 74 * Math.max(0.8, s)
    const x0 = this.w / 2
    const y0 = this.h - R - 30
    c.globalAlpha = 0.5
    c.fillStyle = '#07080a'
    c.beginPath()
    c.arc(x0, y0, R, 0, Math.PI * 2)
    c.fill()
    c.globalAlpha = 0.35
    c.strokeStyle = INK
    c.lineWidth = 1.2
    c.beginPath()
    c.arc(x0, y0, R, 0, Math.PI * 2)
    c.moveTo(x0 + R * 0.5, y0)
    c.arc(x0, y0, R * 0.5, 0, Math.PI * 2)
    c.stroke()
    // view cone
    c.globalAlpha = 0.18
    c.fillStyle = INK
    c.beginPath()
    c.moveTo(x0, y0)
    c.lineTo(x0 - R * 0.62, y0 - R * 0.78)
    c.lineTo(x0 + R * 0.62, y0 - R * 0.78)
    c.closePath()
    c.fill()
    _q.copy(p.quaternion).invert()
    const plot = (pos: THREE.Vector3, col: string, size: number, alpha: number) => {
      _v.copy(pos).sub(p.position).applyQuaternion(_q)
      const k = Math.min(1, Math.hypot(_v.x, _v.z) / f.radarRange)
      const a = Math.atan2(_v.x, -_v.z)
      const rx = x0 + Math.sin(a) * k * R
      const ry = y0 - Math.cos(a) * k * R
      // altitude stalk
      const alt = Math.max(-1, Math.min(1, _v.y / f.radarRange)) * R * 0.35
      c.globalAlpha = alpha * 0.6
      c.strokeStyle = col
      c.lineWidth = 1
      c.beginPath()
      c.moveTo(rx, ry)
      c.lineTo(rx, ry - alt)
      c.stroke()
      c.globalAlpha = alpha
      c.fillStyle = col
      c.fillRect(rx - size / 2, ry - alt - size / 2, size, size)
    }
    for (const t of f.targets) {
      if (!t.alive) continue
      const sel = t === f.selected
      plot(t.position, sel ? ACCENT : t.team === 'mars' ? FRIEND : ENEMY, sel ? 6 : t.radius > 20 ? 6 : 4, t.targetable ? 1 : 0.7)
    }
    for (const m of f.missiles) plot(m, ENEMY, 3, 1)
    if (f.objectivePoint) plot(f.objectivePoint, ACCENT, 7, 1)
    c.globalAlpha = 1
    c.fillStyle = INK
    c.beginPath()
    c.moveTo(x0, y0 - 6)
    c.lineTo(x0 + 4.5, y0 + 4)
    c.lineTo(x0 - 4.5, y0 + 4)
    c.closePath()
    c.fill()
  }
}
