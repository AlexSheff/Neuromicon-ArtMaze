import * as THREE from 'three';
import worldGraphData from '../../content/world.graph.json';
import { t } from '../i18n/strings';
import { OnboardingVisualState } from '../onboarding/types';
import { CorridorBranch } from '../room-sdk';
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
const MAX_SIGNAGE_CACHE_ENTRIES = 96;

export function clearSignageTextureCache(): void {
  for (const tex of signageTextureCache.values()) {
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
      oldestTex?.dispose();
    }
  }
  signageTextureCache.set(cacheKey, tex);
  return tex;
}

/**
 * Power-of-Two (512x256) Sci-Fi / Gothic Portal Display & Plaque Texture (EXPERIENCE_PROTOCOL.md §3.4 & TZ.md §4.4).
 * Dark forged basalt & gunmetal casing with glowing neon contours and built-in telemetry readout.
 * Cached by parameter key so scene rebuilds reuse existing CanvasTexture instances.
 */
export function createSignageTexture(
  symbol: string,
  title: string,
  subtitle: string,
  statusBadge: string,
  accentHex: string,
  badgeHex: string
): THREE.CanvasTexture {
  const cacheKey = `SIGN|${symbol}|${title}|${subtitle}|${statusBadge}|${accentHex}|${badgeHex}`;
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
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  // Dark basalt & forged gunmetal Sci-Fi/Gothic display backing
  const bgGrad = ctx.createLinearGradient(0, 0, 0, 256);
  bgGrad.addColorStop(0, '#090d18');
  bgGrad.addColorStop(0.5, '#050811');
  bgGrad.addColorStop(1, '#04060c');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, 512, 256);

  // Subtle plasma/neon backlight glow inside the display
  const topWash = ctx.createRadialGradient(256, 24, 8, 256, 48, 280);
  topWash.addColorStop(0, `${accentHex}44`);
  topWash.addColorStop(0.55, '#7b2cbf22');
  topWash.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = topWash;
  ctx.fillRect(0, 0, 512, 256);

  // Subtle horizontal scanlines for built-in portal display feel
  ctx.fillStyle = 'rgba(140, 200, 255, 0.03)';
  for (let y = 10; y < 246; y += 6) {
    ctx.fillRect(10, y, 492, 2);
  }

  // Sci-Fi / Gothic chamfered neon contour frame
  ctx.strokeStyle = accentHex;
  ctx.lineWidth = 3.5;
  ctx.strokeRect(6, 6, 500, 244);
  ctx.strokeStyle = 'rgba(180, 140, 255, 0.35)';
  ctx.lineWidth = 1.2;
  ctx.strokeRect(13, 13, 486, 230);

  // Gothic-tech corner brackets
  ctx.fillStyle = accentHex;
  [
    [6, 6],
    [492, 6],
    [6, 236],
    [492, 236],
  ].forEach(([cx, cy]) => {
    ctx.fillRect(cx, cy, 14, 14);
  });

  // Left symbol glyph core display
  ctx.fillStyle = 'rgba(123, 44, 191, 0.14)';
  ctx.fillRect(24, 26, 114, 204);
  ctx.strokeStyle = accentHex;
  ctx.lineWidth = 2;
  ctx.strokeRect(24, 26, 114, 204);

  // Pointed gothic inner arch motif inside glyph box
  ctx.strokeStyle = `${accentHex}77`;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(32, 220);
  ctx.lineTo(32, 86);
  ctx.quadraticCurveTo(32, 42, 81, 34);
  ctx.quadraticCurveTo(130, 42, 130, 86);
  ctx.lineTo(130, 220);
  ctx.stroke();

  ctx.fillStyle = accentHex;
  ctx.font = '700 32px "Cinzel", Georgia, serif';
  ctx.textAlign = 'center';
  ctx.fillText(symbol.slice(0, 6), 81, 142);

  // Portal Title, Subtitle & Telemetry Status on right
  ctx.textAlign = 'left';
  ctx.fillStyle = '#fff8ea';
  ctx.font = '700 30px "Cinzel", Georgia, serif';
  ctx.fillText(title.slice(0, 25), 154, 94, 332);

  ctx.fillStyle = '#e0e8f2';
  ctx.font = '600 23px system-ui, sans-serif';
  ctx.fillText(subtitle.slice(0, 34), 154, 140, 332);

  // Built-in display circuit divider
  ctx.strokeStyle = `${accentHex}66`;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(154, 156);
  ctx.lineTo(486, 156);
  ctx.stroke();

  ctx.fillStyle = badgeHex;
  ctx.font = '700 19px monospace';
  ctx.fillText(`◈ ${statusBadge}`, 154, 194, 270);

  // Mini telemetry spectrum bars on bottom right
  const barCols = ['#4ea8de', '#9d4edd', '#e5c158'];
  for (let b = 0; b < 6; b++) {
    ctx.fillStyle = barCols[b % barCols.length];
    const bh = 8 + ((b * 7) % 16);
    ctx.fillRect(420 + b * 10, 196 - bh, 6, bh);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  return storeCachedSignageTexture(cacheKey, tex);
}

/**
 * Power-of-Two (1024x256) Central Portal Overhead Banner Texture:
 * Displays `ARTMAZE // NEUROMICON PROJECT` and `github.com/AlexSheff/Neuromicon`
 * with Gothic/Sci-Fi dark metal framing and neon plasma contours.
 */
export function createArtmazeHeaderSignTexture(
  accentHex = '#e5c158',
  plasmaHex = '#9d4edd',
  repoUrl = 'github.com/AlexSheff/Neuromicon'
): THREE.CanvasTexture {
  const cacheKey = `HEADER_SIGN|${accentHex}|${plasmaHex}|${repoUrl}`;
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
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  // Deep obsidian & dark gunmetal background
  const bg = ctx.createLinearGradient(0, 0, 1024, 256);
  bg.addColorStop(0, '#060913');
  bg.addColorStop(0.5, '#0b1022');
  bg.addColorStop(1, '#060913');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 1024, 256);

  // Dual plasma & gold radial glow behind text
  const glow = ctx.createRadialGradient(512, 128, 16, 512, 128, 480);
  glow.addColorStop(0, `${plasmaHex}48`);
  glow.addColorStop(0.55, `${accentHex}28`);
  glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, 1024, 256);

  // Outer neon contour frame & inner gothic filigree border
  ctx.strokeStyle = accentHex;
  ctx.lineWidth = 4;
  ctx.strokeRect(8, 8, 1008, 240);

  ctx.strokeStyle = '#4ea8de';
  ctx.lineWidth = 2;
  ctx.strokeRect(18, 18, 988, 220);

  // Circuit trace lines on left and right flanks
  ctx.strokeStyle = `${plasmaHex}aa`;
  ctx.lineWidth = 2;
  [44, 980].forEach((xSide, idx) => {
    const dir = idx === 0 ? 1 : -1;
    ctx.beginPath();
    ctx.moveTo(xSide, 48);
    ctx.lineTo(xSide + dir * 68, 48);
    ctx.lineTo(xSide + dir * 92, 76);
    ctx.moveTo(xSide, 208);
    ctx.lineTo(xSide + dir * 68, 208);
    ctx.lineTo(xSide + dir * 92, 180);
    ctx.stroke();
  });

  // Main Headline: ARTMAZE // NEUROMICON PROJECT
  ctx.textAlign = 'center';
  ctx.fillStyle = '#f8f2e4';
  ctx.font = '700 40px "Cinzel", Georgia, serif';
  ctx.fillText('ARTMAZE // NEUROMICON PROJECT', 512, 114);

  // Glowing separator line with central diamond
  ctx.strokeStyle = accentHex;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(190, 140);
  ctx.lineTo(834, 140);
  ctx.stroke();

  // GitHub Repository Link
  ctx.fillStyle = '#6ad2ff';
  ctx.font = '600 24px monospace';
  ctx.fillText(`◈ https://${repoUrl.replace(/^https?:\/\//, '')} ◈`, 512, 186);

  // Subtitle telemetry
  ctx.fillStyle = accentHex;
  ctx.font = '500 15px monospace';
  ctx.fillText(
    'GOTHIC CATHEDRAL · QUARTZ PLASMA · 1149 MULTIDIMENSIONAL ROOMS',
    512,
    222
  );

  const tex = new THREE.CanvasTexture(canvas);
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
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
 * Retained for room-builder compatibility. The gallery is intentionally open to the sky:
 * no central ring, overhead ribs, or ceiling fixtures should obstruct the nebula view.
 */
export function buildGothicRibbedVaultsAndOculus(_opts: {
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
  centerZ?: number;
}): void {
  // Deliberately empty. Architectural detailing remains at the perimeter and floor.
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
    x, z, rotY = 0, width = 2.6, height = 3.9, frameMat,
    accentHex, statusColorHex, plaqueTex,
    plaqueWidth = width * 0.82, plaqueHeight = 0.54, phaseSeed = 0,
  } = opts;

  const group = new THREE.Group();
  group.position.set(x, 0, z);
  group.rotation.y = rotY;
  group.name = 'oval_cosmic_portal';

  // A clean elliptical silhouette keeps the sky visible around every transition.
  const outerRing = new THREE.Mesh(
    new THREE.TorusGeometry(1, 0.065, 10, 72),
    frameMat
  );
  outerRing.scale.set(width * 0.5, height * 0.5, 1);
  outerRing.position.set(0, height * 0.5, 0.16);
  group.add(outerRing);

  const haloMaterial = new THREE.MeshBasicMaterial({
    color: statusColorHex ?? accentHex,
    transparent: true,
    opacity: 0.82,
    toneMapped: false,
  });
  const halo = new THREE.Mesh(
    new THREE.TorusGeometry(1, 0.022, 6, 72),
    haloMaterial
  );
  halo.scale.set(width * 0.458, height * 0.458, 1);
  halo.position.set(0, height * 0.5, 0.13);
  halo.name = 'portal_wire_pulse';
  halo.userData = { phaseSeed };
  group.add(halo);

  // Elliptical shape geometry, rather than a rectangular door leaf, lets the
  // nebula show through while a restrained shader suggests depth and motion.
  const apertureShape = new THREE.Shape();
  apertureShape.absellipse(0, 0, width * 0.43, height * 0.43, 0, Math.PI * 2, false, 0);
  const apertureMaterial = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: {
      uTime: { value: 0 },
      uBeat: { value: 0 },
      uLow: { value: 0 },
      uMid: { value: 0 },
      uHigh: { value: 0 },
      uAmplitude: { value: 0 },
      uColor: { value: new THREE.Color(accentHex) },
      uPlasma: { value: new THREE.Color(opts.plasmaHex ?? '#77c9ff') },
    },
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `uniform float uTime; uniform float uBeat; uniform float uLow; uniform float uMid; uniform float uHigh; uniform float uAmplitude; uniform vec3 uColor; uniform vec3 uPlasma; varying vec2 vUv; void main(){ vec2 p=(vUv-0.5)*2.0; float r=length(p); float swirl=0.5+0.5*sin(8.0*r-uTime*(0.22+uLow*0.18)+atan(p.y,p.x)*1.4); float rim=(1.0-smoothstep(0.72,1.0,r)); float core=1.0-smoothstep(0.0,1.0,r); vec3 color=mix(uColor,uPlasma,clamp(swirl*0.42+uHigh*0.2,0.0,1.0)); color=mix(color,vec3(1.0,0.82,0.58),uLow*0.16); color=mix(color,vec3(0.76,0.9,1.0),core*0.18+uBeat*0.06); float alpha=rim*(0.17+0.13*(1.0-r)+uBeat*0.12+uMid*0.05+uAmplitude*0.07); gl_FragColor=vec4(color,alpha); }`,
  });
  const apertureGeometry = new THREE.ShapeGeometry(apertureShape, 48);
  const aperturePositions = apertureGeometry.getAttribute('position');
  const apertureUvs = new Float32Array(aperturePositions.count * 2);
  for (let i = 0; i < aperturePositions.count; i++) {
    apertureUvs[i * 2] = aperturePositions.getX(i) / (width * 0.86) + 0.5;
    apertureUvs[i * 2 + 1] = aperturePositions.getY(i) / (height * 0.86) + 0.5;
  }
  apertureGeometry.setAttribute('uv', new THREE.BufferAttribute(apertureUvs, 2));
  const aperture = new THREE.Mesh(apertureGeometry, apertureMaterial);
  aperture.position.set(0, height * 0.5, 0.08);
  aperture.name = 'portal_vortex_aperture';
  aperture.userData = { phaseSeed };
  group.add(aperture);

  const plaque = new THREE.Mesh(
    new THREE.PlaneGeometry(plaqueWidth, plaqueHeight),
    new THREE.MeshBasicMaterial({ map: plaqueTex, transparent: true })
  );
  plaque.position.set(0, height + plaqueHeight * 0.56, 0.18);
  group.add(plaque);

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

    // The nebula is fully open above the atrium; no roof ribs or tall columns.

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
        vortexMat: spec.mat,
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
   * Animates Swirling Quartz Plasma Columns, Periodic Branching Lightning Flashes,
   * Travelling Floor Circuit Electric Sparks, and VR Explorer Scale Figures across ALL rooms and halls!
   * Strictly frozen when game clock is paused (`dt <= 0`).
   */
  public static updateDynamicAtmosphere(
    root: THREE.Object3D,
    timeSec: number,
    reducedMotion = false,
    audio: { low?: number; mid?: number; high?: number; amplitude?: number; beat?: number } = {}
  ): void {
    const beat = THREE.MathUtils.clamp(audio.beat ?? 0, 0, 1);
    const low = THREE.MathUtils.clamp(audio.low ?? 0, 0, 1);
    const mid = THREE.MathUtils.clamp(audio.mid ?? 0, 0, 1);
    const high = THREE.MathUtils.clamp(audio.high ?? 0, 0, 1);
    const amplitude = THREE.MathUtils.clamp(audio.amplitude ?? 0, 0, 1);
    root.traverse((obj) => {
      if (obj.name === 'plasma_vortex_core') {
        const mesh = obj as THREE.Mesh;
        const mat = mesh.material as THREE.MeshBasicMaterial;
        const seed = (mesh.userData?.phaseSeed as number) ?? 0;
        if (!reducedMotion) {
          mesh.rotation.y = timeSec * 0.65 + seed;
          mat.opacity = 0.72 + Math.sin(timeSec * 2.1 + seed) * 0.18;
        } else {
          mat.opacity = 0.8;
        }
      } else if (obj.name === 'plasma_vortex_helix') {
        const mesh = obj as THREE.Mesh;
        const seed = (mesh.userData?.phaseSeed as number) ?? 0;
        if (!reducedMotion) {
          mesh.rotation.y = -timeSec * 1.15 - seed;
        }
      } else if (obj.name === 'plasma_floor_pool') {
        const mesh = obj as THREE.Mesh;
        const mat = mesh.material as THREE.MeshBasicMaterial;
        const seed = (mesh.userData?.phaseSeed as number) ?? 0;
        if (!reducedMotion) {
          mat.opacity = 0.18 + Math.sin(timeSec * 2.1 + seed) * 0.08;
        }
      } else if (obj.name === 'plasma_lightning_arc') {
        const line = obj as THREE.LineSegments;
        const mat = line.material as THREE.LineBasicMaterial;
        const seed = (line.userData?.phaseSeed as number) ?? 0;
        if (reducedMotion) {
          mat.opacity = 0;
        } else {
          // Rare branching lightning discharge inside the plasma column:
          // Fires briefly when composite harmonic wave crosses threshold
          const wave =
            Math.sin(timeSec * 1.7 + seed * 3.1) *
            Math.sin(timeSec * 4.3 + seed * 1.9) *
            Math.cos(timeSec * 7.9 + seed);
          if (wave > 0.62) {
            mat.opacity = Math.min(1.0, (wave - 0.62) * 3.4);
            line.rotation.y = Math.floor(timeSec * 14 + seed) * 1.047;
          } else {
            mat.opacity = 0;
          }
        }
      } else if (obj.name === 'floor_electric_spark') {
        const spark = obj as THREE.Mesh;
        const mat = spark.material as THREE.MeshBasicMaterial;
        const {
          angle = 0,
          maxRadius = 8,
          speed = 3.0,
          phase = 0,
        } = (spark.userData as {
          angle?: number;
          maxRadius?: number;
          speed?: number;
          phase?: number;
        }) ?? {};
        if (reducedMotion) {
          mat.opacity = 0.35;
        } else {
          const dist =
            1.4 + ((timeSec * speed + phase) % Math.max(2.0, maxRadius - 1.6));
          spark.position.x = Math.sin(angle) * dist;
          spark.position.z = -Math.cos(angle) * dist;
          mat.opacity = 0.45 + Math.sin(timeSec * 8.5 + phase) * 0.45;
        }
      } else if (obj.name === 'vr_explorer_visor') {
        if (!reducedMotion) {
          obj.rotation.y = Math.sin(timeSec * 0.55) * 0.14;
        }
      } else if (obj.name === 'portal_wire_pulse') {
        const mesh = obj as THREE.Mesh;
        const mat = mesh.material as THREE.MeshBasicMaterial;
        const seed = (mesh.userData?.phaseSeed as number) ?? 0;
        if (reducedMotion) {
          mat.opacity = 0.78;
        } else {
          mat.opacity = 0.62 + Math.sin(timeSec * 1.5 + seed) * 0.1 + beat * 0.12 + amplitude * 0.08;
        }
      } else if (obj.name === 'portal_vortex_aperture') {
        const mesh = obj as THREE.Mesh;
        const mat = mesh.material as THREE.ShaderMaterial;
        if (mat?.uniforms?.uTime) {
          mat.uniforms.uTime.value = timeSec;
          mat.uniforms.uBeat.value = reducedMotion ? 0 : beat;
          mat.uniforms.uLow.value = low;
          mat.uniforms.uMid.value = mid;
          mat.uniforms.uHigh.value = high;
          mat.uniforms.uAmplitude.value = amplitude;
        }
      }
    });
  }

  /** Animates onboarding beacons only when the game clock is running. */
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
      new THREE.CircleGeometry(Math.max(halfW, halfD), 96),
      floorMat
    );
    floor.rotation.x = -Math.PI * 0.5;
    root.add(floor);
    walkableMeshes.push(floor);


    // Open sky above the sector platform; no ceiling ribs.

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

    // Portals are free-standing in the nebula; no enclosing walls or columns.

    // 7. Futuristic Sci-Fi/Gothic Portals to every Artwork & Audio Room in this Sector
    const segmentNodes = getWorldNodes().filter((n) => n.segment === segment);
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
        vortexMat: heroTrimMat,
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
        vortexMat: heroTrimMat,
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
      vortexMat: heroTrimMat,
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
