/** Keyboard, mouse (pointer lock) and gamepad, read by physical key code. */
export class Input {
  readonly keys = new Set<string>()
  private pressed = new Set<string>()
  mouseDX = 0
  mouseDY = 0
  fire = false
  missile = false
  private missileEdge = false
  locked = false
  /** Pointer lock was refused (embedded browsers, some kiosks): the cursor steers like a stick instead. */
  free = false
  private mx = 0
  private my = 0
  private el: HTMLElement
  private layout: Map<string, string> | null = null
  onPause: (() => void) | null = null
  gamepad: { x: number; y: number; roll: number; throttle: number; fire: boolean; missile: boolean; boost: boolean; dodge: boolean } | null = null
  private prevPad = { missile: false, dodge: false, target: false, pause: false }

  constructor(el: HTMLElement) {
    this.el = el
    window.addEventListener('keydown', this.onKey)
    window.addEventListener('keyup', this.onKeyUp)
    window.addEventListener('mousemove', this.onMove)
    window.addEventListener('mousedown', this.onDown)
    window.addEventListener('mouseup', this.onUp)
    window.addEventListener('contextmenu', this.onContext)
    window.addEventListener('blur', this.onBlur)
    document.addEventListener('pointerlockchange', this.onLockChange)
    document.addEventListener('pointerlockerror', this.onLockError)
    const kb = (navigator as Navigator & { keyboard?: { getLayoutMap(): Promise<Map<string, string>> } }).keyboard
    kb?.getLayoutMap().then((m) => (this.layout = m)).catch(() => {})
  }

  dispose() {
    window.removeEventListener('keydown', this.onKey)
    window.removeEventListener('keyup', this.onKeyUp)
    window.removeEventListener('mousemove', this.onMove)
    window.removeEventListener('mousedown', this.onDown)
    window.removeEventListener('mouseup', this.onUp)
    window.removeEventListener('contextmenu', this.onContext)
    window.removeEventListener('blur', this.onBlur)
    document.removeEventListener('pointerlockchange', this.onLockChange)
    document.removeEventListener('pointerlockerror', this.onLockError)
  }

  /** The player is steering, with or without pointer lock. */
  get active() {
    return this.locked || this.free
  }

  /** Label for a key code on the player's own keyboard layout (KeyW shows Z on AZERTY). */
  label(code: string) {
    const l = this.layout?.get(code)
    if (l) return l.toUpperCase()
    if (code.startsWith('Key')) return code.slice(3)
    if (code.startsWith('Digit')) return code.slice(5)
    return code
  }

  requestLock() {
    if (document.pointerLockElement === this.el) return
    if (!this.el.requestPointerLock) return this.onLockError()
    try {
      const p = this.el.requestPointerLock() as unknown as Promise<void> | undefined
      p?.catch?.(this.onLockError)
    } catch {
      this.onLockError()
    }
  }

  releaseLock() {
    if (document.pointerLockElement) document.exitPointerLock()
  }

  /** True once per key press. */
  hit(code: string) {
    return this.pressed.has(code)
  }

  takeMissile() {
    const m = this.missileEdge
    this.missileEdge = false
    return m
  }

  /** Call at the end of every frame. */
  endFrame() {
    this.pressed.clear()
    this.mouseDX = 0
    this.mouseDY = 0
    if (this.free && !this.locked) {
      // distance from the screen centre, with a small dead zone, read as a stick deflection
      const half = Math.min(innerWidth, innerHeight) / 2
      const stick = (v: number) => {
        const d = Math.max(-1, Math.min(1, v / half))
        return Math.abs(d) < 0.06 ? 0 : (d - Math.sign(d) * 0.06) / 0.94
      }
      this.mouseDX = stick(this.mx - innerWidth / 2) * 14
      this.mouseDY = stick(this.my - innerHeight / 2) * 14
    }
  }

  pollGamepad() {
    const pads = navigator.getGamepads?.() ?? []
    const gp = pads.find((p) => p && p.connected)
    if (!gp) {
      this.gamepad = null
      return
    }
    const dz = (v: number) => (Math.abs(v) < 0.12 ? 0 : (v - Math.sign(v) * 0.12) / 0.88)
    const b = (i: number) => !!gp.buttons[i]?.pressed
    const missile = b(5) || b(4)
    const dodge = b(0)
    const target = b(3)
    const pause = b(9)
    if (missile && !this.prevPad.missile) this.missileEdge = true
    if (dodge && !this.prevPad.dodge) this.pressed.add('Space')
    if (target && !this.prevPad.target) this.pressed.add('KeyR')
    if (pause && !this.prevPad.pause) this.onPause?.()
    this.prevPad = { missile, dodge, target, pause }
    this.gamepad = {
      x: dz(gp.axes[2] ?? 0),
      y: dz(gp.axes[3] ?? 0),
      roll: dz(gp.axes[0] ?? 0),
      throttle: -dz(gp.axes[1] ?? 0),
      fire: (gp.buttons[7]?.value ?? 0) > 0.3,
      missile,
      boost: (gp.buttons[6]?.value ?? 0) > 0.3 || b(10),
      dodge,
    }
  }

  private onKey = (e: KeyboardEvent) => {
    if (e.code === 'Tab') e.preventDefault()
    if (e.code === 'Escape' || e.code === 'KeyP') {
      if (!e.repeat) this.onPause?.()
      return
    }
    if (!e.repeat) this.pressed.add(e.code)
    this.keys.add(e.code)
    if (e.code === 'KeyF' && !e.repeat) this.missileEdge = true
  }
  private onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.code)
  }
  private onMove = (e: MouseEvent) => {
    this.mx = e.clientX
    this.my = e.clientY
    if (!this.locked) return
    this.mouseDX += e.movementX
    this.mouseDY += e.movementY
  }
  private onDown = (e: MouseEvent) => {
    if (!this.locked && !(this.free && !(e.target as Element | null)?.closest?.('button, a, input'))) return
    if (e.button === 0) this.fire = true
    if (e.button === 2) {
      this.missile = true
      this.missileEdge = true
    }
  }
  private onUp = (e: MouseEvent) => {
    if (e.button === 0) this.fire = false
    if (e.button === 2) this.missile = false
  }
  private onContext = (e: Event) => {
    if (this.active) e.preventDefault()
  }
  private onBlur = () => {
    this.keys.clear()
    this.fire = false
    this.missile = false
  }
  private onLockError = () => {
    this.free = true
    this.mx = innerWidth / 2
    this.my = innerHeight / 2
  }
  private onLockChange = () => {
    const was = this.locked
    this.locked = document.pointerLockElement === this.el
    if (!this.locked) {
      this.fire = false
      this.missile = false
      // Esc releases pointer lock before the keydown reaches us, so treat losing it as pause
      if (was) this.onPause?.()
    }
  }
}
