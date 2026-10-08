import { validateRoomManifest } from '../tools/room-validator/validator';
import room0000 from '../main-maze/room.json';
import room0001 from '../rooms/ArtMaze-Room-0001/room.json';
import room0042 from '../rooms/ArtMaze-Room-0042/room.json';
import room0107 from '../rooms/ArtMaze-Room-0107/room.json';
import room0204 from '../rooms/ArtMaze-Room-0204/room.json';
import room0404 from '../rooms/ArtMaze-Room-0404/room.json';
import room0999 from '../rooms/ArtMaze-Room-0999/room.json';

/**
 * Self-contained verification suite for ROOM_SPEC v1.0 manifests across the 16-stage protocol.
 */
export function runRepositoryValidationSuite(): {
  passed: boolean;
  results: Array<{ id: string; valid: boolean; errorCount: number }>;
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

  return {
    passed: results.every((r) => r.valid),
    results,
  };
}
