import { OnboardingStepId } from '../../events/eventBus';
import { hubPlayerState } from '../../state/playerState';
import { OnboardingStateHandler } from '../types';

export const bootState: OnboardingStateHandler = {
  id: 'BOOT',
  onEnter() {
    // Check if returning player has already reached COMMITTED (§2.3)
    const st = hubPlayerState.getState();
    if (st.onboarding.completedSteps.includes('COMMITTED')) {
      hubPlayerState.setOnboardingStep('COMMITTED');
    } else {
      hubPlayerState.setOnboardingStep('ENTRY');
    }
  },
  update(): OnboardingStepId | null {
    const st = hubPlayerState.getState();
    return st.onboarding.completedSteps.includes('COMMITTED')
      ? 'COMMITTED'
      : 'ENTRY';
  },
};
