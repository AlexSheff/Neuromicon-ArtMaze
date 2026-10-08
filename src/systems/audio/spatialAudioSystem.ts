import { VoidType } from '../../types/artmaze';

/**
 * Procedural WebAudio synthesizer for Neuromicon ArtMaze.
 * Generates low-comfort monumental room harmonics without external audio dependencies.
 */
export class SpatialAudioSystem {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private oscillators: OscillatorNode[] = [];
  private isEnabled = false;
  private currentProfile = 'labyrinth';

  public toggle(): boolean {
    if (this.isEnabled) {
      this.stop();
      return false;
    }
    this.start();
    return true;
  }

  public isPlaying(): boolean {
    return this.isEnabled;
  }

  public start(baseFreq = 110, profile = 'labyrinth'): void {
    try {
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        this.ctx = new AudioCtx();
      }
      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      this.stopOscillators();

      const master = this.ctx.createGain();
      master.gain.setValueAtTime(0.01, this.ctx.currentTime);
      master.gain.exponentialRampToValueAtTime(0.12, this.ctx.currentTime + 1.5);
      master.connect(this.ctx.destination);
      this.masterGain = master;

      const ratios =
        profile === 'mirror'
          ? [1, 1.414, 2.0, 2.828]
          : profile === 'memory'
          ? [1, 1.2, 1.5, 2.0]
          : profile === 'cathedral'
          ? [1, 1.498, 2.0, 3.0]
          : [1, 1.5, 2.0, 2.5];

      ratios.forEach((ratio, idx) => {
        if (!this.ctx || !this.masterGain) return;
        const osc = this.ctx.createOscillator();
        const oscGain = this.ctx.createGain();
        osc.type = idx % 2 === 0 ? 'sine' : 'triangle';
        osc.frequency.setValueAtTime(baseFreq * ratio, this.ctx.currentTime);
        oscGain.gain.setValueAtTime(0.22 / (idx + 1), this.ctx.currentTime);
        osc.connect(oscGain);
        oscGain.connect(this.masterGain);
        osc.start();
        this.oscillators.push(osc);
      });

      this.currentProfile = profile;
      this.isEnabled = true;
    } catch {
      this.isEnabled = false;
    }
  }

  public updateRoomAcoustics(baseFreq = 110, profile = 'labyrinth', activeVoid?: VoidType | null): void {
    if (!this.isEnabled || !this.ctx) return;
    const freq = activeVoid ? 73.42 : baseFreq;
    const nextProfile = activeVoid ? 'void' : profile;
    if (nextProfile !== this.currentProfile) {
      this.start(freq, nextProfile);
    }
  }

  public triggerChime(freq = 440): void {
    if (!this.isEnabled || !this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 1.4);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 1.45);
    } catch {
      // Ignore audio errors when context is inactive
    }
  }

  private stopOscillators(): void {
    this.oscillators.forEach((osc) => {
      try {
        osc.stop();
        osc.disconnect();
      } catch {
        // Ignore already stopped oscillators
      }
    });
    this.oscillators = [];
  }

  public stop(): void {
    this.stopOscillators();
    this.isEnabled = false;
  }
}

export const spatialAudioSystem = new SpatialAudioSystem();
