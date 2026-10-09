import { OnboardingStepId } from '../../events/eventBus';
import { OnboardingStateHandler } from '../types';

export const entryState: OnboardingStateHandler = {
  id: 'ENTRY',
  onEnter() {
    // Waits for the single HTML Entry button gesture (§2.1)
  },
  update(): OnboardingStepId | null {
    return null;
  },
};
