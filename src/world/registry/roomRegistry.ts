import registryData from '../../../registry/rooms.json';
import { RegistryEntry, RoomRegistryManifest } from '../../types/artmaze';

const runtimeRegistry: RoomRegistryManifest = JSON.parse(
  JSON.stringify(registryData)
) as RoomRegistryManifest;

export function getRoomRegistry(): RoomRegistryManifest {
  return runtimeRegistry;
}

export function getRegistryEntry(roomId: string): RegistryEntry | undefined {
  return runtimeRegistry.rooms[roomId];
}

export function registerCustomRoomEntry(entry: RegistryEntry): void {
  runtimeRegistry.rooms[entry.id] = entry;
}
