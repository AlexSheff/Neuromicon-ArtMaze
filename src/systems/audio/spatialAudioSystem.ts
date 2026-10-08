import { VoidType } from '../../types/artmaze';

/**
 * WebAudio Spatial & Crossfade Ambience Engine (AGENTS.md §4A.6 & §7.8).
 * - Crossfades two harmonic ambient layers (Ascent vs Descent) by vertical position/branch.
 * - Replaces corridor ambience with each room's unique soundtrack on mount.
 * - Controlled via Key Z (mute / volume).
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

  private active = false;
  private volume = 0.7;
  private currentTrackLabel = 'THRESHOLD · Dual Vertical Ambience (Ascent / Descent)';

  public isPlaying(): boolean {
    return this.active;
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
        this.volume * 0.14,
        this.ctx.currentTime,
        0.1
      );
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
        this.ctx.resume();
      }

      const now = this.ctx.currentTime;
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0.0001, now);
      this.masterGain.gain.exponentialRampToValueAtTime(
        Math.max(0.001, this.volume * 0.14),
        now + 0.8
      );
      this.masterGain.connect(this.ctx.destination);

      this.ascentGain = this.ctx.createGain();
      this.descentGain = this.ctx.createGain();
      this.roomGain = this.ctx.createGain();

      this.ascentGain.gain.setValueAtTime(0.5, now);
      this.descentGain.gain.setValueAtTime(0.5, now);
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
        g.gain.setValueAtTime(0.32 / (idx + 1), now);
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
        g.gain.setValueAtTime(0.42 / (idx + 1), now);
        osc.connect(g);
        g.connect(this.descentGain);
        osc.start();
        this.descentOscs.push(osc);
      });

      // Room Dedicated Layer
      [108, 162, 216].forEach((freq, idx) => {
        if (!this.ctx || !this.roomGain) return;
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = idx === 1 ? 'triangle' : 'sine';
        osc.frequency.setValueAtTime(freq, now);
        g.gain.setValueAtTime(0.38 / (idx + 1), now);
        osc.connect(g);
        g.connect(this.roomGain);
        osc.start();
        this.roomOscs.push(osc);
      });

      this.active = true;
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
    this.active = false;
  }

  /**
   * Crossfades the two corridor ambient layers by vertical position or active branch (§4A.6).
   * blend = 0.0 (full Descent abyss), 0.5 (Threshold neutral), 1.0 (full Ascent light).
   */
  public setCorridorVerticalCrossfade(blend01: number, label?: string): void {
    if (label) this.currentTrackLabel = label;
    if (!this.active || !this.ctx || !this.ascentGain || !this.descentGain || !this.roomGain) {
      return;
    }
    const b = Math.max(0, Math.min(1, blend01));
    const now = this.ctx.currentTime;
    this.ascentGain.gain.setTargetAtTime(0.15 + b * 0.85, now, 0.35);
    this.descentGain.gain.setTargetAtTime(0.15 + (1 - b) * 0.85, now, 0.35);
    this.roomGain.gain.setTargetAtTime(0.0001, now, 0.35);
  }

  /**
   * Replaces corridor ambience with the mounted room's own soundtrack (§4A.6 & §7.8).
   */
  public playRoomSoundtrack(trackPath: string, baseHz = 108): void {
    this.currentTrackLabel = `ROOM TRACK · ${trackPath} (${baseHz} Hz)`;
    if (!this.active || !this.ctx || !this.ascentGain || !this.descentGain || !this.roomGain) {
      return;
    }
    const now = this.ctx.currentTime;
    this.ascentGain.gain.setTargetAtTime(0.0001, now, 0.3);
    this.descentGain.gain.setTargetAtTime(0.0001, now, 0.3);
    this.roomGain.gain.setTargetAtTime(0.95, now, 0.4);

    const ratios = [1, 1.498, 2.0];
    this.roomOscs.forEach((osc, idx) => {
      if (!this.ctx) return;
      osc.frequency.setTargetAtTime(baseHz * (ratios[idx] ?? 1), now, 0.25);
    });
  }

  // Backward-compatible method used by legacy callers
  public updateRoomAcoustics(
    baseFrequency = 110,
    profile: string = 'labyrinth',
    activeVoid: VoidType | null = null
  ): void {
    if (activeVoid) {
      this.playRoomSoundtrack(`void/${activeVoid}.ogg`, 82);
    } else if (profile === 'ascend') {
      this.setCorridorVerticalCrossfade(1.0, 'ASCENT · Celestial Harmonic Layer');
    } else if (profile === 'descend') {
      this.setCorridorVerticalCrossfade(0.0, 'DESCENT · Subterranean Abyss Layer');
    } else {
      this.playRoomSoundtrack(`audio/${profile}.ogg`, baseFrequency);
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
