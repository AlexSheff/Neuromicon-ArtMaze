import { OnboardingStepId } from '../events/eventBus';
import { CorridorBranch } from '../room-sdk';

export interface OnboardingFrameSignals {
  dt: number;
  elapsedInStep: number;
  playerX: number;
  playerZ: number;
  headPitch: number;
  hasMovedToRing: boolean;
  hasInteractedPedestal: boolean;
  standingOnBranch: CorridorBranch | null;
}

export interface OnboardingVisualState {
  step: OnboardingStepId;
  /** 0 = pitch black (AWAKEN), 0.35 = pedestal bloom (LEARN_MOVE), 1.0 = full vertical atrium (REVEAL/CHOOSE/COMMITTED) */
  atriumRevealProgress: number;
  /** Pulsing floor ring at (0, 0.02, 2.2) visible during LEARN_MOVE */
  showMoveRing: boolean;
  /** Glowing central Awakening Pedestal at (0, 0, 1.2) */
  pedestalGlowIntensity: number;
  /** Seated (y=1.05m) vs Standing (y=1.68m) calibration marks during AWAKEN/LEARN_MOVE */
  showComfortCalibrationMarks: boolean;
  /** 0..1 progress of 3-second reversible platform hold during CHOOSE */
  branchHoldProgress: number;
  holdingBranch: CorridorBranch | null;
  /** Active hint-ladder rung (0 = none, 1 = 8s light/sound, 2 = 20s trail, 3 = 45s engraved plaque, 4 = 90s codex) */
  hintRung: 0 | 1 | 2 | 3 | 4;
}

export interface OnboardingStateHandler {
  readonly id: OnboardingStepId;
  onEnter(): void;
  update(signals: OnboardingFrameSignals): OnboardingStepId | null;
}
