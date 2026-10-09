import { eventBus, OnboardingStepId } from '../../events/eventBus';
import { spatialAudioSystem } from '../../systems/audio/spatialAudioSystem';
import { OnboardingFrameSignals, OnboardingStateHandler } from '../types';

/**
 * Beat 45–70 s (EXPERIENCE_PROTOCOL.md §2.2):
 * Interaction opens the floor/ceiling: the atrium reveals both directions.
 * Audio crossfades by head pitch: looking up brings the ascent layer, looking down the descent layer.
 */
export const revealState: OnboardingStateHandler = {
  id: 'REVEAL',
  onEnter() {
    spatialAudioSystem.triggerChime(523.25);
    eventBus.emit('audio:caption', { textId: 'caption.atrium_reveal' });
  },
  update(signals: OnboardingFrameSignals): OnboardingStepId | null {
    // Dynamic head-pitch crossfade: pitch > 0 (looking up) -> 1.0 (Ascent), pitch < 0 (looking down) -> 0.0 (Descent)
    const pitchBlend = Math.max(0, Math.min(1, 0.5 + signals.headPitch * 0.9));
    spatialAudioSystem.setCorridorVerticalCrossfade(pitchBlend);

    if (signals.standingOnBranch || signals.elapsedInStep >= 7.5) {
      return 'CHOOSE';
    }
    return null;
  },
};
