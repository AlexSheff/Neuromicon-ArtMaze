import { PlayerState } from '../../types/artmaze';
import { playerStateStore } from '../state/playerStateStore';

export function getIdentityValue(state: PlayerState, trait: string): number {
  return state.identity[trait] ?? 0;
}

export function mutateIdentity(deltas: Record<string, number>): void {
  playerStateStore.applyIdentityDelta(deltas);
}

export function meetsIdentityRequirement(
  state: PlayerState,
  trait: string,
  minValue = 1
): boolean {
  return getIdentityValue(state, trait) >= minValue;
}
