import * as THREE from 'three';
import { validateRoomManifest } from '../tools/room-validator/validator';
import {
  hexToOklab,
  resolveRoomNebulaMapping,
  validateNebulaRegistryAndCoverage,
} from '../tools/space-assets/pipeline';
import {
  audioMixer,
  sliderToPerceptualGain,
} from '../src/systems/audio/mixer';
import { hubPlayerState, migratePlayerState } from '../src/state/playerState';
import {
  getCanonicalRoomPayload,
  getRoomV1Manifest,
  roomStreamer,
} from '../src/world/roomStreamer';
import { RoomContext } from '../src/room-sdk';
import room0000 from '../main-maze/room.json';
import room0001 from '../rooms/ArtMaze-Room-0001/room.json';
import room0042 from '../rooms/ArtMaze-Room-0042/room.json';
import room0107 from '../rooms/ArtMaze-Room-0107/room.json';
import room0204 from '../rooms/ArtMaze-Room-0204/room.json';
import room0404 from '../rooms/ArtMaze-Room-0404/room.json';
import room0999 from '../rooms/ArtMaze-Room-0999/room.json';

/**
 * Self-contained verification suite for ROOM_SPEC v1.0 manifests, Real Astronomical Nebula Skies (TZ.md §3),
 * 4-Bus Perceptual Audio Mixer (`music`, `ambient`, `sfx`, `voice`, TZ.md §5),
 * Unknown Room Safe Handling, and Pause / State Migration (TZ.md §6–§7).
 */
export function runRepositoryValidationSuite(): {
  passed: boolean;
  results: Array<{ id: string; valid: boolean; errorCount: number }>;
  nebulaReport: ReturnType<typeof validateNebulaRegistryAndCoverage>;
  mixerCurvePassed: boolean;
  migrationPassed: boolean;
  unknownRoomSafePassed: boolean;
} {
  const manifests = [
    room0000,
    room0001,
    room0042,
    room0107,
    room0204,
    room0404,
    room0999,
  ];
  const results = manifests.map((m) => {
    const res = validateRoomManifest(m);
    return {
      id: res.roomId ?? 'UNKNOWN',
      valid: res.valid,
      errorCount: res.errors.length,
    };
  });

  // 1. Validate 25 Real Astronomical Nebulae, All-Sky Starfield, Licenses & 1,149-Room Coverage (TZ.md §3.2–§3.5)
  const nebulaReport = validateNebulaRegistryAndCoverage();
  const oklabSample = hexToOklab('#c46a3a');
  const room01Map = resolveRoomNebulaMapping('ROOM_001');
  const room1149Map = resolveRoomNebulaMapping('ROOM_1149');
  const skyValid =
    nebulaReport.valid &&
    nebulaReport.totalCoveredRooms === 1149 &&
    oklabSample[0] > 0 &&
    room01Map.nebula.id === 'NEB_0001' &&
    Boolean(room1149Map.nebula.id);

  // 2. Validate Perceptual v^2 Gain Curve & All 4 Buses (`music`, `ambient`, `sfx`, `voice`, TZ.md §5.1–§5.4)
  const g0 = sliderToPerceptualGain(0);
  const gHalf = sliderToPerceptualGain(0.5);
  const gFull = sliderToPerceptualGain(1);
  audioMixer.setVolumeState({
    master: 0.5,
    music: 0.5,
    ambient: 0.8,
    sfx: 0.6,
    voice: 0.4,
    muted: false,
  });
  const effectiveMusic = audioMixer.getEffectiveLinearGain('music');
  const effectiveAmbient = audioMixer.getEffectiveLinearGain('ambient');
  const effectiveSfx = audioMixer.getEffectiveLinearGain('sfx');
  const effectiveVoice = audioMixer.getEffectiveLinearGain('voice');
  audioMixer.pauseForGamePause();
  const pausedGain = audioMixer.getEffectiveLinearGain('music');
  const pausedVoice = audioMixer.getEffectiveLinearGain('voice');
  audioMixer.resumeFromGamePause();

  const mixerCurvePassed =
    g0 === 0 &&
    gHalf === 0.25 &&
    gFull === 1 &&
    Math.abs(effectiveMusic - 0.0625) < 0.001 &&
    Math.abs(effectiveAmbient - 0.16) < 0.001 &&
    Math.abs(effectiveSfx - 0.09) < 0.001 &&
    Math.abs(effectiveVoice - 0.04) < 0.001 &&
    pausedGain === 0 &&
    pausedVoice === 0;

  // 3. Validate Unknown Room Safe Handling (never substitutes ROOM_001!)
  const unknownManifest = getRoomV1Manifest('ROOM_UNKNOWN_9999');
  const knownManifest = getRoomV1Manifest('ROOM_001');
  const unknownRoomSafePassed =
    unknownManifest === null && knownManifest?.id === 'ROOM_001';

  // 4. Validate PlayerState v1 -> v4 Migration with 4-Bus Audio Persistence (TZ.md §5.3)
  const migrated = migratePlayerState({
    version: 1,
    path: 'ascend',
    visitedRooms: ['ROOM_001'],
  });
  const migrationPassed =
    migrated.state.version === 4 &&
    migrated.state.audio.master === 0.7 &&
    migrated.state.audio.music === 0.8 &&
    migrated.state.audio.ambient === 0.8 &&
    migrated.state.audio.sfx === 0.8 &&
    migrated.state.audio.voice === 0.8 &&
    migrated.state.audio.muted === false;

  return {
    passed:
      results.every((r) => r.valid) &&
      skyValid &&
      mixerCurvePassed &&
      unknownRoomSafePassed &&
      migrationPassed,
    results,
    nebulaReport,
    mixerCurvePassed,
    migrationPassed,
    unknownRoomSafePassed,
  };
}

/**
 * Asynchronous cryptographic SHA-256 verification & 30-transition GPU resource leak verification.
 */
export async function runAsyncIntegrityAndLeakVerification(): Promise<{
  sha256ReadyRoomsPassed: boolean;
  sha256TamperRejected: boolean;
  sha256MismatchRejected: boolean;
  sha256UnknownRejected: boolean;
  leakTestResult: ReturnType<typeof roomStreamer.runThirtyTransitionLeakTest>;
}> {
  // 1. Verify all 25 ready rooms pass SHA-256 verification against world.graph.json
  let allReadyValid = true;
  for (let i = 1; i <= 25; i++) {
    const rid = `ROOM_${String(i).padStart(3, '0')}`;
    const ok = await roomStreamer.verifyRoomEntryHash(rid);
    if (!ok) {
      allReadyValid = false;
      break;
    }
  }

  // 2. Verify tampered payload (1 byte altered) is strictly rejected
  const validPayload = getCanonicalRoomPayload('ROOM_001') ?? '';
  const tamperedOk = await roomStreamer.verifyRoomEntryHash(
    'ROOM_001',
    `${validPayload} `
  );
  const sha256TamperRejected = tamperedOk === false;

  // 3. Verify wrong expected hash is strictly rejected
  const mismatchOk = await roomStreamer.verifyRoomEntryHash(
    'ROOM_001',
    validPayload,
    'sha256-0000000000000000000000000000000000000000000000000000000000000000'
  );
  const sha256MismatchRejected = mismatchOk === false;

  // 4. Verify planned & unknown rooms are strictly rejected
  const plannedOk = await roomStreamer.verifyRoomEntryHash('ROOM_1149');
  const unknownOk = await roomStreamer.verifyRoomEntryHash('ROOM_9999');
  const sha256UnknownRejected = plannedOk === false && unknownOk === false;

  // 5. Run 30-Transition GPU Memory Leak Verification with simulated WebGLInfo memory counter
  const scene = new THREE.Scene();
  const state = hubPlayerState.getState();
  const dummyRoot = new THREE.Group();
  const manifest01 = getRoomV1Manifest('ROOM_001')!;

  const dummyCtx: RoomContext = {
    THREE,
    root: dummyRoot,
    manifest: manifest01,
    time: { now: 0, delta: 0.016, paused: false },
    sky: {
      current: () => ({
        nebulaId: 'NEB_0001',
        palette: ['#c46a3a', '#2b5f8c', '#e8d9b5'],
      }),
      set: async () => {},
    },
    environment: {
      palette: ['#c46a3a', '#2b5f8c', '#e8d9b5'],
      applyRig: () => {},
    },
    xr: { isPresenting: false, controllers: [] },
    audio: {
      playRoomTrack: () => {},
      triggerTone: () => {},
      bus: () => null,
    },
    state: {
      getPath: () => 'ascend',
      isQuestCompleted: () => false,
      getIdentityChoice: () => undefined,
      hasDiscovery: () => false,
      unlockDiscovery: () => {},
    },
    doors: {
      openDoor: () => {},
      returnToCorridor: () => {},
    },
    exit: () => {},
    mirror: { choose: () => {} },
    quest: { completeObjective: () => {} },
    radio: { broadcast: () => {}, getMessages: () => [] },
    comfort: {
      fadeTransition: (cb) => cb(),
      setVignetteIntensity: () => {},
      getMode: () => 'teleport',
    },
    log: () => {},
  };

  // Simulated WebGLInfo tracker that counts live geometries & textures in scene on render()
  // and decrements when Three.js 'dispose' events fire
  const liveGeos = new Set<THREE.BufferGeometry>();
  const liveTexs = new Set<THREE.Texture>();
  const mockRenderer = {
    info: {
      memory: {
        get geometries() {
          return liveGeos.size;
        },
        get textures() {
          return liveTexs.size;
        },
      },
    },
    render: (scn: THREE.Scene) => {
      if (scn.environment && !liveTexs.has(scn.environment)) {
        const env = scn.environment;
        liveTexs.add(env);
        env.addEventListener('dispose', () => liveTexs.delete(env));
      }
      scn.traverse((obj) => {
        const m = obj as THREE.Mesh;
        if (m.geometry && !liveGeos.has(m.geometry)) {
          const g = m.geometry;
          liveGeos.add(g);
          g.addEventListener('dispose', () => liveGeos.delete(g));
        }
        if (m.material) {
          const mats = Array.isArray(m.material) ? m.material : [m.material];
          mats.forEach((mat) => {
            const basic = mat as THREE.MeshBasicMaterial;
            if (basic.map && !liveTexs.has(basic.map)) {
              const t = basic.map;
              liveTexs.add(t);
              t.addEventListener('dispose', () => liveTexs.delete(t));
            }
          });
        }
      });
    },
  };

  const camera = new THREE.PerspectiveCamera();
  const leakTestResult = roomStreamer.runThirtyTransitionLeakTest(
    scene,
    state,
    dummyCtx,
    mockRenderer,
    camera
  );

  return {
    sha256ReadyRoomsPassed: allReadyValid,
    sha256TamperRejected,
    sha256MismatchRejected,
    sha256UnknownRejected,
    leakTestResult,
  };
}
