import { OnboardingStepId } from '../../events/eventBus';
import { spatialAudioSystem } from '../../systems/audio/spatialAudioSystem';
import { OnboardingFrameSignals, OnboardingStateHandler } from '../types';

/**
 * Beat 70–90 s (EXPERIENCE_PROTOCOL.md §2.2):
 * Two lifts/stairs, one each direction, with distinct light and sound.
 * Stepping onto one starts a 3 s gentle hold (reversible by stepping off).
 */
export const chooseState: OnboardingStateHandler = {
  id: 'CHOOSE',
  onEnter() {
    spatialAudioSystem.triggerChime(587.33);
  },
  update(signals: OnboardingFrameSignals): OnboardingStepId | null {
    const pitchBlend = Math.max(0, Math.min(1, 0.5 + signals.headPitch * 0.9));
    spatialAudioSystem.setCorridorVerticalCrossfade(pitchBlend);
    return null;
  },
};
