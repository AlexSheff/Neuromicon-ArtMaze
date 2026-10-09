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
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#090b12';
  ctx.fillRect(0, 0, 512, 256);

  ctx.strokeStyle = accentHex;
  ctx.lineWidth = 4;
  ctx.strokeRect(6, 6, 500, 244);

  // Symbol medallion box on left
  ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
  ctx.fillRect(20, 24, 116, 208);
  ctx.strokeStyle = accentHex;
  ctx.lineWidth = 2;
  ctx.strokeRect(20, 24, 116, 208);

  ctx.fillStyle = accentHex;
  ctx.font = '700 32px "Cinzel", Georgia, serif';
  ctx.textAlign = 'center';
  ctx.fillText(symbol.slice(0, 6), 78, 140);

  // Short Name & Dimension on right
  ctx.textAlign = 'left';
  ctx.fillStyle = '#f3ede2';
  ctx.font = '600 22px "Cinzel", Georgia, serif';
  ctx.fillText(title.slice(0, 25), 154, 92);

  ctx.fillStyle = '#b5ab99';
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
 * Power-of-Two (512x512) Cosmic Constellation & Astral Grid Floor Texture.
 */
function createCosmicFloorTexture(accentRgba: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#070a14';
  ctx.fillRect(0, 0, 512, 512);

  const grad = ctx.createRadialGradient(256, 256, 16, 256, 256, 360);
  grad.addColorStop(0, accentRgba);
  grad.addColorStop(1, 'rgba(3, 5, 12, 0.45)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 512);

  ctx.strokeStyle = 'rgba(200, 164, 100, 0.22)';
  ctx.lineWidth = 1.5;
  for (let i = 0; i <= 512; i += 128) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 512);
    ctx.moveTo(0, i);
    ctx.lineTo(512, i);
    ctx.stroke();
  }

  ctx.strokeStyle = 'rgba(124, 198, 242, 0.18)';
  ctx.beginPath();
  ctx.arc(256, 256, 180, 0, Math.PI * 2);
  ctx.stroke();

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 4);
  tex.anisotropy = 4;
  tex.generateMipmaps = true;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Vertical Gradient Alpha Texture for Cheap Additive Light Shafts (§3.3 & TZ.md §4.4).
 */
function createLightShaftAlphaTexture(accentHex = '#e5c158'): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, `${accentHex}66`);
  grad.addColorStop(0.5, `${accentHex}28`);
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

    const floorTex = createCosmicFloorTexture('rgba(196, 106, 58, 0.24)');
    const cosmicFloorMat = new THREE.MeshStandardMaterial({
      color: '#0d1324',
      map: floorTex,
      roughness: 0.18,
      metalness: 0.68,
    });
    const obsidianMat = new THREE.MeshLambertMaterial({
      color: '#0b101d',
    });
    const goldHeroMat = new THREE.MeshStandardMaterial({
      color: skyRig.palette[2] ?? '#e5c158',
      roughness: 0.2,
      metalness: 0.88,
      emissive: skyRig.palette[0] ?? '#42300e',
      emissiveIntensity: 0.35,
    });
    const cyanHeroMat = new THREE.MeshStandardMaterial({
      color: skyRig.palette[1] ?? '#4ea8de',
      roughness: 0.18,
      metalness: 0.84,
      emissive: '#103452',
      emissiveIntensity: 0.55,
    });
    const violetHeroMat = new THREE.MeshStandardMaterial({
      color: '#b388ff',
      roughness: 0.2,
      metalness: 0.85,
      emissive: '#2c1654',
      emissiveIntensity: 0.5,
    });

    const shaftTex = createLightShaftAlphaTexture(skyRig.palette[2] ?? '#e5c158');
    const shaftAdditiveMat = new THREE.MeshBasicMaterial({
      map: shaftTex,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    // 1. Grand Circular Cosmic Observatory Platform (y = 0, walkable)
    const platformDisc = new THREE.Mesh(
      new THREE.CylinderGeometry(14.5, 15.8, 0.6, 48),
      cosmicFloorMat
    );
    platformDisc.position.set(0, -0.3, 0);
    root.add(platformDisc);
    walkableMeshes.push(platformDisc);

    // Concentric glowing astral rings on the cosmic floor using the Nebula palette
    [4.5, 9.2, 13.8].forEach((r, idx) => {
      const floorRing = new THREE.Mesh(
        new THREE.RingGeometry(r, r + 0.12, 64),
        new THREE.MeshBasicMaterial({
          color: skyRig.palette[idx % skyRig.palette.length] ?? '#e5c158',
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.65,
        })
      );
      floorRing.rotation.x = -Math.PI * 0.5;
      floorRing.position.set(0, 0.015, 0);
      root.add(floorRing);
    });

    // 2. Infinite Cosmic Pillar of Starlight & Rotating Celestial Astrolabe Rings Overhead
    const verticalLineMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.14, 0.14, 76, 16),
      new THREE.MeshBasicMaterial({
        color: skyRig.palette[2] ?? '#9be2ff',
        transparent: true,
        opacity: 0.55,
      })
    );
    verticalLineMesh.name = 'onboarding_vertical_line';
    verticalLineMesh.position.set(0, 0, -3.8);
    root.add(verticalLineMesh);

    const astrolabeGroup = new THREE.Group();
    astrolabeGroup.name = 'cosmic_astrolabe_rings';
    astrolabeGroup.position.set(0, 12.5, -3.8);

    const ring1 = new THREE.Mesh(
      new THREE.TorusGeometry(9.5, 0.14, 16, 64),
      goldHeroMat
    );
    ring1.rotation.x = Math.PI * 0.35;
    astrolabeGroup.add(ring1);

    const ring2 = new THREE.Mesh(
      new THREE.TorusGeometry(12.5, 0.12, 16, 64),
      cyanHeroMat
    );
    ring2.rotation.y = Math.PI * 0.25;
    ring2.rotation.x = -Math.PI * 0.28;
    astrolabeGroup.add(ring2);

    const ring3 = new THREE.Mesh(
      new THREE.TorusGeometry(15.5, 0.1, 16, 64),
      violetHeroMat
    );
    ring3.rotation.z = Math.PI * 0.2;
    astrolabeGroup.add(ring3);

    const sunCore = new THREE.Mesh(
      new THREE.OctahedronGeometry(1.35, 2),
      goldHeroMat
    );
    astrolabeGroup.add(sunCore);

    root.add(astrolabeGroup);

    // Additive Cosmic Light Cone descending from the Singularity Core
    const cosmicShaft = new THREE.Mesh(
      new THREE.ConeGeometry(6.5, 22, 32, 1, true),
      shaftAdditiveMat
    );
    cosmicShaft.position.set(0, 10.5, -3.8);
    root.add(cosmicShaft);

    // 3. Perimeter Cosmic Colonnade (12 Astral Monoliths = 1 draw call)
    const colGeo = new THREE.CylinderGeometry(0.42, 0.55, 16, 12);
    const colInst = new THREE.InstancedMesh(colGeo, obsidianMat, 12);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      dummy.position.set(
        Math.sin(angle) * 13.6,
        8.0,
        Math.cos(angle) * 13.6
      );
      dummy.updateMatrix();
      colInst.setMatrixAt(i, dummy.matrix);
    }
    colInst.instanceMatrix.needsUpdate = true;
    root.add(colInst);

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

    // 5. Central Awakening Monolith Pedestal at (0, 0, 1.2)
    const pedestalGroup = new THREE.Group();
    pedestalGroup.name = 'onboarding_pedestal';
    pedestalGroup.position.set(0, 0, 1.2);

    const pedBase = new THREE.Mesh(
      new THREE.CylinderGeometry(0.52, 0.68, 1.05, 8),
      obsidianMat
    );
    pedBase.position.y = 0.525;
    pedestalGroup.add(pedBase);

    const pedCrystal = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.34, 0),
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

    // 6. Comfort Calibration Ritual Marks (Seated vs Standing)
    const postureGroup = new THREE.Group();
    postureGroup.name = 'onboarding_posture_marks';
    postureGroup.position.set(-2.4, 0, 3.6);

    const seatedOrb = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.16, 0),
      cyanHeroMat
    );
    seatedOrb.position.set(0, 1.05, 0);
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
        new THREE.CylinderGeometry(0.22, 0.26, 1.2, 12),
        goldHeroMat
      );
      locoSwitch.position.set(2.4, 0.6, 3.6);
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
        x: -5.8,
        z: -6.2,
        rotY: Math.PI * 0.16,
        mat: goldHeroMat,
      },
      {
        segment: 2,
        x: 0,
        z: -7.6,
        rotY: 0,
        mat: cyanHeroMat,
      },
      {
        segment: 3,
        x: 5.8,
        z: -6.2,
        rotY: -Math.PI * 0.16,
        mat: violetHeroMat,
      },
    ];

    cosmicDoorsSpec.forEach((spec) => {
      const meta = SECTOR_HALL_META[spec.segment];
      const doorGroup = new THREE.Group();
      doorGroup.position.set(spec.x, 0, spec.z);
      doorGroup.rotation.y = spec.rotY;

      const plinth = new THREE.Mesh(
        new THREE.BoxGeometry(3.6, 0.24, 0.9),
        obsidianMat
      );
      plinth.position.set(0, 0.12, 0.2);
      doorGroup.add(plinth);

      [-1.45, 1.45].forEach((jx) => {
        const pillar = new THREE.Mesh(
          new THREE.BoxGeometry(0.36, 4.6, 0.48),
          spec.mat
        );
        pillar.position.set(jx, 2.3, 0.18);
        doorGroup.add(pillar);
      });

      const lintel = new THREE.Mesh(
        new THREE.BoxGeometry(3.7, 0.52, 0.58),
        spec.mat
      );
      lintel.position.set(0, 4.75, 0.22);
      doorGroup.add(lintel);

      const leaf = new THREE.Mesh(
        new THREE.BoxGeometry(2.55, 4.3, 0.16),
        new THREE.MeshStandardMaterial({
          color: '#0e172c',
          roughness: 0.15,
          metalness: 0.85,
          emissive: meta.accentHex,
          emissiveIntensity: 0.22,
        })
      );
      leaf.position.set(0, 0.24 + 2.15, 0.12);
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
      plaque.position.set(0, 5.75, 0.28);
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

    // 9. Ascent & Descent Cosmic Dais Lifts on West and East Wings
    const ascentGroup = new THREE.Group();
    ascentGroup.position.set(-8.6, 0, -0.8);
    ascentGroup.rotation.y = Math.PI * 0.35;

    const ascentDais = new THREE.Mesh(
      new THREE.CylinderGeometry(2.1, 2.3, 0.32, 32),
      goldHeroMat
    );
    ascentDais.position.set(0, 0.16, 0);
    ascentGroup.add(ascentDais);
    walkableMeshes.push(ascentDais);

    const ascentSpire = new THREE.Mesh(
      new THREE.ConeGeometry(1.2, 2.2, 4),
      goldHeroMat
    );
    ascentSpire.position.set(0, 4.4, 0);
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
    ascentPlaque.position.set(0, 2.7, 0);
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
    descentGroup.position.set(8.6, 0, -0.8);
    descentGroup.rotation.y = -Math.PI * 0.35;

    const descentDais = new THREE.Mesh(
      new THREE.CylinderGeometry(2.1, 2.3, 0.32, 32),
      cyanHeroMat
    );
    descentDais.position.set(0, 0.16, 0);
    descentGroup.add(descentDais);
    walkableMeshes.push(descentDais);

    const descentTorus = new THREE.Mesh(
      new THREE.TorusGeometry(1.15, 0.12, 14, 36),
      cyanHeroMat
    );
    descentTorus.position.set(0, 4.2, 0);
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
    descentPlaque.position.set(0, 2.7, 0);
    descentGroup.add(descentPlaque);

    atriumGroup.add(descentGroup);
    registerTarget(descentGroup, {
      id: 'THRESHOLD_DESCENT',
      kind: 'threshold-branch',
      branch: 'descend',
      title: '▼ DESCENT · ROOM II',
      titleRu: '▼ DESCENT · ROOM II',
      subtitle: 'Enter Room II · Sector B (Rooms 12–19)',
      subtitleRu: 'Enter Room II · Sector B (Rooms 12–19)',
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
        ? 'rgba(212, 148, 72, 0.22)'
        : segment === 2
        ? 'rgba(50, 136, 200, 0.24)'
        : 'rgba(179, 136, 255, 0.22)'
    );
    const wallLambertMat = new THREE.MeshLambertMaterial({
      color:
        segment === 1 ? '#18151f' : segment === 2 ? '#0e1726' : '#161128',
    });
    const floorMat = new THREE.MeshStandardMaterial({
      map: floorTex,
      roughness: segment === 2 ? 0.12 : 0.2,
      metalness: 0.55,
    });
    const heroTrimMat = new THREE.MeshStandardMaterial({
      color: accentHex,
      roughness: 0.24,
      metalness: 0.84,
      emissive: rimHex,
      emissiveIntensity: 0.2,
    });

    // 1. Walkable Sector Room Floor (y = 0)
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(width, depth),
      floorMat
    );
    floor.rotation.x = -Math.PI * 0.5;
    root.add(floor);
    walkableMeshes.push(floor);

    // Branch Visual Polish (TZ.md §4.3 & §4.4):
    // Warm Ascent -> Additive Light Shafts; Cool Descent -> Reflective Caustic Pool in center
    if (skyRig.tone === 'warm') {
      const shaftTex = createLightShaftAlphaTexture(rimHex);
      const shaftMesh = new THREE.Mesh(
        new THREE.ConeGeometry(4.2, height * 1.3, 24, 1, true),
        new THREE.MeshBasicMaterial({
          map: shaftTex,
          transparent: true,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          side: THREE.DoubleSide,
        })
      );
      shaftMesh.position.set(0, height * 0.65, -2.5);
      root.add(shaftMesh);
    } else {
      const poolMesh = new THREE.Mesh(
        new THREE.RingGeometry(1.4, 3.2, 48),
        new THREE.MeshStandardMaterial({
          color: skyRig.palette[1] ?? '#4ea8de',
          roughness: 0.06,
          metalness: 0.92,
          emissive: skyRig.palette[0] ?? '#143852',
          emissiveIntensity: 0.35,
          side: THREE.DoubleSide,
        })
      );
      poolMesh.rotation.x = -Math.PI * 0.5;
      poolMesh.position.set(0, 0.015, -2.0);
      root.add(poolMesh);
    }

    // 2. Side & End Walls (Open Celestial Skylight above so the Real Nebula Cap shines down!)
    [-halfW, halfW].forEach((wx) => {
      const sideWall = new THREE.Mesh(
        new THREE.PlaneGeometry(depth, height),
        wallLambertMat
      );
      sideWall.rotation.y = wx < 0 ? Math.PI * 0.5 : -Math.PI * 0.5;
      sideWall.position.set(wx, height * 0.5, 0);
      root.add(sideWall);
    });

    [-halfD, halfD].forEach((wz) => {
      const endWall = new THREE.Mesh(
        new THREE.PlaneGeometry(width, height),
        wallLambertMat
      );
      endWall.rotation.y = wz < 0 ? 0 : Math.PI;
      endWall.position.set(0, height * 0.5, wz);
      root.add(endWall);
    });

    // 3. Instanced Colonnade Pillars (12 columns = 1 draw call)
    const colGeo = new THREE.CylinderGeometry(0.36, 0.44, height, 12);
    const colInst = new THREE.InstancedMesh(colGeo, wallLambertMat, 12);
    const dummy = new THREE.Object3D();
    let cIdx = 0;
    for (let side = -1; side <= 1; side += 2) {
      for (let iz = 0; iz < 6; iz++) {
        dummy.position.set(
          side * (halfW - 2.3),
          height * 0.5,
          -12.5 + iz * 5.0
        );
        dummy.updateMatrix();
        colInst.setMatrixAt(cIdx++, dummy.matrix);
      }
    }
    colInst.instanceMatrix.needsUpdate = true;
    root.add(colInst);

    // 4. Doors to every Artwork & Audio Room in this Sector (11 slots, zero overlap)
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
        : 'ART & AUDIO';

      const statusColor = isPlanned
        ? '#555555'
        : isCompleted
        ? '#66cc99'
        : isVisited
        ? '#6fa8dc'
        : rimHex;

      const dGroup = new THREE.Group();
      dGroup.position.set(slot.x, 0, slot.z);
      dGroup.rotation.y = slot.rotY;

      const step = new THREE.Mesh(
        new THREE.BoxGeometry(2.6, 0.16, 0.55),
        wallLambertMat
      );
      step.position.set(0, 0.08, 0.22);
      dGroup.add(step);

      [-1.08, 1.08].forEach((jx) => {
        const jamb = new THREE.Mesh(
          new THREE.BoxGeometry(0.24, 3.6, 0.38),
          heroTrimMat
        );
        jamb.position.set(jx, 1.8, 0.18);
        dGroup.add(jamb);
      });

      const lintel = new THREE.Mesh(
        new THREE.BoxGeometry(2.65, 0.42, 0.46),
        heroTrimMat
      );
      lintel.position.set(0, 3.75, 0.22);
      dGroup.add(lintel);

      const stateBeaconMat = new THREE.MeshBasicMaterial({
        color: statusColor,
      });
      const beaconGem = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.16, 0),
        stateBeaconMat
      );
      beaconGem.position.set(0, 3.75, 0.5);
      dGroup.add(beaconGem);

      const leaf = new THREE.Mesh(
        new THREE.BoxGeometry(1.95, 3.45, 0.15),
        new THREE.MeshStandardMaterial({
          color: '#111624',
          roughness: 0.28,
          metalness: 0.65,
        })
      );
      leaf.position.set(0, 0.16 + 1.72, 0.12);
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
      plaque.position.set(0, 4.55, 0.26);
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

    // 5. North Wall: Portals to the other 2 Sector Rooms
    const otherSegments = ([1, 2, 3] as const).filter((s) => s !== segment);
    otherSegments.forEach((targetSeg, idx) => {
      const targetMeta = SECTOR_HALL_META[targetSeg];
      const px = idx === 0 ? -3.4 : 3.4;

      const northPortal = new THREE.Group();
      northPortal.position.set(px, 0, -halfD + 0.28);

      const nArch = new THREE.Mesh(
        new THREE.BoxGeometry(3.1, 4.1, 0.34),
        heroTrimMat
      );
      nArch.position.y = 2.05;
      northPortal.add(nArch);

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
      nPlaque.position.set(0, 4.75, 0.25);
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
      new THREE.BoxGeometry(3.4, 4.2, 0.36),
      heroTrimMat
    );
    sArch.position.y = 2.1;
    southPortal.add(sArch);

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
    sPlaque.position.set(0, 4.8, 0.25);
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
