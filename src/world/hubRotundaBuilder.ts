/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';
import { HubPlayerState } from '../state/playerState';
import {
  SpatialInteractiveTarget,
  WorldGraphNode,
  getWorldNodes,
} from '../corridor/corridorBuilder';
import { nebulaSkySystem } from '../systems/sky/nebulaSkySystem';
import { resolveRoomNebulaMapping } from '../systems/sky/nebulaRegistry';
import { GpuParticleSystem } from '../systems/particles/gpuParticleSystem';

export interface PortalNodeUserData {
  id: string;
  roomId: string;
  symbol: string;
  title: string;
  dimension: string;
  accentHex: string;
  plasmaHex: string;
  visited: boolean;
  phaseSeed: number;
  baseRadius: number;
  irisScale: number;
  targetIrisScale: number;
  gazeIntensity: number;
  hovered: boolean;
}

/**
 * Procedural circular floor texture with concentric glowing circuit rings and radial rays.
 */
function createRotundaCosmicFloorTexture(accentHex: string, rimHex: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#05070c';
  ctx.fillRect(0, 0, 1024, 1024);

  const cx = 512;
  const cy = 512;

  // Concentric orbital guidance lines
  const rings = [96, 180, 280, 360, 440, 490];
  ctx.lineWidth = 2.5;
  rings.forEach((r, idx) => {
    ctx.strokeStyle = idx % 2 === 0 ? accentHex : rimHex;
    ctx.globalAlpha = 0.22 + (idx / rings.length) * 0.15;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
  });

  // 25 Radial guidance rays leading outward towards the 25 portal nodes
  const totalRays = 25;
  ctx.lineWidth = 1.8;
  ctx.strokeStyle = accentHex;
  ctx.globalAlpha = 0.18;
  for (let i = 0; i < totalRays; i++) {
    const angle = (i / totalRays) * Math.PI * 2 - Math.PI * 0.5;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(angle) * 110, cy + Math.sin(angle) * 110);
    ctx.lineTo(cx + Math.cos(angle) * 495, cy + Math.sin(angle) * 495);
    ctx.stroke();
  }

  // Central sacred circle
  ctx.globalAlpha = 0.65;
  ctx.strokeStyle = accentHex;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(cx, cy, 96, 0, Math.PI * 2);
  ctx.stroke();

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.generateMipmaps = true;
  return tex;
}

/**
 * Creates a swirling dimensional event-horizon aperture texture (256x256)
 * with cosmic depth, nebula filaments, and zero concentric bullseye target rings.
 */
function createPortalEventHorizonTexture(
  accentHex: string,
  plasmaHex: string,
  visited: boolean
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  // Deep spatial void base
  ctx.fillStyle = '#03060f';
  ctx.fillRect(0, 0, 256, 256);

  // Swirling non-Euclidean event horizon (soft, cosmic, NO concentric bullseye rings!)
  const centerGrad = ctx.createRadialGradient(128, 128, 8, 128, 128, 122);
  const coreColor = visited ? '#12402d' : accentHex;
  const rimColor = visited ? '#0d2b1f' : plasmaHex;
  centerGrad.addColorStop(0, '#ffffffea');
  centerGrad.addColorStop(0.2, coreColor);
  centerGrad.addColorStop(0.55, rimColor);
  centerGrad.addColorStop(0.85, '#070c1c');
  centerGrad.addColorStop(1.0, '#020409');
  ctx.fillStyle = centerGrad;
  ctx.beginPath();
  ctx.arc(128, 128, 124, 0, Math.PI * 2);
  ctx.fill();

  // Subtle curved cosmic spiral filaments (galaxy vortex, NOT concentric target rings)
  ctx.lineWidth = 2.2;
  for (let arm = 0; arm < 3; arm++) {
    const baseAngle = (arm * Math.PI * 2) / 3;
    ctx.strokeStyle = `${coreColor}66`;
    ctx.beginPath();
    for (let t = 0; t <= 1; t += 0.04) {
      const r = 14 + t * 102;
      const a = baseAngle + t * 2.5;
      const x = 128 + Math.cos(a) * r;
      const y = 128 + Math.sin(a) * r;
      if (t === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.generateMipmaps = true;
  return tex;
}

/**
 * Creates a sleek curved pill-shaped sci-fi gateway telemetry badge (512x140)
 * with zero sharp square corners or box borders.
 */
function createSciFiNodeInterfaceTexture(
  symbol: string,
  numStr: string,
  accentHex: string,
  visited: boolean
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 140;
  const ctx = canvas.getContext('2d')!;

  ctx.clearRect(0, 0, 512, 140);

  const statusColor = visited ? '#66cc99' : accentHex;
  ctx.fillStyle = 'rgba(6, 10, 20, 0.92)';
  ctx.strokeStyle = statusColor;
  ctx.lineWidth = 3.5;

  // Elegant rounded pill container with zero box/square corners
  ctx.beginPath();
  ctx.roundRect(24, 12, 464, 116, 58);
  ctx.fill();
  ctx.stroke();

  // Title: GATEWAY [num] // [symbol]
  const glyph = symbol.split('·')[1] ?? symbol;
  ctx.fillStyle = '#ffffff';
  ctx.font = '700 32px "Cinzel", Georgia, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`GATEWAY ${numStr} // ${glyph}`, 256, 50);

  // Status: [LINK READY / ACTIVE]
  ctx.fillStyle = statusColor;
  ctx.font = '600 20px system-ui, -apple-system, sans-serif';
  ctx.fillText(
    visited ? '● LINK ACTIVE · VISITED' : '▷ CONNECT // READY',
    256,
    92
  );

  const tex = new THREE.CanvasTexture(canvas);
  tex.generateMipmaps = true;
  return tex;
}

/**
 * Builds a Sci-Fi Gateway Connection Node (TZ v2 §4.2):
 * - Architectural titanium-obsidian stargate ring with clean clearance.
 * - Twin vertical pylon conduit housings anchoring the node (zero inward-pointing target pins!).
 * - Deep cosmic event-horizon vortex with spiral nebula depth (zero concentric target bullseye rings).
 * - Elegant curved pill telemetry badge matching the ring apex (zero square box borders).
 */
export function buildRoundPortalNode(opts: {
  x: number;
  y: number;
  z: number;
  rotY: number;
  node: WorldGraphNode;
  visited: boolean;
  accentHex: string;
  plasmaHex: string;
  phaseSeed: number;
}): THREE.Group {
  const { x, y, z, rotY, node, visited, accentHex, plasmaHex, phaseSeed } = opts;

  const group = new THREE.Group();
  group.name = `round_portal_${node.id}`;
  group.position.set(x, y, z);
  group.rotation.y = rotY;

  const outerRadius = 1.15;
  const tubeRadius = 0.085;
  const statusColor = visited ? '#66cc99' : accentHex;

  // 1. Sleek Structural Titanium Gateway Ring (No target crosshairs or concentric inner rings!)
  const frameGeo = new THREE.TorusGeometry(outerRadius, tubeRadius, 20, 64);
  const frameMat = new THREE.MeshStandardMaterial({
    color: visited ? '#152b22' : '#0a0e1a',
    roughness: 0.22,
    metalness: 0.88,
    emissive: visited ? '#0b2618' : '#070c18',
    emissiveIntensity: 0.4,
  });
  const frameMesh = new THREE.Mesh(frameGeo, frameMat);
  frameMesh.name = 'portal_torus_frame';
  group.add(frameMesh);

  // 2. Architectural Gateway Docking Pylons (Flanking columns anchoring the stargate to space/floor)
  const pylonGeo = new THREE.CylinderGeometry(0.065, 0.085, outerRadius * 1.3, 16);
  const pylonMat = new THREE.MeshStandardMaterial({
    color: '#121828',
    roughness: 0.28,
    metalness: 0.84,
  });
  const pylonBeaconMat = new THREE.MeshStandardMaterial({
    color: statusColor,
    roughness: 0.1,
    metalness: 0.5,
    emissive: statusColor,
    emissiveIntensity: 0.85,
  });

  [-outerRadius * 0.98, outerRadius * 0.98].forEach((sideX, pIdx) => {
    const pylon = new THREE.Mesh(pylonGeo, pylonMat);
    pylon.name = `portal_pylon_${pIdx}`;
    pylon.position.set(sideX, -outerRadius * 0.45, 0);
    group.add(pylon);

    // Glowing status conduit stripe
    const pylonCap = new THREE.Mesh(
      new THREE.SphereGeometry(0.085, 16, 16),
      pylonBeaconMat
    );
    pylonCap.position.set(sideX, -outerRadius * 0.45 + outerRadius * 0.65, 0.02);
    group.add(pylonCap);
  });

  // 3. Dimensional Event-Horizon Vortex Window (Deep swirling nebula rift — ZERO bullseye rings!)
  const windowRadius = outerRadius - 0.06;
  const windowGeo = new THREE.CircleGeometry(windowRadius, 48);
  const windowTex = createPortalEventHorizonTexture(accentHex, plasmaHex, visited);
  const windowMat = new THREE.MeshBasicMaterial({
    map: windowTex,
    transparent: true,
    opacity: 0.92,
    side: THREE.FrontSide,
  });
  const windowMesh = new THREE.Mesh(windowGeo, windowMat);
  windowMesh.name = 'portal_window_aperture';
  windowMesh.position.z = -0.02;
  group.add(windowMesh);

  // 4. Sleek Sci-Fi Curved Pill Telemetry Badge above portal apex (zero square box borders)
  const numMatch = node.id.match(/\d+/);
  const numStr = numMatch ? numMatch[0] : '01';
  const nodePlateTex = createSciFiNodeInterfaceTexture(
    node.symbol,
    numStr,
    accentHex,
    visited
  );
  const plateGeo = new THREE.PlaneGeometry(1.6, 0.44);
  const plateMat = new THREE.MeshBasicMaterial({
    map: nodePlateTex,
    transparent: true,
    opacity: 0.95,
    side: THREE.FrontSide,
  });
  const plateMesh = new THREE.Mesh(plateGeo, plateMat);
  plateMesh.name = 'portal_glyph_badge';
  plateMesh.position.set(0, outerRadius + 0.38, 0.05);
  group.add(plateMesh);

  group.userData = {
    id: `HUB_PORTAL_${node.id}`,
    roomId: node.id,
    symbol: node.symbol,
    title: node.title,
    dimension: node.dimension,
    accentHex,
    plasmaHex,
    visited,
    phaseSeed,
    baseRadius: outerRadius,
    irisScale: 1.0,
    targetIrisScale: 1.0,
    gazeIntensity: 0.0,
    hovered: false,
  } as PortalNodeUserData;

  return group;
}

/**
 * Builds the complete Curvilinear Hub Rotunda Dome + 25 Round Portal Nodes (TZ v2 §4):
 * - Circular basalt floor with concentric glowing rings and 25 radial rays.
 * - Smooth cylindrical/dome walls (minimum 96 radial segments, zero straight corners).
 * - Central slowly breathing orientation beacon (luminous ring cluster & sphere).
 * - 25 Round Portal Nodes positioned around the circular shell.
 * - Open zenith framing the astronomical nebula sky.
 */
export function buildHubRotunda(opts: {
  root: THREE.Group;
  scene: THREE.Scene;
  state: HubPlayerState;
  registerTarget: (mesh: THREE.Object3D, target: SpatialInteractiveTarget) => void;
  walkableMeshes: THREE.Object3D[];
}): { update: (dt: number, timeSec: number, playerPose: { x: number; y: number; z: number }) => void } {
  const { root, scene, state, registerTarget, walkableMeshes } = opts;

  // Mount Sky: NEB_0001 (Carina Nebula Cosmic Cliffs)
  const skyRig = nebulaSkySystem.mountRoomSkyAndLighting('HUB_ROTUNDA', root, scene, {
    nebulaId: 'NEB_0001',
    intensity: 1.15,
    ambientScale: 0.55,
    fogScale: 0.9,
    qualityTier: state.comfort.qualityTier,
    reducedMotion: state.comfort.reducedMotion,
  });

  const accentHex = skyRig.palette[0] ?? '#e5c158';
  const plasmaHex = skyRig.palette[1] ?? '#9d4edd';
  const rimHex = skyRig.palette[2] ?? '#4ea8de';

  const rotundaRadius = 15.2;
  const rotundaHeight = 9.8;

  // 1. Walkable Circular Dark Basalt Floor (y = 0, 96 segments for silky smooth curvature)
  const floorTex = createRotundaCosmicFloorTexture(accentHex, rimHex);
  const floorGeo = new THREE.CylinderGeometry(rotundaRadius, rotundaRadius * 1.02, 0.4, 96);
  const floorMat = new THREE.MeshStandardMaterial({
    map: floorTex,
    color: '#080c16',
    roughness: 0.16,
    metalness: 0.65,
  });
  const floorMesh = new THREE.Mesh(floorGeo, floorMat);
  floorMesh.position.y = -0.2;
  root.add(floorMesh);
  walkableMeshes.push(floorMesh);

  // Inlaid Golden Halo Starting Ring marking player spawn
  const spawnHaloGeo = new THREE.RingGeometry(0.75, 0.92, 48);
  const spawnHaloMat = new THREE.MeshStandardMaterial({
    color: '#e5c158',
    emissive: '#d4af37',
    emissiveIntensity: 0.65,
    roughness: 0.18,
    metalness: 0.88,
    side: THREE.DoubleSide,
  });
  const spawnHalo = new THREE.Mesh(spawnHaloGeo, spawnHaloMat);
  spawnHalo.name = 'hub_spawn_halo';
  spawnHalo.rotation.x = -Math.PI * 0.5;
  spawnHalo.position.set(0, 0.02, 0);
  root.add(spawnHalo);

  // 2. Smooth Circular Dome Rotunda Wall (96 segments, zero corners, Curvature Law §5)
  const wallGeo = new THREE.CylinderGeometry(rotundaRadius, rotundaRadius, rotundaHeight, 96, 1, true);
  const wallMat = new THREE.MeshStandardMaterial({
    color: '#060912',
    roughness: 0.45,
    metalness: 0.4,
    side: THREE.BackSide,
  });
  const wallMesh = new THREE.Mesh(wallGeo, wallMat);
  wallMesh.position.y = rotundaHeight * 0.5;
  root.add(wallMesh);

  // 3. Curved Upper Torus Cornice Framing Open Zenith (Nebula Sky)
  const corniceGeo = new THREE.TorusGeometry(rotundaRadius * 0.98, 0.28, 16, 96);
  const corniceMat = new THREE.MeshStandardMaterial({
    color: accentHex,
    roughness: 0.2,
    metalness: 0.85,
    emissive: rimHex,
    emissiveIntensity: 0.35,
  });
  const cornice = new THREE.Mesh(corniceGeo, corniceMat);
  cornice.rotation.x = Math.PI * 0.5;
  cornice.position.y = rotundaHeight - 0.15;
  root.add(cornice);

  // 4. Central Slowly Breathing Light Beacon (orienting the eye, TZ v2 §4.1)
  const beaconGroup = new THREE.Group();
  beaconGroup.name = 'hub_central_beacon';
  beaconGroup.position.set(0, 2.4, 0);

  const beaconSphereGeo = new THREE.SphereGeometry(0.42, 32, 24);
  const beaconSphereMat = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    emissive: accentHex,
    emissiveIntensity: 0.95,
    roughness: 0.1,
    metalness: 0.2,
  });
  const beaconSphere = new THREE.Mesh(beaconSphereGeo, beaconSphereMat);
  beaconSphere.name = 'beacon_core_sphere';
  beaconGroup.add(beaconSphere);

  // 2 Intersecting Gilded Rings around beacon core
  const bRing1 = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.035, 12, 36), corniceMat);
  bRing1.name = 'beacon_ring_1';
  beaconGroup.add(bRing1);

  const bRing2 = new THREE.Mesh(new THREE.TorusGeometry(0.92, 0.03, 12, 40), corniceMat);
  bRing2.name = 'beacon_ring_2';
  bRing2.rotation.x = Math.PI * 0.4;
  beaconGroup.add(bRing2);

  root.add(beaconGroup);

  // 5. GPU-Driven Celestial Atmospheric Particles around Rotunda
  const gpuParticles = new GpuParticleSystem({
    particleCount: 220,
    radiusX: rotundaRadius - 1.8,
    radiusZ: rotundaRadius - 1.8,
    minY: 0.8,
    maxY: rotundaHeight - 1.5,
    baseColor: new THREE.Color(accentHex),
    accentColor: new THREE.Color(plasmaHex),
  });
  root.add(gpuParticles.points);

  // 6. 25 Round Volumetric Portal Nodes (§4.2 & §4.3 Layout Generator)
  const allNodes = getWorldNodes();
  // Filter ready room nodes (ROOM_001 .. ROOM_025)
  const roomNodes = allNodes.filter((n) => /^ROOM_\d+$/i.test(n.id)).slice(0, 25);
  const totalPortals = roomNodes.length;

  const portalGroups: THREE.Group[] = [];

  roomNodes.forEach((node, index) => {
    // Golden spiral / concentric shell distribution (TZ v2 §4.3)
    const angle = (index / totalPortals) * Math.PI * 2 - Math.PI * 0.5;
    const shellRadius = rotundaRadius - 1.25; // 13.95m
    const heightTier = index % 2 === 0 ? 2.1 : 2.5; // Slight alternating height for organic architectural rhythm
    const px = Math.cos(angle) * shellRadius;
    const pz = Math.sin(angle) * shellRadius;
    const rotY = Math.atan2(-px, -pz); // Facing directly inward towards player at center

    const resolvedNeb = resolveRoomNebulaMapping(node.id);
    const pAccent = resolvedNeb.nebula.palette[0] ?? accentHex;
    const pPlasma = resolvedNeb.nebula.palette[1] ?? plasmaHex;
    const isVisited = state.visitedRooms.includes(node.id);

    const portal = buildRoundPortalNode({
      x: px,
      y: heightTier,
      z: pz,
      rotY,
      node,
      visited: isVisited,
      accentHex: pAccent,
      plasmaHex: pPlasma,
      phaseSeed: index * 1.618,
    });

    root.add(portal);
    portalGroups.push(portal);

    registerTarget(portal, {
      id: `HUB_PORTAL_${node.id}`,
      kind: 'corridor-door',
      roomId: node.id,
      title: `${node.symbol} · ${node.title}`,
      titleRu: `${node.symbol} · ${node.titleRu ?? node.title}`,
      subtitle: `${node.dimension} · Round Portal Node`,
      subtitleRu: `${node.dimension} · Round Portal Node`,
    });
  });

  return {
    update: (dt: number, timeSec: number, playerPose: { x: number; y: number; z: number }) => {
      // 1. Central Beacon Breathing
      const breathe = Math.sin(timeSec * 0.8) * 0.15;
      beaconSphere.scale.setScalar(1.0 + breathe * 0.1);
      bRing1.rotation.y += 0.25 * dt;
      bRing2.rotation.z -= 0.3 * dt;
      bRing2.rotation.x += 0.15 * dt;

      // 2. Halo Floor Pulse
      const haloPulse = 0.5 + Math.sin(timeSec * 1.4) * 0.2;
      spawnHaloMat.emissiveIntensity = haloPulse;

      // 3. GPU Particles Update (zero per-frame CPU allocation)
      gpuParticles.update(timeSec, { energy: 0.4 + breathe * 0.2 });

      // 4. Portal Node Reactive Behaviors (P2: gaze & proximity reaction, TZ v2 §4.2)
      portalGroups.forEach((pg) => {
        const u = pg.userData as PortalNodeUserData;
        if (!u) return;

        // Gentle rotation of the event horizon aperture rift
        const aperture = pg.getObjectByName('portal_window_aperture');
        if (aperture) {
          aperture.rotation.z += 0.18 * dt;
        }

        // Distance from player
        const dx = pg.position.x - playerPose.x;
        const dz = pg.position.z - playerPose.z;
        const dist = Math.sqrt(dx * dx + dz * dz);

        // Proximity reaction: within 3.5m iris expands gently
        if (dist < 3.5) {
          const proxT = 1.0 - (dist / 3.5);
          u.targetIrisScale = 1.0 + proxT * 0.15;
        } else {
          u.targetIrisScale = 1.0;
        }

        // Smooth iris scale transition
        u.irisScale += (u.targetIrisScale - u.irisScale) * Math.min(1.0, dt * 5.0);
        pg.scale.setScalar(u.irisScale);
      });
    },
  };
}
