export type AudioBusName = 'music' | 'ambient' | 'sfx';

export interface AudioVolumeState {
  master: number;
  music: number;
  ambient: number;
  sfx: number;
  muted: boolean;
}

export interface GainRampRecord {
  bus: AudioBusName | 'master';
  sliderValue: number;
  perceptualGain: number;
  timeConstantSec: number;
  timestampMs: number;
}

export const DEFAULT_AUDIO_VOLUME_STATE: AudioVolumeState = {
  master: 0.7,
  music: 0.8,
  ambient: 0.8,
  sfx: 0.8,
  muted: false,
};

/**
 * Perceptual slider-to-gain curve (v^2 quadratic mapping, TZ.md §5.1).
 * Guarantees 0 -> 0.0 and 1 -> 1.0 with natural perceptual loudness spacing.
 */
export function sliderToPerceptualGain(value01: number): number {
  const clamped = Math.max(0, Math.min(1, Number.isFinite(value01) ? value01 : 0));
  return Number((clamped * clamped).toFixed(5));
}

/**
 * Authoritative WebAudio Bus Mixer & Limiter (TZ.md §5.1 & §6.2).
 *
 * Audio Graph:
 *   sources -> [music bus]   -\
 *   sources -> [ambient bus] --> [master gain] -> [limiter] -> destination
 *   sources -> [sfx bus]     -/
 *
 * Strictly owns the single connection to `AudioContext.destination`.
 */
export class AudioMixer {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private limiter: DynamicsCompressorNode | null = null;
  private buses: Record<AudioBusName, GainNode | null> = {
    music: null,
    ambient: null,
    sfx: null,
  };

  private state: AudioVolumeState = { ...DEFAULT_AUDIO_VOLUME_STATE };
  private paused = false;
  private suspendTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private rampHistory: GainRampRecord[] = [];
  private listeners: Set<(state: AudioVolumeState) => void> = new Set();

  // Time constant ~40ms reaches ~92% in 100ms with zero clicks/pops (TZ.md §5.1 & §5.4)
  public static readonly GAIN_RAMP_TIME_CONSTANT = 0.04;
  // Pause/Resume ~150ms smooth ramp (3 * 0.048s ~= 144ms, TZ.md §6.2)
  public static readonly PAUSE_RAMP_TIME_CONSTANT = 0.048;

  public ensureContext(): AudioContext | null {
    if (this.ctx) {
      if (!this.paused && this.ctx.state === 'suspended') {
        void this.ctx.resume().then(() => {
          this.applyAllGainsImmediateOrRamp(true);
        });
      }
      return this.ctx;
    }

    if (typeof window === 'undefined') return null;

    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioCtx) return null;

      const ctx = new AudioCtx();
      this.ctx = ctx;

      // Brickwall Limiter (DynamicsCompressorNode configured as safety limiter, TZ.md §5.1)
      const limiter = ctx.createDynamicsCompressor();
      limiter.threshold.setValueAtTime(-1.5, ctx.currentTime);
      limiter.knee.setValueAtTime(0, ctx.currentTime);
      limiter.ratio.setValueAtTime(20, ctx.currentTime);
      limiter.attack.setValueAtTime(0.002, ctx.currentTime);
      limiter.release.setValueAtTime(0.08, ctx.currentTime);
      this.limiter = limiter;

      // Master Gain
      const masterGain = ctx.createGain();
      this.masterGain = masterGain;

      // Sub-buses: music, ambient, sfx
      const musicBus = ctx.createGain();
      const ambientBus = ctx.createGain();
      const sfxBus = ctx.createGain();

      this.buses = {
        music: musicBus,
        ambient: ambientBus,
        sfx: sfxBus,
      };

      musicBus.connect(masterGain);
      ambientBus.connect(masterGain);
      sfxBus.connect(masterGain);
      masterGain.connect(limiter);

      // ONLY connection to ctx.destination in the entire codebase (TZ.md §5.1)
      limiter.connect(ctx.destination);

      this.applyAllGainsImmediateOrRamp(false);
      return ctx;
    } catch {
      return null;
    }
  }

  public getContext(): AudioContext | null {
    return this.ctx;
  }

  /**
   * Room API v1 & Hub Bus Accessor (`ctx.audio.bus('music' | 'ambient' | 'sfx')`, TZ.md §5.1).
   */
  public bus(name: AudioBusName): GainNode | null {
    this.ensureContext();
    return this.buses[name];
  }

  public getState(): AudioVolumeState {
    return { ...this.state };
  }

  public subscribe(listener: (state: AudioVolumeState) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    const snapshot = this.getState();
    this.listeners.forEach((cb) => cb(snapshot));
  }

  public getEffectiveLinearGain(busName: AudioBusName): number {
    if (this.state.muted || this.paused) return 0;
    const masterG = sliderToPerceptualGain(this.state.master);
    const busG = sliderToPerceptualGain(this.state[busName]);
    return Number((masterG * busG).toFixed(5));
  }

  public setVolumeState(partial: Partial<AudioVolumeState>): void {
    this.state = {
      master:
        partial.master !== undefined
          ? Math.max(0, Math.min(1, partial.master))
          : this.state.master,
      music:
        partial.music !== undefined
          ? Math.max(0, Math.min(1, partial.music))
          : this.state.music,
      ambient:
        partial.ambient !== undefined
          ? Math.max(0, Math.min(1, partial.ambient))
          : this.state.ambient,
      sfx:
        partial.sfx !== undefined
          ? Math.max(0, Math.min(1, partial.sfx))
          : this.state.sfx,
      muted: partial.muted !== undefined ? Boolean(partial.muted) : this.state.muted,
    };

    this.applyAllGainsImmediateOrRamp(true);
    this.notify();
  }

  public setBusVolume(bus: AudioBusName | 'master', value01: number): void {
    const clamped = Math.max(0, Math.min(1, value01));
    this.setVolumeState({ [bus]: clamped } as Partial<AudioVolumeState>);
  }

  public adjustMasterDelta(delta: number): number {
    const next = Math.max(
      0,
      Math.min(1, Math.round((this.state.master + delta) * 100) / 100)
    );
    this.setVolumeState({ master: next, muted: false });
    return next;
  }

  public toggleMute(): boolean {
    const nextMuted = !this.state.muted;
    this.setVolumeState({ muted: nextMuted });
    return nextMuted;
  }

  private recordRamp(
    bus: AudioBusName | 'master',
    sliderValue: number,
    perceptualGain: number,
    timeConstantSec: number
  ): void {
    this.rampHistory.push({
      bus,
      sliderValue,
      perceptualGain,
      timeConstantSec,
      timestampMs: Date.now(),
    });
    if (this.rampHistory.length > 32) {
      this.rampHistory.shift();
    }
  }

  public getRampHistory(): GainRampRecord[] {
    return [...this.rampHistory];
  }

  private applyAllGainsImmediateOrRamp(useSmoothRamp: boolean): void {
    const tc = useSmoothRamp ? AudioMixer.GAIN_RAMP_TIME_CONSTANT : 0.001;
    const masterTarget =
      this.state.muted || this.paused
        ? 0
        : sliderToPerceptualGain(this.state.master);
    const musicTarget = sliderToPerceptualGain(this.state.music);
    const ambientTarget = sliderToPerceptualGain(this.state.ambient);
    const sfxTarget = sliderToPerceptualGain(this.state.sfx);

    this.recordRamp('master', this.state.master, masterTarget, tc);
    this.recordRamp('music', this.state.music, musicTarget, tc);
    this.recordRamp('ambient', this.state.ambient, ambientTarget, tc);
    this.recordRamp('sfx', this.state.sfx, sfxTarget, tc);

    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    if (this.masterGain) {
      this.masterGain.gain.setTargetAtTime(masterTarget, now, tc);
    }
    if (this.buses.music) {
      this.buses.music.gain.setTargetAtTime(musicTarget, now, tc);
    }
    if (this.buses.ambient) {
      this.buses.ambient.gain.setTargetAtTime(ambientTarget, now, tc);
    }
    if (this.buses.sfx) {
      this.buses.sfx.gain.setTargetAtTime(sfxTarget, now, tc);
    }
  }

  /**
   * Pause audio: ramp master gain to 0 over ~150ms, then suspend AudioContext (TZ.md §6.2).
   */
  public pauseForGamePause(onAfterRamp?: () => void): void {
    if (this.paused) return;
    this.paused = true;

    if (this.suspendTimeoutId) {
      clearTimeout(this.suspendTimeoutId);
      this.suspendTimeoutId = null;
    }

    const masterTarget = 0;
    this.recordRamp(
      'master',
      this.state.master,
      masterTarget,
      AudioMixer.PAUSE_RAMP_TIME_CONSTANT
    );

    if (this.ctx && this.masterGain) {
      this.masterGain.gain.setTargetAtTime(
        0,
        this.ctx.currentTime,
        AudioMixer.PAUSE_RAMP_TIME_CONSTANT
      );
      this.suspendTimeoutId = setTimeout(() => {
        if (this.paused && this.ctx && this.ctx.state === 'running') {
          void this.ctx.suspend();
        }
        onAfterRamp?.();
      }, 150);
    } else {
      onAfterRamp?.();
    }
  }

  /**
   * Resume audio: resume AudioContext, then ramp master gain up over ~150ms (TZ.md §6.2).
   */
  public resumeFromGamePause(onBeforeRamp?: () => void): void {
    if (!this.paused) return;
    this.paused = false;

    if (this.suspendTimeoutId) {
      clearTimeout(this.suspendTimeoutId);
      this.suspendTimeoutId = null;
    }

    const targetMaster = this.state.muted
      ? 0
      : sliderToPerceptualGain(this.state.master);

    this.recordRamp(
      'master',
      this.state.master,
      targetMaster,
      AudioMixer.PAUSE_RAMP_TIME_CONSTANT
    );

    if (this.ctx) {
      void this.ctx.resume().then(() => {
        onBeforeRamp?.();
        if (this.ctx && this.masterGain) {
          this.masterGain.gain.setTargetAtTime(
            targetMaster,
            this.ctx.currentTime,
            AudioMixer.PAUSE_RAMP_TIME_CONSTANT
          );
        }
      });
    } else {
      onBeforeRamp?.();
    }
  }

  public isGamePaused(): boolean {
    return this.paused;
  }
}

export const audioMixer = new AudioMixer();
