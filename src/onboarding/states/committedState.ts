import { OnboardingStepId } from '../../events/eventBus';
import { OnboardingStateHandler } from '../types';

export const committedState: OnboardingStateHandler = {
  id: 'COMMITTED',
  onEnter() {
    // Player has committed to a branch; onboarding never nags again (§1.6, §2.3)
  },
  update(): OnboardingStepId | null {
    return null;
  },
};
