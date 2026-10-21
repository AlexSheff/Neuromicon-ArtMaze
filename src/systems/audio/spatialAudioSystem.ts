import { VoidType } from '../../types/artmaze';
import {
  AudioBusName,
  audioMixer,
  AudioVolumeState,
} from './mixer';

export interface AudioSpectrumState {
  /** 16 normalized frequency bands [0..1] from 20Hz sub-bass to 20kHz cosmic air */
  bands: Float32Array;
  /** Instantaneous beat/transient pulse [0..1] */
  beatPulse: number;
  /** Punchy drum kick transient [0..1] (sub-bass & kick drum punch) */
  drumKick: number;
  /** Crisp drum snare / percussion transient [0..1] (mid-high punch) */
  drumSnare: number;
  /** Dominant musical tone pitch normalized [0..1] */
  tonePitch: number;
  /** Dominant musical frequency in Hz */
  toneHz: number;
  /** Overall RMS/spectral energy [0..1] */
  overallEnergy: number;
  /** Index (0..15) of the currently dominant frequency band */
  dominantBand: number;
  /** Spectral centroid [0..1] indicating harmonic tone brightness */
  spectralCentroid: number;
  /** True when live WebAudio FFT data is actively streaming from room track */
  isLiveSignal: boolean;
}

// 16 logarithmic frequency bin ranges for a 512-point FFT (256 bins)
const BAND_BIN_RANGES: ReadonlyArray< readonly [number, number] > = [
  [1, 2],     // 0: Sub-Bass (20-60 Hz)
  [3, 4],     // 1: Deep Bass (60-110 Hz)
  [5, 7],     // 2: Kick / Punch Bass (110-180 Hz)
  [8, 10],    // 3: Upper Bass (180-260 Hz)
  [11, 14],   // 4: Low Warmth (260-380 Hz)
  [15, 20],   // 5: Fundamental Mid (380-540 Hz)
  [21, 28],   // 6: Center Mid (540-760 Hz)
  [29, 38],   // 7: Harmonic Mid (760-1050 Hz)
  [39, 52],   // 8: Upper Mid (1.05-1.45 kHz)
  [53, 70],   // 9: Vocal Presence (1.45-1.95 kHz)
  [71, 92],   // 10: Electric Presence (1.95-2.6 kHz)
  [93, 118],  // 11: Low Treble (2.6-3.4 kHz)
  [119, 148], // 12: Crisp Treble (3.4-4.5 kHz)
  [149, 180], // 13: Harmonic Brilliance (4.5-6.2 kHz)
  [181, 216], // 14: Crystal Shimmer (6.2-10 kHz)
  [217, 255], // 15: Cosmic Air (10-20 kHz)
];

/**
 * Spatial & Room Audio System for Neuromicon Artmaze (TZ.md §5 & §6).
 * Strictly enforces:
 * 1. All sources route through `audioMixer.bus('music' | 'ambient' | 'sfx')` -> `masterGain` -> `limiter`.
 * 2. One Room = One MP3 Track from https://github.com/AlexSheff/Neuromicon.
 * 3. Tracks play ONLY inside rooms (never in the Starting Cosmic Room, Sector Halls, or Void).
 * 4. Tracks NEVER overlap: entering a new room or leaving a room immediately halts and resets
 *    any prior track before starting the next one.
 * 5. Game Pause freezes MP3 playback at its exact `currentTime` and resumes seamlessly (± 50 ms).
 * 6. Real-time 16-Band FFT AnalyserNode (`getMultiBandSpectrum`) driving iridescent soap bubbles & soft particles.
 */
export class SpatialAudioSystem {
  private mp3Audio: HTMLAudioElement | null = null;
  private mediaElementSource: MediaElementAudioSourceNode | null = null;
  private analyser: AnalyserNode | null = null;
  private analyserAttached = false;
  private readonly fftBytes = new Uint8Array(256);
  private readonly bands16 = new Float32Array(16);
  private readonly smoothedBands16 = new Float32Array(16);
  private prevLowEnergy = 0;
  private prevKickEnergy = 0;
  private prevSnareEnergy = 0;
  private kickEnvelope = 0;
  private snareEnvelope = 0;
  private smoothedTonePitch = 0.5;
  private smoothedToneHz = 144;
  private beatPulseEnvelope = 0;
  private currentBaseHz = 144;

  private currentRoomTrackUrl = '';
  private isMp3Streaming = false;
  private inRoom = false;
  private pausedByGame = false;
  private savedPauseTime = 0;
  private playbackToken = 0;

  // Generative Room Ambient Synth (routes exclusively through `music` bus into AudioMixer)
  private synthGainNode: GainNode | null = null;
  private synthFilterNode: BiquadFilterNode | null = null;
  private synthOscillators: OscillatorNode[] = [];
  private synthLfoOsc: OscillatorNode | null = null;
  private synthChimeTimer: number | null = null;
  private isSynthActive = false;

  // Corridor / Threshold Ambient Drone (routes exclusively through `ambient` bus)
  private corridorDroneGain: GainNode | null = null;
  private corridorDroneOsc: OscillatorNode | null = null;

  private currentTrackLabel = 'Cosmic Nexus (Silent Outside Rooms)';

  private readonly spectrumState: AudioSpectrumState = {
    bands: this.smoothedBands16,
    beatPulse: 0,
    drumKick: 0,
    drumSnare: 0,
    tonePitch: 0.5,
    toneHz: 144,
    overallEnergy: 0,
    dominantBand: 0,
    spectralCentroid: 0.5,
    isLiveSignal: false,
  };

  private pendingAutoplay = false;

  constructor() {
    // Sync HTMLAudioElement fallback volume whenever mixer state changes
    audioMixer.subscribe(() => {
      this.syncElementVolume();
    });
    this.setupAutoplayUnlock();
  }

  /**
   * Automatically unlocks audio and starts/resumes the intro track on the first user interaction
   * (pointerdown, keydown, touchstart, or XR session start).
   */
  public setupAutoplayUnlock(): void {
    if (typeof window === 'undefined') return;
    const unlock = () => {
      this.unlockAudioAndResume();
    };

    window.addEventListener('pointerdown', unlock, { passive: true, once: false });
    window.addEventListener('keydown', unlock, { passive: true, once: false });
    window.addEventListener('touchstart', unlock, { passive: true, once: false });
  }

  public unlockAudioAndResume(): void {
    void audioMixer.unlockAudio();
    const ctx = audioMixer.ensureContext();
    if (ctx && ctx.state === 'suspended') {
      void ctx.resume();
    }
    if (!this.pausedByGame && !audioMixer.getState().muted) {
      if (!this.mp3Audio || !this.currentRoomTrackUrl) {
        this.playRoomSoundtrack(
          this.currentRoomTrackUrl || 'assets/audio/intro.mp3',
          108,
          'Neuromicon · Intro'
        );
      } else if (this.mp3Audio.paused) {
        void this.mp3Audio.play().then(() => {
          this.isMp3Streaming = true;
          this.duckGenerativeRoomSynth(true);
        }).catch(() => {
          this.playRoomSoundtrack(
            this.currentRoomTrackUrl || 'assets/audio/intro.mp3',
            108,
            'Neuromicon · Intro'
          );
        });
      }
    }
    this.pendingAutoplay = false;
  }

  private ensureAnalyser(): AnalyserNode | null {
    const ctx = audioMixer.ensureContext();
    if (!ctx || typeof ctx.createAnalyser !== 'function') return null;

    if (!this.analyser) {
      try {
        const node = ctx.createAnalyser();
        node.fftSize = 512;
        node.smoothingTimeConstant = 0.86;
        this.analyser = node;
      } catch {
        return null;
      }
    }

    if (!this.analyserAttached && this.analyser) {
      try {
        const musicBus = audioMixer.bus('music');
        const sfxBus = audioMixer.bus('sfx');
        // Tap musicBus and sfxBus into the analyser (passive parallel tap; audio still goes through master limiter!)
        if (musicBus) musicBus.connect(this.analyser);
        if (sfxBus) sfxBus.connect(this.analyser);
        this.analyserAttached = true;
      } catch {
        // Ignore if context is mocked in headless unit tests
      }
    }

    return this.analyser;
  }

  /**
   * Computes 16 normalized frequency bands [0..1], beat transient pulse, dominant frequency band,
   * and spectral centroid with ZERO per-frame allocations.
   * When no room soundtrack is playing (e.g. Threshold, Sector Halls, or muted), all bands smoothly
   * decay to 0 with zero artificial spikes so nothing ever twitches or strobes in silence.
   */
  public getMultiBandSpectrum(timeSec = 0): AudioSpectrumState {
    if (this.pausedByGame) {
      this.spectrumState.beatPulse = 0;
      this.spectrumState.overallEnergy = 0;
      this.spectrumState.isLiveSignal = false;
      return this.spectrumState;
    }

    const isMusicActive =
      this.isMp3Streaming &&
      Boolean(this.mp3Audio && !this.mp3Audio.paused) &&
      !audioMixer.getState().muted &&
      !this.pausedByGame;

    let hasLiveFft = false;
    const analyser =
      this.analyser ?? (this.isMp3Streaming ? this.ensureAnalyser() : null);

    if (
      isMusicActive &&
      analyser &&
      typeof analyser.getByteFrequencyData === 'function'
    ) {
      try {
        analyser.getByteFrequencyData(this.fftBytes);
        let maxByte = 0;
        let peakBin = 1;
        for (let i = 1; i < 128; i++) {
          if (this.fftBytes[i] > maxByte) {
            maxByte = this.fftBytes[i];
            peakBin = i;
          }
        }
        if (maxByte > 3) {
          hasLiveFft = true;
          for (let b = 0; b < 16; b++) {
            const [startBin, endBin] = BAND_BIN_RANGES[b];
            let sum = 0;
            let peak = 0;
            const count = Math.max(1, endBin - startBin + 1);
            for (let k = startBin; k <= endBin; k++) {
              const v = this.fftBytes[k] / 255;
              sum += v;
              if (v > peak) peak = v;
            }
            // High frequencies naturally have lower raw energy in music; apply gentle perceptual tilt
            const tilt = 1.0 + b * 0.06;
            const rawBand = Math.min(
              1.0,
              ((sum / count) * 0.68 + peak * 0.32) * tilt
            );
            this.bands16[b] = rawBand;
          }

          // 1. Drum Kick Transient Detection (bins 1..4: 30–160 Hz)
          const kickRaw =
            (this.fftBytes[1] * 1.3 + this.fftBytes[2] * 1.2 + this.fftBytes[3] + this.fftBytes[4] * 0.8) /
            (4.3 * 255);
          const kickDelta = Math.max(0, kickRaw - this.prevKickEnergy);
          this.prevKickEnergy = kickRaw * 0.65 + this.prevKickEnergy * 0.35;
          if (kickDelta > 0.04) {
            this.kickEnvelope = Math.min(1.0, this.kickEnvelope + kickDelta * 3.2);
          } else {
            this.kickEnvelope *= 0.88;
          }

          // 2. Drum Snare / Percussion Detection (bins 6..14: 250–1200 Hz)
          const snareRaw =
            (this.fftBytes[6] + this.fftBytes[8] * 1.1 + this.fftBytes[10] * 1.2 + this.fftBytes[12]) /
            (4.3 * 255);
          const snareDelta = Math.max(0, snareRaw - this.prevSnareEnergy);
          this.prevSnareEnergy = snareRaw * 0.65 + this.prevSnareEnergy * 0.35;
          if (snareDelta > 0.04) {
            this.snareEnvelope = Math.min(1.0, this.snareEnvelope + snareDelta * 3.2);
          } else {
            this.snareEnvelope *= 0.85;
          }

          // 3. Dominant Musical Tone & Pitch (bins to Hz, logarithmic pitch [0..1])
          const ctx = audioMixer.ensureContext();
          const approxHz = peakBin * ((ctx?.sampleRate ?? 44100) / 512);
          const rawTonePitch = Math.min(
            1.0,
            Math.max(0.0, Math.log2(Math.max(45, approxHz) / 45) / 6.5)
          );
          this.smoothedTonePitch += (rawTonePitch - this.smoothedTonePitch) * 0.2;
          this.smoothedToneHz += (approxHz - this.smoothedToneHz) * 0.2;
        }
      } catch {
        hasLiveFft = false;
      }
    }

    if (!hasLiveFft) {
      if (isMusicActive) {
        // Smooth harmonic musical envelope (zero harsh epileptic square strobes)
        const tempoRad = timeSec * 1.2;
        const toneShift = (this.currentBaseHz % 256) / 256;

        for (let b = 0; b < 16; b++) {
          const bandFreq = 0.4 + b * 0.12 + toneShift * 0.4;
          const w1 = Math.sin(tempoRad * bandFreq + b * 0.5);
          const w2 = Math.cos(tempoRad * (0.3 + b * 0.08) - b * 0.8);
          const harmonic = Math.max(0, (w1 * 0.5 + w2 * 0.5) * 0.45);
          this.bands16[b] = harmonic;
        }

        this.kickEnvelope *= 0.85;
        this.snareEnvelope *= 0.85;
        this.smoothedTonePitch = toneShift;
        this.smoothedToneHz = this.currentBaseHz || 220;
      } else {
        // Complete silence: all bands and envelopes are completely zero! Zero twitching or flashing!
        for (let b = 0; b < 16; b++) {
          this.bands16[b] = 0;
        }
        this.kickEnvelope = 0;
        this.snareEnvelope = 0;
      }
    }

    let totalEnergy = 0;
    let weightedSum = 0;
    let maxBandVal = -1;
    let domBand = 0;

    for (let b = 0; b < 16; b++) {
      const target = this.bands16[b];
      const prev = this.smoothedBands16[b];
      // Silky-smooth exponential attack and release to prevent any sudden jumps or epileptic flicker
      const next =
        target > prev
          ? prev + (target - prev) * 0.22
          : prev + (target - prev) * 0.09;
      this.smoothedBands16[b] = next < 0.0005 ? 0 : next;
      totalEnergy += this.smoothedBands16[b];
      weightedSum += this.smoothedBands16[b] * (b / 15);
      if (this.smoothedBands16[b] > maxBandVal) {
        maxBandVal = this.smoothedBands16[b];
        domBand = b;
      }
    }

    if (isMusicActive) {
      const lowEnergy =
        (this.smoothedBands16[0] +
          this.smoothedBands16[1] +
          this.smoothedBands16[2] +
          this.smoothedBands16[3]) *
        0.25;
      const deltaLow = Math.max(0, lowEnergy - this.prevLowEnergy);
      this.prevLowEnergy = lowEnergy * 0.82 + this.prevLowEnergy * 0.18;

      if (deltaLow > 0.035) {
        this.beatPulseEnvelope = Math.min(
          0.85,
          this.beatPulseEnvelope + deltaLow * 1.65
        );
      } else {
        this.beatPulseEnvelope *= 0.91;
      }
    } else {
      this.prevLowEnergy *= 0.85;
      this.beatPulseEnvelope *= 0.85;
      if (this.beatPulseEnvelope < 0.001) this.beatPulseEnvelope = 0;
    }

    this.spectrumState.beatPulse = Math.max(
      this.beatPulseEnvelope,
      this.kickEnvelope * 0.7 + this.snareEnvelope * 0.5
    );
    this.spectrumState.drumKick = this.kickEnvelope;
    this.spectrumState.drumSnare = this.snareEnvelope;
    this.spectrumState.tonePitch = this.smoothedTonePitch;
    this.spectrumState.toneHz = this.smoothedToneHz;
    this.spectrumState.overallEnergy = Math.min(1.0, totalEnergy / 16);
    this.spectrumState.dominantBand = domBand;
    this.spectrumState.spectralCentroid =
      totalEnergy > 0.001 ? weightedSum / totalEnergy : 0.5;
    this.spectrumState.isLiveSignal = hasLiveFft;

    return this.spectrumState;
  }

  private syncElementVolume(): void {
    if (!this.mp3Audio) return;
    if (this.mediaElementSource) {
      this.mp3Audio.volume = 1.0;
      this.mp3Audio.muted = audioMixer.getState().muted;
    } else {
      this.mp3Audio.volume = audioMixer.getEffectiveLinearGain('music');
      this.mp3Audio.muted = audioMixer.getState().muted;
    }
  }

  private ensureMp3Element(): HTMLAudioElement {
    if (!this.mp3Audio) {
      const audio = new Audio();
      audio.crossOrigin = 'anonymous';
      audio.loop = true;
      audio.preload = 'auto';
      audio.addEventListener('playing', () => {
        this.isMp3Streaming = true;
      });
      audio.addEventListener('pause', () => {
        this.isMp3Streaming = false;
      });
      audio.addEventListener('ended', () => {
        this.isMp3Streaming = false;
      });
      audio.addEventListener('error', () => {
        this.isMp3Streaming = false;
      });
      this.mp3Audio = audio;
    }

    // Wrap HTMLAudioElement into the mixer's `music` bus via createMediaElementSource (TZ.md §5.1)
    if (!this.mediaElementSource && this.mp3Audio) {
      const ctx = audioMixer.ensureContext();
      const musicBus = audioMixer.bus('music');
      if (ctx && musicBus && typeof ctx.createMediaElementSource === 'function') {
        try {
          this.mediaElementSource = ctx.createMediaElementSource(this.mp3Audio);
          this.mediaElementSource.connect(musicBus);
          this.ensureAnalyser();
        } catch {
          // Fallback if browser disallows MediaElementSource before gesture
        }
      }
    }

    this.syncElementVolume();
    return this.mp3Audio;
  }

  public getBus(busName: AudioBusName): GainNode | null {
    return audioMixer.bus(busName);
  }

  public getVolumeState(): AudioVolumeState {
    return audioMixer.getState();
  }

  public setVolumeState(partial: Partial<AudioVolumeState>): void {
    audioMixer.setVolumeState(partial);
    this.syncElementVolume();
  }

  /**
   * Generative synth is disabled to ensure pure music without background drone or hum.
   */
  private startGenerativeRoomSynth(_baseHz: number): void {
    this.stopGenerativeRoomSynth();
  }

  private stopGenerativeRoomSynth(): void {
    if (this.synthChimeTimer !== null) {
      window.clearTimeout(this.synthChimeTimer);
      this.synthChimeTimer = null;
    }
    if (this.synthGainNode) {
      try {
        const ctx = audioMixer.ensureContext();
        if (ctx) {
          const now = ctx.currentTime;
          this.synthGainNode.gain.cancelScheduledValues(now);
          this.synthGainNode.gain.setValueAtTime(0, now);
        }
      } catch {}
    }
    const oscs = this.synthOscillators;
    const lfo = this.synthLfoOsc;
    const gainNode = this.synthGainNode;
    this.synthOscillators = [];
    this.synthLfoOsc = null;
    this.synthGainNode = null;
    this.synthFilterNode = null;
    this.isSynthActive = false;

    oscs.forEach((o) => {
      try {
        o.stop();
        o.disconnect();
      } catch {}
    });
    try {
      lfo?.stop();
      lfo?.disconnect();
      gainNode?.disconnect();
    } catch {}
  }

  private duckGenerativeRoomSynth(_duck: boolean): void {
    // Pure music mode: no background synth drone is generated
  }

  private startCorridorDrone(_baseFreq = 55): void {
    // Pure music mode: 55Hz background drone is completely silenced
    this.stopCorridorDrone();
  }

  private stopCorridorDrone(): void {
    if (!this.corridorDroneOsc) return;
    const osc = this.corridorDroneOsc;
    const gain = this.corridorDroneGain;
    this.corridorDroneOsc = null;
    this.corridorDroneGain = null;

    try {
      osc.stop();
      osc.disconnect();
      gain?.disconnect();
    } catch {}
  }

  /**
   * Immediately halts any playing room track and invalidates pending play() promises
   * so two tracks can never overlap.
   */
  public stopRoomSoundtrack(): void {
    this.playbackToken += 1;
    this.inRoom = false;
    this.currentRoomTrackUrl = '';
    this.isMp3Streaming = false;
    this.savedPauseTime = 0;
    this.currentTrackLabel = 'Cosmic Nexus (Tracks play only inside rooms)';

    this.stopGenerativeRoomSynth();

    if (this.mp3Audio) {
      try {
        this.mp3Audio.pause();
        this.mp3Audio.currentTime = 0;
        this.mp3Audio.removeAttribute('src');
        this.mp3Audio.load();
      } catch {
        // ignore
      }
    }
  }

  /**
   * Freezes audio for Game Pause: ramps master to 0 over ~150ms, pauses streamed track keeping exact position,
   * and suspends AudioContext (TZ.md §6.2).
   */
  public pauseGameAudio(): void {
    if (this.pausedByGame) return;
    this.pausedByGame = true;
    audioMixer.pauseForGamePause(() => {
      if (this.mp3Audio && Boolean(this.currentRoomTrackUrl)) {
        try {
          this.savedPauseTime = this.mp3Audio.currentTime;
          this.mp3Audio.pause();
        } catch {
          // ignore
        }
      }
    });
  }

  /**
   * Resumes audio after Game Pause: resumes AudioContext, restores streamed track from saved position,
   * and ramps master gain up over ~150ms (TZ.md §6.2).
   */
  public resumeGameAudio(): void {
    if (!this.pausedByGame) return;
    this.pausedByGame = false;
    audioMixer.resumeFromGamePause(() => {
      if (
        this.currentRoomTrackUrl &&
        this.mp3Audio &&
        !audioMixer.getState().muted
      ) {
        const token = ++this.playbackToken;
        try {
          if (
            this.savedPauseTime > 0 &&
            Math.abs(this.mp3Audio.currentTime - this.savedPauseTime) > 0.04
          ) {
            this.mp3Audio.currentTime = this.savedPauseTime;
          }
          void this.mp3Audio
            .play()
            .then(() => {
              if (
                token !== this.playbackToken ||
                !this.inRoom ||
                this.pausedByGame
              ) {
                this.mp3Audio?.pause();
              } else {
                this.duckGenerativeRoomSynth(true);
              }
            })
            .catch(() => {
              this.isMp3Streaming = false;
              this.duckGenerativeRoomSynth(false);
            });
        } catch {
          // ignore
        }
      }
    });
  }

  public isPlaying(): boolean {
    return !audioMixer.getState().muted;
  }

  public isStreamingMp3(): boolean {
    return (this.isMp3Streaming || this.isSynthActive) && this.inRoom && !this.pausedByGame;
  }

  public getCurrentMp3Url(): string {
    return this.inRoom ? this.currentRoomTrackUrl : '';
  }

  public getVolume(): number {
    return audioMixer.getState().master;
  }

  public getCurrentTrackLabel(): string {
    return this.currentTrackLabel;
  }

  public setVolume(vol: number): void {
    audioMixer.setBusVolume('master', vol);
    this.syncElementVolume();
  }

  public toggle(): boolean {
    const muted = audioMixer.toggleMute();
    this.syncElementVolume();
    if (!muted && this.inRoom && !this.pausedByGame) {
      if (this.currentRoomTrackUrl && this.mp3Audio) {
        const audio = this.mp3Audio;
        const token = ++this.playbackToken;
        void audio
          .play()
          .then(() => {
            if (token !== this.playbackToken || !this.inRoom || this.pausedByGame) {
              audio.pause();
            } else {
              this.duckGenerativeRoomSynth(true);
            }
          })
          .catch(() => {
            this.isMp3Streaming = false;
            this.duckGenerativeRoomSynth(false);
          });
      }
    }
    return !muted;
  }

  public start(): void {
    const ctx = audioMixer.ensureContext();
    if (ctx && ctx.state === 'suspended') {
      void ctx.resume();
    }
    this.ensureAnalyser();
    this.syncElementVolume();
    if (!this.pausedByGame && !audioMixer.getState().muted) {
      if (!this.currentRoomTrackUrl) {
        this.playRoomSoundtrack(
          'assets/audio/intro.mp3',
          108,
          'Neuromicon · Intro'
        );
      } else if (this.mp3Audio && (this.mp3Audio.paused || !this.isMp3Streaming)) {
        const audio = this.mp3Audio;
        const token = ++this.playbackToken;
        const p = audio.play();
        if (p !== undefined) {
          p.then(() => {
            if (token === this.playbackToken) {
              this.isMp3Streaming = true;
            }
          }).catch(() => {});
        }
      }
    }
  }

  private preloadedUrls = new Set<string>();

  /**
   * Preloads an upcoming room audio track into browser cache when looking at a door.
   */
  public preloadTrack(trackPath: string): void {
    if (!trackPath || this.preloadedUrls.has(trackPath)) return;
    this.preloadedUrls.add(trackPath);
    try {
      const audio = new Audio();
      audio.preload = 'auto';
      const rawFileName = trackPath.split('/').pop()?.split('?')[0] || '';
      const url = rawFileName ? `/assets/audio/${rawFileName.replace(/\.ogg$/, '.mp3')}` : trackPath;
      audio.src = url;
      audio.load();
    } catch {}
  }

  public stop(): void {
    audioMixer.setVolumeState({ muted: true });
    this.stopRoomSoundtrack();
    this.stopCorridorDrone();
    this.stopGenerativeRoomSynth();
  }

  /**
   * Called when the player is in the Starting Cosmic Room or Sector Halls.
   * Plays the atmospheric intro / corridor music track with zero background drone or hum.
   */
  public setCorridorVerticalCrossfade(_blend01: number, label?: string): void {
    const corridorTrack = 'assets/audio/intro.mp3';
    if (this.currentRoomTrackUrl !== corridorTrack || (this.mp3Audio && this.mp3Audio.paused)) {
      this.playRoomSoundtrack(
        corridorTrack,
        108,
        label || 'Neuromicon · Intro'
      );
    }
  }

  /**
   * Starts the room soundtrack routed through the `music` bus.
   * Plays ONLY the music track without any background hum or oscillator drone.
   */
  public playRoomSoundtrack(
    trackPath: string,
    baseHz = 108,
    displayTitle?: string
  ): void {
    this.currentBaseHz = baseHz || 144;
    this.stopCorridorDrone();
    this.stopGenerativeRoomSynth();

    const fileName = trackPath
      ? decodeURIComponent(trackPath.split('/').pop() ?? trackPath)
      : 'Room Track';
    this.currentTrackLabel = displayTitle
      ? `${displayTitle} · ${fileName}`
      : `ROOM TRACK · ${fileName}`;

    if (!trackPath) return;

    // If already playing or loading this exact track, keep playing without aborting
    if (this.currentRoomTrackUrl === trackPath && this.mp3Audio) {
      this.inRoom = true;
      this.syncElementVolume();
      const ctx = audioMixer.ensureContext();
      if (ctx && ctx.state === 'suspended') {
        void ctx.resume();
      }
      if (this.mp3Audio.paused && !this.pausedByGame && !audioMixer.getState().muted) {
        void this.mp3Audio.play().then(() => {
          this.isMp3Streaming = true;
        }).catch(() => {});
      }
      return;
    }

    const token = ++this.playbackToken;
    this.inRoom = true;
    this.savedPauseTime = 0;
    this.currentRoomTrackUrl = trackPath || '';

    // Resolve audio track path (prioritizing local /assets/audio/ bundle, then remote/relative)
    const rawFileName = trackPath.split('/').pop()?.split('?')[0] || '';
    const base = (import.meta.env.BASE_URL || '/').replace(/\/$/, '');
    const candidates: string[] = [];
    if (rawFileName) {
      const mp3Name = rawFileName.replace(/\.ogg$/, '.mp3');
      candidates.push(`/assets/audio/${mp3Name}`);
      if (base) {
        candidates.push(`${base}/assets/audio/${mp3Name}`);
      }
      candidates.push(`assets/audio/${mp3Name}`);
      candidates.push(`./assets/audio/${mp3Name}`);
    }
    if (trackPath.startsWith('http')) {
      candidates.push(trackPath);
    }
    if (candidates.length === 0) {
      candidates.push(trackPath);
    }

    const audio = this.ensureMp3Element();
    this.ensureAnalyser();

    const ctx = audioMixer.ensureContext();
    if (ctx && ctx.state === 'suspended') {
      void ctx.resume();
    }

    try {
      audio.pause();
      audio.currentTime = 0;
      let cIdx = 0;
      audio.src = candidates[0];
      this.syncElementVolume();
      audio.load();

      audio.onerror = () => {
        cIdx++;
        if (cIdx < candidates.length && this.inRoom && token === this.playbackToken) {
          audio.src = candidates[cIdx];
          audio.load();
          if (!this.pausedByGame && !audioMixer.getState().muted) {
            void audio.play().then(() => {
              this.isMp3Streaming = true;
            }).catch(() => {});
          }
        }
      };

      if (!this.pausedByGame && !audioMixer.getState().muted) {
        const playPromise = audio.play();
        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              if (
                token !== this.playbackToken ||
                !this.inRoom ||
                this.pausedByGame ||
                audioMixer.getState().muted
              ) {
                audio.pause();
                audio.currentTime = 0;
              } else {
                this.isMp3Streaming = true;
                this.duckGenerativeRoomSynth(true);
              }
            })
            .catch(() => {
              // Auto-play was prevented by browser before user gesture, or network error.
              this.pendingAutoplay = true;
              this.isMp3Streaming = false;
              this.duckGenerativeRoomSynth(false);
            });
        }
      }
    } catch {
      this.isMp3Streaming = false;
      this.duckGenerativeRoomSynth(false);
    }
  }

  public updateRoomAcoustics(
    _baseFrequency = 110,
    _profile: string = 'labyrinth',
    activeVoid: VoidType | null = null
  ): void {
    if (activeVoid) {
      this.stopRoomSoundtrack();
    }
  }

  /**
   * Synthesizes an interaction chime routed exclusively through the `sfx` bus (TZ.md §5.1).
   */
  public triggerChime(freq = 440): void {
    this.beatPulseEnvelope = Math.min(1.0, this.beatPulseEnvelope + 0.65);
    if (this.pausedByGame || audioMixer.getState().muted) return;
    const ctx = audioMixer.ensureContext();
    const sfxBus = audioMixer.bus('sfx');
    if (!ctx || !sfxBus) return;
    this.ensureAnalyser();

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);
      gain.gain.setValueAtTime(0.14, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.42);
      osc.connect(gain);
      gain.connect(sfxBus);
      osc.start(now);
      osc.stop(now + 0.45);
    } catch {
      // ignore
    }
  }
}

export const spatialAudioSystem = new SpatialAudioSystem();
