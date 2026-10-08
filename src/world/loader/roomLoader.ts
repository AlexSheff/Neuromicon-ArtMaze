import room0000 from '../../../main-maze/room.json';
import room0001 from '../../../rooms/ArtMaze-Room-0001/room.json';
import room0042 from '../../../rooms/ArtMaze-Room-0042/room.json';
import room0107 from '../../../rooms/ArtMaze-Room-0107/room.json';
import room0204 from '../../../rooms/ArtMaze-Room-0204/room.json';
import room0404 from '../../../rooms/ArtMaze-Room-0404/room.json';
import room0999 from '../../../rooms/ArtMaze-Room-0999/room.json';
import { asTypedRoomManifest, validateRoomManifest } from '../../../tools/room-validator/validator';
import { RoomManifest } from '../../types/artmaze';
import { registerCustomRoomEntry } from '../registry/roomRegistry';
import { upsertGraphNode } from '../graph/worldGraph';
import { playerStateStore } from '../../systems/state/playerStateStore';

const loadedManifests: Record<string, RoomManifest> = {
  ROOM_0000: asTypedRoomManifest(room0000),
  ROOM_0001: asTypedRoomManifest(room0001),
  ROOM_0042: asTypedRoomManifest(room0042),
  ROOM_0107: asTypedRoomManifest(room0107),
  ROOM_0204: asTypedRoomManifest(room0204),
  ROOM_0404: asTypedRoomManifest(room0404),
  ROOM_0999: asTypedRoomManifest(room0999),
};

export function loadRoomManifest(roomId: string): RoomManifest | null {
  return loadedManifests[roomId] ?? null;
}

export function getAllLoadedRoomManifests(): RoomManifest[] {
  return Object.values(loadedManifests);
}

export function mountCustomRoomManifest(manifest: RoomManifest): {
  ok: boolean;
  errors: string[];
} {
  const validation = validateRoomManifest(manifest);
  if (!validation.valid) {
    return {
      ok: false,
      errors: validation.errors.map((e) => `${e.path}: ${e.message}`),
    };
  }

  loadedManifests[manifest.id] = manifest;
  registerCustomRoomEntry({
    id: manifest.id,
    title: manifest.title,
    titleRu: manifest.titleRu || manifest.title,
    type: manifest.id === 'ROOM_0000' ? 'main-maze' : 'external',
    repository: `local://custom/${manifest.id}`,
    manifestPath: `custom/${manifest.id}/room.json`,
    status: 'ready',
  });

  upsertGraphNode({
    id: manifest.id,
    status: 'ready',
    hasExplicitEntry: manifest.rules?.entryAllowed !== false,
    hasExplicitExit: manifest.doors.length > 0,
  });

  playerStateStore.recordCreatedRule(
    manifest.id,
    `Mounted custom Room Package: ${manifest.id} (${manifest.title})`
  );

  return { ok: true, errors: [] };
}
