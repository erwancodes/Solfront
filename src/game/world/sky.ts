import * as THREE from 'three'
import { makeRadialTexture } from '../materials'
import { loadTexture } from './planet'

export const SKY_RADIUS = 300000

export interface Sky {
  group: THREE.Group
  sunDir: THREE.Vector3
  setSun(dir: THREE.Vector3): void
  /** Keeps the sky centred on the camera and runs the lens flare. */
  update(camera: THREE.PerspectiveCamera, occluders: { p: THREE.Vector3; r: number }[]): void
  ready: Promise<void>
}

const STAR_VERT = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_vertex>
attribute float aSize;
attribute vec3 aColor;
varying vec3 vColor;
uniform float uTime;
void main(){
  vColor = aColor * (0.85 + 0.15 * sin(uTime * 2.0 + position.x * 0.01));
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = aSize;
  #include <logdepthbuf_vertex>
}`
const STAR_FRAG = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_fragment>
varying vec3 vColor;
void main(){
  #include <logdepthbuf_fragment>
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c);
  float a = smoothstep(0.5, 0.0, d);
  a = a * a;
  gl_FragColor = vec4(vColor * a, 1.0);
}`

export function createSky(): Sky {
  const group = new THREE.Group()
  group.name = 'sky'
  const sunDir = new THREE.Vector3(0.6, 0.25, -0.75).normalize()

  const skyMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.55, 0.55, 0.6), side: THREE.BackSide, depthWrite: false, fog: false })
  const skyMesh = new THREE.Mesh(new THREE.SphereGeometry(SKY_RADIUS, 64, 32), skyMat)
  skyMesh.renderOrder = -10
  skyMesh.rotation.set(0.6, 0, 0.35)
  group.add(skyMesh)
  const ready = loadTexture('/textures/sky/milky-way.jpg', true, 4).then((t) => {
    skyMat.map = t
    skyMat.needsUpdate = true
  })

  // bright foreground stars on top of the photographic sky
  const count = 2600
  const pos = new Float32Array(count * 3)
  const col = new Float32Array(count * 3)
  const size = new Float32Array(count)
  const v = new THREE.Vector3()
  for (let i = 0; i < count; i++) {
    v.randomDirection().multiplyScalar(SKY_RADIUS * 0.9)
    pos.set([v.x, v.y, v.z], i * 3)
    const t = Math.random()
    const c = t < 0.15 ? [1.0, 0.75, 0.55] : t < 0.35 ? [0.7, 0.82, 1.0] : [1, 0.97, 0.92]
    const k = 0.5 + Math.pow(Math.random(), 6) * 3.5
    col.set([c[0] * k, c[1] * k, c[2] * k], i * 3)
    size[i] = 1.2 + Math.pow(Math.random(), 8) * 3.2
  }
  const starGeo = new THREE.BufferGeometry()
  starGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  starGeo.setAttribute('aColor', new THREE.BufferAttribute(col, 3))
  starGeo.setAttribute('aSize', new THREE.BufferAttribute(size, 1))
  const starMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: STAR_VERT,
    fragmentShader: STAR_FRAG,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    transparent: true,
  })
  const stars = new THREE.Points(starGeo, starMat)
  stars.renderOrder = -9
  stars.frustumCulled = false
  group.add(stars)

  // sun: hot core plus a wide corona
  const glowTex = makeRadialTexture(256, [
    [0, 'rgba(255,255,255,1)'],
    [0.08, 'rgba(255,250,235,0.95)'],
    [0.2, 'rgba(255,220,170,0.35)'],
    [0.5, 'rgba(255,170,90,0.08)'],
    [1, 'rgba(255,150,60,0)'],
  ])
  const sunCore = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: new THREE.Color(14, 12, 10), blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, fog: false }))
  sunCore.scale.setScalar(SKY_RADIUS * 0.09)
  sunCore.renderOrder = -8
  const sunHalo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: new THREE.Color(1.6, 1.2, 0.8), blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, fog: false }))
  sunHalo.scale.setScalar(SKY_RADIUS * 0.5)
  sunHalo.renderOrder = -8
  group.add(sunCore, sunHalo)

  // lens flare ghosts, laid out in screen space each frame
  const ringTex = makeRadialTexture(128, [
    [0, 'rgba(255,255,255,0)'],
    [0.7, 'rgba(255,255,255,0.0)'],
    [0.82, 'rgba(255,255,255,0.5)'],
    [0.9, 'rgba(255,255,255,0.0)'],
    [1, 'rgba(255,255,255,0)'],
  ])
  const flareScene = new THREE.Group()
  const ghosts: { s: THREE.Sprite; t: number; size: number }[] = []
  const spec: [number, number, THREE.Color, THREE.Texture][] = [
    [0, 0.5, new THREE.Color(1.4, 1.2, 1.0), glowTex],
    [0.35, 0.06, new THREE.Color(0.25, 0.4, 0.8), glowTex],
    [0.6, 0.12, new THREE.Color(0.5, 0.3, 0.15), ringTex],
    [0.9, 0.04, new THREE.Color(0.3, 0.6, 0.3), glowTex],
    [1.2, 0.18, new THREE.Color(0.18, 0.22, 0.45), ringTex],
    [1.6, 0.08, new THREE.Color(0.5, 0.3, 0.2), glowTex],
  ]
  for (const [t, sz, c, map] of spec) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map, color: c, blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false, toneMapped: false, transparent: true }))
    s.renderOrder = 999
    flareScene.add(s)
    ghosts.push({ s, t, size: sz })
  }
  group.add(flareScene)

  const ndc = new THREE.Vector3()
  const tmp = new THREE.Vector3()
  const ray = new THREE.Vector3()
  let vis = 0
  let time = 0

  const setSun = (dir: THREE.Vector3) => {
    sunDir.copy(dir).normalize()
    sunCore.position.copy(sunDir).multiplyScalar(SKY_RADIUS * 0.85)
    sunHalo.position.copy(sunCore.position)
  }
  setSun(sunDir)

  return {
    group,
    sunDir,
    setSun,
    ready,
    update(camera, occluders) {
      time += 1 / 60
      starMat.uniforms.uTime.value = time
      skyMesh.position.copy(camera.position)
      stars.position.copy(camera.position)
      sunCore.position.copy(sunDir).multiplyScalar(SKY_RADIUS * 0.85).add(camera.position)
      sunHalo.position.copy(sunCore.position)

      // occlusion: does any planet sphere block the line to the sun?
      let blocked = false
      ray.copy(sunDir)
      for (const o of occluders) {
        tmp.copy(o.p).sub(camera.position)
        const tc = tmp.dot(ray)
        if (tc < 0) continue
        const d2 = tmp.lengthSq() - tc * tc
        if (d2 < o.r * o.r) {
          blocked = true
          break
        }
      }
      ndc.copy(sunDir).multiplyScalar(1000).add(camera.position).project(camera)
      const onScreen = ndc.z < 1 && Math.abs(ndc.x) < 1.3 && Math.abs(ndc.y) < 1.3
      const target = !blocked && onScreen ? 1 - Math.min(1, Math.hypot(ndc.x, ndc.y) * 0.55) : 0
      vis += (target - vis) * 0.18
      sunHalo.visible = !blocked
      sunCore.visible = !blocked
      flareScene.visible = vis > 0.01
      if (!flareScene.visible) return
      // place ghosts along the line from the sun through the screen centre, at a fixed depth
      const depth = 10
      const h = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * depth
      const w = h * camera.aspect
      for (const g of ghosts) {
        const x = ndc.x * (1 - g.t * 2) * (w / 2)
        const y = ndc.y * (1 - g.t * 2) * (h / 2)
        g.s.position.set(x, y, -depth).applyMatrix4(camera.matrixWorld)
        g.s.scale.setScalar(g.size * h)
        ;(g.s.material as THREE.SpriteMaterial).opacity = vis * (g.t === 0 ? 0.9 : 0.55)
      }
    },
  }
}
