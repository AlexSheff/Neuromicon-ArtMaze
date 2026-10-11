import { eventBus, OnboardingStepId } from '../events/eventBus';
import { CorridorBranch } from '../room-sdk';
import { spatialAudioSystem } from '../systems/audio/spatialAudioSystem';
import { hubPlayerState } from '../state/playerState';
import { awakenState } from './states/awakenState';
import { bootState } from './states/bootState';
import { chooseState } from './states/chooseState';
import { committedState } from './states/committedState';
import { entryState } from './states/entryState';
import { learnInteractState } from './states/learnInteractState';
import { learnMoveState } from './states/learnMoveState';
import { revealState } from './states/revealState';
import {
  OnboardingFrameSignals,
  OnboardingStateHandler,
  OnboardingVisualState,
} from './types';

const STATE_HANDLERS: Record<OnboardingStepId, OnboardingStateHandler> = {
  BOOT: bootState,
  ENTRY: entryState,
  AWAKEN: awakenState,
  LEARN_MOVE: learnMoveState,
  LEARN_INTERACT: learnInteractState,
  REVEAL: revealState,
  CHOOSE: chooseState,
  COMMITTED: committedState,
};

/**
 * Explicit Onboarding Finite State Machine + 4-Rung Hint Ladder (EXPERIENCE_PROTOCOL.md §2.3 & §2.6).
 */
export class OnboardingFSM {
  private currentStep: OnboardingStepId = 'BOOT';
  private elapsedInStep = 0;
  private highestHintRung: 0 | 1 | 2 | 3 | 4 = 0;

  private hasMovedToRing = false;
  private hasInteractedPedestal = false;
  private revealProgress = 0;
  private branchHoldTimer = 0;
  private holdingBranch: CorridorBranch | null = null;

  constructor() {
    const st = hubPlayerState.getState();
    if (st.onboarding.completedSteps.includes('COMMITTED')) {
      this.currentStep = 'COMMITTED';
      this.revealProgress = 1;
    } else {
      this.currentStep = 'ENTRY';
    }
  }

  public getStep(): OnboardingStepId {
    return this.currentStep;
  }

  /**
   * Called when the player clicks the single HTML Entry button (§2.1).
   */
  public startFromEntryGesture(): void {
    const st = hubPlayerState.getState();
    if (st.onboarding.completedSteps.includes('COMMITTED')) {
      this.transitionTo('COMMITTED');
      this.revealProgress = 1;
      return;
    }
    this.hasMovedToRing = false;
    this.hasInteractedPedestal = false;
    this.revealProgress = 0;
    this.branchHoldTimer = 0;
    this.holdingBranch = null;
    this.transitionTo('AWAKEN');
  }

  public notifyPedestalInteracted(): void {
    this.hasInteractedPedestal = true;
    if (
      this.currentStep === 'AWAKEN' ||
      this.currentStep === 'LEARN_MOVE' ||
      this.currentStep === 'LEARN_INTERACT'
    ) {
      this.transitionTo('REVEAL');
    }
  }

  private transitionTo(next: OnboardingStepId): void {
    if (this.currentStep === next) return;
    this.currentStep = next;
    this.elapsedInStep = 0;
    this.highestHintRung = 0;
    hubPlayerState.setOnboardingStep(next);
    STATE_HANDLERS[next].onEnter();
  }

  public update(
    dt: number,
    playerX: number,
    playerZ: number,
    headPitch: number,
    onBranchCommitted: (branch: CorridorBranch) => void
  ): OnboardingVisualState {
    const st = hubPlayerState.getState();
    if (
      st.onboarding.currentStep === 'AWAKEN' &&
      this.currentStep === 'COMMITTED'
    ) {
      // Player triggered Replay Onboarding from Codex (§2.3)
      this.hasMovedToRing = false;
      this.hasInteractedPedestal = false;
      this.revealProgress = 0;
      this.branchHoldTimer = 0;
      this.holdingBranch = null;
      this.transitionTo('AWAKEN');
    } else if (
      st.onboarding.currentStep === 'COMMITTED' &&
      this.currentStep !== 'COMMITTED'
    ) {
      this.currentStep = 'COMMITTED';
      this.revealProgress = 1;
      this.holdingBranch = null;
      this.branchHoldTimer = 0;
    }

    this.elapsedInStep += dt;

    // Detect proximity to the pulsing floor ring at (0, 2.2)
    if (Math.hypot(playerX - 0, playerZ - 2.2) < 1.85) {
      this.hasMovedToRing = true;
    }

    // Detect if player is standing on Ascent Dais (x < -2.4, z < -4.2) or Descent Dais (x > 2.4, z < -4.2)
    let standingOnBranch: CorridorBranch | null = null;
    if (playerX < -2.3 && playerZ < -3.8) {
      standingOnBranch = 'ascend';
    } else if (playerX > 2.3 && playerZ < -3.8) {
      standingOnBranch = 'descend';
    }

    // Smoothly animate atrium reveal progress
    const targetReveal =
      this.currentStep === 'AWAKEN'
        ? 0.08
        : this.currentStep === 'LEARN_MOVE' ||
          this.currentStep === 'LEARN_INTERACT'
        ? 0.35
        : 1.0;
    this.revealProgress +=
      (targetReveal - this.revealProgress) * Math.min(1, dt * 1.8);

    // 3-Second Reversible Platform Hold during REVEAL / CHOOSE (§2.2 Beat 70–90 s)
    if (
      (this.currentStep === 'REVEAL' || this.currentStep === 'CHOOSE') &&
      standingOnBranch
    ) {
      if (this.holdingBranch !== standingOnBranch) {
        this.holdingBranch = standingOnBranch;
        this.branchHoldTimer = 0;
        spatialAudioSystem.triggerChime(
          standingOnBranch === 'ascend' ? 440 : 293.66
        );
        eventBus.emit('audio:caption', { textId: 'caption.lift_hold' });
      }
      this.branchHoldTimer += dt;
      if (this.branchHoldTimer >= 3.0) {
        const chosen = standingOnBranch;
        this.holdingBranch = null;
        this.branchHoldTimer = 0;
        this.transitionTo('COMMITTED');
        onBranchCommitted(chosen);
      }
    } else {
      // Reversible by stepping off (§2.2)
      this.holdingBranch = null;
      this.branchHoldTimer = Math.max(0, this.branchHoldTimer - dt * 2.5);
    }

    // Evaluate state handler transition
    const signals: OnboardingFrameSignals = {
      dt,
      elapsedInStep: this.elapsedInStep,
      playerX,
      playerZ,
      headPitch,
      hasMovedToRing: this.hasMovedToRing,
      hasInteractedPedestal: this.hasInteractedPedestal,
      standingOnBranch,
    };

    const nextStep = STATE_HANDLERS[this.currentStep].update(signals);
    if (nextStep && nextStep !== this.currentStep) {
      this.transitionTo(nextStep);
    }

    // Evaluate 4-Rung Hint Ladder for stuck players (§2.6: 8s, 20s, 45s, 90s)
    if (
      this.currentStep !== 'BOOT' &&
      this.currentStep !== 'ENTRY' &&
      this.currentStep !== 'COMMITTED'
    ) {
      let rung: 0 | 1 | 2 | 3 | 4 = 0;
      if (this.elapsedInStep >= 90) rung = 4;
      else if (this.elapsedInStep >= 45) rung = 3;
      else if (this.elapsedInStep >= 20) rung = 2;
      else if (this.elapsedInStep >= 8) rung = 1;

      if (rung > 0 && rung > this.highestHintRung) {
        const activeRung = rung as 1 | 2 | 3 | 4;
        this.highestHintRung = activeRung;
        hubPlayerState.recordHintRung(this.currentStep, activeRung);
        if (activeRung === 1 || activeRung === 2) {
          spatialAudioSystem.triggerChime(392);
        } else if (activeRung === 4) {
          hubPlayerState.unlockDiscovery('codex.entry.threshold');
        }
      }
    }

    return {
      step: this.currentStep,
      atriumRevealProgress: this.revealProgress,
      showMoveRing:
        this.currentStep === 'LEARN_MOVE' && !this.hasMovedToRing,
      pedestalGlowIntensity:
        this.currentStep === 'LEARN_INTERACT'
          ? 1.0
          : this.currentStep === 'LEARN_MOVE'
          ? 0.45
          : 0.2,
      showComfortCalibrationMarks:
        this.currentStep === 'AWAKEN' || this.currentStep === 'LEARN_MOVE',
      branchHoldProgress: Math.min(1, this.branchHoldTimer / 3.0),
      holdingBranch: this.holdingBranch,
      hintRung: this.highestHintRung,
    };
  }
}

export const onboardingFSM = new OnboardingFSM();
