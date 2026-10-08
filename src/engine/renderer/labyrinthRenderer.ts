import * as THREE from 'three';
import {
  DoorDefinition,
  MirrorDefinition,
  PaintingDefinition,
  PlayerState,
  RoomManifest,
  RoomObjectDefinition,
  RoomRegistryManifest,
  VoidType,
} from '../../types/artmaze';
import { evaluateDoor } from '../../systems/doors/doorSystem';
import { observationSystem } from '../../systems/observation/observationSystem';
import { getActiveRoomObjects } from '../../systems/rooms/roomStateSystem';
import { getVoidDescriptor } from '../../world/void/voidSystem';
import { CameraPose } from '../locomotion/locomotionSystem';

export interface RaycastTarget {
  kind: 'door' | 'painting' | 'object' | 'mirror';
  id: string;
  title: string;
  titleRu?: string;
  subtitle?: string;
  subtitleRu?: string;
  distance: number;
  discoveryId?: string;
  door?: DoorDefinition;
  painting?: PaintingDefinition;
  object?: RoomObjectDefinition;
  mirror?: MirrorDefinition;
}

/**
 * Ensures any door, mirror, or wall-mounted element is flush with its nearest outer room wall
 * and grounded on y = 0 (for doors and mirrors) so nothing ever floats in mid-air.
 */
function resolveWallAnchoredPose(
  rawPos: [number, number, number] | undefined,
  rawRotY: number | undefined,
  halfW: number,
  halfD: number,
  groundY = 0
): {
  cx: number;
  cy: number;
  cz: number;
  rotY: number;
  normalX: number;
  normalZ: number;
} {
  const px = rawPos?.[0] ?? 0;
  const py = rawPos?.[1] ?? groundY;
  const pz = rawPos?.[2] ?? -halfD;
  const rot = rawRotY ?? 0;

  const normX = Math.sin(rot);
  const normZ = Math.cos(rot);

  let cx = px;
  let cz = pz;
  let finalRotY = rot;

  if (Math.abs(normX) > 0.7) {
    if (normX > 0) {
      // West wall (-halfW), normal pointing +X
      cx = -halfW + 0.02;
      cz = Math.max(-halfD + 1.8, Math.min(halfD - 1.8, pz));
      finalRotY = Math.PI * 0.5;
    } else {
      // East wall (+halfW), normal pointing -X
      cx = halfW - 0.02;
      cz = Math.max(-halfD + 1.8, Math.min(halfD - 1.8, pz));
      finalRotY = -Math.PI * 0.5;
    }
  } else {
    if (normZ >= 0) {
      // North wall (-halfD), normal pointing +Z
      cz = -halfD + 0.02;
      cx = Math.max(-halfW + 1.8, Math.min(halfW - 1.8, px));
      finalRotY = 0;
    } else {
      // South wall (+halfD), normal pointing -Z
      cz = halfD - 0.02;
      cx = Math.max(-halfW + 1.8, Math.min(halfW - 1.8, px));
      finalRotY = Math.PI;
    }
  }

  return {
    cx,
    cy: py,
    cz,
    rotY: finalRotY,
    normalX: Math.sin(finalRotY),
    normalZ: Math.cos(finalRotY),
  };
}

function createAshlarWallTexture(
  baseColor: string,
  accentColor: string
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = baseColor;
  ctx.fillRect(0, 0, 512, 512);

  const rows = 8;
  const cols = 4;
  const rowH = 512 / rows;
  const colW = 512 / cols;

  for (let r = 0; r < rows; r++) {
    const offset = (r % 2) * (colW * 0.5);
    for (let c = -1; c <= cols; c++) {
      const x = c * colW + offset;
      const y = r * rowH;
      const shade = 0.94 + ((r * 7 + c * 13) % 12) * 0.01;
      ctx.fillStyle = `rgba(255, 255, 255, ${(shade - 0.94) * 0.35})`;
      ctx.fillRect(x + 2, y + 2, colW - 4, rowH - 4);

      ctx.strokeStyle = 'rgba(0, 0, 0, 0.48)';
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, colW, rowH);
    }
  }

  // Architectural dado frieze line
  ctx.strokeStyle = accentColor;
  ctx.globalAlpha = 0.28;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, 456);
  ctx.lineTo(512, 456);
  ctx.stroke();

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 1.5);
  return tex;
}

function createPolishedFloorTexture(
  baseColor: string,
  accentColor: string
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = baseColor;
  ctx.fillRect(0, 0, 512, 512);

  const tiles = 4;
  const size = 512 / tiles;
  for (let ix = 0; ix < tiles; ix++) {
    for (let iz = 0; iz < tiles; iz++) {
      const isAlt = (ix + iz) % 2 === 0;
      ctx.fillStyle = isAlt
        ? 'rgba(255, 255, 255, 0.035)'
        : 'rgba(0, 0, 0, 0.14)';
      ctx.fillRect(ix * size, iz * size, size, size);

      ctx.strokeStyle = 'rgba(200, 164, 100, 0.22)';
      ctx.lineWidth = 2;
      ctx.strokeRect(ix * size, iz * size, size, size);
    }
  }

  // Subtle diagonal travertine veining
  ctx.strokeStyle = accentColor;
  ctx.globalAlpha = 0.09;
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 12; i++) {
    ctx.beginPath();
    ctx.moveTo((i * 67) % 512, 0);
    ctx.lineTo((i * 67 + 180) % 512, 512);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 4);
  return tex;
}

function createCofferedCeilingTexture(
  baseColor: string,
  accentColor: string
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = baseColor;
  ctx.fillRect(0, 0, 512, 512);

  const cells = 4;
  const s = 512 / cells;
  for (let x = 0; x < cells; x++) {
    for (let y = 0; y < cells; y++) {
      const cx = x * s;
      const cy = y * s;
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.lineWidth = 8;
      ctx.strokeRect(cx + 6, cy + 6, s - 12, s - 12);

      ctx.strokeStyle = accentColor;
      ctx.globalAlpha = 0.32;
      ctx.lineWidth = 2;
      ctx.strokeRect(cx + 16, cy + 16, s - 32, s - 32);
      ctx.globalAlpha = 1;
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 3);
  return tex;
}

function createPaintingArtworkTexture(
  painting: PaintingDefinition,
  motifIndex: number,
  mutated: boolean
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 768;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createRadialGradient(384, 230, 30, 384, 256, 420);
  if (mutated) {
    grad.addColorStop(0, '#1e3246');
    grad.addColorStop(0.6, '#0f1822');
    grad.addColorStop(1, '#070a0f');
  } else {
    grad.addColorStop(0, '#2c2217');
    grad.addColorStop(0.6, '#17130e');
    grad.addColorStop(1, '#0a0806');
  }
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 768, 512);

  ctx.strokeStyle = mutated ? '#7da2c4' : '#c8a464';
  ctx.lineWidth = 2.5;

  if (mutated) {
    for (let i = 1; i <= 6; i++) {
      const s = i * 48;
      ctx.save();
      ctx.translate(384, 240);
      ctx.rotate(i * 0.22);
      ctx.strokeRect(-s, -s * 0.7, s * 2, s * 1.4);
      ctx.restore();
    }
  } else if (motifIndex % 3 === 0) {
    for (let i = 1; i <= 6; i++) {
      const w = 310 - i * 42;
      const h = 190 - i * 24;
      ctx.strokeRect(384 - w, 250 - h, w * 2, h * 2);
      ctx.beginPath();
      ctx.arc(384, 250 - h * 0.3, w, Math.PI, 0);
      ctx.stroke();
    }
  } else if (motifIndex % 3 === 1) {
    ctx.beginPath();
    ctx.arc(384, 210, 110, 0, Math.PI * 2);
    ctx.arc(384, 210, 68, 0, Math.PI * 2);
    ctx.moveTo(80, 310);
    ctx.lineTo(688, 310);
    ctx.stroke();
  } else {
    for (let r = 45; r <= 180; r += 45) {
      ctx.beginPath();
      ctx.moveTo(384, 235 - r);
      ctx.lineTo(384 + r * 1.3, 235);
      ctx.lineTo(384, 235 + r);
      ctx.lineTo(384 - r * 1.3, 235);
      ctx.closePath();
      ctx.stroke();
    }
  }

  ctx.fillStyle = 'rgba(243, 237, 226, 0.9)';
  ctx.font = '600 22px "Cinzel", Georgia, serif';
  ctx.textAlign = 'center';
  ctx.fillText(painting.metadata.title, 384, 455);

  ctx.fillStyle = 'rgba(200, 164, 100, 0.78)';
  ctx.font = '400 15px system-ui, sans-serif';
  ctx.fillText(
    `${painting.metadata.author} · ${painting.metadata.license}`,
    384,
    482
  );

  return new THREE.CanvasTexture(canvas);
}

function createArchitecturalPlaqueTexture(
  badge: string,
  title: string,
  subtitle: string,
  accentHex = '#c8a464'
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 160;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = 'rgba(14, 13, 11, 0.94)';
  ctx.fillRect(0, 0, 512, 160);

  ctx.strokeStyle = accentHex;
  ctx.lineWidth = 4;
  ctx.strokeRect(4, 4, 504, 152);

  ctx.fillStyle = accentHex;
  ctx.font = '600 23px "Cinzel", Georgia, serif';
  ctx.textAlign = 'center';
  ctx.fillText(`${badge} · ${title}`.slice(0, 36), 256, 66);

  ctx.fillStyle = '#e8e2d5';
  ctx.font = '400 18px system-ui, sans-serif';
  ctx.fillText(subtitle.slice(0, 48), 256, 112);

  return new THREE.CanvasTexture(canvas);
}

/**
 * Native Three.js + WebXR 3D Spatial Engine for Neuromicon ArtMaze.
 * Provides 1:1 metric scale, hardware depth buffer, PBR lighting, grounded 3D door portals,
 * real 3D mirror chambers, 3D Quest controller laser pointers, and distortion-free 6DOF Meta Quest 2 WebXR support.
 */
export class ThreeLabyrinthEngine {
  public readonly renderer: THREE.WebGLRenderer;
  public readonly scene: THREE.Scene;
  public readonly camera: THREE.PerspectiveCamera;
  public readonly playerRig: THREE.Group;

  private roomGroup: THREE.Group;
  private dustParticles: THREE.Points | null = null;
  private voidGroup: THREE.Group | null = null;
  private raycaster: THREE.Raycaster;
  private reticleMesh: THREE.Mesh;
  private vrControllers: THREE.Group[] = [];
  private interactiveMeshes: Array<{
    mesh: THREE.Object3D;
    target: Omit<RaycastTarget, 'distance'>;
  }> = [];

  private builtKey = '';
  private lastLookedAtPainting: Set<string> = new Set();

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.18;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#0b0a09');
    this.scene.fog = new THREE.FogExp2('#0c0b0a', 0.025);

    this.camera = new THREE.PerspectiveCamera(65, 16 / 9, 0.1, 120);
    this.camera.rotation.order = 'YXZ';

    // Player rig stands on the floor (y = 0).
    this.playerRig = new THREE.Group();
    this.playerRig.add(this.camera);
    this.scene.add(this.playerRig);

    // When entering WebXR on Meta Quest 2, reset camera local transform once
    // so Three.js WebXRManager exclusively drives 6DOF head pose with zero tilt/inversion!
    this.renderer.xr.addEventListener('sessionstart', () => {
      this.camera.position.set(0, 0, 0);
      this.camera.rotation.set(0, 0, 0);
      this.camera.quaternion.identity();
      this.vrControllers.forEach((c) => {
        c.visible = true;
      });
    });

    this.renderer.xr.addEventListener('sessionend', () => {
      this.playerRig.position.y = 0;
      this.camera.position.set(0, 1.7, 0);
      this.camera.rotation.set(0, 0, 0, 'YXZ');
      this.vrControllers.forEach((c) => {
        c.visible = false;
      });
    });

    // Setup 3D VR Hand Controllers + Golden Architectural Aiming Rays for Meta Quest 2
    this.setupVRControllers();

    this.roomGroup = new THREE.Group();
    this.scene.add(this.roomGroup);

    this.raycaster = new THREE.Raycaster();
    this.raycaster.near = 0.15;
    this.raycaster.far = 14.0;

    // 3D World-Space Reticle Ring for crisp VR & Desktop depth perception
    const retGeo = new THREE.RingGeometry(0.025, 0.045, 28);
    const retMat = new THREE.MeshBasicMaterial({
      color: '#c8a464',
      side: THREE.DoubleSide,
      depthTest: false,
      transparent: true,
      opacity: 0.92,
    });
    this.reticleMesh = new THREE.Mesh(retGeo, retMat);
    this.reticleMesh.visible = false;
    this.scene.add(this.reticleMesh);
  }

  private setupVRControllers(): void {
    const wandMat = new THREE.MeshStandardMaterial({
      color: '#c8a464',
      roughness: 0.25,
      metalness: 0.85,
      emissive: '#3a2c14',
      emissiveIntensity: 0.4,
    });
    const rayGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, -4.5),
    ]);
    const rayMat = new THREE.LineBasicMaterial({
      color: '#e5c158',
      transparent: true,
      opacity: 0.65,
    });

    for (let i = 0; i < 2; i++) {
      const controller = this.renderer.xr.getController(i);
      controller.visible = false;

      const handleMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(0.012, 0.018, 0.14, 12),
        wandMat
      );
      handleMesh.rotation.x = -Math.PI * 0.5;
      handleMesh.position.z = 0.05;
      controller.add(handleMesh);

      const laserLine = new THREE.Line(rayGeo, rayMat);
      controller.add(laserLine);

      this.playerRig.add(controller);
      this.vrControllers.push(controller);
    }
  }

  /**
   * Returns the horizontal yaw angle (in radians) the user is currently looking in world space.
   * Used in WebXR so pushing the Quest thumbstick forward moves along the headset gaze direction.
   */
  public getWorldHeadingYaw(fallbackYaw: number): number {
    if (!this.renderer.xr.isPresenting) return fallbackYaw;
    const xrCam = this.renderer.xr.getCamera();
    const dir = new THREE.Vector3();
    xrCam.getWorldDirection(dir);
    if (Math.hypot(dir.x, dir.z) < 0.001) return fallbackYaw;
    return Math.atan2(-dir.x, -dir.z);
  }

  public resize(width: number, height: number): void {
    if (this.renderer.xr.isPresenting) return;
    const w = Math.max(320, width);
    const h = Math.max(240, height);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
  }

  public dispose(): void {
    this.renderer.setAnimationLoop(null);
    this.renderer.dispose();
  }

  public updateAndRender(
    pose: CameraPose,
    manifest: RoomManifest,
    playerState: PlayerState,
    registry: RoomRegistryManifest,
    timeSec: number
  ): { hovered: RaycastTarget | null } {
    const activeObjects = getActiveRoomObjects(manifest, playerState);
    const visibleDoorsKey = manifest.doors
      .map((d) => `${d.id}:${evaluateDoor(d, playerState, registry).isVisible}`)
      .join(',');
    const paintMutKey = (manifest.paintings ?? [])
      .map(
        (p) => `${p.id}:${observationSystem.getPaintingMutationPhase(p.id)}`
      )
      .join(',');

    const stateKey = [
      manifest.id,
      playerState.activeVoid || 'NONE',
      activeObjects.map((o) => o.id).join(','),
      visibleDoorsKey,
      paintMutKey,
    ].join('|');

    if (stateKey !== this.builtKey) {
      this.builtKey = stateKey;
      this.rebuildScene(manifest, playerState, registry);
    }

    // Update Player Rig horizontal position and yaw
    this.playerRig.position.x = pose.x;
    this.playerRig.position.z = pose.z;
    this.playerRig.rotation.set(0, pose.yaw, 0);

    if (this.renderer.xr.isPresenting) {
      // In WebXR, NEVER overwrite this.camera.rotation or position!
      // Three.js WebXRManager drives the stereo camera natively from Quest 2 6DOF tracking.
      // Fallback height safety if Quest reference space is 'local' instead of 'local-floor':
      const xrCam = this.renderer.xr.getCamera();
      const localHeadY = xrCam.position.y - this.playerRig.position.y;
      if (localHeadY < 0.35) {
        this.playerRig.position.y = 1.65;
      } else {
        this.playerRig.position.y = 0;
      }
    } else {
      this.playerRig.position.y = 0;
      this.camera.position.set(0, pose.y || 1.7, 0);
      this.camera.rotation.set(pose.pitch, 0, 0, 'YXZ');
    }

    // Animate dust particles & 3D Void geometry
    if (this.dustParticles) {
      this.dustParticles.rotation.y = timeSec * 0.025;
    }
    if (this.voidGroup) {
      this.voidGroup.children.forEach((child, idx) => {
        if (child.userData.isStaticGateway) return;
        child.rotation.y = timeSec * 0.1 * (idx % 2 === 0 ? 1 : -1);
        child.rotation.x = Math.sin(timeSec * 0.22 + idx) * 0.2;
      });
    }

    // Raycast from VR Controller or Camera Center Gaze
    const hovered = this.performRaycast(playerState);

    // Check painting mutation when player looks away
    (manifest.paintings ?? []).forEach((p) => {
      if (p.interaction?.mutatesOnIgnore) {
        const isLooking = hovered?.kind === 'painting' && hovered.id === p.id;
        if (this.lastLookedAtPainting.has(p.id) && !isLooking) {
          observationSystem.notifyPaintingIgnored(p.id);
          this.lastLookedAtPainting.delete(p.id);
        } else if (isLooking) {
          this.lastLookedAtPainting.add(p.id);
        }
      }
    });

    this.renderer.render(this.scene, this.camera);
    return { hovered };
  }

  private performRaycast(playerState: PlayerState): RaycastTarget | null {
    if (this.interactiveMeshes.length === 0) {
      this.reticleMesh.visible = false;
      return null;
    }

    const meshList = this.interactiveMeshes.map((entry) => entry.mesh);
    const origin = new THREE.Vector3();
    const direction = new THREE.Vector3(0, 0, -1);

    let hits: THREE.Intersection<THREE.Object3D>[] = [];

    // 1. In WebXR, check VR hand controller rays first so pointing with Quest Touch works naturally
    if (this.renderer.xr.isPresenting) {
      for (const ctrl of this.vrControllers) {
        if (!ctrl.visible) continue;
        ctrl.getWorldPosition(origin);
        ctrl.getWorldDirection(direction);
        direction.negate(); // WebXR targetRaySpace points along -Z
        this.raycaster.set(origin, direction);
        const ctrlHits = this.raycaster.intersectObjects(meshList, true);
        if (ctrlHits.length > 0) {
          hits = ctrlHits;
          break;
        }
      }
    }

    // 2. Fallback to Camera / Headset Center Gaze Ray
    if (hits.length === 0) {
      const activeCam = this.renderer.xr.isPresenting
        ? this.renderer.xr.getCamera()
        : this.camera;
      activeCam.getWorldPosition(origin);
      activeCam.getWorldDirection(direction);
      this.raycaster.set(origin, direction);
      hits = this.raycaster.intersectObjects(meshList, true);
    }

    if (hits.length === 0) {
      this.reticleMesh.visible = false;
      return null;
    }

    const hit = hits[0];
    this.reticleMesh.visible = true;
    this.reticleMesh.position
      .copy(hit.point)
      .addScaledVector(direction, -0.04);
    this.reticleMesh.lookAt(origin);

    let matched: Omit<RaycastTarget, 'distance'> | null = null;
    let obj: THREE.Object3D | null = hit.object;
    while (obj && !matched) {
      const found = this.interactiveMeshes.find((item) => item.mesh === obj);
      if (found) matched = found.target;
      obj = obj.parent;
    }

    if (!matched) return null;
    return {
      ...matched,
      distance: hit.distance,
    };
  }

  private clearRoomGroup(): void {
    this.interactiveMeshes = [];
    this.dustParticles = null;
    this.voidGroup = null;
    while (this.roomGroup.children.length > 0) {
      const child = this.roomGroup.children[0];
      this.roomGroup.remove(child);
    }
  }

  private rebuildScene(
    manifest: RoomManifest,
    playerState: PlayerState,
    registry: RoomRegistryManifest
  ): void {
    this.clearRoomGroup();

    if (playerState.activeVoid) {
      this.buildVoidScene(playerState.activeVoid, playerState.currentRoomId);
      return;
    }

    const palette = manifest.environment.palette ?? {
      wall: '#1d1a17',
      floor: '#141210',
      ceiling: '#0d0c0a',
      fog: '#0e0c0a',
      accent: '#c8a464',
    };

    this.scene.background = new THREE.Color(palette.fog);
    this.scene.fog = new THREE.FogExp2(palette.fog, 0.024);

    const dims = manifest.environment.dimensions ?? [16, 6.2, 20];
    const width = dims[0];
    const height = Math.max(5.6, dims[1]);
    const depth = dims[2];
    const halfW = width * 0.5;
    const halfD = depth * 0.5;

    // 1. Multi-Layered Architectural Lighting (Hemisphere + Oculus Key + Warm Sconces)
    const hemiLight = new THREE.HemisphereLight('#f2e6d0', '#1c1815', 0.68);
    this.roomGroup.add(hemiLight);

    const keyLight = new THREE.PointLight('#ffe4b5', 28, width * 1.8, 1.35);
    keyLight.position.set(0, height - 0.35, 0);
    this.roomGroup.add(keyLight);

    const northLight = new THREE.PointLight(
      palette.accent,
      16,
      depth * 1.3,
      1.45
    );
    northLight.position.set(0, height * 0.72, -halfD + 2.2);
    this.roomGroup.add(northLight);

    const southLight = new THREE.PointLight('#8ea8c4', 12, depth * 1.3, 1.45);
    southLight.position.set(0, height * 0.72, halfD - 2.2);
    this.roomGroup.add(southLight);

    // 2. Polished Travertine Floor at y = 0 + Sacred Labyrinth Compass Rose Medallion
    const floorTex = createPolishedFloorTexture(palette.floor, palette.accent);
    const floorMat = new THREE.MeshStandardMaterial({
      map: floorTex,
      roughness: 0.24,
      metalness: 0.16,
    });
    const floorMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(width, depth),
      floorMat
    );
    floorMesh.rotation.x = -Math.PI * 0.5;
    floorMesh.position.set(0, 0, 0);
    this.roomGroup.add(floorMesh);

    const accentTrimMat = new THREE.MeshStandardMaterial({
      color: palette.accent,
      roughness: 0.32,
      metalness: 0.78,
    });

    const plinthMat = new THREE.MeshStandardMaterial({
      color: '#191613',
      roughness: 0.48,
      metalness: 0.26,
    });

    // Central Inlaid Brass & Obsidian Floor Medallion directly under the Skylight Oculus
    const medallionGroup = new THREE.Group();
    medallionGroup.position.set(0, 0.006, 0);
    [1.1, 1.85, 2.65].forEach((radius, idx) => {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(radius - 0.045, radius, 48),
        idx === 1 ? plinthMat : accentTrimMat
      );
      ring.rotation.x = -Math.PI * 0.5;
      medallionGroup.add(ring);
    });
    this.roomGroup.add(medallionGroup);

    // 3. Coffered Vault Ceiling at y = height + 3D Structural Cross-Beams + Skylight Oculus
    const ceilTex = createCofferedCeilingTexture(
      palette.ceiling,
      palette.accent
    );
    const ceilMat = new THREE.MeshStandardMaterial({
      map: ceilTex,
      roughness: 0.68,
      metalness: 0.12,
    });
    const ceilMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(width, depth),
      ceilMat
    );
    ceilMesh.rotation.x = Math.PI * 0.5;
    ceilMesh.position.set(0, height, 0);
    this.roomGroup.add(ceilMesh);

    // 3D Coffered Ceiling Ribs
    [-depth * 0.26, depth * 0.26].forEach((rz) => {
      const beam = new THREE.Mesh(
        new THREE.BoxGeometry(width, 0.28, 0.42),
        plinthMat
      );
      beam.position.set(0, height - 0.14, rz);
      this.roomGroup.add(beam);
    });
    [-width * 0.26, width * 0.26].forEach((rx) => {
      const beam = new THREE.Mesh(
        new THREE.BoxGeometry(0.42, 0.28, depth),
        plinthMat
      );
      beam.position.set(rx, height - 0.14, 0);
      this.roomGroup.add(beam);
    });

    // Recessed Skylight Oculus & Volumetric Sunbeam Cone
    const oculusRim = new THREE.Mesh(
      new THREE.RingGeometry(1.15, 1.65, 40),
      accentTrimMat
    );
    oculusRim.rotation.x = Math.PI * 0.5;
    oculusRim.position.set(0, height - 0.02, 0);
    this.roomGroup.add(oculusRim);

    const oculusSky = new THREE.Mesh(
      new THREE.CircleGeometry(1.15, 40),
      new THREE.MeshBasicMaterial({
        color: '#fff1cc',
        side: THREE.DoubleSide,
      })
    );
    oculusSky.rotation.x = Math.PI * 0.5;
    oculusSky.position.set(0, height - 0.01, 0);
    this.roomGroup.add(oculusSky);

    const lightShaft = new THREE.Mesh(
      new THREE.ConeGeometry(2.8, height, 32, 1, true),
      new THREE.MeshBasicMaterial({
        color: '#ffe9b8',
        transparent: true,
        opacity: 0.045,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    lightShaft.position.set(0, height * 0.5, 0);
    this.roomGroup.add(lightShaft);

    // 4. Outer Architectural Walls + Base Plinth Dado + Upper Entablature Cornice
    const wallTex = createAshlarWallTexture(palette.wall, palette.accent);
    const wallMat = new THREE.MeshStandardMaterial({
      map: wallTex,
      roughness: 0.74,
      metalness: 0.08,
    });

    // North Wall (-halfD)
    const northWall = new THREE.Mesh(
      new THREE.PlaneGeometry(width, height),
      wallMat
    );
    northWall.position.set(0, height * 0.5, -halfD);
    this.roomGroup.add(northWall);

    // South Wall (+halfD)
    const southWall = new THREE.Mesh(
      new THREE.PlaneGeometry(width, height),
      wallMat
    );
    southWall.rotation.y = Math.PI;
    southWall.position.set(0, height * 0.5, halfD);
    this.roomGroup.add(southWall);

    // West Wall (-halfW)
    const westWall = new THREE.Mesh(
      new THREE.PlaneGeometry(depth, height),
      wallMat
    );
    westWall.rotation.y = Math.PI * 0.5;
    westWall.position.set(-halfW, height * 0.5, 0);
    this.roomGroup.add(westWall);

    // East Wall (+halfW)
    const eastWall = new THREE.Mesh(
      new THREE.PlaneGeometry(depth, height),
      wallMat
    );
    eastWall.rotation.y = -Math.PI * 0.5;
    eastWall.position.set(halfW, height * 0.5, 0);
    this.roomGroup.add(eastWall);

    // Grounded Baseboard Plinths & Upper Entablature Cornices along all 4 walls
    const plinthH = 0.38;
    const corniceY = height - 0.16;

    [
      { w: width, d: 0.18, x: 0, z: -halfD + 0.09 },
      { w: width, d: 0.18, x: 0, z: halfD - 0.09 },
      { w: 0.18, d: depth, x: -halfW + 0.09, z: 0 },
      { w: 0.18, d: depth, x: halfW - 0.09, z: 0 },
    ].forEach((seg) => {
      const basePlinth = new THREE.Mesh(
        new THREE.BoxGeometry(seg.w, plinthH, seg.d),
        plinthMat
      );
      basePlinth.position.set(seg.x, plinthH * 0.5, seg.z);
      this.roomGroup.add(basePlinth);

      const upperCornice = new THREE.Mesh(
        new THREE.BoxGeometry(seg.w, 0.32, seg.d * 1.4),
        plinthMat
      );
      upperCornice.position.set(seg.x, corniceY, seg.z);
      this.roomGroup.add(upperCornice);
    });

    // 5. Monumental Fluted Colonnade Pillars + Warm Alabaster Sconces (y = 0 to y = height)
    const colX = Math.max(3.5, halfW - 2.6);
    const colZ = Math.max(3.2, halfD - 3.6);
    const pillarPositions: Array<[number, number]> = [
      [-colX, -colZ],
      [colX, -colZ],
      [-colX, colZ],
      [colX, colZ],
    ];

    const pillarMat = new THREE.MeshStandardMaterial({
      color: '#2a2520',
      roughness: 0.56,
      metalness: 0.18,
    });

    const sconceMat = new THREE.MeshBasicMaterial({
      color: '#ffdf9e',
    });

    pillarPositions.forEach(([px, pz]) => {
      const pGroup = new THREE.Group();
      pGroup.position.set(px, 0, pz);

      // Stepped Base Plinth on Floor (y = 0 .. 0.38)
      const base = new THREE.Mesh(
        new THREE.BoxGeometry(1.02, 0.38, 1.02),
        plinthMat
      );
      base.position.y = 0.19;
      pGroup.add(base);

      // Gold Astragal Trim Ring
      const baseTrim = new THREE.Mesh(
        new THREE.BoxGeometry(1.08, 0.05, 1.08),
        accentTrimMat
      );
      baseTrim.position.y = 0.39;
      pGroup.add(baseTrim);

      // 16-Sided Fluted Column Shaft
      const shaftH = height - 0.76;
      const shaft = new THREE.Mesh(
        new THREE.CylinderGeometry(0.35, 0.4, shaftH, 16),
        pillarMat
      );
      shaft.position.y = 0.38 + shaftH * 0.5;
      pGroup.add(shaft);

      // Necking Ring & Capital at Ceiling
      const neckTrim = new THREE.Mesh(
        new THREE.CylinderGeometry(0.42, 0.42, 0.06, 16),
        accentTrimMat
      );
      neckTrim.position.y = height - 0.42;
      pGroup.add(neckTrim);

      const cap = new THREE.Mesh(
        new THREE.BoxGeometry(1.06, 0.38, 1.06),
        plinthMat
      );
      cap.position.y = height - 0.19;
      pGroup.add(cap);

      // Warm Alabaster Wall/Pillar Sconce facing room center
      const sconceDirX = px < 0 ? 0.39 : -0.39;
      const sconce = new THREE.Mesh(
        new THREE.BoxGeometry(0.12, 0.36, 0.18),
        sconceMat
      );
      sconce.position.set(sconceDirX, 2.35, 0);
      pGroup.add(sconce);

      this.roomGroup.add(pGroup);
    });

    // 6. Monumental 3D Door Portals (Strictly Grounded on y = 0, Embedded in Wall)
    manifest.doors.forEach((door) => {
      const evalDoor = evaluateDoor(door, playerState, registry);
      if (!evalDoor.isVisible) return;

      const anchor = resolveWallAnchoredPose(
        door.position,
        door.rotation?.[1],
        halfW,
        halfD,
        0
      );

      const isRabbitHole = door.type === 'rabbit-hole' || door.id === 'RH';
      const dw = isRabbitHole ? 1.65 : door.type === 'monumental' ? 2.25 : 1.95;
      const dh = isRabbitHole ? 3.35 : door.type === 'monumental' ? 3.9 : 3.55;

      const doorGroup = new THREE.Group();
      doorGroup.position.set(anchor.cx, 0, anchor.cz);
      doorGroup.rotation.y = anchor.rotY;

      const portalTrimMat = new THREE.MeshStandardMaterial({
        color: isRabbitHole ? '#e5c158' : palette.accent,
        roughness: 0.28,
        metalness: 0.8,
      });

      const jambStoneMat = new THREE.MeshStandardMaterial({
        color: '#2b251f',
        roughness: 0.52,
        metalness: 0.22,
      });

      // A. Stepped Stone Threshold Slab resting directly on Floor (y = 0 .. 0.14)
      const thresholdStep = new THREE.Mesh(
        new THREE.BoxGeometry(dw + 0.72, 0.14, 0.56),
        jambStoneMat
      );
      thresholdStep.position.set(0, 0.07, 0.22);
      doorGroup.add(thresholdStep);

      const brassSill = new THREE.Mesh(
        new THREE.BoxGeometry(dw + 0.52, 0.03, 0.14),
        portalTrimMat
      );
      brassSill.position.set(0, 0.15, 0.36);
      doorGroup.add(brassSill);

      // B. Left & Right 3D Stone Jamb Pillars (y = 0.14 .. dh)
      const jambW = 0.26;
      const jambD = 0.38;
      [-dw * 0.5 - jambW * 0.4, dw * 0.5 + jambW * 0.4].forEach((jx) => {
        const jamb = new THREE.Mesh(
          new THREE.BoxGeometry(jambW, dh, jambD),
          jambStoneMat
        );
        jamb.position.set(jx, dh * 0.5, 0.16);
        doorGroup.add(jamb);

        const jambTrim = new THREE.Mesh(
          new THREE.BoxGeometry(0.05, dh - 0.2, jambD + 0.04),
          portalTrimMat
        );
        jambTrim.position.set(
          jx + (jx < 0 ? jambW * 0.45 : -jambW * 0.45),
          dh * 0.5,
          0.16
        );
        doorGroup.add(jambTrim);
      });

      // C. Carved Stone Entablature & Cornice Lintel (y = dh .. dh + 0.46)
      const lintel = new THREE.Mesh(
        new THREE.BoxGeometry(dw + 0.88, 0.46, 0.48),
        jambStoneMat
      );
      lintel.position.set(0, dh + 0.23, 0.2);
      doorGroup.add(lintel);

      const lintelCrown = new THREE.Mesh(
        new THREE.BoxGeometry(dw + 0.98, 0.08, 0.56),
        portalTrimMat
      );
      lintelCrown.position.set(0, dh + 0.48, 0.22);
      doorGroup.add(lintelCrown);

      // D. Recessed Coffered Double Door Leaf / Void Aperture (y = 0.14 .. dh)
      const isVoidOrPlanned =
        door.status === 'void' || door.status === 'planned';
      const leafColor = isRabbitHole
        ? '#211530'
        : isVoidOrPlanned
        ? '#0c1624'
        : '#1e1914';

      const leafMat = new THREE.MeshStandardMaterial({
        color: leafColor,
        roughness: isVoidOrPlanned ? 0.14 : 0.4,
        metalness: isVoidOrPlanned ? 0.65 : 0.48,
        emissive: isRabbitHole
          ? '#3b2454'
          : isVoidOrPlanned
          ? '#102238'
          : '#000000',
        emissiveIntensity: 0.65,
      });

      const doorLeaf = new THREE.Mesh(
        new THREE.BoxGeometry(dw, dh - 0.14, 0.14),
        leafMat
      );
      doorLeaf.position.set(0, 0.14 + (dh - 0.14) * 0.5, 0.1);
      doorGroup.add(doorLeaf);

      const centerSeam = new THREE.Mesh(
        new THREE.BoxGeometry(0.04, dh - 0.2, 0.18),
        portalTrimMat
      );
      centerSeam.position.set(0, 0.14 + (dh - 0.14) * 0.5, 0.1);
      doorGroup.add(centerSeam);

      [-0.14, 0.14].forEach((hx) => {
        const handle = new THREE.Mesh(
          new THREE.CylinderGeometry(0.025, 0.025, 0.34, 10),
          portalTrimMat
        );
        handle.position.set(hx, 1.45, 0.22);
        doorGroup.add(handle);
      });

      // E. Architectural Nameplate Plaque on Lintel
      const plaqueTex = createArchitecturalPlaqueTexture(
        door.symbol || door.id,
        `DOOR ${door.label || door.id}`,
        door.subtitle ||
          (door.destination ? `→ ${door.destination}` : '→ VOID'),
        isRabbitHole ? '#f0d27a' : palette.accent
      );
      const plaqueMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(1.78, 0.52),
        new THREE.MeshBasicMaterial({ map: plaqueTex })
      );
      plaqueMesh.position.set(0, dh + 0.23, 0.45);
      doorGroup.add(plaqueMesh);

      this.roomGroup.add(doorGroup);

      this.interactiveMeshes.push({
        mesh: doorGroup,
        target: {
          kind: 'door',
          id: door.id,
          title: `Door ${door.label || door.id}`,
          titleRu: `Дверь ${door.label || door.id}`,
          subtitle: door.subtitle,
          subtitleRu: door.subtitleRu,
          door,
        },
      });
    });

    // 7. Framed Paintings Mounted Flush on Walls (with 3D Frames & Museum Light)
    const activeObjs = getActiveRoomObjects(manifest, playerState);

    (manifest.paintings ?? []).forEach((painting, pIdx) => {
      const anchor = resolveWallAnchoredPose(
        painting.position,
        painting.rotation[1],
        halfW,
        halfD,
        painting.position[1] || 2.25
      );
      const scale = painting.scale ?? 1.25;
      const pw = 1.8 * scale;
      const ph = 1.22 * scale;

      const pGroup = new THREE.Group();
      pGroup.position.set(anchor.cx, anchor.cy, anchor.cz);
      pGroup.rotation.y = anchor.rotY;

      const frameColor =
        painting.frame === 'classic_gold'
          ? '#c8a464'
          : painting.frame === 'obsidian_minimal'
          ? '#242933'
          : painting.frame === 'bronze_monument'
          ? '#966d42'
          : '#9c907e';

      const frameMat = new THREE.MeshStandardMaterial({
        color: frameColor,
        roughness: 0.3,
        metalness: 0.74,
      });

      const frameBacking = new THREE.Mesh(
        new THREE.BoxGeometry(pw + 0.22, ph + 0.22, 0.1),
        frameMat
      );
      frameBacking.position.set(0, 0, 0.05);
      pGroup.add(frameBacking);

      const mutPhase = observationSystem.getPaintingMutationPhase(painting.id);
      const isMutated =
        Boolean(painting.interaction?.mutatesOnIgnore) && mutPhase % 2 === 1;
      const artTex = createPaintingArtworkTexture(painting, pIdx, isMutated);
      const artCanvas = new THREE.Mesh(
        new THREE.PlaneGeometry(pw, ph),
        new THREE.MeshStandardMaterial({
          map: artTex,
          roughness: 0.42,
          metalness: 0.05,
        })
      );
      artCanvas.position.set(0, 0, 0.11);
      pGroup.add(artCanvas);

      const lampBar = new THREE.Mesh(
        new THREE.BoxGeometry(0.68, 0.05, 0.24),
        accentTrimMat
      );
      lampBar.position.set(0, ph * 0.5 + 0.22, 0.12);
      pGroup.add(lampBar);

      this.roomGroup.add(pGroup);

      this.interactiveMeshes.push({
        mesh: pGroup,
        target: {
          kind: 'painting',
          id: painting.id,
          title: painting.metadata.title,
          titleRu: painting.metadata.titleRu,
          subtitle: `${painting.metadata.author} · ${painting.metadata.license}`,
          discoveryId: painting.interaction?.discovery,
          painting,
        },
      });
    });

    // 8. Floor-Standing Mirror Portal & 3D Reflected World (Grounded at y = 0)
    if (manifest.mirror) {
      const mAnchor = resolveWallAnchoredPose(
        manifest.mirror.position,
        0,
        halfW,
        halfD,
        0
      );
      const mw = 2.65;
      const mh = 3.9;

      const mirrorGroup = new THREE.Group();
      mirrorGroup.position.set(mAnchor.cx, 0, mAnchor.cz);
      mirrorGroup.rotation.y = mAnchor.rotY;

      const mirrorFrameMat = new THREE.MeshStandardMaterial({
        color: '#242d38',
        roughness: 0.26,
        metalness: 0.8,
      });

      const mBase = new THREE.Mesh(
        new THREE.BoxGeometry(mw + 0.62, 0.22, 0.52),
        mirrorFrameMat
      );
      mBase.position.set(0, 0.11, 0.2);
      mirrorGroup.add(mBase);

      [-mw * 0.5 - 0.14, mw * 0.5 + 0.14].forEach((mx) => {
        const pil = new THREE.Mesh(
          new THREE.BoxGeometry(0.24, mh, 0.38),
          mirrorFrameMat
        );
        pil.position.set(mx, mh * 0.5, 0.16);
        mirrorGroup.add(pil);
      });

      const mCrown = new THREE.Mesh(
        new THREE.BoxGeometry(mw + 0.72, 0.42, 0.46),
        mirrorFrameMat
      );
      mCrown.position.set(0, mh + 0.2, 0.18);
      mirrorGroup.add(mCrown);

      const glassMat = new THREE.MeshStandardMaterial({
        color: '#122232',
        roughness: 0.06,
        metalness: 0.88,
        transparent: true,
        opacity: 0.76,
      });
      const glassMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(mw, mh - 0.22),
        glassMat
      );
      glassMesh.position.set(0, 0.22 + (mh - 0.22) * 0.5, 0.14);
      mirrorGroup.add(glassMesh);

      // Render Reflected 3D Objects inside the Mirror Glass (omitting visibleInMirror: false!)
      activeObjs.forEach((obj) => {
        if (obj.visibleInMirror === false) return;
        const relX = Math.max(
          -mw * 0.35,
          Math.min(mw * 0.35, obj.position[0] * 0.32)
        );
        const reflCol = new THREE.Mesh(
          new THREE.BoxGeometry(0.45, 2.15, 0.22),
          new THREE.MeshStandardMaterial({
            color: '#344e68',
            roughness: 0.28,
            metalness: 0.55,
            emissive: '#1b3147',
            emissiveIntensity: 0.55,
          })
        );
        reflCol.position.set(relX, 1.25, 0.16);
        mirrorGroup.add(reflCol);
      });

      const mPlaqueTex = createArchitecturalPlaqueTexture(
        'MIRROR',
        manifest.mirror.characterState,
        manifest.mirror.mode === 'first'
          ? 'Whom do you expect to meet here?'
          : manifest.mirror.mode === 'meta'
          ? 'Was this truly a labyrinth?'
          : 'ACCEPT · REJECT · RETURN',
        '#7da2c4'
      );
      const mPlaque = new THREE.Mesh(
        new THREE.PlaneGeometry(1.88, 0.52),
        new THREE.MeshBasicMaterial({ map: mPlaqueTex })
      );
      mPlaque.position.set(0, mh + 0.2, 0.42);
      mirrorGroup.add(mPlaque);

      this.roomGroup.add(mirrorGroup);

      this.interactiveMeshes.push({
        mesh: mirrorGroup,
        target: {
          kind: 'mirror',
          id: manifest.mirror.id,
          title: `Mirror · ${manifest.mirror.characterState}`,
          titleRu: `Зеркало · ${
            manifest.mirror.characterStateRu || manifest.mirror.characterState
          }`,
          subtitle: 'ACCEPT · REJECT · RETURN',
          mirror: manifest.mirror,
        },
      });
    }

    // 9. Sculptural 3D Objects & Anomalies (Strictly Grounded on y = 0)
    activeObjs.forEach((obj) => {
      const [ox, , oz] = obj.position;
      const objGroup = new THREE.Group();
      objGroup.position.set(ox, 0, oz);

      if (obj.type === 'shadow_anomaly') {
        const shadowDisc = new THREE.Mesh(
          new THREE.CylinderGeometry(0.95, 1.1, 0.03, 28),
          new THREE.MeshBasicMaterial({ color: '#030304' })
        );
        shadowDisc.position.y = 0.015;
        objGroup.add(shadowDisc);

        const glowRing = new THREE.Mesh(
          new THREE.RingGeometry(0.95, 1.08, 36),
          new THREE.MeshBasicMaterial({
            color: '#d4af37',
            side: THREE.DoubleSide,
          })
        );
        glowRing.rotation.x = -Math.PI * 0.5;
        glowRing.position.y = 0.025;
        objGroup.add(glowRing);

        const hitCol = new THREE.Mesh(
          new THREE.CylinderGeometry(0.95, 0.95, 1.5, 12),
          new THREE.MeshBasicMaterial({
            transparent: true,
            opacity: 0,
            depthWrite: false,
          })
        );
        hitCol.position.y = 0.75;
        objGroup.add(hitCol);
      } else {
        const isMonolith =
          obj.type === 'monolith' || obj.type === 'reflection_anomaly';
        const isChair = obj.type === 'chair';
        const objH = isMonolith ? 2.55 : isChair ? 1.45 : 1.75;

        // Grounded Stepped Stone Pedestal Base (y = 0 .. 0.28)
        const pedLower = new THREE.Mesh(
          new THREE.BoxGeometry(1.18, 0.14, 1.18),
          plinthMat
        );
        pedLower.position.y = 0.07;
        objGroup.add(pedLower);

        const pedUpper = new THREE.Mesh(
          new THREE.BoxGeometry(0.96, 0.14, 0.96),
          plinthMat
        );
        pedUpper.position.y = 0.21;
        objGroup.add(pedUpper);

        const bodyMat = new THREE.MeshStandardMaterial({
          color:
            obj.type === 'reflection_anomaly'
              ? '#243648'
              : isChair
              ? '#5c4028'
              : '#2d2823',
          roughness: 0.34,
          metalness: 0.48,
        });

        if (isMonolith) {
          // Tapered Monumental Obelisk
          const obelisk = new THREE.Mesh(
            new THREE.CylinderGeometry(0.26, 0.42, objH - 0.28, 4),
            bodyMat
          );
          obelisk.rotation.y = Math.PI * 0.25;
          obelisk.position.y = 0.28 + (objH - 0.28) * 0.5;
          objGroup.add(obelisk);

          const goldBand = new THREE.Mesh(
            new THREE.BoxGeometry(0.62, 0.06, 0.62),
            accentTrimMat
          );
          goldBand.position.y = 1.45;
          objGroup.add(goldBand);
        } else if (isChair) {
          // Sculpted Throne of Contemplation
          const seat = new THREE.Mesh(
            new THREE.BoxGeometry(0.68, 0.42, 0.64),
            bodyMat
          );
          seat.position.y = 0.49;
          objGroup.add(seat);

          const backrest = new THREE.Mesh(
            new THREE.BoxGeometry(0.68, 0.85, 0.14),
            bodyMat
          );
          backrest.position.set(0, 1.05, -0.25);
          objGroup.add(backrest);
        } else {
          // Classical Stele & Celestial Armillary Ring
          const stele = new THREE.Mesh(
            new THREE.BoxGeometry(0.62, objH - 0.55, 0.62),
            bodyMat
          );
          stele.position.y = 0.28 + (objH - 0.55) * 0.5;
          objGroup.add(stele);

          const armillary = new THREE.Mesh(
            new THREE.TorusGeometry(0.32, 0.03, 12, 32),
            accentTrimMat
          );
          armillary.position.y = objH - 0.05;
          objGroup.add(armillary);
        }

        const oPlaqueTex = createArchitecturalPlaqueTexture(
          obj.type.toUpperCase(),
          obj.title || obj.id,
          `[${obj.interactions.join(' · ')}]`,
          palette.accent
        );
        const oPlaque = new THREE.Mesh(
          new THREE.PlaneGeometry(1.38, 0.42),
          new THREE.MeshBasicMaterial({
            map: oPlaqueTex,
            side: THREE.DoubleSide,
          })
        );
        oPlaque.position.set(0, objH + 0.42, 0);
        objGroup.add(oPlaque);
      }

      this.roomGroup.add(objGroup);

      this.interactiveMeshes.push({
        mesh: objGroup,
        target: {
          kind: 'object',
          id: obj.id,
          title: obj.title || obj.id,
          titleRu: obj.titleRu || obj.title,
          subtitle: obj.interactions.join(' · '),
          discoveryId: obj.discoveryId,
          object: obj,
        },
      });
    });

    // 10. Volumetric 3D Atmospheric Dust Motes
    const particleCount = 220;
    const positions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * (width - 2);
      positions[i * 3 + 1] = 0.4 + Math.random() * (height - 0.8);
      positions[i * 3 + 2] = (Math.random() - 0.5) * (depth - 2);
    }
    const pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const pMat = new THREE.PointsMaterial({
      color: palette.accent,
      size: 0.042,
      transparent: true,
      opacity: 0.55,
    });
    this.dustParticles = new THREE.Points(pGeo, pMat);
    this.roomGroup.add(this.dustParticles);
  }

  private buildVoidScene(voidType: VoidType, returnRoomId: string): void {
    const desc = getVoidDescriptor(voidType);
    this.scene.background = new THREE.Color(desc.atmosphereColor);
    this.scene.fog = new THREE.FogExp2(desc.atmosphereColor, 0.02);

    const ambient = new THREE.AmbientLight('#ffffff', 0.9);
    this.roomGroup.add(ambient);

    const point = new THREE.PointLight(desc.accentColor, 32, 65);
    point.position.set(0, 6, -6);
    this.roomGroup.add(point);

    const vGroup = new THREE.Group();
    this.voidGroup = vGroup;
    this.roomGroup.add(vGroup);

    if (voidType === 'fractal') {
      const wireMat = new THREE.MeshStandardMaterial({
        color: desc.accentColor,
        wireframe: true,
        emissive: desc.accentColor,
        emissiveIntensity: 0.38,
      });
      for (let i = 1; i <= 18; i++) {
        const mesh = new THREE.Mesh(
          new THREE.OctahedronGeometry(i * 1.4, 1),
          wireMat
        );
        mesh.position.set(0, 1.7, -4);
        vGroup.add(mesh);
      }
    } else if (voidType === 'infinity' || voidType === 'mirror') {
      const archMat = new THREE.MeshStandardMaterial({
        color: desc.accentColor,
        roughness: 0.28,
        metalness: 0.72,
      });
      for (let i = -10; i <= 10; i++) {
        const arch = new THREE.Mesh(
          new THREE.BoxGeometry(6.5, 5.5, 0.35),
          archMat
        );
        arch.position.set(0, 2.5, i * 3.2);
        vGroup.add(arch);
      }
    } else {
      const count = 1400;
      const pos = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        pos[i * 3] = (Math.random() - 0.5) * 80;
        pos[i * 3 + 1] = (Math.random() - 0.5) * 80;
        pos[i * 3 + 2] = (Math.random() - 0.5) * 80;
      }
      const sGeo = new THREE.BufferGeometry();
      sGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const stars = new THREE.Points(
        sGeo,
        new THREE.PointsMaterial({ color: '#f3ede2', size: 0.14 })
      );
      vGroup.add(stars);
    }

    // Interactive 3D Return Gateway in Void Space (so VR & Desktop players can step back through a 3D portal)
    const returnDoor: DoorDefinition = {
      id: 'RETURN',
      label: 'RETURN',
      symbol: '↺',
      type: 'monumental',
      status: 'ready',
      destination: returnRoomId || 'ROOM_0000',
      subtitle: `Return to ${returnRoomId || 'ROOM_0000'}`,
      subtitleRu: `Вернуться в ${returnRoomId || 'ROOM_0000'}`,
    };

    const gateGroup = new THREE.Group();
    gateGroup.userData.isStaticGateway = true;
    gateGroup.position.set(0, 0, 1.8);
    const gateMat = new THREE.MeshStandardMaterial({
      color: desc.accentColor,
      roughness: 0.25,
      metalness: 0.8,
      emissive: desc.accentColor,
      emissiveIntensity: 0.35,
    });
    const gateArch = new THREE.Mesh(
      new THREE.BoxGeometry(2.1, 3.4, 0.2),
      gateMat
    );
    gateArch.position.set(0, 1.7, 0);
    gateGroup.add(gateArch);

    const gatePlaqueTex = createArchitecturalPlaqueTexture(
      '↺',
      `RETURN TO ${returnRoomId || 'ROOM_0000'}`,
      'Click / Trigger to Step Back from Void',
      desc.accentColor
    );
    const gatePlaque = new THREE.Mesh(
      new THREE.PlaneGeometry(1.9, 0.55),
      new THREE.MeshBasicMaterial({
        map: gatePlaqueTex,
        side: THREE.DoubleSide,
      })
    );
    gatePlaque.position.set(0, 2.5, 0.15);
    gateGroup.add(gatePlaque);

    this.roomGroup.add(gateGroup);
    this.interactiveMeshes.push({
      mesh: gateGroup,
      target: {
        kind: 'door',
        id: 'VOID_RETURN',
        title: `Return to ${returnRoomId || 'ROOM_0000'}`,
        titleRu: `Вернуться в ${returnRoomId || 'ROOM_0000'}`,
        subtitle: 'Exit Void Space',
        subtitleRu: 'Выйти из Пустоты',
        door: returnDoor,
      },
    });
  }
}
