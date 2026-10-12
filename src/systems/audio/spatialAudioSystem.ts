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
  private beatPulseEnvelope = 0;
  private currentBaseHz = 144;

  private currentRoomTrackUrl = '';
  private isMp3Streaming = false;
  private inRoom = false;
  private pausedByGame = false;
  private savedPauseTime = 0;
  private playbackToken = 0;

  private currentTrackLabel = 'Cosmic Nexus (Silent Outside Rooms)';

  private readonly spectrumState: AudioSpectrumState = {
    bands: this.smoothedBands16,
    beatPulse: 0,
    overallEnergy: 0,
    dominantBand: 0,
    spectralCentroid: 0.5,
    isLiveSignal: false,
  };

  constructor() {
    // Sync HTMLAudioElement fallback volume whenever mixer state changes
    audioMixer.subscribe(() => {
      this.syncElementVolume();
    });
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
      this.inRoom &&
      Boolean(this.currentRoomTrackUrl) &&
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
        for (let i = 1; i < 128; i++) {
          if (this.fftBytes[i] > maxByte) maxByte = this.fftBytes[i];
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
            const tilt = 1.0 + b * 0.05;
            const rawBand = Math.min(
              1.0,
              ((sum / count) * 0.72 + peak * 0.28) * tilt
            );
            this.bands16[b] = rawBand;
          }
        }
      } catch {
        hasLiveFft = false;
      }
    }

    if (!hasLiveFft) {
      if (isMusicActive) {
        // Gentle, liquid-smooth 16-band harmonic synthesis when inside an active music room
        // where external GitHub MP3 CORS restricts raw FFT byte reading.
        const tempoRad = timeSec * 0.92;
        const toneShift = (this.currentBaseHz % 256) / 256;

        for (let b = 0; b < 16; b++) {
          const bandFreq = 0.55 + b * 0.16 + toneShift * 0.65;
          const w1 = Math.sin(tempoRad * bandFreq + b * 0.78);
          const w2 = Math.cos(tempoRad * (0.38 + b * 0.09) - b * 1.15);
          const w3 = Math.sin(tempoRad * 0.85 - b * 0.42);
          const harmonic = Math.max(
            0,
            (w1 * 0.45 + w2 * 0.35 + w3 * 0.2 + 0.6) * 0.68
          );
          this.bands16[b] = Math.min(1.0, Math.pow(harmonic, 1.5) * 0.78);
        }
      } else {
        // Outside rooms or when audio is muted/stopped: zero target energy so nothing twitches without music!
        for (let b = 0; b < 16; b++) {
          this.bands16[b] = 0;
        }
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
          ? prev + (target - prev) * 0.18
          : prev + (target - prev) * 0.08;
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

    this.spectrumState.beatPulse = this.beatPulseEnvelope;
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
   * Immediately halts any playing MP3 track and invalidates pending play() promises
   * so two tracks can never overlap.
   */
  public stopRoomSoundtrack(): void {
    this.playbackToken += 1;
    this.inRoom = false;
    this.currentRoomTrackUrl = '';
    this.isMp3Streaming = false;
    this.savedPauseTime = 0;
    this.currentTrackLabel = 'Cosmic Nexus (Tracks play only inside rooms)';

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
      if (this.mp3Audio && this.inRoom) {
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
        this.inRoom &&
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
              }
            })
            .catch(() => {
              this.isMp3Streaming = false;
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
    return this.isMp3Streaming && this.inRoom && !this.pausedByGame;
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
    if (!muted && this.inRoom && this.currentRoomTrackUrl && !this.pausedByGame) {
      const audio = this.ensureMp3Element();
      const token = ++this.playbackToken;
      void audio
        .play()
        .then(() => {
          if (token !== this.playbackToken || !this.inRoom || this.pausedByGame) {
            audio.pause();
          }
        })
        .catch(() => {
          this.isMp3Streaming = false;
        });
    }
    return !muted;
  }

  public start(): void {
    audioMixer.ensureContext();
    this.ensureAnalyser();
    this.syncElementVolume();
    if (this.inRoom && this.currentRoomTrackUrl && !this.pausedByGame) {
      this.playRoomSoundtrack(this.currentRoomTrackUrl, this.currentBaseHz);
    }
  }

  public stop(): void {
    audioMixer.setVolumeState({ muted: true });
    this.stopRoomSoundtrack();
  }

  /**
   * Called when the player is in the Starting Cosmic Room or 3 Sector Rooms.
   * MP3 tracks play ONLY inside the 25 rooms and never outside.
   */
  public setCorridorVerticalCrossfade(_blend01: number, label?: string): void {
    if (this.inRoom || this.currentRoomTrackUrl) {
      this.stopRoomSoundtrack();
    }
    if (label) {
      this.currentTrackLabel = `${label} (Silent outside rooms)`;
    }
  }

  /**
   * Starts the unique MP3 track for the mounted room routed through the `music` bus.
   */
  public playRoomSoundtrack(
    trackPath: string,
    baseHz = 108,
    displayTitle?: string
  ): void {
    this.currentBaseHz = baseHz || 144;
    const token = ++this.playbackToken;
    const audio = this.ensureMp3Element();
    this.ensureAnalyser();
    try {
      audio.pause();
      audio.currentTime = 0;
    } catch {
      // ignore
    }

    if (!trackPath || !trackPath.startsWith('http')) {
      this.inRoom = false;
      this.currentRoomTrackUrl = '';
      this.isMp3Streaming = false;
      return;
    }

    this.inRoom = true;
    this.savedPauseTime = 0;
    this.currentRoomTrackUrl = trackPath;
    const fileName = decodeURIComponent(trackPath.split('/').pop() ?? trackPath);
    this.currentTrackLabel = displayTitle
      ? `${displayTitle} · ${fileName}`
      : `ROOM TRACK · ${fileName}`;

    audio.src = trackPath;
    this.syncElementVolume();
    audio.load();

    if (!this.pausedByGame && !audioMixer.getState().muted) {
      void audio
        .play()
        .then(() => {
          if (
            token !== this.playbackToken ||
            !this.inRoom ||
            this.pausedByGame ||
            audioMixer.getState().muted
          ) {
            audio.pause();
            audio.currentTime = 0;
          }
        })
        .catch(() => {
          this.isMp3Streaming = false;
        });
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
