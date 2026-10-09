import * as THREE from 'three';
import worldGraphData from '../../content/world.graph.json';
import artManifestData from '../../content/art/manifest.json';
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
  segment: 1 | 2;
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
  segment?: 1 | 2;
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

  ctx.fillStyle = '#0d0c0a';
  ctx.fillRect(0, 0, 512, 256);

  ctx.strokeStyle = accentHex;
  ctx.lineWidth = 4;
  ctx.strokeRect(6, 6, 500, 244);

  // Symbol medallion box on left (distinct geometry for color-blind safety §2.8)
  ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
  ctx.fillRect(20, 24, 116, 208);
  ctx.strokeStyle = accentHex;
  ctx.lineWidth = 2;
  ctx.strokeRect(20, 24, 116, 208);

  ctx.fillStyle = accentHex;
  ctx.font = '700 34px "Cinzel", Georgia, serif';
  ctx.textAlign = 'center';
  ctx.fillText(symbol.slice(0, 6), 78, 140);

  // Short Name & Dimension on right
  ctx.textAlign = 'left';
  ctx.fillStyle = '#f3ede2';
  ctx.font = '600 22px "Cinzel", Georgia, serif';
  ctx.fillText(title.slice(0, 24), 154, 92);

  ctx.fillStyle = '#b5ab99';
  ctx.font = '400 17px system-ui, sans-serif';
  ctx.fillText(subtitle.slice(0, 32), 154, 138);

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
 * Power-of-Two (512x512) Macro-Variation Floor/Pool Texture (§4.1 & §4.3).
 * Blends primary tile grid with a second low-frequency macro noise layer to prevent tiling repeats.
 */
function createMacroFloorTexture(
  isAscent: boolean
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = isAscent ? '#1c1814' : '#091119';
  ctx.fillRect(0, 0, 512, 512);

  // Macro-variation gradient overlay
  const grad = ctx.createRadialGradient(256, 256, 20, 256, 256, 360);
  grad.addColorStop(
    0,
    isAscent ? 'rgba(200, 164, 100, 0.12)' : 'rgba(78, 168, 222, 0.16)'
  );
  grad.addColorStop(1, 'rgba(0, 0, 0, 0.25)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 512);

  const step = 128;
  ctx.strokeStyle = isAscent
    ? 'rgba(200, 164, 100, 0.22)'
    : 'rgba(78, 168, 222, 0.25)';
  ctx.lineWidth = 2;
  for (let i = 0; i <= 512; i += step) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 512);
    ctx.moveTo(0, i);
    ctx.lineTo(512, i);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 4);
  tex.anisotropy = 4; // §4.1: Anisotropy 2–4 on floors only
  tex.generateMipmaps = true;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Power-of-Two (1024x512) Hero Artwork Texture (§4.1).
 */
function createProceduralArtworkTexture(
  title: string,
  author: string,
  license: string,
  motif: string,
  accentHex: string
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createRadialGradient(512, 240, 30, 512, 256, 480);
  if (motif.includes('abyss') || motif.includes('reflection')) {
    grad.addColorStop(0, '#162c3d');
    grad.addColorStop(0.65, '#0b1620');
    grad.addColorStop(1, '#05090e');
  } else {
    grad.addColorStop(0, '#362919');
    grad.addColorStop(0.65, '#1a140d');
    grad.addColorStop(1, '#090705');
  }
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1024, 512);

  ctx.strokeStyle = accentHex;
  ctx.lineWidth = 2.5;

  for (let i = 1; i <= 6; i++) {
    const r = i * 34;
    ctx.beginPath();
    ctx.arc(512, 225, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeRect(512 - r * 1.45, 225 - r * 0.85, r * 2.9, r * 1.7);
  }

  ctx.fillStyle = '#f3ede2';
  ctx.font = '600 24px "Cinzel", Georgia, serif';
  ctx.textAlign = 'center';
  ctx.fillText(title, 512, 448);

  ctx.fillStyle = accentHex;
  ctx.font = '400 16px system-ui, sans-serif';
  ctx.fillText(`${author} · ${license}`, 512, 480);

  const tex = new THREE.CanvasTexture(canvas);
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
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
  grad.addColorStop(0, 'rgba(255, 236, 188, 0.36)');
  grad.addColorStop(0.6, 'rgba(255, 224, 156, 0.12)');
  grad.addColorStop(1, 'rgba(255, 224, 156, 0.0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 256);
  const tex = new THREE.CanvasTexture(canvas);
  tex.generateMipmaps = true;
  return tex;
}

/**
 * Builds the Threshold Hall and chunked Corridor Segments strictly within
 * EXPERIENCE_PROTOCOL.md budgets:
 * - <= 2 real-time lights per active scene
 * - <= 12 unique materials (MeshLambertMaterial/MeshBasicMaterial for architecture; MeshStandardMaterial on hero objects)
 * - Show, don't tell onboarding geometry (pulsing ring, glowing pedestal, posture orbs, vertical shaft)
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
    scene.background = new THREE.Color('#080706');
    scene.fog = new THREE.FogExp2('#080706', 0.022);

    // Budget §5.1: Strictly 2 real-time lights (1 HemisphereLight + 1 PointLight)
    const hemi = new THREE.HemisphereLight('#f5e4c3', '#122638', 0.72);
    hemi.name = 'threshold_hemi_light';
    root.add(hemi);

    const centralKeyLight = new THREE.PointLight('#ffd88a', 32, 42, 1.35);
    centralKeyLight.name = 'threshold_key_light';
    centralKeyLight.position.set(0, 7.5, -2.0);
    root.add(centralKeyLight);

    // Shared Materials (Budget §4.3: <= 12 unique materials, MeshLambertMaterial for corridor stone)
    const floorTex = createMacroFloorTexture(true);
    const stoneLambertMat = new THREE.MeshLambertMaterial({
      color: '#201c18',
      map: floorTex,
    });
    const basaltLambertMat = new THREE.MeshLambertMaterial({
      color: '#101720',
    });
    const goldHeroMat = new THREE.MeshStandardMaterial({
      color: '#c8a464',
      roughness: 0.26,
      metalness: 0.82,
      emissive: '#382910',
      emissiveIntensity: 0.35,
    });
    const cyanHeroMat = new THREE.MeshStandardMaterial({
      color: '#4ea8de',
      roughness: 0.2,
      metalness: 0.78,
      emissive: '#143852',
      emissiveIntensity: 0.55,
    });
    const shaftTex = createLightShaftAlphaTexture();
    const shaftAdditiveMat = new THREE.MeshBasicMaterial({
      map: shaftTex,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    // 1. Central Threshold Bridge Platform (y = 0, walkable)
    const bridgeFloor = new THREE.Mesh(
      new THREE.BoxGeometry(22, 0.5, 24),
      stoneLambertMat
    );
    bridgeFloor.position.set(0, -0.25, 0);
    root.add(bridgeFloor);
    walkableMeshes.push(bridgeFloor);

    // 2. Beat 0–8 s (AWAKEN): Faint Vertical Line of Light far above (+22m) and below (-22m) (§2.2)
    const verticalLineMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.06, 44, 12),
      new THREE.MeshBasicMaterial({
        color: '#f3e3b8',
        transparent: true,
        opacity: 0.65,
      })
    );
    verticalLineMesh.name = 'onboarding_vertical_line';
    verticalLineMesh.position.set(0, 0, -4.5);
    root.add(verticalLineMesh);

    // 3. Beat 8–25 s (LEARN_MOVE): Soft Pulsing Ring on Floor at z = 2.2m (2–3m ahead of spawn z = 5.2m)
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

    // 4. Beat 25–45 s (LEARN_INTERACT): Central Awakening Monolith Pedestal at (0, 0, 1.0)
    const pedestalGroup = new THREE.Group();
    pedestalGroup.name = 'onboarding_pedestal';
    pedestalGroup.position.set(0, 0, 1.0);

    const pedBase = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 1.05, 0.9),
      stoneLambertMat
    );
    pedBase.position.y = 0.525;
    pedestalGroup.add(pedBase);

    const pedCrystal = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.32, 0),
      goldHeroMat
    );
    pedCrystal.name = 'onboarding_pedestal_crystal';
    pedCrystal.position.y = 1.42;
    pedestalGroup.add(pedCrystal);

    root.add(pedestalGroup);
    registerTarget(pedestalGroup, {
      id: 'ONBOARDING_PEDESTAL',
      kind: 'onboarding-pedestal',
      title: '◈',
      titleRu: '◈',
      subtitle: '',
      subtitleRu: '',
    });

    // 5. Comfort Calibration Ritual Marks at AWAKEN (§2.4: Lower = Seated, Higher = Standing)
    const postureGroup = new THREE.Group();
    postureGroup.name = 'onboarding_posture_marks';
    postureGroup.position.set(-1.75, 0, 3.8);

    const seatedOrb = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.14, 0),
      cyanHeroMat
    );
    seatedOrb.position.set(0, 1.05, 0);
    postureGroup.add(seatedOrb);
    registerTarget(seatedOrb, {
      id: 'COMFORT_SEATED_ORB',
      kind: 'comfort-posture',
      seatedChoice: true,
      title: '◎',
      titleRu: '◎',
      subtitle: '',
      subtitleRu: '',
    });

    const standingOrb = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.14, 1),
      goldHeroMat
    );
    standingOrb.position.set(0, 1.68, 0);
    postureGroup.add(standingOrb);
    registerTarget(standingOrb, {
      id: 'COMFORT_STANDING_ORB',
      kind: 'comfort-posture',
      seatedChoice: false,
      title: '◈',
      titleRu: '◈',
      subtitle: '',
      subtitleRu: '',
    });
    root.add(postureGroup);

    // 6. Physical Smooth-Movement Switch in World (Unlocked after 5 teleports per §2.4!)
    if (state.teleportCount >= 5) {
      const locoSwitch = new THREE.Mesh(
        new THREE.CylinderGeometry(0.22, 0.26, 1.2, 12),
        goldHeroMat
      );
      locoSwitch.position.set(1.85, 0.6, 2.8);
      root.add(locoSwitch);
      registerTarget(locoSwitch, {
        id: 'WORLD_LOCOMOTION_SWITCH',
        kind: 'locomotion-switch',
        title: '⇄',
        titleRu: '⇄',
        subtitle: '',
        subtitleRu: '',
      });
    }

    // 7. Revealable Atrium Architecture Group (Opens during REVEAL 45–70s)
    const atriumGroup = new THREE.Group();
    atriumGroup.name = 'threshold_atrium_reveal_group';
    root.add(atriumGroup);

    // Instanced Colonnade (16 columns = 1 draw call)
    const colGeo = new THREE.CylinderGeometry(0.45, 0.52, 24, 14);
    const colInst = new THREE.InstancedMesh(colGeo, stoneLambertMat, 16);
    const dummy = new THREE.Object3D();
    let idx = 0;
    for (let side = -1; side <= 1; side += 2) {
      for (let iz = -3; iz <= 4; iz++) {
        dummy.position.set(side * 9.8, 4.0, iz * 3.2);
        dummy.updateMatrix();
        colInst.setMatrixAt(idx++, dummy.matrix);
      }
    }
    colInst.instanceMatrix.needsUpdate = true;
    atriumGroup.add(colInst);

    // Additive Light Shaft from Upper Oculus (§3.3: cheap additive cone mesh, no post-processing)
    const upperShaft = new THREE.Mesh(
      new THREE.ConeGeometry(4.2, 18, 24, 1, true),
      shaftAdditiveMat
    );
    upperShaft.position.set(-4.6, 9.0, -5.5);
    atriumGroup.add(upperShaft);

    // LEFT-NORTH PATH: UP — ASCENT (Warm gold, travertine, pyramidal/triangular form for color-blind safety §2.8)
    const ascentGroup = new THREE.Group();
    ascentGroup.position.set(-4.6, 0, -5.5);

    for (let s = 0; s < 5; s++) {
      const step = new THREE.Mesh(
        new THREE.BoxGeometry(4.4, 0.24, 0.9),
        stoneLambertMat
      );
      step.position.set(0, 0.12 + s * 0.24, 2.4 - s * 0.75);
      ascentGroup.add(step);
    }

    const ascentDais = new THREE.Mesh(
      new THREE.CylinderGeometry(2.3, 2.5, 0.36, 32),
      goldHeroMat
    );
    ascentDais.position.set(0, 1.2, -1.6);
    ascentGroup.add(ascentDais);
    walkableMeshes.push(ascentDais);

    // Triangular Apex Spire above Ascent (Form difference vs Descent §2.8)
    const ascentSpire = new THREE.Mesh(
      new THREE.ConeGeometry(1.6, 2.6, 4),
      goldHeroMat
    );
    ascentSpire.position.set(0, 5.6, -1.6);
    ascentGroup.add(ascentSpire);

    const ascentPlaqueTex = createSignageTexture(
      '▲',
      'ASCENT',
      'EMBODY · GROW',
      state.path === 'ascend' ? 'COMMITTED' : 'I',
      '#c8a464',
      '#f0d27a'
    );
    const ascentPlaque = new THREE.Mesh(
      new THREE.PlaneGeometry(2.8, 1.4),
      new THREE.MeshBasicMaterial({ map: ascentPlaqueTex })
    );
    ascentPlaque.position.set(0, 3.4, -1.3);
    ascentGroup.add(ascentPlaque);

    atriumGroup.add(ascentGroup);
    registerTarget(ascentGroup, {
      id: 'THRESHOLD_ASCENT',
      kind: 'threshold-branch',
      branch: 'ascend',
      title: '▲ ASCENT',
      titleRu: '▲ ASCENT',
      subtitle: 'Embody · Grow',
      subtitleRu: 'Embody · Grow',
    });

    // RIGHT-NORTH PATH: DOWN — DESCENT (Cold cyan, glossy reflective pool, inverted ring form §2.8 & §3.2)
    const descentGroup = new THREE.Group();
    descentGroup.position.set(4.6, 0, -5.5);

    for (let s = 0; s < 4; s++) {
      const step = new THREE.Mesh(
        new THREE.BoxGeometry(4.4, 0.24, 0.9),
        basaltLambertMat
      );
      step.position.set(0, 0.12 + (3 - s) * 0.12, 2.1 - s * 0.75);
      descentGroup.add(step);
    }

    // Reflective Caustic Pool Dais (§3.3: high-gloss Fresnel-style Standard material, no planar XR pass)
    const descentDais = new THREE.Mesh(
      new THREE.CylinderGeometry(2.3, 2.5, 0.36, 32),
      cyanHeroMat
    );
    descentDais.position.set(0, 0.18, -1.6);
    descentGroup.add(descentDais);
    walkableMeshes.push(descentDais);

    const descentTorus = new THREE.Mesh(
      new THREE.TorusGeometry(1.35, 0.14, 14, 36),
      cyanHeroMat
    );
    descentTorus.position.set(0, 4.6, -1.6);
    descentGroup.add(descentTorus);

    const descentPlaqueTex = createSignageTexture(
      '▼',
      'DESCENT',
      'SEARCH · EXPLORE',
      state.path === 'descend' ? 'COMMITTED' : 'II',
      '#4ea8de',
      '#7cc6f2'
    );
    const descentPlaque = new THREE.Mesh(
      new THREE.PlaneGeometry(2.8, 1.4),
      new THREE.MeshBasicMaterial({ map: descentPlaqueTex })
    );
    descentPlaque.position.set(0, 2.8, -1.3);
    descentGroup.add(descentPlaque);

    atriumGroup.add(descentGroup);
    registerTarget(descentGroup, {
      id: 'THRESHOLD_DESCENT',
      kind: 'threshold-branch',
      branch: 'descend',
      title: '▼ DESCENT',
      titleRu: '▼ DESCENT',
      subtitle: 'Search · Explore',
      subtitleRu: 'Search · Explore',
    });

    // Rung 3 Hint Engraved Plaque in World Space (Visible only if player is stuck >= 45s per §2.6!)
    const hintPlaqueTex = createSignageTexture(
      '◈',
      t('onboarding.hint.engraving', 'en'),
      'THE THRESHOLD',
      'PATH',
      '#c8a464',
      '#f3ede2'
    );
    const hintPlaqueMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(2.0, 1.0),
      new THREE.MeshBasicMaterial({ map: hintPlaqueTex })
    );
    hintPlaqueMesh.name = 'onboarding_rung3_plaque';
    hintPlaqueMesh.position.set(0, 2.2, -1.8);
    hintPlaqueMesh.visible = false;
    root.add(hintPlaqueMesh);
  }

  /**
   * Updates the Threshold Hall's diegetic onboarding lights, pulsing ring, and reveal state per frame
   * with zero object allocations.
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
      pedCrystal.rotation.y = timeSec * 0.8;
      pedCrystal.position.y =
        1.42 +
        Math.sin(timeSec * 2.2) * 0.06 * visual.pedestalGlowIntensity;
    }

    const postureMarks = root.getObjectByName('onboarding_posture_marks');
    if (postureMarks) {
      postureMarks.visible = visual.showComfortCalibrationMarks;
    }

    const atriumGroup = root.getObjectByName('threshold_atrium_reveal_group');
    if (atriumGroup) {
      atriumGroup.visible = visual.atriumRevealProgress > 0.15;
    }

    const keyLight = root.getObjectByName(
      'threshold_key_light'
    ) as THREE.PointLight | null;
    if (keyLight) {
      keyLight.intensity = 4 + visual.atriumRevealProgress * 30;
    }

    const rung3Plaque = root.getObjectByName('onboarding_rung3_plaque');
    if (rung3Plaque) {
      rung3Plaque.visible = visual.hintRung >= 3;
    }
  }

  /**
   * Builds a chunked Corridor Segment (`ascend` or `descend`, Segment 1 or 2)
   * applying the Branch Visual Language (§3.2, §3.3, §3.4) and strict material/light budgets (§4.3, §5.1).
   */
  public static buildCorridorSegment(
    root: THREE.Group,
    scene: THREE.Scene,
    branch: CorridorBranch,
    segment: 1 | 2,
    state: HubPlayerState,
    registerTarget: (
      mesh: THREE.Object3D,
      target: SpatialInteractiveTarget
    ) => void,
    walkableMeshes: THREE.Object3D[]
  ): void {
    const isAscent = branch === 'ascend';
    // §3.1 Wayfinding without text: each segment has a distinct color temperature and landmark silhouette
    const bgHex = isAscent
      ? segment === 1
        ? '#14110d'
        : '#19140e'
      : segment === 1
      ? '#070c12'
      : '#05080e';
    const accentHex = isAscent ? '#c8a464' : '#4ea8de';

    scene.background = new THREE.Color(bgHex);
    scene.fog = new THREE.FogExp2(bgHex, 0.02);

    // Strictly 2 real-time lights (§5.1)
    const hemi = new THREE.HemisphereLight(
      isAscent ? '#fff0d4' : '#99ccff',
      isAscent ? '#1f1a14' : '#0a1018',
      0.8
    );
    root.add(hemi);

    const centerLight = new THREE.PointLight(
      isAscent ? '#ffe2a8' : '#5cb8ff',
      36,
      36,
      1.35
    );
    centerLight.position.set(0, 8.2, 0);
    root.add(centerLight);

    const width = 18;
    const height = 9.2;
    const depth = 26;
    const halfW = width * 0.5;
    const halfD = depth * 0.5;

    // §4.3: MeshLambertMaterial for corridor surfaces; MeshStandardMaterial only for hero pools/frames
    const floorTex = createMacroFloorTexture(isAscent);
    const wallLambertMat = new THREE.MeshLambertMaterial({
      color: isAscent ? '#241f19' : '#111821',
    });
    const floorMat = isAscent
      ? new THREE.MeshLambertMaterial({ map: floorTex })
      : new THREE.MeshStandardMaterial({
          map: floorTex,
          roughness: 0.14, // Wet glossy reflective basalt for Descent (§3.2)
          metalness: 0.45,
        });
    const heroTrimMat = new THREE.MeshStandardMaterial({
      color: accentHex,
      roughness: 0.26,
      metalness: 0.82,
    });

    // 1. Walkable Corridor Floor (y = 0)
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(width, depth),
      floorMat
    );
    floor.rotation.x = -Math.PI * 0.5;
    root.add(floor);
    walkableMeshes.push(floor);

    // Branch Visual Language (§3.2 & §3.3):
    // Ascent -> Additive Light Shafts from above; Descent -> Glowing Caustic Pool in floor center
    if (isAscent) {
      const shaftTex = createLightShaftAlphaTexture();
      const shaftMesh = new THREE.Mesh(
        new THREE.ConeGeometry(3.4, height, 24, 1, true),
        new THREE.MeshBasicMaterial({
          map: shaftTex,
          transparent: true,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          side: THREE.DoubleSide,
        })
      );
      shaftMesh.position.set(0, height * 0.5, -2.0);
      root.add(shaftMesh);
    } else {
      const causticPool = new THREE.Mesh(
        new THREE.RingGeometry(1.2, 2.8, 36),
        new THREE.MeshBasicMaterial({
          color: '#4ea8de',
          transparent: true,
          opacity: 0.35,
          side: THREE.DoubleSide,
        })
      );
      causticPool.rotation.x = -Math.PI * 0.5;
      causticPool.position.set(0, 0.012, -1.5);
      root.add(causticPool);
    }

    // 2. Ceiling & Outer Walls
    const ceiling = new THREE.Mesh(
      new THREE.PlaneGeometry(width, depth),
      wallLambertMat
    );
    ceiling.rotation.x = Math.PI * 0.5;
    ceiling.position.y = height;
    root.add(ceiling);

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

    // 3. Instanced Colonnade Pillars (12 columns = 1 draw call, §5.2)
    const colGeo = new THREE.CylinderGeometry(0.38, 0.44, height, 14);
    const colInst = new THREE.InstancedMesh(colGeo, wallLambertMat, 12);
    const dummy = new THREE.Object3D();
    let cIdx = 0;
    for (let side = -1; side <= 1; side += 2) {
      for (let iz = -2; iz <= 3; iz++) {
        dummy.position.set(
          side * (halfW - 2.1),
          height * 0.5,
          iz * 4.0 - 2.0
        );
        dummy.updateMatrix();
        colInst.setMatrixAt(cIdx++, dummy.matrix);
      }
    }
    colInst.instanceMatrix.needsUpdate = true;
    root.add(colInst);

    // 4. Doors with State Beacons (Changing Material & Light per §3.4!)
    const segmentNodes = getWorldNodes().filter(
      (n) => n.branch === branch && n.segment === segment
    );

    const doorSlots: Array<{ x: number; z: number; rotY: number }> = [
      { x: -halfW + 0.08, z: -3.5, rotY: Math.PI * 0.5 },
      { x: halfW - 0.08, z: -3.5, rotY: -Math.PI * 0.5 },
      { x: -halfW + 0.08, z: 3.8, rotY: Math.PI * 0.5 },
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
        : 'UNVISITED';

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
        new THREE.BoxGeometry(2.8, 0.16, 0.6),
        wallLambertMat
      );
      step.position.set(0, 0.08, 0.22);
      dGroup.add(step);

      [-1.15, 1.15].forEach((jx) => {
        const jamb = new THREE.Mesh(
          new THREE.BoxGeometry(0.28, 3.8, 0.42),
          heroTrimMat
        );
        jamb.position.set(jx, 1.9, 0.18);
        dGroup.add(jamb);
      });

      const lintel = new THREE.Mesh(
        new THREE.BoxGeometry(2.9, 0.45, 0.5),
        heroTrimMat
      );
      lintel.position.set(0, 3.95, 0.22);
      dGroup.add(lintel);

      // §3.4 State indicator changes material and light on the door leaf & beacon gem
      const stateBeaconMat = new THREE.MeshBasicMaterial({
        color: statusColor,
      });
      const beaconGem = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.18, 0),
        stateBeaconMat
      );
      beaconGem.position.set(0, 3.95, 0.52);
      dGroup.add(beaconGem);

      const leaf = new THREE.Mesh(
        new THREE.BoxGeometry(2.1, 3.64, 0.16),
        wallLambertMat
      );
      leaf.position.set(0, 0.16 + 1.82, 0.12);
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
        new THREE.PlaneGeometry(2.4, 1.2),
        new THREE.MeshBasicMaterial({ map: plaqueTex })
      );
      plaque.position.set(0, 4.8, 0.28);
      dGroup.add(plaque);

      root.add(dGroup);
      registerTarget(dGroup, {
        id: `CORRIDOR_DOOR_${node.id}`,
        kind: 'corridor-door',
        roomId: node.id,
        status: node.status,
        title: `${node.symbol} · ${node.title}`,
        titleRu: `${node.symbol} · ${node.titleRu || node.title}`,
        subtitle: node.dimension,
        subtitleRu: node.dimension,
      });
    });

    // 5. Licensed Framed Artwork on East Wall (§4.1 & §9)
    const artworks = artManifestData.artworks.filter(
      (a) => a.branch === branch
    );
    const art = artworks[(segment - 1) % artworks.length];
    if (art) {
      const artGroup = new THREE.Group();
      artGroup.position.set(halfW - 0.1, 2.5, 3.8);
      artGroup.rotation.y = -Math.PI * 0.5;

      const frame = new THREE.Mesh(
        new THREE.BoxGeometry(2.9, 1.65, 0.12),
        heroTrimMat
      );
      artGroup.add(frame);

      const fallbackTex = createProceduralArtworkTexture(
        art.title,
        art.author,
        art.license,
        art.motif,
        accentHex
      );
      const canvasMat = new THREE.MeshBasicMaterial({ map: fallbackTex });
      if (art.url && art.url.startsWith('http')) {
        const loader = new THREE.TextureLoader();
        loader.setCrossOrigin('anonymous');
        loader.load(art.url, (loadedTex) => {
          loadedTex.colorSpace = THREE.SRGBColorSpace;
          loadedTex.generateMipmaps = true;
          canvasMat.map = loadedTex;
          canvasMat.needsUpdate = true;
        });
      }
      const canvasMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(2.65, 1.4),
        canvasMat
      );
      canvasMesh.position.z = 0.07;
      artGroup.add(canvasMesh);

      root.add(artGroup);
      registerTarget(artGroup, {
        id: art.id,
        kind: 'artwork',
        roomId: (art as { roomId?: string }).roomId ?? 'ROOM_001',
        title: art.title,
        titleRu: art.titleRu || art.title,
        subtitle: art.author,
        subtitleRu: art.author,
      });
    }

    // 6. North Portal: Segment Transition
    const nextSeg: 1 | 2 = segment === 1 ? 2 : 1;
    const northPortal = new THREE.Group();
    northPortal.position.set(0, 0, -halfD + 0.25);

    const nArch = new THREE.Mesh(
      new THREE.BoxGeometry(3.6, 4.4, 0.35),
      heroTrimMat
    );
    nArch.position.y = 2.2;
    northPortal.add(nArch);

    const nPlaqueTex = createSignageTexture(
      nextSeg === 2 ? 'II' : 'I',
      `${branch.toUpperCase()} ${nextSeg}`,
      `SEGMENT ${nextSeg}`,
      'PORTAL',
      accentHex,
      '#f3ede2'
    );
    const nPlaque = new THREE.Mesh(
      new THREE.PlaneGeometry(2.4, 1.2),
      new THREE.MeshBasicMaterial({ map: nPlaqueTex })
    );
    nPlaque.position.set(0, 5.0, 0.25);
    northPortal.add(nPlaque);

    root.add(northPortal);
    registerTarget(northPortal, {
      id: `PORTAL_SEG_${nextSeg}`,
      kind: 'segment-portal',
      branch,
      segment: nextSeg,
      title: `${branch.toUpperCase()} · ${nextSeg}`,
      titleRu: `${branch === 'ascend' ? 'ВОСХОЖДЕНИЕ' : 'НИСХОЖДЕНИЕ'} · ${nextSeg}`,
      subtitle: '',
      subtitleRu: '',
    });

    // 7. South Portal: Return to Threshold
    const southPortal = new THREE.Group();
    southPortal.position.set(0, 0, halfD - 0.25);
    southPortal.rotation.y = Math.PI;

    const sArch = new THREE.Mesh(
      new THREE.BoxGeometry(3.2, 4.0, 0.35),
      wallLambertMat
    );
    sArch.position.y = 2.0;
    southPortal.add(sArch);

    const sPlaqueTex = createSignageTexture(
      '↺',
      'THRESHOLD',
      'ATRIUM',
      'HUB',
      accentHex,
      '#d8cfc0'
    );
    const sPlaque = new THREE.Mesh(
      new THREE.PlaneGeometry(2.2, 1.1),
      new THREE.MeshBasicMaterial({ map: sPlaqueTex })
    );
    sPlaque.position.set(0, 4.6, 0.25);
    southPortal.add(sPlaque);

    root.add(southPortal);
    registerTarget(southPortal, {
      id: 'PORTAL_THRESHOLD',
      kind: 'corridor-return',
      title: '↺ THRESHOLD',
      titleRu: '↺ ПОРОГ',
      subtitle: '',
      subtitleRu: '',
    });
  }
}
