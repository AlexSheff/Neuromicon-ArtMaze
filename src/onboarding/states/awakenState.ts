import { eventBus, OnboardingStepId } from '../../events/eventBus';
import { spatialAudioSystem } from '../../systems/audio/spatialAudioSystem';
import { OnboardingFrameSignals, OnboardingStateHandler } from '../types';

/**
 * Beat 0–8 s (EXPERIENCE_PROTOCOL.md §2.2 & §2.4):
 * Darkness; low drone swells; a faint vertical line of light far above and below.
 * Two small glowing marks at different heights allow seated/standing comfort calibration.
 */
export const awakenState: OnboardingStateHandler = {
  id: 'AWAKEN',
  onEnter() {
    spatialAudioSystem.setCorridorVerticalCrossfade(0.5);
    eventBus.emit('audio:caption', { textId: 'caption.drone_swell' });
  },
  update(signals: OnboardingFrameSignals): OnboardingStepId | null {
    // Implicit skip if player already moved to the ring or interacted (§2.3)
    if (signals.hasInteractedPedestal) return 'REVEAL';
    if (signals.hasMovedToRing) return 'LEARN_INTERACT';
    if (signals.elapsedInStep >= 6.0) return 'LEARN_MOVE';
    return null;
  },
};
