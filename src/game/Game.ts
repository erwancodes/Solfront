import * as THREE from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { flyShip, updateShipAI, updateTurret, type AIWorld } from './ai'
import { audio } from './audio'
import { Missile, STATS, Ship, Structure, clock, makeMissileMesh } from './entities'
import { Effects } from './fx/explosions'
import { LaserPool } from './fx/lasers'
import { TrailSystem } from './fx/trails'
import { HudCanvas, type HudFrame } from './hud'
import { Input } from './input'
import { clamp, damp, leadPoint, quatLookDir, rand, randomUnit, segPointDistSq } from './math'
import { buildMission, type Mission } from './missions'
import type { ShipKind } from './models/ships'
import type { Difficulty, Target, TargetKind, Team } from './types'
import type { Planet } from './world/planet'
import { createDust, type Obstacle } from './world/scenery'
import { createSky, type Sky } from './world/sky'
import { setLang, type I18nKey } from '../i18n'
import { useGame, write, type Comm, type Kill, type Line, type PerkId, type SectorId, type Settings } from '../store'

type Mode = 'idle' | 'menu' | 'briefing' | 'play' | 'dead' | 'warp' | 'over'
type EnemyKind = 'hornet' | 'lance' | 'atlas'

const SECTORS: SectorId[] = ['ares', 'selene', 'gaia']
const PERKS: PerkId[] = ['overclock', 'cryo', 'hardened', 'aegis', 'swarm', 'afterburner', 'vampire', 'piercer', 'wingmen', 'reflex']

const POINTS: Partial<Record<TargetKind, number>> = { fighter: 100, interceptor: 150, bomber: 250, pylon: 300, turret: 400, generator: 600, core: 1500, reactor: 2000 }
const DIFF = {
  recruit: { score: 0.75, skill: 0.35, damage: 0.55 },
  pilot: { score: 1, skill: 0.65, damage: 1 },
  ace: { score: 1.5, skill: 0.95, damage: 1.35 },
} satisfies Record<Difficulty, { score: number; skill: number; damage: number }>

const POST = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uHit: { value: 0 },
    uDamage: { value: 0 },
    uWarp: { value: 0 },
    uAspect: { value: 1 },
  },
  vertexShader: /* glsl */ `
varying vec2 vUv;
void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
uniform sampler2D tDiffuse;
uniform float uTime, uHit, uDamage, uWarp, uAspect;
varying vec2 vUv;
float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main(){
  vec2 c = vUv - 0.5;
  float r = length(c * vec2(uAspect, 1.0));
  vec3 col;
  if (uWarp > 0.001) {
    // radial streak blur toward the centre
    col = vec3(0.0);
    for (int i = 0; i < 10; i++) {
      float k = 1.0 - float(i) * 0.018 * uWarp * r * 4.0;
      col += texture2D(tDiffuse, 0.5 + c * k).rgb;
    }
    col /= 10.0;
  } else {
    float ca = (0.0012 + uHit * 0.009) * r;
    col.r = texture2D(tDiffuse, vUv + c * ca).r;
    col.g = texture2D(tDiffuse, vUv).g;
    col.b = texture2D(tDiffuse, vUv - c * ca).b;
  }
  float vig = smoothstep(0.95, 0.25, r);
  col *= mix(0.55, 1.0, vig);
  // damage: rust creeping in from the edges
  col = mix(col, col * vec3(1.6, 0.55, 0.4) + vec3(0.06, 0.0, 0.0), uDamage * smoothstep(0.25, 0.9, r));
  col += (hash(vUv * 900.0 + uTime) - 0.5) * 0.025;
  gl_FragColor = vec4(col, 1.0);
}`,
}

const _a = new THREE.Vector3()
const _b = new THREE.Vector3()
const _c = new THREE.Vector3()
const _d = new THREE.Vector3()
const _fwd = new THREE.Vector3()
const _up = new THREE.Vector3()
const _right = new THREE.Vector3()
const _q = new THREE.Quaternion()
const _q2 = new THREE.Quaternion()
const _id = new THREE.Quaternion()

interface TimedComm extends Comm {
  t: number
}
interface TimedKill extends Kill {
  t: number
}

export class Game implements AIWorld {
  readonly renderer: THREE.WebGLRenderer
  readonly scene = new THREE.Scene()
  readonly camera: THREE.PerspectiveCamera
  private composer: EffectComposer
  private bloom: UnrealBloomPass
  private post: ShaderPass
  private sky: Sky
  private sun: THREE.DirectionalLight
  readonly fx = new Effects()
  private lasers = new LaserPool(800)
  private trails = new TrailSystem(128)
  private dust = createDust(900, 420)
  readonly missionGroup = new THREE.Group()
  private actors = new THREE.Group()
  private input: Input
  private hud: HudCanvas
  private container: HTMLElement

  // world, read by the AI and the missions
  ships: Ship[] = []
  structures: Structure[] = []
  obstacles: Obstacle[] = []
  planets: Planet[] = []
  updaters: ((dt: number) => void)[] = []
  missiles: Missile[] = []
  arenaCenter = new THREE.Vector3()
  arenaRadius = 2600
  bomberTarget: Target | null = null
  skill = 0.65
  player: Ship | null = null
  mission: Mission | null = null
  time = 0

  private mode: Mode = 'idle'
  private paused = false
  private timeScale = 1
  private slowT = 0
  private shakeAmt = 0
  private loadToken = 0
  private last = performance.now()

  // campaign
  private difficulty: Difficulty = 'pilot'
  private sector: SectorId = 'ares'
  private perks: PerkId[] = []
  perkMode: 'next' | 'resume' = 'next'
  private score = 0
  private sectorScore = 0
  private combo = 1
  private lastKill = -10
  private enemyDamage = 1
  private stats = { kills: 0, shots: 0, hits: 0, time: 0 }
  private settings: Settings

  // player state
  private aimDir = new THREE.Vector3(0, 0, -1)
  private throttle = 0.7
  private fuel = 100
  private boostLock = false
  private boosting = false
  private heat = 0
  private overheated = false
  private ammo = 6
  private maxAmmo = 6
  private dodgeCd = 0
  private dodgeT = 0
  private dodgeSign = 1
  private selected: Target | null = null
  private lock = 0
  private lockedSound = false
  private hitMarker = 0
  private killFlash = 0
  private damageDirs: { dir: THREE.Vector3; t: number }[] = []
  private hitPulse = 0
  private deadT = 0
  private warpT = 0
  private unlockedT = 0
  private vega: Ship | null = null
  private vegaHurt = false

  // camera
  private camUp = new THREE.Vector3(0, 1, 0)
  private camOffset = new THREE.Vector3(0, 7, 24)
  private orbitA = 0
  private fov = 70

  // hud
  private comms: TimedComm[] = []
  private kills: TimedKill[] = []
  private nextMsg = 1
  private syncT = 0
  private targets: Target[] = []
  private enemyMissilePts: THREE.Vector3[] = []
  private frame: HudFrame

  constructor(container: HTMLElement, hudCanvas: HTMLCanvasElement) {
    this.container = container
    this.settings = useGame.getState().settings
    const r = new THREE.WebGLRenderer({ antialias: false, logarithmicDepthBuffer: true, powerPreference: 'high-performance' })
    r.toneMapping = THREE.ACESFilmicToneMapping
    r.toneMappingExposure = 1
    r.outputColorSpace = THREE.SRGBColorSpace
    r.setPixelRatio(this.pixelRatio())
    container.appendChild(r.domElement)
    r.domElement.className = 'game-canvas'
    this.renderer = r

    this.camera = new THREE.PerspectiveCamera(70, 1, 0.5, 400000)
    this.camera.position.set(0, 60, 600)

    const pmrem = new THREE.PMREMGenerator(r)
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
    this.scene.environmentIntensity = 0.25
    pmrem.dispose()

    this.sky = createSky()
    this.sun = new THREE.DirectionalLight(0xfff1e0, 3.2)
    this.scene.add(this.sky.group, this.sun, this.sun.target, new THREE.HemisphereLight(0x8090a8, 0x201510, 0.18))
    this.scene.add(this.missionGroup, this.actors, this.fx.group, this.lasers.mesh, this.trails.mesh, this.dust.object)

    this.composer = new EffectComposer(r, new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 }))
    this.composer.addPass(new RenderPass(this.scene, this.camera))
    this.bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.75, 0.55, 0.9)
    this.composer.addPass(this.bloom)
    this.post = new ShaderPass(POST)
    this.composer.addPass(this.post)
    this.composer.addPass(new OutputPass())

    this.input = new Input(r.domElement)
    this.input.onPause = () => {
      if (useGame.getState().screen === 'playing') this.pause()
    }
    this.hud = new HudCanvas(hudCanvas)
    this.frame = {
      camera: this.camera,
      player: null,
      aimPoint: new THREE.Vector3(),
      nosePoint: new THREE.Vector3(),
      targets: this.targets,
      selected: null,
      lead: null,
      lock: 0,
      hitMarker: 0,
      kill: 0,
      damage: this.damageDirs,
      missiles: this.enemyMissilePts,
      radarRange: 2200,
      lang: this.settings.lang,
      objectivePoint: null,
    }

    window.addEventListener('resize', this.resize)
    this.resize()
    this.applySettings(this.settings)
    r.setAnimationLoop(this.loop)
  }

  dispose() {
    this.renderer.setAnimationLoop(null)
    window.removeEventListener('resize', this.resize)
    this.input.dispose()
    this.renderer.dispose()
    this.renderer.domElement.remove()
  }

  private pixelRatio() {
    return this.settings.quality === 'low' ? 1 : Math.min(window.devicePixelRatio || 1, 1.75)
  }

  private resize = () => {
    const w = this.container.clientWidth || window.innerWidth
    const h = this.container.clientHeight || window.innerHeight
    this.renderer.setPixelRatio(this.pixelRatio())
    this.renderer.setSize(w, h)
    this.composer.setPixelRatio(this.pixelRatio())
    this.composer.setSize(w, h)
    this.bloom.resolution.set(w / 2, h / 2)
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    this.post.uniforms.uAspect.value = w / h
    this.hud.resize(w, h)
    this.fx.setViewport(h * this.renderer.getPixelRatio(), this.camera.fov)
  }

  /* ---------------------------------------------------------------- */
  /* Flow, called by the UI                                            */
  /* ---------------------------------------------------------------- */

  async boot() {
    useGame.getState().set({ screen: 'loading' })
    await this.sky.ready
    await this.loadMenu()
  }

  async loadMenu() {
    const token = ++this.loadToken
    this.clearWorld()
    this.skill = 0.6
    this.enemyDamage = 1
    const m = await buildMission('ares', this, true)
    if (token !== this.loadToken) return
    this.mission = m
    this.sky.setSun(m.sun)
    this.sun.position.copy(m.sun).multiplyScalar(1000)
    m.start()
    this.mode = 'menu'
    this.paused = false
    this.input.releaseLock()
    useGame.getState().set({ screen: 'menu', overlay: null, needsClick: false, saved: this.readSave() })
  }

  private readSave() {
    return useGame.getState().saved
  }

  startCampaign(difficulty: Difficulty, sector: SectorId = 'ares') {
    audio.unlock()
    this.difficulty = difficulty
    const d = DIFF[difficulty]
    this.skill = d.skill
    this.enemyDamage = d.damage
    this.score = 0
    this.perks = []
    this.stats = { kills: 0, shots: 0, hits: 0, time: 0 }
    useGame.getState().set({ difficulty, perks: [] })
    void this.loadSector(sector)
  }

  private async loadSector(id: SectorId) {
    const token = ++this.loadToken
    const st = useGame.getState()
    if (st.screen !== 'warp') st.set({ screen: 'loading' })
    this.clearWorld()
    this.sector = id
    const m = await buildMission(id, this)
    if (token !== this.loadToken) return
    this.mission = m
    this.sky.setSun(m.sun)
    this.sun.position.copy(m.sun).multiplyScalar(1000)
    this.sectorScore = this.score
    this.spawnPlayer(m.playerStart.pos, m.playerStart.dir)
    this.mode = 'briefing'
    this.paused = false
    this.timeScale = 1
    this.orbitA = 0
    const save = { sector: id, difficulty: this.difficulty }
    write('progress', save)
    useGame.getState().set({ screen: 'briefing', sector: id, progress: SECTORS.indexOf(id), saved: save, comms: [], kills: [] })
  }

  continueFromBriefing() {
    if (this.mode !== 'briefing' || !this.mission) return
    audio.unlock()
    this.input.requestLock()
    this.mode = 'play'
    this.unlockedT = 0
    this.mission.start()
    useGame.getState().set({ screen: 'playing' })
  }

  requestLock() {
    this.input.requestLock()
  }

  /** UI click sound; also unlocks audio on the first gesture. */
  click() {
    audio.unlock()
    audio.click()
  }

  sectorComplete() {
    if (this.mode !== 'play') return
    this.offerPerks('next')
  }

  offerPerks(mode: 'next' | 'resume') {
    const pool = PERKS.filter((p) => !this.perks.includes(p))
    const offered: PerkId[] = []
    while (offered.length < 3 && pool.length) offered.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0])
    if (!offered.length) {
      if (mode === 'next') this.warpNext()
      return
    }
    this.perkMode = mode
    this.paused = true
    this.input.releaseLock()
    useGame.getState().set({ screen: 'perk', offered })
  }

  choosePerk(id: PerkId) {
    audio.perk()
    this.perks.push(id)
    if (this.player) this.applyPerk(this.player, id)
    useGame.getState().set({ perks: [...this.perks], offered: [] })
    this.paused = false
    if (this.perkMode === 'next') this.warpNext()
    else {
      this.input.requestLock()
      this.unlockedT = 0
      useGame.getState().set({ screen: 'playing' })
    }
  }

  private warpNext() {
    const next = SECTORS[SECTORS.indexOf(this.sector) + 1]
    if (!next) return this.victory()
    this.mode = 'warp'
    this.warpT = 0
    this.input.releaseLock()
    audio.warp()
    useGame.getState().set({ screen: 'warp', sector: next })
    this.pendingSector = next
  }
  private pendingSector: SectorId = 'ares'

  victory() {
    this.mode = 'over'
    this.input.releaseLock()
    write('progress', null)
    useGame.getState().set({ screen: 'victory', stats: this.finalStats('player'), saved: null })
  }

  fail(reason: 'player' | 'station') {
    if (this.mode === 'over') return
    this.mode = 'over'
    this.input.releaseLock()
    useGame.getState().set({ screen: 'gameover', stats: this.finalStats(reason) })
  }

  private finalStats(reason: 'player' | 'station') {
    const st = useGame.getState()
    const best = Math.max(st.best, this.score)
    const newBest = this.score > st.best && this.score > 0
    if (newBest) write('best', { v: this.score })
    st.set({ best })
    return { score: Math.round(this.score), kills: this.stats.kills, shots: this.stats.shots, hits: this.stats.hits, time: this.stats.time, best, newBest, reason }
  }

  restartSector() {
    this.score = this.sectorScore
    this.paused = false
    audio.suspend(false)
    void this.loadSector(this.sector)
  }

  quitToMenu() {
    this.paused = false
    audio.suspend(false)
    void this.loadMenu()
  }

  pause() {
    if (this.mode !== 'play' || this.paused) return
    this.paused = true
    audio.suspend(true)
    this.input.releaseLock()
    useGame.getState().set({ screen: 'pause' })
  }

  resume() {
    if (!this.paused) return
    this.paused = false
    audio.suspend(false)
    this.input.requestLock()
    this.unlockedT = 0
    useGame.getState().set({ screen: 'playing' })
  }

  applySettings(s: Settings) {
    this.settings = s
    setLang(s.lang)
    audio.setVolume(s.volume, s.music)
    this.frame.lang = s.lang
    this.resize()
  }

  /* ---------------------------------------------------------------- */
  /* World management, called by missions                              */
  /* ---------------------------------------------------------------- */

  private clearWorld() {
    for (const s of this.ships) this.removeShip(s)
    for (const m of this.missiles) this.actors.remove(m.mesh)
    this.ships = []
    this.structures = []
    this.obstacles = []
    this.planets = []
    this.updaters = []
    this.missiles = []
    this.missionGroup.traverse((o) => {
      if ((o as THREE.Mesh).isMesh || (o as THREE.Points).isPoints) (o as THREE.Mesh).geometry?.dispose()
    })
    this.missionGroup.clear()
    this.actors.clear()
    this.lasers.clear()
    this.fx.clear()
    this.trails.clear()
    this.bomberTarget = null
    this.player = null
    this.vega = null
    this.vegaHurt = false
    this.selected = null
    this.mission = null
    this.arenaCenter.set(0, 0, 0)
    this.comms = []
    this.kills = []
    this.damageDirs.length = 0
    this.lock = 0
    this.combo = 1
    this.timeScale = 1
    this.slowT = 0
  }

  addStructure(s: Structure) {
    this.structures.push(s)
    if (s.radius >= 100) this.obstacles.push(...s.spheres)
  }

  removeStructure(s: Structure) {
    s.alive = false
    this.structures = this.structures.filter((x) => x !== s)
    this.obstacles = this.obstacles.filter((o) => !s.spheres.includes(o))
    if (this.bomberTarget === s) this.bomberTarget = null
  }

  spawnShip(kind: ShipKind, team: Team, pos: THREE.Vector3, dir: THREE.Vector3, role: 'fighter' | 'bomber' | 'escort', name?: I18nKey) {
    const tk: TargetKind = team === 'mars' ? 'wingman' : kind === 'atlas' ? 'bomber' : kind === 'lance' ? 'interceptor' : 'fighter'
    const s = new Ship(kind, team, tk, name ?? (team === 'mars' ? 'who.vega' : `n.${kind}`))
    s.position.copy(pos)
    quatLookDir(s.quaternion, dir)
    s.speed = s.stats.maxSpeed * 0.7
    s.velocity.copy(dir).multiplyScalar(s.speed)
    s.ai = { mode: 'attack', timer: 0, target: null, retarget: 0, jink: new THREE.Vector3(), missileTimer: rand(4, 9), skill: team === 'mars' ? 0.9 : rand(0.7, 1), role }
    this.attachTrails(s)
    this.actors.add(s.root)
    this.ships.push(s)
    return s
  }

  spawnEnemy(kind: EnemyKind, pos: THREE.Vector3, dir: THREE.Vector3, warp = true) {
    const s = this.spawnShip(kind, 'terra', pos, dir, kind === 'atlas' ? 'bomber' : 'fighter')
    if (warp) this.fx.warpFlash(pos, 14, this.camera)
    return s
  }

  private attachTrails(s: Ship) {
    s.trails = s.model.engines.map((e) => this.trails.create(s.model.engineColor, Math.max(0.8, s.radius * 0.16), s.local(_a, e)))
  }

  private spawnPlayer(pos: THREE.Vector3, dir: THREE.Vector3) {
    const p = new Ship('vanguard', 'mars', 'player', 'n.you')
    p.stats = { ...STATS.vanguard }
    p.position.copy(pos)
    quatLookDir(p.quaternion, dir)
    p.speed = 0
    this.player = p
    this.aimDir.copy(dir).normalize()
    this.throttle = 0.7
    this.fuel = 100
    this.heat = 0
    this.overheated = false
    this.maxAmmo = 6
    this.dodgeCd = 0
    this.dodgeT = 0
    this.deadT = 0
    for (const id of this.perks) this.applyPerk(p, id)
    this.ammo = this.maxAmmo
    this.attachTrails(p)
    this.actors.add(p.root)
    this.ships.push(p)
    this.camOffset.set(0, 7, 24).applyQuaternion(p.quaternion)
    this.camUp.set(0, 1, 0)

    // allies: Vega always, Orion with the wingmen perk
    p.right(_a)
    const vega = this.spawnShip('wingman', 'mars', _b.copy(pos).addScaledVector(_a, -40).add(_c.set(0, 6, 20)), dir, 'escort', 'who.vega')
    vega.armor = this.perks.includes('wingmen') ? 0.25 : 0.5
    vega.speed = 0
    vega.velocity.set(0, 0, 0)
    this.vega = vega
    if (this.perks.includes('wingmen')) this.spawnOrion()
  }

  private spawnOrion() {
    const p = this.player
    if (!p) return
    p.right(_a)
    p.forward(_fwd)
    const o = this.spawnShip('wingman', 'mars', _b.copy(p.position).addScaledVector(_a, 40).add(_c.set(0, 6, 20)), _fwd, 'escort', 'who.orion')
    o.armor = 0.25
    if (this.vega) this.vega.armor = 0.25
    return o
  }

  private applyPerk(p: Ship, id: PerkId) {
    const st = p.stats
    switch (id) {
      case 'overclock':
        st.fireRate /= 1.3
        break
      case 'hardened':
        p.maxHp += 40
        p.hp = p.maxHp
        break
      case 'aegis':
        p.maxShield = Math.round(p.maxShield * 1.5)
        p.shield = p.maxShield
        break
      case 'swarm':
        this.maxAmmo += 4
        this.ammo += 4
        break
      case 'afterburner':
        st.maxSpeed *= 1.15
        st.boostSpeed *= 1.15
        break
      case 'piercer':
        st.damage *= 1.35
        break
      case 'wingmen':
        if (this.mode === 'play') {
          this.spawnOrion()
          this.comm('who.orion', 'c.orion.join')
        }
        break
    }
  }

  private has(id: PerkId) {
    return this.perks.includes(id)
  }

  comm(who: I18nKey, text: I18nKey) {
    this.comms.push({ id: this.nextMsg++, who, text, t: this.time })
    if (this.comms.length > 3) this.comms.shift()
  }

  shake(n: number) {
    this.shakeAmt = Math.max(this.shakeAmt, n)
  }

  slowmo(dur: number, scale: number) {
    this.slowT = dur
    this.timeScale = scale
  }

  audioWarp() {
    audio.warp()
  }

  /* ---------------------------------------------------------------- */
  /* Weapons, called by the AI                                         */
  /* ---------------------------------------------------------------- */

  fire(ship: Ship, aimAt: THREE.Vector3) {
    const m = ship.model.muzzles
    const muzzle = m[ship.muzzleIdx++ % m.length]
    ship.local(_a, muzzle)
    _b.copy(aimAt).sub(_a).normalize()
    // never shoot backwards out of a muzzle
    ship.forward(_fwd)
    if (_b.dot(_fwd) < 0.9) _b.copy(_fwd)
    _c.copy(_b).multiplyScalar(ship.stats.boltSpeed).add(ship.velocity)
    const dmg = ship.stats.damage * (ship.team === 'terra' ? this.enemyDamage : 1)
    this.lasers.fire(ship.team, _a, _c, dmg, ship.id, 1.5)
    this.fx.muzzle(_a, ship.velocity, ship.team === 'terra')
    const sp = this.spatial(_a)
    if (sp.vol > 0.02) audio.laser(ship.team === 'terra', sp.vol * 0.45, sp.pan)
  }

  launchMissile(ship: Ship, target: Target) {
    ship.forward(_fwd)
    this.makeMissile(ship.team, ship.id, target, ship.position, _fwd, ship.velocity, { speed: 200, maxSpeed: 420, turn: 1.8, damage: 22 * this.enemyDamage })
  }

  fireTurret(s: Structure, from: THREE.Vector3, dir: THREE.Vector3) {
    const g = s.gun!
    _c.copy(dir).multiplyScalar(g.speed).add(s.velocity)
    this.lasers.fire(s.team, from, _c, g.damage * (s.team === 'terra' ? this.enemyDamage : 1), s.id, g.range / g.speed + 0.2)
    this.fx.muzzle(from, s.velocity, s.team === 'terra')
    const sp = this.spatial(from)
    if (sp.vol > 0.02) audio.laser(s.team === 'terra', sp.vol * 0.4, sp.pan)
  }

  private makeMissile(team: Team, owner: number, target: Target | null, pos: THREE.Vector3, dir: THREE.Vector3, vel: THREE.Vector3, o: { speed: number; maxSpeed: number; turn: number; damage: number }) {
    const mesh = makeMissileMesh(team)
    const m = new Missile(team, owner, target, mesh, o)
    m.pos.copy(pos).addScaledVector(dir, 6)
    m.vel.copy(dir).multiplyScalar(o.speed).add(vel)
    mesh.position.copy(m.pos)
    m.trail = this.trails.create(team === 'mars' ? new THREE.Color(1, 0.7, 0.4) : new THREE.Color(0.5, 0.8, 1), 0.9, m.pos)
    this.actors.add(mesh)
    this.missiles.push(m)
    if (team === 'terra' && target === this.player) audio.alarm()
    else audio.missile()
    return m
  }

  /** Volume and pan for a sound at a world point. */
  private spatial(p: THREE.Vector3) {
    _d.copy(p).sub(this.camera.position)
    const dist = _d.length()
    const vol = clamp(1 - dist / 1600, 0, 1) ** 2
    _d.applyQuaternion(_q2.copy(this.camera.quaternion).invert())
    return { vol, pan: clamp(_d.x / Math.max(1, dist), -1, 1) }
  }

  /* ---------------------------------------------------------------- */
  /* Damage and death                                                  */
  /* ---------------------------------------------------------------- */

  private hitShip(s: Ship, amount: number, point: THREE.Vector3, from: THREE.Vector3, team: Team, owner: number) {
    const hadShield = s.shield > 0
    s.damage(amount, point, team, owner)
    if (s === this.player && !s.invulnerable) {
      this.damageDirs.push({ dir: from.clone().negate().normalize(), t: 1 })
      if (this.damageDirs.length > 8) this.damageDirs.shift()
      this.hitPulse = 1
      this.shake(0.18)
      if (hadShield) audio.shield()
      else audio.hurt()
    }
    if (owner === this.player?.id && s.team !== 'mars') {
      this.hitMarker = 1
      this.stats.hits++
      audio.hit()
    }
    if (s === this.vega && !this.vegaHurt && s.hp < s.maxHp * 0.45) {
      this.vegaHurt = true
      this.comm('who.vega', 'c.vega.hurt')
    }
    if (s.hp <= 0) this.destroyShip(s, owner)
  }

  destroyShip(s: Ship, killer = -1) {
    if (!s.alive) return
    s.alive = false
    s.hp = 0
    this.fx.explode(s.position, s.radius * 1.3, this.camera, s.velocity, s.team === 'terra')
    const sp = this.spatial(s.position)
    audio.explosion(s.radius / 8, Math.max(0.15, sp.vol), sp.pan)
    this.removeShip(s)
    if (s === this.player) {
      this.mode = 'dead'
      this.deadT = 0
      this.shake(1.2)
      this.input.releaseLock()
      return
    }
    if (s === this.vega) this.comm('who.vega', 'c.vega.down')
    if (s.team === 'terra') this.credit(s, killer)
    if (this.selected === s) this.selected = null
  }

  private removeShip(s: Ship) {
    this.actors.remove(s.root)
    for (const t of s.trails) this.trails.release(t)
    s.trails = []
  }

  private credit(t: Target, killer: number) {
    const mine = killer === this.player?.id
    if (mine) {
      this.combo = this.time - this.lastKill < 4 ? Math.min(8, this.combo + 1) : 1
      this.lastKill = this.time
      this.score += (POINTS[t.kind] ?? 100) * this.combo * DIFF[this.difficulty].score
      this.stats.kills++
      this.killFlash = 1
      this.hitMarker = 1
      if (this.has('vampire') && this.player) this.player.hp = Math.min(this.player.maxHp, this.player.hp + 8)
      if (this.combo === 4 && this.vega?.alive) this.comm('who.vega', 'c.vega.nice')
      this.kills.push({ id: this.nextMsg++, line: { key: 'kill', params: { name: t.name } }, mine: true, t: this.time })
    } else {
      const by = this.ships.find((x) => x.id === killer) ?? (killer === this.vega?.id ? this.vega : null)
      if (by && (by.name === 'who.vega' || by.name === 'who.orion') && by.ai?.role === 'escort') {
        this.kills.push({ id: this.nextMsg++, line: { key: 'kill.by', params: { who: by.name, name: t.name } }, mine: false, t: this.time })
      }
    }
    if (this.kills.length > 5) this.kills.shift()
    this.mission?.onKill?.(t)
  }

  private killStructure(s: Structure) {
    s.alive = false
    s.hp = 0
    if (s.kind !== 'station') {
      this.fx.explode(s.position, s.radius * 1.4, this.camera, undefined, s.team === 'terra')
      s.root.visible = false
    }
    const sp = this.spatial(s.position)
    audio.explosion(s.radius / 6, Math.max(0.3, sp.vol), sp.pan)
    this.shake(0.35)
    if (this.selected === s) this.selected = null
    if (s.team === 'terra') this.credit(s, this.player?.id ?? -1)
    s.onDeath?.()
  }

  /* ---------------------------------------------------------------- */
  /* Frame                                                             */
  /* ---------------------------------------------------------------- */

  private loop = () => {
    const now = performance.now()
    const dt = Math.min(0.05, (now - this.last) / 1000)
    this.last = now
    this.input.pollGamepad()
    if (!this.paused) {
      if (this.slowT > 0) {
        this.slowT -= dt
        if (this.slowT <= 0) this.timeScale = 1
        else if (this.slowT < 0.6) this.timeScale = damp(this.timeScale, 1, 6, dt)
      }
      this.step(dt * this.timeScale)
    }
    this.updateCamera(dt)
    this.render(dt)
    this.input.endFrame()
  }

  private step(dt: number) {
    if (this.mode === 'idle') return
    this.time += dt
    clock.t = this.time
    if (this.mode === 'play') this.stats.time += dt

    if (this.player?.alive) {
      if (this.mode === 'play') this.updatePlayer(dt)
      else this.cruisePlayer(dt)
    }
    if (this.mode !== 'briefing') {
      this.mission?.update(dt)
      for (const s of this.ships) if (s.ai && s.alive) updateShipAI(s, this, dt)
    }
    for (const u of this.updaters) u(dt)
    for (const s of this.structures) {
      if (!s.alive) continue
      s.sync()
      if (s.gun && this.mode !== 'briefing') updateTurret(s, this, dt)
      if (s.hp <= 0) this.killStructure(s)
    }
    this.collide()
    this.lasers.update(dt)
    this.bolts()
    this.updateMissiles(dt)
    this.updateEngines(dt)
    for (const p of this.planets) p.update(dt, this.sky.sunDir)
    this.fx.update(dt)
    this.ships = this.ships.filter((s) => s.alive)
    this.missiles = this.missiles.filter((m) => m.alive)

    if (this.mode === 'dead') {
      this.deadT += dt
      if (this.deadT > 2.6) this.fail('player')
    }
    if (this.mode === 'warp') {
      this.warpT += dt
      if (this.warpT > 2.2) {
        this.mode = 'idle'
        void this.loadSector(this.pendingSector)
      }
    }
    this.hitMarker = Math.max(0, this.hitMarker - dt * 3)
    this.killFlash = Math.max(0, this.killFlash - dt * 2)
    this.hitPulse = Math.max(0, this.hitPulse - dt * 2.5)
    for (const d of this.damageDirs) d.t -= dt * 0.7
    while (this.damageDirs.length && this.damageDirs[0].t <= 0) this.damageDirs.shift()
  }

  /** Briefing, warp and game over: the player flies itself. */
  private cruisePlayer(dt: number) {
    const p = this.player!
    if (this.mode === 'briefing') {
      p.speed = 0
      p.velocity.set(0, 0, 0)
      p.bank.rotation.z = Math.sin(this.time * 0.7) * 0.05
      p.model.group.position.y = Math.sin(this.time * 1.1) * 0.3
      return
    }
    p.forward(_fwd)
    flyShip(p, _fwd, dt, 1, this.mode === 'warp')
    if (this.mode === 'warp') p.position.addScaledVector(_fwd, dt * this.warpT * this.warpT * 900)
  }

  private updatePlayer(dt: number) {
    const p = this.player!
    const inp = this.input
    const k = inp.keys
    const pad = inp.gamepad
    p.forward(_fwd)
    p.up(_up)
    p.right(_right)

    // aim: the mouse moves a direction, the ship chases it
    const sens = this.settings.sensitivity * 0.0022
    const inv = this.settings.invert ? -1 : 1
    let yaw = -inp.mouseDX * sens
    let pitch = -inp.mouseDY * sens * inv
    if (pad) {
      yaw -= pad.x * 2.2 * dt
      pitch -= pad.y * 2.2 * dt * inv
    }
    this.aimDir.applyAxisAngle(_up, yaw).applyAxisAngle(_right, pitch).normalize()
    const maxA = (50 * Math.PI) / 180
    const ang = this.aimDir.angleTo(_fwd)
    if (ang > maxA) {
      _q.setFromUnitVectors(_fwd, this.aimDir)
      _q2.copy(_id).slerp(_q, maxA / ang)
      this.aimDir.copy(_fwd).applyQuaternion(_q2)
    }

    // throttle and boost
    if (k.has('KeyW')) this.throttle = Math.min(1, this.throttle + dt * 0.9)
    if (k.has('KeyS')) this.throttle = Math.max(0, this.throttle - dt * 0.9)
    if (pad && Math.abs(pad.throttle) > 0.05) this.throttle = clamp(this.throttle - pad.throttle * dt, 0, 1)
    const wantBoost = k.has('ShiftLeft') || k.has('ShiftRight') || !!pad?.boost
    if (this.fuel <= 0) this.boostLock = true
    if (this.boostLock && this.fuel > 25) this.boostLock = false
    this.boosting = wantBoost && !this.boostLock && this.fuel > 0
    if (this.boosting) this.fuel = Math.max(0, this.fuel - 30 * dt * (this.has('afterburner') ? 0.6 : 1))
    else this.fuel = Math.min(100, this.fuel + 18 * dt)

    flyShip(p, this.aimDir, dt, this.throttle, this.boosting)

    // roll around the nose, carrying the aim with it
    let roll = (k.has('KeyQ') || k.has('KeyA') ? 1 : 0) - (k.has('KeyE') || k.has('KeyD') ? 1 : 0)
    if (pad) roll -= pad.roll
    if (roll) {
      p.forward(_fwd)
      _q.setFromAxisAngle(_fwd, roll * 2 * dt)
      p.quaternion.premultiply(_q)
      this.aimDir.applyQuaternion(_q)
    }

    // dodge: sideways impulse, a barrel roll and a moment of invulnerability
    this.dodgeCd -= dt
    if (inp.hit('Space') && this.dodgeCd <= 0) {
      this.dodgeCd = this.has('reflex') ? 1.25 : 2.5
      this.dodgeT = 0.6
      this.dodgeSign = roll > 0 ? -1 : roll < 0 ? 1 : Math.random() < 0.5 ? -1 : 1
      p.right(_right)
      p.velocity.addScaledVector(_right, 120 * this.dodgeSign)
      p.invulnerable = true
      if (this.has('reflex')) p.shield = Math.min(p.maxShield, p.shield + 25)
      for (const m of this.missiles) {
        if (m.team === 'terra' && m.target === p && m.pos.distanceTo(p.position) < 400) {
          m.decoyed = true
          m.target = null
        }
      }
      audio.click()
    }
    if (this.dodgeT > 0) {
      this.dodgeT -= dt
      p.bank.rotation.z += (1 - this.dodgeT / 0.6) * Math.PI * 2 * -this.dodgeSign
      if (this.dodgeT <= 0) p.invulnerable = false
    }

    // shields come back after a quiet moment
    if (this.time - p.lastHit > (this.has('aegis') ? 1.5 : 3)) p.shield = Math.min(p.maxShield, p.shield + 15 * dt)

    // arena edge
    const out = p.position.distanceTo(this.arenaCenter) / this.arenaRadius
    if (out > 1.4) p.hp -= 10 * dt
    if (p.hp <= 0) return this.destroyShip(p)

    this.updateTargeting(dt)
    this.updateGuns(dt)

    if (inp.takeMissile() && this.ammo > 0) {
      this.ammo--
      const target = this.lock >= 1 ? this.selected : null
      p.forward(_fwd)
      this.makeMissile('mars', p.id, target, p.position, _fwd, p.velocity, { speed: 260, maxSpeed: 620, turn: 3.2, damage: 80 })
      this.lock = 0
      this.lockedSound = false
    }

    if (inp.active) this.unlockedT = 0
    else this.unlockedT += 1 / 60
  }

  private isEnemy(t: Target) {
    return t.alive && t.targetable && t.team === 'terra'
  }

  private updateTargeting(dt: number) {
    const p = this.player!
    if (this.selected && !this.isEnemy(this.selected)) this.selected = null
    const angleTo = (t: Target) => _a.copy(t.position).sub(p.position).normalize().angleTo(this.aimDir)
    const enemies = this.targets.filter((t) => this.isEnemy(t))
    if (this.input.hit('KeyR') && enemies.length) {
      enemies.sort((a, b) => angleTo(a) - angleTo(b))
      const i = this.selected ? enemies.indexOf(this.selected) : -1
      this.selected = enemies[(i + 1) % enemies.length]
      this.lock = 0
      audio.click()
    }
    if (!this.selected) {
      let best: Target | null = null
      let bestA = (15 * Math.PI) / 180
      for (const t of enemies) {
        const a = angleTo(t)
        if (a < bestA && t.position.distanceTo(p.position) < 2400) {
          bestA = a
          best = t
        }
      }
      if (best) {
        this.selected = best
        this.lock = 0
      }
    }
    const s = this.selected
    const canLock = this.ammo > 0 && !!s && angleTo(s) < (12 * Math.PI) / 180 && s.position.distanceTo(p.position) < 1600
    if (canLock) this.lock = Math.min(1, this.lock + dt / (this.has('swarm') ? 0.55 : 0.8))
    else this.lock = Math.max(0, this.lock - dt * 2)
    if (this.lock >= 1 && !this.lockedSound) {
      this.lockedSound = true
      audio.lock(true)
    } else if (this.lock < 1 && this.lockedSound) {
      this.lockedSound = false
    }
  }

  private lead = new THREE.Vector3()
  private hasLead = false

  private updateGuns(dt: number) {
    const p = this.player!
    const inp = this.input
    this.heat = Math.max(0, this.heat - 35 * dt)
    if (this.overheated && this.heat <= 30) this.overheated = false
    p.fireTimer -= dt
    this.hasLead = false
    if (this.selected) {
      leadPoint(this.lead, p.position, p.velocity, this.selected.position, this.selected.velocity, p.stats.boltSpeed)
      this.hasLead = true
    }
    const firing = inp.fire || !!inp.gamepad?.fire
    if (!firing || this.overheated || p.fireTimer > 0) return
    p.fireTimer = p.stats.fireRate
    const aim = _b.copy(p.position).addScaledVector(this.aimDir, 800)
    // light aim assist: snap to the lead pip when it is close to the circle
    if (this.hasLead) {
      _a.copy(this.lead).sub(p.position).normalize()
      if (_a.angleTo(this.aimDir) < (3 * Math.PI) / 180) aim.copy(this.lead)
    }
    const m = p.model.muzzles
    const muzzle = m[p.muzzleIdx++ % m.length]
    p.local(_a, muzzle)
    _c.copy(aim).sub(_a).normalize().multiplyScalar(p.stats.boltSpeed).add(p.velocity)
    this.lasers.fire('mars', _a, _c, p.stats.damage, p.id, 1.4)
    this.fx.muzzle(_a, p.velocity, false)
    audio.laser(false, 0.55, muzzle.x > 0 ? 0.15 : -0.15)
    this.stats.shots++
    this.heat += 6 * (this.has('cryo') ? 0.6 : 1)
    if (this.heat >= 100) {
      this.heat = 100
      this.overheated = true
    }
  }

  /** Ships against obstacles: push out, and hurt the player on impact. */
  private collide() {
    for (const s of this.ships) {
      if (!s.alive) continue
      for (const o of this.obstacles) {
        const r = o.r + s.radius * 0.7
        const dsq = s.position.distanceToSquared(o.p)
        if (dsq > r * r) continue
        _a.copy(s.position).sub(o.p)
        const d = Math.sqrt(dsq) || 1
        _a.divideScalar(d)
        s.position.copy(o.p).addScaledVector(_a, r)
        const vn = s.velocity.dot(_a)
        if (vn < 0) {
          s.velocity.addScaledVector(_a, -vn * 1.6)
          if (s === this.player) {
            const dmg = clamp(-vn * 0.25, 4, 45)
            this.hitShip(s, dmg, s.position, _a, 'terra', -1)
            this.fx.impact(s.position, _a, false)
            this.shake(0.6)
          } else if (-vn > 80) {
            s.hp -= -vn * 0.2
            if (s.hp <= 0) this.destroyShip(s)
          }
        }
      }
    }
  }

  /** Bolts as segments against ships, structures, shields and rocks. */
  private bolts() {
    for (const b of this.lasers.bolts) {
      if (!b.alive) continue
      const len = b.pos.distanceTo(b.prev)
      _d.copy(b.pos).add(b.prev).multiplyScalar(0.5)
      let hit = false
      for (const s of this.ships) {
        if (!s.alive || s.team === b.team || s.id === b.owner) continue
        const r = s.radius * 0.85
        if (_d.distanceToSquared(s.position) > (len * 0.5 + r) ** 2) continue
        if (segPointDistSq(b.prev, b.pos, s.position) > r * r) continue
        b.alive = false
        hit = true
        this.fx.impact(b.pos, null, b.team === 'terra')
        this.hitShip(s, b.damage, b.pos, b.vel, b.team, b.owner)
        break
      }
      if (hit) continue
      for (const st of this.structures) {
        if (!st.alive || st.team === b.team) continue
        if (st.shieldMesh && st.shieldRadius > 0) {
          const r = st.shieldRadius
          if (segPointDistSq(b.prev, b.pos, st.position) < r * r && b.prev.distanceToSquared(st.position) > r * r * 0.8) {
            b.alive = false
            hit = true
            this.fx.shieldHit(b.pos)
            const mat = st.shieldMesh.material as THREE.ShaderMaterial
            if (mat.uniforms?.uHit) mat.uniforms.uHit.value = 1
            if (b.owner === this.player?.id) this.hitMarker = 0.5
            break
          }
        }
        for (const sp of st.spheres) {
          if (_d.distanceToSquared(sp.p) > (len * 0.5 + sp.r) ** 2) continue
          if (segPointDistSq(b.prev, b.pos, sp.p) > sp.r * sp.r) continue
          b.alive = false
          hit = true
          _a.copy(b.vel).normalize().negate()
          this.fx.impact(b.pos, _a, b.team === 'terra')
          if (!st.invulnerable) {
            st.damage(b.damage)
            if (b.owner === this.player?.id) {
              this.hitMarker = 1
              this.stats.hits++
            }
          }
          break
        }
        if (hit) break
      }
      if (hit) continue
      // friendly structures stop friendly fire too, so allies don't shoot through the station
      for (const st of this.structures) {
        if (!st.alive || st.team !== b.team || st.radius < 100) continue
        for (const sp of st.spheres) {
          if (_d.distanceToSquared(sp.p) > (len * 0.5 + sp.r) ** 2) continue
          if (segPointDistSq(b.prev, b.pos, sp.p) > sp.r * sp.r) continue
          b.alive = false
          hit = true
          break
        }
        if (hit) break
      }
      if (hit) continue
      for (const o of this.obstacles) {
        if (_d.distanceToSquared(o.p) > (len * 0.5 + o.r) ** 2) continue
        if (segPointDistSq(b.prev, b.pos, o.p) > o.r * o.r) continue
        b.alive = false
        this.fx.impact(b.pos, null, b.team === 'terra')
        break
      }
    }
  }

  private updateMissiles(dt: number) {
    this.enemyMissilePts.length = 0
    for (const m of this.missiles) {
      if (!m.alive) continue
      m.life -= dt
      const t = m.target
      _a.copy(m.vel).normalize()
      if (t && t.alive && !m.decoyed) {
        _b.copy(t.position).sub(m.pos).normalize()
        const ang = _a.angleTo(_b)
        if (ang > 1e-4) {
          _c.crossVectors(_a, _b).normalize()
          _a.applyAxisAngle(_c, Math.min(ang, m.turn * dt))
        }
      }
      m.speed = Math.min(m.maxSpeed, m.speed + 420 * dt)
      m.vel.copy(_a).multiplyScalar(m.speed)
      m.pos.addScaledVector(m.vel, dt)
      m.mesh.position.copy(m.pos)
      quatLookDir(m.mesh.quaternion, _a)
      if (m.trail) this.trails.push(m.trail, _b.copy(m.pos).addScaledVector(_a, -2.5), dt)
      if (m.team === 'terra' && m.target === this.player) this.enemyMissilePts.push(m.pos)

      let boom = m.life <= 0
      if (!boom) {
        for (const s of this.ships) {
          if (!s.alive || s.team === m.team) continue
          if (s.position.distanceToSquared(m.pos) < (s.radius + 4) ** 2) {
            boom = true
            break
          }
        }
      }
      if (!boom && t && t instanceof Structure && t.alive) {
        for (const sp of t.spheres) if (sp.p.distanceToSquared(m.pos) < (sp.r + 4) ** 2) boom = true
      }
      if (!boom) {
        for (const o of this.obstacles) {
          if (o.p.distanceToSquared(m.pos) < o.r * o.r) {
            boom = true
            break
          }
        }
      }
      if (boom) this.detonate(m)
    }
  }

  private detonate(m: Missile) {
    m.alive = false
    this.actors.remove(m.mesh)
    this.trails.release(m.trail)
    m.trail = null
    this.fx.explode(m.pos, 7, this.camera, undefined, m.team === 'terra')
    const sp = this.spatial(m.pos)
    audio.explosion(0.6, Math.max(0.1, sp.vol), sp.pan)
    if (m.life <= 0) return
    for (const s of [...this.ships]) {
      if (!s.alive || s.team === m.team) continue
      const d = s.position.distanceTo(m.pos)
      if (d < s.radius + 6) this.hitShip(s, m.damage, m.pos, m.vel, m.team, m.owner)
      else if (d < 60 && m.team === 'mars') this.hitShip(s, 30, m.pos, m.vel, m.team, m.owner)
    }
    const t = m.target
    if (t instanceof Structure && t.alive && !t.invulnerable) {
      for (const sp2 of t.spheres) {
        if (sp2.p.distanceTo(m.pos) < sp2.r + 12) {
          t.damage(m.damage * 1.5)
          if (m.owner === this.player?.id) this.hitMarker = 1
          break
        }
      }
    }
  }

  private updateEngines(dt: number) {
    for (const s of this.ships) {
      if (!s.alive) continue
      const power = s === this.player && this.boosting ? 1.6 : 0.5 + (s.speed / s.stats.maxSpeed) * 0.5
      for (let i = 0; i < s.trails.length; i++) {
        const tr = s.trails[i]
        if (!tr) continue
        tr.intensity = power
        this.trails.push(tr, s.local(_a, s.model.engines[i]), dt)
      }
    }
    const p = this.player
    if (p?.alive && this.mode !== 'briefing') {
      p.forward(_fwd)
      _b.copy(_fwd).negate()
      const pw = this.boosting ? 1.4 : 0.4 + this.throttle * 0.5
      for (const e of p.model.engines) this.fx.exhaust(p.local(_a, e), p.velocity, _b, p.model.engineColor, pw)
    }
  }

  /* ---------------------------------------------------------------- */
  /* Camera, post and HUD                                              */
  /* ---------------------------------------------------------------- */

  private updateCamera(dt: number) {
    const cam = this.camera
    const p = this.player
    let fovTarget = 70
    if (this.mode === 'menu' || this.mode === 'idle' || !p) {
      const o = this.mission?.orbit
      if (o) {
        this.orbitA += dt * 0.035
        cam.position.set(o.center.x + Math.cos(this.orbitA) * o.radius, o.center.y + o.height, o.center.z + Math.sin(this.orbitA) * o.radius)
        cam.up.set(0, 1, 0)
        cam.lookAt(_a.copy(o.center).add(_b.set(0, o.height * 0.55, 0)))
      }
      fovTarget = 62
    } else if (this.mode === 'briefing') {
      this.orbitA += dt * 0.22
      const r = 34
      cam.position.set(p.position.x + Math.cos(this.orbitA) * r, p.position.y + 7, p.position.z + Math.sin(this.orbitA) * r)
      cam.up.set(0, 1, 0)
      cam.lookAt(p.position)
      fovTarget = 55
    } else if (this.mode === 'dead' || (this.mode === 'over' && !p.alive)) {
      _a.copy(cam.position).sub(p.position).normalize()
      cam.position.addScaledVector(_a, dt * 14)
      cam.lookAt(p.position)
    } else {
      p.up(_up)
      this.camUp.lerp(_up, 1 - Math.exp(-5 * dt)).normalize()
      _a.copy(this.aimDir).multiplyScalar(-24).addScaledVector(this.camUp, 7)
      this.camOffset.lerp(_a, 1 - Math.exp(-9 * dt))
      cam.position.copy(p.position).add(this.camOffset)
      cam.up.copy(this.camUp)
      cam.lookAt(_b.copy(p.position).addScaledVector(this.aimDir, 220))
      fovTarget = this.boosting ? 82 : 70 + clamp(p.speed / p.stats.maxSpeed, 0, 1) * 3
      if (this.mode === 'warp') fovTarget = 70 + Math.min(1, this.warpT / 1.6) * 40
    }
    if (this.shakeAmt > 0.001) {
      randomUnit(_c).multiplyScalar(this.shakeAmt * 1.4)
      cam.position.add(_c)
      this.shakeAmt = Math.max(0, this.shakeAmt - dt * 1.8)
    }
    this.fov = damp(this.fov, fovTarget, 4, dt)
    if (Math.abs(cam.fov - this.fov) > 0.01) {
      cam.fov = this.fov
      cam.updateProjectionMatrix()
      this.fx.setViewport(this.renderer.domElement.height, cam.fov)
    }
    cam.updateMatrixWorld()
  }

  private occluders: { p: THREE.Vector3; r: number }[] = []

  private render(dt: number) {
    this.occluders.length = 0
    for (const pl of this.planets) this.occluders.push({ p: pl.group.position, r: pl.radius })
    this.sky.update(this.camera, this.occluders)
    this.trails.update(this.camera)
    const p = this.player
    const boost = p?.alive && this.boosting ? 1 : this.mode === 'warp' ? 1 : 0
    this.dust.update(this.camera.position, p?.alive ? p.velocity : _a.set(0, 0, 0), boost)

    const u = this.post.uniforms
    u.uTime.value = this.time
    u.uHit.value = this.hitPulse
    u.uDamage.value = p?.alive && this.mode === 'play' ? clamp(1 - p.hp / p.maxHp - 0.35, 0, 0.65) * 1.6 : this.mode === 'dead' ? 1 : 0
    u.uWarp.value = this.mode === 'warp' ? Math.min(1, this.warpT / 1.4) : damp(u.uWarp.value, 0, 6, dt)
    this.composer.render(dt)

    // audio
    let near = 0
    if (p) for (const s of this.ships) if (s.alive && s.team === 'terra' && s.position.distanceToSquared(p.position) < 1500 * 1500) near++
    audio.intensity = this.mode === 'play' ? clamp(near / 6, 0.15, 1) : 0
    audio.engine(this.throttle, this.boosting ? 1 : 0, this.mode === 'play' && !!p?.alive && !this.paused)
    audio.update(dt)

    this.collectTargets()
    if ((this.mode === 'play' || this.mode === 'dead') && !this.paused) this.drawHud()
    else this.hud.clear()
    this.syncT -= dt
    if (this.syncT <= 0) {
      this.syncT = 1 / 12
      this.syncStore()
    }
  }

  private collectTargets() {
    this.targets.length = 0
    for (const s of this.ships) if (s.alive && s !== this.player) this.targets.push(s)
    for (const s of this.structures) if (s.alive && s.targetable) this.targets.push(s)
  }

  private drawHud() {
    const p = this.player
    const f = this.frame
    f.player = p?.alive ? p : null
    if (p?.alive) {
      p.forward(_fwd)
      f.aimPoint.copy(p.position).addScaledVector(this.aimDir, 800)
      f.nosePoint.copy(p.position).addScaledVector(_fwd, 800)
    }
    f.selected = this.selected
    f.lead = this.hasLead && this.selected ? this.lead : null
    f.lock = this.lock
    f.hitMarker = this.hitMarker
    f.kill = this.killFlash
    f.objectivePoint = this.mission?.focus() ?? null
    this.hud.draw(f)
  }

  private syncStore() {
    const st = useGame.getState()
    const p = this.player
    const now = this.time
    this.comms = this.comms.filter((c) => now - c.t < 6)
    this.kills = this.kills.filter((k) => now - k.t < 4)
    if (this.combo > 1 && now - this.lastKill > 4) this.combo = 1
    const playing = st.screen === 'playing'
    const comms = this.comms.map(({ id, who, text }) => ({ id, who, text }))
    const kills = this.kills.map(({ id, line, mine }) => ({ id, line, mine }))
    const needsClick = playing && this.mode === 'play' && this.unlockedT > 0.3
    if (!p || !this.mission || this.mode === 'menu') {
      if (st.needsClick || st.comms.length || st.kills.length) st.set({ needsClick: false, comms: [], kills: [] })
      return
    }
    const warnings: I18nKey[] = []
    if (this.overheated) warnings.push('hud.overheat')
    if (p.alive && p.hp < p.maxHp * 0.3) warnings.push('hud.lowhull')
    if (p.alive && p.position.distanceTo(this.arenaCenter) > this.arenaRadius * 1.15) warnings.push('hud.boundary')
    if (this.enemyMissilePts.length) warnings.push('hud.incoming')
    const bt = this.bomberTarget as Structure | null
    if (bt && bt.team === 'mars' && bt.alive && now - bt.lastHit < 1) warnings.push('hud.stationHit')
    const objective: Line[] = this.mission.objective()
    st.set({
      hud: {
        hull: Math.max(0, p.hp),
        maxHull: p.maxHp,
        shield: p.shield,
        maxShield: p.maxShield,
        heat: this.heat,
        overheated: this.overheated,
        boost: this.fuel,
        missiles: this.ammo,
        maxMissiles: this.maxAmmo,
        speed: p.alive ? p.velocity.length() : 0,
        score: Math.round(this.score),
        combo: this.combo,
        objective,
        bar: this.mission.bar(),
        warnings,
        locked: this.lock >= 1,
      },
      comms,
      kills,
      needsClick,
    })
  }
}

let current: Game | null = null
export const gameRef = {
  get: () => current,
  set: (g: Game | null) => (current = g),
}
