import * as THREE from 'three';
import worldGraphData from '../../content/world.graph.json';
import artManifestData from '../../content/art/manifest.json';
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
  status?: 'ready' | 'planned';
}

export function getWorldNodes(): WorldGraphNode[] {
  return (worldGraphData.nodes as WorldGraphNode[]) ?? [];
}

export function createSignageTexture(
  symbol: string,
  title: string,
  subtitle: string,
  statusBadge: string,
  accentHex: string,
  badgeHex: string
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 220;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#0e0d0b';
  ctx.fillRect(0, 0, 640, 220);

  ctx.strokeStyle = accentHex;
  ctx.lineWidth = 5;
  ctx.strokeRect(6, 6, 628, 208);

  // Symbol medallion box on left
  ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
  ctx.fillRect(22, 24, 130, 172);
  ctx.strokeStyle = accentHex;
  ctx.lineWidth = 2;
  ctx.strokeRect(22, 24, 130, 172);

  ctx.fillStyle = accentHex;
  ctx.font = '700 36px "Cinzel", Georgia, serif';
  ctx.textAlign = 'center';
  ctx.fillText(symbol.slice(0, 6), 87, 122);

  // Title & Subtitle on right
  ctx.textAlign = 'left';
  ctx.fillStyle = '#f3ede2';
  ctx.font = '600 25px "Cinzel", Georgia, serif';
  ctx.fillText(title.slice(0, 28), 174, 74);

  ctx.fillStyle = '#bfb6a6';
  ctx.font = '400 18px system-ui, sans-serif';
  ctx.fillText(subtitle.slice(0, 42), 174, 116);

  // Status Indicator Pill (UNVISITED / VISITED / COMPLETED / SEALED)
  ctx.fillStyle = badgeHex;
  ctx.font = '600 16px monospace';
  ctx.fillText(`● ${statusBadge}`, 174, 166);

  return new THREE.CanvasTexture(canvas);
}

function createProceduralArtworkTexture(
  title: string,
  author: string,
  license: string,
  motif: string,
  accentHex: string
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 768;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createRadialGradient(384, 240, 30, 384, 256, 420);
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
  ctx.fillRect(0, 0, 768, 512);

  ctx.strokeStyle = accentHex;
  ctx.lineWidth = 2.5;

  for (let i = 1; i <= 6; i++) {
    const r = i * 32;
    ctx.beginPath();
    ctx.arc(384, 225, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeRect(384 - r * 1.35, 225 - r * 0.85, r * 2.7, r * 1.7);
  }

  ctx.fillStyle = '#f3ede2';
  ctx.font = '600 22px "Cinzel", Georgia, serif';
  ctx.textAlign = 'center';
  ctx.fillText(title, 384, 452);

  ctx.fillStyle = accentHex;
  ctx.font = '400 15px system-ui, sans-serif';
  ctx.fillText(`${author} · ${license}`, 384, 480);

  return new THREE.CanvasTexture(canvas);
}

/**
 * Builds the Threshold Hall (vast vertical atrium where the player physically chooses
 * UP — Ascent or DOWN — Descent) and the chunked Corridor Segments (AGENTS.md §4A).
 * Uses InstancedMesh for colonnades to stay well within the Quest 2 72fps budget (<150 draw calls).
 */
export class CorridorBuilder {
  /**
   * Builds the Threshold Hall (§4A.1 - §4A.3).
   */
  public static buildThresholdHall(
    root: THREE.Group,
    scene: THREE.Scene,
    state: HubPlayerState,
    registerTarget: (mesh: THREE.Object3D, target: SpatialInteractiveTarget) => void,
    walkableMeshes: THREE.Object3D[]
  ): void {
    scene.background = new THREE.Color('#0c0b0a');
    scene.fog = new THREE.FogExp2('#0c0b0a', 0.018);

    // Lighting: Warm Ascent key light above + Cool Descent abyss light below
    const hemi = new THREE.HemisphereLight('#f5e4c3', '#142434', 0.75);
    root.add(hemi);

    const ascentLight = new THREE.PointLight('#ffd88a', 45, 42, 1.3);
    ascentLight.position.set(-5, 11, -6);
    root.add(ascentLight);

    const descentLight = new THREE.PointLight('#4da6ff', 36, 40, 1.35);
    descentLight.position.set(5, -6, -6);
    root.add(descentLight);

    const stoneMat = new THREE.MeshStandardMaterial({
      color: '#1e1b18',
      roughness: 0.55,
      metalness: 0.18,
    });
    const darkBasaltMat = new THREE.MeshStandardMaterial({
      color: '#12161c',
      roughness: 0.42,
      metalness: 0.28,
    });
    const goldMat = new THREE.MeshStandardMaterial({
      color: '#c8a464',
      roughness: 0.28,
      metalness: 0.82,
    });
    const cyanMat = new THREE.MeshStandardMaterial({
      color: '#4ea8de',
      roughness: 0.25,
      metalness: 0.78,
      emissive: '#183a54',
      emissiveIntensity: 0.5,
    });

    // 1. Central Threshold Bridge Platform (y = 0, walkable)
    const bridgeFloor = new THREE.Mesh(
      new THREE.BoxGeometry(22, 0.5, 24),
      stoneMat
    );
    bridgeFloor.position.set(0, -0.25, 0);
    root.add(bridgeFloor);
    walkableMeshes.push(bridgeFloor);

    // Inlaid Compass Medallion at Player Spawn (0, 0.01, 4)
    const spawnRing = new THREE.Mesh(
      new THREE.RingGeometry(1.4, 1.55, 48),
      goldMat
    );
    spawnRing.rotation.x = -Math.PI * 0.5;
    spawnRing.position.set(0, 0.01, 2.5);
    root.add(spawnRing);

    // 2. Vast Vertical Atrium Enclosure & Instanced Colonnade (24 columns in 1 single draw call!)
    const colGeo = new THREE.CylinderGeometry(0.45, 0.52, 24, 16);
    const colInst = new THREE.InstancedMesh(colGeo, stoneMat, 16);
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
    root.add(colInst);

    // Upper Celestial Oculus Vault (y = +16m)
    const upperVault = new THREE.Mesh(
      new THREE.RingGeometry(3.2, 12.0, 48),
      stoneMat
    );
    upperVault.rotation.x = Math.PI * 0.5;
    upperVault.position.set(0, 15.5, -2);
    root.add(upperVault);

    const oculusSun = new THREE.Mesh(
      new THREE.CircleGeometry(3.2, 40),
      new THREE.MeshBasicMaterial({
        color: '#fff0c2',
        side: THREE.DoubleSide,
      })
    );
    oculusSun.rotation.x = Math.PI * 0.5;
    oculusSun.position.set(0, 15.45, -2);
    root.add(oculusSun);

    // 3. LEFT-NORTH PATH: UP — ASCENT (Grow / Embody · Воплощать / Расти)
    const ascentGroup = new THREE.Group();
    ascentGroup.position.set(-4.6, 0, -5.5);

    // Stepped Ascending Stairway & Lift Dais (Grounded at y = 0, rising to y = 1.2)
    for (let s = 0; s < 5; s++) {
      const step = new THREE.Mesh(
        new THREE.BoxGeometry(4.4, 0.24, 0.9),
        stoneMat
      );
      step.position.set(0, 0.12 + s * 0.24, 2.4 - s * 0.75);
      ascentGroup.add(step);
    }

    const ascentDais = new THREE.Mesh(
      new THREE.CylinderGeometry(2.3, 2.5, 0.36, 32),
      goldMat
    );
    ascentDais.position.set(0, 1.2, -1.6);
    ascentGroup.add(ascentDais);
    walkableMeshes.push(ascentDais);

    // Monumental Golden Arch above Ascent Dais
    [-1.9, 1.9].forEach((px) => {
      const pillar = new THREE.Mesh(
        new THREE.BoxGeometry(0.42, 4.8, 0.42),
        goldMat
      );
      pillar.position.set(px, 3.6, -1.6);
      ascentGroup.add(pillar);
    });
    const ascentLintel = new THREE.Mesh(
      new THREE.BoxGeometry(4.6, 0.55, 0.55),
      goldMat
    );
    ascentLintel.position.set(0, 6.1, -1.6);
    ascentGroup.add(ascentLintel);

    const ascentPlaqueTex = createSignageTexture(
      '▲ UP',
      'ASCENT · ВОСХОЖДЕНИЕ',
      'Grow · Embody (Воплощать, Расти) → 2 Segments',
      state.path === 'ascend' ? 'ACTIVE PATH (CHOSEN)' : 'STEP OR CLICK TO ASCEND',
      '#c8a464',
      '#f0d27a'
    );
    const ascentPlaque = new THREE.Mesh(
      new THREE.PlaneGeometry(3.5, 1.2),
      new THREE.MeshBasicMaterial({ map: ascentPlaqueTex })
    );
    ascentPlaque.position.set(0, 4.3, -1.3);
    ascentGroup.add(ascentPlaque);

    root.add(ascentGroup);
    registerTarget(ascentGroup, {
      id: 'THRESHOLD_ASCENT',
      kind: 'threshold-branch',
      branch: 'ascend',
      title: 'UP — ASCENT (Grow / Embody)',
      titleRu: 'ВВЕРХ — ВОСХОЖДЕНИЕ (Воплощать / Расти)',
      subtitle: 'Enter Ascent Branch · Segment 1',
      subtitleRu: 'Войти в Ветвь Восхождения · Сегмент 1',
    });

    // 4. RIGHT-NORTH PATH: DOWN — DESCENT (Search / Explore · Искать / Исследовать)
    const descentGroup = new THREE.Group();
    descentGroup.position.set(4.6, 0, -5.5);

    // Stepped Descending Basalt Terrace & Abyssal Lift Platform
    for (let s = 0; s < 4; s++) {
      const step = new THREE.Mesh(
        new THREE.BoxGeometry(4.4, 0.24, 0.9),
        darkBasaltMat
      );
      step.position.set(0, 0.12 + (3 - s) * 0.12, 2.1 - s * 0.75);
      descentGroup.add(step);
    }

    const descentDais = new THREE.Mesh(
      new THREE.CylinderGeometry(2.3, 2.5, 0.36, 32),
      cyanMat
    );
    descentDais.position.set(0, 0.18, -1.6);
    descentGroup.add(descentDais);
    walkableMeshes.push(descentDais);

    [-1.9, 1.9].forEach((px) => {
      const pillar = new THREE.Mesh(
        new THREE.BoxGeometry(0.42, 4.8, 0.42),
        darkBasaltMat
      );
      pillar.position.set(px, 2.6, -1.6);
      descentGroup.add(pillar);
    });
    const descentLintel = new THREE.Mesh(
      new THREE.BoxGeometry(4.6, 0.55, 0.55),
      cyanMat
    );
    descentLintel.position.set(0, 5.1, -1.6);
    descentGroup.add(descentLintel);

    const descentPlaqueTex = createSignageTexture(
      '▼ DN',
      'DESCENT · НИСХОЖДЕНИЕ',
      'Search · Explore (Искать, Исследовать) → 2 Segments',
      state.path === 'descend'
        ? 'ACTIVE PATH (CHOSEN)'
        : 'STEP OR CLICK TO DESCEND',
      '#4ea8de',
      '#7cc6f2'
    );
    const descentPlaque = new THREE.Mesh(
      new THREE.PlaneGeometry(3.5, 1.2),
      new THREE.MeshBasicMaterial({ map: descentPlaqueTex })
    );
    descentPlaque.position.set(0, 3.3, -1.3);
    descentGroup.add(descentPlaque);

    root.add(descentGroup);
    registerTarget(descentGroup, {
      id: 'THRESHOLD_DESCENT',
      kind: 'threshold-branch',
      branch: 'descend',
      title: 'DOWN — DESCENT (Search / Explore)',
      titleRu: 'ВНИЗ — НИСХОЖДЕНИЕ (Искать / Исследовать)',
      subtitle: 'Enter Descent Branch · Segment 1',
      subtitleRu: 'Войти в Ветвь Нисхождения · Сегмент 1',
    });
  }

  /**
   * Builds a chunked Corridor Segment (`ascend` or `descend`, Segment 1 or 2) with
   * instanced architecture, licensed artworks, segment portals, and grounded doors with plaques (§4A.4 - §4A.5).
   */
  public static buildCorridorSegment(
    root: THREE.Group,
    scene: THREE.Scene,
    branch: CorridorBranch,
    segment: 1 | 2,
    state: HubPlayerState,
    registerTarget: (mesh: THREE.Object3D, target: SpatialInteractiveTarget) => void,
    walkableMeshes: THREE.Object3D[]
  ): void {
    const isAscent = branch === 'ascend';
    const bgHex = isAscent ? '#12100d' : '#080c12';
    const accentHex = isAscent ? '#c8a464' : '#4ea8de';

    scene.background = new THREE.Color(bgHex);
    scene.fog = new THREE.FogExp2(bgHex, 0.02);

    const hemi = new THREE.HemisphereLight(
      isAscent ? '#fff0d4' : '#99ccff',
      isAscent ? '#1f1a14' : '#0a1018',
      0.78
    );
    root.add(hemi);

    const centerLight = new THREE.PointLight(
      isAscent ? '#ffe2a8' : '#5cb8ff',
      38,
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

    const wallMat = new THREE.MeshStandardMaterial({
      color: isAscent ? '#221e19' : '#121922',
      roughness: 0.62,
      metalness: 0.14,
    });
    const floorMat = new THREE.MeshStandardMaterial({
      color: isAscent ? '#191612' : '#0d131a',
      roughness: 0.26,
      metalness: 0.2,
    });
    const trimMat = new THREE.MeshStandardMaterial({
      color: accentHex,
      roughness: 0.28,
      metalness: 0.8,
    });

    // 1. Walkable Polished Corridor Floor (y = 0)
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(width, depth),
      floorMat
    );
    floor.rotation.x = -Math.PI * 0.5;
    root.add(floor);
    walkableMeshes.push(floor);

    // Central Longitudinal Guide Strip on Floor
    const runner = new THREE.Mesh(
      new THREE.PlaneGeometry(1.4, depth - 2),
      trimMat
    );
    runner.rotation.x = -Math.PI * 0.5;
    runner.position.y = 0.005;
    root.add(runner);

    // 2. Ceiling & Side Walls
    const ceiling = new THREE.Mesh(
      new THREE.PlaneGeometry(width, depth),
      wallMat
    );
    ceiling.rotation.x = Math.PI * 0.5;
    ceiling.position.y = height;
    root.add(ceiling);

    [-halfW, halfW].forEach((wx) => {
      const sideWall = new THREE.Mesh(
        new THREE.PlaneGeometry(depth, height),
        wallMat
      );
      sideWall.rotation.y = wx < 0 ? Math.PI * 0.5 : -Math.PI * 0.5;
      sideWall.position.set(wx, height * 0.5, 0);
      root.add(sideWall);
    });

    [-halfD, halfD].forEach((wz) => {
      const endWall = new THREE.Mesh(
        new THREE.PlaneGeometry(width, height),
        wallMat
      );
      endWall.rotation.y = wz < 0 ? 0 : Math.PI;
      endWall.position.set(0, height * 0.5, wz);
      root.add(endWall);
    });

    // 3. Instanced Colonnade Pillars (12 columns = 1 draw call)
    const colGeo = new THREE.CylinderGeometry(0.38, 0.44, height, 16);
    const colInst = new THREE.InstancedMesh(colGeo, wallMat, 12);
    const dummy = new THREE.Object3D();
    let cIdx = 0;
    for (let side = -1; side <= 1; side += 2) {
      for (let iz = -2; iz <= 3; iz++) {
        dummy.position.set(side * (halfW - 2.1), height * 0.5, iz * 4.0 - 2.0);
        dummy.updateMatrix();
        colInst.setMatrixAt(cIdx++, dummy.matrix);
      }
    }
    colInst.instanceMatrix.needsUpdate = true;
    root.add(colInst);

    // 4. Doors for this Branch & Segment from content/world.graph.json
    const segmentNodes = getWorldNodes().filter(
      (n) => n.branch === branch && n.segment === segment
    );

    // Position the 3 segment doors grounded at y = 0 along West, East, and North-West walls
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
        ? 'SEALED (PLANNED)'
        : isCompleted
        ? 'COMPLETED'
        : isVisited
        ? 'VISITED'
        : 'UNVISITED';

      const statusColor = isPlanned
        ? '#7a7a7a'
        : isCompleted
        ? '#66cc99'
        : isVisited
        ? '#6fa8dc'
        : accentHex;

      const dGroup = new THREE.Group();
      dGroup.position.set(slot.x, 0, slot.z);
      dGroup.rotation.y = slot.rotY;

      // Grounded Stone Threshold & Frame (y = 0 .. 3.8)
      const step = new THREE.Mesh(
        new THREE.BoxGeometry(2.8, 0.16, 0.6),
        wallMat
      );
      step.position.set(0, 0.08, 0.22);
      dGroup.add(step);

      [-1.15, 1.15].forEach((jx) => {
        const jamb = new THREE.Mesh(
          new THREE.BoxGeometry(0.28, 3.8, 0.42),
          trimMat
        );
        jamb.position.set(jx, 1.9, 0.18);
        dGroup.add(jamb);
      });

      const lintel = new THREE.Mesh(
        new THREE.BoxGeometry(2.9, 0.45, 0.5),
        trimMat
      );
      lintel.position.set(0, 3.95, 0.22);
      dGroup.add(lintel);

      const leafMat = new THREE.MeshStandardMaterial({
        color: isPlanned ? '#1b1b1d' : isAscent ? '#2b2216' : '#102030',
        roughness: isPlanned ? 0.7 : 0.3,
        metalness: 0.6,
      });
      const leaf = new THREE.Mesh(
        new THREE.BoxGeometry(2.1, 3.64, 0.16),
        leafMat
      );
      leaf.position.set(0, 0.16 + 1.82, 0.12);
      dGroup.add(leaf);

      // Door Plaque with Symbol, Name, Dimension & State Indicator (§4A.5)
      const plaqueTex = createSignageTexture(
        node.symbol,
        `${node.id} · ${node.title}`,
        `Dimension ${node.dimension} · ${branch.toUpperCase()} SEG ${segment}`,
        statusLabel,
        accentHex,
        statusColor
      );
      const plaque = new THREE.Mesh(
        new THREE.PlaneGeometry(2.45, 0.84),
        new THREE.MeshBasicMaterial({ map: plaqueTex })
      );
      plaque.position.set(0, 4.65, 0.28);
      dGroup.add(plaque);

      root.add(dGroup);
      registerTarget(dGroup, {
        id: `CORRIDOR_DOOR_${node.id}`,
        kind: 'corridor-door',
        roomId: node.id,
        status: node.status,
        title: `${node.symbol} · ${node.title} (${node.id})`,
        titleRu: `${node.symbol} · ${node.titleRu || node.title} (${node.id})`,
        subtitle: `${statusLabel} · Dimension ${node.dimension}`,
        subtitleRu: `${statusLabel} · Измерение ${node.dimension}`,
      });
    });

    // 5. Licensed Framed Artwork on East Wall (from content/art/manifest.json, §9)
    const artworks = artManifestData.artworks.filter((a) => a.branch === branch);
    const art = artworks[(segment - 1) % artworks.length];
    if (art) {
      const artGroup = new THREE.Group();
      artGroup.position.set(halfW - 0.1, 2.5, 3.8);
      artGroup.rotation.y = -Math.PI * 0.5;

      const frame = new THREE.Mesh(
        new THREE.BoxGeometry(2.9, 2.0, 0.12),
        trimMat
      );
      artGroup.add(frame);

      const artTex = createProceduralArtworkTexture(
        art.title,
        art.author,
        art.license,
        art.motif,
        accentHex
      );
      const canvasMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(2.65, 1.75),
        new THREE.MeshBasicMaterial({ map: artTex })
      );
      canvasMesh.position.z = 0.07;
      artGroup.add(canvasMesh);

      root.add(artGroup);
      registerTarget(artGroup, {
        id: art.id,
        kind: 'artwork',
        title: art.title,
        titleRu: art.titleRu || art.title,
        subtitle: `${art.author} · ${art.license}`,
        subtitleRu: `${art.author} · ${art.license}`,
      });
    }

    // 6. North Portal: Segment Transition (Segment 1 → Segment 2, or Segment 2 → Segment 1)
    const nextSeg: 1 | 2 = segment === 1 ? 2 : 1;
    const northPortal = new THREE.Group();
    northPortal.position.set(0, 0, -halfD + 0.25);

    const nArch = new THREE.Mesh(
      new THREE.BoxGeometry(3.6, 4.4, 0.35),
      trimMat
    );
    nArch.position.y = 2.2;
    northPortal.add(nArch);

    const nPlaqueTex = createSignageTexture(
      `SEG ${nextSeg}`,
      `${branch.toUpperCase()} · SEGMENT ${nextSeg}`,
      `Proceed to ${branch.toUpperCase()} Segment ${nextSeg} (Chunked Load)`,
      'CORRIDOR TRANSITION',
      accentHex,
      '#f3ede2'
    );
    const nPlaque = new THREE.Mesh(
      new THREE.PlaneGeometry(2.8, 0.95),
      new THREE.MeshBasicMaterial({ map: nPlaqueTex })
    );
    nPlaque.position.set(0, 4.95, 0.25);
    northPortal.add(nPlaque);

    root.add(northPortal);
    registerTarget(northPortal, {
      id: `PORTAL_SEG_${nextSeg}`,
      kind: 'segment-portal',
      branch,
      segment: nextSeg,
      title: `${branch.toUpperCase()} · Segment ${nextSeg}`,
      titleRu: `${
        branch === 'ascend' ? 'ВОСХОЖДЕНИЕ' : 'НИСХОЖДЕНИЕ'
      } · Сегмент ${nextSeg}`,
      subtitle: 'Chunked Corridor Transition (Fade)',
      subtitleRu: 'Переход в следующий сегмент коридора',
    });

    // 7. South Portal: Return to Threshold Hall (at z = +halfD - 0.25)
    const southPortal = new THREE.Group();
    southPortal.position.set(0, 0, halfD - 0.25);
    southPortal.rotation.y = Math.PI;

    const sArch = new THREE.Mesh(
      new THREE.BoxGeometry(3.2, 4.0, 0.35),
      wallMat
    );
    sArch.position.y = 2.0;
    southPortal.add(sArch);

    const sPlaqueTex = createSignageTexture(
      '↺',
      'THE THRESHOLD ATRIUM',
      'Return to Central Vertical Threshold (Ascent / Descent)',
      'HUB ATRIUM',
      accentHex,
      '#d8cfc0'
    );
    const sPlaque = new THREE.Mesh(
      new THREE.PlaneGeometry(2.6, 0.9),
      new THREE.MeshBasicMaterial({ map: sPlaqueTex })
    );
    sPlaque.position.set(0, 4.55, 0.25);
    southPortal.add(sPlaque);

    root.add(southPortal);
    registerTarget(southPortal, {
      id: 'PORTAL_THRESHOLD',
      kind: 'corridor-return',
      title: 'Return to The Threshold Hall',
      titleRu: 'Вернуться в Центральный Порог (Атриум)',
      subtitle: 'Central Vertical Atrium (Up / Down Choice)',
      subtitleRu: 'Вертикальный атриум выбора пути',
    });
  }
}
