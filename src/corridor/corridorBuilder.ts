import * as THREE from 'three';
import worldGraphData from '../../content/world.graph.json';
import { t } from '../i18n/strings';
import { OnboardingVisualState } from '../onboarding/types';
import { CorridorBranch } from '../room-sdk';
import { spatialAudioSystem } from '../systems/audio/spatialAudioSystem';
import { nebulaSkySystem } from '../systems/sky/nebulaSkySystem';
import { HubPlayerState } from '../state/playerState';

export interface WorldGraphNode {
  id: string;
  title: string;
  titleRu?: string;
  symbol: string;
  dimension: string;
  branch: CorridorBranch;
  segment: 1 | 2 | 3;
  status: 'ready' | 'planned';
  repo: string;
  ref: string;
  entryHash: string;
}

export type PausePanelActionId =
  | 'resume'
  | 'mute'
  | 'master-up'
  | 'master-down'
  | 'music-up'
  | 'music-down'
  | 'ambient-up'
  | 'ambient-down'
  | 'sfx-up'
  | 'sfx-down'
  | 'voice-up'
  | 'voice-down'
  | 'return-corridor'
  | 'open-codex';

export interface SpatialInteractiveTarget {
  id: string;
  kind:
    | 'onboarding-pedestal'
    | 'comfort-posture'
    | 'locomotion-switch'
    | 'threshold-branch'
    | 'corridor-door'
    | 'segment-portal'
    | 'room-door'
    | 'room-object'
    | 'room-mirror'
    | 'artwork'
    | 'corridor-return'
    | 'pause-action';
  title: string;
  titleRu: string;
  subtitle: string;
  subtitleRu: string;
  branch?: CorridorBranch;
  segment?: 1 | 2 | 3;
  roomId?: string;
  doorId?: 'A' | 'B' | 'C' | 'RH';
  objectId?: string;
  mirrorChoice?: 'accept' | 'reject' | 'back';
  seatedChoice?: boolean;
  status?: 'ready' | 'planned';
  pauseAction?: PausePanelActionId;
}

export function getWorldNodes(): WorldGraphNode[] {
  return (worldGraphData.nodes as WorldGraphNode[]) ?? [];
}

const signageTextureCache = new Map<string, THREE.CanvasTexture>();
const MAX_SIGNAGE_CACHE_ENTRIES = 512;

export function clearSignageTextureCache(): void {
  for (const tex of signageTextureCache.values()) {
    if (tex.userData) {
      tex.userData.cachedSignage = false;
    }
    tex.dispose();
  }
  signageTextureCache.clear();
}

function storeCachedSignageTexture(
  cacheKey: string,
  tex: THREE.CanvasTexture
): THREE.CanvasTexture {
  tex.userData = { cachedSignage: true };
  const onDispose = () => {
    signageTextureCache.delete(cacheKey);
    tex.removeEventListener('dispose', onDispose);
  };
  tex.addEventListener('dispose', onDispose);

  if (signageTextureCache.size >= MAX_SIGNAGE_CACHE_ENTRIES) {
    const oldestKey = signageTextureCache.keys().next().value;
    if (oldestKey !== undefined) {
      const oldestTex = signageTextureCache.get(oldestKey);
      signageTextureCache.delete(oldestKey);
      if (oldestTex) {
        if (oldestTex.userData) {
          oldestTex.userData.cachedSignage = false;
        }
        oldestTex.dispose();
      }
    }
  }
  signageTextureCache.set(cacheKey, tex);
  return tex;
}

/**
 * Power-of-Two (1024x512) High-Contrast VR & Desktop Legible Sci-Fi / Gothic Portal Display Texture
 * (EXPERIENCE_PROTOCOL.md §3.4 & TZ.md §4.4).
 * Uses 1024x512 resolution, 4x anisotropy, deep obsidian backing, and high-contrast sans-serif
 * typography with thick dark halo outline strokes so text is effortless to read in VR headsets and on desktop.
 */
export function createSignageTexture(
  symbol: string,
  title: string,
  subtitle: string,
  statusBadge: string,
  accentHex: string,
  badgeHex: string
): THREE.CanvasTexture {
  const cacheKey = `SIGN_V2|${symbol}|${title}|${subtitle}|${statusBadge}|${accentHex}|${badgeHex}`;
  const cached = signageTextureCache.get(cacheKey);
  if (cached) {
    signageTextureCache.delete(cacheKey);
    signageTextureCache.set(cacheKey, cached);
    return cached;
  }

  if (typeof document === 'undefined') {
    const tex = new THREE.DataTexture(
      new Uint8Array(8 * 8 * 4),
      8,
      8
    ) as unknown as THREE.CanvasTexture;
    tex.needsUpdate = true;
    return storeCachedSignageTexture(cacheKey, tex);
  }
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  // High-contrast deep obsidian backing (zero noisy scanlines over text!)
  const bgGrad = ctx.createLinearGradient(0, 0, 0, 512);
  bgGrad.addColorStop(0, '#050814');
  bgGrad.addColorStop(0.5, '#03050c');
  bgGrad.addColorStop(1, '#020308');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, 1024, 512);

  // Soft ambient edge glow keeping center text zone dark & high-contrast
  const topWash = ctx.createRadialGradient(512, 36, 16, 512, 80, 520);
  topWash.addColorStop(0, `${accentHex}38`);
  topWash.addColorStop(0.6, 'rgba(15, 23, 42, 0.15)');
  topWash.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = topWash;
  ctx.fillRect(0, 0, 1024, 512);

  // Bold Sci-Fi / Gothic double neon frame
  ctx.strokeStyle = accentHex;
  ctx.lineWidth = 7;
  ctx.strokeRect(10, 10, 1004, 492);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
  ctx.lineWidth = 2.5;
  ctx.strokeRect(24, 24, 976, 464);

  // Corner luminous brackets
  ctx.fillStyle = accentHex;
  [
    [10, 10],
    [986, 10],
    [10, 474],
    [986, 474],
  ].forEach(([cx, cy]) => {
    ctx.fillRect(cx, cy, 28, 28);
  });

  // Left symbol glyph badge box
  ctx.fillStyle = '#070d1e';
  ctx.fillRect(42, 46, 224, 420);
  ctx.strokeStyle = accentHex;
  ctx.lineWidth = 4;
  ctx.strokeRect(42, 46, 224, 420);

  // Pointed gothic inner arch motif inside glyph box
  ctx.strokeStyle = `${accentHex}99`;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(58, 444);
  ctx.lineTo(58, 164);
  ctx.quadraticCurveTo(58, 76, 154, 62);
  ctx.quadraticCurveTo(250, 76, 250, 164);
  ctx.lineTo(250, 444);
  ctx.stroke();

  const drawCrispText = (
    text: string,
    x: number,
    y: number,
    font: string,
    fill: string,
    align: CanvasTextAlign = 'left',
    strokeWidth = 8,
    maxWidth?: number
  ) => {
    ctx.save();
    ctx.font = font;
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.miterLimit = 2;
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = strokeWidth;
    if (maxWidth) {
      ctx.strokeText(text, x, y, maxWidth);
      ctx.fillStyle = fill;
      ctx.fillText(text, x, y, maxWidth);
    } else {
      ctx.strokeText(text, x, y);
      ctx.fillStyle = fill;
      ctx.fillText(text, x, y);
    }
    ctx.restore();
  };

  // Large high-contrast symbol glyph
  drawCrispText(
    symbol.slice(0, 5),
    154,
    262,
    '800 78px system-ui, -apple-system, "Segoe UI", sans-serif',
    '#ffffff',
    'center',
    10,
    196
  );

  // Main Title (Pure crisp white with black halo stroke, auto-fitted to 670px)
  const cleanTitle = title.slice(0, 32);
  const titleSize = cleanTitle.length > 22 ? 44 : 52;
  drawCrispText(
    cleanTitle,
    296,
    138,
    `800 ${titleSize}px system-ui, -apple-system, "Segoe UI", sans-serif`,
    '#ffffff',
    'left',
    9,
    676
  );

  // Subtitle (High-contrast luminous ice-white)
  drawCrispText(
    subtitle.slice(0, 42),
    296,
    244,
    '600 34px system-ui, -apple-system, "Segoe UI", sans-serif',
    '#eaf4ff',
    'left',
    7,
    676
  );

  // High-contrast divider line
  ctx.strokeStyle = accentHex;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(296, 312);
  ctx.lineTo(972, 312);
  ctx.stroke();

  // High-contrast status badge container
  ctx.fillStyle = '#081126';
  ctx.fillRect(296, 344, 520, 88);
  ctx.strokeStyle = badgeHex;
  ctx.lineWidth = 3.5;
  ctx.strokeRect(296, 344, 520, 88);

  drawCrispText(
    `◈ ${statusBadge.slice(0, 26)}`,
    320,
    388,
    '700 32px "JetBrains Mono", monospace',
    '#ffffff',
    'left',
    7,
    476
  );

  // Spectrum indicator bars on bottom right
  const barCols = ['#4ea8de', '#e5c158', '#b388ff', '#66cc99'];
  for (let b = 0; b < 6; b++) {
    ctx.fillStyle = barCols[b % barCols.length];
    const bh = 24 + ((b * 15) % 44);
    ctx.fillRect(844 + b * 20, 430 - bh, 12, bh);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = 4;
  tex.colorSpace = THREE.SRGBColorSpace;
  return storeCachedSignageTexture(cacheKey, tex);
}

/**
 * Power-of-Two (1024x384) Central Portal Overhead Banner Texture:
 * Displays `ARTMAZE // NEUROMICON PROJECT` and `github.com/AlexSheff/Neuromicon`
 * with ultra-crisp VR-legible high-contrast outlined typography.
 */
export function createArtmazeHeaderSignTexture(
  accentHex = '#e5c158',
  plasmaHex = '#9d4edd',
  repoUrl = 'github.com/AlexSheff/Neuromicon'
): THREE.CanvasTexture {
  const cacheKey = `HEADER_SIGN_V2|${accentHex}|${plasmaHex}|${repoUrl}`;
  const cached = signageTextureCache.get(cacheKey);
  if (cached) {
    signageTextureCache.delete(cacheKey);
    signageTextureCache.set(cacheKey, cached);
    return cached;
  }

  if (typeof document === 'undefined') {
    const tex = new THREE.DataTexture(
      new Uint8Array(8 * 8 * 4),
      8,
      8
    ) as unknown as THREE.CanvasTexture;
    tex.needsUpdate = true;
    return storeCachedSignageTexture(cacheKey, tex);
  }

  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 384;
  const ctx = canvas.getContext('2d')!;

  // High-contrast deep obsidian backing
  const bg = ctx.createLinearGradient(0, 0, 1024, 384);
  bg.addColorStop(0, '#040711');
  bg.addColorStop(0.5, '#070d1e');
  bg.addColorStop(1, '#040711');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 1024, 384);

  // Subtle radial glow behind text
  const glow = ctx.createRadialGradient(512, 192, 20, 512, 192, 480);
  glow.addColorStop(0, `${plasmaHex}40`);
  glow.addColorStop(0.6, `${accentHex}22`);
  glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, 1024, 384);

  // Bold neon contour frame
  ctx.strokeStyle = accentHex;
  ctx.lineWidth = 7;
  ctx.strokeRect(10, 10, 1004, 364);

  ctx.strokeStyle = '#6ad2ff';
  ctx.lineWidth = 3;
  ctx.strokeRect(24, 24, 976, 336);

  const drawOutlinedCenter = (
    text: string,
    y: number,
    font: string,
    fill: string,
    strokeW = 9
  ) => {
    ctx.save();
    ctx.font = font;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.miterLimit = 2;
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = strokeW;
    ctx.strokeText(text, 512, y, 930);
    ctx.fillStyle = fill;
    ctx.fillText(text, 512, y, 930);
    ctx.restore();
  };

  // Main Headline: ARTMAZE // NEUROMICON PROJECT
  drawOutlinedCenter(
    'ARTMAZE // NEUROMICON PROJECT',
    118,
    '800 52px system-ui, -apple-system, "Segoe UI", sans-serif',
    '#ffffff',
    10
  );

  // Glowing separator line
  ctx.strokeStyle = accentHex;
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.moveTo(140, 184);
  ctx.lineTo(884, 184);
  ctx.stroke();

  // GitHub Repository Link
  drawOutlinedCenter(
    `◈ https://${repoUrl.replace(/^https?:\/\//, '')} ◈`,
    246,
    '700 36px "JetBrains Mono", monospace',
    '#80e5ff',
    8
  );

  // Subtitle telemetry
  drawOutlinedCenter(
    'GOTHIC CATHEDRAL · QUARTZ PLASMA · 1149 MULTIDIMENSIONAL ROOMS',
    322,
    '700 24px "JetBrains Mono", monospace',
    '#ffe484',
    7
  );

  const tex = new THREE.CanvasTexture(canvas);
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = 4;
  tex.colorSpace = THREE.SRGBColorSpace;
  return storeCachedSignageTexture(cacheKey, tex);
}

/**
 * Power-of-Two (256x512) Swirling Living Plasma Texture for Quartz Glass Columns:
 * Renders helical filaments of violet, cosmic blue, and warm gold/amber plasma.
 */
export function createPlasmaVortexTexture(
  primaryHex = '#9d4edd',
  secondaryHex = '#4ea8de',
  goldHex = '#e5c158'
): THREE.CanvasTexture {
  const cacheKey = `PLASMA_TEX|${primaryHex}|${secondaryHex}|${goldHex}`;
  const cached = signageTextureCache.get(cacheKey);
  if (cached) {
    signageTextureCache.delete(cacheKey);
    signageTextureCache.set(cacheKey, cached);
    return cached;
  }

  if (typeof document === 'undefined') {
    const tex = new THREE.DataTexture(
      new Uint8Array(8 * 8 * 4),
      8,
      8
    ) as unknown as THREE.CanvasTexture;
    tex.needsUpdate = true;
    return storeCachedSignageTexture(cacheKey, tex);
  }

  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  // Deep translucent cosmic plasma core background
  const baseGrad = ctx.createLinearGradient(0, 0, 0, 512);
  baseGrad.addColorStop(0, 'rgba(18, 8, 38, 0.25)');
  baseGrad.addColorStop(0.25, `${primaryHex}66`);
  baseGrad.addColorStop(0.5, `${secondaryHex}77`);
  baseGrad.addColorStop(0.75, `${primaryHex}66`);
  baseGrad.addColorStop(1, 'rgba(18, 8, 38, 0.25)');
  ctx.fillStyle = baseGrad;
  ctx.fillRect(0, 0, 256, 512);

  // Swirling helical plasma streams (violet, cosmic blue, and warm gold)
  const streams = [
    { color: primaryHex, width: 18, phase: 0.0, freq: 2 },
    { color: secondaryHex, width: 14, phase: 2.1, freq: 3 },
    { color: goldHex, width: 10, phase: 4.2, freq: 2 },
    { color: '#ffffff', width: 4, phase: 2.1, freq: 3 },
  ];

  streams.forEach((st) => {
    ctx.strokeStyle = st.color;
    ctx.lineWidth = st.width;
    ctx.lineCap = 'round';
    for (let pass = 0; pass < 2; pass++) {
      ctx.beginPath();
      for (let y = 0; y <= 512; y += 8) {
        const tNorm = y / 512;
        const angle =
          tNorm * Math.PI * 2 * st.freq + st.phase + pass * Math.PI;
        const x = 128 + Math.sin(angle) * 86;
        if (y === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  });

  // Glowing plasma energy knots along the column height
  for (let k = 0; k < 10; k++) {
    const kx = 48 + ((k * 67) % 160);
    const ky = 36 + k * 46;
    const kr = 28 + (k % 3) * 14;
    const knot = ctx.createRadialGradient(kx, ky, 2, kx, ky, kr);
    const col = k % 3 === 0 ? goldHex : k % 3 === 1 ? primaryHex : secondaryHex;
    knot.addColorStop(0, '#ffffffdd');
    knot.addColorStop(0.35, `${col}bb`);
    knot.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = knot;
    ctx.fillRect(0, 0, 256, 512);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  return storeCachedSignageTexture(cacheKey, tex);
}

/**
 * Power-of-Two (512x512) Polished Dark Basalt Stone Floor Texture
 * with Sacred Geometry Lines, Recursive Fractals, and Glowing Electric Circuit Schematics.
 */
export function createCosmicFloorTexture(
  accentRgba: string,
  repeatX = 4,
  repeatY = 4
): THREE.CanvasTexture {
  if (typeof document === 'undefined') {
    const tex = new THREE.DataTexture(new Uint8Array(8 * 8 * 4), 8, 8);
    tex.needsUpdate = true;
    return tex as unknown as THREE.CanvasTexture;
  }
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  // Deep mirror-polished dark basalt & slate base (#050811)
  ctx.fillStyle = '#060913';
  ctx.fillRect(0, 0, 512, 512);

  // 4x4 dark basalt slabs with subtle obsidian mineral sheen
  const tileSize = 128;
  for (let ty = 0; ty < 4; ty++) {
    for (let tx = 0; tx < 4; tx++) {
      const shade = ((tx * 3 + ty * 5) % 4) * 2;
      ctx.fillStyle = `rgb(${8 + shade}, ${11 + shade}, ${20 + shade})`;
      ctx.fillRect(
        tx * tileSize + 2,
        ty * tileSize + 2,
        tileSize - 4,
        tileSize - 4
      );
      ctx.strokeStyle = 'rgba(130, 175, 240, 0.06)';
      ctx.lineWidth = 1;
      ctx.strokeRect(
        tx * tileSize + 4,
        ty * tileSize + 4,
        tileSize - 8,
        tileSize - 8
      );
    }
  }

  // Subtle basalt mineral cleavage grain
  for (let i = 0; i < 380; i++) {
    const gx = (i * 173) % 512;
    const gy = (i * 311) % 512;
    ctx.fillStyle =
      i % 2 === 0 ? 'rgba(180, 210, 255, 0.03)' : 'rgba(2, 4, 9, 0.08)';
    ctx.fillRect(gx, gy, 2, 2);
  }

  // Soft plasma & amber reflection pool across the polished stone
  const grad = ctx.createRadialGradient(256, 256, 16, 256, 256, 340);
  grad.addColorStop(0, accentRgba);
  grad.addColorStop(0.55, 'rgba(123, 44, 191, 0.12)');
  grad.addColorStop(1, 'rgba(5, 7, 14, 0.25)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 512);

  // 1. SACRED GEOMETRY LINES & AXIAL GRID
  ctx.strokeStyle = 'rgba(229, 193, 88, 0.26)';
  ctx.lineWidth = 1.5;
  for (let i = 0; i <= 512; i += 128) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 512);
    ctx.moveTo(0, i);
    ctx.lineTo(512, i);
    ctx.stroke();
  }

  // 2. RECURSIVE FRACTAL STAR & HARMONIC MANDALA AT CENTER (256, 256)
  const fractalRadii = [210, 148, 104, 68, 36];
  fractalRadii.forEach((r, idx) => {
    ctx.strokeStyle =
      idx % 2 === 0
        ? 'rgba(229, 193, 88, 0.34)'
        : 'rgba(78, 168, 222, 0.32)';
    ctx.lineWidth = idx === 0 ? 2 : 1.3;
    ctx.beginPath();
    ctx.arc(256, 256, r, 0, Math.PI * 2);
    ctx.stroke();

    // 8-fold recursive octagram star fractal vertices
    const points = 8;
    ctx.beginPath();
    for (let p = 0; p <= points; p++) {
      const a = (p * 3 * Math.PI * 2) / points + idx * (Math.PI / 8);
      const px = 256 + Math.cos(a) * r;
      const py = 256 + Math.sin(a) * r;
      if (p === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();

    // Sub-fractal satellite rings at the 8 vertices of level 1 & 2
    if (idx === 1 || idx === 2) {
      ctx.strokeStyle = 'rgba(179, 136, 255, 0.28)';
      ctx.lineWidth = 1;
      for (let v = 0; v < 8; v++) {
        const va = (v * Math.PI) / 4;
        const vx = 256 + Math.cos(va) * r;
        const vy = 256 + Math.sin(va) * r;
        ctx.beginPath();
        ctx.arc(vx, vy, r * 0.24, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  });

  // 3. ELECTRIC CIRCUIT SCHEMATICS (45-degree routed PCB traces & glowing via nodes)
  const circuitPaths: Array<{
    color: string;
    pts: Array<[number, number]>;
  }> = [
    {
      color: 'rgba(78, 168, 222, 0.42)',
      pts: [
        [0, 64],
        [96, 64],
        [144, 112],
        [144, 192],
        [208, 256],
      ],
    },
    {
      color: 'rgba(229, 193, 88, 0.42)',
      pts: [
        [512, 64],
        [416, 64],
        [368, 112],
        [368, 192],
        [304, 256],
      ],
    },
    {
      color: 'rgba(179, 136, 255, 0.42)',
      pts: [
        [0, 448],
        [96, 448],
        [144, 400],
        [144, 320],
        [208, 256],
      ],
    },
    {
      color: 'rgba(78, 168, 222, 0.42)',
      pts: [
        [512, 448],
        [416, 448],
        [368, 400],
        [368, 320],
        [304, 256],
      ],
    },
    {
      color: 'rgba(229, 193, 88, 0.36)',
      pts: [
        [64, 0],
        [64, 88],
        [112, 136],
        [256, 136],
      ],
    },
    {
      color: 'rgba(179, 136, 255, 0.36)',
      pts: [
        [448, 512],
        [448, 424],
        [400, 376],
        [256, 376],
      ],
    },
  ];

  circuitPaths.forEach((cp) => {
    ctx.strokeStyle = cp.color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    cp.pts.forEach(([x, y], i) => {
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Glowing circuit via pads at vertices
    ctx.fillStyle = cp.color;
    cp.pts.forEach(([x, y]) => {
      ctx.beginPath();
      ctx.arc(x, y, 3.5, 0, Math.PI * 2);
      ctx.fill();
    });
  });

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = 4;
  tex.generateMipmaps = true;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Power-of-Two (512x512) Dark Basalt & Slate Gothic Cathedral Wall Texture:
 * Absorbs harsh light into deep shadows while framing pointed Gothic Lancet Arches,
 * rose tracery crowns, and subtle plasma accent halos.
 */
export function createArchitecturalWallTexture(
  baseHex: string,
  accentHex: string,
  sconceGlowHex = '#b388ff',
  repeatX = 4,
  repeatY = 1
): THREE.CanvasTexture {
  if (typeof document === 'undefined') {
    const tex = new THREE.DataTexture(new Uint8Array(8 * 8 * 4), 8, 8);
    tex.needsUpdate = true;
    return tex as unknown as THREE.CanvasTexture;
  }
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  // Deep light-absorbing basalt & slate base
  ctx.fillStyle = baseHex;
  ctx.fillRect(0, 0, 512, 512);

  // Atmospheric twilight vertical gradient: upper vaults recede into darkness, subtle plasma bounce in mid-lower register
  const vGrad = ctx.createLinearGradient(0, 0, 0, 512);
  vGrad.addColorStop(0, 'rgba(3, 5, 11, 0.85)');
  vGrad.addColorStop(0.32, `${sconceGlowHex}1c`);
  vGrad.addColorStop(0.68, 'rgba(6, 9, 18, 0.45)');
  vGrad.addColorStop(1, `${accentHex}22`);
  ctx.fillStyle = vGrad;
  ctx.fillRect(0, 0, 512, 512);

  // Ashlar basalt stone masonry courses
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.035)';
  ctx.lineWidth = 1;
  for (let row = 0; row < 16; row++) {
    const y = row * 32;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(512, y);
    ctx.stroke();
    const offset = (row % 2) * 64;
    for (let col = offset; col < 512; col += 128) {
      ctx.beginPath();
      ctx.moveTo(col, y);
      ctx.lineTo(col, y + 32);
      ctx.stroke();
    }
  }

  // 2 Gothic Pointed Lancet Arch Bays per 512px repeat
  for (let bx = 0; bx < 2; bx++) {
    const x0 = bx * 256;
    const cx = x0 + 128;

    // Deep recessed gothic blind arcade bay
    ctx.fillStyle = 'rgba(3, 5, 10, 0.52)';
    ctx.beginPath();
    ctx.moveTo(x0 + 26, 480);
    ctx.lineTo(x0 + 26, 170);
    ctx.quadraticCurveTo(x0 + 26, 62, cx, 28);
    ctx.quadraticCurveTo(x0 + 230, 62, x0 + 230, 170);
    ctx.lineTo(x0 + 230, 480);
    ctx.closePath();
    ctx.fill();

    // Outer & inner Gothic pointed arch ribs
    ctx.strokeStyle = `${accentHex}66`;
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.strokeStyle = 'rgba(157, 78, 221, 0.35)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x0 + 40, 472);
    ctx.lineTo(x0 + 40, 176);
    ctx.quadraticCurveTo(x0 + 40, 82, cx, 48);
    ctx.quadraticCurveTo(x0 + 216, 82, x0 + 216, 176);
    ctx.lineTo(x0 + 216, 472);
    ctx.stroke();

    // Gothic Rose / Trefoil Tracery Window in the upper lancet arch
    ctx.strokeStyle = `${accentHex}55`;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc(cx, 118, 34, 0, Math.PI * 2);
    ctx.stroke();
    for (let p = 0; p < 6; p++) {
      const pa = (p * Math.PI) / 3;
      ctx.beginPath();
      ctx.arc(
        cx + Math.cos(pa) * 16,
        118 + Math.sin(pa) * 16,
        12,
        0,
        Math.PI * 2
      );
      ctx.stroke();
    }

    // Clustered vertical gothic mullion ribs
    ctx.strokeStyle = 'rgba(200, 220, 255, 0.06)';
    ctx.lineWidth = 1.5;
    [x0 + 84, cx, x0 + 172].forEach((mx) => {
      ctx.beginPath();
      ctx.moveTo(mx, 154);
      ctx.lineTo(mx, 472);
      ctx.stroke();
    });

    // Subtle localized plasma accent halo in the center of the gothic arch
    const halo = ctx.createRadialGradient(cx, 190, 6, cx, 190, 110);
    halo.addColorStop(0, `${sconceGlowHex}2e`);
    halo.addColorStop(0.55, `${accentHex}16`);
    halo.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = halo;
    ctx.fillRect(x0, 40, 256, 300);
  }

  // Basalt & bronze triforium stringcourses
  ctx.fillStyle = `${accentHex}55`;
  ctx.fillRect(0, 20, 512, 4);
  ctx.fillRect(0, 348, 512, 4);
  ctx.fillRect(0, 488, 512, 5);

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = 4;
  tex.generateMipmaps = true;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Power-of-Two (256x512) Sci-Fi / Gothic Dimensional Portal Vortex Texture:
 * Replaces flat door panels with a glowing non-Euclidean event-horizon vortex,
 * concentric Gothic-Tech portal rings, radial induction conduits, and built-in telemetry HUD.
 */
export function createDoorLeafTexture(
  baseHex: string,
  accentHex: string,
  plasmaHex = '#9d4edd'
): THREE.CanvasTexture {
  if (typeof document === 'undefined') {
    const tex = new THREE.DataTexture(new Uint8Array(8 * 8 * 4), 8, 8);
    tex.needsUpdate = true;
    return tex as unknown as THREE.CanvasTexture;
  }
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  // Deep cosmic event-horizon base
  ctx.fillStyle = baseHex;
  ctx.fillRect(0, 0, 256, 512);

  // Dimensional Portal Vortex Field: multi-stop glowing nebula & plasma singularity
  const portalVista = ctx.createRadialGradient(128, 224, 6, 128, 224, 235);
  portalVista.addColorStop(0, '#ffffffea');
  portalVista.addColorStop(0.14, accentHex);
  portalVista.addColorStop(0.42, `${plasmaHex}cc`);
  portalVista.addColorStop(0.76, 'rgba(9, 15, 34, 0.92)');
  portalVista.addColorStop(1, '#040710');
  ctx.fillStyle = portalVista;
  ctx.fillRect(14, 14, 228, 484);

  // Concentric non-Euclidean portal ripples & radial power feed traces inside the vortex
  const ringRadii = [34, 58, 84, 112, 142];
  ringRadii.forEach((r, idx) => {
    ctx.strokeStyle = idx % 2 === 0 ? `${accentHex}cc` : `${plasmaHex}aa`;
    ctx.lineWidth = idx === 0 ? 2.6 : 1.6;
    ctx.beginPath();
    ctx.ellipse(128, 224, r * 0.72, r * 1.18, 0, 0, Math.PI * 2);
    ctx.stroke();
  });

  // 12 radial induction spokes feeding from the outer portal ring into the singularity core
  ctx.strokeStyle = `${accentHex}66`;
  ctx.lineWidth = 1.2;
  for (let i = 0; i < 12; i++) {
    const a = (i * Math.PI) / 6;
    ctx.beginPath();
    ctx.moveTo(128 + Math.cos(a) * 24, 224 + Math.sin(a) * 38);
    ctx.lineTo(128 + Math.cos(a) * 102, 224 + Math.sin(a) * 165);
    ctx.stroke();
  }

  // Star & plasma sparks suspended in the portal horizon
  for (let s = 0; s < 54; s++) {
    const sx = 28 + ((s * 59) % 200);
    const sy = 32 + ((s * 83) % 440);
    ctx.fillStyle = s % 3 === 0 ? accentHex : '#ffffffdd';
    ctx.fillRect(sx, sy, s % 4 === 0 ? 2.2 : 1.5, s % 4 === 0 ? 2.2 : 1.5);
  }

  // Outer Sci-Fi / Gothic Neon Portal Containment Frame
  ctx.strokeStyle = accentHex;
  ctx.lineWidth = 5;
  ctx.strokeRect(8, 8, 240, 496);

  // Pointed Gothic-Sci-Fi Arch Containment Contour
  ctx.strokeStyle = '#ffffffdd';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(22, 490);
  ctx.lineTo(22, 164);
  ctx.quadraticCurveTo(22, 44, 128, 20);
  ctx.quadraticCurveTo(234, 44, 234, 164);
  ctx.lineTo(234, 490);
  ctx.stroke();

  // Built-in Sci-Fi Telemetry HUD Overlay at lower portal threshold
  ctx.fillStyle = 'rgba(4, 8, 18, 0.84)';
  ctx.fillRect(38, 392, 180, 74);
  ctx.strokeStyle = accentHex;
  ctx.lineWidth = 1.8;
  ctx.strokeRect(38, 392, 180, 74);

  ctx.fillStyle = accentHex;
  ctx.font = '600 11px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('PORTAL // CONDUIT ONLINE', 128, 412);

  for (let i = 0; i < 14; i++) {
    const bh = 8 + ((i * 13) % 26);
    ctx.fillStyle = i % 2 === 0 ? accentHex : plasmaHex;
    ctx.fillRect(50 + i * 11, 454 - bh, 7, bh);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Soft 2D Radial + Vertical Falloff Alpha Texture for Oculus & Plasma Veils (§3.3 & TZ.md §4.4).
 * Ensures light beams dissolve smoothly without sharp cone edges.
 */
export function createLightShaftAlphaTexture(
  accentHex = '#e5c158'
): THREE.CanvasTexture {
  if (typeof document === 'undefined') {
    const tex = new THREE.DataTexture(new Uint8Array(8 * 8 * 4), 8, 8);
    tex.needsUpdate = true;
    return tex as unknown as THREE.CanvasTexture;
  }
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, `${accentHex}58`);
  grad.addColorStop(0.38, '#9d4edd28');
  grad.addColorStop(0.78, `${accentHex}0c`);
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 256);
  const tex = new THREE.CanvasTexture(canvas);
  tex.generateMipmaps = true;
  return tex;
}

/**
 * Reusable Builder: Tall Transparent Quartz Glass Plasma Column with Swirling Living Plasma,
 * Soft Pulsating Diffused Floor Pool, and Periodic Branching Electric Lightning Arcs!
 */
export function buildQuartzPlasmaColumn(opts: {
  x: number;
  z: number;
  height: number;
  radius?: number;
  primaryHex: string;
  secondaryHex: string;
  goldHex: string;
  basaltMat: THREE.Material;
  trimMat: THREE.Material;
  phaseSeed: number;
}): THREE.Group {
  const {
    x,
    z,
    height,
    radius = 0.42,
    primaryHex,
    secondaryHex,
    goldHex,
    basaltMat,
    trimMat,
    phaseSeed,
  } = opts;

  const colGroup = new THREE.Group();
  colGroup.position.set(x, 0, z);

  const glassHeight = Math.max(2.2, height - 1.1);
  const glassCenterY = 0.55 + glassHeight * 0.5;

  // 1. Gothic Basalt Octagonal Plinth Base
  const basePlinth = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 1.18, radius * 1.42, 0.55, 8),
    basaltMat
  );
  basePlinth.position.y = 0.275;
  colGroup.add(basePlinth);

  // 2. Gothic Ribbed Capital with Plasma Containment Rim
  const capPlinth = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 1.45, radius * 1.15, 0.55, 8),
    trimMat
  );
  capPlinth.position.y = height - 0.275;
  colGroup.add(capPlinth);

  // 3. Outer Transparent Quartz Glass Cylinder (`прозрачные колонны из кварцевого стекла`)
  const quartzShell = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, glassHeight, 18, 1, true),
    new THREE.MeshStandardMaterial({
      color: '#d8eeff',
      roughness: 0.06,
      metalness: 0.92,
      transparent: true,
      opacity: 0.28,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
  );
  quartzShell.position.y = glassCenterY;
  colGroup.add(quartzShell);

  // 4. Inner Swirling Living Plasma Vortex Core (`внутри колонн вихрится живая плазма`)
  const plasmaTex = createPlasmaVortexTexture(primaryHex, secondaryHex, goldHex);
  const plasmaCore = new THREE.Mesh(
    new THREE.CylinderGeometry(
      radius * 0.64,
      radius * 0.64,
      glassHeight - 0.1,
      16,
      1,
      true
    ),
    new THREE.MeshBasicMaterial({
      map: plasmaTex,
      transparent: true,
      opacity: 0.88,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    })
  );
  plasmaCore.name = 'plasma_vortex_core';
  plasmaCore.userData = { phaseSeed };
  plasmaCore.position.y = glassCenterY;
  colGroup.add(plasmaCore);

  // 5. Periodic Branching Electric Lightning Discharge (`Редкие молнии внутри плазмы`)
  // Built as a single LineSegments geometry containing the main jagged bolt + 3 branching forks
  const boltVerts: number[] = [];
  const segments = 10;
  const yStart = 0.65;
  const yEnd = height - 0.65;
  let prevX = 0;
  let prevY = yStart;
  let prevZ = 0;

  for (let i = 1; i <= segments; i++) {
    const t01 = i / segments;
    const ny = yStart + (yEnd - yStart) * t01;
    const jitterAngle = (i * 2.39996 + phaseSeed) % (Math.PI * 2);
    const amp = (i === segments ? 0 : 1) * radius * 0.56;
    const nx = Math.cos(jitterAngle) * amp;
    const nz = Math.sin(jitterAngle) * amp;

    boltVerts.push(prevX, prevY, prevZ, nx, ny, nz);

    // Add branching lightning fork at mid-segments
    if (i === 3 || i === 6 || i === 8) {
      const forkAngle = jitterAngle + 1.15;
      const fx = nx + Math.cos(forkAngle) * radius * 0.45;
      const fy = ny - (yEnd - yStart) * 0.09;
      const fz = nz + Math.sin(forkAngle) * radius * 0.45;
      boltVerts.push(nx, ny, nz, fx, fy, fz);
    }

    prevX = nx;
    prevY = ny;
    prevZ = nz;
  }

  const boltGeo = new THREE.BufferGeometry();
  boltGeo.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(boltVerts, 3)
  );
  const boltMat = new THREE.LineBasicMaterial({
    color: '#e8f7ff',
    transparent: true,
    opacity: 0.0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const lightningArc = new THREE.LineSegments(boltGeo, boltMat);
  lightningArc.name = 'plasma_lightning_arc';
  lightningArc.userData = { phaseSeed };
  colGroup.add(lightningArc);

  // 6. Diffused Pulsating Floor Glow Pool (`мягкое, пульсирующее свечение на полу`)
  const pool = new THREE.Mesh(
    new THREE.CircleGeometry(radius * 5.2, 24),
    new THREE.MeshBasicMaterial({
      color: primaryHex,
      transparent: true,
      opacity: 0.24,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    })
  );
  pool.name = 'plasma_floor_pool';
  pool.userData = { phaseSeed };
  pool.rotation.x = -Math.PI * 0.5;
  pool.position.y = 0.018;
  colGroup.add(pool);

  return colGroup;
}

/**
 * Reusable Builder: High Gothic Cathedral Ribbed Vaults (`высокие нервюрные своды`),
 * Carved Keystone Bosses, and Perimeter Flying Buttresses converging up to the open Celestial Oculus (`небесное окно`).
 * Note: The central light cone / chandelier has been removed so real astronomical galaxies & nebulae
 * shine directly through the unobstructed Oculus!
 */
export function buildGothicRibbedVaultsAndOculus(opts: {
  root: THREE.Group;
  oculusRadius: number;
  spanRadiusX: number;
  spanRadiusZ: number;
  wallHeight: number;
  vaultApexY: number;
  ribAnglesDeg: number[];
  basaltMat: THREE.Material;
  trimMat: THREE.Material;
  innerGlowHex: string;
  veilHex?: string;
  centerZ?: number;
}): void {
  const {
    root,
    oculusRadius,
    spanRadiusX,
    spanRadiusZ,
    wallHeight,
    vaultApexY,
    ribAnglesDeg,
    basaltMat,
    trimMat,
    innerGlowHex,
    centerZ = 0,
  } = opts;

  const vaultGroup = new THREE.Group();
  vaultGroup.position.set(0, 0, centerZ);

  // 1. Open Celestial Oculus Ring + Outer Gothic Clerestory Gallery Ring (Merged into 1 basalt mesh)
  const basaltParts: THREE.BufferGeometry[] = [];
  const oculusOuter = new THREE.TorusGeometry(oculusRadius, 0.38, 12, 56);
  oculusOuter.rotateX(Math.PI * 0.5);
  oculusOuter.translate(0, vaultApexY, 0);
  basaltParts.push(oculusOuter);

  const galleryRing = new THREE.TorusGeometry(
    Math.min(spanRadiusX, spanRadiusZ) * 0.96,
    0.26,
    10,
    48
  );
  galleryRing.rotateX(Math.PI * 0.5);
  galleryRing.translate(0, wallHeight - 0.18, 0);
  basaltParts.push(galleryRing);

  // 2. High Gothic Ribbed Vault Struts + Carved Oculus Keystone Bosses + Flying Buttress Brackets (Merged into 1 trim mesh)
  const trimParts: THREE.BufferGeometry[] = [];

  ribAnglesDeg.forEach((deg) => {
    const rad = THREE.MathUtils.degToRad(deg);
    const startX = Math.sin(rad) * spanRadiusX;
    const startZ = -Math.cos(rad) * spanRadiusZ;
    const endX = Math.sin(rad) * oculusRadius;
    const endZ = -Math.cos(rad) * oculusRadius;

    const dx = endX - startX;
    const dy = vaultApexY - wallHeight;
    const dz = endZ - startZ;
    const length = Math.hypot(dx, dy, dz);

    // Main diagonal vault rib
    const stoneRib = new THREE.BoxGeometry(0.32, 0.44, length);
    const lookMat = new THREE.Matrix4();
    const midPos = new THREE.Vector3(
      (startX + endX) * 0.5,
      (wallHeight + vaultApexY) * 0.5,
      (startZ + endZ) * 0.5
    );
    lookMat.lookAt(midPos, new THREE.Vector3(endX, vaultApexY, endZ), new THREE.Vector3(0, 1, 0));
    lookMat.setPosition(midPos);
    stoneRib.applyMatrix4(lookMat);
    trimParts.push(stoneRib);

    // Carved Gothic Octahedral Keystone Boss where the rib meets the Oculus rim
    const boss = new THREE.OctahedronGeometry(0.46, 0);
    boss.translate(endX, vaultApexY - 0.08, endZ);
    trimParts.push(boss);

    // Perimeter Flying Buttress Spandrel Bracket at the upper wall springer
    const spandrel = new THREE.BoxGeometry(0.42, 1.45, 0.52);
    spandrel.rotateY(-rad);
    spandrel.translate(startX * 0.97, wallHeight - 0.65, startZ * 0.97);
    basaltParts.push(spandrel);
  });

  vaultGroup.add(new THREE.Mesh(mergeBufferGeometries(basaltParts), basaltMat));
  vaultGroup.add(new THREE.Mesh(mergeBufferGeometries(trimParts), trimMat));

  // 3. Backlit inner Oculus rim (`обрамленное краями окулуса и подсвеченное изнутри, создавая ощущение глубины`)
  const oculusInnerGlow = new THREE.Mesh(
    new THREE.TorusGeometry(oculusRadius - 0.36, 0.12, 10, 56),
    new THREE.MeshBasicMaterial({
      color: innerGlowHex,
      transparent: true,
      opacity: 0.92,
    })
  );
  oculusInnerGlow.rotation.x = Math.PI * 0.5;
  oculusInnerGlow.position.y = vaultApexY - 0.12;
  vaultGroup.add(oculusInnerGlow);

  root.add(vaultGroup);
}

/**
 * Power-of-Two (512x512) Thin-Film Interference Iridescent Soap Bubble Texture (`мыльные шары`):
 * Creates swirling rainbow interference fringes (cyan, magenta, gold, emerald, violet)
 * with a bright Fresnel rim and twin curved window specular highlights.
 */
export function createIridescentSoapBubbleTexture(): THREE.CanvasTexture {
  const cacheKey = 'IRIDESCENT_SOAP_BUBBLE_SKIN_V1';
  const cached = signageTextureCache.get(cacheKey);
  if (cached) {
    signageTextureCache.delete(cacheKey);
    signageTextureCache.set(cacheKey, cached);
    return cached;
  }

  if (typeof document === 'undefined') {
    const tex = new THREE.DataTexture(
      new Uint8Array(16 * 16 * 4),
      16,
      16
    ) as unknown as THREE.CanvasTexture;
    tex.needsUpdate = true;
    return storeCachedSignageTexture(cacheKey, tex);
  }

  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, 512, 512);

  // Swirling thin-film interference rainbow bands across the spherical UV map
  const bands = [
    { y: 0.0, col: 'rgba(0, 245, 212, 0.36)' },
    { y: 0.16, col: 'rgba(255, 78, 205, 0.42)' },
    { y: 0.32, col: 'rgba(255, 209, 102, 0.38)' },
    { y: 0.48, col: 'rgba(0, 187, 249, 0.34)' },
    { y: 0.64, col: 'rgba(155, 93, 229, 0.44)' },
    { y: 0.82, col: 'rgba(102, 252, 241, 0.38)' },
    { y: 1.0, col: 'rgba(255, 112, 166, 0.36)' },
  ];
  const filmGrad = ctx.createLinearGradient(0, 0, 512, 512);
  bands.forEach((b) => filmGrad.addColorStop(b.y, b.col));
  ctx.fillStyle = filmGrad;
  ctx.fillRect(0, 0, 512, 512);

  // Wavy thin-film interference rings
  const ringColors = ['#00f5d4', '#ff4ecd', '#ffd166', '#9b5de5', '#00bbf9'];
  for (let i = 0; i < 14; i++) {
    ctx.strokeStyle = `${ringColors[i % ringColors.length]}66`;
    ctx.lineWidth = 6 + (i % 3) * 4;
    ctx.beginPath();
    for (let x = 0; x <= 512; x += 16) {
      const y =
        32 +
        i * 34 +
        Math.sin((x / 512) * Math.PI * 4 + i * 0.9) * 18 +
        Math.cos((x / 512) * Math.PI * 2 - i) * 10;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  // Primary & secondary specular window highlights on the soap film
  const spec1 = ctx.createRadialGradient(168, 148, 4, 168, 148, 72);
  spec1.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
  spec1.addColorStop(0.35, 'rgba(210, 245, 255, 0.55)');
  spec1.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = spec1;
  ctx.fillRect(0, 0, 512, 512);

  const spec2 = ctx.createRadialGradient(362, 368, 2, 362, 368, 46);
  spec2.addColorStop(0, 'rgba(255, 230, 255, 0.78)');
  spec2.addColorStop(0.5, 'rgba(140, 220, 255, 0.32)');
  spec2.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = spec2;
  ctx.fillRect(0, 0, 512, 512);

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  return storeCachedSignageTexture(cacheKey, tex);
}

/**
 * Reusable Builder: 16-Band Audio-Reactive Iridescent Soap Bubbles (`мыльные шары`)
 * and Multi-Scale, Multi-Archetype Soft Spherical Chromatic Particles (`разноцветные не кубические частички`).
 * Features:
 * - 3 distinct soap-bubble scale tiers (Micro Satellites 0.11–0.18m, Mesoscale Harmonic Spheres 0.24–0.36m,
 *   and Macro Cathedral Orbs 0.46–0.64m) with 3D Lissajous currents & bubble-to-bubble elastic dipole interactions.
 * - 4 particle behavioral archetypes (Giant Bokeh Orbs, Double-Helix Vortex Streamers, Bubble-Orbiting Satellites,
 *   and Flocking Stardust Constellations) spanning a 10x size range with smooth velocity-integrated physics.
 */
export function buildAudioReactiveBubblesAndParticles(opts: {
  root: THREE.Group;
  radiusX: number;
  radiusZ: number;
  minY?: number;
  maxY?: number;
  bubbleCount?: number;
  particleCount?: number;
  centerZ?: number;
}): void {
  const {
    root,
    radiusX,
    radiusZ,
    minY = 1.65,
    maxY = 7.4,
    bubbleCount = 16,
    particleCount = 192,
    centerZ = 0,
  } = opts;

  const group = new THREE.Group();
  group.name = 'audio_reactive_atmosphere_group';

  // 1. Multi-Scale Iridescent Soap Bubbles — 16 frequency bands across 3 distinct size & motion tiers
  const bubbleTex = createIridescentSoapBubbleTexture();
  const count = Math.min(20, Math.max(8, bubbleCount));

  for (let i = 0; i < count; i++) {
    const bandIndex = i % 16;
    const baseHue = bandIndex / 16;
    const angle = (i / count) * Math.PI * 2 + 0.38;
    const radialFactor = 0.48 + ((i * 7) % 5) * 0.095;
    const bx = Math.sin(angle) * (radiusX * radialFactor);
    const bz = centerZ - Math.cos(angle) * (radiusZ * radialFactor);
    const by = minY + ((i * 0.6180339) % 1) * (maxY - minY);

    // 3 distinct size tiers: Macro Cathedral Orbs (0..3), Mesoscale Harmonic (4..9), Micro Satellites (10..15)
    let sizeTier: 'macro' | 'meso' | 'micro' = 'meso';
    let baseRadius = 0.28;
    if (i % 4 === 0) {
      sizeTier = 'macro';
      baseRadius = 0.46 + (i % 3) * 0.08; // 0.46m – 0.62m giant slow-drifting orbs
    } else if (i % 3 === 1) {
      sizeTier = 'micro';
      baseRadius = 0.11 + (i % 4) * 0.022; // 0.11m – 0.176m nimble satellite bubbles
    } else {
      sizeTier = 'meso';
      baseRadius = 0.23 + (i % 5) * 0.032; // 0.23m – 0.358m expressive harmonic bubbles
    }

    const initColor = new THREE.Color().setHSL(baseHue, 0.92, 0.64);
    const initEmissive = new THREE.Color().setHSL(
      (baseHue + 0.16) % 1,
      0.96,
      0.42
    );

    const bubbleMat = new THREE.MeshStandardMaterial({
      color: initColor,
      map: bubbleTex,
      emissive: initEmissive,
      emissiveMap: bubbleTex,
      emissiveIntensity: 0.62,
      roughness: 0.04,
      metalness: 0.92,
      transparent: true,
      opacity: sizeTier === 'macro' ? 0.64 : sizeTier === 'micro' ? 0.82 : 0.72,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    const bubbleMesh = new THREE.Mesh(
      new THREE.SphereGeometry(1, 22, 16),
      bubbleMat
    );
    bubbleMesh.name = 'audio_soap_bubble';
    bubbleMesh.scale.setScalar(baseRadius);
    bubbleMesh.position.set(bx, by, bz);

    // Distinct 3D Lissajous frequency ratios per bubble so trajectories never look uniform
    const speedMult =
      sizeTier === 'macro' ? 0.22 : sizeTier === 'micro' ? 0.58 : 0.36;
    bubbleMesh.userData = {
      bandIndex,
      baseHue,
      baseX: bx,
      baseY: by,
      baseZ: bz,
      curX: bx,
      curY: by,
      curZ: bz,
      vx: 0,
      vy: 0,
      vz: 0,
      baseRadius,
      sizeTier,
      phaseSeed: i * 1.37 + 0.25,
      freqX: (0.42 + (i % 5) * 0.11) * speedMult,
      freqY: (0.53 + (i % 7) * 0.09) * speedMult,
      freqZ: (0.37 + (i % 4) * 0.13) * speedMult,
      orbitRx:
        sizeTier === 'macro'
          ? 0.45
          : sizeTier === 'micro'
          ? 0.95
          : 0.68,
      orbitRy:
        sizeTier === 'macro'
          ? 0.35
          : sizeTier === 'micro'
          ? 0.62
          : 0.48,
      orbitRz:
        sizeTier === 'macro'
          ? 0.45
          : sizeTier === 'micro'
          ? 0.95
          : 0.68,
      spinY: i * 0.8,
      spinZ: 0,
      smoothBand: 0,
      sympatheticHueShift: 0,
      interactionSquash: 0,
    };
    group.add(bubbleMesh);
  }

  // 2. Multi-Scale, Multi-Archetype Soft Spherical Particle Cloud (4 behavioral species + per-particle sizes)
  const positions = new Float32Array(particleCount * 3);
  const basePositions = new Float32Array(particleCount * 3);
  const velocities = new Float32Array(particleCount * 3);
  const colors = new Float32Array(particleCount * 3);
  const baseSizes = new Float32Array(particleCount);
  const sizeScales = new Float32Array(particleCount);
  const archetypes = new Uint8Array(particleCount);
  const phases = new Float32Array(particleCount);
  const smoothBands = new Float32Array(particleCount);
  const tempColor = new THREE.Color();

  // Separate macro-bokeh companion cloud for giant translucent atmospheric orbs (48 orbs)
  const bokehCount = Math.max(24, Math.floor(particleCount * 0.22));
  const bokehPositions = new Float32Array(bokehCount * 3);
  const bokehBasePositions = new Float32Array(bokehCount * 3);
  const bokehVelocities = new Float32Array(bokehCount * 3);
  const bokehColors = new Float32Array(bokehCount * 3);
  const bokehPhases = new Float32Array(bokehCount);

  for (let i = 0; i < particleCount; i++) {
    const bandIndex = i % 16;
    const hue = bandIndex / 16;
    const a = i * 2.3999632; // Golden angle spiral distribution
    const rNorm = 0.2 + ((i * 73) % 100) / 128;
    const px = Math.cos(a) * radiusX * rNorm;
    const pz = centerZ + Math.sin(a) * radiusZ * rNorm;
    const py = 0.85 + (((i * 47) % 100) / 100) * (maxY + 0.9);

    positions[i * 3] = px;
    positions[i * 3 + 1] = py;
    positions[i * 3 + 2] = pz;

    basePositions[i * 3] = px;
    basePositions[i * 3 + 1] = py;
    basePositions[i * 3 + 2] = pz;

    phases[i] = i * 0.6180339 * Math.PI * 2;

    // Assign 1 of 4 behavioral archetypes and a wide log-normal size distribution (0.20x to 2.45x):
    // 0: Giant Bokeh Drifters (15%)
    // 1: Double-Helix Curl Vortex Streamers (35%)
    // 2: Bubble-Seeker Orbital Satellites (30%)
    // 3: Flocking Stardust Micro-Sparks (20%)
    const mod20 = i % 20;
    let arch = 1;
    let bSize = 1.0;
    if (mod20 < 3) {
      arch = 0;
      bSize = 1.65 + (i % 5) * 0.18; // 1.65x – 2.37x large luminous orbs
    } else if (mod20 < 10) {
      arch = 1;
      bSize = 0.72 + (i % 6) * 0.11; // 0.72x – 1.27x medium vortex streamers
    } else if (mod20 < 16) {
      arch = 2;
      bSize = 0.44 + (i % 5) * 0.09; // 0.44x – 0.80x nimble bubble-orbiting satellites
    } else {
      arch = 3;
      bSize = 0.2 + (i % 4) * 0.055; // 0.20x – 0.365x fine stardust micro-sparks
    }

    archetypes[i] = arch;
    baseSizes[i] = bSize;
    sizeScales[i] = bSize;

    tempColor.setHSL(
      hue,
      arch === 3 ? 0.88 : 0.95,
      arch === 0 ? 0.58 : arch === 3 ? 0.76 : 0.64
    );
    colors[i * 3] = tempColor.r;
    colors[i * 3 + 1] = tempColor.g;
    colors[i * 3 + 2] = tempColor.b;
  }

  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  pGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  pGeo.setAttribute('aSizeScale', new THREE.BufferAttribute(sizeScales, 1));

  const softCircleTex = nebulaSkySystem.getSharedSoftParticleTexture();
  const pMat = new THREE.PointsMaterial({
    size: 0.25,
    map: softCircleTex,
    alphaTest: 0.01,
    vertexColors: true,
    transparent: true,
    opacity: 0.88,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  // Inject per-vertex size multiplier (`aSizeScale`) into Three.js PointsMaterial vertex shader
  pMat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        '#include <common>\nattribute float aSizeScale;'
      )
      .replace('gl_PointSize = size;', 'gl_PointSize = size * aSizeScale;');
  };

  const points = new THREE.Points(pGeo, pMat);
  points.name = 'audio_chromatic_particles';
  points.userData = {
    basePositions,
    velocities,
    baseSizes,
    sizeScales,
    archetypes,
    phases,
    smoothBands,
    particleCount,
    radiusX,
    radiusZ,
    minY: 0.6,
    maxY: maxY + 1.2,
    centerZ,
  };
  group.add(points);

  // 3. Companion Macro-Bokeh Layer (`audio_macro_bokeh_particles`): Large soft glowing nebular orbs
  for (let i = 0; i < bokehCount; i++) {
    const bandIndex = (i * 3) % 16;
    const hue = bandIndex / 16;
    const a = i * 2.3999632 + 1.05;
    const rNorm = 0.28 + ((i * 53) % 100) / 145;
    const px = Math.cos(a) * radiusX * rNorm;
    const pz = centerZ + Math.sin(a) * radiusZ * rNorm;
    const py = 1.2 + (((i * 31) % 100) / 100) * (maxY + 0.4);

    bokehPositions[i * 3] = px;
    bokehPositions[i * 3 + 1] = py;
    bokehPositions[i * 3 + 2] = pz;

    bokehBasePositions[i * 3] = px;
    bokehBasePositions[i * 3 + 1] = py;
    bokehBasePositions[i * 3 + 2] = pz;
    bokehPhases[i] = i * 1.17;

    tempColor.setHSL(hue, 0.92, 0.56);
    bokehColors[i * 3] = tempColor.r;
    bokehColors[i * 3 + 1] = tempColor.g;
    bokehColors[i * 3 + 2] = tempColor.b;
  }

  const bokehGeo = new THREE.BufferGeometry();
  bokehGeo.setAttribute(
    'position',
    new THREE.BufferAttribute(bokehPositions, 3)
  );
  bokehGeo.setAttribute('color', new THREE.BufferAttribute(bokehColors, 3));

  const bokehMat = new THREE.PointsMaterial({
    size: 0.58,
    map: softCircleTex,
    alphaTest: 0.01,
    vertexColors: true,
    transparent: true,
    opacity: 0.52,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  const bokehPoints = new THREE.Points(bokehGeo, bokehMat);
  bokehPoints.name = 'audio_macro_bokeh_particles';
  bokehPoints.userData = {
    basePositions: bokehBasePositions,
    velocities: bokehVelocities,
    phases: bokehPhases,
    particleCount: bokehCount,
  };
  group.add(bokehPoints);

  root.add(group);
}

/**
 * Reusable Builder: Travelling Electric Sparks (`перемещающиеся иногда сполохи электричества`)
 * across the Polished Dark Basalt Floor's Fractal & Circuit Schematics.
 */
export function buildFloorElectricCircuitSparks(opts: {
  root: THREE.Group;
  maxRadius: number;
  primaryHex: string;
  secondaryHex: string;
  goldHex: string;
}): void {
  const { root, maxRadius, primaryHex, secondaryHex, goldHex } = opts;
  const colors = [secondaryHex, goldHex, primaryHex];

  for (let i = 0; i < 6; i++) {
    const angle = (i * Math.PI) / 3 + Math.PI / 6;
    const sparkMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, 0.02, 0.95),
      new THREE.MeshBasicMaterial({
        color: colors[i % colors.length],
        transparent: true,
        opacity: 0.85,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    sparkMesh.name = 'floor_electric_spark';
    sparkMesh.userData = {
      angle,
      maxRadius,
      speed: 2.8 + (i % 3) * 0.9,
      phase: i * 1.7,
    };
    sparkMesh.rotation.y = -angle;
    sparkMesh.position.set(
      Math.sin(angle) * (maxRadius * 0.4),
      0.024,
      -Math.cos(angle) * (maxRadius * 0.4)
    );
    root.add(sparkMesh);
  }
}

/**
 * Reusable Builder: Stylized 1.72m Human-Scale Figure of a Player in a VR Headset (`фигура игрока в VR-шлеме`)
 * to anchor the monumental architectural scale of the Gothic Cathedral, Plasma Columns, and Portals.
 */
export function buildVRExplorerScaleFigure(opts: {
  x: number;
  z: number;
  rotY: number;
  visorHex: string;
  trimHex: string;
}): THREE.Group {
  const { x, z, rotY, visorHex, trimHex } = opts;
  const fig = new THREE.Group();
  fig.position.set(x, 0, z);
  fig.rotation.y = rotY;

  const cloakMat = new THREE.MeshStandardMaterial({
    color: '#0d1322',
    roughness: 0.35,
    metalness: 0.65,
  });
  const visorMat = new THREE.MeshBasicMaterial({
    color: visorHex,
  });
  const trimBasicMat = new THREE.MeshBasicMaterial({
    color: trimHex,
    transparent: true,
    opacity: 0.65,
    side: THREE.DoubleSide,
  });

  // Grounding VR guardian boundary ring at feet
  const footRing = new THREE.Mesh(
    new THREE.RingGeometry(0.36, 0.42, 24),
    trimBasicMat
  );
  footRing.rotation.x = -Math.PI * 0.5;
  footRing.position.y = 0.018;
  fig.add(footRing);

  // Full cyber-gothic coat silhouette (0..1.44m)
  const coatBody = new THREE.Mesh(
    new THREE.CylinderGeometry(0.17, 0.28, 1.44, 12),
    cloakMat
  );
  coatBody.position.y = 0.72;
  fig.add(coatBody);

  // Human Head (y = 1.58m, slightly tilted upward in awe at the Oculus & Portals)
  const headGroup = new THREE.Group();
  headGroup.name = 'vr_explorer_visor';
  headGroup.position.set(0, 1.58, 0);
  headGroup.rotation.x = 0.16;

  const headSphere = new THREE.Mesh(
    new THREE.SphereGeometry(0.115, 14, 12),
    cloakMat
  );
  headGroup.add(headSphere);

  // Sleek VR Headset Visor (`игрок в VR-шлеме`) on the front (-Z) of the head
  const hmdNeonFront = new THREE.Mesh(
    new THREE.BoxGeometry(0.21, 0.085, 0.13),
    visorMat
  );
  hmdNeonFront.position.set(0, 0.01, -0.078);
  headGroup.add(hmdNeonFront);

  fig.add(headGroup);

  return fig;
}

/**
 * Reusable Builder: Central Portal Overhead Sign (`ARTMAZE // NEUROMICON PROJECT` + GitHub Link).
 */
export function buildArtmazeHeaderBanner(opts: {
  x: number;
  y: number;
  z: number;
  rotY?: number;
  width?: number;
  height?: number;
  accentHex: string;
  plasmaHex: string;
  repoUrl?: string;
  trimMat: THREE.Material;
}): THREE.Group {
  const {
    x,
    y,
    z,
    rotY = 0,
    width = 5.4,
    height = 1.35,
    accentHex,
    plasmaHex,
    repoUrl = 'github.com/AlexSheff/Neuromicon',
    trimMat,
  } = opts;

  const group = new THREE.Group();
  group.position.set(x, y, z);
  group.rotation.y = rotY;

  const backing = new THREE.Mesh(
    new THREE.BoxGeometry(width + 0.24, height + 0.2, 0.14),
    trimMat
  );
  backing.position.set(0, 0, -0.06);
  group.add(backing);

  const bannerTex = createArtmazeHeaderSignTexture(
    accentHex,
    plasmaHex,
    repoUrl
  );
  const face = new THREE.Mesh(
    new THREE.PlaneGeometry(width, height),
    new THREE.MeshBasicMaterial({ map: bannerTex })
  );
  face.position.set(0, 0, 0.02);
  group.add(face);

  return group;
}

/**
 * Merges an array of BufferGeometries into a single BufferGeometry and immediately disposes
 * the temporary input geometries so GPU memory remains 100% leak-free and draw calls stay minimal.
 */
function mergeBufferGeometries(
  geometries: THREE.BufferGeometry[]
): THREE.BufferGeometry {
  const nonIndexed = geometries.map((g) => {
    const ni = g.index ? g.toNonIndexed() : g.clone();
    g.dispose();
    return ni;
  });

  let totalVertices = 0;
  for (const g of nonIndexed) {
    const pos = g.getAttribute('position');
    if (pos) totalVertices += pos.count;
  }

  const positions = new Float32Array(totalVertices * 3);
  const normals = new Float32Array(totalVertices * 3);
  const uvs = new Float32Array(totalVertices * 2);

  let vOffset = 0;
  for (const g of nonIndexed) {
    const pos = g.getAttribute('position');
    const norm = g.getAttribute('normal');
    const uv = g.getAttribute('uv');
    if (pos) {
      positions.set(pos.array as ArrayLike<number>, vOffset * 3);
      if (norm && norm.count === pos.count) {
        normals.set(norm.array as ArrayLike<number>, vOffset * 3);
      }
      if (uv && uv.count === pos.count) {
        uvs.set(uv.array as ArrayLike<number>, vOffset * 2);
      }
      vOffset += pos.count;
    }
    g.dispose();
  }

  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  merged.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  merged.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  return merged;
}

/**
 * Reusable Builder: Futuristic Sci-Fi / Gothic Portal with Connected 3D Power Wires & Glowing Plasma Conduits!
 * Replaces traditional doors everywhere (Threshold, Sector Halls I/II/III, all 1149 Rooms, and Void Fallback)
 * while using strictly 4 draw calls per portal:
 *  1) Merged Gothic-Sci-Fi Portal Archway + Side Induction Coils + 6 Curved 3D Power Cable Conduits
 *  2) Merged Neon Contour Strips + Status Luminaire + 4 Glowing Plasma Wire Energy Cores (`portal_wire_pulse`)
 *  3) Dimensional Portal Vortex Aperture (`portal_vortex_aperture`)
 *  4) Upper Telemetry Display Plaque (`createSignageTexture`)
 */
export function buildWiredSciFiGothicPortal(opts: {
  x: number;
  z: number;
  rotY?: number;
  width?: number;
  height?: number;
  frameMat: THREE.Material;
  vortexMat: THREE.Material;
  accentHex: string;
  plasmaHex?: string;
  statusColorHex?: string;
  plaqueTex: THREE.Texture;
  plaqueWidth?: number;
  plaqueHeight?: number;
  cableSpread?: number;
  phaseSeed?: number;
}): THREE.Group {
  const {
    x,
    z,
    rotY = 0,
    width = 2.6,
    height = 3.9,
    frameMat,
    vortexMat,
    statusColorHex,
    accentHex,
    plaqueTex,
    plaqueWidth = width * 0.88,
    plaqueHeight = 1.05,
    cableSpread = 1.0,
    phaseSeed = 0,
  } = opts;

  const group = new THREE.Group();
  group.position.set(x, 0, z);
  group.rotation.y = rotY;

  const halfW = width * 0.5;
  const partsFrameAndCables: THREE.BufferGeometry[] = [];
  const partsNeonAndWireCores: THREE.BufferGeometry[] = [];

  // 1. Stepped Sci-Fi/Gothic Threshold Plinth
  const plinth = new THREE.BoxGeometry(width * 1.16, 0.18, 0.62);
  plinth.translate(0, 0.09, 0.18);
  partsFrameAndCables.push(plinth);

  // 2. Left & Right Chamfered Portal Pillars + Side Induction Coils + Floor Cable Junction Boxes
  for (const side of [-1, 1]) {
    const px = side * (halfW - 0.16);
    const pillar = new THREE.BoxGeometry(0.32, height - 0.25, 0.42);
    pillar.translate(px, (height - 0.25) * 0.5 + 0.14, 0.16);
    partsFrameAndCables.push(pillar);

    // Floor Power Cable Junction Manifold Box outside each pillar base
    const jBox = new THREE.BoxGeometry(0.36, 0.34, 0.44);
    jBox.translate(side * (halfW + 0.22), 0.17, 0.28);
    partsFrameAndCables.push(jBox);

    // Mid-height Electromagnetic Induction Coil Ring on each pillar
    const coil = new THREE.CylinderGeometry(0.26, 0.26, 0.28, 8);
    coil.translate(px, height * 0.52, 0.2);
    partsFrameAndCables.push(coil);

    // Vertical Neon Portal Contour Strip along inner jamb
    const neonStrip = new THREE.BoxGeometry(0.055, height - 0.42, 0.08);
    neonStrip.translate(side * (halfW - 0.31), height * 0.48, 0.36);
    partsNeonAndWireCores.push(neonStrip);

    // 3D Connected Power Cable #1: Heavy Armored Floor Feeder Cable snaking from floor power grid into base junction box
    const floorCableCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(
        side * (halfW + 0.85 * cableSpread),
        0.04,
        1.45 * cableSpread
      ),
      new THREE.Vector3(
        side * (halfW + 0.52 * cableSpread),
        0.05,
        0.82 * cableSpread
      ),
      new THREE.Vector3(side * (halfW + 0.24), 0.18, 0.34),
    ]);
    partsFrameAndCables.push(
      new THREE.TubeGeometry(floorCableCurve, 8, 0.052, 6, false)
    );

    // Glowing Plasma Wire Core #1 running along the floor feeder cable into the portal
    const floorGlowCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(
        side * (halfW + 0.85 * cableSpread),
        0.095,
        1.45 * cableSpread
      ),
      new THREE.Vector3(
        side * (halfW + 0.52 * cableSpread),
        0.105,
        0.82 * cableSpread
      ),
      new THREE.Vector3(side * (halfW + 0.24), 0.24, 0.36),
    ]);
    partsNeonAndWireCores.push(
      new THREE.TubeGeometry(floorGlowCurve, 8, 0.024, 5, false)
    );

    // 3D Connected Power Cable #2: High-Voltage Catenary Loop from Base Junction Box up into Mid-Height Induction Coil
    const midLoopCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * (halfW + 0.24), 0.3, 0.28),
      new THREE.Vector3(
        side * (halfW + 0.58 * cableSpread),
        height * 0.27,
        0.42
      ),
      new THREE.Vector3(side * (halfW + 0.06), height * 0.52, 0.24),
    ]);
    partsFrameAndCables.push(
      new THREE.TubeGeometry(midLoopCurve, 8, 0.044, 6, false)
    );

    // Glowing Plasma Wire Core #2 along the side catenary loop
    const midGlowCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * (halfW + 0.24), 0.32, 0.33),
      new THREE.Vector3(
        side * (halfW + 0.62 * cableSpread),
        height * 0.27,
        0.46
      ),
      new THREE.Vector3(side * (halfW + 0.08), height * 0.52, 0.29),
    ]);
    partsNeonAndWireCores.push(
      new THREE.TubeGeometry(midGlowCurve, 8, 0.02, 5, false)
    );

    // 3D Connected Power Cable #3: Upper Umbilical Conduit from Mid Coil into the Gothic Arch Lintel Crown
    const upperCableCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * (halfW + 0.04), height * 0.58, 0.22),
      new THREE.Vector3(
        side * (halfW + 0.42 * cableSpread),
        height * 0.78,
        0.34
      ),
      new THREE.Vector3(side * (halfW - 0.15), height - 0.08, 0.24),
    ]);
    partsFrameAndCables.push(
      new THREE.TubeGeometry(upperCableCurve, 7, 0.038, 6, false)
    );
  }

  // 3. Upper Lintel Beam + Pointed Gothic Arch Crown
  const lintel = new THREE.BoxGeometry(width * 1.12, 0.38, 0.48);
  lintel.translate(0, height - 0.12, 0.18);
  partsFrameAndCables.push(lintel);

  const gothicCrown = new THREE.ConeGeometry(width * 0.36, 0.72, 4);
  gothicCrown.rotateY(Math.PI * 0.25);
  gothicCrown.translate(0, height + 0.38, 0.16);
  partsFrameAndCables.push(gothicCrown);

  // Upper Status Luminaire Bar under the portal lintel
  const statusLamp = new THREE.BoxGeometry(width * 0.68, 0.08, 0.16);
  statusLamp.translate(0, height - 0.32, 0.38);
  partsNeonAndWireCores.push(statusLamp);

  // Merge all frame & armored cable parts into Mesh #1 (1 draw call)
  const mergedFrameGeo = mergeBufferGeometries(partsFrameAndCables);
  const frameAndCablesMesh = new THREE.Mesh(mergedFrameGeo, frameMat);
  group.add(frameAndCablesMesh);

  // Merge all neon contours & glowing wire cores into Mesh #2 (1 draw call, animated pulse)
  const mergedNeonGeo = mergeBufferGeometries(partsNeonAndWireCores);
  const neonWireMat = new THREE.MeshBasicMaterial({
    color: statusColorHex ?? accentHex,
    transparent: true,
    opacity: 0.9,
  });
  const neonAndWiresMesh = new THREE.Mesh(mergedNeonGeo, neonWireMat);
  neonAndWiresMesh.name = 'portal_wire_pulse';
  neonAndWiresMesh.userData = { phaseSeed };
  group.add(neonAndWiresMesh);

  // Mesh #3: Dimensional Portal Vortex Aperture (1 draw call)
  const vortexAperture = new THREE.Mesh(
    new THREE.BoxGeometry(width - 0.56, height - 0.48, 0.14),
    vortexMat
  );
  vortexAperture.name = 'portal_vortex_aperture';
  vortexAperture.userData = { phaseSeed };
  vortexAperture.position.set(0, 0.18 + (height - 0.48) * 0.5, 0.14);
  group.add(vortexAperture);

  // Mesh #4: Built-in Sci-Fi/Gothic Telemetry Display Plaque above portal (1 draw call)
  const plaqueMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(plaqueWidth, plaqueHeight),
    new THREE.MeshBasicMaterial({ map: plaqueTex })
  );
  plaqueMesh.position.set(0, height + 0.22 + plaqueHeight * 0.5, 0.28);
  group.add(plaqueMesh);

  return group;
}

const SECTOR_HALL_META: Record<
  1 | 2 | 3,
  {
    title: string;
    subtitle: string;
    symbol: string;
    range: string;
    accentHex: string;
    plasmaHex: string;
    bgHex: string;
    branch: CorridorBranch;
    sceneSkyKey: string;
  }
> = {
  1: {
    title: 'SECTOR I · THE SOURCE CODE',
    subtitle: 'Rooms 01–11 (Purpose to Action · Pillars of Creation)',
    symbol: 'I·☉',
    range: 'SECTOR I (01–11)',
    accentHex: '#e5c158',
    plasmaHex: '#9d4edd',
    bgHex: '#060812',
    branch: 'ascend',
    sceneSkyKey: 'SECTOR_ROOM_1',
  },
  2: {
    title: 'SECTOR II · OPERATING SYSTEM',
    subtitle: 'Rooms 12–19 (Solitude to Algorithm · Cosmic Veil)',
    symbol: 'II·◯',
    range: 'SECTOR II (12–19)',
    accentHex: '#4ea8de',
    plasmaHex: '#7b2cbf',
    bgHex: '#050914',
    branch: 'descend',
    sceneSkyKey: 'SECTOR_ROOM_2',
  },
  3: {
    title: 'SECTOR III · UPGRADE & MIRROR',
    subtitle: 'Rooms 20–25 (Signal to Mirror · Deep Field)',
    symbol: 'III·🪞',
    range: 'SECTOR III (20–25)',
    accentHex: '#b388ff',
    plasmaHex: '#4ea8de',
    bgHex: '#070614',
    branch: 'ascend',
    sceneSkyKey: 'SECTOR_ROOM_3',
  },
};

/**
 * Builds the Grand Gothic-Plasma-Cosmic Cathedral Starting Hall (Threshold) and the 3 Sector Halls (I, II, III)
 * driven by the 4-Layer Real Astronomical Nebula Sky & OKLab Palette Lighting System (TZ.md §3 & §4).
 */
export class CorridorBuilder {
  public static buildThresholdHall(
    root: THREE.Group,
    scene: THREE.Scene,
    state: HubPlayerState,
    registerTarget: (
      mesh: THREE.Object3D,
      target: SpatialInteractiveTarget
    ) => void,
    walkableMeshes: THREE.Object3D[]
  ): void {
    // 1. Mount 4-Layer Real Astronomical Nebula Sky (`NEB_0001` Carina Nebula Cosmic Cliffs) + Twilight Rig
    const skyRig = nebulaSkySystem.mountRoomSkyAndLighting(
      'THRESHOLD',
      root,
      scene,
      {
        qualityTier: state.comfort.qualityTier,
        reducedMotion: state.comfort.reducedMotion,
      }
    );

    const floorTex = createCosmicFloorTexture(
      'rgba(229, 193, 88, 0.28)',
      5,
      5
    );
    // Polished dark basalt stone reflecting plasma columns and portals
    const cosmicFloorMat = new THREE.MeshStandardMaterial({
      color: '#0d1322',
      map: floorTex,
      roughness: 0.16,
      metalness: 0.58,
    });

    const stoneWallTex = createArchitecturalWallTexture(
      '#070a13',
      skyRig.palette[0] ?? '#e5c158',
      '#9d4edd',
      6,
      1
    );
    const gothicBasaltMat = new THREE.MeshStandardMaterial({
      color: '#111624',
      map: stoneWallTex,
      roughness: 0.52,
      metalness: 0.24,
    });

    const goldHeroMat = new THREE.MeshStandardMaterial({
      color: '#e5c158',
      roughness: 0.18,
      metalness: 0.86,
      emissive: '#54380c',
      emissiveIntensity: 0.42,
    });
    const cyanHeroMat = new THREE.MeshStandardMaterial({
      color: '#4ea8de',
      roughness: 0.18,
      metalness: 0.86,
      emissive: '#0e3b66',
      emissiveIntensity: 0.48,
    });
    const violetHeroMat = new THREE.MeshStandardMaterial({
      color: '#b388ff',
      roughness: 0.18,
      metalness: 0.86,
      emissive: '#38146b',
      emissiveIntensity: 0.48,
    });

    // 1. Grand Circular Polished Dark Basalt Floor (y = 0, walkable, with Fractals & Circuit Schematics)
    const platformDisc = new THREE.Mesh(
      new THREE.CylinderGeometry(15.2, 16.0, 0.6, 64),
      cosmicFloorMat
    );
    platformDisc.position.set(0, -0.3, 0);
    root.add(platformDisc);
    walkableMeshes.push(platformDisc);

    const outerRim = new THREE.Mesh(
      new THREE.TorusGeometry(15.0, 0.24, 12, 64),
      goldHeroMat
    );
    outerRim.rotation.x = Math.PI * 0.5;
    outerRim.position.set(0, 0.08, 0);
    root.add(outerRim);

    // Concentric glowing fractal & circuit rings on the polished dark stone floor
    [4.2, 8.8, 13.6].forEach((r, idx) => {
      const floorRing = new THREE.Mesh(
        new THREE.RingGeometry(r, r + 0.09, 64),
        new THREE.MeshBasicMaterial({
          color:
            idx === 0 ? '#e5c158' : idx === 1 ? '#4ea8de' : '#9d4edd',
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.62,
        })
      );
      floorRing.rotation.x = -Math.PI * 0.5;
      floorRing.position.set(0, 0.015, 0);
      root.add(floorRing);
    });

    // Travelling Electric Sparks (`перемещающиеся сполохи электричества`) along the floor circuits
    buildFloorElectricCircuitSparks({
      root,
      maxRadius: 13.8,
      primaryHex: '#9d4edd',
      secondaryHex: '#4ea8de',
      goldHex: '#e5c158',
    });

    // 2. High Gothic Cathedral Ribbed Vaults & Open Celestial Oculus (y = 14.6m, unobstructed view of Galaxies!)
    const columnAnglesDeg = [-68, -42, 42, 68, -118, 118, -152, 152];
    buildGothicRibbedVaultsAndOculus({
      root,
      oculusRadius: 9.8,
      spanRadiusX: 13.8,
      spanRadiusZ: 13.8,
      wallHeight: 9.8,
      vaultApexY: 14.6,
      ribAnglesDeg: columnAnglesDeg,
      basaltMat: gothicBasaltMat,
      trimMat: goldHeroMat,
      innerGlowHex: '#e5c158',
      veilHex: skyRig.palette[2] ?? '#e5c158',
    });

    // 16-Band Audio-Reactive Iridescent Soap Bubbles & Soft Spherical Multi-Colored Particles
    buildAudioReactiveBubblesAndParticles({
      root,
      radiusX: 12.2,
      radiusZ: 12.2,
      minY: 1.8,
      maxY: 9.2,
      bubbleCount: 16,
      particleCount: 192,
    });

    // 3. Tall Transparent Quartz Glass Plasma Columns with Swirling Plasma & Periodic Branching Lightning!
    // Strictly flanking the 3 North Sector Portals and East/West wings — never blocking sightlines!
    columnAnglesDeg.forEach((deg, idx) => {
      const rad = THREE.MathUtils.degToRad(deg);
      const bx = Math.sin(rad) * 13.8;
      const bz = -Math.cos(rad) * 13.8;

      const plasmaCol = buildQuartzPlasmaColumn({
        x: bx,
        z: bz,
        height: 9.8,
        radius: 0.46,
        primaryHex: idx % 2 === 0 ? '#9d4edd' : '#4ea8de',
        secondaryHex: idx % 2 === 0 ? '#4ea8de' : '#b388ff',
        goldHex: '#e5c158',
        basaltMat: gothicBasaltMat,
        trimMat: idx % 3 === 0 ? goldHeroMat : idx % 3 === 1 ? cyanHeroMat : violetHeroMat,
        phaseSeed: idx * 1.618 + 0.5,
      });
      root.add(plasmaCol);
    });

    // 4. Scale Figures of Players in VR Headsets (`Фигуры людей в VR-шлемах масштабируют пространство`)
    const explorerLeft = buildVRExplorerScaleFigure({
      x: -4.4,
      z: -3.2,
      rotY: -0.18,
      visorHex: '#4ea8de',
      trimHex: '#e5c158',
    });
    root.add(explorerLeft);

    const explorerRight = buildVRExplorerScaleFigure({
      x: 4.4,
      z: -3.2,
      rotY: 0.18,
      visorHex: '#b388ff',
      trimHex: '#4ea8de',
    });
    root.add(explorerRight);

    // 5. Soft Pulsing Ring on Floor at z = 2.2m
    const moveRingGroup = new THREE.Group();
    moveRingGroup.name = 'onboarding_move_ring';
    moveRingGroup.position.set(0, 0.02, 2.2);
    const moveRingMesh = new THREE.Mesh(
      new THREE.RingGeometry(0.65, 0.82, 36),
      new THREE.MeshBasicMaterial({
        color: '#e5c158',
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.85,
      })
    );
    moveRingMesh.rotation.x = -Math.PI * 0.5;
    moveRingGroup.add(moveRingMesh);
    root.add(moveRingGroup);

    // 6. Central Awakening Monolith Pedestal at (0, 0, 1.2)
    const pedestalGroup = new THREE.Group();
    pedestalGroup.name = 'onboarding_pedestal';
    pedestalGroup.position.set(0, 0, 1.2);

    const pedBase = new THREE.Mesh(
      new THREE.CylinderGeometry(0.52, 0.68, 1.05, 8),
      gothicBasaltMat
    );
    pedBase.position.y = 0.525;
    pedestalGroup.add(pedBase);

    const pedTrimRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.54, 0.04, 12, 32),
      goldHeroMat
    );
    pedTrimRing.rotation.x = Math.PI * 0.5;
    pedTrimRing.position.y = 1.05;
    pedestalGroup.add(pedTrimRing);

    const pedCrystal = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.32, 0),
      goldHeroMat
    );
    pedCrystal.name = 'onboarding_pedestal_crystal';
    pedCrystal.position.y = 1.45;
    pedestalGroup.add(pedCrystal);

    root.add(pedestalGroup);
    registerTarget(pedestalGroup, {
      id: 'ONBOARDING_PEDESTAL',
      kind: 'onboarding-pedestal',
      title: '◈ COSMIC NEXUS CORE',
      titleRu: '◈ COSMIC NEXUS CORE',
      subtitle: `${skyRig.nebulaName} · 3 Sector Portals (1149 Rooms)`,
      subtitleRu: `${skyRig.nebulaName} · 3 Sector Portals (1149 Rooms)`,
    });

    // 7. Comfort Calibration Ritual Marks (Seated vs Standing)
    const postureGroup = new THREE.Group();
    postureGroup.name = 'onboarding_posture_marks';
    postureGroup.position.set(-3.2, 0, 3.4);

    const consoleStand = new THREE.Mesh(
      new THREE.CylinderGeometry(0.26, 0.36, 0.88, 8),
      gothicBasaltMat
    );
    consoleStand.position.y = 0.44;
    postureGroup.add(consoleStand);

    const seatedOrb = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.16, 0),
      cyanHeroMat
    );
    seatedOrb.position.set(0, 1.12, 0);
    postureGroup.add(seatedOrb);
    registerTarget(seatedOrb, {
      id: 'COMFORT_SEATED_ORB',
      kind: 'comfort-posture',
      seatedChoice: true,
      title: '◎ SEATED POSTURE',
      titleRu: '◎ SEATED POSTURE',
      subtitle: 'Calibrate Seated Eye Level',
      subtitleRu: 'Calibrate Seated Eye Level',
    });

    const standingOrb = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.16, 1),
      goldHeroMat
    );
    standingOrb.position.set(0, 1.68, 0);
    postureGroup.add(standingOrb);
    registerTarget(standingOrb, {
      id: 'COMFORT_STANDING_ORB',
      kind: 'comfort-posture',
      seatedChoice: false,
      title: '◈ STANDING POSTURE',
      titleRu: '◈ STANDING POSTURE',
      subtitle: 'Calibrate Standing Eye Level',
      subtitleRu: 'Calibrate Standing Eye Level',
    });
    root.add(postureGroup);

    // 8. Physical Smooth-Movement Switch in World (Unlocked after 5 teleports)
    if (state.teleportCount >= 5) {
      const locoSwitch = new THREE.Mesh(
        new THREE.CylinderGeometry(0.24, 0.32, 1.15, 16),
        goldHeroMat
      );
      locoSwitch.position.set(3.2, 0.575, 3.4);
      root.add(locoSwitch);
      registerTarget(locoSwitch, {
        id: 'WORLD_LOCOMOTION_SWITCH',
        kind: 'locomotion-switch',
        title: '⇄ LOCOMOTION MODE',
        titleRu: '⇄ LOCOMOTION MODE',
        subtitle: 'Toggle Teleport / Smooth',
        subtitleRu: 'Toggle Teleport / Smooth',
      });
    }

    // 9. THE 3 MASSIVE FUTURISTIC SCI-FI / GOTHIC PORTALS INTO SECTORS I, II, III
    // Plus the monumental overhead sign: `ARTMAZE // NEUROMICON PROJECT` + `github.com/AlexSheff/Neuromicon`!
    const atriumGroup = new THREE.Group();
    atriumGroup.name = 'threshold_atrium_reveal_group';
    root.add(atriumGroup);

    // Grand Overhead Banner above the Central Portal (`z = -8.0, y = 7.45`)
    const centralHeaderBanner = buildArtmazeHeaderBanner({
      x: 0,
      y: 7.45,
      z: -7.75,
      width: 6.2,
      height: 1.5,
      accentHex: '#e5c158',
      plasmaHex: '#9d4edd',
      repoUrl: 'github.com/AlexSheff/Neuromicon',
      trimMat: goldHeroMat,
    });
    atriumGroup.add(centralHeaderBanner);

    const cosmicDoorsSpec: Array<{
      segment: 1 | 2 | 3;
      x: number;
      z: number;
      rotY: number;
      mat: THREE.Material;
    }> = [
      {
        segment: 1,
        x: -6.4,
        z: -6.4,
        rotY: Math.PI * 0.17,
        mat: goldHeroMat,
      },
      {
        segment: 2,
        x: 0,
        z: -8.0,
        rotY: 0,
        mat: cyanHeroMat,
      },
      {
        segment: 3,
        x: 6.4,
        z: -6.4,
        rotY: -Math.PI * 0.17,
        mat: violetHeroMat,
      },
    ];

    cosmicDoorsSpec.forEach((spec, idx) => {
      const meta = SECTOR_HALL_META[spec.segment];
      const vortexTex = createDoorLeafTexture(
        '#050915',
        meta.accentHex,
        meta.plasmaHex
      );
      const vortexMat = new THREE.MeshStandardMaterial({
        map: vortexTex,
        roughness: 0.18,
        metalness: 0.76,
        emissive: meta.accentHex,
        emissiveIntensity: 0.24,
      });
      const plaqueTex = createSignageTexture(
        meta.symbol,
        meta.title,
        meta.subtitle,
        meta.range,
        meta.accentHex,
        '#f3ede2'
      );

      const portalGroup = buildWiredSciFiGothicPortal({
        x: spec.x,
        z: spec.z,
        rotY: spec.rotY,
        width: 3.4,
        height: 4.9,
        frameMat: spec.mat,
        vortexMat,
        accentHex: meta.accentHex,
        plasmaHex: meta.plasmaHex,
        statusColorHex: meta.accentHex,
        plaqueTex,
        plaqueWidth: 3.2,
        plaqueHeight: 1.3,
        cableSpread: 1.35,
        phaseSeed: idx * 2.1,
      });

      atriumGroup.add(portalGroup);
      registerTarget(portalGroup, {
        id: `COSMIC_HALL_DOOR_${spec.segment}`,
        kind: 'segment-portal',
        branch: meta.branch,
        segment: spec.segment,
        title: meta.title,
        titleRu: meta.title,
        subtitle: `${meta.subtitle} · Click to Enter Wired Portal`,
        subtitleRu: `${meta.subtitle} · Click to Enter Wired Portal`,
      });
    });

    // 10. Ascent & Descent Cosmic Dais Lifts on West and East Wings
    const ascentGroup = new THREE.Group();
    ascentGroup.position.set(-8.8, 0, -0.6);
    ascentGroup.rotation.y = Math.PI * 0.35;

    const ascentDais = new THREE.Mesh(
      new THREE.CylinderGeometry(2.1, 2.35, 0.32, 32),
      gothicBasaltMat
    );
    ascentDais.position.set(0, 0.16, 0);
    ascentGroup.add(ascentDais);
    walkableMeshes.push(ascentDais);

    const ascentRim = new THREE.Mesh(
      new THREE.TorusGeometry(2.12, 0.06, 12, 36),
      goldHeroMat
    );
    ascentRim.rotation.x = Math.PI * 0.5;
    ascentRim.position.set(0, 0.32, 0);
    ascentGroup.add(ascentRim);

    const ascentSpire = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.68, 0),
      goldHeroMat
    );
    ascentSpire.position.set(0, 4.15, 0);
    ascentGroup.add(ascentSpire);

    const ascentPlaqueTex = createSignageTexture(
      '▲',
      'ASCENT · SECTOR I',
      'EMBODY · GROW (01–11)',
      'SECTOR A',
      '#e5c158',
      '#f0d27a'
    );
    const ascentPlaque = new THREE.Mesh(
      new THREE.PlaneGeometry(2.5, 1.2),
      new THREE.MeshBasicMaterial({ map: ascentPlaqueTex })
    );
    ascentPlaque.position.set(0, 2.65, 0);
    ascentGroup.add(ascentPlaque);

    atriumGroup.add(ascentGroup);
    registerTarget(ascentGroup, {
      id: 'THRESHOLD_ASCENT',
      kind: 'threshold-branch',
      branch: 'ascend',
      title: '▲ ASCENT · SECTOR I',
      titleRu: '▲ ASCENT · SECTOR I',
      subtitle: 'Enter Sector I · Rooms 01–11',
      subtitleRu: 'Enter Sector I · Rooms 01–11',
    });

    const descentGroup = new THREE.Group();
    descentGroup.position.set(8.8, 0, -0.6);
    descentGroup.rotation.y = -Math.PI * 0.35;

    const descentDais = new THREE.Mesh(
      new THREE.CylinderGeometry(2.1, 2.35, 0.32, 32),
      gothicBasaltMat
    );
    descentDais.position.set(0, 0.16, 0);
    descentGroup.add(descentDais);
    walkableMeshes.push(descentDais);

    const descentRim = new THREE.Mesh(
      new THREE.TorusGeometry(2.12, 0.06, 12, 36),
      cyanHeroMat
    );
    descentRim.rotation.x = Math.PI * 0.5;
    descentRim.position.set(0, 0.32, 0);
    descentGroup.add(descentRim);

    const descentTorus = new THREE.Mesh(
      new THREE.TorusGeometry(0.88, 0.1, 14, 36),
      cyanHeroMat
    );
    descentTorus.position.set(0, 4.1, 0);
    descentGroup.add(descentTorus);

    const descentPlaqueTex = createSignageTexture(
      '▼',
      'DESCENT · SECTOR II',
      'SEARCH · EXPLORE (12–19)',
      'SECTOR B',
      '#4ea8de',
      '#7cc6f2'
    );
    const descentPlaque = new THREE.Mesh(
      new THREE.PlaneGeometry(2.5, 1.2),
      new THREE.MeshBasicMaterial({ map: descentPlaqueTex })
    );
    descentPlaque.position.set(0, 2.65, 0);
    descentGroup.add(descentPlaque);

    atriumGroup.add(descentGroup);
    registerTarget(descentGroup, {
      id: 'THRESHOLD_DESCENT',
      kind: 'threshold-branch',
      branch: 'descend',
      title: '▼ DESCENT · SECTOR II',
      titleRu: '▼ DESCENT · SECTOR II',
      subtitle: 'Enter Sector II · Rooms 12–19',
      subtitleRu: 'Enter Sector II · Rooms 12–19',
    });

    // Rung 3 Hint Engraved Plaque in World Space (Visible only if player is stuck >= 45s)
    const hintPlaqueTex = createSignageTexture(
      '◈',
      t('onboarding.hint.engraving', 'en'),
      'COSMIC NEXUS',
      '3 SECTORS',
      '#e5c158',
      '#f3ede2'
    );
    const hintPlaqueMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(2.0, 1.0),
      new THREE.MeshBasicMaterial({ map: hintPlaqueTex })
    );
    hintPlaqueMesh.name = 'onboarding_rung3_plaque';
    hintPlaqueMesh.position.set(0, 2.4, -2.2);
    hintPlaqueMesh.visible = false;
    root.add(hintPlaqueMesh);
  }

  /**
   * Animates Swirling Quartz Plasma Columns, Serene Plasma Filaments,
   * Travelling Floor Circuit Electric Sparks, VR Explorer Scale Figures, and
   * Multi-Scale Interactive Iridescent Soap Bubbles & 4-Archetype Chromatic Particles across ALL rooms and halls!
   * Strictly frozen when game clock is paused (`dt <= 0`).
   * Uses stateful `dt` velocity integration (zero `timeSec * dynamicBand` phase jumps, zero epileptic strobing).
   */
  private static readonly _scratchBubbleColor = new THREE.Color();
  private static readonly _scratchBubbleEmissive = new THREE.Color();
  private static readonly _scratchBubbles: THREE.Mesh[] = [];

  public static updateDynamicAtmosphere(
    root: THREE.Object3D,
    timeSec: number,
    reducedMotion = false
  ): void {
    const spectrum = spatialAudioSystem.getMultiBandSpectrum(timeSec);
    const bands = spectrum.bands;
    const beat = spectrum.beatPulse;
    const centroid = spectrum.spectralCentroid;

    // Compute smooth bounded frame delta `dt` from `timeSec` stored on `root.userData`
    const prevTime =
      typeof root.userData?.lastAtmosTimeSec === 'number'
        ? (root.userData.lastAtmosTimeSec as number)
        : timeSec - 0.016;
    const rawDt = timeSec - prevTime;
    const dt =
      rawDt > 0 && rawDt < 0.25 ? Math.min(0.033, Math.max(0.001, rawDt)) : 0.016;
    root.userData = root.userData || {};
    root.userData.lastAtmosTimeSec = timeSec;

    const bubbles = this._scratchBubbles;
    bubbles.length = 0;

    // Pass 1: Collect soap bubbles and update non-bubble elements with smooth incremental dt integration
    root.traverse((obj) => {
      if (obj.name === 'audio_soap_bubble') {
        bubbles.push(obj as THREE.Mesh);
      } else if (obj.name === 'plasma_vortex_core') {
        const mesh = obj as THREE.Mesh;
        const mat = mesh.material as THREE.MeshBasicMaterial;
        const seed = (mesh.userData?.phaseSeed as number) ?? 0;
        const bandVal = bands[Math.floor(seed * 3) & 15] ?? 0;
        if (!reducedMotion) {
          // Incremental rotation prevents instantaneous angular jumps when bandVal changes
          mesh.rotation.y += (0.38 + bandVal * 0.45) * dt;
          mat.opacity =
            0.7 + Math.sin(timeSec * 0.95 + seed) * 0.1 + bandVal * 0.14;
        } else {
          mat.opacity = 0.78;
        }
      } else if (obj.name === 'plasma_vortex_helix') {
        const mesh = obj as THREE.Mesh;
        const seed = (mesh.userData?.phaseSeed as number) ?? 0;
        const bandVal = bands[Math.floor(seed * 5) & 15] ?? 0;
        if (!reducedMotion) {
          mesh.rotation.y -= (0.52 + bandVal * 0.35) * dt;
        }
      } else if (obj.name === 'plasma_floor_pool') {
        const mesh = obj as THREE.Mesh;
        const mat = mesh.material as THREE.MeshBasicMaterial;
        const seed = (mesh.userData?.phaseSeed as number) ?? 0;
        if (!reducedMotion) {
          mat.opacity =
            0.16 + Math.sin(timeSec * 0.85 + seed) * 0.04 + beat * 0.08;
        }
      } else if (obj.name === 'plasma_lightning_arc') {
        const line = obj as THREE.LineSegments;
        const mat = line.material as THREE.LineBasicMaterial;
        const seed = (line.userData?.phaseSeed as number) ?? 0;
        if (reducedMotion) {
          mat.opacity = 0;
        } else {
          // Serene, photosensitive-safe slow plasma filament wave (no 14Hz snapping or strobing!)
          line.rotation.y += 0.22 * dt;
          const slowWave =
            Math.sin(timeSec * 0.55 + seed * 2.1) *
            Math.cos(timeSec * 0.82 - seed * 1.3);
          const env = Math.max(0, (slowWave - 0.35) / 0.65);
          mat.opacity = Math.min(0.42, env * env * 0.36 + beat * 0.08);
        }
      } else if (obj.name === 'floor_electric_spark') {
        const spark = obj as THREE.Mesh;
        const mat = spark.material as THREE.MeshBasicMaterial;
        const {
          angle = 0,
          maxRadius = 8,
          speed = 2.8,
          phase = 0,
        } = (spark.userData as {
          angle?: number;
          maxRadius?: number;
          speed?: number;
          phase?: number;
        }) ?? {};
        if (reducedMotion) {
          mat.opacity = 0.3;
        } else {
          // Smooth radial travel with sine bell-curve fade at both ends so wrapping is 100% invisible
          const span = Math.max(2.5, maxRadius - 1.6);
          const calmSpeed = speed * 0.38;
          const progress = ((timeSec * calmSpeed + phase) % span) / span;
          const dist = 1.4 + progress * span;
          spark.position.x = Math.sin(angle) * dist;
          spark.position.z = -Math.cos(angle) * dist;
          const edgeEnvelope = Math.sin(progress * Math.PI);
          mat.opacity = edgeEnvelope * (0.42 + beat * 0.16);
        }
      } else if (obj.name === 'vr_explorer_visor') {
        if (!reducedMotion) {
          obj.rotation.y = Math.sin(timeSec * 0.45) * 0.12;
        }
      } else if (obj.name === 'portal_wire_pulse') {
        const mesh = obj as THREE.Mesh;
        const mat = mesh.material as THREE.MeshBasicMaterial;
        const seed = (mesh.userData?.phaseSeed as number) ?? 0;
        if (reducedMotion) {
          mat.opacity = 0.85;
        } else {
          mat.opacity =
            0.66 + Math.sin(timeSec * 1.25 + seed) * 0.14 + beat * 0.12;
        }
      } else if (obj.name === 'portal_vortex_aperture') {
        const mesh = obj as THREE.Mesh;
        const mat = mesh.material as THREE.MeshStandardMaterial;
        const seed = (mesh.userData?.phaseSeed as number) ?? 0;
        if (mat && 'emissiveIntensity' in mat && !reducedMotion) {
          mat.emissiveIntensity =
            0.2 + Math.sin(timeSec * 1.1 + seed) * 0.05 + beat * 0.1;
        }
      }
    });

    // Pass 2: Multi-Scale Soap Bubble 3D Lissajous Currents + Bubble-to-Bubble Elastic Dipole & Hue Resonance
    const bubbleCount = bubbles.length;
    for (let i = 0; i < bubbleCount; i++) {
      const bA = bubbles[i];
      const uA = bA.userData as {
        bandIndex: number;
        baseHue: number;
        baseX: number;
        baseY: number;
        baseZ: number;
        curX: number;
        curY: number;
        curZ: number;
        vx: number;
        vy: number;
        vz: number;
        baseRadius: number;
        sizeTier: 'macro' | 'meso' | 'micro';
        phaseSeed: number;
        freqX: number;
        freqY: number;
        freqZ: number;
        orbitRx: number;
        orbitRy: number;
        orbitRz: number;
        spinY: number;
        spinZ: number;
        smoothBand: number;
        sympatheticHueShift: number;
        interactionSquash: number;
      };

      const rawBand = bands[uA.bandIndex & 15] ?? 0;
      uA.smoothBand += (rawBand - uA.smoothBand) * Math.min(1, dt * 6.5);
      const bandVal = uA.smoothBand;

      if (typeof uA.curX !== 'number') {
        uA.curX = uA.baseX ?? bA.position.x;
        uA.curY = uA.baseY ?? bA.position.y;
        uA.curZ = uA.baseZ ?? bA.position.z;
        uA.vx = 0;
        uA.vy = 0;
        uA.vz = 0;
        uA.spinY = uA.phaseSeed ?? 0;
        uA.spinZ = 0;
        uA.sympatheticHueShift = 0;
        uA.interactionSquash = 0;
      }

      if (!reducedMotion) {
        // 3D Lissajous & inclined figure-8 target trajectory unique to each bubble
        const fx = uA.freqX ?? 0.32;
        const fy = uA.freqY ?? 0.41;
        const fz = uA.freqZ ?? 0.29;
        const rx = (uA.orbitRx ?? 0.65) * (1 + bandVal * 0.35);
        const ry = (uA.orbitRy ?? 0.45) * (1 + bandVal * 0.4);
        const rz = (uA.orbitRz ?? 0.65) * (1 + bandVal * 0.35);
        const seed = uA.phaseSeed ?? 0;

        const targetX =
          uA.baseX +
          Math.sin(timeSec * fx + seed) * rx +
          Math.cos(timeSec * (fx * 1.618) - seed) * (rx * 0.35);
        const targetY =
          uA.baseY +
          Math.cos(timeSec * fy + seed * 1.3) * ry +
          Math.sin(timeSec * (fy * 0.5) + seed) * 0.22 +
          bandVal * 0.38;
        const targetZ =
          uA.baseZ +
          Math.cos(timeSec * fz + seed * 0.7) * rz +
          Math.sin(timeSec * (fz * 1.414) + seed) * (rz * 0.35);

        // Smooth spring force toward target 3D Lissajous current
        let ax = (targetX - uA.curX) * 2.4;
        let ay = (targetY - uA.curY) * 2.4;
        let az = (targetZ - uA.curZ) * 2.4;

        let huePull = 0;
        let squashTarget = 0;

        // Bubble-to-Bubble Interactions: Mutual tangential orbital dance + soft elastic cushion + sympathetic hue blend
        for (let j = 0; j < bubbleCount; j++) {
          if (i === j) continue;
          const bB = bubbles[j];
          const uB = bB.userData;
          const bx = (uB.curX as number) ?? bB.position.x;
          const by = (uB.curY as number) ?? bB.position.y;
          const bz = (uB.curZ as number) ?? bB.position.z;
          const dx = uA.curX - bx;
          const dy = uA.curY - by;
          const dz = uA.curZ - bz;
          const distSq = dx * dx + dy * dy + dz * dz;
          const interactRadius = 3.2;

          if (distSq > 0.0001 && distSq < interactRadius * interactRadius) {
            const dist = Math.sqrt(distSq);
            const closeness = 1 - dist / interactRadius;
            const nx = dx / dist;
            const ny = dy / dist;
            const nz = dz / dist;

            // Soft elastic repulsion when closer than 2.8x combined radii
            const minSep = (uA.baseRadius + (uB.baseRadius ?? 0.28)) * 2.8;
            if (dist < minSep) {
              const repulse = ((minSep - dist) / minSep) * 3.2;
              ax += nx * repulse;
              ay += ny * repulse * 0.6;
              az += nz * repulse;
              squashTarget = Math.max(
                squashTarget,
                ((minSep - dist) / minSep) * 0.16
              );
            }

            // Mutual tangential vortex swirl (bubbles gracefully waltz around each other on close approach)
            const swirlStrength = closeness * closeness * 1.45;
            ax += -nz * swirlStrength;
            az += nx * swirlStrength;

            // Sympathetic hue resonance between interacting bubbles
            const otherHue = (uB.baseHue as number) ?? 0;
            huePull += (otherHue - uA.baseHue) * closeness * 0.35;
          }
        }

        const damping = Math.exp(-3.2 * dt);
        uA.vx = (uA.vx + ax * dt) * damping;
        uA.vy = (uA.vy + ay * dt) * damping;
        uA.vz = (uA.vz + az * dt) * damping;

        uA.curX += uA.vx * dt;
        uA.curY += uA.vy * dt;
        uA.curZ += uA.vz * dt;

        bA.position.set(uA.curX, uA.curY, uA.curZ);

        uA.sympatheticHueShift +=
          (huePull - uA.sympatheticHueShift) * Math.min(1, dt * 4.0);
        uA.interactionSquash +=
          (squashTarget - uA.interactionSquash) * Math.min(1, dt * 7.0);

        // Smooth incremental thin-film spin (never jumps when bandVal changes!)
        const spinRate =
          (uA.sizeTier === 'macro'
            ? 0.28
            : uA.sizeTier === 'micro'
            ? 0.72
            : 0.45) +
          bandVal * 0.95;
        uA.spinY += spinRate * dt;
        uA.spinZ = Math.sin(timeSec * 0.95 + seed) * 0.28;
        bA.rotation.y = uA.spinY;
        bA.rotation.z = uA.spinZ;

        // Smooth elastic breathing & interaction deformation
        const s = uA.baseRadius * (1.0 + bandVal * 0.52 + beat * 0.16);
        const wobble =
          1.0 +
          Math.sin(timeSec * 2.1 + seed) * 0.045 * (1 + bandVal * 0.6) +
          uA.interactionSquash;
        bA.scale.set(s * wobble, s / wobble, s * wobble);
      } else {
        bA.scale.setScalar(uA.baseRadius * (1.0 + bandVal * 0.2));
      }

      const mat = bA.material as THREE.MeshStandardMaterial;
      const hue =
        (uA.baseHue +
          uA.sympatheticHueShift +
          bandVal * 0.22 +
          centroid * 0.12 +
          timeSec * 0.025 +
          1.0) %
        1.0;

      this._scratchBubbleColor.setHSL(
        hue,
        0.95,
        Math.min(0.82, 0.54 + bandVal * 0.24)
      );
      this._scratchBubbleEmissive.setHSL(
        (hue + 0.16) % 1.0,
        0.98,
        Math.min(0.72, 0.3 + bandVal * 0.36 + beat * 0.12)
      );

      mat.color.copy(this._scratchBubbleColor);
      mat.emissive.copy(this._scratchBubbleEmissive);
      mat.emissiveIntensity = 0.45 + bandVal * 1.15 + beat * 0.35;
      mat.opacity =
        (uA.sizeTier === 'macro' ? 0.54 : uA.sizeTier === 'micro' ? 0.72 : 0.62) +
        bandVal * 0.26;
    }

    // Pass 3: Multi-Scale, 4-Archetype Chromatic Particles + Bubble Orbital Capture + Neighbor Flocking
    root.traverse((obj) => {
      if (obj.name === 'audio_chromatic_particles') {
        const points = obj as THREE.Points;
        const geo = points.geometry;
        const posAttr = geo.getAttribute('position') as THREE.BufferAttribute;
        const colAttr = geo.getAttribute('color') as THREE.BufferAttribute;
        const sizeAttr = geo.getAttribute('aSizeScale') as
          | THREE.BufferAttribute
          | undefined;

        const {
          basePositions,
          velocities,
          baseSizes,
          sizeScales,
          archetypes,
          phases,
          smoothBands,
          particleCount = 0,
        } = (points.userData as {
          basePositions?: Float32Array;
          velocities?: Float32Array;
          baseSizes?: Float32Array;
          sizeScales?: Float32Array;
          archetypes?: Uint8Array;
          phases?: Float32Array;
          smoothBands?: Float32Array;
          particleCount?: number;
        }) ?? {};

        if (posAttr && colAttr && basePositions && particleCount > 0) {
          const posArr = posAttr.array as Float32Array;
          const colArr = colAttr.array as Float32Array;

          for (let i = 0; i < particleCount; i++) {
            const idx3 = i * 3;
            const bandIdx = i & 15;
            const rawB = bands[bandIdx] ?? 0;
            const prevSmooth = smoothBands ? smoothBands[i] : rawB;
            const bVal = prevSmooth + (rawB - prevSmooth) * Math.min(1, dt * 6.0);
            if (smoothBands) smoothBands[i] = bVal;

            const arch = archetypes ? archetypes[i] : i % 4;
            const baseSz = baseSizes ? baseSizes[i] : 1.0;
            const phase = phases ? phases[i] : i * 0.37;

            let px = posArr[idx3];
            let py = posArr[idx3 + 1];
            let pz = posArr[idx3 + 2];

            let capturedHueShift = 0;
            let capturedSizeBoost = 0;

            if (!reducedMotion && velocities) {
              let vx = velocities[idx3];
              let vy = velocities[idx3 + 1];
              let vz = velocities[idx3 + 2];

              const bx = basePositions[idx3];
              const by = basePositions[idx3 + 1];
              const bz = basePositions[idx3 + 2];

              // 1. Archetype-specific 3D Curl-Vortex & Convection Flow Field
              let fx = 0;
              let fy = 0;
              let fz = 0;

              if (arch === 0) {
                // Archetype 0: Giant Bokeh Orbs — slow, majestic toroidal convection plumes
                const tSlow = timeSec * 0.28 + phase;
                const targetX = bx + Math.sin(tSlow) * 0.75;
                const targetY =
                  by + Math.cos(tSlow * 0.8) * 0.55 + bVal * 0.45;
                const targetZ = bz + Math.cos(tSlow) * 0.75;
                fx = (targetX - px) * 1.4;
                fy = (targetY - py) * 1.4;
                fz = (targetZ - pz) * 1.4;
              } else if (arch === 1) {
                // Archetype 1: Double-Helix Curl Vortex Streamers — 3D divergence-free rotational eddies
                const curlT = timeSec * 0.45;
                const curlX =
                  Math.sin(py * 0.65 + curlT + phase) -
                  Math.cos(pz * 0.55 - curlT);
                const curlY =
                  Math.sin(pz * 0.55 + curlT) -
                  Math.cos(px * 0.55 + phase * 0.5);
                const curlZ =
                  Math.sin(px * 0.55 - curlT + phase) -
                  Math.cos(py * 0.65 + curlT);
                const swirlGain = 0.85 + bVal * 1.15;
                fx = curlX * swirlGain + (bx - px) * 0.65;
                fy = curlY * 0.65 * swirlGain + (by + bVal * 0.5 - py) * 0.75;
                fz = curlZ * swirlGain + (bz - pz) * 0.65;
              } else if (arch === 2) {
                // Archetype 2: Bubble-Seeker Satellites — roam along figure-8 currents seeking nearby soap bubbles
                const tSeek = timeSec * 0.62 + phase;
                const targetX = bx + Math.sin(tSeek) * 1.25;
                const targetY =
                  by + Math.sin(tSeek * 1.618) * 0.68 + bVal * 0.55;
                const targetZ = bz + Math.cos(tSeek * 0.85) * 1.25;
                fx = (targetX - px) * 1.6;
                fy = (targetY - py) * 1.6;
                fz = (targetZ - pz) * 1.6;
              } else {
                // Archetype 3: Fine Stardust Micro-Sparks — nimble harmonic figure-8 + neighbor flocking
                const tSpark = timeSec * 0.78 + phase;
                fx =
                  Math.cos(tSpark + py * 0.9) * (0.9 + bVal * 1.3) +
                  (bx - px) * 0.95;
                fy =
                  Math.sin(tSpark * 1.3 + px * 0.8) * (0.75 + bVal * 1.1) +
                  (by + bVal * 0.45 - py) * 0.95;
                fz =
                  Math.sin(tSpark - pz * 0.9) * (0.9 + bVal * 1.3) +
                  (bz - pz) * 0.95;
              }

              // 2. Particle-to-Bubble Gravitational & Tangential Vortex Capture!
              // Particles near any Iridescent Soap Bubble get swept into a glowing orbital ring around the bubble
              if (bubbleCount > 0) {
                let nearestDistSq = 999;
                let nearBubble: THREE.Mesh | null = null;
                for (let b = 0; b < bubbleCount; b++) {
                  const bm = bubbles[b];
                  const dx = px - bm.position.x;
                  const dy = py - bm.position.y;
                  const dz = pz - bm.position.z;
                  const d2 = dx * dx + dy * dy + dz * dz;
                  if (d2 < nearestDistSq) {
                    nearestDistSq = d2;
                    nearBubble = bm;
                  }
                }

                const captureRange = arch === 2 ? 3.2 : 2.3;
                if (
                  nearBubble &&
                  nearestDistSq > 0.0001 &&
                  nearestDistSq < captureRange * captureRange
                ) {
                  const dist = Math.sqrt(nearestDistSq);
                  const bRad =
                    (nearBubble.userData?.baseRadius as number) ?? 0.3;
                  const bBand =
                    (nearBubble.userData?.smoothBand as number) ?? bVal;
                  const bHue = (nearBubble.userData?.baseHue as number) ?? 0;

                  // Ideal orbital shell radius around the soap bubble
                  const orbitShell = bRad * (1.85 + (i % 3) * 0.35);
                  const rx = (px - nearBubble.position.x) / dist;
                  const ry = (py - nearBubble.position.y) / dist;
                  const rz = (pz - nearBubble.position.z) / dist;

                  const influence = 1 - dist / captureRange;
                  // Radial spring pulling particle onto the bubble's orbital shell (repels if inside shell, attracts if outside)
                  const shellForce = (orbitShell - dist) * 3.8 * influence;
                  fx += rx * shellForce;
                  fy += ry * shellForce;
                  fz += rz * shellForce;

                  // Tangential cross-product swirl around the bubble's spin axis
                  const orbitSpeed =
                    (arch === 2 ? 3.4 : 2.1) * influence * (1 + bBand * 0.85);
                  fx += -rz * orbitSpeed;
                  fz += rx * orbitSpeed;
                  fy += Math.sin(phase + timeSec * 1.8) * 0.55 * influence;

                  capturedHueShift = (bHue - bandIdx / 16) * influence * 0.65;
                  capturedSizeBoost = influence * (0.42 + bBand * 0.45);
                }
              }

              // 3. Particle-to-Particle Neighbor Flocking (Alignment & Soft Dipole Repulsion)
              const nIdx = ((i + 7) % particleCount) * 3;
              const ndx = px - posArr[nIdx];
              const ndy = py - posArr[nIdx + 1];
              const ndz = pz - posArr[nIdx + 2];
              const nDistSq = ndx * ndx + ndy * ndy + ndz * ndz;

              if (nDistSq > 0.0001 && nDistSq < 3.24) {
                const nDist = Math.sqrt(nDistSq);
                if (nDist < 0.65) {
                  // Soft close-range dipole repulsion so particles never clump
                  const rep = ((0.65 - nDist) / 0.65) * 2.2;
                  fx += (ndx / nDist) * rep;
                  fy += (ndy / nDist) * rep;
                  fz += (ndz / nDist) * rep;
                } else {
                  // Mid-range velocity alignment creating graceful flowing ribbons/murmurations
                  const align = 0.42;
                  fx += (velocities[nIdx] - vx) * align;
                  fy += (velocities[nIdx + 1] - vy) * align;
                  fz += (velocities[nIdx + 2] - vz) * align;
                }
              }

              const pDamp = Math.exp(-(arch === 0 ? 3.4 : 2.6) * dt);
              vx = (vx + fx * dt) * pDamp;
              vy = (vy + fy * dt) * pDamp;
              vz = (vz + fz * dt) * pDamp;

              // Clamp velocity for absolute comfort
              const maxV = arch === 0 ? 0.9 : arch === 3 ? 2.2 : 1.65;
              const vSq = vx * vx + vy * vy + vz * vz;
              if (vSq > maxV * maxV) {
                const invV = maxV / Math.sqrt(vSq);
                vx *= invV;
                vy *= invV;
                vz *= invV;
              }

              px += vx * dt;
              py += vy * dt;
              pz += vz * dt;

              velocities[idx3] = vx;
              velocities[idx3 + 1] = vy;
              velocities[idx3 + 2] = vz;

              posArr[idx3] = px;
              posArr[idx3 + 1] = py;
              posArr[idx3 + 2] = pz;
            }

            // Dynamic per-particle size modulation (multi-scale base size + harmonic swell + bubble capture aura)
            if (sizeScales && sizeAttr) {
              const breathe =
                1.0 +
                Math.sin(timeSec * (arch === 0 ? 0.9 : 1.7) + phase) * 0.16;
              sizeScales[i] =
                baseSz *
                (breathe + bVal * (arch === 3 ? 0.85 : 0.55) + capturedSizeBoost);
            }

            // Smooth harmonic color evolution + sympathetic shift when orbiting a soap bubble
            const pHue =
              (bandIdx / 16 +
                capturedHueShift +
                bVal * 0.18 +
                centroid * 0.1 +
                timeSec * 0.02 +
                1.0) %
              1.0;
            this._scratchBubbleColor.setHSL(
              pHue,
              arch === 3 ? 0.9 : 0.96,
              Math.min(
                0.9,
                (arch === 0 ? 0.52 : 0.56) +
                  bVal * 0.3 +
                  capturedSizeBoost * 0.25 +
                  beat * 0.08
              )
            );
            colArr[idx3] = this._scratchBubbleColor.r;
            colArr[idx3 + 1] = this._scratchBubbleColor.g;
            colArr[idx3 + 2] = this._scratchBubbleColor.b;
          }

          colAttr.needsUpdate = true;
          if (sizeAttr) sizeAttr.needsUpdate = true;
          if (!reducedMotion) {
            posAttr.needsUpdate = true;
          }
        }
      } else if (obj.name === 'audio_macro_bokeh_particles') {
        // Companion Macro-Bokeh Layer: large dreamy atmospheric orbs drifting on slow convection currents
        const points = obj as THREE.Points;
        const geo = points.geometry;
        const posAttr = geo.getAttribute('position') as THREE.BufferAttribute;
        const colAttr = geo.getAttribute('color') as THREE.BufferAttribute;
        const {
          basePositions,
          velocities,
          phases,
          particleCount = 0,
        } = (points.userData as {
          basePositions?: Float32Array;
          velocities?: Float32Array;
          phases?: Float32Array;
          particleCount?: number;
        }) ?? {};

        if (posAttr && colAttr && basePositions && particleCount > 0) {
          const posArr = posAttr.array as Float32Array;
          const colArr = colAttr.array as Float32Array;

          for (let i = 0; i < particleCount; i++) {
            const idx3 = i * 3;
            const bandIdx = (i * 3) & 15;
            const bVal = bands[bandIdx] ?? 0;
            const phase = phases ? phases[i] : i * 1.17;

            if (!reducedMotion && velocities) {
              const bx = basePositions[idx3];
              const by = basePositions[idx3 + 1];
              const bz = basePositions[idx3 + 2];
              const tSlow = timeSec * 0.24 + phase;
              const tx =
                bx + Math.sin(tSlow) * 0.95 + Math.cos(tSlow * 0.6) * 0.4;
              const ty = by + Math.cos(tSlow * 0.75) * 0.6 + bVal * 0.5;
              const tz =
                bz + Math.cos(tSlow) * 0.95 + Math.sin(tSlow * 0.6) * 0.4;

              const damp = Math.exp(-2.8 * dt);
              velocities[idx3] =
                (velocities[idx3] + (tx - posArr[idx3]) * 1.2 * dt) * damp;
              velocities[idx3 + 1] =
                (velocities[idx3 + 1] + (ty - posArr[idx3 + 1]) * 1.2 * dt) *
                damp;
              velocities[idx3 + 2] =
                (velocities[idx3 + 2] + (tz - posArr[idx3 + 2]) * 1.2 * dt) *
                damp;

              posArr[idx3] += velocities[idx3] * dt;
              posArr[idx3 + 1] += velocities[idx3 + 1] * dt;
              posArr[idx3 + 2] += velocities[idx3 + 2] * dt;
            }

            const hue =
              (bandIdx / 16 + bVal * 0.16 + centroid * 0.08 + timeSec * 0.018) %
              1.0;
            this._scratchBubbleColor.setHSL(
              hue,
              0.92,
              Math.min(0.84, 0.5 + bVal * 0.28 + beat * 0.08)
            );
            colArr[idx3] = this._scratchBubbleColor.r;
            colArr[idx3 + 1] = this._scratchBubbleColor.g;
            colArr[idx3 + 2] = this._scratchBubbleColor.b;
          }

          colAttr.needsUpdate = true;
          if (!reducedMotion) {
            posAttr.needsUpdate = true;
          }
        }
      }
    });
  }

  /**
   * Animates the Grand Cosmic Starting Room's celestial astrolabe rings and onboarding beacons
   * only when game clock is NOT paused (`dt > 0`).
   */
  public static updateThresholdOnboardingVisuals(
    root: THREE.Group,
    visual: OnboardingVisualState,
    timeSec: number,
    reducedMotion = false
  ): void {
    const moveRing = root.getObjectByName('onboarding_move_ring');
    if (moveRing) {
      moveRing.visible = visual.showMoveRing;
      if (!reducedMotion) {
        const scale = 1 + Math.sin(timeSec * 3.2) * 0.08;
        moveRing.scale.set(scale, 1, scale);
      }
    }

    const pedCrystal = root.getObjectByName('onboarding_pedestal_crystal');
    if (pedCrystal && !reducedMotion) {
      pedCrystal.rotation.y = timeSec * 0.85;
      pedCrystal.position.y = 1.45 + Math.sin(timeSec * 2.2) * 0.07;
    }

    const astrolabe = root.getObjectByName('cosmic_astrolabe_rings');
    if (astrolabe && !reducedMotion) {
      astrolabe.rotation.y = timeSec * 0.14;
      astrolabe.rotation.z = Math.sin(timeSec * 0.25) * 0.12;
    }

    const postureMarks = root.getObjectByName('onboarding_posture_marks');
    if (postureMarks) {
      postureMarks.visible = visual.showComfortCalibrationMarks;
    }

    const atriumGroup = root.getObjectByName('threshold_atrium_reveal_group');
    if (atriumGroup) {
      atriumGroup.visible = true;
    }

    const rung3Plaque = root.getObjectByName('onboarding_rung3_plaque');
    if (rung3Plaque) {
      rung3Plaque.visible = visual.hintRung >= 3;
    }
  }

  /**
   * Builds one of the 3 Grand Gothic-Plasma-Cosmic Sector Halls (`segment = 1 | 2 | 3`):
   * - Sector I (Warm Ascent `NEB_0002` Pillars of Creation): 11 Portals to Rooms 01–11
   * - Sector II (Cool Descent `NEB_0012` Veil Nebula): 8 Portals to Rooms 12–19
   * - Sector III (Deep Field `NEB_0024` SMACS 0723): 6 Portals to Rooms 20–25
   */
  public static buildCorridorSegment(
    root: THREE.Group,
    scene: THREE.Scene,
    _branch: CorridorBranch,
    segment: 1 | 2 | 3,
    state: HubPlayerState,
    registerTarget: (
      mesh: THREE.Object3D,
      target: SpatialInteractiveTarget
    ) => void,
    walkableMeshes: THREE.Object3D[]
  ): void {
    const meta = SECTOR_HALL_META[segment] ?? SECTOR_HALL_META[1];
    const skyRig = nebulaSkySystem.mountRoomSkyAndLighting(
      meta.sceneSkyKey,
      root,
      scene,
      {
        qualityTier: state.comfort.qualityTier,
        reducedMotion: state.comfort.reducedMotion,
      }
    );

    const accentHex = skyRig.palette[0] ?? meta.accentHex;
    const rimHex = skyRig.palette[2] ?? meta.accentHex;

    const width = 20;
    const height = 9.6;
    const depth = 36;
    const halfW = width * 0.5;
    const halfD = depth * 0.5;

    const floorTex = createCosmicFloorTexture(
      segment === 1
        ? 'rgba(229, 193, 88, 0.28)'
        : segment === 2
        ? 'rgba(78, 168, 222, 0.28)'
        : 'rgba(179, 136, 255, 0.28)',
      4,
      7
    );
    const sideWallTex = createArchitecturalWallTexture(
      '#060912',
      accentHex,
      meta.plasmaHex,
      6,
      1
    );
    const endWallTex = createArchitecturalWallTexture(
      '#060912',
      accentHex,
      meta.plasmaHex,
      3,
      1
    );

    const sideWallMat = new THREE.MeshStandardMaterial({
      map: sideWallTex,
      roughness: 0.5,
      metalness: 0.24,
    });
    const endWallMat = new THREE.MeshStandardMaterial({
      map: endWallTex,
      roughness: 0.5,
      metalness: 0.24,
    });
    const gothicBasaltMat = new THREE.MeshStandardMaterial({
      color: '#0e1320',
      roughness: 0.42,
      metalness: 0.32,
    });
    const floorMat = new THREE.MeshStandardMaterial({
      map: floorTex,
      roughness: 0.16,
      metalness: 0.58,
    });
    const heroTrimMat = new THREE.MeshStandardMaterial({
      color: accentHex,
      roughness: 0.2,
      metalness: 0.85,
      emissive: rimHex,
      emissiveIntensity: 0.28,
    });

    // 1. Walkable Polished Dark Basalt Floor (y = 0, with Fractals & Circuit Schematics)
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(width, depth),
      floorMat
    );
    floor.rotation.x = -Math.PI * 0.5;
    root.add(floor);
    walkableMeshes.push(floor);

    buildFloorElectricCircuitSparks({
      root,
      maxRadius: 9.2,
      primaryHex: meta.plasmaHex,
      secondaryHex: '#4ea8de',
      goldHex: '#e5c158',
    });

    // 2. High Gothic Ribbed Vaults & Open Celestial Oculus overhead
    buildGothicRibbedVaultsAndOculus({
      root,
      oculusRadius: 5.8,
      spanRadiusX: halfW - 0.4,
      spanRadiusZ: halfD - 2.0,
      wallHeight: height,
      vaultApexY: height + 3.2,
      ribAnglesDeg: [-70, -35, 35, 70, -110, -145, 110, 145],
      basaltMat: gothicBasaltMat,
      trimMat: heroTrimMat,
      innerGlowHex: meta.accentHex,
      veilHex: rimHex,
      centerZ: -2.0,
    });

    // 16-Band Audio-Reactive Iridescent Soap Bubbles & Soft Spherical Multi-Colored Particles
    buildAudioReactiveBubblesAndParticles({
      root,
      radiusX: halfW - 1.6,
      radiusZ: halfD - 2.8,
      minY: 1.8,
      maxY: 8.6,
      bubbleCount: 16,
      particleCount: 192,
      centerZ: 0,
    });

    // Central Fractal Medallion directly beneath the Celestial Oculus
    const centerBasinRim = new THREE.Mesh(
      new THREE.RingGeometry(1.6, 3.3, 48),
      new THREE.MeshStandardMaterial({
        color: skyRig.palette[1] ?? accentHex,
        roughness: 0.14,
        metalness: 0.85,
        emissive: skyRig.palette[0] ?? '#143852',
        emissiveIntensity: 0.32,
        side: THREE.DoubleSide,
      })
    );
    centerBasinRim.rotation.x = -Math.PI * 0.5;
    centerBasinRim.position.set(0, 0.016, -2.0);
    root.add(centerBasinRim);

    // 3. Dark Basalt Gothic Side & End Walls
    [-halfW, halfW].forEach((wx) => {
      const sideWall = new THREE.Mesh(
        new THREE.PlaneGeometry(depth, height),
        sideWallMat
      );
      sideWall.rotation.y = wx < 0 ? Math.PI * 0.5 : -Math.PI * 0.5;
      sideWall.position.set(wx, height * 0.5, 0);
      root.add(sideWall);

      const cornice = new THREE.Mesh(
        new THREE.BoxGeometry(0.65, 0.45, depth),
        gothicBasaltMat
      );
      cornice.position.set(
        wx < 0 ? wx + 0.32 : wx - 0.32,
        height - 0.22,
        0
      );
      root.add(cornice);
    });

    [-halfD, halfD].forEach((wz) => {
      const endWall = new THREE.Mesh(
        new THREE.PlaneGeometry(width, height),
        endWallMat
      );
      endWall.rotation.y = wz < 0 ? 0 : Math.PI;
      endWall.position.set(0, height * 0.5, wz);
      root.add(endWall);

      const endCornice = new THREE.Mesh(
        new THREE.BoxGeometry(width, 0.45, 0.65),
        gothicBasaltMat
      );
      endCornice.position.set(
        0,
        height - 0.22,
        wz < 0 ? wz + 0.32 : wz - 0.32
      );
      root.add(endCornice);
    });

    // 4. Tall Transparent Quartz Glass Plasma Columns with Swirling Plasma & Lightning strictly BETWEEN the Door Bays!
    const columnZPositions = [-15.0, -5.0, 5.0, 15.0];
    let cSeed = 1;
    for (const side of [-1, 1]) {
      for (const pz of columnZPositions) {
        const plasmaCol = buildQuartzPlasmaColumn({
          x: side * (halfW - 0.68),
          z: pz,
          height: height - 0.2,
          radius: 0.38,
          primaryHex: meta.plasmaHex,
          secondaryHex: meta.accentHex,
          goldHex: '#e5c158',
          basaltMat: gothicBasaltMat,
          trimMat: heroTrimMat,
          phaseSeed: cSeed * 1.37,
        });
        root.add(plasmaCol);
        cSeed++;
      }
    }

    // 5. VR Explorer Scale Figures admiring the Sector Cathedral
    root.add(
      buildVRExplorerScaleFigure({
        x: -3.6,
        z: -6.5,
        rotY: 0.25,
        visorHex: meta.accentHex,
        trimHex: meta.plasmaHex,
      })
    );
    root.add(
      buildVRExplorerScaleFigure({
        x: 3.6,
        z: 4.5,
        rotY: -0.35,
        visorHex: '#e5c158',
        trimHex: meta.accentHex,
      })
    );

    // 6. Central Overhead Banner on the North Cathedral Wall: `ARTMAZE // NEUROMICON PROJECT`
    root.add(
      buildArtmazeHeaderBanner({
        x: 0,
        y: 6.85,
        z: -halfD + 0.32,
        width: 5.8,
        height: 1.4,
        accentHex: meta.accentHex,
        plasmaHex: meta.plasmaHex,
        repoUrl: 'github.com/AlexSheff/Neuromicon',
        trimMat: heroTrimMat,
      })
    );

    // 7. Futuristic Sci-Fi/Gothic Portals to every Artwork & Audio Room in this Sector
    const segmentNodes = getWorldNodes().filter((n) => n.segment === segment);
    const doorLeafTex = createDoorLeafTexture(
      '#070b16',
      accentHex,
      meta.plasmaHex
    );
    const doorLeafMat = new THREE.MeshStandardMaterial({
      map: doorLeafTex,
      roughness: 0.22,
      metalness: 0.72,
      emissive: accentHex,
      emissiveIntensity: 0.16,
    });

    const doorSlots: Array<{ x: number; z: number; rotY: number }> = [
      { x: -halfW + 0.1, z: -12.5, rotY: Math.PI * 0.5 },
      { x: halfW - 0.1, z: -12.5, rotY: -Math.PI * 0.5 },
      { x: -halfW + 0.1, z: -7.5, rotY: Math.PI * 0.5 },
      { x: halfW - 0.1, z: -7.5, rotY: -Math.PI * 0.5 },
      { x: -halfW + 0.1, z: -2.5, rotY: Math.PI * 0.5 },
      { x: halfW - 0.1, z: -2.5, rotY: -Math.PI * 0.5 },
      { x: -halfW + 0.1, z: 2.5, rotY: Math.PI * 0.5 },
      { x: halfW - 0.1, z: 2.5, rotY: -Math.PI * 0.5 },
      { x: -halfW + 0.1, z: 7.5, rotY: Math.PI * 0.5 },
      { x: halfW - 0.1, z: 7.5, rotY: -Math.PI * 0.5 },
      { x: -halfW + 0.1, z: 12.5, rotY: Math.PI * 0.5 },
    ];

    segmentNodes.forEach((node, index) => {
      const slot = doorSlots[index % doorSlots.length];
      const isCompleted = state.completedRooms.includes(node.id);
      const isVisited = state.visitedRooms.includes(node.id);
      const isPlanned = node.status === 'planned';

      const statusLabel = isPlanned
        ? 'SEALED'
        : isCompleted
        ? 'COMPLETED'
        : isVisited
        ? 'VISITED'
        : 'PORTAL ACTIVE';

      const statusColor = isPlanned
        ? '#777777'
        : isCompleted
        ? '#66cc99'
        : isVisited
        ? '#6fa8dc'
        : rimHex;

      const plaqueTex = createSignageTexture(
        node.symbol,
        node.title,
        node.dimension,
        statusLabel,
        accentHex,
        statusColor
      );

      const portalGroup = buildWiredSciFiGothicPortal({
        x: slot.x,
        z: slot.z,
        rotY: slot.rotY,
        width: 2.48,
        height: 3.78,
        frameMat: heroTrimMat,
        vortexMat: doorLeafMat,
        accentHex,
        plasmaHex: meta.plasmaHex,
        statusColorHex: statusColor,
        plaqueTex,
        plaqueWidth: 2.22,
        plaqueHeight: 1.05,
        cableSpread: 0.92,
        phaseSeed: index * 0.85,
      });

      root.add(portalGroup);
      registerTarget(portalGroup, {
        id: `CORRIDOR_DOOR_${node.id}`,
        kind: 'corridor-door',
        roomId: node.id,
        status: node.status,
        title: `${node.symbol} · ${node.title}`,
        titleRu: `${node.symbol} · ${node.title}`,
        subtitle: `${node.dimension} · Enter Wired Portal to Room`,
        subtitleRu: `${node.dimension} · Enter Wired Portal to Room`,
      });
    });

    // 8. North Wall: Wired Portals to the other 2 Sector Rooms
    const otherSegments = ([1, 2, 3] as const).filter((s) => s !== segment);
    otherSegments.forEach((targetSeg, idx) => {
      const targetMeta = SECTOR_HALL_META[targetSeg];
      const px = idx === 0 ? -3.8 : 3.8;

      const nPlaqueTex = createSignageTexture(
        targetMeta.symbol,
        targetMeta.title,
        targetMeta.range,
        'SECTOR PORTAL',
        targetMeta.accentHex,
        '#f3ede2'
      );

      const northPortal = buildWiredSciFiGothicPortal({
        x: px,
        z: -halfD + 0.28,
        rotY: 0,
        width: 3.0,
        height: 4.1,
        frameMat: heroTrimMat,
        vortexMat: doorLeafMat,
        accentHex: targetMeta.accentHex,
        plasmaHex: targetMeta.plasmaHex,
        statusColorHex: targetMeta.accentHex,
        plaqueTex: nPlaqueTex,
        plaqueWidth: 2.5,
        plaqueHeight: 1.12,
        cableSpread: 1.1,
        phaseSeed: (idx + 1) * 3.1,
      });

      root.add(northPortal);
      registerTarget(northPortal, {
        id: `PORTAL_SEG_${targetSeg}`,
        kind: 'segment-portal',
        branch: targetMeta.branch,
        segment: targetSeg,
        title: targetMeta.title,
        titleRu: targetMeta.title,
        subtitle: targetMeta.subtitle,
        subtitleRu: targetMeta.subtitle,
      });
    });

    // 9. South Wired Portal: Return to Grand Cosmic Starting Room
    const sPlaqueTex = createSignageTexture(
      '↺',
      'COSMIC NEXUS',
      'STARTING COSMIC ROOM',
      '3 SECTORS HUB',
      accentHex,
      '#d8cfc0'
    );

    const southPortal = buildWiredSciFiGothicPortal({
      x: 0,
      z: halfD - 0.28,
      rotY: Math.PI,
      width: 3.1,
      height: 4.1,
      frameMat: heroTrimMat,
      vortexMat: doorLeafMat,
      accentHex,
      plasmaHex: meta.plasmaHex,
      statusColorHex: '#ffe8a3',
      plaqueTex: sPlaqueTex,
      plaqueWidth: 2.5,
      plaqueHeight: 1.12,
      cableSpread: 1.15,
      phaseSeed: 7.7,
    });

    root.add(southPortal);
    registerTarget(southPortal, {
      id: 'PORTAL_THRESHOLD',
      kind: 'corridor-return',
      title: '↺ COSMIC STARTING ROOM',
      titleRu: '↺ COSMIC STARTING ROOM',
      subtitle: 'Return to the Grand Cosmic Nexus',
      subtitleRu: 'Return to the Grand Cosmic Nexus',
    });
  }
}

