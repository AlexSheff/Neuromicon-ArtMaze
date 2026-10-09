import { VoidType } from '../../types/artmaze';
import {
  AudioBusName,
  audioMixer,
  AudioVolumeState,
} from './mixer';

/**
 * Spatial & Room Audio System for Neuromicon Artmaze (TZ.md §5 & §6).
 * Strictly enforces:
 * 1. All sources route through `audioMixer.bus('music' | 'ambient' | 'sfx')` -> `masterGain` -> `limiter`.
 * 2. One Room = One MP3 Track from https://github.com/AlexSheff/Neuromicon.
 * 3. Tracks play ONLY inside rooms (never in the Starting Cosmic Room, Sector Halls, or Void).
 * 4. Tracks NEVER overlap: entering a new room or leaving a room immediately halts and resets
 *    any prior track before starting the next one.
 * 5. Game Pause freezes MP3 playback at its exact `currentTime` and resumes seamlessly (± 50 ms).
 */
export class SpatialAudioSystem {
  private mp3Audio: HTMLAudioElement | null = null;
  private mediaElementSource: MediaElementAudioSourceNode | null = null;
  private currentRoomTrackUrl = '';
  private isMp3Streaming = false;
  private inRoom = false;
  private pausedByGame = false;
  private savedPauseTime = 0;
  private playbackToken = 0;

  private currentTrackLabel = 'Cosmic Nexus (Silent Outside Rooms)';

  constructor() {
    // Sync HTMLAudioElement fallback volume whenever mixer state changes
    audioMixer.subscribe(() => {
      this.syncElementVolume();
    });
  }

  private syncElementVolume(): void {
    if (!this.mp3Audio) return;
    // If routed through WebAudio MediaElementAudioSourceNode, WebAudio GainNodes control volume
    // and element.volume stays 1.0. If WebAudio graph isn't attached yet, apply perceptual gain directly.
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
    this.syncElementVolume();
    if (this.inRoom && this.currentRoomTrackUrl && !this.pausedByGame) {
      this.playRoomSoundtrack(this.currentRoomTrackUrl, 144);
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
    _baseHz = 108,
    displayTitle?: string
  ): void {
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
    if (this.pausedByGame || audioMixer.getState().muted) return;
    const ctx = audioMixer.ensureContext();
    const sfxBus = audioMixer.bus('sfx');
    if (!ctx || !sfxBus) return;

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
