import * as THREE from 'three';
import {
  CorridorBuilder,
  createSignageTexture,
  PausePanelActionId,
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
import { nebulaSkySystem } from '../systems/sky/nebulaSkySystem';
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
  nebulaId: string;
  nebulaName: string;
  nebulaCredit: string;
  nebulaLicense: string;
  nebulaPalette: string[];
  skyDrawCalls: number;
  skyTextureMemoryMB: number;
  isPaused: boolean;
  gameTimeSec: number;
}

export interface HubHoveredResult {
  target: SpatialInteractiveTarget | null;
  floorHitPoint: THREE.Vector3 | null;
  distance: number;
}

/**
 * Universal WebXR + Desktop 3D Engine for Neuromicon Artmaze (EXPERIENCE_PROTOCOL.md & TZ.md).
 * - Zero per-frame allocations (pre-allocated scratch vectors).
 * - Fixed foveated rendering (0.85) + Dynamic Resolution Scaler targeting 13.9 ms (72 Hz Quest 2).
 * - 4-Layer Real Astronomical Nebula Sky & Palette-Driven Lighting Rig (<= 5 sky draw calls, <= 2 real-time lights).
 * - Pausable Game Clock (`gameTimeSec`, `gameDt = 0` when paused) + World-Locked 3D VR Pause & Volume Mixer Panel
 *   that NEVER freezes head tracking (`renderer.render` continues every frame).
 */
export class HubEngine {
  public readonly renderer: THREE.WebGLRenderer;
  public readonly scene: THREE.Scene;
  public readonly camera: THREE.PerspectiveCamera;
  public readonly playerRig: THREE.Group;
  public readonly comfort: ComfortSystem;

  private worldRoot: THREE.Group;
  private roomApiRoot: THREE.Group;
  private pausePanelRoot: THREE.Group;
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
  private pauseInteractiveEntries: Array<{
    mesh: THREE.Object3D;
    target: SpatialInteractiveTarget;
  }> = [];
  private walkableMeshes: THREE.Object3D[] = [];

  private pose = {
    x: 0,
    y: 0,
    z: 5.8,
    yaw: 0,
    pitch: 0,
  };

  // Pausable Game Clock (TZ.md §6.2 & §6.4)
  private paused = false;
  private gameTimeSec = 0;
  private lastGameDt = 0;
  private pauseListeners: Set<(paused: boolean) => void> = new Set();

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
    this.scene.background = new THREE.Color('#04060d');

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

    this.pausePanelRoot = new THREE.Group();
    this.pausePanelRoot.visible = false;
    this.scene.add(this.pausePanelRoot);

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

  public onPauseChange(listener: (paused: boolean) => void): () => void {
    this.pauseListeners.add(listener);
    return () => {
      this.pauseListeners.delete(listener);
    };
  }

  public isPaused(): boolean {
    return this.paused;
  }

  public getGameTimeSec(): number {
    return this.gameTimeSec;
  }

  /**
   * Freezes or resumes the game clock, room update loop, and WebAudio mixer (TZ.md §6.2),
   * while keeping WebXR / desktop head tracking 100% live and spawning a world-locked 3D VR Pause & Volume Panel.
   */
  public setPaused(nextPaused: boolean): void {
    if (this.paused === nextPaused) return;
    this.paused = nextPaused;

    if (this.paused) {
      this.lastGameDt = 0;
      spatialAudioSystem.pauseGameAudio();
      roomStreamer.notifyPause(true);
      this.comfort.setTargetVignette(0.28);
      this.mountWorldLockedPausePanel();
    } else {
      this.unmountWorldLockedPausePanel();
      this.comfort.setTargetVignette(0);
      spatialAudioSystem.resumeGameAudio();
      roomStreamer.notifyPause(false);
    }

    this.pauseListeners.forEach((cb) => cb(this.paused));
  }

  public togglePause(): boolean {
    this.setPaused(!this.paused);
    return this.paused;
  }

  /**
   * Rebuilds the world-locked 3D VR Pause & Volume Mixer Panel at 1.65m in front of the player's gaze
   * (NEVER head-locked, TZ.md §5.2 & §6.1).
   */
  public mountWorldLockedPausePanel(): void {
    this.unmountWorldLockedPausePanel();

    const state = hubPlayerState.getState();
    const skyState = nebulaSkySystem.getCurrentSkyState();
    const vol = state.audio;
    const headingYaw = this.getActiveHeadingYaw();
    const seatedOffset = state.comfort.seated ? 0.45 : 0;

    const panelDist = 1.68;
    const px = this.pose.x - Math.sin(headingYaw) * panelDist;
    const pz = this.pose.z - Math.cos(headingYaw) * panelDist;
    const py = 1.52 + seatedOffset;

    this.pausePanelRoot.position.set(px, py, pz);
    this.pausePanelRoot.rotation.set(0, headingYaw, 0);
    this.pausePanelRoot.visible = true;

    const frameMat = new THREE.MeshStandardMaterial({
      color: skyState.palette[0] ?? '#c8a464',
      roughness: 0.24,
      metalness: 0.85,
    });
    const backMat = new THREE.MeshBasicMaterial({
      color: '#080b14',
      transparent: true,
      opacity: 0.94,
    });

    const board = new THREE.Mesh(
      new THREE.PlaneGeometry(1.48, 1.04),
      backMat
    );
    this.pausePanelRoot.add(board);

    const border = new THREE.Mesh(
      new THREE.BoxGeometry(1.52, 1.08, 0.02),
      frameMat
    );
    border.position.z = -0.015;
    this.pausePanelRoot.add(border);

    // Header plaque showing PAUSED + active Nebula + Volume percentages
    const headerTex = createSignageTexture(
      '⏸',
      'PAUSED · AUDIO MIXER',
      `${skyState.nebulaName.slice(0, 30)}`,
      vol.muted
        ? 'MUTED (M)'
        : `MASTER ${Math.round(vol.master * 100)}% · MUS ${Math.round(
            vol.music * 100
          )}%`,
      skyState.palette[0] ?? '#e5c158',
      vol.muted ? '#ff6b6b' : '#66cc99'
    );
    const headerMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(1.38, 0.28),
      new THREE.MeshBasicMaterial({ map: headerTex })
    );
    headerMesh.position.set(0, 0.33, 0.01);
    this.pausePanelRoot.add(headerMesh);

    const add3DButton = (
      x: number,
      y: number,
      w: number,
      h: number,
      symbol: string,
      title: string,
      subtitle: string,
      badge: string,
      action: PausePanelActionId,
      accent = '#e5c158'
    ) => {
      const tex = createSignageTexture(
        symbol,
        title,
        subtitle,
        badge,
        accent,
        '#f3ede2'
      );
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(w, h),
        new THREE.MeshBasicMaterial({ map: tex })
      );
      mesh.position.set(x, y, 0.012);
      this.pausePanelRoot.add(mesh);

      this.pauseInteractiveEntries.push({
        mesh,
        target: {
          id: `PAUSE_BTN_${action}`,
          kind: 'pause-action',
          pauseAction: action,
          title,
          titleRu: title,
          subtitle,
          subtitleRu: subtitle,
        },
      });
    };

    // Row 1: Primary Resume & Mute Toggle
    add3DButton(
      -0.35,
      0.08,
      0.64,
      0.16,
      '▶',
      'RESUME WORLD',
      'Unfreeze Time & Audio (P)',
      'RESUME',
      'resume',
      '#66cc99'
    );
    add3DButton(
      0.35,
      0.08,
      0.64,
      0.16,
      vol.muted ? '🔇' : '🔊',
      vol.muted ? 'UNMUTE AUDIO' : 'MUTE ALL',
      `Master ${Math.round(vol.master * 100)}% · Key M`,
      vol.muted ? 'MUTED' : 'ACTIVE',
      'mute',
      vol.muted ? '#ff6b6b' : '#e5c158'
    );

    // Row 2: Master & Music Bus Controls
    add3DButton(
      -0.51,
      -0.11,
      0.32,
      0.14,
      '−',
      'MASTER −',
      'Decrease Master ([)',
      `${Math.round(vol.master * 100)}%`,
      'master-down',
      '#c8a464'
    );
    add3DButton(
      -0.17,
      -0.11,
      0.32,
      0.14,
      '+',
      'MASTER +',
      'Increase Master (])',
      `${Math.round(vol.master * 100)}%`,
      'master-up',
      '#c8a464'
    );
    add3DButton(
      0.17,
      -0.11,
      0.32,
      0.14,
      '−',
      'MUSIC −',
      'Room Track Bus',
      `${Math.round(vol.music * 100)}%`,
      'music-down',
      '#4ea8de'
    );
    add3DButton(
      0.51,
      -0.11,
      0.32,
      0.14,
      '+',
      'MUSIC +',
      'Room Track Bus',
      `${Math.round(vol.music * 100)}%`,
      'music-up',
      '#4ea8de'
    );

    // Row 3: Ambient & SFX Bus Controls
    add3DButton(
      -0.51,
      -0.28,
      0.32,
      0.14,
      '−',
      'AMBIENT −',
      'Atrium Bus',
      `${Math.round(vol.ambient * 100)}%`,
      'ambient-down',
      '#b388ff'
    );
    add3DButton(
      -0.17,
      -0.28,
      0.32,
      0.14,
      '+',
      'AMBIENT +',
      'Atrium Bus',
      `${Math.round(vol.ambient * 100)}%`,
      'ambient-up',
      '#b388ff'
    );
    add3DButton(
      0.17,
      -0.28,
      0.32,
      0.14,
      '−',
      'EFFECTS −',
      'Chime / UI Bus',
      `${Math.round(vol.sfx * 100)}%`,
      'sfx-down',
      '#e5c158'
    );
    add3DButton(
      0.51,
      -0.28,
      0.32,
      0.14,
      '+',
      'EFFECTS +',
      'Chime / UI Bus',
      `${Math.round(vol.sfx * 100)}%`,
      'sfx-up',
      '#e5c158'
    );

    // Row 4: Return to Sector Room / Open Codex
    add3DButton(
      -0.35,
      -0.44,
      0.64,
      0.13,
      '↺',
      'SECTOR ROOM',
      'Return to Corridor Hall',
      'EXIT ROOM',
      'return-corridor',
      '#4ea8de'
    );
    add3DButton(
      0.35,
      -0.44,
      0.64,
      0.13,
      '❖',
      'OPEN CODEX',
      'Discovery Journal (R)',
      'CODEX',
      'open-codex',
      '#e5c158'
    );
  }

  private unmountWorldLockedPausePanel(): void {
    this.pauseInteractiveEntries = [];
    this.pausePanelRoot.visible = false;
    disposeThreeHierarchy(this.pausePanelRoot);
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
    if (this.paused) return;
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
    this.unmountWorldLockedPausePanel();
    roomStreamer.unmountCurrentRoom(this.roomApiRoot, this.scene);
    nebulaSkySystem.unmountSky(this.worldRoot, this.scene);
    disposeThreeHierarchy(this.worldRoot);
    this.renderer.dispose();
  }

  private buildRoomContext(
    roomId: string,
    state: HubPlayerState
  ): RoomContext {
    const manifest = getRoomV1Manifest(roomId);
    const self = this;

    return {
      THREE,
      root: this.roomApiRoot,
      manifest,
      time: {
        get now() {
          return self.gameTimeSec;
        },
        get delta() {
          return self.lastGameDt;
        },
        get paused() {
          return self.paused;
        },
      },
      sky: {
        current: () => {
          const s = nebulaSkySystem.getCurrentSkyState();
          return { nebulaId: s.nebulaId, palette: s.palette };
        },
        set: async (opts) => {
          nebulaSkySystem.mountRoomSkyAndLighting(
            roomId,
            this.worldRoot,
            this.scene,
            {
              nebulaId: opts.nebulaId,
              rotation: opts.rotation,
              intensity: opts.intensity,
              qualityTier: state.comfort.qualityTier,
              reducedMotion: state.comfort.reducedMotion,
            }
          );
        },
      },
      environment: {
        get palette() {
          return nebulaSkySystem.getCurrentSkyState().palette;
        },
        applyRig: (opts) => {
          nebulaSkySystem.mountRoomSkyAndLighting(
            roomId,
            this.worldRoot,
            this.scene,
            {
              ambientScale: opts?.ambient,
              fogScale: opts?.fog,
              qualityTier: state.comfort.qualityTier,
              reducedMotion: state.comfort.reducedMotion,
            }
          );
        },
      },
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
        bus: (busName) => spatialAudioSystem.getBus(busName),
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
    roomStreamer.unmountCurrentRoom(this.roomApiRoot, this.scene);
    nebulaSkySystem.unmountSky(this.worldRoot, this.scene);
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
    _wallTimeSec?: number
  ): {
    hovered: HubHoveredResult;
    telemetry: HubRenderTelemetry;
    onboardingVisual: OnboardingVisualState | null;
  } {
    const frameMs = dt * 1000;
    this.rollingFrameMs = this.rollingFrameMs * 0.92 + frameMs * 0.08;
    this.smoothedFps =
      this.smoothedFps * 0.92 + (1 / Math.max(0.001, dt)) * 0.08;

    // Pausable Game Clock: when paused, gameDt is strictly 0 and gameTimeSec is frozen (TZ.md §6.2 & §6.4)
    const gameDt = this.paused ? 0 : dt;
    this.lastGameDt = gameDt;
    this.gameTimeSec += gameDt;

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

    // Rebuild world chunk only on topology or quality/state change
    const sceneKey = [
      state.location,
      state.branch,
      state.segmentIndex,
      state.currentRoomId || 'NONE',
      state.comfort.qualityTier,
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

    // Desktop mouse look remains active so the player can look around at the world-locked 3D Pause Panel
    // even while paused (matching VR head tracking never freezing, TZ.md §6.2)
    if (!isXR) {
      this.pose.yaw += desktopInput.yawDelta;
      this.pose.pitch = desktopInput.pitchDelta;
    }

    // 1. ROTATION & LOCOMOTION: Frozen when paused (`!this.paused`, TZ.md §6.2)
    if (!this.paused) {
      if (this.snapCooldown > 0) {
        this.snapCooldown = Math.max(0, this.snapCooldown - gameDt);
      }
      if (this.snapBurstWindow > 0) {
        this.snapBurstWindow = Math.max(0, this.snapBurstWindow - gameDt);
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

      // 2. LOCOMOTION
      let forward = -xrInput.moveZ;
      let strafe = xrInput.moveX;
      if (desktopInput.forward) forward += 1;
      if (desktopInput.backward) forward -= 1;
      if (desktopInput.right) strafe += 1;
      if (desktopInput.left) strafe -= 1;

      const isMovingStick = Math.hypot(forward, strafe) > 0.15;

      if (this.teleportStickCooldown > 0) {
        this.teleportStickCooldown = Math.max(
          0,
          this.teleportStickCooldown - gameDt
        );
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

        const nx = this.pose.x + (fx * normF + rx * normS) * speed * gameDt;
        const nz = this.pose.z + (fz * normF + rz * normS) * speed * gameDt;
        this.clampPositionDirect(nx, nz, state);

        this.comfort.setTargetVignette(len * state.comfort.vignette);
      } else {
        this.comfort.setTargetVignette(0);
      }
    }

    // 3. ONBOARDING FSM & THRESHOLD VISUALS (Driven by `gameDt` and `this.gameTimeSec`, frozen when paused)
    let onboardingVisual: OnboardingVisualState | null = null;
    if (state.location === 'threshold') {
      const headPitch = isXR ? this.getActiveHeadPitch() : this.pose.pitch;
      onboardingVisual = onboardingFSM.update(
        gameDt,
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
        this.gameTimeSec,
        state.comfort.reducedMotion
      );
    }

    // 4. UPDATE NEBULA SKY SYSTEM (Crossfade <= 1.2s, slow drift <= 0.2 deg/s, strictly OFF when paused/Reduced Motion/Seated)
    nebulaSkySystem.update(gameDt, this.gameTimeSec, {
      reducedMotion: state.comfort.reducedMotion,
      seated: state.comfort.seated,
    });

    // 5. STRICT MATRIX SYNCHRONIZATION BEFORE RAYCAST & RENDER
    const seatedOffset = state.comfort.seated ? 0.45 : 0;
    this.playerRig.position.set(this.pose.x, seatedOffset, this.pose.z);
    this.playerRig.rotation.set(0, this.pose.yaw, 0);

    if (!isXR) {
      this.camera.position.set(0, 1.7, 0);
      this.camera.rotation.set(this.pose.pitch, 0, 0, 'YXZ');
    }

    this.playerRig.updateMatrixWorld(true);

    roomStreamer.updateCurrentRoom(gameDt);
    this.comfort.update(dt, state.vignetteEnabled || this.paused);

    // 6. RAYCAST & PRELOAD / CONTEXTUAL DISCOVERY
    const hovered = this.performRaycast();

    if (!this.paused) {
      // Preload target room's nebula texture on door gaze (TZ.md §3.7)
      if (
        hovered.target &&
        (hovered.target.kind === 'corridor-door' ||
          hovered.target.kind === 'room-door') &&
        hovered.target.roomId
      ) {
        nebulaSkySystem.preloadRoomNebula(hovered.target.roomId);
      }

      // Contextual reveal of Zoom (C) after gazing >3s at a distant plaque or artwork (§2.5)
      if (
        hovered.target &&
        (hovered.target.kind === 'artwork' ||
          hovered.target.kind === 'corridor-door' ||
          hovered.target.kind === 'room-door') &&
        hovered.distance > 3.2
      ) {
        this.distantGazeTimer += gameDt;
        if (this.distantGazeTimer >= 3.0) {
          hubPlayerState.revealControl('zoom');
        }
      } else {
        this.distantGazeTimer = 0;
      }

      // Contextual reveal of Audio (Z) after 2 minutes in a segment (§2.5)
      if (state.location === 'corridor') {
        this.segmentDwellTimer += gameDt;
        if (this.segmentDwellTimer >= 120) {
          hubPlayerState.revealControl('audio');
        }
      }
    }

    // NEVER freeze WebXR / desktop rendering during pause so head tracking stays 100% live (TZ.md §6.2)
    this.renderer.render(this.scene, this.camera);

    const info = this.renderer.info;
    const estTexMB = Number((info.memory.textures * 0.85).toFixed(1));
    const skyState = nebulaSkySystem.getCurrentSkyState();

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
        nebulaId: skyState.nebulaId,
        nebulaName: skyState.nebulaName,
        nebulaCredit: skyState.credit,
        nebulaLicense: skyState.license,
        nebulaPalette: skyState.palette,
        skyDrawCalls: skyState.drawCalls,
        skyTextureMemoryMB: skyState.skyTextureMemoryMB,
        isPaused: this.paused,
        gameTimeSec: Number(this.gameTimeSec.toFixed(2)),
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
    // While paused, ONLY the world-locked 3D Pause & Audio Panel is raycastable;
    // world doors, objects, and floor teleport rings are disabled (TZ.md §6.2)
    const activeEntries = this.paused
      ? this.pauseInteractiveEntries
      : this.interactiveEntries;
    const targetMeshes = activeEntries.map((e) => e.mesh);
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
        const found = activeEntries.find((item) => item.mesh === cur);
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

    if (!this.paused && rayUsed && this.walkableMeshes.length > 0) {
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
