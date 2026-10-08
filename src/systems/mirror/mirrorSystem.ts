import { MirrorDefinition } from '../../types/artmaze';
import { playerStateStore } from '../state/playerStateStore';

export function resolveMirrorProposition(
  roomId: string,
  mirror: MirrorDefinition,
  choice: 'accept' | 'reject' | 'return'
): void {
  const effect = mirror.choices[choice];
  playerStateStore.recordMirrorChoice(roomId, choice, effect?.identity);
  if (effect?.flag) {
    playerStateStore.setFlag(effect.flag, true);
  }
}
