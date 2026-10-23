import * as THREE from 'three'

/**
 * Shared materials. Hulls use vertex colours for livery and an object-space
 * triplanar panel pattern injected into MeshStandardMaterial, so every
 * procedural part gets seams, plate variation and roughness breakup without
 * needing hand-made UVs.
 */

const PANEL_VERTEX_PARS = /* glsl */ `
varying vec3 vObjPos;
varying vec3 vObjNormal;
`
const PANEL_FRAGMENT_PARS = /* glsl */ `
varying vec3 vObjPos;
varying vec3 vObjNormal;
uniform float uPanelScale;
uniform float uSeam;
float pHash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
// Returns x = seam mask (1 on seam), y = per-plate random
vec2 panelPlane(vec2 p){
  vec2 q = p * uPanelScale;
  // stagger rows so plates do not align like a grid
  q.x += step(1.0, mod(floor(q.y), 2.0)) * 0.5;
  vec2 cell = floor(q);
  float r = pHash(cell);
  // split some plates in two for variety
  vec2 f = fract(q);
  if (r > 0.6) { f.x = fract(f.x * 2.0); cell.x += step(0.5, fract(q.x)) * 0.37; }
  vec2 g = fwidth(q) * 1.2;
  vec2 d = min(f, 1.0 - f);
  vec2 l = smoothstep(g * 0.6, g * 0.6 + vec2(uSeam), d);
  float seam = 1.0 - min(l.x, l.y);
  return vec2(seam, pHash(cell + 13.1));
}
vec2 panelTriplanar(){
  vec3 w = pow(abs(normalize(vObjNormal)), vec3(4.0));
  w /= (w.x + w.y + w.z);
  vec2 a = panelPlane(vObjPos.zy);
  vec2 b = panelPlane(vObjPos.xz);
  vec2 c = panelPlane(vObjPos.xy);
  return a * w.x + b * w.y + c * w.z;
}
`

export interface HullOptions {
  roughness?: number
  metalness?: number
  panelScale?: number
  seam?: number
}

export function makeHullMaterial(opts: HullOptions = {}) {
  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: opts.roughness ?? 0.48,
    metalness: opts.metalness ?? 0.55,
  })
  const panelScale = opts.panelScale ?? 0.55
  const seam = opts.seam ?? 0.02
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uPanelScale = { value: panelScale }
    shader.uniforms.uSeam = { value: seam }
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${PANEL_VERTEX_PARS}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>\nvObjPos = position; vObjNormal = normal;`)
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${PANEL_FRAGMENT_PARS}`)
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        vec2 panel = panelTriplanar();
        float plate = 0.9 + 0.2 * panel.y;
        diffuseColor.rgb *= plate * mix(1.0, 0.42, panel.x);`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
        roughnessFactor = clamp(roughnessFactor + (panel.y - 0.5) * 0.22 + panel.x * 0.25, 0.08, 1.0);`,
      )
  }
  mat.customProgramCacheKey = () => `hull-${panelScale}-${seam}`
  return mat
}

export function makeGlassMaterial() {
  return new THREE.MeshPhysicalMaterial({
    color: 0x0b1116,
    metalness: 0.1,
    roughness: 0.04,
    clearcoat: 1,
    clearcoatRoughness: 0.02,
    envMapIntensity: 1.6,
  })
}

/** Unlit HDR colour: values above 1 feed the bloom pass. */
export function makeGlowMaterial(color: THREE.ColorRepresentation, intensity = 6) {
  const c = new THREE.Color(color).multiplyScalar(intensity)
  return new THREE.MeshBasicMaterial({ color: c, toneMapped: false })
}

export function makeDarkMaterial() {
  return new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, metalness: 0.4 })
}

/** Soft round sprite used for flares, glows and lens artefacts. */
export function makeRadialTexture(size = 128, stops: [number, string][] = [[0, 'rgba(255,255,255,1)'], [0.25, 'rgba(255,255,255,0.45)'], [1, 'rgba(255,255,255,0)']]) {
  const c = document.createElement('canvas')
  c.width = c.height = size
  const ctx = c.getContext('2d')!
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  for (const [o, col] of stops) g.addColorStop(o, col)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}
