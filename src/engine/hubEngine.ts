import * as THREE from 'three';
import {
  CorridorBuilder,
  SpatialInteractiveTarget,
} from '../corridor/corridorBuilder';
import {
  disposeThreeHierarchy,
  MirrorChoice,
  RoomContext,
} from '../room-sdk';
import { spatialAudioSystem } from '../systems/audio/spatialAudioSystem';
import { HubPlayerState, hubPlayerState } from '../state/playerState';
import { getRoomV1Manifest, roomStreamer } from '../world/roomStreamer';
import { ComfortSystem } from './comfort/comfortSystem';
import { InputState } from './input/inputController';
import { XRControllerInput } from './xr/webxrManager';

export interface HubRenderTelemetry {
  fps: number;
  drawCalls: number;
  triangles: number;
  geometries: number;
  textures: number;
}

export interface HubHoveredResult {
  target: SpatialInteractiveTarget | null;
  floorHitPoint: THREE.Vector3 | null;
  distance: number;
}

/**
 * Universal WebXR + Desktop 3D Engine for Neuromicon Artmaze (AGENTS.md §2, §3, §4, §4A).
 * Enforces strict VR comfort (blink-fade teleport, snap-turn, peripheral vignette, zero camera acceleration)
 * and renders the Threshold Hall, Ascent/Descent Segments, and Room API v1 packages in a single WebXR session.
 */
export class HubEngine {
  public readonly renderer: THREE.WebGLRenderer;
  public readonly scene: THREE.Scene;
  public readonly camera: THREE.PerspectiveCamera;
  public readonly playerRig: THREE.Group;
  public readonly comfort: ComfortSystem;

  private worldRoot: THREE.Group;
  private roomApiRoot: THREE.Group;
  private raycaster: THREE.Raycaster;
  private reticleMesh: THREE.Mesh;
  private vrControllers: THREE.Group[] = [];

  private interactiveEntries: Array<{
    mesh: THREE.Object3D;
    target: SpatialInteractiveTarget;
  }> = [];
  private walkableMeshes: THREE.Object3D[] = [];

  private pose = {
    x: 0,
    y: 0,
    z: 5.5,
    yaw: 0,
    pitch: 0,
  };

  private snapCooldown = 0;
  private teleportStickCooldown = 0;
  private builtSceneKey = '';
  private fovZoom = false;
  private smoothedFps = 72;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#0c0b0a');

    this.camera = new THREE.PerspectiveCamera(65, 16 / 9, 0.1, 110);
    this.camera.rotation.order = 'YXZ';

    this.playerRig = new THREE.Group();
    this.playerRig.add(this.camera);
    this.scene.add(this.playerRig);

    this.comfort = new ComfortSystem(this.camera, this.scene);

    this.worldRoot = new THREE.Group();
    this.scene.add(this.worldRoot);

    this.roomApiRoot = new THREE.Group();
    this.scene.add(this.roomApiRoot);

    this.raycaster = new THREE.Raycaster();
    this.raycaster.near = 0.15;
    this.raycaster.far = 22.0;

    // 3D Reticle Ring
    this.reticleMesh = new THREE.Mesh(
      new THREE.RingGeometry(0.025, 0.045, 28),
      new THREE.MeshBasicMaterial({
        color: '#c8a464',
        side: THREE.DoubleSide,
        depthTest: false,
        transparent: true,
        opacity: 0.9,
      })
    );
    this.reticleMesh.visible = false;
    this.scene.add(this.reticleMesh);

    this.setupVRControllers();

    // Clean transform handoff when entering/exiting Meta Quest 2 WebXR
    this.renderer.xr.addEventListener('sessionstart', () => {
      this.camera.position.set(0, 0, 0);
      this.camera.rotation.set(0, 0, 0);
      this.camera.quaternion.identity();
      this.vrControllers.forEach((c) => {
        c.visible = true;
      });
    });

    this.renderer.xr.addEventListener('sessionend', () => {
      this.camera.position.set(0, 1.7, 0);
      this.camera.rotation.set(this.pose.pitch, 0, 0, 'YXZ');
      this.vrControllers.forEach((c) => {
        c.visible = false;
      });
    });
  }

  private setupVRControllers(): void {
    const wandMat = new THREE.MeshStandardMaterial({
      color: '#c8a464',
      roughness: 0.25,
      metalness: 0.85,
    });
    const rayGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, -6.0),
    ]);
    const rayMat = new THREE.LineBasicMaterial({
      color: '#e5c158',
      transparent: true,
      opacity: 0.7,
    });

    for (let i = 0; i < 2; i++) {
      const ctrl = this.renderer.xr.getController(i);
      ctrl.visible = false;

      const handle = new THREE.Mesh(
        new THREE.CylinderGeometry(0.012, 0.018, 0.14, 12),
        wandMat
      );
      handle.rotation.x = -Math.PI * 0.5;
      handle.position.z = 0.05;
      ctrl.add(handle);

      const line = new THREE.Line(rayGeo, rayMat);
      ctrl.add(line);

      this.playerRig.add(ctrl);
      this.vrControllers.push(ctrl);
    }
  }

  public setFovZoom(enabled: boolean): void {
    this.fovZoom = enabled;
    if (!this.renderer.xr.isPresenting) {
      this.camera.fov = enabled ? 36 : 65;
      this.camera.updateProjectionMatrix();
    }
  }

  public isFovZoom(): boolean {
    return this.fovZoom;
  }

  public resize(width: number, height: number): void {
    if (this.renderer.xr.isPresenting) return;
    const w = Math.max(320, width);
    const h = Math.max(240, height);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
  }

  public getPose(): { x: number; y: number; z: number; yaw: number } {
    return { ...this.pose };
  }

  public teleportTo(x: number, z: number, yaw?: number): void {
    this.comfort.triggerFadeTransition(() => {
      this.pose.x = x;
      this.pose.z = z;
      if (yaw !== undefined) {
        this.pose.yaw = yaw;
      }
    });
  }

  public dispose(): void {
    this.renderer.setAnimationLoop(null);
    roomStreamer.unmountCurrentRoom(this.roomApiRoot);
    disposeThreeHierarchy(this.worldRoot);
    this.renderer.dispose();
  }

  private buildRoomContext(
    roomId: string,
    state: HubPlayerState
  ): RoomContext {
    const manifest = getRoomV1Manifest(roomId);
    return {
      THREE,
      root: this.roomApiRoot,
      manifest,
      xr: {
        isPresenting: this.renderer.xr.isPresenting,
        controllers: this.vrControllers,
      },
      audio: {
        playRoomTrack: (trackUrl, baseHz) => {
          spatialAudioSystem.playRoomSoundtrack(trackUrl, baseHz ?? 108);
        },
        triggerTone: (freqHz) => {
          spatialAudioSystem.triggerChime(freqHz);
        },
      },
      state: {
        getPath: () => state.path,
        isQuestCompleted: (id) => state.completedRooms.includes(id),
        getIdentityChoice: (id) => state.identityChoices[id],
        hasDiscovery: (key) => state.discoveries.includes(key),
        unlockDiscovery: (key) => hubPlayerState.unlockDiscovery(key),
      },
      doors: {
        openDoor: (doorId) => {
          const door = manifest.doors.find((d) => d.id === doorId);
          if (door) {
            this.comfort.triggerFadeTransition(() => {
              hubPlayerState.enterRoom(door.destination);
            });
          }
        },
        returnToCorridor: () => {
          this.comfort.triggerFadeTransition(() => {
            hubPlayerState.returnToCorridor();
          });
        },
      },
      exit: (destinationRoomId) => {
        this.comfort.triggerFadeTransition(() => {
          if (destinationRoomId === 'CORRIDOR') {
            hubPlayerState.returnToCorridor();
          } else {
            hubPlayerState.enterRoom(destinationRoomId);
          }
        });
      },
      mirror: {
        choose: (choice: MirrorChoice) => {
          if (choice === 'back') {
            this.comfort.triggerFadeTransition(() => {
              hubPlayerState.returnToCorridor();
            });
          } else {
            hubPlayerState.recordMirrorChoice(roomId, choice);
          }
        },
      },
      quest: {
        completeObjective: () => {
          hubPlayerState.markQuestCompleted(roomId);
        },
      },
      radio: {
        broadcast: (msg) => {
          hubPlayerState.postRadioMessage(manifest.radio.channel, msg);
        },
        getMessages: () =>
          (state.radioChannels[manifest.radio.channel] ?? []).map(
            (m) => `${m.author}: ${m.text}`
          ),
      },
      comfort: {
        fadeTransition: (onMidpoint) =>
          this.comfort.triggerFadeTransition(onMidpoint),
        setVignetteIntensity: (v) => this.comfort.setTargetVignette(v),
        getMode: () => state.comfortMode,
      },
      log: () => {
        // Silent in production UI per guidelines
      },
    };
  }

  private rebuildActiveWorld(state: HubPlayerState): void {
    this.interactiveEntries = [];
    this.walkableMeshes = [];
    roomStreamer.unmountCurrentRoom(this.roomApiRoot);
    disposeThreeHierarchy(this.worldRoot);

    const registerTarget = (
      mesh: THREE.Object3D,
      target: SpatialInteractiveTarget
    ) => {
      this.interactiveEntries.push({ mesh, target });
    };

    if (state.location === 'threshold') {
      CorridorBuilder.buildThresholdHall(
        this.worldRoot,
        this.scene,
        state,
        registerTarget,
        this.walkableMeshes
      );
      this.pose = { x: 0, y: 0, z: 5.2, yaw: 0, pitch: 0 };
      spatialAudioSystem.setCorridorVerticalCrossfade(
        0.5,
        'THRESHOLD · Vertical Atrium Ambience'
      );
      return;
    }

    if (state.location === 'corridor') {
      CorridorBuilder.buildCorridorSegment(
        this.worldRoot,
        this.scene,
        state.branch,
        state.segment,
        state,
        registerTarget,
        this.walkableMeshes
      );
      this.pose = { x: 0, y: 0, z: 6.8, yaw: 0, pitch: 0 };
      spatialAudioSystem.setCorridorVerticalCrossfade(
        state.branch === 'ascend' ? 1.0 : 0.0,
        `${state.branch.toUpperCase()} · Segment ${state.segment} Ambience`
      );
      return;
    }

    // location === 'room'
    const roomId = state.currentRoomId || 'ROOM_073';
    const ctx = this.buildRoomContext(roomId, state);
    roomStreamer.mountRoom(
      roomId,
      this.worldRoot,
      this.scene,
      state,
      ctx,
      registerTarget,
      this.walkableMeshes
    );
    this.pose = { x: 0, y: 0, z: 5.5, yaw: 0, pitch: 0 };
  }

  public stepAndRender(
    dt: number,
    desktopInput: InputState,
    xrInput: XRControllerInput,
    state: HubPlayerState
  ): {
    hovered: HubHoveredResult;
    telemetry: HubRenderTelemetry;
  } {
    this.smoothedFps = this.smoothedFps * 0.9 + (1 / Math.max(0.001, dt)) * 0.1;

    // Check if world topology state changed
    const sceneKey = [
      state.location,
      state.branch,
      state.segment,
      state.currentRoomId || 'NONE',
      state.visitedRooms.join(','),
      state.completedRooms.join(','),
      state.discoveries.join(','),
      Object.entries(state.identityChoices)
        .map(([k, v]) => `${k}:${v}`)
        .join(','),
    ].join('|');

    if (sceneKey !== this.builtSceneKey) {
      this.builtSceneKey = sceneKey;
      this.rebuildActiveWorld(state);
    }

    const isXR = this.renderer.xr.isPresenting;

    // 1. ROTATION: Snap Turn for VR / Keyboard Q&R, Mouse Drag for Desktop
    if (this.snapCooldown > 0) {
      this.snapCooldown = Math.max(0, this.snapCooldown - dt);
    }

    const snapRad = THREE.MathUtils.degToRad(state.snapTurnDegrees);
    const stickTurn = xrInput.turnX;

    if (this.snapCooldown <= 0) {
      if (stickTurn > 0.55 || desktopInput.turnRight) {
        this.snapCooldown = 0.3;
        this.pose.yaw -= snapRad;
      } else if (stickTurn < -0.55 || desktopInput.turnLeft) {
        this.snapCooldown = 0.3;
        this.pose.yaw += snapRad;
      }
    }

    if (!isXR) {
      this.pose.yaw += desktopInput.yawDelta;
      this.pose.pitch = desktopInput.pitchDelta;
    }

    // 2. LOCOMOTION: Constant-Velocity Smooth (with Vignette) OR Blink-Teleport
    let forward = -xrInput.moveZ;
    let strafe = xrInput.moveX;
    if (desktopInput.forward) forward += 1;
    if (desktopInput.backward) forward -= 1;
    if (desktopInput.right) strafe += 1;
    if (desktopInput.left) strafe -= 1;

    const isMovingStick = Math.hypot(forward, strafe) > 0.15;

    if (this.teleportStickCooldown > 0) {
      this.teleportStickCooldown = Math.max(0, this.teleportStickCooldown - dt);
    }

    // In 'teleport' mode inside VR, pushing thumbstick forward blinks 2.4m forward with fade (ZERO swimming!)
    if (isXR && state.comfortMode === 'teleport') {
      this.comfort.setTargetVignette(0);
      if (forward > 0.65 && this.teleportStickCooldown <= 0) {
        this.teleportStickCooldown = 0.45;
        const moveYaw = this.getActiveHeadingYaw();
        const stepDist = 2.4;
        const nx = this.pose.x - Math.sin(moveYaw) * stepDist;
        const nz = this.pose.z - Math.cos(moveYaw) * stepDist;
        this.clampAndApplyPosition(nx, nz, state);
      }
    } else if (isMovingStick) {
      // Smooth constant-velocity locomotion (zero acceleration, peripheral vignette active)
      const len = Math.min(1, Math.hypot(forward, strafe));
      const normF = forward / Math.max(1, Math.hypot(forward, strafe));
      const normS = strafe / Math.max(1, Math.hypot(forward, strafe));
      const speed = 3.8;

      const moveYaw = isXR ? this.getActiveHeadingYaw() : this.pose.yaw;
      const fx = -Math.sin(moveYaw);
      const fz = -Math.cos(moveYaw);
      const rx = Math.cos(moveYaw);
      const rz = -Math.sin(moveYaw);

      const nx = this.pose.x + (fx * normF + rx * normS) * speed * dt;
      const nz = this.pose.z + (fz * normF + rz * normS) * speed * dt;
      this.clampPositionDirect(nx, nz, state);

      // Activate peripheral comfort vignette while moving smoothly
      this.comfort.setTargetVignette(len * 0.88);
    } else {
      this.comfort.setTargetVignette(0);
    }

    // Diegetic Physical Platform Trigger in Threshold Hall (§4A.2)
    if (state.location === 'threshold') {
      if (this.pose.x < -2.4 && this.pose.z < -4.5) {
        this.comfort.triggerFadeTransition(() => {
          hubPlayerState.chooseBranchFromThreshold('ascend');
        });
      } else if (this.pose.x > 2.4 && this.pose.z < -4.5) {
        this.comfort.triggerFadeTransition(() => {
          hubPlayerState.chooseBranchFromThreshold('descend');
        });
      }
    }

    // 3. STRICT MATRIX SYNCHRONIZATION BEFORE RAYCAST & RENDER (Eliminates 1-frame XR lag!)
    const seatedOffset = state.comfortMode === 'seated' ? 0.45 : 0;
    this.playerRig.position.set(this.pose.x, seatedOffset, this.pose.z);
    this.playerRig.rotation.set(0, this.pose.yaw, 0);

    if (!isXR) {
      this.camera.position.set(0, 1.7, 0);
      this.camera.rotation.set(this.pose.pitch, 0, 0, 'YXZ');
    }

    // Force immediate world matrix update so controllers & camera rays match current frame 1:1
    this.playerRig.updateMatrixWorld(true);

    // Update Room API v1 module & Comfort System
    roomStreamer.updateCurrentRoom(dt);
    this.comfort.update(dt, state.vignetteEnabled);

    // 4. Raycast against Interactive Targets & Walkable Floor
    const hovered = this.performRaycast();

    // Render scene
    this.renderer.render(this.scene, this.camera);

    const info = this.renderer.info;
    return {
      hovered,
      telemetry: {
        fps: Math.round(this.smoothedFps),
        drawCalls: info.render.calls,
        triangles: info.render.triangles,
        geometries: info.memory.geometries,
        textures: info.memory.textures,
      },
    };
  }

  private getActiveHeadingYaw(): number {
    if (!this.renderer.xr.isPresenting) return this.pose.yaw;
    const xrCam = this.renderer.xr.getCamera();
    const dir = new THREE.Vector3();
    xrCam.getWorldDirection(dir);
    if (Math.hypot(dir.x, dir.z) < 0.001) return this.pose.yaw;
    return Math.atan2(-dir.x, -dir.z);
  }

  private clampPositionDirect(
    nx: number,
    nz: number,
    state: HubPlayerState
  ): void {
    const maxW =
      state.location === 'threshold'
        ? 9.2
        : state.location === 'corridor'
        ? 7.6
        : 6.8;
    const maxD =
      state.location === 'threshold'
        ? 10.2
        : state.location === 'corridor'
        ? 11.6
        : 7.8;
    this.pose.x = Math.max(-maxW, Math.min(maxW, nx));
    this.pose.z = Math.max(-maxD, Math.min(maxD, nz));
  }

  private clampAndApplyPosition(
    nx: number,
    nz: number,
    state: HubPlayerState
  ): void {
    this.comfort.triggerFadeTransition(() => {
      this.clampPositionDirect(nx, nz, state);
    }, 11.0);
  }

  private performRaycast(): HubHoveredResult {
    const origin = new THREE.Vector3();
    const direction = new THREE.Vector3(0, 0, -1);

    const targetMeshes = this.interactiveEntries.map((e) => e.mesh);
    let interactiveHits: THREE.Intersection<THREE.Object3D>[] = [];
    let rayUsed = false;

    // 1. Check VR controllers first when in WebXR
    if (this.renderer.xr.isPresenting) {
      for (const ctrl of this.vrControllers) {
        if (!ctrl.visible) continue;
        ctrl.getWorldPosition(origin);
        ctrl.getWorldDirection(direction);
        direction.negate();
        this.raycaster.set(origin, direction);
        rayUsed = true;
        const hits = this.raycaster.intersectObjects(targetMeshes, true);
        if (hits.length > 0) {
          interactiveHits = hits;
          break;
        }
      }
    }

    // 2. Fallback to camera center gaze
    if (interactiveHits.length === 0) {
      const cam = this.renderer.xr.isPresenting
        ? this.renderer.xr.getCamera()
        : this.camera;
      cam.getWorldPosition(origin);
      cam.getWorldDirection(direction);
      this.raycaster.set(origin, direction);
      rayUsed = true;
      interactiveHits = this.raycaster.intersectObjects(targetMeshes, true);
    }

    if (interactiveHits.length > 0) {
      const hit = interactiveHits[0];
      this.reticleMesh.visible = true;
      this.reticleMesh.position
        .copy(hit.point)
        .addScaledVector(direction, -0.04);
      this.reticleMesh.lookAt(origin);
      this.comfort.teleportRing.visible = false;

      let matched: SpatialInteractiveTarget | null = null;
      let cur: THREE.Object3D | null = hit.object;
      while (cur && !matched) {
        const found = this.interactiveEntries.find((item) => item.mesh === cur);
        if (found) matched = found.target;
        cur = cur.parent;
      }

      return {
        target: matched,
        floorHitPoint: null,
        distance: hit.distance,
      };
    }

    this.reticleMesh.visible = false;

    // 3. Check Walkable Floor for Blink-Teleport Ring
    if (rayUsed && this.walkableMeshes.length > 0) {
      const floorHits = this.raycaster.intersectObjects(
        this.walkableMeshes,
        true
      );
      if (floorHits.length > 0 && floorHits[0].distance <= 14.0) {
        const pt = floorHits[0].point;
        this.comfort.teleportRing.visible = true;
        this.comfort.teleportRing.position.set(pt.x, pt.y + 0.015, pt.z);
        return {
          target: null,
          floorHitPoint: pt,
          distance: floorHits[0].distance,
        };
      }
    }

    this.comfort.teleportRing.visible = false;
    return {
      target: null,
      floorHitPoint: null,
      distance: 0,
    };
  }
}
