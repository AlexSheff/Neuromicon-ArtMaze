import { VoidType } from '../../types/artmaze';

const NEUROMICON_INTRO_MP3 =
  'https://raw.githubusercontent.com/AlexSheff/Neuromicon/main/Intro/00_Intro.mp3';

/**
 * WebAudio + Neuromicon MP3 Streaming Engine (AGENTS.md §4A.6 & §7.8).
 * - Streams real MP3 tracks from https://github.com/AlexSheff/Neuromicon (1 Room = 1 Track).
 * - Crossfades two harmonic ambient layers (Ascent vs Descent) by vertical position/head pitch in the Threshold & Corridor.
 * - Replaces corridor ambience with each room's unique MP3 soundtrack on mount.
 */
export class SpatialAudioSystem {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private ascentGain: GainNode | null = null;
  private descentGain: GainNode | null = null;
  private roomGain: GainNode | null = null;

  private ascentOscs: OscillatorNode[] = [];
  private descentOscs: OscillatorNode[] = [];
  private roomOscs: OscillatorNode[] = [];

  private mp3Audio: HTMLAudioElement | null = null;
  private currentMp3Url = '';
  private isMp3Streaming = false;

  private active = false;
  private volume = 0.75;
  private currentTrackLabel =
    '00 · Intro (Threshold Vertical Ambience)';

  private ensureMp3Element(): HTMLAudioElement {
    if (!this.mp3Audio) {
      const audio = new Audio();
      audio.crossOrigin = 'anonymous';
      audio.loop = true;
      audio.preload = 'auto';
      audio.volume = this.volume * 0.85;
      audio.addEventListener('playing', () => {
        this.isMp3Streaming = true;
      });
      audio.addEventListener('pause', () => {
        this.isMp3Streaming = false;
      });
      audio.addEventListener('error', () => {
        this.isMp3Streaming = false;
      });
      this.mp3Audio = audio;
    }
    return this.mp3Audio;
  }

  private playMp3Url(url: string, gainScale = 0.85): void {
    if (!url || !url.startsWith('http')) return;
    try {
      const audio = this.ensureMp3Element();
      audio.volume = Math.max(0, Math.min(1, this.volume * gainScale));
      if (this.currentMp3Url !== url) {
        this.currentMp3Url = url;
        audio.src = url;
        audio.load();
      }
      if (this.active) {
        void audio.play().catch(() => {
          this.isMp3Streaming = false;
        });
      }
    } catch {
      this.isMp3Streaming = false;
    }
  }

  public isPlaying(): boolean {
    return this.active;
  }

  public isStreamingMp3(): boolean {
    return this.isMp3Streaming;
  }

  public getCurrentMp3Url(): string {
    return this.currentMp3Url;
  }

  public getVolume(): number {
    return this.volume;
  }

  public getCurrentTrackLabel(): string {
    return this.currentTrackLabel;
  }

  public setVolume(vol: number): void {
    this.volume = Math.max(0, Math.min(1, vol));
    if (this.ctx && this.masterGain && this.active) {
      this.masterGain.gain.setTargetAtTime(
        this.volume * 0.12,
        this.ctx.currentTime,
        0.1
      );
    }
    if (this.mp3Audio) {
      this.mp3Audio.volume = Math.max(0, Math.min(1, this.volume * 0.85));
    }
  }

  public toggle(): boolean {
    if (this.active) {
      this.stop();
      return false;
    }
    this.start();
    return true;
  }

  public start(): void {
    if (this.active) return;
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      if (!this.ctx) {
        this.ctx = new AudioCtx();
      }
      if (this.ctx.state === 'suspended') {
        void this.ctx.resume();
      }

      const now = this.ctx.currentTime;
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0.0001, now);
      this.masterGain.gain.exponentialRampToValueAtTime(
        Math.max(0.001, this.volume * 0.12),
        now + 0.8
      );
      this.masterGain.connect(this.ctx.destination);

      this.ascentGain = this.ctx.createGain();
      this.descentGain = this.ctx.createGain();
      this.roomGain = this.ctx.createGain();

      this.ascentGain.gain.setValueAtTime(0.45, now);
      this.descentGain.gain.setValueAtTime(0.45, now);
      this.roomGain.gain.setValueAtTime(0.0001, now);

      this.ascentGain.connect(this.masterGain);
      this.descentGain.connect(this.masterGain);
      this.roomGain.connect(this.masterGain);

      // Ascent Layer: Warm luminous fifths & octave (220Hz, 330Hz, 440Hz)
      [220, 329.63, 440].forEach((freq, idx) => {
        if (!this.ctx || !this.ascentGain) return;
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = idx === 0 ? 'sine' : 'triangle';
        osc.frequency.setValueAtTime(freq, now);
        g.gain.setValueAtTime(0.28 / (idx + 1), now);
        osc.connect(g);
        g.connect(this.ascentGain);
        osc.start();
        this.ascentOscs.push(osc);
      });

      // Descent Layer: Deep subterranean bass drone (73.4Hz D2, 110Hz A2, 146.8Hz D3)
      [73.42, 110, 146.83].forEach((freq, idx) => {
        if (!this.ctx || !this.descentOscs || !this.descentGain) return;
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now);
        g.gain.setValueAtTime(0.36 / (idx + 1), now);
        osc.connect(g);
        g.connect(this.descentGain);
        osc.start();
        this.descentOscs.push(osc);
      });

      // Room Subtle Harmonic Bed Layer
      [108, 162, 216].forEach((freq, idx) => {
        if (!this.ctx || !this.roomGain) return;
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = idx === 1 ? 'triangle' : 'sine';
        osc.frequency.setValueAtTime(freq, now);
        g.gain.setValueAtTime(0.18 / (idx + 1), now);
        osc.connect(g);
        g.connect(this.roomGain);
        osc.start();
        this.roomOscs.push(osc);
      });

      this.active = true;
      // Start streaming the active MP3 track (or Intro MP3 in Threshold)
      this.playMp3Url(this.currentMp3Url || NEUROMICON_INTRO_MP3, 0.75);
    } catch {
      this.active = false;
    }
  }

  public stop(): void {
    this.ascentOscs.forEach((o) => {
      try {
        o.stop();
        o.disconnect();
      } catch {
        // ignore
      }
    });
    this.descentOscs.forEach((o) => {
      try {
        o.stop();
        o.disconnect();
      } catch {
        // ignore
      }
    });
    this.roomOscs.forEach((o) => {
      try {
        o.stop();
        o.disconnect();
      } catch {
        // ignore
      }
    });
    this.ascentOscs = [];
    this.descentOscs = [];
    this.roomOscs = [];
    if (this.mp3Audio) {
      this.mp3Audio.pause();
    }
    this.isMp3Streaming = false;
    this.active = false;
  }

  /**
   * Crossfades the two corridor ambient layers by vertical position or head pitch (§4A.6)
   * while streaming Neuromicon `00_Intro.mp3` in the corridor/threshold.
   */
  public setCorridorVerticalCrossfade(blend01: number, label?: string): void {
    if (label) this.currentTrackLabel = label;
    if (this.currentMp3Url !== NEUROMICON_INTRO_MP3) {
      this.playMp3Url(NEUROMICON_INTRO_MP3, 0.55);
    }
    if (
      !this.active ||
      !this.ctx ||
      !this.ascentGain ||
      !this.descentGain ||
      !this.roomGain
    ) {
      return;
    }
    const b = Math.max(0, Math.min(1, blend01));
    const now = this.ctx.currentTime;
    this.ascentGain.gain.setTargetAtTime(0.12 + b * 0.65, now, 0.35);
    this.descentGain.gain.setTargetAtTime(0.12 + (1 - b) * 0.65, now, 0.35);
    this.roomGain.gain.setTargetAtTime(0.0001, now, 0.35);
  }

  /**
   * Replaces corridor ambience with the mounted room's own Neuromicon MP3 soundtrack (§4A.6 & §7.8).
   */
  public playRoomSoundtrack(
    trackPath: string,
    baseHz = 108,
    displayTitle?: string
  ): void {
    const fileName = trackPath.split('/').pop() ?? trackPath;
    this.currentTrackLabel = displayTitle
      ? `${displayTitle} (${fileName})`
      : `NEUROMICON · ${fileName}`;

    if (trackPath.startsWith('http')) {
      this.playMp3Url(trackPath, 0.9);
    }

    if (
      !this.active ||
      !this.ctx ||
      !this.ascentGain ||
      !this.descentGain ||
      !this.roomGain
    ) {
      return;
    }
    const now = this.ctx.currentTime;
    this.ascentGain.gain.setTargetAtTime(0.0001, now, 0.3);
    this.descentGain.gain.setTargetAtTime(0.0001, now, 0.3);
    // Keep oscillator bed subtle when streaming real MP3
    this.roomGain.gain.setTargetAtTime(
      trackPath.startsWith('http') ? 0.18 : 0.85,
      now,
      0.4
    );

    const ratios = [1, 1.498, 2.0];
    this.roomOscs.forEach((osc, idx) => {
      if (!this.ctx) return;
      osc.frequency.setTargetAtTime(baseHz * (ratios[idx] ?? 1), now, 0.25);
    });
  }

  public updateRoomAcoustics(
    baseFrequency = 110,
    profile: string = 'labyrinth',
    activeVoid: VoidType | null = null
  ): void {
    if (activeVoid) {
      this.playRoomSoundtrack(NEUROMICON_INTRO_MP3, 82, `VOID · ${activeVoid}`);
    } else if (profile === 'ascend') {
      this.setCorridorVerticalCrossfade(1.0, 'ASCENT · Celestial Harmonic Layer');
    } else if (profile === 'descend') {
      this.setCorridorVerticalCrossfade(
        0.0,
        'DESCENT · Subterranean Abyss Layer'
      );
    } else {
      this.playRoomSoundtrack(NEUROMICON_INTRO_MP3, baseFrequency);
    }
  }

  public triggerChime(freq = 440): void {
    if (!this.active || !this.ctx || !this.masterGain) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.65);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.68);
    } catch {
      // ignore
    }
  }
}

export const spatialAudioSystem = new SpatialAudioSystem();
