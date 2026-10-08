import { PlayerState } from '../../types/artmaze';
import { playerStateStore } from '../state/playerStateStore';

export function hasDiscovery(state: PlayerState, discoveryId: string): boolean {
  return state.discoveries.includes(discoveryId);
}

export function unlockDiscovery(discoveryId: string, roomId?: string): boolean {
  return playerStateStore.recordDiscovery(discoveryId, roomId);
}
