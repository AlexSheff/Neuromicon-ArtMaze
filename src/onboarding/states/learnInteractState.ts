import { eventBus, OnboardingStepId } from '../../events/eventBus';
import { spatialAudioSystem } from '../../systems/audio/spatialAudioSystem';
import { OnboardingFrameSignals, OnboardingStateHandler } from '../types';

/**
 * Beat 25–45 s (EXPERIENCE_PROTOCOL.md §2.2):
 * At the ring: a pedestal glows. Controller model shows trigger lit (VR) or a single glyph ◈ (desktop).
 * Teaches interacting with a glowing artifact.
 */
export const learnInteractState: OnboardingStateHandler = {
  id: 'LEARN_INTERACT',
  onEnter() {
    spatialAudioSystem.triggerChime(440);
    eventBus.emit('audio:caption', { textId: 'caption.pedestal_hum' });
  },
  update(signals: OnboardingFrameSignals): OnboardingStepId | null {
    if (signals.hasInteractedPedestal) return 'REVEAL';
    return null;
  },
};
