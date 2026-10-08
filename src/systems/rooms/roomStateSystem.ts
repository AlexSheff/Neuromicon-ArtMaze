import {
  PlayerState,
  RoomManifest,
  RoomObjectDefinition,
} from '../../types/artmaze';

/**
 * Computes active objects in a room based on declarative state conditions
 * such as minVisitCount (ROOM_SPEC §25 Revisiting a Room).
 */
export function getActiveRoomObjects(
  manifest: RoomManifest,
  state: PlayerState
): RoomObjectDefinition[] {
  const objects = manifest.objects ?? [];
  const visitCount = state.roomStates[manifest.id]?.visitCount ?? 1;

  return objects.filter((obj) => {
    if (obj.minVisitCount !== undefined && visitCount < obj.minVisitCount) {
      return false;
    }
    return true;
  });
}
