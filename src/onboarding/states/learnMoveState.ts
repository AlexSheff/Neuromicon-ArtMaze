import { OnboardingStepId } from '../../events/eventBus';
import { spatialAudioSystem } from '../../systems/audio/spatialAudioSystem';
import { OnboardingFrameSignals, OnboardingStateHandler } from '../types';

/**
 * Beat 8–25 s (EXPERIENCE_PROTOCOL.md §2.2):
 * Light blooms from a source in front; the floor beneath shows a soft pulsing ring at 2–3 m.
 * Teaches looking around and moving/teleporting to the pulsing ring without any text.
 */
export const learnMoveState: OnboardingStateHandler = {
  id: 'LEARN_MOVE',
  onEnter() {
    spatialAudioSystem.triggerChime(329.63);
  },
  update(signals: OnboardingFrameSignals): OnboardingStepId | null {
    if (signals.hasInteractedPedestal) return 'REVEAL';
    if (signals.hasMovedToRing) return 'LEARN_INTERACT';
    return null;
  },
};
