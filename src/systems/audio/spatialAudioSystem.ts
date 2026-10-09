import { VoidType } from '../../types/artmaze';

/**
 * Spatial & Room Audio System for Neuromicon Artmaze.
 * Strictly enforces:
 * 1. One Room = One MP3 Track from https://github.com/AlexSheff/Neuromicon.
 * 2. Tracks play ONLY inside rooms (never in the Starting Cosmic Room, Corridor, or Void).
 * 3. Tracks NEVER overlap: entering a new room or leaving a room immediately halts and resets
 *    any prior track before starting the next one.
 */
export class SpatialAudioSystem {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;

  private mp3Audio: HTMLAudioElement | null = null;
  private currentRoomTrackUrl = '';
  private isMp3Streaming = false;
  private inRoom = false;
  private playbackToken = 0;

  private active = true;
  private volume = 0.8;
  private currentTrackLabel = 'Cosmic Nexus (Silent Outside Rooms)';

  private ensureAudioContext(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') {
        void this.ctx.resume();
      }
      return;
    }
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);
    } catch {
      // WebAudio context unavailable
    }
  }

  private ensureMp3Element(): HTMLAudioElement {
    if (!this.mp3Audio) {
      const audio = new Audio();
      audio.crossOrigin = 'anonymous';
      audio.loop = true;
      audio.preload = 'auto';
      audio.volume = this.volume;
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
    return this.mp3Audio;
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

  public isPlaying(): boolean {
    return this.active;
  }

  public isStreamingMp3(): boolean {
    return this.isMp3Streaming && this.inRoom;
  }

  public getCurrentMp3Url(): string {
    return this.inRoom ? this.currentRoomTrackUrl : '';
  }

  public getVolume(): number {
    return this.volume;
  }

  public getCurrentTrackLabel(): string {
    return this.currentTrackLabel;
  }

  public setVolume(vol: number): void {
    this.volume = Math.max(0, Math.min(1, vol));
    if (this.ctx && this.masterGain) {
      this.masterGain.gain.setTargetAtTime(
        this.volume,
        this.ctx.currentTime,
        0.05
      );
    }
    if (this.mp3Audio) {
      this.mp3Audio.volume = this.volume;
    }
  }

  public toggle(): boolean {
    this.active = !this.active;
    if (!this.active) {
      if (this.mp3Audio) {
        this.mp3Audio.pause();
      }
      this.isMp3Streaming = false;
    } else {
      this.ensureAudioContext();
      // Resume room track ONLY if player is currently inside a room
      if (this.inRoom && this.currentRoomTrackUrl && this.mp3Audio) {
        const token = ++this.playbackToken;
        void this.mp3Audio.play().then(() => {
          if (token !== this.playbackToken || !this.inRoom) {
            this.mp3Audio?.pause();
          }
        }).catch(() => {
          this.isMp3Streaming = false;
        });
      }
    }
    return this.active;
  }

  public start(): void {
    this.active = true;
    this.ensureAudioContext();
    if (this.inRoom && this.currentRoomTrackUrl) {
      this.playRoomSoundtrack(this.currentRoomTrackUrl, 144);
    }
  }

  public stop(): void {
    this.active = false;
    this.stopRoomSoundtrack();
  }

  /**
   * Called when the player is in the Starting Cosmic Room or Corridor.
   * Per user requirement, MP3 tracks play ONLY inside rooms and never outside.
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
   * Starts the unique MP3 track for the mounted room after strictly stopping any prior track.
   */
  public playRoomSoundtrack(
    trackPath: string,
    _baseHz = 108,
    displayTitle?: string
  ): void {
    // 1. Always stop any previous track first so two tracks never overlap
    const token = ++this.playbackToken;
    const audio = this.ensureMp3Element();
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
    this.currentRoomTrackUrl = trackPath;
    const fileName = decodeURIComponent(trackPath.split('/').pop() ?? trackPath);
    this.currentTrackLabel = displayTitle
      ? `${displayTitle} · ${fileName}`
      : `ROOM TRACK · ${fileName}`;

    audio.src = trackPath;
    audio.volume = this.volume;
    audio.load();

    if (this.active) {
      void audio
        .play()
        .then(() => {
          // If another room transition or exit happened while loading, immediately pause!
          if (
            token !== this.playbackToken ||
            !this.inRoom ||
            !this.active
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

  public triggerChime(freq = 440): void {
    if (!this.active) return;
    this.ensureAudioContext();
    if (!this.ctx || !this.masterGain) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.48);
    } catch {
      // ignore
    }
  }
}

export const spatialAudioSystem = new SpatialAudioSystem();
