import * as THREE from 'three';
import worldGraphData from '../../content/world.graph.json';
import { t } from '../i18n/strings';
import { OnboardingVisualState } from '../onboarding/types';
import { CorridorBranch } from '../room-sdk';
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
    | 'corridor-return';
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
}

export function getWorldNodes(): WorldGraphNode[] {
  return (worldGraphData.nodes as WorldGraphNode[]) ?? [];
}

/**
 * Power-of-Two (512x256) Mipmapped Plaque Texture (EXPERIENCE_PROTOCOL.md §3.4 & §4.1).
 * Uses symbols + short names only; never renders instructions on plaques.
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

  // Astral grid + sacred circles
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
 * Power-of-Two (1024x512) Deep Cosmic Nebula Sky Dome Texture.
 */
function createCosmicNebulaDomeTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  const bg = ctx.createLinearGradient(0, 0, 0, 512);
  bg.addColorStop(0, '#02040a');
  bg.addColorStop(0.45, '#070d1e');
  bg.addColorStop(0.75, '#0c1328');
  bg.addColorStop(1, '#03050c');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 1024, 512);

  // Nebula clouds
  const clouds = [
    { x: 260, y: 190, r: 240, c: 'rgba(78, 168, 222, 0.18)' },
    { x: 540, y: 150, r: 280, c: 'rgba(155, 105, 225, 0.16)' },
    { x: 780, y: 230, r: 220, c: 'rgba(229, 193, 88, 0.15)' },
    { x: 512, y: 310, r: 300, c: 'rgba(56, 189, 248, 0.12)' },
  ];
  clouds.forEach((cl) => {
    const g = ctx.createRadialGradient(cl.x, cl.y, 10, cl.x, cl.y, cl.r);
    g.addColorStop(0, cl.c);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 1024, 512);
  });

  // Embedded fine background stars
  for (let i = 0; i < 600; i++) {
    const sx = (i * 173) % 1024;
    const sy = (i * 97) % 512;
    const sr = (i % 3) * 0.65 + 0.5;
    ctx.fillStyle =
      i % 5 === 0 ? '#ffe6a3' : i % 3 === 0 ? '#9be2ff' : '#ffffff';
    ctx.beginPath();
    ctx.arc(sx, sy, sr, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.generateMipmaps = true;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Builds a 3D Starfield Point Cloud surrounding the Grand Cosmic Starting Room.
 */
function createStarfieldPoints(count = 1600, radius = 58): THREE.Points {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const palette = [
    new THREE.Color('#ffffff'),
    new THREE.Color('#ffe4a0'),
    new THREE.Color('#8ce0ff'),
    new THREE.Color('#c8a4ff'),
    new THREE.Color('#f0d27a'),
  ];

  for (let i = 0; i < count; i++) {
    const u = ((i * 613) % 1000) / 1000;
    const v = ((i * 397) % 1000) / 1000;
    const theta = u * Math.PI * 2;
    const phi = Math.acos(2 * v - 1);
    const r = radius * (0.65 + ((i * 131) % 35) / 100);

    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.cos(phi);
    positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);

    const col = palette[i % palette.length];
    colors[i * 3] = col.r;
    colors[i * 3 + 1] = col.g;
    colors[i * 3 + 2] = col.b;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const mat = new THREE.PointsMaterial({
    size: 0.34,
    vertexColors: true,
    transparent: true,
    opacity: 0.92,
    depthWrite: false,
  });

  const points = new THREE.Points(geo, mat);
  points.name = 'cosmic_starfield_points';
  return points;
}

/**
 * Vertical Gradient Alpha Texture for Cheap Additive Light Shafts (§3.3).
 */
function createLightShaftAlphaTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, 'rgba(165, 220, 255, 0.42)');
  grad.addColorStop(0.5, 'rgba(229, 193, 88, 0.18)');
  grad.addColorStop(1, 'rgba(255, 224, 156, 0.0)');
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
  },
  2: {
    title: 'ROOM II · OPERATING SYSTEM',
    subtitle: 'Sector B · Rooms 12–19 (Solitude to Algorithm)',
    symbol: 'II·◯',
    range: '8 ROOMS (12–19)',
    accentHex: '#4ea8de',
    bgHex: '#060c18',
    branch: 'descend',
  },
  3: {
    title: 'ROOM III · UPGRADE & MIRROR',
    subtitle: 'Sector C & D · Rooms 20–25 (Signal to Mirror)',
    symbol: 'III·🪞',
    range: '6 ROOMS (20–25)',
    accentHex: '#b388ff',
    bgHex: '#090718',
    branch: 'ascend',
  },
};

/**
 * Builds the Grand Cosmic Starting Room (Threshold) and the 3 Sector Rooms (Halls I, II, III)
 * that house the doors to all 25 Neuromicon Artwork & Audio Rooms.
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
    scene.background = new THREE.Color('#03050c');
    scene.fog = new THREE.FogExp2('#03050c', 0.011);

    // Budget §5.1: Strictly 2 real-time lights (1 HemisphereLight + 1 PointLight)
    const hemi = new THREE.HemisphereLight('#c8e4ff', '#16122e', 0.92);
    hemi.name = 'threshold_hemi_light';
    root.add(hemi);

    const centralKeyLight = new THREE.PointLight('#ffe094', 44, 58, 1.25);
    centralKeyLight.name = 'threshold_key_light';
    centralKeyLight.position.set(0, 10.5, -2.0);
    root.add(centralKeyLight);

    // 0. Grand Cosmic Sky Dome & 3D Starfield
    const skyDomeTex = createCosmicNebulaDomeTexture();
    const skyDome = new THREE.Mesh(
      new THREE.SphereGeometry(68, 32, 20),
      new THREE.MeshBasicMaterial({
        map: skyDomeTex,
        side: THREE.BackSide,
        depthWrite: false,
      })
    );
    root.add(skyDome);

    const starfield = createStarfieldPoints(1600, 58);
    root.add(starfield);

    // Shared Materials
    const floorTex = createCosmicFloorTexture('rgba(124, 198, 242, 0.22)');
    const cosmicFloorMat = new THREE.MeshStandardMaterial({
      color: '#0d1324',
      map: floorTex,
      roughness: 0.2,
      metalness: 0.65,
    });
    const obsidianMat = new THREE.MeshLambertMaterial({
      color: '#0b101d',
    });
    const goldHeroMat = new THREE.MeshStandardMaterial({
      color: '#e5c158',
      roughness: 0.22,
      metalness: 0.88,
      emissive: '#42300e',
      emissiveIntensity: 0.45,
    });
    const cyanHeroMat = new THREE.MeshStandardMaterial({
      color: '#4ea8de',
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

    const shaftTex = createLightShaftAlphaTexture();
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

    // Concentric glowing astral rings on the cosmic floor
    [4.5, 9.2, 13.8].forEach((r, idx) => {
      const floorRing = new THREE.Mesh(
        new THREE.RingGeometry(r, r + 0.12, 64),
        new THREE.MeshBasicMaterial({
          color: idx === 0 ? '#e5c158' : idx === 1 ? '#4ea8de' : '#b388ff',
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.6,
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
        color: '#9be2ff',
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

    // Central Singularity Sun Core overhead
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
      subtitle: '25 Rooms · 3 Sector Chambers',
      subtitleRu: '25 Rooms · 3 Sector Chambers',
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

      // Grounded Cosmic Step Plinth
      const plinth = new THREE.Mesh(
        new THREE.BoxGeometry(3.6, 0.24, 0.9),
        obsidianMat
      );
      plinth.position.set(0, 0.12, 0.2);
      doorGroup.add(plinth);

      // Twin Cosmic Pillars
      [-1.45, 1.45].forEach((jx) => {
        const pillar = new THREE.Mesh(
          new THREE.BoxGeometry(0.36, 4.6, 0.48),
          spec.mat
        );
        pillar.position.set(jx, 2.3, 0.18);
        doorGroup.add(pillar);
      });

      // Upper Arch Lintel
      const lintel = new THREE.Mesh(
        new THREE.BoxGeometry(3.7, 0.52, 0.58),
        spec.mat
      );
      lintel.position.set(0, 4.75, 0.22);
      doorGroup.add(lintel);

      // Shimmering Starlight Portal Leaf
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

      // Overhead Plaque
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
   * Animates the Grand Cosmic Starting Room's celestial astrolabe rings, starfield, and onboarding beacons
   * with zero per-frame allocations.
   */
  public static updateThresholdOnboardingVisuals(
    root: THREE.Group,
    visual: OnboardingVisualState,
    timeSec: number
  ): void {
    const moveRing = root.getObjectByName('onboarding_move_ring');
    if (moveRing) {
      moveRing.visible = visual.showMoveRing;
      const scale = 1 + Math.sin(timeSec * 3.2) * 0.08;
      moveRing.scale.set(scale, 1, scale);
    }

    const pedCrystal = root.getObjectByName('onboarding_pedestal_crystal');
    if (pedCrystal) {
      pedCrystal.rotation.y = timeSec * 0.85;
      pedCrystal.position.y = 1.45 + Math.sin(timeSec * 2.2) * 0.07;
    }

    const astrolabe = root.getObjectByName('cosmic_astrolabe_rings');
    if (astrolabe) {
      astrolabe.rotation.y = timeSec * 0.14;
      astrolabe.rotation.z = Math.sin(timeSec * 0.25) * 0.12;
    }

    const stars = root.getObjectByName('cosmic_starfield_points');
    if (stars) {
      stars.rotation.y = timeSec * 0.018;
    }

    const postureMarks = root.getObjectByName('onboarding_posture_marks');
    if (postureMarks) {
      postureMarks.visible = visual.showComfortCalibrationMarks;
    }

    // Keep the Grand Cosmic Doors and Architecture ALWAYS visible and majestic!
    const atriumGroup = root.getObjectByName('threshold_atrium_reveal_group');
    if (atriumGroup) {
      atriumGroup.visible = true;
    }

    const keyLight = root.getObjectByName(
      'threshold_key_light'
    ) as THREE.PointLight | null;
    if (keyLight) {
      keyLight.intensity = 38 + Math.sin(timeSec * 1.4) * 4;
    }

    const rung3Plaque = root.getObjectByName('onboarding_rung3_plaque');
    if (rung3Plaque) {
      rung3Plaque.visible = visual.hintRung >= 3;
    }
  }

  /**
   * Builds one of the 3 Grand Sector Rooms (`segment = 1 | 2 | 3`):
   * - Room I (Sector A): 11 Doors to Rooms 01–11
   * - Room II (Sector B): 8 Doors to Rooms 12–19
   * - Room III (Sector C & D): 6 Doors to Rooms 20–25
   * Each door inside these 3 rooms leads directly into a dedicated room with its own Painting, Essay, and MP3 audio track!
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
    const accentHex = meta.accentHex;
    const bgHex = meta.bgHex;

    scene.background = new THREE.Color(bgHex);
    scene.fog = new THREE.FogExp2(bgHex, 0.015);

    // Strictly 2 real-time lights (§5.1)
    const hemi = new THREE.HemisphereLight('#d8ecff', '#0b1020', 0.85);
    root.add(hemi);

    const centerLight = new THREE.PointLight(accentHex, 42, 48, 1.3);
    centerLight.position.set(0, 9.2, 0);
    root.add(centerLight);

    // Cosmic Starfield dome visible above the open celestial gallery colonnade
    const starfield = createStarfieldPoints(1100, 56);
    root.add(starfield);

    const width = 20;
    const height = 9.6;
    const depth = 36;
    const halfW = width * 0.5;
    const halfD = depth * 0.5;

    const floorTex = createCosmicFloorTexture(
      segment === 1
        ? 'rgba(229, 193, 88, 0.2)'
        : segment === 2
        ? 'rgba(78, 168, 222, 0.22)'
        : 'rgba(179, 136, 255, 0.22)'
    );
    const wallLambertMat = new THREE.MeshLambertMaterial({
      color:
        segment === 1 ? '#18151f' : segment === 2 ? '#0e1726' : '#161128',
    });
    const floorMat = new THREE.MeshStandardMaterial({
      map: floorTex,
      roughness: 0.18,
      metalness: 0.5,
    });
    const heroTrimMat = new THREE.MeshStandardMaterial({
      color: accentHex,
      roughness: 0.24,
      metalness: 0.84,
      emissive: accentHex,
      emissiveIntensity: 0.18,
    });

    // 1. Walkable Sector Room Floor (y = 0)
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(width, depth),
      floorMat
    );
    floor.rotation.x = -Math.PI * 0.5;
    root.add(floor);
    walkableMeshes.push(floor);

    // 2. Side & End Walls (with open celestial skylight above)
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

    // 4. Doors to every Artwork & Audio Room in this Sector (Zero overlapping slots!)
    const segmentNodes = getWorldNodes().filter((n) => n.segment === segment);

    // 11 distinct architectural door bays (6 on West wall, 5 on East wall)
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
        : accentHex;

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
        subtitle: `${node.dimension} · Enter Room with Painting & MP3`,
        subtitleRu: `${node.dimension} · Enter Room with Painting & MP3`,
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
