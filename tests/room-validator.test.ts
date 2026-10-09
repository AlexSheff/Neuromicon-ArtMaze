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
import { migratePlayerState } from '../src/state/playerState';
import room0000 from '../main-maze/room.json';
import room0001 from '../rooms/ArtMaze-Room-0001/room.json';
import room0042 from '../rooms/ArtMaze-Room-0042/room.json';
import room0107 from '../rooms/ArtMaze-Room-0107/room.json';
import room0204 from '../rooms/ArtMaze-Room-0204/room.json';
import room0404 from '../rooms/ArtMaze-Room-0404/room.json';
import room0999 from '../rooms/ArtMaze-Room-0999/room.json';

/**
 * Self-contained verification suite for ROOM_SPEC v1.0 manifests, Real Astronomical Nebula Skies (TZ.md §3),
 * 4-Bus Perceptual Audio Mixer (TZ.md §5), and Pause / State Migration (TZ.md §6–§7).
 */
export function runRepositoryValidationSuite(): {
  passed: boolean;
  results: Array<{ id: string; valid: boolean; errorCount: number }>;
  nebulaReport: ReturnType<typeof validateNebulaRegistryAndCoverage>;
  mixerCurvePassed: boolean;
  migrationPassed: boolean;
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
    oklabSample[0] > 0 &&
    room01Map.nebula.id === 'NEB_0001' &&
    Boolean(room1149Map.nebula.id);

  // 2. Validate Perceptual v^2 Gain Curve & 4-Bus Mixer Ramping (TZ.md §5.1–§5.4)
  const g0 = sliderToPerceptualGain(0);
  const gHalf = sliderToPerceptualGain(0.5);
  const gFull = sliderToPerceptualGain(1);
  audioMixer.setVolumeState({
    master: 0.5,
    music: 0.5,
    ambient: 0.8,
    sfx: 0.8,
    muted: false,
  });
  const effectiveMusic = audioMixer.getEffectiveLinearGain('music');
  audioMixer.pauseForGamePause();
  const pausedGain = audioMixer.getEffectiveLinearGain('music');
  audioMixer.resumeFromGamePause();

  const mixerCurvePassed =
    g0 === 0 &&
    gHalf === 0.25 &&
    gFull === 1 &&
    Math.abs(effectiveMusic - 0.0625) < 0.001 &&
    pausedGain === 0;

  // 3. Validate PlayerState v1 -> v4 Migration with Audio Bus Persistence (TZ.md §5.3)
  const migrated = migratePlayerState({
    version: 1,
    path: 'ascend',
    visitedRooms: ['ROOM_001'],
  });
  const migrationPassed =
    migrated.state.version === 4 &&
    migrated.state.audio.master === 0.7 &&
    migrated.state.audio.music === 0.8 &&
    migrated.state.audio.muted === false;

  return {
    passed:
      results.every((r) => r.valid) &&
      skyValid &&
      mixerCurvePassed &&
      migrationPassed,
    results,
    nebulaReport,
    mixerCurvePassed,
    migrationPassed,
  };
}
