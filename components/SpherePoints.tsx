'use client'

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Unbounded } from 'next/font/google'
import * as THREE from 'three'
import ServiceIconsRow, { type CometHoverTint, type ServiceShape } from '@/components/ServiceIconsRow'
import TypewriterPanel, { type Lang } from '@/components/TypewriterPanel'

const unbounded = Unbounded({
  subsets: ['latin', 'cyrillic'],
  weight: ['700'],
})

// ─── Constants ───────────────────────────────────────────────────────────────

/** Единственное число частиц сферы. Жёстко: не менять, не добавлять, не убирать — после взрыва те же 8000. */
const POINT_COUNT   = 8000
const SPHERE_RADIUS = 1.0

const METEOR_DURATION  = 2.5
const METEOR_RETREAT   = 0.95
const LOADING_DURATION = 2500

const COMET_POINT_COUNT  = 340
const COMET_RADIUS       = 0.048
const COMET_HEAD_SIZE    = 0.0108
const COMET_TAIL_COUNT   = 170
const COMET_TRAIL_SIZE   = 0.0044
const COMET_SCATTER_SIZE = 1.30
const COMET_GLOW_SIZE    = 2.05
const COMET_GLOW_OPACITY = 0.22
const COMET_ROT_SPEED    = 0.95
const COMET_FOLLOW_K     = 22
const COMET_TAIL_VEL_K   = 38
const COMET_TAIL_LEN_MAX = 0.62
const COMET_TAIL_LEN_K   = 13
const COMET_TAIL_SPEED_SMOOTH = 11
const COMET_TAIL_FADE_SPEED   = 0.022

const IMPACT = new THREE.Vector3(-SPHERE_RADIUS, 0, 0)
const METEOR_START = new THREE.Vector3(-5.1, 1.08, 0)
const METEOR_DIR_X   = IMPACT.x - METEOR_START.x
const METEOR_DIR_Y   = IMPACT.y - METEOR_START.y
const METEOR_DIR_LEN = Math.hypot(METEOR_DIR_X, METEOR_DIR_Y) || 1
const METEOR_EJECT_X = METEOR_START.x - IMPACT.x
const METEOR_EJECT_Y = METEOR_START.y - IMPACT.y
const METEOR_EJECT_LEN = Math.hypot(METEOR_EJECT_X, METEOR_EJECT_Y) || 1

const SCATTER_MAX_R    = SPHERE_RADIUS * 2
const SCATTER_MIN_R    = SPHERE_RADIUS * 0.78
const PREBURST_DURATION  = 1.35
const BURST_DURATION     = 0.34
const PREBURST_CRATER_BLAST = 0.66
const PREBURST_INNER_SWELL  = 0.028
const PREBURST_INNER_VIB    = 0.013
const PREBURST_INNER_START  = 0.14
const PREBURST_SHOCK_AMP    = 0.062
const PREBURST_SHOCK_WIDTH  = 0.21
const PREBURST_SHOCK_REACH  = Math.PI * 1.06
/** Меньше = медленнее кольцо по сфере. */
const PREBURST_SHOCK_TRAVEL_POWER = 0.36
/** >1 = волна дольше разгоняется по таймлайну preburst. */
const PREBURST_SHOCK_CURVE_EXP = 2.1
const COMET_REFORM_FOLLOW_K  = 8.5
const COMET_SCATTER_Z_SPREAD = 0.78
const COMET_SCATTER_DRAG = 0.72
const COMET_SCATTER_INIT_SPEED_MIN = 0.52
const COMET_SCATTER_INIT_SPEED_MAX = 1.18
const COMET_SCATTER_PREBURST_ACCEL = 0.10
const COMET_SCATTER_BURST_ACCEL = 2.35
const COMET_SCATTER_REFORM_MIN = 0.05
const COMET_MAGNET_REACH = 0.40
const COMET_MAGNET_CORE = 0.11
const COMET_MAGNET_FLIGHT = 0.60
const COMET_MAGNET_COMMIT = 0.05
const COMET_MAGNET_PULL_MAX = 5.1
/** Частица у курсора — на fixed-слое; до этого остаётся на canvas первой секции. */
const COMET_MIRROR_REFORM_MIN = 0.03
/** Сколько частиц на mirror до отключения seed-ядра курсора. */
const COMET_CURSOR_SEED_HIDE_COUNT = 48
/** Доля 8000 точек правее середины экрана для старта typewriter. */
const POINTS_TYPEWRITER_RIGHT_RATIO = 0.48
const COMET_TYPEWRITER_DELAY_MS = 500
const SERVICE_WORDS_DELAY_MS    = 1500
const EXPLODE_DURATION   = PREBURST_DURATION + BURST_DURATION

export type ExplosionPhase = 'none' | 'preburst' | 'burst' | 'reside'

interface ExplosionState {
  phase: ExplosionPhase
  preburstU: number
}

const SPHERE_DRIFT_R_MIN    = 0.045
const SPHERE_DRIFT_R_MAX    = 0.13
const SPHERE_DRIFT_SPEED_MIN = 0.32
const SPHERE_DRIFT_SPEED_MAX = 0.95

const CIRCLE_TUMBLE_MIN = 0.42
const CIRCLE_TUMBLE_MAX = 1.18

const MASS_ROT_SPEED_X = 0.048
const MASS_ROT_SPEED_Y = 0.14
const MASS_ROT_SPEED_Z = 0.032

const COMET_CLEAR_PX_EXTRA = 1
const COMET_CLEAR_PX_TO_WORLD = (2 * Math.tan((60 * Math.PI / 180) / 2) * 5 * COMET_CLEAR_PX_EXTRA) / 1080
const COMET_BUBBLE_PX = 1
const COMET_BUBBLE_PX_WORLD = (2 * Math.tan((60 * Math.PI / 180) / 2) * 5 * COMET_BUBBLE_PX) / 1080
const COMET_CLEAR_R         = COMET_RADIUS * 1.08 + COMET_CLEAR_PX_TO_WORLD
const COMET_FEAR_BUBBLE_R   = COMET_RADIUS + 0.014 * 0.2 + COMET_BUBBLE_PX_WORLD
const COMET_SCREEN_INFLUENCE_R = 0.052
const COMET_MAX_DISP           = 0.074
const COMET_FEAR_K             = 0.88
const COMET_SEP_K              = 214
const COMET_PLOW_K             = 196
const COMET_BOW_FORWARD_K      = 112
const COMET_BOW_V_K            = 48
const COMET_PASS_K             = 74
const COMET_FEAR_REACH         = COMET_FEAR_BUBBLE_R * 4.5
const COMET_PLOW_PATH_W        = COMET_FEAR_BUBBLE_R * 3.6
const COMET_SPEED_FULL         = 0.42
const COMET_WAKE_SPEED_THRESH  = 0.012
const COMET_REPULSE_MAX_VEL    = 1.24
const COMET_WAKE_MAX_VEL       = 1.62
const COMET_RETURN_SPRING      = 10.5
const COMET_VEL_DAMP           = 1.45
const COMET_FORCE_DAMP         = 0.62

const RESIDE_DRIFT_DURATION   = 7
const RESIDE_TARGET_NDC_X     = 0.30
const RESIDE_TARGET_NDC_Y     = 0.05
const RESIDE_EDGE_MARGIN_NDC  = 0.11
const RESIDE_MORPH_ONSET      = 1.0
const RESIDE_MORPH_CYCLE      = 0.095
const RESIDE_MORPH_HOLD       = 0.34
const RESIDE_VISION_COUNT     = 7
const RESIDE_VPLUS_VISION     = 3
const RESIDE_VPLUS_Z_SCALE    = 0.72
const RESIDE_FORM_SCALE       = 1.02
const RESIDE_GATHER_MAX       = 0.19
const RESIDE_APPROACH_Z       = 1.30
const SHAPE_BUILD_DURATION    = 2.85
const DEVICE_GLYPH_SCALE      = 1.38
const APP_PHONE_ROT_Y         = 0.55
const APP_PHONE_TILT_X        = 0.34
const APP_PHONE_Z_DEPTH       = 2.05
const APP_PHONE_ASSEMBLY_STAGGER = 2.4
const APP_PHONE_PART_TRAVEL_SEC = 0.7
const APP_PHONE_LOCK_PROX       = 0.14
const APP_PHONE_MAGNET_BASE     = 0.08
const APP_PHONE_MAGNET_PEAK     = 0.38
const APP_PHONE_CLOUD_HEIGHT_FRAC = 0.88
const APP_PHONE_CLOUD_WIDTH_FRAC  = 0.70
const APP_PHONE_GLYPH_NATIVE_H = 0.96
const APP_PHONE_GLYPH_NATIVE_W = 0.42

// ─── Easing ──────────────────────────────────────────────────────────────────

function easeIn(t: number): number {
  return t * t * t
}

function easeOut(t: number): number {
  return 1 - Math.pow(1 - t, 3)
}

function smoothstep(t: number): number {
  const c = Math.max(0, Math.min(1, t))
  return c * c * (3 - 2 * c)
}

/** Быстрый локальный «выстрел» при ударе — без медленного разгона. */
function impactPop(t: number): number {
  const c = Math.max(0, Math.min(1, t))
  return 1 - Math.exp(-c * 6.8)
}

function hash01(i: number, seed = 0): number {
  const x = Math.sin(i * 127.1 + seed * 311.7) * 43758.5453
  return x - Math.floor(x)
}

function ndcToWorldXY(
  nx: number, ny: number,
  camera: THREE.Camera,
  _size: { width: number; height: number },
): THREE.Vector3 {
  const persp = camera as THREE.PerspectiveCamera
  const dist = persp.position.z
  const halfTan = Math.tan((persp.fov * Math.PI / 180) / 2) * dist
  return new THREE.Vector3(nx * halfTan * persp.aspect, ny * halfTan, 0)
}

function resideCloudHalfExtent(): number {
  const cameraZ = 5
  const approachFactor = cameraZ / (cameraZ - RESIDE_APPROACH_Z)
  const spreadR = SCATTER_MAX_R * (1 - RESIDE_GATHER_MAX * 0.5)
  return (spreadR * 0.48 + RESIDE_FORM_SCALE * 0.52 + 0.08) * approachFactor
}

function computeResideTargetWorld(camera: THREE.Camera): THREE.Vector3 {
  const persp = camera as THREE.PerspectiveCamera
  const dist = persp.position.z
  const halfTan = Math.tan((persp.fov * Math.PI / 180) / 2) * dist
  const halfW = halfTan * persp.aspect
  const halfH = halfTan
  const cloudR = resideCloudHalfExtent()
  const margin = RESIDE_EDGE_MARGIN_NDC

  const maxNdcX = 1 - margin - cloudR / halfW
  const minNdcX = -1 + margin + cloudR / halfW
  const maxNdcY = 1 - margin - cloudR / halfH
  const minNdcY = -1 + margin + cloudR / halfH

  const ndcX = Math.max(minNdcX, Math.min(maxNdcX, RESIDE_TARGET_NDC_X))
  const ndcY = Math.max(minNdcY, Math.min(maxNdcY, RESIDE_TARGET_NDC_Y))
  return ndcToWorldXY(ndcX, ndcY, camera, { width: 1, height: 1 })
}

// ─── Builders ────────────────────────────────────────────────────────────────

function buildCircleTexture(): THREE.CanvasTexture {
  const sz = 64, c = sz / 2
  const canvas = document.createElement('canvas')
  canvas.width = sz; canvas.height = sz
  const ctx = canvas.getContext('2d')!
  const grad = ctx.createRadialGradient(c, c, 0, c, c, c - 1)
  grad.addColorStop(0, 'rgba(255,255,255,1)')
  grad.addColorStop(0.55, 'rgba(255,255,255,0.9)')
  grad.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = grad
  ctx.beginPath(); ctx.arc(c, c, c - 1, 0, Math.PI * 2); ctx.fill()
  return new THREE.CanvasTexture(canvas)
}

function buildSpherePositions(): Float32Array {
  const pos = new Float32Array(POINT_COUNT * 3)
  const goldenAngle = Math.PI * (3 - Math.sqrt(5))
  for (let i = 0; i < POINT_COUNT; i++) {
    const y = 1 - (i / (POINT_COUNT - 1)) * 2
    const r = Math.sqrt(Math.max(0, 1 - y * y))
    const theta = goldenAngle * i
    pos[i * 3]     = Math.cos(theta) * r * SPHERE_RADIUS
    pos[i * 3 + 1] = y * SPHERE_RADIUS
    pos[i * 3 + 2] = Math.sin(theta) * r * SPHERE_RADIUS
  }
  return pos
}

function buildColors(): Float32Array {
  const colors = new Float32Array(POINT_COUNT * 3)
  for (let i = 0; i < POINT_COUNT; i++) {
    const b = 0.55 + Math.random() * 0.45
    colors[i * 3] = b; colors[i * 3 + 1] = b; colors[i * 3 + 2] = b
  }
  return colors
}

function buildCometSphereLocal(): Float32Array {
  const pos = new Float32Array(COMET_POINT_COUNT * 3)
  const goldenAngle = Math.PI * (3 - Math.sqrt(5))
  for (let i = 0; i < COMET_POINT_COUNT; i++) {
    const y = 1 - (i / (COMET_POINT_COUNT - 1)) * 2
    const ringR = Math.sqrt(Math.max(0, 1 - y * y))
    const theta = goldenAngle * i + (Math.random() - 0.5) * 0.05
    const shell = 0.90 + Math.pow(Math.random(), 0.62) * 0.10
    const r = COMET_RADIUS * shell
    pos[i * 3]     = Math.cos(theta) * ringR * r
    pos[i * 3 + 1] = y * r
    pos[i * 3 + 2] = Math.sin(theta) * ringR * r * 0.42
  }
  return pos
}

function buildCometHeadColors(): Float32Array {
  return buildCometHeadColorsForTint('default')
}

interface CometTintPalette {
  hot: [number, number, number]
  cool: [number, number, number]
  tail: [number, number, number]
}

const COMET_TINT_PALETTES: Record<CometHoverTint, CometTintPalette> = {
  default: {
    hot: [0.98, 0.48, 0.14],
    cool: [0.96, 0.26, 0.05],
    tail: [0.92, 0.22, 0.06],
  },
  video: {
    hot: [0.92, 0.40, 0.98],
    cool: [0.70, 0.26, 0.82],
    tail: [0.76, 0.22, 0.88],
  },
  site: {
    hot: [0.40, 0.86, 0.98],
    cool: [0.18, 0.56, 0.92],
    tail: [0.16, 0.50, 0.90],
  },
  app: {
    hot: [0.42, 0.96, 0.70],
    cool: [0.20, 0.76, 0.52],
    tail: [0.18, 0.68, 0.46],
  },
  business: {
    hot: [0.98, 0.76, 0.30],
    cool: [0.86, 0.56, 0.16],
    tail: [0.88, 0.50, 0.12],
  },
}

function buildCometHeadColorsForTint(tint: CometHoverTint): Float32Array {
  const palette = COMET_TINT_PALETTES[tint]
  const colors = new Float32Array(COMET_POINT_COUNT * 3)
  for (let i = 0; i < COMET_POINT_COUNT; i++) {
    const hot = hash01(i, 4) > 0.62
    const p = hot ? palette.hot : palette.cool
    if (hot) {
      colors[i * 3]     = p[0]
      colors[i * 3 + 1] = p[1] + hash01(i, 5) * 0.24
      colors[i * 3 + 2] = p[2] + hash01(i, 6) * 0.16
    } else {
      colors[i * 3]     = p[0]
      colors[i * 3 + 1] = p[1] + hash01(i, 7) * 0.16
      colors[i * 3 + 2] = p[2] + hash01(i, 8) * 0.08
    }
  }
  return colors
}

function applyCometHeadTintBlend(
  headPts: THREE.Points | null,
  headGlowPts: THREE.Points | null,
  baseColors: Float32Array,
  hoverTintRef: React.MutableRefObject<CometHoverTint> | undefined,
  tintBlendRef: React.MutableRefObject<number>,
  delta: number,
): CometTintPalette {
  const tint = hoverTintRef?.current ?? 'default'
  const targetBlend = tint === 'default' ? 0 : 1
  tintBlendRef.current += (targetBlend - tintBlendRef.current) * (1 - Math.exp(-6.5 * delta))
  const b = tintBlendRef.current
  const targetColors = buildCometHeadColorsForTint(tint)
  const palette = COMET_TINT_PALETTES[tint]

  for (const pts of [headPts, headGlowPts]) {
    if (!pts) continue
    const colAttr = pts.geometry.attributes.color as THREE.BufferAttribute
    const colArr = colAttr.array as Float32Array
    for (let i = 0; i < colArr.length; i++) {
      colArr[i] = baseColors[i] + (targetColors[i] - baseColors[i]) * b
    }
    colAttr.needsUpdate = true
  }

  return palette
}

function applyCometTailTintBlend(
  trailPts: THREE.Points | null,
  tint: CometHoverTint,
  blend: number,
  tailTpl: CometTailTemplate,
  scatterActive: boolean,
  tailReformU: Float32Array,
  tailAlpha: number,
): void {
  if (!trailPts || blend < 0.001) return
  const colAttr = trailPts.geometry.attributes.color as THREE.BufferAttribute
  const colArr = colAttr.array as Float32Array
  const def = COMET_TINT_PALETTES.default.tail
  const tgt = COMET_TINT_PALETTES[tint].tail
  const { alongT } = tailTpl
  for (let i = 0; i < COMET_TAIL_COUNT; i++) {
    const i3 = i * 3
    const t = alongT[i]
    const hot = scatterActive && tailReformU[i] <= 0
      ? 0.82
      : (1 - t) * tailAlpha
    const dr = def[0] + hot * 0.08
    const dg = def[1] + hot * 0.38
    const db = def[2] + hot * 0.14
    const tr = tgt[0] + hot * 0.08
    const tg = tgt[1] + hot * 0.38
    const tb = tgt[2] + hot * 0.14
    colArr[i3]     = dr + (tr - dr) * blend
    colArr[i3 + 1] = dg + (tg - dg) * blend
    colArr[i3 + 2] = db + (tb - db) * blend
  }
  colAttr.needsUpdate = true
}

interface CometTailTemplate {
  alongT: Float32Array
  lateral: Float32Array
}

function buildCometTailTemplate(): CometTailTemplate {
  const alongT = new Float32Array(COMET_TAIL_COUNT)
  const lateral = new Float32Array(COMET_TAIL_COUNT)

  for (let i = 0; i < COMET_TAIL_COUNT; i++) {
    alongT[i] = (i + 0.5) / COMET_TAIL_COUNT
    lateral[i] = Math.random() * 2 - 1
  }
  return { alongT, lateral }
}

interface ParticleOrbit {
  center: Float32Array
  axisU: Float32Array
  axisV: Float32Array
  radiusX: Float32Array
  radiusY: Float32Array
  speed: Float32Array
  phase: Float32Array
  wobbleAmp: Float32Array
  wobbleFreq: Float32Array
  wobblePhase: Float32Array
  fearBias: Float32Array
  curiousBias: Float32Array
  driftAxisU: Float32Array
  driftAxisV: Float32Array
  driftAxisN: Float32Array
  driftR: Float32Array
  driftSpeed: Float32Array
  driftPhase: Float32Array
  tumbleSx: Float32Array
  tumbleSy: Float32Array
  tumbleSz: Float32Array
}


function buildImpactLead(from: Float32Array): Float32Array {
  const lead = new Float32Array(POINT_COUNT)
  for (let i = 0; i < POINT_COUNT; i++) {
    const i3 = i * 3
    const fx = from[i3]
    const fy = from[i3 + 1]
    const fz = from[i3 + 2]
    const dist = Math.hypot(fx - IMPACT.x, fy - IMPACT.y, fz - IMPACT.z)
    lead[i] = Math.exp(-dist / (SPHERE_RADIUS * 0.18))
  }
  return lead
}

function craterBlastDir(fx: number, fy: number, fz: number, i: number): { x: number; y: number; z: number } {
  const ejectNX = METEOR_EJECT_X / METEOR_EJECT_LEN
  const ejectNY = METEOR_EJECT_Y / METEOR_EJECT_LEN

  let rx = fx - IMPACT.x
  let ry = fy - IMPACT.y
  let rz = fz - IMPACT.z
  let len = Math.hypot(rx, ry, rz)

  if (len < 1e-5) {
    const a = hash01(i, 8) * Math.PI * 2
    const pitch = (hash01(i, 9) - 0.25) * Math.PI * 0.62
    rx = Math.cos(a) * Math.cos(pitch)
    ry = Math.sin(pitch)
    rz = Math.sin(a) * Math.cos(pitch)
    len = Math.hypot(rx, ry, rz) || 1
  }

  const rnx = rx / len
  const rny = ry / len
  const rnz = rz / len

  let ox = rnx * 0.76 + ejectNX * 0.24
  let oy = rny * 0.76 + ejectNY * 0.24
  let oz = rnz * 0.90
  ox += (hash01(i, 11) - 0.5) * 0.40
  oy += (hash01(i, 12) - 0.5) * 0.40
  oz += (hash01(i, 13) - 0.5) * 0.34
  const olen = Math.hypot(ox, oy, oz) || 1
  return { x: ox / olen, y: oy / olen, z: oz / olen }
}

function surfaceArcFromImpact(fx: number, fy: number, fz: number): number {
  const lenF = Math.hypot(fx, fy, fz) || 1
  const lenI = Math.hypot(IMPACT.x, IMPACT.y, IMPACT.z) || 1
  const cosA = Math.max(-1, Math.min(1,
    (fx / lenF) * (IMPACT.x / lenI)
    + (fy / lenF) * (IMPACT.y / lenI)
    + (fz / lenF) * (IMPACT.z / lenI),
  ))
  return Math.acos(cosA) * SPHERE_RADIUS
}

function shockWaveTravel(t: number): number {
  const c = Math.max(0, Math.min(1, t))
  const shockT = Math.pow(c, PREBURST_SHOCK_CURVE_EXP)
  const sweep = 1 - Math.pow(1 - shockT, PREBURST_SHOCK_TRAVEL_POWER)
  return sweep * (0.82 + shockT * 0.18)
}

function shockRingStrength(arcLen: number, waveR: number, width: number): number {
  const d = arcLen - waveR
  return Math.exp(-(d * d) / (width * width * 0.40))
}

function applyPreburstShockwave(
  base: Float32Array,
  from: Float32Array,
  lead: Float32Array,
  startT: Float32Array,
  detonateU: number,
  waveTravelU: number,
  time: number,
): void {
  if (waveTravelU < 0.03) return

  const width = SPHERE_RADIUS * PREBURST_SHOCK_WIDTH
  const reach = SPHERE_RADIUS * PREBURST_SHOCK_REACH
  const waveR = waveTravelU * reach
  const shockEnv = Math.sqrt(Math.max(0, detonateU))

  for (let i = 0; i < POINT_COUNT; i++) {
    const i3 = i * 3
    const fx = from[i3]
    const fy = from[i3 + 1]
    const fz = from[i3 + 2]
    const arcLen = surfaceArcFromImpact(fx, fy, fz)
    const li = lead[i]

    const hit = shockRingStrength(arcLen, waveR, width)
    if (hit < 0.012) continue

    const damp = li >= 0.03 ? (1 - li) * 0.58 : 0.88
    const dir = craterBlastDir(fx, fy, fz, i + 3100)
    const px = base[i3]
    const py = base[i3 + 1]
    const pz = base[i3 + 2]
    const plen = Math.hypot(px, py, pz) || 1
    const amp = hit * shockEnv * PREBURST_SHOCK_AMP * damp
    const shimmer = hit * Math.sin(time * 11.5 + i * 0.38) * amp * 0.28

    base[i3]     += dir.x * amp + (px / plen) * amp * 0.45 + shimmer * (hash01(i, 31) - 0.5)
    base[i3 + 1] += dir.y * amp + (py / plen) * amp * 0.45 + shimmer * (hash01(i, 32) - 0.5)
    base[i3 + 2] += dir.z * amp * 0.55 + (pz / plen) * amp * 0.28 + shimmer * (hash01(i, 33) - 0.5) * 0.6

    startT[i] = Math.min(0.38, startT[i] + hit * 0.09 * detonateU)
  }
}

function burstScatterPush(u: number): number {
  const c = Math.max(0, Math.min(1, u))
  return Math.sin(c * Math.PI) * (0.48 + c * 0.52)
}

function initCometScatterHead(
  pos: Float32Array,
  vel: Float32Array,
  headLocal: Float32Array,
  headDepthBias: Float32Array,
): void {
  const ejectNX = METEOR_EJECT_X / METEOR_EJECT_LEN
  const ejectNY = METEOR_EJECT_Y / METEOR_EJECT_LEN

  for (let i = 0; i < COMET_POINT_COUNT; i++) {
    const i3 = i * 3
    const lx = headLocal[i3]
    const ly = headLocal[i3 + 1]
    const lz = headLocal[i3 + 2]
    const h = hash01(i, 11)
    const depth = headDepthBias[i]
    const spread = 0.38 + h * 0.22

    pos[i3]     = IMPACT.x + lx * spread
    pos[i3 + 1] = IMPACT.y + ly * spread
    pos[i3 + 2] = IMPACT.z + lz * spread + (depth - 0.5) * COMET_SCATTER_Z_SPREAD * 0.14

    const dir = craterBlastDir(pos[i3], pos[i3 + 1], pos[i3 + 2], i + 5000)
    const speed = COMET_SCATTER_INIT_SPEED_MIN
      + h * (COMET_SCATTER_INIT_SPEED_MAX - COMET_SCATTER_INIT_SPEED_MIN)
    const ejectW = 0.48 + h * 0.42

    vel[i3]     = dir.x * speed + ejectNX * speed * ejectW
    vel[i3 + 1] = dir.y * speed + ejectNY * speed * ejectW
    vel[i3 + 2] = dir.z * speed * 0.82 + (depth - 0.5) * 0.42
  }
}

function initCometScatterTail(
  pos: Float32Array,
  vel: Float32Array,
  alongT: Float32Array,
  lateral: Float32Array,
): void {
  const ejectNX = METEOR_EJECT_X / METEOR_EJECT_LEN
  const ejectNY = METEOR_EJECT_Y / METEOR_EJECT_LEN

  for (let i = 0; i < COMET_TAIL_COUNT; i++) {
    const i3 = i * 3
    const t = alongT[i]
    const lat = lateral[i]
    const h = hash01(i, 21)
    const depth = hash01(i, 22)
    const perpX = -ejectNY
    const perpY = ejectNX

    pos[i3]     = IMPACT.x - ejectNX * t * COMET_RADIUS * 0.55 + perpX * lat * COMET_RADIUS * 0.32
    pos[i3 + 1] = IMPACT.y - ejectNY * t * COMET_RADIUS * 0.55 + perpY * lat * COMET_RADIUS * 0.32
    pos[i3 + 2] = IMPACT.z + (depth - 0.5) * COMET_SCATTER_Z_SPREAD * 0.12

    const dir = craterBlastDir(pos[i3], pos[i3 + 1], pos[i3 + 2], i + 9000)
    const speed = COMET_SCATTER_INIT_SPEED_MIN * (0.72 + t * 0.38)
      + h * (COMET_SCATTER_INIT_SPEED_MAX - COMET_SCATTER_INIT_SPEED_MIN) * 0.78
    const ejectW = 0.44 + h * 0.46

    vel[i3]     = dir.x * speed + ejectNX * speed * ejectW
    vel[i3 + 1] = dir.y * speed + ejectNY * speed * ejectW
    vel[i3 + 2] = dir.z * speed * 0.72 + (depth - 0.5) * 0.36
  }
}

function stepCometScatter(
  pos: Float32Array,
  vel: Float32Array,
  count: number,
  dt: number,
  exp: ExplosionState,
  burstElapsed: number,
  seedOffset: number,
  reformU?: Float32Array,
): void {
  const ejectNX = METEOR_EJECT_X / METEOR_EJECT_LEN
  const ejectNY = METEOR_EJECT_Y / METEOR_EJECT_LEN
  const drag = Math.exp(-COMET_SCATTER_DRAG * dt)

  let ax = 0
  let ay = 0
  let az = 0

  if (exp.phase === 'preburst') {
    const coast = 1 - exp.preburstU * 0.22
    ax = ejectNX * COMET_SCATTER_PREBURST_ACCEL * coast
    ay = ejectNY * COMET_SCATTER_PREBURST_ACCEL * coast
  } else if (exp.phase === 'burst') {
    const bu = Math.min(1, burstElapsed / BURST_DURATION)
    const push = burstScatterPush(bu)
    ax = ejectNX * COMET_SCATTER_BURST_ACCEL * push
    ay = ejectNY * COMET_SCATTER_BURST_ACCEL * push
    az = COMET_SCATTER_BURST_ACCEL * push * 0.06
  }

  for (let i = 0; i < count; i++) {
    if (reformU && reformU[i] > 0 && reformU[i] < 1) continue

    const i3 = i * 3
    const h = hash01(i, seedOffset)
    const partK = 0.78 + h * 0.44

    vel[i3]     = (vel[i3]     + ax * partK * dt) * drag
    vel[i3 + 1] = (vel[i3 + 1] + ay * partK * dt) * drag
    vel[i3 + 2] = (vel[i3 + 2] + az * (h - 0.5) * dt) * drag

    pos[i3]     += vel[i3] * dt
    pos[i3 + 1] += vel[i3 + 1] * dt
    pos[i3 + 2] += vel[i3 + 2] * dt
  }
}

function cometCursorMagnetStrength(dist: number): number {
  if (dist >= COMET_MAGNET_REACH) return 0
  const reachT = 1 - dist / COMET_MAGNET_REACH
  const coreT = Math.max(0, 1 - dist / COMET_MAGNET_CORE)
  const rim = smoothstep(reachT)
  const hot = Math.pow(coreT, 0.36)
  const strength = Math.pow(rim, 4.2) * 0.23 + hot * hot * 3.95
  return Math.min(COMET_MAGNET_PULL_MAX, strength)
}

function cometMagnetPullStrength(dist: number, progress: number): number {
  const field = cometCursorMagnetStrength(dist)
  if (progress <= 0) return field
  if (progress >= 1) return 0
  const latch = smoothstep(Math.min(1, progress / COMET_MAGNET_COMMIT))
  return Math.max(field, latch * 0.30)
}

function cometBurstReady(exp: ExplosionState, burstElapsed: number): boolean {
  return burstElapsed > BURST_DURATION * 0.18
    || exp.phase === 'burst'
    || exp.phase === 'reside'
}

function cometMagnetCount(reformU: Float32Array, count: number): number {
  let n = 0
  for (let i = 0; i < count; i++) {
    if (reformU[i] > 0 && reformU[i] < 1) n++
  }
  return n
}

function cometAssemblyProgress(reformU: Float32Array, count: number): number {
  let sum = 0
  for (let i = 0; i < count; i++) {
    sum += Math.min(1, Math.max(0, reformU[i]))
  }
  return sum / count
}

function cometHasMirrorParticles(reformU: Float32Array, count: number): boolean {
  for (let i = 0; i < count; i++) {
    if (reformU[i] > 0) return true
  }
  return false
}

function cometMirrorParticleCount(reformU: Float32Array, count: number): number {
  let n = 0
  for (let i = 0; i < count; i++) {
    if (reformU[i] >= COMET_MIRROR_REFORM_MIN) n++
  }
  return n
}

const _pointsLayoutProj = new THREE.Vector3()

function computePointsRightHalfRatio(
  pos: Float32Array,
  count: number,
  camera: THREE.Camera,
): number {
  let right = 0
  for (let i = 0; i < count; i++) {
    const i3 = i * 3
    _pointsLayoutProj.set(pos[i3], pos[i3 + 1], pos[i3 + 2]).project(camera)
    if (_pointsLayoutProj.x > 0) right++
  }
  return right / count
}

function burstEase(t: number): number {
  const c = Math.max(0, Math.min(1, t))
  return 0.08 + (1 - Math.pow(1 - c, 3.5)) * 0.92
}

function initExplosionLayout(spherePos: Float32Array): ParticleOrbit {
  const center = new Float32Array(POINT_COUNT * 3)
  const axisU = new Float32Array(POINT_COUNT * 3)
  const axisV = new Float32Array(POINT_COUNT * 3)
  const radiusX = new Float32Array(POINT_COUNT)
  const radiusY = new Float32Array(POINT_COUNT)
  const speed = new Float32Array(POINT_COUNT)
  const phase = new Float32Array(POINT_COUNT)
  const wobbleAmp = new Float32Array(POINT_COUNT)
  const wobbleFreq = new Float32Array(POINT_COUNT)
  const wobblePhase = new Float32Array(POINT_COUNT)
  const fearBias = new Float32Array(POINT_COUNT)
  const curiousBias = new Float32Array(POINT_COUNT)
  const driftAxisU = new Float32Array(POINT_COUNT * 3)
  const driftAxisV = new Float32Array(POINT_COUNT * 3)
  const driftAxisN = new Float32Array(POINT_COUNT * 3)
  const driftR = new Float32Array(POINT_COUNT)
  const driftSpeed = new Float32Array(POINT_COUNT)
  const driftPhase = new Float32Array(POINT_COUNT)
  const tumbleSx = new Float32Array(POINT_COUNT)
  const tumbleSy = new Float32Array(POINT_COUNT)
  const tumbleSz = new Float32Array(POINT_COUNT)

  const dir = new THREE.Vector3()
  const jitter = new THREE.Vector3()
  const u = new THREE.Vector3()
  const v = new THREE.Vector3()
  const n = new THREE.Vector3()
  const du = new THREE.Vector3()
  const dv = new THREE.Vector3()
  const dn = new THREE.Vector3()

  for (let i = 0; i < POINT_COUNT; i++) {
    const i3 = i * 3
    const px = spherePos[i3]
    const py = spherePos[i3 + 1]
    const pz = spherePos[i3 + 2]
    const surfaceLen = Math.hypot(px, py, pz) || 1

    dir.set(px / surfaceLen, py / surfaceLen, pz / surfaceLen)
    jitter.set(
      (Math.random() - 0.5) * 0.55,
      (Math.random() - 0.5) * 0.55,
      (Math.random() - 0.5) * 0.55,
    )
    dir.add(jitter).normalize()

    const dist = SCATTER_MIN_R + Math.random() * (SCATTER_MAX_R - SCATTER_MIN_R)
    center[i3]     = dir.x * dist
    center[i3 + 1] = dir.y * dist
    center[i3 + 2] = dir.z * dist

    n.copy(dir)
    u.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5)
    u.addScaledVector(n, -u.dot(n))
    if (u.lengthSq() < 1e-6) u.set(0, 1, 0).addScaledVector(n, -n.y)
    u.normalize()
    v.crossVectors(n, u).normalize()

    axisU[i3]     = u.x; axisU[i3 + 1] = u.y; axisU[i3 + 2] = u.z
    axisV[i3]     = v.x; axisV[i3 + 1] = v.y; axisV[i3 + 2] = v.z

    const r = 0.012 + Math.random() * 0.095
    radiusX[i] = r
    radiusY[i] = r * (0.42 + Math.random() * 0.95)
    speed[i] = (Math.random() < 0.5 ? -1 : 1) * (1.1 + Math.random() * 2.8)
    phase[i] = Math.random() * Math.PI * 2
    wobbleAmp[i] = 0.004 + Math.random() * 0.028
    wobbleFreq[i] = 2.4 + Math.random() * 4.6
    wobblePhase[i] = Math.random() * Math.PI * 2
    fearBias[i] = 0.62 + Math.random() * 0.76
    curiousBias[i] = 0.62 + Math.random() * 0.76

    du.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize()
    dn.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize()
    dv.crossVectors(du, dn)
    if (dv.lengthSq() < 1e-6) dv.set(0, 0, 1)
    dv.normalize()
    dn.crossVectors(du, dv).normalize()

    driftAxisU[i3]     = du.x; driftAxisU[i3 + 1] = du.y; driftAxisU[i3 + 2] = du.z
    driftAxisV[i3]     = dv.x; driftAxisV[i3 + 1] = dv.y; driftAxisV[i3 + 2] = dv.z
    driftAxisN[i3]     = dn.x; driftAxisN[i3 + 1] = dn.y; driftAxisN[i3 + 2] = dn.z
    driftR[i] = SPHERE_DRIFT_R_MIN + Math.random() * (SPHERE_DRIFT_R_MAX - SPHERE_DRIFT_R_MIN)
    driftSpeed[i] = (Math.random() < 0.5 ? -1 : 1)
      * (SPHERE_DRIFT_SPEED_MIN + Math.random() * (SPHERE_DRIFT_SPEED_MAX - SPHERE_DRIFT_SPEED_MIN))
    driftPhase[i] = Math.random() * Math.PI * 2

    const tumbleMode = Math.floor(Math.random() * 4)
    const tumbleSp = (Math.random() < 0.5 ? -1 : 1)
      * (CIRCLE_TUMBLE_MIN + Math.random() * (CIRCLE_TUMBLE_MAX - CIRCLE_TUMBLE_MIN))
    tumbleSx[i] = 0
    tumbleSy[i] = 0
    tumbleSz[i] = 0
    if (tumbleMode === 0) tumbleSy[i] = tumbleSp
    else if (tumbleMode === 1) tumbleSx[i] = tumbleSp
    else if (tumbleMode === 2) tumbleSz[i] = tumbleSp
    else {
      tumbleSx[i] = tumbleSp * 0.62
      tumbleSy[i] = (Math.random() < 0.5 ? -1 : 1) * tumbleSp * 0.52
    }
  }

  return {
    center, axisU, axisV, radiusX, radiusY, speed, phase,
    wobbleAmp, wobbleFreq, wobblePhase, fearBias, curiousBias,
    driftAxisU, driftAxisV, driftAxisN, driftR, driftSpeed, driftPhase,
    tumbleSx, tumbleSy, tumbleSz,
  }
}

function tumbleOrbitOffset(
  ox: number, oy: number, oz: number,
  sx: number, sy: number, sz: number,
  time: number,
): [number, number, number] {
  if (sx !== 0) {
    const a = sx * time
    const ca = Math.cos(a)
    const sa = Math.sin(a)
    const ny = oy * ca - oz * sa
    oz = oy * sa + oz * ca
    oy = ny
  }
  if (sy !== 0) {
    const a = sy * time
    const ca = Math.cos(a)
    const sa = Math.sin(a)
    const nx = ox * ca + oz * sa
    oz = -ox * sa + oz * ca
    ox = nx
  }
  if (sz !== 0) {
    const a = sz * time
    const ca = Math.cos(a)
    const sa = Math.sin(a)
    const nx = ox * ca - oy * sa
    oy = ox * sa + oy * ca
    ox = nx
  }
  return [ox, oy, oz]
}

function fillDriftingCenters(o: ParticleOrbit, time: number, out: Float32Array): void {
  const {
    center, driftAxisU, driftAxisV, driftAxisN, driftR, driftSpeed, driftPhase,
  } = o

  for (let i = 0; i < POINT_COUNT; i++) {
    const i3 = i * 3
    const t = driftSpeed[i] * time + driftPhase[i]
    const t2 = driftSpeed[i] * 0.71 * time + driftPhase[i] * 1.65
    const r = driftR[i]
    const c = Math.cos(t)
    const s = Math.sin(t)
    const n = Math.sin(t2) * 0.62

    out[i3]     = center[i3]     + driftAxisU[i3]     * c * r + driftAxisV[i3]     * s * r + driftAxisN[i3]     * n * r
    out[i3 + 1] = center[i3 + 1] + driftAxisU[i3 + 1] * c * r + driftAxisV[i3 + 1] * s * r + driftAxisN[i3 + 1] * n * r
    out[i3 + 2] = center[i3 + 2] + driftAxisU[i3 + 2] * c * r + driftAxisV[i3 + 2] * s * r + driftAxisN[i3 + 2] * n * r
  }
}

function rotateMassInPlace(
  arr: Float32Array,
  ax: number,
  ay: number,
  az: number,
): void {
  if (ax === 0 && ay === 0 && az === 0) return

  const cy = Math.cos(ay)
  const sy = Math.sin(ay)
  const cx = Math.cos(ax)
  const sx = Math.sin(ax)
  const cz = Math.cos(az)
  const sz = Math.sin(az)

  for (let i = 0; i < POINT_COUNT; i++) {
    const i3 = i * 3
    let x = arr[i3]
    let y = arr[i3 + 1]
    let z = arr[i3 + 2]

    if (ay !== 0) {
      const nx = x * cy + z * sy
      const nz = -x * sy + z * cy
      x = nx
      z = nz
    }
    if (ax !== 0) {
      const ny = y * cx - z * sx
      const nz = y * sx + z * cx
      y = ny
      z = nz
    }
    if (az !== 0) {
      const nx = x * cz - y * sz
      const ny = x * sz + y * cz
      x = nx
      y = ny
    }

    arr[i3] = x
    arr[i3 + 1] = y
    arr[i3 + 2] = z
  }
}

const _cometProj = new THREE.Vector3()
const _baseProj = new THREE.Vector3()
const _posProj = new THREE.Vector3()
const _sphereRotQ = new THREE.Quaternion()
const _sphereRotV = new THREE.Vector3()
const _sphereRotE = new THREE.Euler(0, 0, 0, 'XYZ')

function fillRotatedSphereBase(
  spherePos: Float32Array,
  rotX: number,
  rotY: number,
  out: Float32Array,
): void {
  _sphereRotE.set(rotX, rotY, 0)
  _sphereRotQ.setFromEuler(_sphereRotE)
  for (let i = 0; i < POINT_COUNT; i++) {
    const i3 = i * 3
    _sphereRotV.set(spherePos[i3], spherePos[i3 + 1], spherePos[i3 + 2]).applyQuaternion(_sphereRotQ)
    out[i3] = _sphereRotV.x
    out[i3 + 1] = _sphereRotV.y
    out[i3 + 2] = _sphereRotV.z
  }
}

function ndcDeltaToWorldXY(
  ndcDx: number,
  ndcDy: number,
  camera: THREE.PerspectiveCamera,
  refZ: number,
): { x: number; y: number } {
  const dist = camera.position.z - refZ
  const halfTan = Math.tan((camera.fov * Math.PI / 180) / 2)
  return {
    x: ndcDx * halfTan * dist * camera.aspect,
    y: ndcDy * halfTan * dist,
  }
}

function clampDispMag(i3: number, disp: Float32Array): void {
  const dm = Math.hypot(disp[i3], disp[i3 + 1])
  if (dm > COMET_MAX_DISP) {
    const s = COMET_MAX_DISP / dm
    disp[i3] *= s
    disp[i3 + 1] *= s
  }
}

function applyCometReaction(
  pos: Float32Array,
  base: Float32Array,
  disp: Float32Array,
  vel: Float32Array,
  fearBias: Float32Array,
  comet: THREE.Vector3,
  cometVel: THREE.Vector3,
  camera: THREE.Camera,
  delta: number,
): void {
  const persp = camera as THREE.PerspectiveCamera
  const cx = comet.x
  const cy = comet.y
  const forceDamp = Math.exp(-COMET_FORCE_DAMP * delta)
  const velDamp = Math.exp(-COMET_VEL_DAMP * delta)

  const cometSpeed = Math.hypot(cometVel.x, cometVel.y, cometVel.z)
  const speedNorm = Math.min(1, cometSpeed / COMET_SPEED_FULL)
  const wakeActive = speedNorm > COMET_WAKE_SPEED_THRESH
  const moveLen = cometSpeed
  let moveNX = 0
  let moveNY = 0
  if (moveLen > 1e-7) {
    moveNX = cometVel.x / moveLen
    moveNY = cometVel.y / moveLen
  }

  _cometProj.set(cx, cy, comet.z).project(camera)
  const cometNdcX = _cometProj.x
  const cometNdcY = _cometProj.y
  for (let i = 0; i < POINT_COUNT; i++) {
    const i3 = i * 3
    const bx = base[i3]
    const by = base[i3 + 1]
    const bz = base[i3 + 2]

    _baseProj.set(bx, by, bz).project(camera)
    const screenDistBase = Math.hypot(_baseProj.x - cometNdcX, _baseProj.y - cometNdcY)
    const edgeBand = COMET_SCREEN_INFLUENCE_R * 0.22
    const gateT = screenDistBase < COMET_SCREEN_INFLUENCE_R
      ? Math.min(1, (COMET_SCREEN_INFLUENCE_R - screenDistBase) / edgeBand)
      : 0
    const affected = gateT > 0

    const px = bx + disp[i3]
    const py = by + disp[i3 + 1]
    _posProj.set(px, py, bz).project(camera)
    const screenDistPos = Math.hypot(_posProj.x - cometNdcX, _posProj.y - cometNdcY)
    const cometStillHere = screenDistBase < COMET_SCREEN_INFLUENCE_R
      || screenDistPos < COMET_SCREEN_INFLUENCE_R

    const rx = px - cx
    const ry = py - cy
    const distXY = Math.hypot(rx, ry) + 1e-5

    let awayX = rx / distXY
    let awayY = ry / distXY
    if (screenDistBase > 1e-4) {
      const w = ndcDeltaToWorldXY(
        _baseProj.x - cometNdcX,
        _baseProj.y - cometNdcY,
        persp,
        bz,
      )
      const wLen = Math.hypot(w.x, w.y) + 1e-5
      awayX = w.x / wLen
      awayY = w.y / wLen
    }

    let forceX = 0
    let forceY = 0
    let maxVel = COMET_REPULSE_MAX_VEL

    if (affected) {
      const bias = fearBias[i]
      const react = 0.5 + bias * 0.5

      if (wakeActive && moveLen > 1e-7) {
        const bxRel = bx - cx
        const byRel = by - cy
        const forward = bxRel * moveNX + byRel * moveNY
        if (forward > -COMET_FEAR_BUBBLE_R * 0.55) {
          const sideX = bxRel - forward * moveNX
          const sideY = byRel - forward * moveNY
          const sideDist = Math.hypot(sideX, sideY)
          let sideNX: number
          let sideNY: number
          if (sideDist > 1e-4) {
            sideNX = sideX / sideDist
            sideNY = sideY / sideDist
          } else {
            sideNX = -moveNY
            sideNY = moveNX
            if (bias < 1) { sideNX = -sideNX; sideNY = -sideNY }
          }
          const pathProx = Math.exp(-sideDist / COMET_PLOW_PATH_W)
          const wakeScale = pathProx * speedNorm * gateT * react

          const lateralPlow = COMET_PLOW_K * wakeScale
          forceX += sideNX * lateralPlow
          forceY += sideNY * lateralPlow

          if (forward > -COMET_FEAR_BUBBLE_R * 0.25) {
            const fwdStrength = forward > 0
              ? 0.44 + Math.exp(-sideDist / (COMET_PLOW_PATH_W * 0.48)) * 0.56
              : Math.max(0, 0.14 * Math.exp(forward / (COMET_FEAR_BUBBLE_R * 0.58)))
            const bowForward = COMET_BOW_FORWARD_K * wakeScale * fwdStrength
            forceX += moveNX * bowForward
            forceY += moveNY * bowForward

            if (forward > 0 && sideDist > 1e-4) {
              const vPush = COMET_BOW_V_K * wakeScale
                * Math.min(1, forward / (COMET_FEAR_BUBBLE_R * 1.15))
              forceX += (moveNX * 0.55 + sideNX * 0.72) * vPush
              forceY += (moveNY * 0.55 + sideNY * 0.72) * vPush
            }
          }

          if (distXY < COMET_FEAR_REACH) {
            const aheadT = Math.min(
              1,
              (forward + COMET_FEAR_BUBBLE_R * 0.35) / (COMET_FEAR_BUBBLE_R * 2.8),
            )
            const passProx = pathProx * Math.max(0, aheadT) * speedNorm
            const pass = COMET_PASS_K * passProx * react * gateT
              / (distXY + COMET_FEAR_BUBBLE_R * 0.2)
            forceX += awayX * pass
            forceY += awayY * pass
          }
        }
        maxVel = COMET_WAKE_MAX_VEL
      } else if (!wakeActive && distXY < COMET_FEAR_REACH) {
        const prox = Math.max(0, 1 - distXY / COMET_FEAR_REACH)
        const rep = COMET_FEAR_K * prox * prox * react * gateT
          / (distXY + COMET_FEAR_BUBBLE_R * 0.2)
        forceX += awayX * rep
        forceY += awayY * rep
      }

      if (distXY < COMET_RADIUS * 1.28) {
        const pen = Math.max(0, 1 - distXY / (COMET_RADIUS * 1.28))
        const sep = COMET_SEP_K * pen * pen * gateT
        forceX += awayX * sep
        forceY += awayY * sep
      }
    }

    if (!cometStillHere) {
      forceX += -disp[i3]     * COMET_RETURN_SPRING
      forceY += -disp[i3 + 1] * COMET_RETURN_SPRING
    }

    let vx = vel[i3]     + forceX * delta
    let vy = vel[i3 + 1] + forceY * delta

    if (!cometStillHere) {
      vx *= velDamp
      vy *= velDamp
    }

    const vMag = Math.hypot(vx, vy)
    if (vMag > maxVel) {
      const s = maxVel / vMag
      vx *= s
      vy *= s
    }

    vel[i3]     = vx * forceDamp
    vel[i3 + 1] = vy * forceDamp
    vel[i3 + 2] = 0

    disp[i3]     += vel[i3] * delta
    disp[i3 + 1] += vel[i3 + 1] * delta
    disp[i3 + 2] = 0

    clampDispMag(i3, disp)

    pos[i3]     = bx + disp[i3]
    pos[i3 + 1] = by + disp[i3 + 1]
    pos[i3 + 2] = bz
  }
}

function fillOrbitBase(o: ParticleOrbit, time: number, live: Float32Array, base: Float32Array): void {
  fillDriftingCenters(o, time, live)
  const {
    axisU, axisV, radiusX, radiusY, speed, phase,
    wobbleAmp, wobbleFreq, wobblePhase,
    tumbleSx, tumbleSy, tumbleSz,
  } = o
  for (let i = 0; i < POINT_COUNT; i++) {
    const i3 = i * 3
    const ang = phase[i] + speed[i] * time
    const c = Math.cos(ang)
    const s = Math.sin(ang)
    const rx = radiusX[i]
    const ry = radiusY[i]
    const wob = wobbleAmp[i] * Math.sin(wobbleFreq[i] * time + wobblePhase[i])
    const wob2 = wobbleAmp[i] * 0.55 * Math.sin(wobbleFreq[i] * 1.7 * time + phase[i] * 2.1)
    let ox = axisU[i3]     * (c * rx + wob) + axisV[i3]     * (s * ry + wob2)
    let oy = axisU[i3 + 1] * (c * rx + wob) + axisV[i3 + 1] * (s * ry + wob2)
    let oz = axisU[i3 + 2] * (c * rx + wob) + axisV[i3 + 2] * (s * ry + wob2)
    ;[ox, oy, oz] = tumbleOrbitOffset(ox, oy, oz, tumbleSx[i], tumbleSy[i], tumbleSz[i], time)
    base[i3]     = live[i3] + ox
    base[i3 + 1] = live[i3 + 1] + oy
    base[i3 + 2] = live[i3 + 2] + oz
  }
}

interface ResideLayout {
  morphSeed: Float32Array
  localAng: Float32Array
  localR: Float32Array
  wobblePhase: Float32Array
}

function createResideLayout(): ResideLayout {
  return {
    morphSeed: new Float32Array(POINT_COUNT),
    localAng: new Float32Array(POINT_COUNT),
    localR: new Float32Array(POINT_COUNT),
    wobblePhase: new Float32Array(POINT_COUNT),
  }
}

function initResideLayout(layout: ResideLayout): void {
  for (let i = 0; i < POINT_COUNT; i++) {
    layout.morphSeed[i] = hash01(i, 1)
    layout.localAng[i] = hash01(i, 2) * Math.PI * 2
    layout.localR[i] = 0.034 + hash01(i, 3) * 0.088
    layout.wobblePhase[i] = hash01(i, 4) * Math.PI * 2
  }
}

function organicWarp(x: number, y: number, t: number, seed: number): { x: number; y: number } {
  const w1 = Math.sin(x * 3.2 + seed + t * 0.48) * 0.042
  const w2 = Math.cos(y * 2.8 + seed * 1.7 + t * 0.39) * 0.038
  const w3 = Math.sin((x * 0.7 + y * 1.3) * 2.1 + t * 0.31) * 0.032
  return { x: x + w1 + w3, y: y + w2 - w3 * 0.55 }
}

interface GlyphSample { x: number; y: number; z: number }

function sampleGlyphStroke(
  x0: number, y0: number, x1: number, y1: number,
  count: number, strokeWidth: number, seed: number,
): GlyphSample[] {
  const out: GlyphSample[] = []
  const dx = x1 - x0
  const dy = y1 - y0
  const len = Math.hypot(dx, dy) || 1
  const nx = -dy / len
  const ny = dx / len
  for (let i = 0; i < count; i++) {
    const t = (i + hash01(i, seed)) / count
    const x = x0 + dx * t
    const y = y0 + dy * t
    const thick = (hash01(i, seed + 1) - 0.5) * strokeWidth
    const jx = (hash01(i, seed + 2) - 0.5) * strokeWidth * 0.42
    const jy = (hash01(i, seed + 3) - 0.5) * strokeWidth * 0.42
    const z = (hash01(i, seed + 4) - 0.5) * strokeWidth * 2.1
      + Math.sin(t * Math.PI * 2 + hash01(i, seed + 5) * 0.8) * strokeWidth * 0.55
    out.push({
      x: x + nx * thick + jx,
      y: y + ny * thick + jy,
      z,
    })
  }
  return out
}

function buildVPlusGlyphSamples(): GlyphSample[] {
  const samples: GlyphSample[] = []
  const push = (...args: Parameters<typeof sampleGlyphStroke>) => {
    samples.push(...sampleGlyphStroke(...args))
  }
  // V — left and right strokes
  push(-0.47, 0.30, -0.25, -0.30, 920, 0.048, 201)
  push(-0.03, 0.30, -0.25, -0.30, 920, 0.048, 211)
  // + — horizontal and vertical bars
  push(0.08, 0.0, 0.42, 0.0, 580, 0.040, 221)
  push(0.25, 0.15, 0.25, -0.15, 580, 0.040, 231)
  return samples
}

function sampleRectPerimeter(
  left: number,
  bottom: number,
  right: number,
  top: number,
  count: number,
  strokeWidth: number,
  seed: number,
): GlyphSample[] {
  const w = right - left
  const h = top - bottom
  const perim = 2 * (w + h)
  const out: GlyphSample[] = []
  for (let i = 0; i < count; i++) {
    const u = ((i + hash01(i, seed)) / count) * perim
    let x = 0
    let y = 0
    if (u < w) {
      x = left + u
      y = top
    } else if (u < w + h) {
      x = right
      y = top - (u - w)
    } else if (u < 2 * w + h) {
      x = right - (u - w - h)
      y = bottom
    } else {
      x = left
      y = bottom + (u - 2 * w - h)
    }
    const jx = (hash01(i, seed + 1) - 0.5) * strokeWidth * 0.38
    const jy = (hash01(i, seed + 2) - 0.5) * strokeWidth * 0.38
    const z = (hash01(i, seed + 3) - 0.5) * strokeWidth * 1.8
      + Math.sin(u * 0.42 + hash01(i, seed + 4) * 0.7) * strokeWidth * 0.45
    out.push({ x: x + jx, y: y + jy, z })
  }
  return out
}

function buildDeviceGlyphSamples(shape: ServiceShape): GlyphSample[] {
  const samples: GlyphSample[] = []
  const pushStroke = (...args: Parameters<typeof sampleGlyphStroke>) => {
    samples.push(...sampleGlyphStroke(...args))
  }
  const pushRect = (...args: Parameters<typeof sampleRectPerimeter>) => {
    samples.push(...sampleRectPerimeter(...args))
  }

  switch (shape) {
    case 'video': {
      // Телевизор: рамка + пустой экран + подставка
      pushRect(-0.54, -0.22, 0.54, 0.40, 880, 0.046, 301)
      pushRect(-0.40, 0.00, 0.40, 0.30, 640, 0.036, 311)
      pushStroke(-0.14, -0.22, -0.08, -0.34, 90, 0.028, 321)
      pushStroke(0.08, -0.22, 0.14, -0.34, 90, 0.028, 322)
      pushStroke(-0.08, -0.34, 0.08, -0.34, 70, 0.024, 323)
      break
    }
    case 'site': {
      // Браузер: окно + панель вкладок + пустая область
      pushRect(-0.54, -0.30, 0.54, 0.40, 900, 0.044, 331)
      pushStroke(-0.54, 0.24, 0.54, 0.24, 480, 0.034, 341)
      pushStroke(-0.46, 0.30, -0.38, 0.30, 50, 0.020, 351)
      pushStroke(-0.30, 0.30, -0.22, 0.30, 50, 0.020, 352)
      pushStroke(-0.14, 0.30, -0.06, 0.30, 50, 0.020, 353)
      pushRect(-0.48, -0.24, 0.48, 0.18, 520, 0.030, 361)
      break
    }
    case 'app': {
      // Смартфон: корпус + рамка экрана + 3D-грани + вырез + home-bar
      pushRect(-0.21, -0.48, 0.21, 0.48, 1040, 0.030, 371)
      pushRect(-0.17, -0.10, 0.17, 0.42, 780, 0.024, 381)
      pushStroke(0.21, -0.44, 0.30, 0.44, 160, 0.020, 393)
      pushStroke(-0.21, -0.44, -0.30, 0.44, 160, 0.020, 394)
      pushStroke(0.18, 0.46, 0.26, 0.46, 80, 0.014, 395)
      pushStroke(-0.18, 0.46, -0.26, 0.46, 80, 0.014, 396)
      pushRect(-0.05, -0.44, 0.05, -0.40, 44, 0.012, 392)
      pushStroke(-0.06, -0.38, 0.06, -0.38, 56, 0.010, 397)
      break
    }
    case 'business': {
      // Ноутбук: экран + клавиатура + петля
      pushRect(-0.48, 0.08, 0.48, 0.42, 700, 0.040, 401)
      pushRect(-0.40, 0.14, 0.40, 0.36, 480, 0.028, 411)
      pushRect(-0.52, -0.36, 0.52, 0.04, 760, 0.042, 421)
      pushStroke(-0.52, 0.04, 0.52, 0.04, 400, 0.030, 431)
      pushStroke(-0.10, 0.04, 0.10, -0.36, 100, 0.022, 432)
      break
    }
  }
  return samples
}

function sampleRectPerimeterClean(
  left: number,
  bottom: number,
  right: number,
  top: number,
  count: number,
): GlyphSample[] {
  const w = right - left
  const h = top - bottom
  const perim = 2 * (w + h)
  const out: GlyphSample[] = []
  for (let i = 0; i < count; i++) {
    const u = ((i + 0.5) / count) * perim
    let x = 0
    let y = 0
    if (u < w) {
      x = left + u
      y = top
    } else if (u < w + h) {
      x = right
      y = top - (u - w)
    } else if (u < 2 * w + h) {
      x = right - (u - w - h)
      y = bottom
    } else {
      x = left
      y = bottom + (u - 2 * w - h)
    }
    out.push({ x, y, z: 0 })
  }
  return out
}

function sampleGlyphStrokeClean(
  x0: number, y0: number, x1: number, y1: number,
  count: number,
): GlyphSample[] {
  const out: GlyphSample[] = []
  const dx = x1 - x0
  const dy = y1 - y0
  for (let i = 0; i < count; i++) {
    const t = (i + 0.5) / count
    out.push({ x: x0 + dx * t, y: y0 + dy * t, z: 0 })
  }
  return out
}

function copyGlyphSamplesToPath(
  path: Float32Array,
  startIdx: number,
  samples: GlyphSample[],
  count: number,
): number {
  for (let j = 0; j < count; j++) {
    const src = Math.min(samples.length - 1, j)
    const dst = (startIdx + j) * 3
    path[dst]     = samples[src].x
    path[dst + 1] = samples[src].y
    path[dst + 2] = samples[src].z
  }
  return startIdx + count
}

function buildAppPhoneOrderedPath(): Float32Array {
  const path = new Float32Array(POINT_COUNT * 3)
  let idx = 0
  idx = copyGlyphSamplesToPath(
    path, idx, sampleRectPerimeterClean(-0.21, -0.48, 0.21, 0.48, 3600), 3600,
  )
  idx = copyGlyphSamplesToPath(
    path, idx, sampleRectPerimeterClean(-0.17, -0.10, 0.17, 0.42, 2800), 2800,
  )
  idx = copyGlyphSamplesToPath(
    path, idx, sampleGlyphStrokeClean(0.21, -0.44, 0.30, 0.44, 480), 480,
  )
  idx = copyGlyphSamplesToPath(
    path, idx, sampleGlyphStrokeClean(-0.21, -0.44, -0.30, 0.44, 480), 480,
  )
  idx = copyGlyphSamplesToPath(
    path, idx, sampleGlyphStrokeClean(0.18, 0.46, 0.26, 0.46, 240), 240,
  )
  idx = copyGlyphSamplesToPath(
    path, idx, sampleGlyphStrokeClean(-0.18, 0.46, -0.26, 0.46, 240), 240,
  )
  idx = copyGlyphSamplesToPath(
    path, idx, sampleRectPerimeterClean(-0.05, -0.44, 0.05, -0.40, 120), 120,
  )
  idx = copyGlyphSamplesToPath(
    path, idx, sampleGlyphStrokeClean(-0.06, -0.38, 0.06, -0.38, 40), 40,
  )
  return path
}

const APP_PHONE_LOCAL_PATH = buildAppPhoneOrderedPath()
const VPLUS_GLYPH_SAMPLES = buildVPlusGlyphSamples()
const DEVICE_GLYPH_SAMPLES: Record<ServiceShape, GlyphSample[]> = {
  video: buildDeviceGlyphSamples('video'),
  site: buildDeviceGlyphSamples('site'),
  app: buildDeviceGlyphSamples('app'),
  business: buildDeviceGlyphSamples('business'),
}

function glyphVisionFromSamples(
  samples: GlyphSample[],
  s: number,
  t: number,
): { ox: number; oy: number; oz: number } {
  const n = samples.length
  const idx = Math.min(n - 1, Math.floor(s * n))
  const sample = samples[idx]
  const breathe = 1 + Math.sin(t * 0.42) * 0.038
  const flutterX = Math.sin(s * 47.3 + t * 0.78) * 0.011
  const flutterY = Math.cos(s * 39.1 + t * 0.71) * 0.009
  const warped = organicWarp(sample.x * breathe, sample.y * breathe, t, s * 3.17)
  const oz = sample.z * breathe + Math.sin(t * 0.55 + s * 12.4) * 0.016
  return {
    ox: warped.x + flutterX,
    oy: warped.y + flutterY,
    oz: oz * RESIDE_VPLUS_Z_SCALE,
  }
}

function glyphVisionVPlus(s: number, t: number): { ox: number; oy: number; oz: number } {
  return glyphVisionFromSamples(VPLUS_GLYPH_SAMPLES, s, t)
}

function glyphVisionDevice(
  particleIdx: number,
  seed: number,
  t: number,
  shape: ServiceShape,
  slot: number,
): { ox: number; oy: number; oz: number } {
  const samples = DEVICE_GLYPH_SAMPLES[shape]
  const n = samples.length
  const idx = ((slot + Math.floor(seed * 17)) % n + n) % n
  const sample = samples[idx]
  const buildFlutter = (1 - Math.min(1, Math.sin(t * 0.55 + particleIdx * 0.02) * 0.5 + 0.5)) * 0.016
  const breathe = 1 + Math.sin(t * 0.42) * 0.018
  const flutterX = Math.sin(particleIdx * 0.71 + t * 2.8) * buildFlutter
  const flutterY = Math.cos(particleIdx * 0.63 + t * 2.4) * buildFlutter
  const sx = sample.x * DEVICE_GLYPH_SCALE
  const sy = sample.y * DEVICE_GLYPH_SCALE
  const warped = organicWarp(sx * breathe, sy * breathe, t, seed * 3.17)
  const oz = sample.z * breathe + Math.sin(t * 0.55 + seed * 12.4) * 0.018
  return {
    ox: warped.x + flutterX,
    oy: warped.y + flutterY,
    oz: oz * RESIDE_VPLUS_Z_SCALE,
  }
}

function rotatePhone3D(
  x: number, y: number, z: number,
  rotY: number, rotX: number,
): { x: number; y: number; z: number } {
  const cy = Math.cos(rotY)
  const sy = Math.sin(rotY)
  const x1 = x * cy + z * sy
  const z1 = -x * sy + z * cy
  const cx = Math.cos(rotX)
  const sx = Math.sin(rotX)
  const y2 = y * cx - z1 * sx
  const z2 = y * sx + z1 * cx
  return { x: x1, y: y2, z: z2 }
}

function initAppPhoneBuildU(): Float32Array {
  return new Float32Array(POINT_COUNT)
}

function initAppPhoneLocked(): Float32Array {
  return new Float32Array(POINT_COUNT)
}

function measureCloudHalfExtent(
  base: Float32Array,
  cx: number,
  cy: number,
): { halfW: number; halfH: number } {
  let halfW = 0
  let halfH = 0
  for (let i = 0; i < POINT_COUNT; i++) {
    const i3 = i * 3
    halfW = Math.max(halfW, Math.abs(base[i3] - cx))
    halfH = Math.max(halfH, Math.abs(base[i3 + 1] - cy))
  }
  return {
    halfW: Math.max(0.28, halfW),
    halfH: Math.max(0.38, halfH),
  }
}

function computeAppPhoneScale(halfW: number, halfH: number): number {
  const scaleY = (halfH * APP_PHONE_CLOUD_HEIGHT_FRAC) / APP_PHONE_GLYPH_NATIVE_H
  const scaleX = (halfW * APP_PHONE_CLOUD_WIDTH_FRAC) / APP_PHONE_GLYPH_NATIVE_W
  return Math.min(scaleX, scaleY)
}

function glyphVisionAppPhone(
  particleIdx: number,
  t: number,
  phoneScale: number,
  formW: number,
  assemblyComplete: boolean,
): { ox: number; oy: number; oz: number } {
  const i3 = particleIdx * 3
  const sx = APP_PHONE_LOCAL_PATH[i3] * phoneScale
  const sy = APP_PHONE_LOCAL_PATH[i3 + 1] * phoneScale
  const sz = APP_PHONE_LOCAL_PATH[i3 + 2] * phoneScale * APP_PHONE_Z_DEPTH
  const spin = assemblyComplete ? t * 0.24 : 0
  const rotY = APP_PHONE_ROT_Y * formW + spin
  const rotX = APP_PHONE_TILT_X * formW
  const rotated = rotatePhone3D(sx, sy, sz, rotY, rotX)
  const flutter = assemblyComplete
    ? Math.sin(t * 1.05 + particleIdx * 0.031) * 0.0012 * phoneScale
    : 0
  return {
    ox: rotated.x + flutter,
    oy: rotated.y + flutter * 0.65,
    oz: rotated.z * RESIDE_VPLUS_Z_SCALE,
  }
}

function tickAppPhoneBuildU(buildU: Float32Array, buildAgeSec: number): void {
  for (let i = 0; i < POINT_COUNT; i++) {
    const delay = (i / POINT_COUNT) * APP_PHONE_ASSEMBLY_STAGGER
    const age = buildAgeSec - delay
    if (age <= 0) {
      buildU[i] = 0
      continue
    }
    buildU[i] = Math.min(1, age / APP_PHONE_PART_TRAVEL_SEC)
  }
}

function updateAppPhoneAssemblyProgress(
  locked: Float32Array,
  delta: number,
  shapeBlendRef: React.MutableRefObject<number>,
  shapeBuildProgressRef: React.MutableRefObject<number>,
): void {
  let lockedN = 0
  for (let i = 0; i < POINT_COUNT; i++) {
    if (locked[i] > 0.5) lockedN++
  }
  const coverage = lockedN / POINT_COUNT
  shapeBlendRef.current += (coverage - shapeBlendRef.current) * Math.min(1, delta * 4.2)
  shapeBuildProgressRef.current = shapeBlendRef.current
}

function initShapeParticleSlots(shape: ServiceShape): Float32Array {
  const n = DEVICE_GLYPH_SAMPLES[shape].length
  const slots = new Float32Array(POINT_COUNT)
  for (let i = 0; i < POINT_COUNT; i++) {
    const jitter = Math.floor(hash01(i, 441 + shape.length * 17) * 2)
    slots[i] = (i + jitter * 997) % n
  }
  return slots
}

interface HazeParams {
  stretchX: number
  stretchY: number
  angle: number
  focus: number
  lobeCount: number
  drift: number
}

function hazeParams(visionIdx: number, t: number): HazeParams {
  const vi = visionIdx % RESIDE_VISION_COUNT
  const breathe = Math.sin(t * 0.36 + vi * 1.7)
  const wide = hash01(vi, 15) > 0.5
  const baseX = 0.55 + hash01(vi, 10) * 1.05
  const baseY = 0.5 + hash01(vi, 11) * 0.95
  const stretchX = (wide ? baseX * 1.4 : baseX * 0.62) + breathe * 0.14
  const stretchY = (wide ? baseY * 0.52 : baseY * 1.3) - breathe * 0.11
  const angle = hash01(vi, 12) * Math.PI * 0.6 + Math.sin(t * 0.23 + vi * 0.85) * 0.48
  const focus = 0.12 + hash01(vi, 13) * 0.38 + Math.sin(t * 0.31 + vi) * 0.14
  const lobeCount = 2 + Math.floor(hash01(vi, 14) * 4)
  const drift = 0.4 + hash01(vi, 16) * 0.6
  return { stretchX, stretchY, angle, focus, lobeCount, drift }
}

function hazeVision(visionIdx: number, s: number, t: number): { ox: number; oy: number } {
  const p = hazeParams(visionIdx, t)
  const u = s * Math.PI * 2 + visionIdx * 0.91
  const h = hash01(Math.floor(s * 613 + visionIdx * 37), visionIdx + 5)

  let ox = 0
  let oy = 0
  let wSum = 0
  for (let L = 0; L < p.lobeCount; L++) {
    const lt = (L + hash01(L + visionIdx * 3, 17)) / p.lobeCount
    const lx = Math.sin(lt * 6.7 + visionIdx * 2.1 + t * 0.27) * (0.26 + p.drift * 0.26)
    const ly = Math.cos(lt * 5.3 + visionIdx * 1.6 + t * 0.22) * (0.22 + p.drift * 0.24)
    const px = Math.cos(u) * (h - 0.5) * 1.7
    const py = Math.sin(u) * (s - 0.5) * 1.5
    const dist = Math.hypot(px - lx, py - ly)
    const tight = 0.05 + (1 - p.focus) * 0.48
    const w = Math.exp(-(dist * dist) / (tight * tight * 2.2))
    ox += lx * w
    oy += ly * w
    wSum += w
  }
  if (wSum > 1e-6) {
    ox /= wSum
    oy /= wSum
  }

  const scatterAmp = 0.26 + (1 - p.focus) * 0.58 + hash01(Math.floor(s * 400), visionIdx) * 0.22
  ox += Math.sin(u * 1.3 + s * 13 + t * 0.44) * scatterAmp
  oy += Math.cos(u * 1.6 + s * 11 + t * 0.38) * scatterAmp * (0.7 + p.focus * 0.4)

  ox += Math.sin(s * 27.3 + t * 0.61 + visionIdx) * 0.16
  oy += Math.cos(s * 21.7 + t * 0.54 + visionIdx * 1.3) * 0.15

  const sx = ox * p.stretchX
  const sy = oy * p.stretchY
  const ca = Math.cos(p.angle)
  const sa = Math.sin(p.angle)
  const rx = sx * ca - sy * sa
  const ry = sx * sa + sy * ca

  const sc = RESIDE_FORM_SCALE
  const warped = organicWarp(rx * sc, ry * sc, t, s + visionIdx * 0.17)
  return { ox: warped.x, oy: warped.y }
}

function visionBody(visionIdx: number, s: number, t: number): { ox: number; oy: number; oz: number } {
  if (visionIdx % RESIDE_VISION_COUNT === RESIDE_VPLUS_VISION) {
    return glyphVisionVPlus(s, t)
  }
  const h = hazeVision(visionIdx, s, t)
  return { ox: h.ox, oy: h.oy, oz: 0 }
}

function organicVisionTarget(
  s: number,
  cycleT: number,
  t: number,
  anchorX: number,
  anchorY: number,
): { x: number; y: number; z: number } {
  const i0 = Math.floor(cycleT) % RESIDE_VISION_COUNT
  const i1 = (i0 + 1) % RESIDE_VISION_COUNT
  const u = smoothstep(cycleT - Math.floor(cycleT))
  const a = visionBody(i0, s, t)
  const b = visionBody(i1, s, t)
  const ox = a.ox + (b.ox - a.ox) * u
  const oy = a.oy + (b.oy - a.oy) * u
  const oz = a.oz + (b.oz - a.oz) * u
  return { x: anchorX + ox, y: anchorY + oy, z: oz }
}

function captureMassCenter(base: Float32Array): { x: number; y: number } {
  let ox = 0
  let oy = 0
  for (let i = 0; i < POINT_COUNT; i++) {
    const i3 = i * 3
    ox += base[i3]
    oy += base[i3 + 1]
  }
  return { x: ox / POINT_COUNT, y: oy / POINT_COUNT }
}

function applyMassShift(base: Float32Array, shiftX: number, shiftY: number): void {
  for (let i = 0; i < POINT_COUNT; i++) {
    const i3 = i * 3
    base[i3] += shiftX
    base[i3 + 1] += shiftY
  }
}

function applyResideOverlay(
  base: Float32Array,
  layout: ResideLayout,
  originX: number,
  originY: number,
  targetX: number,
  targetY: number,
  elapsed: number,
  time: number,
  selectedShape: ServiceShape | null,
  shapeBlend: number,
  shapeSlots: Float32Array | null,
  shapeBuildStartRef: React.MutableRefObject<number>,
  appPhoneBuildURef: React.MutableRefObject<Float32Array | null>,
  appPhoneLockedRef: React.MutableRefObject<Float32Array | null>,
): void {
  const appAssemblyActive = selectedShape === 'app'
  const driftT = smoothstep(Math.min(1, elapsed / RESIDE_DRIFT_DURATION))
  const effectiveDriftT = driftT
  const anchored = effectiveDriftT >= 0.995
  const shiftX = (targetX - originX) * effectiveDriftT
  const shiftY = (targetY - originY) * effectiveDriftT
  const gatherT = smoothstep(effectiveDriftT)
  const spreadScale = 1 - gatherT * RESIDE_GATHER_MAX
  const approachZ = gatherT * RESIDE_APPROACH_Z

  const morphOn = smoothstep(Math.min(1, elapsed / RESIDE_MORPH_ONSET))
  const morphK = anchored
    ? RESIDE_MORPH_HOLD
    : morphOn * RESIDE_MORPH_HOLD * (0.35 + driftT * 0.65)
  const cycleT = time * RESIDE_MORPH_CYCLE
  const buildAgeSec = appAssemblyActive && shapeBuildStartRef.current > 0
    ? (performance.now() - shapeBuildStartRef.current) / 1000
    : 0
  const assembleRamp = appAssemblyActive
    ? smoothstep(Math.max(0, (buildAgeSec - 0.18) / 0.65))
    : 0
  const buildUArr = appPhoneBuildURef.current
  const lockedArr = appPhoneLockedRef.current

  applyMassShift(base, shiftX, shiftY)

  let cx = 0
  let cy = 0
  let lockedCount = 0
  if (lockedArr) {
    for (let i = 0; i < POINT_COUNT; i++) {
      if (lockedArr[i] > 0.5) lockedCount++
    }
  }
  const assemblyComplete = appAssemblyActive
    && (lockedCount / POINT_COUNT > 0.9 || shapeBlend > 0.96)
  for (let i = 0; i < POINT_COUNT; i++) {
    const i3 = i * 3
    cx += base[i3]
    cy += base[i3 + 1]
  }
  cx /= POINT_COUNT
  cy /= POINT_COUNT

  const cloudExt = measureCloudHalfExtent(base, cx, cy)
  const phoneScale = computeAppPhoneScale(cloudExt.halfW, cloudExt.halfH)
  const lockProx = APP_PHONE_LOCK_PROX * phoneScale

  for (let i = 0; i < POINT_COUNT; i++) {
    const i3 = i * 3
    let z = base[i3 + 2] + approachZ
    let x = cx + (base[i3] - cx) * spreadScale
    let y = cy + (base[i3 + 1] - cy) * spreadScale

    const isAppPhone = selectedShape === 'app'
    const formW = isAppPhone ? Math.max(shapeBlend, 0.72) : 0

    if (morphK > 0.01) {
      const organic = organicVisionTarget(layout.morphSeed[i], cycleT, time, cx, cy)
      const ang = layout.localAng[i] + time * 0.22
      const r = layout.localR[i] * (1.08 + morphK * 0.12)
      const flutter = Math.sin(time * 1.15 + layout.wobblePhase[i]) * 0.014
      const otherShapeW = selectedShape && shapeBlend > 0.001 && selectedShape !== 'app'
        ? smoothstep(shapeBlend) : 0
      const bustle = otherShapeW < 0.98
        ? (1 - otherShapeW) * 0.052 * Math.sin(time * 5.4 + layout.wobblePhase[i] * 2.1)
        : 0
      const glyphCx = otherShapeW > 0.02 ? targetX : cx
      const glyphCy = otherShapeW > 0.02 ? targetY : cy
      let tx = organic.x + Math.cos(ang) * r + flutter + bustle * (hash01(i, 61) - 0.5)
      let ty = organic.y + Math.sin(ang) * r + flutter * 0.55 + bustle * (hash01(i, 62) - 0.5)
      let tz = organic.z
      let morphPull = morphK * (0.22 + hash01(i, 9) * 0.48)

      if (isAppPhone && appAssemblyActive && buildUArr && lockedArr) {
        if (buildUArr[i] <= 0.001) {
          x += (tx - x) * morphPull
          y += (ty - y) * morphPull
          z += tz * morphPull
        } else {
          const device = glyphVisionAppPhone(
            i, time, phoneScale, formW, assemblyComplete,
          )
          const phoneX = cx + device.ox
          const phoneY = cy + device.oy
          const phoneZ = device.oz

          if (lockedArr[i] > 0.5) {
            x = phoneX
            y = phoneY
            z = phoneZ
          } else {
            const partU = smoothstep(buildUArr[i])
            const magnetW = assembleRamp * (
              APP_PHONE_MAGNET_BASE + partU * APP_PHONE_MAGNET_PEAK
            )
            x += (phoneX - x) * magnetW
            y += (phoneY - y) * magnetW
            z += (phoneZ - z) * magnetW * 0.52
            if (
              partU > 0.42
              && buildAgeSec > 0.2
              && Math.hypot(x - phoneX, y - phoneY) < lockProx * 1.35
            ) {
              lockedArr[i] = 1
              x = phoneX
              y = phoneY
              z = phoneZ
            }
          }
        }
      } else if (otherShapeW > 0.001 && selectedShape && shapeSlots) {
        const device = glyphVisionDevice(
          i, layout.morphSeed[i], time, selectedShape, shapeSlots[i],
        )
        const dx = glyphCx + device.ox
        const dy = glyphCy + device.oy
        const organicW = 1 - otherShapeW * 0.98
        const orbitW = organicW * (1 - otherShapeW * 0.82)
        tx = organic.x * organicW + dx * otherShapeW + Math.cos(ang) * r * orbitW * 0.12
        ty = organic.y * organicW + dy * otherShapeW + Math.sin(ang) * r * orbitW * 0.12
        tz = organic.z * organicW + device.oz * otherShapeW
        morphPull = morphK * (0.55 + otherShapeW * 0.72 + hash01(i, 9) * 0.1)
      }

      if (!isAppPhone || !appAssemblyActive) {
        x += (tx - x) * morphPull
        y += (ty - y) * morphPull
        z += tz * morphPull
      }
    }

    base[i3] = x
    base[i3 + 1] = y
    base[i3 + 2] = z
  }
}

// ─── Sphere points ───────────────────────────────────────────────────────────

interface PointsProps {
  cursorRef: React.MutableRefObject<{ x: number; y: number }>
  exploded: boolean
  cometActive: boolean
  cometHeadRef: React.MutableRefObject<THREE.Vector3>
  scenarioId: number
  explosionRef: React.MutableRefObject<ExplosionState>
  onPointsLayoutProgress?: (rightHalfRatio: number) => void
  selectedShapeRef: React.MutableRefObject<ServiceShape | null>
  shapeBlendRef: React.MutableRefObject<number>
  shapeBuildStartRef: React.MutableRefObject<number>
  shapeBuildProgressRef: React.MutableRefObject<number>
  shapeSlotsRef: React.MutableRefObject<Float32Array | null>
  appPhoneBuildURef: React.MutableRefObject<Float32Array | null>
  appPhoneLockedRef: React.MutableRefObject<Float32Array | null>
}

function updateShapeBuildProgress(
  selectedShapeRef: React.MutableRefObject<ServiceShape | null>,
  shapeBuildStartRef: React.MutableRefObject<number>,
  shapeBlendRef: React.MutableRefObject<number>,
  shapeBuildProgressRef: React.MutableRefObject<number>,
): void {
  if (!selectedShapeRef.current || shapeBuildStartRef.current <= 0) {
    shapeBlendRef.current = 0
    shapeBuildProgressRef.current = 0
    return
  }
  if (selectedShapeRef.current === 'app') return
  const rawU = Math.min(1, (performance.now() - shapeBuildStartRef.current)
    / (SHAPE_BUILD_DURATION * 1000))
  const eased = smoothstep(rawU)
  shapeBlendRef.current = eased
  shapeBuildProgressRef.current = eased
}

function Points({
  cursorRef,
  exploded,
  cometActive,
  cometHeadRef,
  scenarioId,
  explosionRef,
  onPointsLayoutProgress,
  selectedShapeRef,
  shapeBlendRef,
  shapeBuildStartRef,
  shapeBuildProgressRef,
  shapeSlotsRef,
  appPhoneBuildURef,
  appPhoneLockedRef,
}: PointsProps) {
  const meshRef = useRef<THREE.Points>(null)
  const { camera, size } = useThree()
  const spherePos = useMemo(() => buildSpherePositions(), [])
  const colors = useMemo(() => buildColors(), [])
  const circleMap = useMemo(() => buildCircleTexture(), [])

  const material = useMemo(() => new THREE.PointsMaterial({
    size: 0.014,
    vertexColors: true,
    sizeAttenuation: true,
    transparent: true,
    alphaMap: circleMap,
    depthWrite: false,
  }), [circleMap])

  const currentPos = useRef<Float32Array>(spherePos.slice())
  const explodeFrom = useRef<Float32Array>(spherePos.slice())
  const orbit = useRef<ParticleOrbit | null>(null)
  const explodeElapsed = useRef(0)
  const preburstElapsed = useRef(0)
  const orbitTime = useRef(0)
  const phaseRef = useRef<'sphere' | 'preburst' | 'explode' | 'reside'>('sphere')
  const impactLead = useRef<Float32Array | null>(null)
  const burstStartT = useRef<Float32Array | null>(null)
  const prevExplodedRef = useRef(false)
  const cometDisp = useRef(new Float32Array(POINT_COUNT * 3))
  const particleVel = useRef(new Float32Array(POINT_COUNT * 3))
  const fearBiasRef = useRef(new Float32Array(POINT_COUNT))
  const basePos = useRef(new Float32Array(POINT_COUNT * 3))
  const orbitTarget = useRef(new Float32Array(POINT_COUNT * 3))
  const liveCenter = useRef(new Float32Array(POINT_COUNT * 3))
  const resideLayout = useRef<ResideLayout | null>(null)
  const resideOriginX = useRef(0)
  const resideOriginY = useRef(0)
  const driftElapsed = useRef(0)
  const prevCometHead = useRef(new THREE.Vector3())
  const cometHeadVel = useRef(new THREE.Vector3())
  const massRotX = useRef(0)
  const massRotY = useRef(0)
  const massRotZ = useRef(0)

  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(currentPos.current, 3))
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    return g
  }, [colors])

  const baseRotY = useRef(0)
  const cursorTiltX = useRef(0)
  const cursorTiltY = useRef(0)

  useEffect(() => {
    if (scenarioId === 0) return

    phaseRef.current = 'sphere'
    prevExplodedRef.current = false
    explodeElapsed.current = 0
    preburstElapsed.current = 0
    orbitTime.current = 0
    impactLead.current = null
    burstStartT.current = null
    explosionRef.current = { phase: 'none', preburstU: 0 }
    orbit.current = null
    resideLayout.current = null
    driftElapsed.current = 0
    resideOriginX.current = 0
    resideOriginY.current = 0
    cometDisp.current.fill(0)
    particleVel.current.fill(0)
    for (let i = 0; i < POINT_COUNT; i++) {
      fearBiasRef.current[i] = 0.62 + Math.random() * 0.76
    }
    massRotX.current = 0
    massRotY.current = 0
    massRotZ.current = 0
    baseRotY.current = 0
    cursorTiltX.current = 0
    cursorTiltY.current = 0
    prevCometHead.current.copy(cometHeadRef.current)
    currentPos.current.set(spherePos)
    explodeFrom.current.set(spherePos)

    if (!meshRef.current) return
    meshRef.current.rotation.set(0, 0, 0)
    const posAttr = meshRef.current.geometry.attributes.position as THREE.BufferAttribute
    posAttr.needsUpdate = true
  }, [scenarioId, spherePos, cometHeadRef])

  useEffect(() => {
    if (!exploded || exploded === prevExplodedRef.current) return
    prevExplodedRef.current = exploded

    if (!meshRef.current) return
    const pos = currentPos.current
    const from = explodeFrom.current
    const m = meshRef.current

    for (let i = 0; i < POINT_COUNT; i++) {
      const i3 = i * 3
      from[i3] = pos[i3]
      from[i3 + 1] = pos[i3 + 1]
      from[i3 + 2] = pos[i3 + 2]
    }

    m.rotation.set(0, 0, 0)
    orbit.current = initExplosionLayout(spherePos)
    orbit.current.fearBias.set(fearBiasRef.current)
    impactLead.current = buildImpactLead(from)
    burstStartT.current = new Float32Array(POINT_COUNT)
    cometDisp.current.fill(0)
    particleVel.current.fill(0)
    explodeElapsed.current = 0
    preburstElapsed.current = 0
    orbitTime.current = 0
    prevCometHead.current.copy(cometHeadRef.current)
    massRotX.current = 0
    massRotY.current = 0
    massRotZ.current = 0
    phaseRef.current = 'preburst'
    explosionRef.current = { phase: 'preburst', preburstU: 0 }
    const posAttr = m.geometry.attributes.position as THREE.BufferAttribute
    posAttr.needsUpdate = true
  }, [exploded, spherePos])

  useEffect(() => {
    if (exploded) return
    prevExplodedRef.current = false
    phaseRef.current = 'sphere'
    explodeElapsed.current = 0
    preburstElapsed.current = 0
    orbitTime.current = 0
    impactLead.current = null
    burstStartT.current = null
    explosionRef.current = { phase: 'none', preburstU: 0 }
    orbit.current = null
    resideLayout.current = null
    driftElapsed.current = 0
    resideOriginX.current = 0
    resideOriginY.current = 0
    cometDisp.current.fill(0)
    particleVel.current.fill(0)
    massRotX.current = 0
    massRotY.current = 0
    massRotZ.current = 0
    currentPos.current.set(spherePos)
    explodeFrom.current.set(spherePos)
    if (meshRef.current) {
      meshRef.current.rotation.set(0, 0, 0)
      const posAttr = meshRef.current.geometry.attributes.position as THREE.BufferAttribute
      posAttr.needsUpdate = true
    }
  }, [exploded, spherePos])

  useFrame((_, delta) => {
    if (!meshRef.current) return
    const pos = currentPos.current
    const posAttr = meshRef.current.geometry.attributes.position as THREE.BufferAttribute

    if (phaseRef.current === 'sphere') {
      baseRotY.current += delta * 0.15
      const lf = 1 - Math.exp(-3 * delta)
      cursorTiltX.current += (-cursorRef.current.y * 0.4 - cursorTiltX.current) * lf
      cursorTiltY.current += (cursorRef.current.x * 0.4 - cursorTiltY.current) * lf

      if (cometActive) {
        meshRef.current.rotation.set(0, 0, 0)
        cometHeadVel.current.copy(cometHeadRef.current).sub(prevCometHead.current).multiplyScalar(1 / Math.max(delta, 1e-5))
        prevCometHead.current.copy(cometHeadRef.current)

        const base = basePos.current
        fillRotatedSphereBase(
          spherePos,
          cursorTiltX.current,
          baseRotY.current + cursorTiltY.current,
          base,
        )
        applyCometReaction(
          pos, base, cometDisp.current, particleVel.current,
          fearBiasRef.current, cometHeadRef.current, cometHeadVel.current, camera, delta,
        )
        posAttr.needsUpdate = true
      } else {
        meshRef.current.rotation.x = cursorTiltX.current
        meshRef.current.rotation.y = baseRotY.current + cursorTiltY.current
      }
      return
    }

    meshRef.current.rotation.set(0, 0, 0)
    const o = orbit.current
    if (!o) return

    orbitTime.current += delta
    const time = orbitTime.current
    cometHeadVel.current.copy(cometHeadRef.current).sub(prevCometHead.current).multiplyScalar(1 / Math.max(delta, 1e-5))
    prevCometHead.current.copy(cometHeadRef.current)

    if (phaseRef.current === 'preburst') {
      preburstElapsed.current = Math.min(PREBURST_DURATION, preburstElapsed.current + delta)
      const from = explodeFrom.current
      const base = basePos.current
      const lead = impactLead.current
      const startT = burstStartT.current
      const slowU = preburstElapsed.current / PREBURST_DURATION
      explosionRef.current = { phase: 'preburst', preburstU: slowU }
      const kick = impactPop(slowU)
      const detonateU = kick

      baseRotY.current += delta * (0.11 + detonateU * 0.38)
      fillRotatedSphereBase(
        spherePos,
        cursorTiltX.current,
        baseRotY.current + cursorTiltY.current,
        base,
      )

      if (lead && startT) {
        for (let i = 0; i < POINT_COUNT; i++) {
          const i3 = i * 3
          const li = lead[i]
          if (li < 0.03) {
            const px = base[i3]
            const py = base[i3 + 1]
            const pz = base[i3 + 2]
            const plen = Math.hypot(px, py, pz) || 1
            const fx = from[i3]
            const fy = from[i3 + 1]
            const fz = from[i3 + 2]
            const distI = Math.hypot(fx - IMPACT.x, fy - IMPACT.y, fz - IMPACT.z)
            const wave = detonateU * Math.exp(-distI / (SPHERE_RADIUS * 0.72))
            const swell = PREBURST_INNER_SWELL * wave * (0.5 + hash01(i, 24) * 0.5)
            const vib = Math.sin(time * (7 + hash01(i, 26) * 11) + i * 0.62)
              * detonateU * PREBURST_INNER_VIB
            base[i3]     = px + (px / plen) * swell + vib * (hash01(i, 27) - 0.5) * 2.2
            base[i3 + 1] = py + (py / plen) * swell + vib * (hash01(i, 28) - 0.5) * 2.2
            base[i3 + 2] = pz + (pz / plen) * swell * 0.55 + vib * (hash01(i, 29) - 0.5) * 1.1
            startT[i] = detonateU * PREBURST_INNER_START
            continue
          }
          const k = kick * li * (0.42 + 0.58 * li)
          const dir = craterBlastDir(from[i3], from[i3 + 1], from[i3 + 2], i)
          const blast = k * PREBURST_CRATER_BLAST * (0.88 + hash01(i, 14) * 0.38)
          base[i3]     = from[i3]     + dir.x * blast
          base[i3 + 1] = from[i3 + 1] + dir.y * blast
          base[i3 + 2] = from[i3 + 2] + dir.z * blast
          startT[i] = k * 0.11 + detonateU * 0.04 * (1 - li)
        }

        applyPreburstShockwave(base, from, lead, startT, detonateU, shockWaveTravel(slowU), time)

        const rotKick = 0.12 + detonateU * 0.62
        massRotX.current += MASS_ROT_SPEED_X * delta * rotKick
        massRotY.current += MASS_ROT_SPEED_Y * delta * rotKick
        massRotZ.current += MASS_ROT_SPEED_Z * delta * rotKick
        rotateMassInPlace(base, massRotX.current, massRotY.current, massRotZ.current)
      }

      for (let i = 0; i < POINT_COUNT * 3; i++) pos[i] = base[i]
      posAttr.needsUpdate = true

      if (preburstElapsed.current >= PREBURST_DURATION) {
        const snapFrom = explodeFrom.current
        for (let i = 0; i < POINT_COUNT; i++) {
          const i3 = i * 3
          snapFrom[i3]     = pos[i3]
          snapFrom[i3 + 1] = pos[i3 + 1]
          snapFrom[i3 + 2] = pos[i3 + 2]
        }
        const center = captureMassCenter(pos)
        resideOriginX.current = center.x
        resideOriginY.current = center.y
        if (!resideLayout.current) resideLayout.current = createResideLayout()
        initResideLayout(resideLayout.current)
        driftElapsed.current = 0.42
        explodeElapsed.current = 0
        phaseRef.current = 'explode'
      }
      return
    }

    if (phaseRef.current === 'explode') {
      explosionRef.current = { phase: 'burst', preburstU: 1 }
      explodeElapsed.current = Math.min(BURST_DURATION, explodeElapsed.current + delta)
      const burstU = burstEase(explodeElapsed.current / BURST_DURATION)
      const from = explodeFrom.current
      const base = basePos.current
      const startT = burstStartT.current
      const orbitGoal = orbitTarget.current
      fillOrbitBase(o, time, liveCenter.current, orbitGoal)

      if (startT) {
        for (let i = 0; i < POINT_COUNT; i++) {
          const i3 = i * 3
          const ti = startT[i] + (1 - startT[i]) * burstU
          base[i3]     = from[i3]     + (orbitGoal[i3]     - from[i3])     * ti
          base[i3 + 1] = from[i3 + 1] + (orbitGoal[i3 + 1] - from[i3 + 1]) * ti
          base[i3 + 2] = from[i3 + 2] + (orbitGoal[i3 + 2] - from[i3 + 2]) * ti
        }
      }

      const rotBoost = 0.25 + burstU * 0.95
      massRotX.current += MASS_ROT_SPEED_X * delta * rotBoost
      massRotY.current += MASS_ROT_SPEED_Y * delta * rotBoost
      massRotZ.current += MASS_ROT_SPEED_Z * delta * rotBoost
      rotateMassInPlace(base, massRotX.current, massRotY.current, massRotZ.current)

      driftElapsed.current += delta
      updateShapeBuildProgress(
        selectedShapeRef, shapeBuildStartRef, shapeBlendRef, shapeBuildProgressRef,
      )
      const layout = resideLayout.current
      if (layout) {
        const target = computeResideTargetWorld(camera)
        if (
          selectedShapeRef.current === 'app'
          && shapeBuildStartRef.current > 0
          && appPhoneBuildURef.current
        ) {
          const appBuildAgeSec = (performance.now() - shapeBuildStartRef.current) / 1000
          tickAppPhoneBuildU(appPhoneBuildURef.current, appBuildAgeSec)
        }
        applyResideOverlay(
          base, layout, resideOriginX.current, resideOriginY.current,
          target.x, target.y, driftElapsed.current, time,
          selectedShapeRef.current, shapeBlendRef.current,
          shapeSlotsRef.current,
          shapeBuildStartRef,
          appPhoneBuildURef,
          appPhoneLockedRef,
        )
        if (
          selectedShapeRef.current === 'app'
          && shapeBuildStartRef.current > 0
          && appPhoneLockedRef.current
        ) {
          updateAppPhoneAssemblyProgress(
            appPhoneLockedRef.current,
            delta,
            shapeBlendRef,
            shapeBuildProgressRef,
          )
        }
      }

      applyCometReaction(
        pos, base, cometDisp.current, particleVel.current,
        o.fearBias, cometHeadRef.current, cometHeadVel.current, camera, delta,
      )
      if (cometActive && onPointsLayoutProgress) {
        onPointsLayoutProgress(computePointsRightHalfRatio(pos, POINT_COUNT, camera))
      }
      posAttr.needsUpdate = true
      if (explodeElapsed.current >= BURST_DURATION) {
        phaseRef.current = 'reside'
      }
      return
    }

    if (phaseRef.current !== 'reside') return

    explosionRef.current = { phase: 'reside', preburstU: 1 }

    const {
      fearBias,
    } = o
    const base = basePos.current
    fillOrbitBase(o, time, liveCenter.current, base)

    const driftT = Math.min(1, driftElapsed.current / RESIDE_DRIFT_DURATION)
    const rotScale = 1 - smoothstep(driftT) * 0.38
    massRotX.current += MASS_ROT_SPEED_X * delta * rotScale
    massRotY.current += MASS_ROT_SPEED_Y * delta * rotScale
    massRotZ.current += MASS_ROT_SPEED_Z * delta * rotScale
    rotateMassInPlace(base, massRotX.current, massRotY.current, massRotZ.current)

    driftElapsed.current += delta
    updateShapeBuildProgress(
      selectedShapeRef, shapeBuildStartRef, shapeBlendRef, shapeBuildProgressRef,
    )
    const layout = resideLayout.current
    if (layout) {
      const target = computeResideTargetWorld(camera)
      if (
        selectedShapeRef.current === 'app'
        && shapeBuildStartRef.current > 0
        && appPhoneBuildURef.current
      ) {
        const appBuildAgeSec = (performance.now() - shapeBuildStartRef.current) / 1000
        tickAppPhoneBuildU(appPhoneBuildURef.current, appBuildAgeSec)
      }
      applyResideOverlay(
        base, layout, resideOriginX.current, resideOriginY.current,
        target.x, target.y, driftElapsed.current, time,
        selectedShapeRef.current, shapeBlendRef.current,
        shapeSlotsRef.current,
        shapeBuildStartRef,
        appPhoneBuildURef,
        appPhoneLockedRef,
      )
      if (
        selectedShapeRef.current === 'app'
        && shapeBuildStartRef.current > 0
        && appPhoneLockedRef.current
      ) {
        updateAppPhoneAssemblyProgress(
          appPhoneLockedRef.current,
          delta,
          shapeBlendRef,
          shapeBuildProgressRef,
        )
      }
    }

    applyCometReaction(
      pos, base, cometDisp.current, particleVel.current,
      fearBias, cometHeadRef.current, cometHeadVel.current, camera, delta,
    )
    if (cometActive && onPointsLayoutProgress) {
      onPointsLayoutProgress(computePointsRightHalfRatio(pos, POINT_COUNT, camera))
    }
    posAttr.needsUpdate = true
  })

  return <points ref={meshRef} geometry={geometry} material={material} frustumCulled={false} />
}

// ─── Comet ───────────────────────────────────────────────────────────────────

type CometMode = 'hidden' | 'scenario' | 'follow'

type CometMirrorSnapshot = {
  active: boolean
  scatterActive: boolean
  headWorldX: number
  headWorldY: number
  headWorldZ: number
  mirrorParticleCount: number
  headPos: Float32Array
  tailPos: Float32Array
  tailCol: Float32Array
  headReformU: Float32Array
  tailReformU: Float32Array
  headSize: number
  headGlowSize: number
  headGlowOpacity: number
  tailSize: number
  tailOpacity: number
}

interface CometProps {
  mode: CometMode
  scenarioId: number
  cursorRef: React.MutableRefObject<{ x: number; y: number }>
  onImpact?: () => void
  onComplete?: () => void
  onAssemblyProgress?: (progress: number) => void
  headRef?: React.MutableRefObject<THREE.Vector3>
  explosionRef: React.MutableRefObject<ExplosionState>
  debrisOnly?: boolean
  mirrorRef?: React.MutableRefObject<CometMirrorSnapshot | null>
  hoverTintRef?: React.MutableRefObject<CometHoverTint>
  tintBlendRef?: React.MutableRefObject<number>
}

function Comet({ mode, scenarioId, cursorRef, onImpact, onComplete, onAssemblyProgress, headRef, explosionRef, debrisOnly, mirrorRef, hoverTintRef, tintBlendRef }: CometProps) {
  const headPtsRef = useRef<THREE.Points>(null)
  const headGlowPtsRef = useRef<THREE.Points>(null)
  const trailPtsRef = useRef<THREE.Points>(null)

  const approachRef = useRef(0)
  const retreatRef = useRef(0)
  const phaseRef = useRef<'approach' | 'scatter' | 'done'>('approach')
  const impactFired = useRef(false)
  const cometAngleRef = useRef(0)
  const headMatRef = useRef<THREE.PointsMaterial | null>(null)
  const headGlowMatRef = useRef<THREE.PointsMaterial | null>(null)
  const trailMatRef = useRef<THREE.PointsMaterial | null>(null)
  const onImpactRef = useRef(onImpact)
  const onCompleteRef = useRef(onComplete)
  const onAssemblyProgressRef = useRef(onAssemblyProgress)
  useEffect(() => { onImpactRef.current = onImpact }, [onImpact])
  useEffect(() => { onCompleteRef.current = onComplete }, [onComplete])
  useEffect(() => { onAssemblyProgressRef.current = onAssemblyProgress }, [onAssemblyProgress])

  const { camera, size } = useThree()

  const headLocal = useMemo(() => buildCometSphereLocal(), [])
  const headColors = useMemo(() => buildCometHeadColors(), [])
  const localTintBlend = useRef(0)
  const tintBlend = tintBlendRef ?? localTintBlend
  const tailTpl = useMemo(() => buildCometTailTemplate(), [])
  const headDepthBias = useMemo(() => {
    const bias = new Float32Array(COMET_POINT_COUNT)
    for (let i = 0; i < COMET_POINT_COUNT; i++) bias[i] = hash01(i, 16)
    return bias
  }, [])
  const circleMap = useMemo(() => buildCircleTexture(), [])

  const retreatFrom = useRef(IMPACT.clone())
  const retreatTarget = useRef(new THREE.Vector3())
  const prevHead = useRef(new THREE.Vector3())
  const headWork = useRef(new THREE.Vector3())
  const smoothHead = useRef(new THREE.Vector3())
  const tailVel = useRef({ x: METEOR_DIR_X / METEOR_DIR_LEN, y: METEOR_DIR_Y / METEOR_DIR_LEN })
  const smoothSpeed = useRef(0)
  const reformCursorSmooth = useRef(new THREE.Vector3())
  const cometBurstElapsed = useRef(0)
  const scatterHeadPos = useRef(new Float32Array(COMET_POINT_COUNT * 3))
  const scatterHeadVel = useRef(new Float32Array(COMET_POINT_COUNT * 3))
  const scatterTailPos = useRef(new Float32Array(COMET_TAIL_COUNT * 3))
  const scatterTailVel = useRef(new Float32Array(COMET_TAIL_COUNT * 3))
  const scatterPhysicsReady = useRef(false)
  const scatterElapsed = useRef(0)
  const headReformU = useRef(new Float32Array(COMET_POINT_COUNT))
  const headReformFrom = useRef(new Float32Array(COMET_POINT_COUNT * 3))
  const tailReformU = useRef(new Float32Array(COMET_TAIL_COUNT))
  const tailReformFrom = useRef(new Float32Array(COMET_TAIL_COUNT * 3))
  const lastScenarioId = useRef(0)

  const resetCometScenario = useCallback(() => {
    approachRef.current = 0
    retreatRef.current = 0
    phaseRef.current = 'approach'
    impactFired.current = false
    cometAngleRef.current = 0
    tailVel.current.x = METEOR_DIR_X / METEOR_DIR_LEN
    tailVel.current.y = METEOR_DIR_Y / METEOR_DIR_LEN
    smoothSpeed.current = 0
    headWork.current.copy(METEOR_START)
    smoothHead.current.copy(METEOR_START)
    prevHead.current.copy(METEOR_START)
    retreatFrom.current.copy(IMPACT)
    headRef?.current.copy(METEOR_START)
    scatterElapsed.current = 0
    cometBurstElapsed.current = 0
    scatterPhysicsReady.current = false
    headReformU.current.fill(0)
    tailReformU.current.fill(0)
    headReformFrom.current.fill(0)
    tailReformFrom.current.fill(0)
    scatterHeadVel.current.fill(0)
    scatterTailVel.current.fill(0)
    scatterHeadPos.current.fill(0)
    scatterTailPos.current.fill(0)
    reformCursorSmooth.current.copy(METEOR_START)

    const hx = METEOR_START.x
    const hy = METEOR_START.y
    const hz = METEOR_START.z
    const tailDirX = METEOR_DIR_X / METEOR_DIR_LEN
    const tailDirY = METEOR_DIR_Y / METEOR_DIR_LEN
    const perpX = -tailDirY
    const perpY = tailDirX

    if (headPtsRef.current) {
      const posArr = (headPtsRef.current.geometry.attributes.position as THREE.BufferAttribute).array as Float32Array
      for (let i = 0; i < COMET_POINT_COUNT; i++) {
        const i3 = i * 3
        posArr[i3]     = hx + headLocal[i3]
        posArr[i3 + 1] = hy + headLocal[i3 + 1]
        posArr[i3 + 2] = hz + headLocal[i3 + 2]
      }
      ;(headPtsRef.current.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true
    }

    if (trailPtsRef.current) {
      const posArr = (trailPtsRef.current.geometry.attributes.position as THREE.BufferAttribute).array as Float32Array
      const { alongT, lateral } = tailTpl
      for (let i = 0; i < COMET_TAIL_COUNT; i++) {
        const i3 = i * 3
        const t = alongT[i]
        const width = COMET_RADIUS * (1 - t * 0.92)
        const back = COMET_RADIUS * 0.92
        const lat = lateral[i] * width
        posArr[i3]     = hx - tailDirX * back + perpX * lat
        posArr[i3 + 1] = hy - tailDirY * back + perpY * lat
        posArr[i3 + 2] = hz
      }
      ;(trailPtsRef.current.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true
    }
  }, [headLocal, tailTpl, headRef])

  useLayoutEffect(() => {
    if (mode === 'follow') return
    if (scenarioId === 0 || scenarioId === lastScenarioId.current) return
    lastScenarioId.current = scenarioId
    resetCometScenario()
  }, [mode, scenarioId, resetCometScenario])

  const headGeom = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(COMET_POINT_COUNT * 3), 3))
    g.setAttribute('color', new THREE.BufferAttribute(headColors, 3))
    return g
  }, [headColors])

  const trailGeom = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(COMET_TAIL_COUNT * 3), 3))
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(COMET_TAIL_COUNT * 3), 3))
    return g
  }, [])

  useEffect(() => {
    if (mode !== 'follow') return
    phaseRef.current = 'done'
    const start = headRef?.current ?? headWork.current
    headWork.current.copy(start)
    smoothHead.current.copy(start)
    prevHead.current.copy(start)
  }, [mode, headRef])

  useFrame((_, delta) => {
    if (mode === 'hidden') return

    const head = headWork.current
    const dt = Math.min(delta, 0.032)
    const prevX = prevHead.current.x
    const prevY = prevHead.current.y
    const prevZ = prevHead.current.z

    if (mode === 'scenario' && phaseRef.current !== 'done') {
      const exp = explosionRef.current

      if (phaseRef.current === 'approach') {
        approachRef.current = Math.min(1, approachRef.current + dt / METEOR_DURATION)
        const t = easeIn(approachRef.current)
        head.lerpVectors(METEOR_START, IMPACT, t)

        if (approachRef.current >= 1 && !impactFired.current) {
          impactFired.current = true
          head.copy(IMPACT)
          initCometScatterHead(scatterHeadPos.current, scatterHeadVel.current, headLocal, headDepthBias)
          initCometScatterTail(
            scatterTailPos.current,
            scatterTailVel.current,
            tailTpl.alongT,
            tailTpl.lateral,
          )
          scatterPhysicsReady.current = true
          cometBurstElapsed.current = 0
          scatterElapsed.current = 0
          headReformU.current.fill(0)
          tailReformU.current.fill(0)
          phaseRef.current = 'scatter'
          onImpactRef.current?.()
        }
      } else if (phaseRef.current === 'scatter') {
        const burstReady = cometBurstReady(exp, cometBurstElapsed.current)
          || scatterElapsed.current > 0.08
        if (burstReady) {
          const cursorTarget = ndcToWorldXY(cursorRef.current.x, cursorRef.current.y, camera, size)
          const followK = 1 - Math.exp(-COMET_REFORM_FOLLOW_K * dt)
          reformCursorSmooth.current.lerp(cursorTarget, followK)
          head.copy(reformCursorSmooth.current)
        } else {
          head.copy(IMPACT)
        }
      }
    } else if (mode === 'follow') {
      const target = ndcToWorldXY(cursorRef.current.x, cursorRef.current.y, camera, size)
      const k = 1 - Math.exp(-COMET_FOLLOW_K * dt)
      smoothHead.current.lerp(target, k)
      head.copy(smoothHead.current)
    }

    headRef?.current.copy(head)

    const vx = head.x - prevX
    const vy = head.y - prevY
    const vlen = Math.hypot(vx, vy)

    const speedK = 1 - Math.exp(-COMET_TAIL_SPEED_SMOOTH * dt)
    smoothSpeed.current += (vlen - smoothSpeed.current) * speedK

    let tailDirX = tailVel.current.x
    let tailDirY = tailVel.current.y

    if (vlen > 1e-6) {
      const tx = vx / vlen
      const ty = vy / vlen
      tailDirX = tx * 0.88 + tailVel.current.x * 0.12
      tailDirY = ty * 0.88 + tailVel.current.y * 0.12
    }

    const tLen = Math.hypot(tailDirX, tailDirY) || 1
    tailDirX /= tLen
    tailDirY /= tLen
    tailVel.current.x += (tailDirX - tailVel.current.x) * Math.min(1, COMET_TAIL_VEL_K * dt)
    tailVel.current.y += (tailDirY - tailVel.current.y) * Math.min(1, COMET_TAIL_VEL_K * dt)
    tailDirX = tailVel.current.x
    tailDirY = tailVel.current.y

    const perpX = -tailDirY
    const perpY = tailDirX

    const tailLen = Math.min(COMET_TAIL_LEN_MAX, smoothSpeed.current * COMET_TAIL_LEN_K)
    const tailAlpha = Math.min(1, Math.max(0, (smoothSpeed.current - 0.006) / COMET_TAIL_FADE_SPEED))

    cometAngleRef.current += COMET_ROT_SPEED * dt
    const ca = cometAngleRef.current
    const cosA = Math.cos(ca)
    const sinA = Math.sin(ca)

    const scatterActive = phaseRef.current === 'scatter'
    const exp = explosionRef.current
    if (scatterActive && exp.phase === 'burst') {
      cometBurstElapsed.current += dt
    }
    const burstReady = cometBurstReady(exp, cometBurstElapsed.current)
      || (scatterActive && scatterElapsed.current > 0.08)
    let headArrived = 0
    const magnetizing = scatterActive && cometMagnetCount(headReformU.current, COMET_POINT_COUNT) > 0
    const cometGlow = scatterActive

    if (headPtsRef.current) {
      headMatRef.current = headPtsRef.current.material as THREE.PointsMaterial
    }
    if (headGlowPtsRef.current) {
      headGlowMatRef.current = headGlowPtsRef.current.material as THREE.PointsMaterial
    }
    if (trailPtsRef.current) {
      trailMatRef.current = trailPtsRef.current.material as THREE.PointsMaterial
    }

    const applyCometCoreMaterial = (mat: THREE.PointsMaterial, soft: boolean) => {
      mat.blending = THREE.NormalBlending
      mat.depthTest = false
      mat.toneMapped = true
      mat.opacity = soft ? 0.90 : 1
    }

    if (headPtsRef.current) {
      const posArr = (headPtsRef.current.geometry.attributes.position as THREE.BufferAttribute).array as Float32Array
      if (scatterActive) {
        scatterElapsed.current += dt
        if (!scatterPhysicsReady.current) {
          initCometScatterHead(scatterHeadPos.current, scatterHeadVel.current, headLocal, headDepthBias)
          initCometScatterTail(
            scatterTailPos.current,
            scatterTailVel.current,
            tailTpl.alongT,
            tailTpl.lateral,
          )
          scatterPhysicsReady.current = true
        }
        stepCometScatter(
          scatterHeadPos.current,
          scatterHeadVel.current,
          COMET_POINT_COUNT,
          dt,
          exp,
          cometBurstElapsed.current,
          31,
          headReformU.current,
        )

        const cx = reformCursorSmooth.current.x
        const cy = reformCursorSmooth.current.y
        const hz = reformCursorSmooth.current.z
        const magnetCursor = ndcToWorldXY(cursorRef.current.x, cursorRef.current.y, camera, size)
        const magnetCx = magnetCursor.x
        const magnetCy = magnetCursor.y
        const magnetAllowed = burstReady && scatterElapsed.current >= COMET_SCATTER_REFORM_MIN

        for (let i = 0; i < COMET_POINT_COUNT; i++) {
          const i3 = i * 3
          const px = scatterHeadPos.current[i3]
          const py = scatterHeadPos.current[i3 + 1]
          const pz = scatterHeadPos.current[i3 + 2]

          if (magnetAllowed && headReformU.current[i] < 1) {
            const dist = Math.hypot(px - magnetCx, py - magnetCy)
            const pull = cometMagnetPullStrength(dist, headReformU.current[i])
            if (pull > 0) {
              if (headReformU.current[i] <= 0) {
                headReformFrom.current[i3]     = px
                headReformFrom.current[i3 + 1] = py
                headReformFrom.current[i3 + 2] = pz
                scatterHeadVel.current[i3] = 0
                scatterHeadVel.current[i3 + 1] = 0
                scatterHeadVel.current[i3 + 2] = 0
              }
              headReformU.current[i] = Math.min(
                1,
                headReformU.current[i] + pull * dt / COMET_MAGNET_FLIGHT,
              )
            }
          }

          if (headReformU.current[i] <= 0) {
            posArr[i3]     = px
            posArr[i3 + 1] = py
            posArr[i3 + 2] = pz
            continue
          }

          if (headReformU.current[i] >= 1) headArrived++
          const u = easeOut(headReformU.current[i])
          const lx = headLocal[i3]
          const ly = headLocal[i3 + 1]
          const lz = headLocal[i3 + 2]
          const tx = cx + lx * cosA - ly * sinA
          const ty = cy + lx * sinA + ly * cosA
          const tz = hz + lz
          const fx = headReformFrom.current[i3]
          const fy = headReformFrom.current[i3 + 1]
          const fz = headReformFrom.current[i3 + 2]
          posArr[i3]     = fx + (tx - fx) * u
          posArr[i3 + 1] = fy + (ty - fy) * u
          posArr[i3 + 2] = fz + (tz - fz) * u

          if (mirrorRef?.current && headReformU.current[i] > 0) {
            mirrorRef.current.headPos[i3]     = posArr[i3]
            mirrorRef.current.headPos[i3 + 1] = posArr[i3 + 1]
            mirrorRef.current.headPos[i3 + 2] = posArr[i3 + 2]
          }

          if (debrisOnly && headReformU.current[i] >= COMET_MIRROR_REFORM_MIN) {
            posArr[i3] = 999
            posArr[i3 + 1] = 999
            posArr[i3 + 2] = -999
          }
        }

        if (headMatRef.current) {
          headMatRef.current.opacity = 1
          const fill = headArrived / COMET_POINT_COUNT
          headMatRef.current.size = COMET_HEAD_SIZE
            * (COMET_SCATTER_SIZE + (1 - COMET_SCATTER_SIZE) * fill)
          applyCometCoreMaterial(headMatRef.current, cometGlow)
        }
        if (headGlowMatRef.current) {
          const fill = headArrived / COMET_POINT_COUNT
          headGlowMatRef.current.opacity = cometGlow ? COMET_GLOW_OPACITY : 0
          headGlowMatRef.current.size = COMET_HEAD_SIZE * COMET_GLOW_SIZE
            * (COMET_SCATTER_SIZE + (1 - COMET_SCATTER_SIZE) * fill)
        }
        if (headArrived >= COMET_POINT_COUNT) {
          smoothHead.current.copy(head)
          phaseRef.current = 'done'
          onCompleteRef.current?.()
        } else {
          const assembly = cometAssemblyProgress(headReformU.current, COMET_POINT_COUNT)
          onAssemblyProgressRef.current?.(assembly)
        }
      } else {
        for (let i = 0; i < COMET_POINT_COUNT; i++) {
          const i3 = i * 3
          const lx = headLocal[i3]
          const ly = headLocal[i3 + 1]
          const lz = headLocal[i3 + 2]
          posArr[i3]     = head.x + lx * cosA - ly * sinA
          posArr[i3 + 1] = head.y + lx * sinA + ly * cosA
          posArr[i3 + 2] = head.z + lz
        }
        if (headMatRef.current) {
          headMatRef.current.opacity = 1
          headMatRef.current.size = COMET_HEAD_SIZE
          applyCometCoreMaterial(headMatRef.current, false)
        }
        if (headGlowMatRef.current) {
          headGlowMatRef.current.opacity = 0
        }
      }
      ;(headPtsRef.current.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true
    }

    const tailFill = magnetizing
      ? smoothstep(headArrived / COMET_POINT_COUNT)
      : 1

    if (trailPtsRef.current) {
      const posArr = (trailPtsRef.current.geometry.attributes.position as THREE.BufferAttribute).array as Float32Array
      const colArr = (trailPtsRef.current.geometry.attributes.color as THREE.BufferAttribute).array as Float32Array
      trailMatRef.current = trailPtsRef.current.material as THREE.PointsMaterial
      const { alongT, lateral } = tailTpl
      const hx = head.x
      const hy = head.y
      const hz = head.z
      const effectiveTailLen = tailLen * (magnetizing ? tailFill : 1)

      if (scatterActive) {
        stepCometScatter(
          scatterTailPos.current,
          scatterTailVel.current,
          COMET_TAIL_COUNT,
          dt,
          exp,
          cometBurstElapsed.current,
          47,
          tailReformU.current,
        )

        const magnetCursor = ndcToWorldXY(cursorRef.current.x, cursorRef.current.y, camera, size)
        const magnetCx = magnetCursor.x
        const magnetCy = magnetCursor.y
        const magnetAllowed = burstReady && scatterElapsed.current >= COMET_SCATTER_REFORM_MIN

        for (let i = 0; i < COMET_TAIL_COUNT; i++) {
          const i3 = i * 3
          const px = scatterTailPos.current[i3]
          const py = scatterTailPos.current[i3 + 1]
          const pz = scatterTailPos.current[i3 + 2]

          if (magnetAllowed && tailReformU.current[i] < 1) {
            const dist = Math.hypot(px - magnetCx, py - magnetCy)
            const pull = cometMagnetPullStrength(dist, tailReformU.current[i])
            if (pull > 0) {
              if (tailReformU.current[i] <= 0) {
                tailReformFrom.current[i3]     = px
                tailReformFrom.current[i3 + 1] = py
                tailReformFrom.current[i3 + 2] = pz
                scatterTailVel.current[i3] = 0
                scatterTailVel.current[i3 + 1] = 0
                scatterTailVel.current[i3 + 2] = 0
              }
              tailReformU.current[i] = Math.min(
                1,
                tailReformU.current[i] + pull * dt / COMET_MAGNET_FLIGHT,
              )
            }
          }
        }
      }

      for (let i = 0; i < COMET_TAIL_COUNT; i++) {
        const i3 = i * 3
        const t = alongT[i]
        if (scatterActive) {
          if (tailReformU.current[i] <= 0) {
            posArr[i3]     = scatterTailPos.current[i3]
            posArr[i3 + 1] = scatterTailPos.current[i3 + 1]
            posArr[i3 + 2] = scatterTailPos.current[i3 + 2]
          } else {
            const u = easeOut(Math.min(1, tailReformU.current[i]))
            const width = COMET_RADIUS * (1 - t * 0.92)
            const back = COMET_RADIUS * 0.92 + t * effectiveTailLen
            const lat = lateral[i] * width
            const tx = hx - tailDirX * back + perpX * lat
            const ty = hy - tailDirY * back + perpY * lat
            const tz = hz
            const fx = tailReformFrom.current[i3]
            const fy = tailReformFrom.current[i3 + 1]
            const fz = tailReformFrom.current[i3 + 2]
            posArr[i3]     = fx + (tx - fx) * u
            posArr[i3 + 1] = fy + (ty - fy) * u
            posArr[i3 + 2] = fz + (tz - fz) * u

            if (mirrorRef?.current && tailReformU.current[i] > 0) {
              mirrorRef.current.tailPos[i3]     = posArr[i3]
              mirrorRef.current.tailPos[i3 + 1] = posArr[i3 + 1]
              mirrorRef.current.tailPos[i3 + 2] = posArr[i3 + 2]
            }

            if (debrisOnly && tailReformU.current[i] >= COMET_MIRROR_REFORM_MIN) {
              posArr[i3] = 999
              posArr[i3 + 1] = 999
              posArr[i3 + 2] = -999
            }
          }
        } else {
          const width = COMET_RADIUS * (1 - t * 0.92)
          const back = COMET_RADIUS * 0.92 + t * effectiveTailLen
          const lat = lateral[i] * width
          posArr[i3]     = hx - tailDirX * back + perpX * lat
          posArr[i3 + 1] = hy - tailDirY * back + perpY * lat
          posArr[i3 + 2] = hz
        }

        const hot = scatterActive && tailReformU.current[i] <= 0
          ? 0.82
          : (1 - t) * tailAlpha
        colArr[i3]     = 0.92 + hot * 0.08
        colArr[i3 + 1] = 0.22 + hot * 0.38
        colArr[i3 + 2] = 0.06 + hot * 0.14
      }
      ;(trailPtsRef.current.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true
      ;(trailPtsRef.current.geometry.attributes.color as THREE.BufferAttribute).needsUpdate = true

      if (trailMatRef.current) {
        trailMatRef.current.blending = THREE.NormalBlending
        trailMatRef.current.toneMapped = true
        if (scatterActive && !magnetizing) {
          trailMatRef.current.size = COMET_TRAIL_SIZE * COMET_SCATTER_SIZE
          trailMatRef.current.opacity = 0.86
        } else if (scatterActive && magnetizing) {
          trailMatRef.current.size = COMET_TRAIL_SIZE
          trailMatRef.current.opacity = tailAlpha * tailFill
        } else {
          trailMatRef.current.size = COMET_TRAIL_SIZE
          trailMatRef.current.opacity = tailAlpha
        }
      }
    }

    prevHead.current.copy(head)

    if (hoverTintRef && (mode === 'follow' || phaseRef.current === 'done')) {
      const tint = hoverTintRef.current
      applyCometHeadTintBlend(
        headPtsRef.current,
        headGlowPtsRef.current,
        headColors,
        hoverTintRef,
        tintBlend,
        dt,
      )
      const tailAlpha = mode === 'follow'
        ? 0.92
        : (trailMatRef.current?.opacity ?? 0.92)
      applyCometTailTintBlend(
        trailPtsRef.current,
        tint,
        tintBlend.current,
        tailTpl,
        scatterActive,
        tailReformU.current,
        tailAlpha,
      )
    }

    if (mirrorRef?.current) {
      const snap = mirrorRef.current
      snap.scatterActive = scatterActive
      snap.headWorldX = head.x
      snap.headWorldY = head.y
      snap.headWorldZ = head.z
      snap.mirrorParticleCount = cometMirrorParticleCount(headReformU.current, COMET_POINT_COUNT)
      snap.active = scatterActive
      snap.headReformU.set(headReformU.current)
      snap.tailReformU.set(tailReformU.current)
      if (trailPtsRef.current) {
        const colArr = (trailPtsRef.current.geometry.attributes.color as THREE.BufferAttribute).array as Float32Array
        snap.tailCol.set(colArr)
      }
      snap.headSize = headMatRef.current?.size ?? COMET_HEAD_SIZE
      snap.headGlowSize = headGlowMatRef.current?.size ?? COMET_HEAD_SIZE * COMET_GLOW_SIZE
      snap.headGlowOpacity = headGlowMatRef.current?.opacity ?? 0
      snap.tailSize = trailMatRef.current?.size ?? COMET_TRAIL_SIZE
      snap.tailOpacity = trailMatRef.current?.opacity ?? 0.92
    }
  })

  if (mode === 'hidden') return null

  return (
    <group>
      <points ref={headGlowPtsRef} geometry={headGeom} frustumCulled={false} renderOrder={10}>
        <pointsMaterial
          size={COMET_HEAD_SIZE * COMET_GLOW_SIZE}
          vertexColors
          sizeAttenuation
          transparent
          opacity={0}
          alphaMap={circleMap}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          depthTest={false}
          toneMapped={false}
        />
      </points>
      <points ref={trailPtsRef} geometry={trailGeom} frustumCulled={false} renderOrder={11}>
        <pointsMaterial
          size={COMET_TRAIL_SIZE}
          vertexColors
          sizeAttenuation
          transparent
          opacity={0.92}
          alphaMap={circleMap}
          depthWrite={false}
          depthTest={false}
        />
      </points>
      <points ref={headPtsRef} geometry={headGeom} frustumCulled={false} renderOrder={12}>
        <pointsMaterial
          size={COMET_HEAD_SIZE}
          vertexColors
          sizeAttenuation
          transparent
          opacity={1}
          alphaMap={circleMap}
          depthWrite={false}
          depthTest={false}
        />
      </points>
    </group>
  )
}


function CometCursorSeed({
  mirrorRef,
}: {
  mirrorRef: React.MutableRefObject<CometMirrorSnapshot>
}) {
  const glowRef = useRef<THREE.Points>(null)
  const coreRef = useRef<THREE.Points>(null)
  const circleMap = useMemo(() => buildCircleTexture(), [])
  const seedCount = 10
  const positions = useMemo(() => new Float32Array(seedCount * 3), [])
  const colors = useMemo(() => {
    const head = buildCometHeadColors()
    const c = new Float32Array(seedCount * 3)
    for (let i = 0; i < seedCount; i++) {
      const i3 = i * 3
      c[i3] = head[i3]
      c[i3 + 1] = head[i3 + 1]
      c[i3 + 2] = head[i3 + 2]
    }
    return c
  }, [])

  const geom = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    return g
  }, [colors, positions])

  useFrame(() => {
    const snap = mirrorRef.current
    const show = snap.scatterActive
      && snap.mirrorParticleCount < COMET_CURSOR_SEED_HIDE_COUNT
    const fade = show
      ? smoothstep(1 - snap.mirrorParticleCount / COMET_CURSOR_SEED_HIDE_COUNT)
      : 0

    const posArr = positions
    for (let i = 0; i < seedCount; i++) {
      const i3 = i * 3
      const jitter = 0.008 + hash01(i, 19) * 0.012
      posArr[i3]     = snap.headWorldX + (hash01(i, 20) - 0.5) * jitter
      posArr[i3 + 1] = snap.headWorldY + (hash01(i, 21) - 0.5) * jitter
      posArr[i3 + 2] = snap.headWorldZ + (hash01(i, 22) - 0.5) * jitter * 0.4
    }
    geom.attributes.position.needsUpdate = true

    if (glowRef.current) {
      const mat = glowRef.current.material as THREE.PointsMaterial
      mat.opacity = fade * 0.55
      mat.size = COMET_HEAD_SIZE * COMET_GLOW_SIZE * (0.9 + fade * 0.25)
    }
    if (coreRef.current) {
      const mat = coreRef.current.material as THREE.PointsMaterial
      mat.opacity = fade * 0.92
      mat.size = COMET_HEAD_SIZE * (0.82 + fade * 0.28)
    }
  })

  return (
    <group>
      <points ref={glowRef} geometry={geom} frustumCulled={false} renderOrder={9}>
        <pointsMaterial
          size={COMET_HEAD_SIZE * COMET_GLOW_SIZE}
          vertexColors
          sizeAttenuation
          transparent
          opacity={0}
          alphaMap={circleMap}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          depthTest={false}
          toneMapped={false}
        />
      </points>
      <points ref={coreRef} geometry={geom} frustumCulled={false} renderOrder={13}>
        <pointsMaterial
          size={COMET_HEAD_SIZE}
          vertexColors
          sizeAttenuation
          transparent
          opacity={0}
          alphaMap={circleMap}
          depthWrite={false}
          depthTest={false}
        />
      </points>
    </group>
  )
}


function CometCursorMirror({
  mirrorRef,
  hoverTintRef,
  tintBlendRef,
}: {
  mirrorRef: React.MutableRefObject<CometMirrorSnapshot>
  hoverTintRef?: React.MutableRefObject<CometHoverTint>
  tintBlendRef?: React.MutableRefObject<number>
}) {
  const headPtsRef = useRef<THREE.Points>(null)
  const headGlowPtsRef = useRef<THREE.Points>(null)
  const trailPtsRef = useRef<THREE.Points>(null)
  const headMatRef = useRef<THREE.PointsMaterial | null>(null)
  const headGlowMatRef = useRef<THREE.PointsMaterial | null>(null)
  const trailMatRef = useRef<THREE.PointsMaterial | null>(null)

  const headColors = useMemo(() => buildCometHeadColors(), [])
  const localTintBlend = useRef(0)
  const tintBlend = tintBlendRef ?? localTintBlend
  const circleMap = useMemo(() => buildCircleTexture(), [])

  const headPos = useMemo(() => new Float32Array(COMET_POINT_COUNT * 3), [])
  const tailPos = useMemo(() => new Float32Array(COMET_TAIL_COUNT * 3), [])
  const tailCol = useMemo(() => {
    const c = new Float32Array(COMET_TAIL_COUNT * 3)
    for (let i = 0; i < COMET_TAIL_COUNT; i++) {
      const i3 = i * 3
      c[i3] = 0.92
      c[i3 + 1] = 0.22
      c[i3 + 2] = 0.06
    }
    return c
  }, [])

  const headGeom = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(headPos, 3))
    g.setAttribute('color', new THREE.BufferAttribute(headColors, 3))
    return g
  }, [headColors, headPos])

  const trailGeom = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(tailPos, 3))
    g.setAttribute('color', new THREE.BufferAttribute(tailCol, 3))
    return g
  }, [tailCol, tailPos])

  useFrame((_, delta) => {
    const snap = mirrorRef.current
    const off = 999
    const dt = Math.min(delta, 0.032)

    if (headPtsRef.current) {
      headMatRef.current = headPtsRef.current.material as THREE.PointsMaterial
      const posArr = (headPtsRef.current.geometry.attributes.position as THREE.BufferAttribute).array as Float32Array
      for (let i = 0; i < COMET_POINT_COUNT; i++) {
        const i3 = i * 3
        if (snap.active && snap.headReformU[i] > 0) {
          posArr[i3]     = snap.headPos[i3]
          posArr[i3 + 1] = snap.headPos[i3 + 1]
          posArr[i3 + 2] = snap.headPos[i3 + 2]
        } else {
          posArr[i3] = off
          posArr[i3 + 1] = off
          posArr[i3 + 2] = -off
        }
      }
      ;(headPtsRef.current.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true
      if (headMatRef.current) {
        headMatRef.current.size = snap.headSize
        headMatRef.current.opacity = snap.active ? 1 : 0
      }
    }

    if (headGlowPtsRef.current) {
      headGlowMatRef.current = headGlowPtsRef.current.material as THREE.PointsMaterial
      const posArr = (headGlowPtsRef.current.geometry.attributes.position as THREE.BufferAttribute).array as Float32Array
      for (let i = 0; i < COMET_POINT_COUNT; i++) {
        const i3 = i * 3
        if (snap.active && snap.headReformU[i] > 0) {
          posArr[i3]     = snap.headPos[i3]
          posArr[i3 + 1] = snap.headPos[i3 + 1]
          posArr[i3 + 2] = snap.headPos[i3 + 2]
        } else {
          posArr[i3] = off
          posArr[i3 + 1] = off
          posArr[i3 + 2] = -off
        }
      }
      ;(headGlowPtsRef.current.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true
      if (headGlowMatRef.current) {
        headGlowMatRef.current.size = snap.headGlowSize
        headGlowMatRef.current.opacity = snap.active ? snap.headGlowOpacity : 0
      }
    }

    if (trailPtsRef.current) {
      trailMatRef.current = trailPtsRef.current.material as THREE.PointsMaterial
      const posArr = (trailPtsRef.current.geometry.attributes.position as THREE.BufferAttribute).array as Float32Array
      const colArr = (trailPtsRef.current.geometry.attributes.color as THREE.BufferAttribute).array as Float32Array
      for (let i = 0; i < COMET_TAIL_COUNT; i++) {
        const i3 = i * 3
        if (snap.active && snap.tailReformU[i] > 0) {
          posArr[i3]     = snap.tailPos[i3]
          posArr[i3 + 1] = snap.tailPos[i3 + 1]
          posArr[i3 + 2] = snap.tailPos[i3 + 2]
          colArr[i3]     = snap.tailCol[i3]
          colArr[i3 + 1] = snap.tailCol[i3 + 1]
          colArr[i3 + 2] = snap.tailCol[i3 + 2]
        } else {
          posArr[i3] = off
          posArr[i3 + 1] = off
          posArr[i3 + 2] = -off
        }
      }
      ;(trailPtsRef.current.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true
      ;(trailPtsRef.current.geometry.attributes.color as THREE.BufferAttribute).needsUpdate = true
      if (trailMatRef.current) {
        trailMatRef.current.size = snap.tailSize
        trailMatRef.current.opacity = snap.active ? snap.tailOpacity : 0
      }
    }

    if (hoverTintRef && snap.active) {
      applyCometHeadTintBlend(
        headPtsRef.current,
        headGlowPtsRef.current,
        headColors,
        hoverTintRef,
        tintBlend,
        dt,
      )
    }
  })

  return (
    <group>
      <CometCursorSeed mirrorRef={mirrorRef} />
      <points ref={headGlowPtsRef} geometry={headGeom} frustumCulled={false} renderOrder={10}>
        <pointsMaterial
          size={COMET_HEAD_SIZE * COMET_GLOW_SIZE}
          vertexColors
          sizeAttenuation
          transparent
          opacity={0}
          alphaMap={circleMap}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          depthTest={false}
          toneMapped={false}
        />
      </points>
      <points ref={trailPtsRef} geometry={trailGeom} frustumCulled={false} renderOrder={11}>
        <pointsMaterial
          size={COMET_TRAIL_SIZE}
          vertexColors
          sizeAttenuation
          transparent
          opacity={0.92}
          alphaMap={circleMap}
          depthWrite={false}
          depthTest={false}
        />
      </points>
      <points ref={headPtsRef} geometry={headGeom} frustumCulled={false} renderOrder={12}>
        <pointsMaterial
          size={COMET_HEAD_SIZE}
          vertexColors
          sizeAttenuation
          transparent
          opacity={1}
          alphaMap={circleMap}
          depthWrite={false}
          depthTest={false}
        />
      </points>
    </group>
  )
}


function TextPositioner({
  active, headRef, wrapperRef,
}: {
  active: boolean
  headRef: React.MutableRefObject<THREE.Vector3>
  wrapperRef: React.MutableRefObject<HTMLDivElement | null>
}) {
  const { camera, size } = useThree()
  useFrame(() => {
    if (!active || !wrapperRef.current) return
    const pos = headRef.current.clone()
    pos.project(camera)
    const sx = (pos.x * 0.5 + 0.5) * size.width
    const sy = (-pos.y * 0.5 + 0.5) * size.height
    wrapperRef.current.style.transform = `translate(${sx + 22}px, ${sy - 52}px)`
  })
  return null
}

// ─── Main export ─────────────────────────────────────────────────────────────

const langBtn: React.CSSProperties = {
  padding: '0.85rem 2rem',
  minWidth: '5.5rem',
  background: 'rgba(255,255,255,0.06)',
  color: '#fff',
  border: '1px solid rgba(255,255,255,0.28)',
  borderRadius: '8px',
  fontSize: 'clamp(1.35rem, 2.8vw, 1.85rem)',
  fontWeight: 600,
  letterSpacing: '0.16em',
  backdropFilter: 'blur(4px)',
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
}

const LANG_OPTIONS: { code: Lang; label: string }[] = [
  { code: 'eng', label: 'EN' },
  { code: 'esp', label: 'ES' },
  { code: 'rus', label: 'RU' },
]

const REPLAY_LABEL: Record<Lang, string> = {
  eng: 'Launch comet →',
  esp: 'Lanzar cometa →',
  rus: 'Запустить комету →',
}

const replayBtn: React.CSSProperties = {
  padding: 0,
  background: 'none',
  border: 'none',
  fontFamily: unbounded.style.fontFamily,
  fontSize: 'clamp(2.35rem, 5.2vw, 4.5rem)',
  fontWeight: 700,
  letterSpacing: '-0.02em',
  lineHeight: 1.05,
}

export default function SpherePoints() {
  const [meteorActive, setMeteorActive] = useState(false)
  const [meteorLoading, setMeteorLoading] = useState(false)
  const [customCursor, setCustomCursor] = useState(false)
  const [showTypewriter, setShowTypewriter] = useState(false)
  const [showServiceWords, setShowServiceWords] = useState(false)
  const [exploded, setExploded] = useState(false)
  const [scenarioId, setScenarioId] = useState(0)
  const [selectedLang, setSelectedLang] = useState<Lang | null>(null)
  const [selectedShape, setSelectedShape] = useState<ServiceShape | null>(null)
  const [buildingShape, setBuildingShape] = useState<ServiceShape | null>(null)
  const [shapeBuildProgress, setShapeBuildProgress] = useState(0)

  const cursorRef = useRef({ x: 0, y: 0 })
  const loadingTextRef = useRef<HTMLSpanElement>(null)
  const loadingWrapperRef = useRef<HTMLDivElement | null>(null)
  const textZoneRef = useRef({ active: false, leftX: 0 })
  const meteorHeadRef = useRef(new THREE.Vector3(METEOR_START.x, METEOR_START.y, METEOR_START.z))
  const explosionRef = useRef<ExplosionState>({ phase: 'none', preburstU: 0 })
  const typewriterTriggeredRef = useRef(false)
  const typewriterTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const serviceWordsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const selectedShapeRef = useRef<ServiceShape | null>(null)
  const shapeBlendRef = useRef(0)
  const shapeBuildStartRef = useRef(0)
  const shapeBuildProgressRef = useRef(0)
  const shapeSlotsRef = useRef<Float32Array | null>(null)
  const appPhoneBuildURef = useRef<Float32Array | null>(null)
  const appPhoneLockedRef = useRef<Float32Array | null>(null)
  const cometHoverTintRef = useRef<CometHoverTint>('default')
  const cometTintBlendRef = useRef(0)
  const cometMirrorRef = useRef<CometMirrorSnapshot>({
    active: false,
    scatterActive: false,
    headWorldX: 0,
    headWorldY: 0,
    headWorldZ: 0,
    mirrorParticleCount: 0,
    headPos: new Float32Array(COMET_POINT_COUNT * 3),
    tailPos: new Float32Array(COMET_TAIL_COUNT * 3),
    tailCol: new Float32Array(COMET_TAIL_COUNT * 3),
    headReformU: new Float32Array(COMET_POINT_COUNT),
    tailReformU: new Float32Array(COMET_TAIL_COUNT),
    headSize: COMET_HEAD_SIZE,
    headGlowSize: COMET_HEAD_SIZE * COMET_GLOW_SIZE,
    headGlowOpacity: 0,
    tailSize: COMET_TRAIL_SIZE,
    tailOpacity: 0.92,
  })

  const clearTypewriterTimer = useCallback(() => {
    if (typewriterTimerRef.current !== null) {
      clearTimeout(typewriterTimerRef.current)
      typewriterTimerRef.current = null
    }
  }, [])

  const clearServiceWordsTimer = useCallback(() => {
    if (serviceWordsTimerRef.current !== null) {
      clearTimeout(serviceWordsTimerRef.current)
      serviceWordsTimerRef.current = null
    }
  }, [])

  const showLanguagePicker = scenarioId === 0 && !meteorActive
  const showReplay = selectedLang !== null && !meteorActive

  const showFollowComet = (scenarioId === 0 && !meteorActive) || customCursor
  const showViewportComet = showFollowComet
  const showCursorMirror = meteorActive && exploded && !customCursor

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    cursorRef.current.x = ((e.clientX - r.left) / r.width) * 2 - 1
    cursorRef.current.y = -((e.clientY - r.top) / r.height) * 2 + 1
  }, [])

  useEffect(() => {
    if (scenarioId === 0) return
    const start = performance.now()
    let raf: number
    const tick = () => {
      const t = Math.min(1, (performance.now() - start) / LOADING_DURATION)
      if (loadingTextRef.current) loadingTextRef.current.textContent = `${Math.round(t * 100)}%`
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [scenarioId])

  const startScenario = useCallback(() => {
    setExploded(false)
    setMeteorActive(true)
    setMeteorLoading(true)
    setCustomCursor(false)
    setShowTypewriter(false)
    setShowServiceWords(false)
    clearServiceWordsTimer()
    setSelectedShape(null)
    setBuildingShape(null)
    setShapeBuildProgress(0)
    selectedShapeRef.current = null
    shapeBlendRef.current = 0
    shapeBuildStartRef.current = 0
    shapeBuildProgressRef.current = 0
    shapeSlotsRef.current = null
    appPhoneBuildURef.current = null
    appPhoneLockedRef.current = null
    cometHoverTintRef.current = 'default'
    cometTintBlendRef.current = 0
    typewriterTriggeredRef.current = false
    clearTypewriterTimer()
    textZoneRef.current.active = false
    meteorHeadRef.current.copy(METEOR_START)
    explosionRef.current = { phase: 'none', preburstU: 0 }
    setScenarioId(n => n + 1)
  }, [clearTypewriterTimer, clearServiceWordsTimer])

  const handleLanguagePick = useCallback((lang: Lang) => {
    setSelectedLang(lang)
    startScenario()
  }, [startScenario])

  const replayScenario = useCallback(() => {
    textZoneRef.current.active = false
    typewriterTriggeredRef.current = false
    clearTypewriterTimer()
    clearServiceWordsTimer()
    startScenario()
  }, [clearTypewriterTimer, clearServiceWordsTimer, startScenario])

  const handlePointsLayoutProgress = useCallback((rightHalfRatio: number) => {
    if (typewriterTriggeredRef.current) return
    if (rightHalfRatio < POINTS_TYPEWRITER_RIGHT_RATIO) return
    typewriterTriggeredRef.current = true
    typewriterTimerRef.current = setTimeout(() => {
      typewriterTimerRef.current = null
      setShowTypewriter(true)
      clearServiceWordsTimer()
      serviceWordsTimerRef.current = setTimeout(() => {
        serviceWordsTimerRef.current = null
        setShowServiceWords(true)
      }, SERVICE_WORDS_DELAY_MS)
    }, COMET_TYPEWRITER_DELAY_MS)
  }, [clearTypewriterTimer, clearServiceWordsTimer])

  const handleExplosionComplete = useCallback(() => {
    setMeteorActive(false)
    setCustomCursor(true)
  }, [])

  const handleMeteorImpact = useCallback(() => {
    setMeteorLoading(false)
    setExploded(true)
  }, [])

  const handleSelectShape = useCallback((shape: ServiceShape) => {
    setSelectedShape(shape)
    setBuildingShape(shape)
    setShapeBuildProgress(0)
    selectedShapeRef.current = shape
    shapeBlendRef.current = 0
    shapeBuildProgressRef.current = 0
    shapeBuildStartRef.current = performance.now()
    if (shape === 'app') {
      shapeSlotsRef.current = null
      appPhoneBuildURef.current = initAppPhoneBuildU()
      appPhoneLockedRef.current = initAppPhoneLocked()
    } else {
      appPhoneBuildURef.current = null
      appPhoneLockedRef.current = null
      shapeSlotsRef.current = initShapeParticleSlots(shape)
    }
  }, [])

  useEffect(() => {
    if (!buildingShape) return
    let raf = 0
    let lastPct = -1
    let doneTimer: ReturnType<typeof setTimeout> | null = null
    const tick = () => {
      const p = shapeBuildProgressRef.current
      const pct = Math.round(p * 100)
      if (pct !== lastPct) {
        lastPct = pct
        setShapeBuildProgress(p)
      }
      if (p < 1) {
        raf = requestAnimationFrame(tick)
      } else {
        setShapeBuildProgress(1)
        doneTimer = setTimeout(() => setBuildingShape(null), 500)
      }
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      if (doneTimer !== null) clearTimeout(doneTimer)
    }
  }, [buildingShape])

  const handleHoverServiceShape = useCallback((shape: ServiceShape) => {
    cometHoverTintRef.current = shape
  }, [])

  const handleLeaveServiceShape = useCallback(() => {
    cometHoverTintRef.current = 'default'
  }, [])

  const siteUi = (
    <>
      {showLanguagePicker && (
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: 'clamp(14vh, 18vh, 22vh)',
            transform: 'translateX(-50%)',
            zIndex: 20,
            display: 'flex',
            gap: '1.25rem',
            pointerEvents: 'auto',
          }}
        >
          {LANG_OPTIONS.map(({ code, label }) => (
            <button
              key={code}
              type="button"
              onClick={() => handleLanguagePick(code)}
              style={langBtn}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      <TypewriterPanel
        visible={showTypewriter}
        lang={selectedLang}
        textZoneRef={textZoneRef}
      />

      <ServiceIconsRow
        visible={showServiceWords}
        lang={selectedLang}
        selectedShape={selectedShape}
        buildingShape={buildingShape}
        buildProgress={shapeBuildProgress}
        onSelectShape={handleSelectShape}
        onHoverShape={handleHoverServiceShape}
        onLeaveShape={handleLeaveServiceShape}
      />

      {showReplay && selectedLang && (
        <div
          style={{
            position: 'absolute',
            bottom: 'clamp(1.5rem, 4vh, 2.5rem)',
            left: '50%',
            right: 'auto',
            transform: 'translateX(-50%)',
            zIndex: 20,
            pointerEvents: 'auto',
            opacity: 1,
            transition: 'opacity 0.4s',
          }}
        >
          <button
            type="button"
            className="replay-btn-cycle"
            onClick={replayScenario}
            style={replayBtn}
          >
            {REPLAY_LABEL[selectedLang]}
          </button>
          <style>{`
            .replay-btn-cycle {
              background: linear-gradient(
                118deg,
                #ffffff 0%,
                #c8e0ff 38%,
                #ffd9a8 72%,
                #ffb86c 100%
              );
              -webkit-background-clip: text;
              background-clip: text;
              color: transparent;
              filter:
                drop-shadow(0 0 14px rgba(130, 190, 255, 0.55))
                drop-shadow(0 0 32px rgba(255, 170, 90, 0.18));
              transition: filter 0.25s, transform 0.25s;
            }
            .replay-btn-cycle:hover {
              filter:
                drop-shadow(0 0 18px rgba(130, 190, 255, 0.72))
                drop-shadow(0 0 36px rgba(255, 170, 90, 0.28));
              transform: scale(1.02);
            }
          `}</style>
        </div>
      )}
    </>
  )

  return (
    <div
      className="site-viewport site-viewport--hide-cursor"
      style={{
        background: '#05070D',
      }}
      onMouseMove={handleMouseMove}
    >
      {(showViewportComet || showCursorMirror) && (
        <div className="site-cursor-layer">
          <Canvas
            camera={{ position: [0, 0, 5], fov: 60 }}
            style={{ display: 'block', width: '100%', height: '100%', pointerEvents: 'none' }}
            gl={{ antialias: true, powerPreference: 'high-performance' }}
          >
            {showViewportComet && (
              <Comet
                mode="follow"
                scenarioId={scenarioId}
                cursorRef={cursorRef}
                headRef={meteorHeadRef}
                explosionRef={explosionRef}
                hoverTintRef={cometHoverTintRef}
                tintBlendRef={cometTintBlendRef}
              />
            )}
            {showCursorMirror && (
              <CometCursorMirror
                mirrorRef={cometMirrorRef}
                hoverTintRef={cometHoverTintRef}
                tintBlendRef={cometTintBlendRef}
              />
            )}
          </Canvas>
        </div>
      )}

      <div className="site-track">
        <section
          style={{
            position: 'relative',
            width: '100%',
            height: '100%',
          }}
        >
          <div className="site-particles">
            <Canvas
              camera={{ position: [0, 0, 5], fov: 60 }}
              style={{ display: 'block', width: '100%', height: '100%', pointerEvents: 'none' }}
              gl={{ antialias: true, powerPreference: 'high-performance' }}
              onCreated={({ gl }) => {
                const canvas = gl.domElement
                canvas.addEventListener('webglcontextlost', (e) => {
                  e.preventDefault()
                })
                canvas.addEventListener('webglcontextrestored', () => {
                  gl.resetState()
                })
              }}
            >
              <Points
                scenarioId={scenarioId}
                cursorRef={cursorRef}
                exploded={exploded}
                cometActive={meteorActive || customCursor}
                cometHeadRef={meteorHeadRef}
                explosionRef={explosionRef}
                onPointsLayoutProgress={handlePointsLayoutProgress}
                selectedShapeRef={selectedShapeRef}
                shapeBlendRef={shapeBlendRef}
                shapeBuildStartRef={shapeBuildStartRef}
                shapeBuildProgressRef={shapeBuildProgressRef}
                shapeSlotsRef={shapeSlotsRef}
                appPhoneBuildURef={appPhoneBuildURef}
                appPhoneLockedRef={appPhoneLockedRef}
              />
              {meteorActive && (
                <Comet
                  mode="scenario"
                  scenarioId={scenarioId}
                  cursorRef={cursorRef}
                  onImpact={handleMeteorImpact}
                  onComplete={handleExplosionComplete}
                  headRef={meteorHeadRef}
                  explosionRef={explosionRef}
                  debrisOnly
                  mirrorRef={cometMirrorRef}
                />
              )}
              <TextPositioner active={meteorLoading} headRef={meteorHeadRef} wrapperRef={loadingWrapperRef} />
            </Canvas>

            <div
              ref={loadingWrapperRef}
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                transform: 'translate(-300px, -300px)',
                pointerEvents: 'none',
                opacity: meteorLoading ? 1 : 0,
                transition: 'opacity 0.35s',
                willChange: 'transform',
              }}
            >
              <span
                ref={loadingTextRef}
                style={{
                  fontFamily: 'monospace',
                  fontSize: '3rem',
                  fontWeight: 700,
                  color: 'rgba(255,255,255,0.22)',
                  lineHeight: 1,
                  whiteSpace: 'nowrap',
                }}
              >
                0%
              </span>
            </div>
          </div>
        </section>
      </div>

      <div className="site-ui">{siteUi}</div>
    </div>
  )
}
