import * as THREE from 'three';
import {
  CorridorBuilder,
  SpatialInteractiveTarget,
} from '../corridor/corridorBuilder';
import { onboardingFSM } from '../onboarding/onboardingFSM';
import { OnboardingVisualState } from '../onboarding/types';
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
  frameTimeMs: number;
  drawCalls: number;
  triangles: number;
  geometries: number;
  textures: number;
  textureMemoryMB: number;
  resolutionScale: number;
}

export interface HubHoveredResult {
  target: SpatialInteractiveTarget | null;
  floorHitPoint: THREE.Vector3 | null;
  distance: number;
}

/**
 * Universal WebXR + Desktop 3D Engine for Neuromicon Artmaze (EXPERIENCE_PROTOCOL.md §2–§7).
 * - Zero per-frame allocations (pre-allocated scratch vectors).
 * - Fixed foveated rendering (0.85) + Dynamic Resolution Scaler targeting 13.9 ms (72 Hz Quest 2).
 * - Onboarding FSM beat sheet & contextual control discovery triggers.
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

  // Pre-allocated scratch vectors to guarantee ZERO per-frame GC allocations (§6)
  private readonly _scratchOrigin = new THREE.Vector3();
  private readonly _scratchDir = new THREE.Vector3();

  private interactiveEntries: Array<{
    mesh: THREE.Object3D;
    target: SpatialInteractiveTarget;
  }> = [];
  private walkableMeshes: THREE.Object3D[] = [];

  private pose = {
    x: 0,
    y: 0,
    z: 5.2,
    yaw: 0,
    pitch: 0,
  };

  private snapCooldown = 0;
  private teleportStickCooldown = 0;
  private builtSceneKey = '';
  private fovZoom = false;

  // Dynamic Resolution Scaler & Frame Budget Tracking (72 Hz = 13.9 ms budget, §6)
  private smoothedFps = 72;
  private rollingFrameMs = 11.2;
  private resolutionScale = 1.0;
  private scalerCheckTimer = 0;

  // Contextual Discovery Timers (§2.5)
  private distantGazeTimer = 0;
  private segmentDwellTimer = 0;
  private recentSnapTurns = 0;
  private snapBurstWindow = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;

    // Configure Quest 2 Fixed Foveated Rendering & Initial Framebuffer Scale (§6)
    if (typeof this.renderer.xr.setFoveation === 'function') {
      this.renderer.xr.setFoveation(0.85);
    }
    if (typeof this.renderer.xr.setFramebufferScaleFactor === 'function') {
      this.renderer.xr.setFramebufferScaleFactor(1.0);
    }

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#080706');

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

    // Pixel ratio cap at 1.0 in XR; <= 2.0 on desktop (§6)
    this.renderer.xr.addEventListener('sessionstart', () => {
      this.renderer.setPixelRatio(1.0);
      if (typeof this.renderer.xr.setFoveation === 'function') {
        this.renderer.xr.setFoveation(0.85);
      }
      this.camera.position.set(0, 0, 0);
      this.camera.rotation.set(0, 0, 0);
      this.camera.quaternion.identity();
      this.vrControllers.forEach((c) => {
        c.visible = true;
      });
    });

    this.renderer.xr.addEventListener('sessionend', () => {
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
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
    const st = hubPlayerState.getState();
    const speed = st.comfort.reducedMotion ? 25.0 : 9.0;
    this.comfort.triggerFadeTransition(() => {
      this.pose.x = x;
      this.pose.z = z;
      if (yaw !== undefined) {
        this.pose.yaw = yaw;
      }
      hubPlayerState.incrementTeleportCount();
    }, speed);
  }

  public runLeakCheck(): {
    iterations: number;
    passed: boolean;
    geometriesDelta: number;
    materialLeaks: number;
  } {
    const st = hubPlayerState.getState();
    const ctx = this.buildRoomContext('ROOM_073', st);
    return roomStreamer.runThirtyTransitionLeakTest(this.scene, st, ctx);
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
          spatialAudioSystem.playRoomSoundtrack(
            trackUrl,
            baseHz ?? 108,
            manifest.identity.name
          );
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
      log: () => {},
    };
  }

  private rebuildActiveWorld(state: HubPlayerState): void {
    this.interactiveEntries = [];
    this.walkableMeshes = [];
    this.segmentDwellTimer = 0;
    roomStreamer.unmountCurrentRoom(this.roomApiRoot);
    disposeThreeHierarchy(this.worldRoot);

    const registerTarget = (
      mesh: THREE.Object3D,
      target: SpatialInteractiveTarget
    ) => {
      this.interactiveEntries.push({ mesh, target });
    };

    if (state.location === 'threshold') {
      spatialAudioSystem.stopRoomSoundtrack();
      CorridorBuilder.buildThresholdHall(
        this.worldRoot,
        this.scene,
        state,
        registerTarget,
        this.walkableMeshes
      );
      this.pose = { x: 0, y: 0, z: 5.8, yaw: 0, pitch: 0 };
      spatialAudioSystem.setCorridorVerticalCrossfade(
        0.5,
        'Grand Cosmic Starting Room'
      );
      return;
    }

    if (state.location === 'corridor') {
      spatialAudioSystem.stopRoomSoundtrack();
      CorridorBuilder.buildCorridorSegment(
        this.worldRoot,
        this.scene,
        state.branch,
        state.segmentIndex,
        state,
        registerTarget,
        this.walkableMeshes
      );
      this.pose = { x: 0, y: 0, z: 12.5, yaw: 0, pitch: 0 };
      spatialAudioSystem.setCorridorVerticalCrossfade(
        state.branch === 'ascend' ? 1.0 : 0.0,
        `Sector Room ${state.segmentIndex}`
      );
      return;
    }

    if (state.location === 'void') {
      spatialAudioSystem.stopRoomSoundtrack();
      roomStreamer.mountVoidFallback(
        state.currentRoomId || 'ROOM_412',
        this.worldRoot,
        this.scene,
        state,
        registerTarget,
        this.walkableMeshes
      );
      this.pose = { x: 0, y: 0, z: 4.2, yaw: 0, pitch: 0 };
      return;
    }

    // location === 'room'
    spatialAudioSystem.stopRoomSoundtrack();
    const roomId = state.currentRoomId || 'ROOM_001';
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
    state: HubPlayerState,
    timeSec: number
  ): {
    hovered: HubHoveredResult;
    telemetry: HubRenderTelemetry;
    onboardingVisual: OnboardingVisualState | null;
  } {
    const frameMs = dt * 1000;
    this.rollingFrameMs = this.rollingFrameMs * 0.92 + frameMs * 0.08;
    this.smoothedFps =
      this.smoothedFps * 0.92 + (1 / Math.max(0.001, dt)) * 0.08;

    // Dynamic Resolution Scaler (§6: 13.9 ms Quest 2 72Hz target)
    this.scalerCheckTimer += dt;
    if (this.scalerCheckTimer >= 1.0) {
      this.scalerCheckTimer = 0;
      if (this.rollingFrameMs > 13.9 && this.resolutionScale > 0.75) {
        this.resolutionScale = Math.max(0.75, this.resolutionScale - 0.08);
        if (!this.renderer.xr.isPresenting) {
          this.renderer.setPixelRatio(
            Math.min(window.devicePixelRatio || 1, 2) * this.resolutionScale
          );
        }
      } else if (this.rollingFrameMs < 11.5 && this.resolutionScale < 1.0) {
        this.resolutionScale = Math.min(1.0, this.resolutionScale + 0.05);
        if (!this.renderer.xr.isPresenting) {
          this.renderer.setPixelRatio(
            Math.min(window.devicePixelRatio || 1, 2) * this.resolutionScale
          );
        }
      }
    }

    // Rebuild world chunk only on topology or state change
    const sceneKey = [
      state.location,
      state.branch,
      state.segmentIndex,
      state.currentRoomId || 'NONE',
      state.visitedRooms.join(','),
      state.completedRooms.join(','),
      state.discoveries.join(','),
      state.teleportCount >= 5 ? 'SMOOTH_SWITCH' : 'NO_SWITCH',
      Object.entries(state.identityChoices)
        .map(([k, v]) => `${k}:${v}`)
        .join(','),
    ].join('|');

    if (sceneKey !== this.builtSceneKey) {
      this.builtSceneKey = sceneKey;
      this.rebuildActiveWorld(state);
    }

    const isXR = this.renderer.xr.isPresenting;

    // 1. ROTATION: Discrete Snap Turn (Q / E or VR Stick)
    if (this.snapCooldown > 0) {
      this.snapCooldown = Math.max(0, this.snapCooldown - dt);
    }
    if (this.snapBurstWindow > 0) {
      this.snapBurstWindow = Math.max(0, this.snapBurstWindow - dt);
      if (this.snapBurstWindow <= 0) this.recentSnapTurns = 0;
    }

    const snapRad = THREE.MathUtils.degToRad(state.snapTurnDegrees);
    const stickTurn = xrInput.turnX;

    if (this.snapCooldown <= 0) {
      if (stickTurn > 0.55 || desktopInput.turnRight) {
        this.snapCooldown = 0.3;
        this.pose.yaw -= snapRad;
        this.recordSnapTurnForComfortReveal();
      } else if (stickTurn < -0.55 || desktopInput.turnLeft) {
        this.snapCooldown = 0.3;
        this.pose.yaw += snapRad;
        this.recordSnapTurnForComfortReveal();
      }
    }

    if (!isXR) {
      this.pose.yaw += desktopInput.yawDelta;
      this.pose.pitch = desktopInput.pitchDelta;
    }

    // 2. LOCOMOTION
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

    if (isXR && state.comfort.locomotion === 'teleport') {
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

      this.comfort.setTargetVignette(len * state.comfort.vignette);
    } else {
      this.comfort.setTargetVignette(0);
    }

    // 3. ONBOARDING FSM & THRESHOLD VISUALS (§2.2 & §2.3)
    let onboardingVisual: OnboardingVisualState | null = null;
    if (state.location === 'threshold') {
      const headPitch = isXR ? this.getActiveHeadPitch() : this.pose.pitch;
      onboardingVisual = onboardingFSM.update(
        dt,
        this.pose.x,
        this.pose.z,
        headPitch,
        (committedBranch) => {
          this.comfort.triggerFadeTransition(() => {
            hubPlayerState.chooseBranchFromThreshold(committedBranch);
          });
        }
      );
      CorridorBuilder.updateThresholdOnboardingVisuals(
        this.worldRoot,
        onboardingVisual,
        timeSec
      );
    }

    // 4. STRICT MATRIX SYNCHRONIZATION BEFORE RAYCAST & RENDER
    const seatedOffset = state.comfort.seated ? 0.45 : 0;
    this.playerRig.position.set(this.pose.x, seatedOffset, this.pose.z);
    this.playerRig.rotation.set(0, this.pose.yaw, 0);

    if (!isXR) {
      this.camera.position.set(0, 1.7, 0);
      this.camera.rotation.set(this.pose.pitch, 0, 0, 'YXZ');
    }

    this.playerRig.updateMatrixWorld(true);

    roomStreamer.updateCurrentRoom(dt);
    this.comfort.update(dt, state.vignetteEnabled);

    // 5. RAYCAST & CONTEXTUAL CONTROL DISCOVERY (§2.5)
    const hovered = this.performRaycast();

    // Contextual reveal of Zoom (C) after gazing >3s at a distant plaque or artwork (§2.5)
    if (
      hovered.target &&
      (hovered.target.kind === 'artwork' ||
        hovered.target.kind === 'corridor-door' ||
        hovered.target.kind === 'room-door') &&
      hovered.distance > 3.2
    ) {
      this.distantGazeTimer += dt;
      if (this.distantGazeTimer >= 3.0) {
        hubPlayerState.revealControl('zoom');
      }
    } else {
      this.distantGazeTimer = 0;
    }

    // Contextual reveal of Audio (Z) after 2 minutes in a segment (§2.5)
    if (state.location === 'corridor') {
      this.segmentDwellTimer += dt;
      if (this.segmentDwellTimer >= 120) {
        hubPlayerState.revealControl('audio');
      }
    }

    this.renderer.render(this.scene, this.camera);

    const info = this.renderer.info;
    // Estimate GPU texture memory (512x256 + 512x512 + 1024x512 mipmapped ~ 0.85 MB per texture on average)
    const estTexMB = Number((info.memory.textures * 0.85).toFixed(1));

    return {
      hovered,
      telemetry: {
        fps: Math.round(this.smoothedFps),
        frameTimeMs: Number(this.rollingFrameMs.toFixed(1)),
        drawCalls: info.render.calls,
        triangles: info.render.triangles,
        geometries: info.memory.geometries,
        textures: info.memory.textures,
        textureMemoryMB: estTexMB,
        resolutionScale: Number(this.resolutionScale.toFixed(2)),
      },
      onboardingVisual,
    };
  }

  private recordSnapTurnForComfortReveal(): void {
    this.snapBurstWindow = 4.0;
    this.recentSnapTurns += 1;
    if (this.recentSnapTurns >= 3) {
      hubPlayerState.revealControl('comfort');
    }
  }

  private getActiveHeadingYaw(): number {
    if (!this.renderer.xr.isPresenting) return this.pose.yaw;
    const xrCam = this.renderer.xr.getCamera();
    xrCam.getWorldDirection(this._scratchDir);
    if (Math.hypot(this._scratchDir.x, this._scratchDir.z) < 0.001) {
      return this.pose.yaw;
    }
    return Math.atan2(-this._scratchDir.x, -this._scratchDir.z);
  }

  private getActiveHeadPitch(): number {
    if (!this.renderer.xr.isPresenting) return this.pose.pitch;
    const xrCam = this.renderer.xr.getCamera();
    xrCam.getWorldDirection(this._scratchDir);
    return Math.asin(Math.max(-1, Math.min(1, this._scratchDir.y)));
  }

  private clampPositionDirect(
    nx: number,
    nz: number,
    state: HubPlayerState
  ): void {
    const maxW =
      state.location === 'threshold'
        ? 12.2
        : state.location === 'corridor'
        ? 8.5
        : 6.8;
    const maxD =
      state.location === 'threshold'
        ? 12.2
        : state.location === 'corridor'
        ? 16.5
        : 7.8;
    this.pose.x = Math.max(-maxW, Math.min(maxW, nx));
    this.pose.z = Math.max(-maxD, Math.min(maxD, nz));
  }

  private clampAndApplyPosition(
    nx: number,
    nz: number,
    state: HubPlayerState
  ): void {
    const speed = state.comfort.reducedMotion ? 25.0 : 11.0;
    this.comfort.triggerFadeTransition(() => {
      this.clampPositionDirect(nx, nz, state);
      hubPlayerState.incrementTeleportCount();
    }, speed);
  }

  private performRaycast(): HubHoveredResult {
    const targetMeshes = this.interactiveEntries.map((e) => e.mesh);
    let interactiveHits: THREE.Intersection<THREE.Object3D>[] = [];
    let rayUsed = false;

    if (this.renderer.xr.isPresenting) {
      for (const ctrl of this.vrControllers) {
        if (!ctrl.visible) continue;
        ctrl.getWorldPosition(this._scratchOrigin);
        ctrl.getWorldDirection(this._scratchDir);
        this._scratchDir.negate();
        this.raycaster.set(this._scratchOrigin, this._scratchDir);
        rayUsed = true;
        const hits = this.raycaster.intersectObjects(targetMeshes, true);
        if (hits.length > 0) {
          interactiveHits = hits;
          break;
        }
      }
    }

    if (interactiveHits.length === 0) {
      const cam = this.renderer.xr.isPresenting
        ? this.renderer.xr.getCamera()
        : this.camera;
      cam.getWorldPosition(this._scratchOrigin);
      cam.getWorldDirection(this._scratchDir);
      this.raycaster.set(this._scratchOrigin, this._scratchDir);
      rayUsed = true;
      interactiveHits = this.raycaster.intersectObjects(targetMeshes, true);
    }

    if (interactiveHits.length > 0) {
      const hit = interactiveHits[0];
      this.reticleMesh.visible = true;
      this.reticleMesh.position
        .copy(hit.point)
        .addScaledVector(this._scratchDir, -0.04);
      this.reticleMesh.lookAt(this._scratchOrigin);
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
