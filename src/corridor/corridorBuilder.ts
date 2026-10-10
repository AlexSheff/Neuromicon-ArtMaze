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

/**
 * Power-of-Two (512x256) Mipmapped Plaque Texture (EXPERIENCE_PROTOCOL.md §3.4 & TZ.md §4.4).
 * Door plaques pick up the active room/nebula palette for emissive symbol and border trim.
 */
export function createSignageTexture(
  symbol: string,
  title: string,
  subtitle: string,
  statusBadge: string,
  accentHex: string,
  badgeHex: string
): THREE.CanvasTexture {
  if (typeof document === 'undefined') {
    const tex = new THREE.DataTexture(new Uint8Array(8 * 8 * 4), 8, 8);
    tex.needsUpdate = true;
    return tex as unknown as THREE.CanvasTexture;
  }
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  // Warm honed stone & obsidian museum plaque backing
  const bgGrad = ctx.createLinearGradient(0, 0, 0, 256);
  bgGrad.addColorStop(0, '#141824');
  bgGrad.addColorStop(0.5, '#0c101b');
  bgGrad.addColorStop(1, '#090c14');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, 512, 256);

  // Top downward warm sconce illumination wash across plaque
  const topWash = ctx.createRadialGradient(256, 0, 10, 256, 20, 280);
  topWash.addColorStop(0, `${accentHex}38`);
  topWash.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = topWash;
  ctx.fillRect(0, 0, 512, 256);

  // Double bronze architectural frame
  ctx.strokeStyle = accentHex;
  ctx.lineWidth = 3.5;
  ctx.strokeRect(6, 6, 500, 244);
  ctx.strokeStyle = 'rgba(243, 237, 226, 0.22)';
  ctx.lineWidth = 1;
  ctx.strokeRect(12, 12, 488, 232);

  // Symbol medallion box on left
  ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
  ctx.fillRect(22, 26, 114, 204);
  ctx.strokeStyle = accentHex;
  ctx.lineWidth = 2;
  ctx.strokeRect(22, 26, 114, 204);

  ctx.fillStyle = accentHex;
  ctx.font = '700 32px "Cinzel", Georgia, serif';
  ctx.textAlign = 'center';
  ctx.fillText(symbol.slice(0, 6), 79, 140);

  // Short Name & Dimension on right
  ctx.textAlign = 'left';
  ctx.fillStyle = '#f5efe4';
  ctx.font = '600 22px "Cinzel", Georgia, serif';
  ctx.fillText(title.slice(0, 25), 154, 92);

  ctx.fillStyle = '#c4baa8';
  ctx.font = '400 17px system-ui, sans-serif';
  ctx.fillText(subtitle.slice(0, 34), 154, 138);

  ctx.fillStyle = badgeHex;
  ctx.font = '600 15px monospace';
  ctx.fillText(`◆ ${statusBadge}`, 154, 190);

  const tex = new THREE.CanvasTexture(canvas);
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Power-of-Two (512x512) Honed Travertine/Basalt Sanctuary Stone & Bronze Filigree Floor Texture.
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

  // Honed dark architectural stone base
  ctx.fillStyle = '#111623';
  ctx.fillRect(0, 0, 512, 512);

  // 4x4 architectural stone tiles with subtle tonal variation
  const tileSize = 128;
  for (let ty = 0; ty < 4; ty++) {
    for (let tx = 0; tx < 4; tx++) {
      const shade = ((tx * 3 + ty * 5) % 4) * 3;
      ctx.fillStyle = `rgb(${16 + shade}, ${21 + shade}, ${33 + shade})`;
      ctx.fillRect(
        tx * tileSize + 2,
        ty * tileSize + 2,
        tileSize - 4,
        tileSize - 4
      );
      // Inner bevel highlight on each stone slab
      ctx.strokeStyle = 'rgba(255, 248, 232, 0.05)';
      ctx.lineWidth = 1;
      ctx.strokeRect(
        tx * tileSize + 4,
        ty * tileSize + 4,
        tileSize - 8,
        tileSize - 8
      );
    }
  }

  // Subtle mineral stone grain for pleasant light diffusion
  for (let i = 0; i < 420; i++) {
    const gx = (i * 173) % 512;
    const gy = (i * 311) % 512;
    ctx.fillStyle =
      i % 2 === 0 ? 'rgba(255, 245, 225, 0.035)' : 'rgba(6, 9, 16, 0.06)';
    ctx.fillRect(gx, gy, 3, 3);
  }

  // Warm ambient light pool gradient across the stone
  const grad = ctx.createRadialGradient(256, 256, 20, 256, 256, 360);
  grad.addColorStop(0, accentRgba);
  grad.addColorStop(1, 'rgba(10, 14, 24, 0.18)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 512);

  // Inlaid bronze mortar & geometric sanctuary lines
  ctx.strokeStyle = 'rgba(212, 175, 106, 0.28)';
  ctx.lineWidth = 2;
  for (let i = 0; i <= 512; i += 128) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 512);
    ctx.moveTo(0, i);
    ctx.lineTo(512, i);
    ctx.stroke();
  }

  // Sacred geometry concentric bronze inlay ring
  ctx.strokeStyle = 'rgba(229, 193, 88, 0.24)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(256, 256, 184, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(140, 205, 245, 0.16)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(256, 256, 92, 0, Math.PI * 2);
  ctx.stroke();

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
 * Power-of-Two (512x512) Coffered & Fluted Sanctuary Stone Wall Texture with Warm Indirect Sconce Wash.
 */
export function createArchitecturalWallTexture(
  baseHex: string,
  accentHex: string,
  sconceGlowHex = '#f5deb3',
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

  // Base architectural stone tone
  ctx.fillStyle = baseHex;
  ctx.fillRect(0, 0, 512, 512);

  // Warm vertical grazing light wash (cornice cove glow at top + warm sconce glow in mid-upper band + floor bounce)
  const vGrad = ctx.createLinearGradient(0, 0, 0, 512);
  vGrad.addColorStop(0, `${accentHex}33`);
  vGrad.addColorStop(0.28, `${sconceGlowHex}22`);
  vGrad.addColorStop(0.65, 'rgba(16, 20, 32, 0.12)');
  vGrad.addColorStop(1, `${accentHex}24`);
  ctx.fillStyle = vGrad;
  ctx.fillRect(0, 0, 512, 512);

  // Coffered architectural wall bays (2 bays per 512px repeat)
  for (let bx = 0; bx < 2; bx++) {
    const x0 = bx * 256;
    // Recessed stone panel in upper & lower register
    ctx.fillStyle = 'rgba(8, 11, 20, 0.28)';
    ctx.fillRect(x0 + 22, 48, 212, 276);
    ctx.fillRect(x0 + 22, 356, 212, 118);

    // Bronze inner molding around recessed panels
    ctx.strokeStyle = `${accentHex}55`;
    ctx.lineWidth = 2;
    ctx.strokeRect(x0 + 22, 48, 212, 276);
    ctx.strokeRect(x0 + 22, 356, 212, 118);

    // Subtle fluted vertical stone grooves inside panel
    ctx.strokeStyle = 'rgba(255, 248, 235, 0.045)';
    ctx.lineWidth = 1.5;
    for (let gx = x0 + 42; gx <= x0 + 214; gx += 24) {
      ctx.beginPath();
      ctx.moveTo(gx, 56);
      ctx.lineTo(gx, 316);
      ctx.stroke();
    }

    // Soft warm sconce light halo centered in each architectural bay
    const halo = ctx.createRadialGradient(
      x0 + 128,
      168,
      8,
      x0 + 128,
      168,
      118
    );
    halo.addColorStop(0, `${sconceGlowHex}38`);
    halo.addColorStop(0.55, `${accentHex}18`);
    halo.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = halo;
    ctx.fillRect(x0, 36, 256, 290);
  }

  // Horizontal bronze cornice frieze & dado rail moldings
  ctx.fillStyle = `${accentHex}66`;
  ctx.fillRect(0, 26, 512, 5);
  ctx.fillRect(0, 336, 512, 6);
  ctx.fillRect(0, 488, 512, 6);

  // Tactile stone grain
  for (let i = 0; i < 360; i++) {
    const sx = (i * 197) % 512;
    const sy = (i * 263) % 512;
    ctx.fillStyle =
      i % 2 === 0 ? 'rgba(255, 248, 232, 0.03)' : 'rgba(0, 0, 0, 0.05)';
    ctx.fillRect(sx, sy, 2, 2);
  }

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
 * Power-of-Two (256x512) Coffered Bronze & Stone Sanctuary Door Leaf Texture.
 */
export function createDoorLeafTexture(
  baseHex: string,
  accentHex: string
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

  ctx.fillStyle = baseHex;
  ctx.fillRect(0, 0, 256, 512);

  // Warm overhead archway lamp wash down the door face
  const wash = ctx.createLinearGradient(0, 0, 0, 512);
  wash.addColorStop(0, `${accentHex}44`);
  wash.addColorStop(0.45, `${accentHex}16`);
  wash.addColorStop(1, 'rgba(6, 9, 16, 0.35)');
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, 256, 512);

  // Outer & inner bronze door stiles
  ctx.strokeStyle = `${accentHex}aa`;
  ctx.lineWidth = 4;
  ctx.strokeRect(8, 8, 240, 496);

  ctx.strokeStyle = `${accentHex}66`;
  ctx.lineWidth = 2;
  ctx.strokeRect(24, 28, 208, 212);
  ctx.strokeRect(24, 264, 208, 216);

  // Central geometric sanctuary rosette on upper door panel
  ctx.strokeStyle = `${accentHex}99`;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(128, 134, 48, 0, Math.PI * 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(128, 134, 22, 0, Math.PI * 2);
  ctx.stroke();

  // Center seam & twin bronze door handles
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.55)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(128, 8);
  ctx.lineTo(128, 504);
  ctx.stroke();

  ctx.fillStyle = accentHex;
  ctx.fillRect(110, 236, 8, 34);
  ctx.fillRect(138, 236, 8, 34);

  const tex = new THREE.CanvasTexture(canvas);
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Soft 2D Radial + Vertical Falloff Alpha Texture for Oculus & Sconce Light Veils (§3.3 & TZ.md §4.4).
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
  grad.addColorStop(0, `${accentHex}52`);
  grad.addColorStop(0.38, `${accentHex}24`);
  grad.addColorStop(0.78, `${accentHex}0c`);
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 256);
  const tex = new THREE.CanvasTexture(canvas);
  tex.generateMipmaps = true;
  return tex;
}

const SECTOR_HALL_META: Record<
  1 | 2 | 3,
  {
    title: string;
    subtitle: string;
    symbol: string;
    range: string;
    accentHex: string;
    bgHex: string;
    branch: CorridorBranch;
    sceneSkyKey: string;
  }
> = {
  1: {
    title: 'ROOM I · THE SOURCE CODE',
    subtitle: 'Sector A · Rooms 01–11 (Purpose to Action)',
    symbol: 'I·☉',
    range: '11 ROOMS (01–11)',
    accentHex: '#e5c158',
    bgHex: '#070a14',
    branch: 'ascend',
    sceneSkyKey: 'SECTOR_ROOM_1',
  },
  2: {
    title: 'ROOM II · OPERATING SYSTEM',
    subtitle: 'Sector B · Rooms 12–19 (Solitude to Algorithm)',
    symbol: 'II·◯',
    range: '8 ROOMS (12–19)',
    accentHex: '#4ea8de',
    bgHex: '#060c18',
    branch: 'descend',
    sceneSkyKey: 'SECTOR_ROOM_2',
  },
  3: {
    title: 'ROOM III · UPGRADE & MIRROR',
    subtitle: 'Sector C & D · Rooms 20–25 (Signal to Mirror)',
    symbol: 'III·🪞',
    range: '6 ROOMS (20–25)',
    accentHex: '#b388ff',
    bgHex: '#090718',
    branch: 'ascend',
    sceneSkyKey: 'SECTOR_ROOM_3',
  },
};

/**
 * Builds the Grand Cosmic Starting Room (Threshold) and the 3 Sector Rooms (Halls I, II, III)
 * driven by the 4-Layer Real Astronomical Nebula Sky & Palette Lighting System (TZ.md §3 & §4).
 *
 * Architectural & Lighting Principles:
 * - Zero columns or poles blocking doors or sightlines: pilasters and braziers strictly flank portals.
 * - Rich procedural stone, travertine, and bronze textures across floors, walls, balustrades, and doors.
 * - Every light or glow originates from a physical fixture (overhead Oculus Lantern, Wall Sconces, Archway Keystones, or Astral Braziers).
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
    // Mount 4-Layer Real Astronomical Nebula Sky (`NEB_0001` Carina Nebula Cosmic Cliffs) + Palette Lighting Rig (<= 2 lights)
    const skyRig = nebulaSkySystem.mountRoomSkyAndLighting(
      'THRESHOLD',
      root,
      scene,
      {
        qualityTier: state.comfort.qualityTier,
        reducedMotion: state.comfort.reducedMotion,
      }
    );

    const floorTex = createCosmicFloorTexture('rgba(218, 152, 84, 0.25)', 5, 5);
    const cosmicFloorMat = new THREE.MeshStandardMaterial({
      color: '#1b2234',
      map: floorTex,
      roughness: 0.28,
      metalness: 0.42,
    });

    const stoneWallTex = createArchitecturalWallTexture(
      '#1a2030',
      skyRig.palette[0] ?? '#c8a464',
      '#f6e3ba',
      6,
      1
    );
    const sanctuaryStoneMat = new THREE.MeshStandardMaterial({
      color: '#23293a',
      map: stoneWallTex,
      roughness: 0.46,
      metalness: 0.22,
    });

    const goldHeroMat = new THREE.MeshStandardMaterial({
      color: skyRig.palette[2] ?? '#e5c158',
      roughness: 0.22,
      metalness: 0.82,
      emissive: skyRig.palette[0] ?? '#42300e',
      emissiveIntensity: 0.32,
    });
    const cyanHeroMat = new THREE.MeshStandardMaterial({
      color: skyRig.palette[1] ?? '#4ea8de',
      roughness: 0.2,
      metalness: 0.8,
      emissive: '#123a5c',
      emissiveIntensity: 0.42,
    });
    const violetHeroMat = new THREE.MeshStandardMaterial({
      color: '#b388ff',
      roughness: 0.22,
      metalness: 0.8,
      emissive: '#2c1654',
      emissiveIntensity: 0.4,
    });
    const warmLanternMat = new THREE.MeshBasicMaterial({
      color: '#fff1d0',
    });

    const shaftTex = createLightShaftAlphaTexture(
      skyRig.palette[2] ?? '#f2d58b'
    );
    const shaftAdditiveMat = new THREE.MeshBasicMaterial({
      map: shaftTex,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    // 1. Grand Circular Cosmic Observatory Platform (y = 0, walkable, textured honed stone)
    const platformDisc = new THREE.Mesh(
      new THREE.CylinderGeometry(14.8, 15.8, 0.6, 64),
      cosmicFloorMat
    );
    platformDisc.position.set(0, -0.3, 0);
    root.add(platformDisc);
    walkableMeshes.push(platformDisc);

    // Outer Sculpted Stone Perimeter Rim & Cove Step (grounding the sanctuary perimeter)
    const outerRim = new THREE.Mesh(
      new THREE.TorusGeometry(14.65, 0.26, 12, 64),
      goldHeroMat
    );
    outerRim.rotation.x = Math.PI * 0.5;
    outerRim.position.set(0, 0.08, 0);
    root.add(outerRim);

    // Concentric glowing astral inlays on the sanctuary floor
    [4.4, 9.2, 13.8].forEach((r, idx) => {
      const floorRing = new THREE.Mesh(
        new THREE.RingGeometry(r, r + 0.1, 64),
        new THREE.MeshBasicMaterial({
          color: skyRig.palette[idx % skyRig.palette.length] ?? '#e5c158',
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.58,
        })
      );
      floorRing.rotation.x = -Math.PI * 0.5;
      floorRing.position.set(0, 0.015, 0);
      root.add(floorRing);
    });

    // 2. Physical Overhead Celestial Oculus Ring & Suspended Astrolabe Chandelier (y = 14.2m, z = 0)
    // Replaces the old pole that blocked the central door; light now visibly streams from the overhead Oculus!
    const oculusCrownGroup = new THREE.Group();
    oculusCrownGroup.position.set(0, 14.2, 0);

    const oculusOuterTorus = new THREE.Mesh(
      new THREE.TorusGeometry(13.6, 0.38, 14, 64),
      sanctuaryStoneMat
    );
    oculusOuterTorus.rotation.x = Math.PI * 0.5;
    oculusCrownGroup.add(oculusOuterTorus);

    const oculusCoveLightRing = new THREE.Mesh(
      new THREE.TorusGeometry(13.15, 0.1, 12, 64),
      warmLanternMat
    );
    oculusCoveLightRing.rotation.x = Math.PI * 0.5;
    oculusCoveLightRing.position.y = -0.12;
    oculusCrownGroup.add(oculusCoveLightRing);

    root.add(oculusCrownGroup);

    const astrolabeGroup = new THREE.Group();
    astrolabeGroup.name = 'cosmic_astrolabe_rings';
    astrolabeGroup.position.set(0, 13.4, 0);

    const ring1 = new THREE.Mesh(
      new THREE.TorusGeometry(6.8, 0.12, 16, 64),
      goldHeroMat
    );
    ring1.rotation.x = Math.PI * 0.35;
    astrolabeGroup.add(ring1);

    const ring2 = new THREE.Mesh(
      new THREE.TorusGeometry(9.2, 0.1, 16, 64),
      cyanHeroMat
    );
    ring2.rotation.y = Math.PI * 0.25;
    ring2.rotation.x = -Math.PI * 0.28;
    astrolabeGroup.add(ring2);

    const ring3 = new THREE.Mesh(
      new THREE.TorusGeometry(11.4, 0.09, 16, 64),
      violetHeroMat
    );
    ring3.rotation.z = Math.PI * 0.2;
    astrolabeGroup.add(ring3);

    // Central Celestial Lantern Core inside the overhead Oculus
    const sunCore = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.95, 2),
      warmLanternMat
    );
    astrolabeGroup.add(sunCore);

    root.add(astrolabeGroup);

    // Gentle Translucent Celestial Veil descending directly from the overhead Oculus Ring to the Central Pedestal
    const oculusVeil = new THREE.Mesh(
      new THREE.CylinderGeometry(3.2, 5.2, 13.4, 32, 1, true),
      shaftAdditiveMat
    );
    oculusVeil.position.set(0, 6.7, 0);
    root.add(oculusVeil);

    // 3. Flanking Sanctuary Pilasters with Physical Warm Alabaster Brazier Lanterns
    // Carefully placed at angles that FLANK the 3 North Doors and East/West Wings — NEVER blocking any door!
    const brazierAnglesDeg = [-68, -42, 42, 68, -118, 118, -152, 152];
    const pilasterGeo = new THREE.CylinderGeometry(0.34, 0.46, 4.4, 16);
    const lanternGlobeGeo = new THREE.SphereGeometry(0.28, 16, 12);
    const floorGlowMat = new THREE.MeshBasicMaterial({
      color: '#f5d996',
      transparent: true,
      opacity: 0.22,
      side: THREE.DoubleSide,
    });

    brazierAnglesDeg.forEach((deg) => {
      const rad = THREE.MathUtils.degToRad(deg);
      const bx = Math.sin(rad) * 13.6;
      const bz = -Math.cos(rad) * 13.6;

      const brazierGroup = new THREE.Group();
      brazierGroup.position.set(bx, 0, bz);

      const pillar = new THREE.Mesh(pilasterGeo, sanctuaryStoneMat);
      pillar.position.y = 2.2;
      brazierGroup.add(pillar);

      const capital = new THREE.Mesh(
        new THREE.CylinderGeometry(0.5, 0.36, 0.26, 16),
        goldHeroMat
      );
      capital.position.y = 4.48;
      brazierGroup.add(capital);

      // Physical Warm Alabaster Lantern Globe at top of Brazier Pillar
      const globe = new THREE.Mesh(lanternGlobeGeo, warmLanternMat);
      globe.position.y = 4.82;
      brazierGroup.add(globe);

      // Soft warm illumination pool on the stone floor beneath the brazier
      const pool = new THREE.Mesh(
        new THREE.CircleGeometry(1.65, 24),
        floorGlowMat
      );
      pool.rotation.x = -Math.PI * 0.5;
      pool.position.y = 0.018;
      brazierGroup.add(pool);

      root.add(brazierGroup);
    });

    // 4. Soft Pulsing Ring on Floor at z = 2.2m
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

    // 5. Central Awakening Monolith Pedestal at (0, 0, 1.2) with Warm Illuminated Base
    const pedestalGroup = new THREE.Group();
    pedestalGroup.name = 'onboarding_pedestal';
    pedestalGroup.position.set(0, 0, 1.2);

    const pedBase = new THREE.Mesh(
      new THREE.CylinderGeometry(0.52, 0.68, 1.05, 16),
      sanctuaryStoneMat
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
      subtitle: `${skyRig.nebulaName} · 3 Sector Rooms (25 Rooms)`,
      subtitleRu: `${skyRig.nebulaName} · 3 Sector Rooms (25 Rooms)`,
    });

    // 6. Comfort Calibration Ritual Marks (Seated vs Standing) on a Sculpted Side Console
    const postureGroup = new THREE.Group();
    postureGroup.name = 'onboarding_posture_marks';
    postureGroup.position.set(-3.2, 0, 3.4);

    const consoleStand = new THREE.Mesh(
      new THREE.CylinderGeometry(0.26, 0.36, 0.88, 12),
      sanctuaryStoneMat
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

    // 7. Physical Smooth-Movement Switch in World (Unlocked after 5 teleports)
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

    // 8. THE 3 GRAND COSMIC DOORS INTO THE 3 ROOMS (Halls I, II, III housing all 25 Artwork & Audio Rooms!)
    // Unobstructed sightlines, textured coffered door leaves, and physical Keystone Archway Luminaires!
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
        x: -6.2,
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
        x: 6.2,
        z: -6.4,
        rotY: -Math.PI * 0.17,
        mat: violetHeroMat,
      },
    ];

    cosmicDoorsSpec.forEach((spec) => {
      const meta = SECTOR_HALL_META[spec.segment];
      const doorGroup = new THREE.Group();
      doorGroup.position.set(spec.x, 0, spec.z);
      doorGroup.rotation.y = spec.rotY;

      // Grounded stone & bronze threshold plinth
      const plinth = new THREE.Mesh(
        new THREE.BoxGeometry(3.8, 0.24, 0.96),
        sanctuaryStoneMat
      );
      plinth.position.set(0, 0.12, 0.22);
      doorGroup.add(plinth);

      // Sculpted stone backing surround
      const surround = new THREE.Mesh(
        new THREE.BoxGeometry(3.55, 4.85, 0.34),
        sanctuaryStoneMat
      );
      surround.position.set(0, 2.52, 0.04);
      doorGroup.add(surround);

      [-1.48, 1.48].forEach((jx) => {
        const pillar = new THREE.Mesh(
          new THREE.BoxGeometry(0.36, 4.65, 0.5),
          spec.mat
        );
        pillar.position.set(jx, 2.42, 0.2);
        doorGroup.add(pillar);
      });

      const lintel = new THREE.Mesh(
        new THREE.BoxGeometry(3.8, 0.52, 0.6),
        spec.mat
      );
      lintel.position.set(0, 4.82, 0.24);
      doorGroup.add(lintel);

      // Physical Keystone Archway Luminaire Bar casting warm light onto plaque & door leaf
      const archwayLamp = new THREE.Mesh(
        new THREE.BoxGeometry(2.4, 0.1, 0.18),
        warmLanternMat
      );
      archwayLamp.position.set(0, 4.54, 0.46);
      doorGroup.add(archwayLamp);

      const leafTex = createDoorLeafTexture('#121828', meta.accentHex);
      const leaf = new THREE.Mesh(
        new THREE.BoxGeometry(2.56, 4.32, 0.18),
        new THREE.MeshStandardMaterial({
          map: leafTex,
          roughness: 0.28,
          metalness: 0.62,
        })
      );
      leaf.position.set(0, 0.24 + 2.16, 0.16);
      doorGroup.add(leaf);

      const plaqueTex = createSignageTexture(
        meta.symbol,
        meta.title,
        meta.subtitle,
        meta.range,
        meta.accentHex,
        '#f3ede2'
      );
      const plaque = new THREE.Mesh(
        new THREE.PlaneGeometry(3.2, 1.35),
        new THREE.MeshBasicMaterial({ map: plaqueTex })
      );
      plaque.position.set(0, 5.82, 0.3);
      doorGroup.add(plaque);

      atriumGroup.add(doorGroup);
      registerTarget(doorGroup, {
        id: `COSMIC_HALL_DOOR_${spec.segment}`,
        kind: 'segment-portal',
        branch: meta.branch,
        segment: spec.segment,
        title: meta.title,
        titleRu: meta.title,
        subtitle: `${meta.subtitle} · Click to Enter`,
        subtitleRu: `${meta.subtitle} · Click to Enter`,
      });
    });

    // 9. Ascent & Descent Cosmic Dais Lifts on West and East Wings with Dedicated Brazier Beacons
    const ascentGroup = new THREE.Group();
    ascentGroup.position.set(-8.8, 0, -0.6);
    ascentGroup.rotation.y = Math.PI * 0.35;

    const ascentDais = new THREE.Mesh(
      new THREE.CylinderGeometry(2.1, 2.35, 0.32, 32),
      sanctuaryStoneMat
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
      'ASCENT · ROOM I',
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
      title: '▲ ASCENT · ROOM I',
      titleRu: '▲ ASCENT · ROOM I',
      subtitle: 'Enter Room I · Sector A (Rooms 01–11)',
      subtitleRu: 'Enter Room I · Sector A (Rooms 01–11)',
    });

    const descentGroup = new THREE.Group();
    descentGroup.position.set(8.8, 0, -0.6);
    descentGroup.rotation.y = -Math.PI * 0.35;

    const descentDais = new THREE.Mesh(
      new THREE.CylinderGeometry(2.1, 2.35, 0.32, 32),
      sanctuaryStoneMat
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
      'DESCENT · ROOM II',
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
      title: '▼ DESCENT · ROOM II',
      titleRu: '▼ DESCENT · ROOM II',
      subtitle: 'Enter Room II · Sector B (Rooms 12–19)',
      subtitleRu: 'Enter Room II · Sector B (Rooms 01–19)',
    });

    // Rung 3 Hint Engraved Plaque in World Space (Visible only if player is stuck >= 45s)
    const hintPlaqueTex = createSignageTexture(
      '◈',
      t('onboarding.hint.engraving', 'en'),
      'COSMIC NEXUS',
      '3 ROOMS',
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
   * Builds one of the 3 Grand Sector Rooms (`segment = 1 | 2 | 3`) with its dedicated astronomical nebula sky:
   * - Room I (Sector A — Warm Ascent set `NEB_0002` Pillars of Creation): 11 Doors to Rooms 01–11
   * - Room II (Sector B — Cool Descent set `NEB_0012` Veil Nebula): 8 Doors to Rooms 12–19
   * - Room III (Sector C & D — Deep Field set `NEB_0024` SMACS 0723): 6 Doors to Rooms 20–25
   *
   * Key Architectural Improvements:
   * - Zero columns standing in front of doors: fluted stone pilasters with physical warm Alabaster Sconces
   *   sit flush against the walls strictly BETWEEN the door bays (`z = -15, -10, -5, 0, +5, +10, +15`).
   * - Textured stone & bronze coffered walls, honed stone floor, and sculpted overhead Skylight Cornice.
   * - Overhead light veil descends directly from a physical Celestial Oculus Lantern Ring at `y = height`.
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
        ? 'rgba(218, 158, 82, 0.25)'
        : segment === 2
        ? 'rgba(64, 150, 218, 0.25)'
        : 'rgba(179, 136, 255, 0.25)',
      4,
      7
    );
    const sideWallTex = createArchitecturalWallTexture(
      segment === 1 ? '#221d26' : segment === 2 ? '#162132' : '#1f1932',
      accentHex,
      '#fae6be',
      6,
      1
    );
    const endWallTex = createArchitecturalWallTexture(
      segment === 1 ? '#221d26' : segment === 2 ? '#162132' : '#1f1932',
      accentHex,
      '#fae6be',
      3,
      1
    );

    const sideWallMat = new THREE.MeshStandardMaterial({
      map: sideWallTex,
      roughness: 0.44,
      metalness: 0.2,
    });
    const endWallMat = new THREE.MeshStandardMaterial({
      map: endWallTex,
      roughness: 0.44,
      metalness: 0.2,
    });
    const pilasterStoneMat = new THREE.MeshStandardMaterial({
      color: segment === 1 ? '#2a2430' : segment === 2 ? '#1c283c' : '#261f3d',
      roughness: 0.38,
      metalness: 0.28,
    });
    const floorMat = new THREE.MeshStandardMaterial({
      map: floorTex,
      roughness: segment === 2 ? 0.2 : 0.26,
      metalness: 0.45,
    });
    const heroTrimMat = new THREE.MeshStandardMaterial({
      color: accentHex,
      roughness: 0.24,
      metalness: 0.82,
      emissive: rimHex,
      emissiveIntensity: 0.22,
    });
    const warmSconceMat = new THREE.MeshBasicMaterial({
      color: '#fff1d0',
    });

    // 1. Walkable Sector Room Floor (y = 0, honed stone & bronze inlay)
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(width, depth),
      floorMat
    );
    floor.rotation.x = -Math.PI * 0.5;
    root.add(floor);
    walkableMeshes.push(floor);

    // Central Sanctuary Medallion & Overhead Skylight Oculus Lantern at (0, height, -2.0)
    // Every beam of light originates from the physical Skylight Oculus Lantern overhead!
    const oculusLanternRing = new THREE.Mesh(
      new THREE.TorusGeometry(3.4, 0.22, 12, 48),
      heroTrimMat
    );
    oculusLanternRing.rotation.x = Math.PI * 0.5;
    oculusLanternRing.position.set(0, height - 0.1, -2.0);
    root.add(oculusLanternRing);

    const oculusInnerGlow = new THREE.Mesh(
      new THREE.TorusGeometry(3.15, 0.08, 10, 48),
      warmSconceMat
    );
    oculusInnerGlow.rotation.x = Math.PI * 0.5;
    oculusInnerGlow.position.set(0, height - 0.18, -2.0);
    root.add(oculusInnerGlow);

    const shaftTex = createLightShaftAlphaTexture(rimHex);
    const oculusVeil = new THREE.Mesh(
      new THREE.CylinderGeometry(2.9, 4.2, height, 32, 1, true),
      new THREE.MeshBasicMaterial({
        map: shaftTex,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      })
    );
    oculusVeil.position.set(0, height * 0.5, -2.0);
    root.add(oculusVeil);

    // Central Meditative Floor Basin / Inlay directly beneath the Skylight Oculus
    const centerBasinRim = new THREE.Mesh(
      new THREE.RingGeometry(1.6, 3.3, 48),
      new THREE.MeshStandardMaterial({
        color: skyRig.palette[1] ?? accentHex,
        roughness: 0.14,
        metalness: 0.85,
        emissive: skyRig.palette[0] ?? '#143852',
        emissiveIntensity: 0.28,
        side: THREE.DoubleSide,
      })
    );
    centerBasinRim.rotation.x = -Math.PI * 0.5;
    centerBasinRim.position.set(0, 0.016, -2.0);
    root.add(centerBasinRim);

    // 2. Textured Side & End Walls + Sculpted Skylight Cornice along Top Perimeter (y = height)
    [-halfW, halfW].forEach((wx) => {
      const sideWall = new THREE.Mesh(
        new THREE.PlaneGeometry(depth, height),
        sideWallMat
      );
      sideWall.rotation.y = wx < 0 ? Math.PI * 0.5 : -Math.PI * 0.5;
      sideWall.position.set(wx, height * 0.5, 0);
      root.add(sideWall);

      // Top Cornice Beam & Warm Cove Light Strip along the wall top
      const cornice = new THREE.Mesh(
        new THREE.BoxGeometry(0.65, 0.45, depth),
        pilasterStoneMat
      );
      cornice.position.set(
        wx < 0 ? wx + 0.32 : wx - 0.32,
        height - 0.22,
        0
      );
      root.add(cornice);

      const coveLight = new THREE.Mesh(
        new THREE.BoxGeometry(0.08, 0.08, depth - 1.2),
        warmSconceMat
      );
      coveLight.position.set(
        wx < 0 ? wx + 0.62 : wx - 0.62,
        height - 0.42,
        0
      );
      root.add(coveLight);
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
        pilasterStoneMat
      );
      endCornice.position.set(
        0,
        height - 0.22,
        wz < 0 ? wz + 0.32 : wz - 0.32
      );
      root.add(endCornice);
    });

    // 3. Flush Wall Pilasters with Physical Warm Alabaster Wall Sconces BETWEEN the Doors!
    // Doors are at z = -12.5, -7.5, -2.5, +2.5, +7.5, +12.5.
    // Pilasters + Sconces are placed at z = -15.0, -10.0, -5.0, 0.0, +5.0, +10.0, +15.0 flush against the walls!
    const pilasterZPositions = [-15.0, -10.0, -5.0, 0.0, 5.0, 10.0, 15.0];
    const pilasterBoxGeo = new THREE.BoxGeometry(0.42, height - 0.4, 0.58);
    const sconceFixtureGeo = new THREE.CylinderGeometry(0.09, 0.07, 0.46, 12);
    const sconceBracketGeo = new THREE.BoxGeometry(0.22, 0.12, 0.16);

    const pilasterInst = new THREE.InstancedMesh(
      pilasterBoxGeo,
      pilasterStoneMat,
      pilasterZPositions.length * 2
    );
    const sconceInst = new THREE.InstancedMesh(
      sconceFixtureGeo,
      warmSconceMat,
      pilasterZPositions.length * 2
    );
    const bracketInst = new THREE.InstancedMesh(
      sconceBracketGeo,
      heroTrimMat,
      pilasterZPositions.length * 2
    );

    const dummy = new THREE.Object3D();
    let pIdx = 0;
    for (const side of [-1, 1]) {
      for (const pz of pilasterZPositions) {
        // Wall Pilaster flush against side wall
        dummy.position.set(
          side * (halfW - 0.21),
          (height - 0.4) * 0.5,
          pz
        );
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        pilasterInst.setMatrixAt(pIdx, dummy.matrix);

        // Bronze Sconce Bracket on the inner face of the Pilaster
        dummy.position.set(side * (halfW - 0.46), 3.15, pz);
        dummy.updateMatrix();
        bracketInst.setMatrixAt(pIdx, dummy.matrix);

        // Warm Glowing Alabaster Sconce Cylinder above the Bracket
        dummy.position.set(side * (halfW - 0.52), 3.42, pz);
        dummy.updateMatrix();
        sconceInst.setMatrixAt(pIdx, dummy.matrix);

        pIdx++;
      }
    }
    pilasterInst.instanceMatrix.needsUpdate = true;
    bracketInst.instanceMatrix.needsUpdate = true;
    sconceInst.instanceMatrix.needsUpdate = true;
    root.add(pilasterInst);
    root.add(bracketInst);
    root.add(sconceInst);

    // 4. Doors to every Artwork & Audio Room in this Sector (Framed cleanly between the Pilaster Bays!)
    const segmentNodes = getWorldNodes().filter((n) => n.segment === segment);
    const doorLeafTex = createDoorLeafTexture('#121828', accentHex);
    const doorLeafMat = new THREE.MeshStandardMaterial({
      map: doorLeafTex,
      roughness: 0.28,
      metalness: 0.62,
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
        : 'ART & AUDIO';

      const statusColor = isPlanned
        ? '#777777'
        : isCompleted
        ? '#66cc99'
        : isVisited
        ? '#6fa8dc'
        : rimHex;

      const dGroup = new THREE.Group();
      dGroup.position.set(slot.x, 0, slot.z);
      dGroup.rotation.y = slot.rotY;

      const step = new THREE.Mesh(
        new THREE.BoxGeometry(2.65, 0.16, 0.58),
        pilasterStoneMat
      );
      step.position.set(0, 0.08, 0.22);
      dGroup.add(step);

      [-1.1, 1.1].forEach((jx) => {
        const jamb = new THREE.Mesh(
          new THREE.BoxGeometry(0.24, 3.65, 0.38),
          heroTrimMat
        );
        jamb.position.set(jx, 1.82, 0.18);
        dGroup.add(jamb);
      });

      const lintel = new THREE.Mesh(
        new THREE.BoxGeometry(2.68, 0.42, 0.48),
        heroTrimMat
      );
      lintel.position.set(0, 3.78, 0.22);
      dGroup.add(lintel);

      // Physical Lintel Picture-Light Bar illuminating the doorway and plaque
      const lintelLamp = new THREE.Mesh(
        new THREE.BoxGeometry(1.75, 0.07, 0.14),
        warmSconceMat
      );
      lintelLamp.position.set(0, 3.55, 0.4);
      dGroup.add(lintelLamp);

      const stateBeaconMat = new THREE.MeshBasicMaterial({
        color: statusColor,
      });
      const beaconGem = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.15, 0),
        stateBeaconMat
      );
      beaconGem.position.set(0, 3.78, 0.5);
      dGroup.add(beaconGem);

      const leaf = new THREE.Mesh(
        new THREE.BoxGeometry(1.96, 3.46, 0.16),
        doorLeafMat
      );
      leaf.position.set(0, 0.16 + 1.73, 0.12);
      dGroup.add(leaf);

      const plaqueTex = createSignageTexture(
        node.symbol,
        node.title,
        node.dimension,
        statusLabel,
        accentHex,
        statusColor
      );
      const plaque = new THREE.Mesh(
        new THREE.PlaneGeometry(2.25, 1.1),
        new THREE.MeshBasicMaterial({ map: plaqueTex })
      );
      plaque.position.set(0, 4.58, 0.26);
      dGroup.add(plaque);

      root.add(dGroup);
      registerTarget(dGroup, {
        id: `CORRIDOR_DOOR_${node.id}`,
        kind: 'corridor-door',
        roomId: node.id,
        status: node.status,
        title: `${node.symbol} · ${node.title}`,
        titleRu: `${node.symbol} · ${node.title}`,
        subtitle: `${node.dimension} · Enter Room with Nebula, Painting & MP3`,
        subtitleRu: `${node.dimension} · Enter Room with Nebula, Painting & MP3`,
      });
    });

    // 5. North Wall: Portals to the other 2 Sector Rooms (With Textured Door Leaves & Archway Lamps)
    const otherSegments = ([1, 2, 3] as const).filter((s) => s !== segment);
    otherSegments.forEach((targetSeg, idx) => {
      const targetMeta = SECTOR_HALL_META[targetSeg];
      const px = idx === 0 ? -3.8 : 3.8;

      const northPortal = new THREE.Group();
      northPortal.position.set(px, 0, -halfD + 0.28);

      const nSurround = new THREE.Mesh(
        new THREE.BoxGeometry(3.2, 4.2, 0.32),
        heroTrimMat
      );
      nSurround.position.y = 2.1;
      northPortal.add(nSurround);

      const nLeaf = new THREE.Mesh(
        new THREE.BoxGeometry(2.5, 3.8, 0.18),
        doorLeafMat
      );
      nLeaf.position.set(0, 1.95, 0.12);
      northPortal.add(nLeaf);

      const nLamp = new THREE.Mesh(
        new THREE.BoxGeometry(2.0, 0.08, 0.16),
        warmSconceMat
      );
      nLamp.position.set(0, 4.02, 0.28);
      northPortal.add(nLamp);

      const nPlaqueTex = createSignageTexture(
        targetMeta.symbol,
        targetMeta.title,
        targetMeta.range,
        'SECTOR ROOM',
        targetMeta.accentHex,
        '#f3ede2'
      );
      const nPlaque = new THREE.Mesh(
        new THREE.PlaneGeometry(2.5, 1.15),
        new THREE.MeshBasicMaterial({ map: nPlaqueTex })
      );
      nPlaque.position.set(0, 4.82, 0.25);
      northPortal.add(nPlaque);

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

    // 6. South Portal: Return to Grand Cosmic Starting Room
    const southPortal = new THREE.Group();
    southPortal.position.set(0, 0, halfD - 0.28);
    southPortal.rotation.y = Math.PI;

    const sArch = new THREE.Mesh(
      new THREE.BoxGeometry(3.4, 4.2, 0.34),
      heroTrimMat
    );
    sArch.position.y = 2.1;
    southPortal.add(sArch);

    const sLeaf = new THREE.Mesh(
      new THREE.BoxGeometry(2.65, 3.85, 0.18),
      doorLeafMat
    );
    sLeaf.position.set(0, 1.98, 0.12);
    southPortal.add(sLeaf);

    const sLamp = new THREE.Mesh(
      new THREE.BoxGeometry(2.1, 0.08, 0.16),
      warmSconceMat
    );
    sLamp.position.set(0, 4.05, 0.28);
    southPortal.add(sLamp);

    const sPlaqueTex = createSignageTexture(
      '↺',
      'COSMIC NEXUS',
      'STARTING COSMIC ROOM',
      '3 ROOMS HUB',
      accentHex,
      '#d8cfc0'
    );
    const sPlaque = new THREE.Mesh(
      new THREE.PlaneGeometry(2.5, 1.15),
      new THREE.MeshBasicMaterial({ map: sPlaqueTex })
    );
    sPlaque.position.set(0, 4.85, 0.25);
    southPortal.add(sPlaque);

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
