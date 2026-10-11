import React, { useEffect, useRef, useState } from 'react';
import essay01PurposeRaw from '../../content/art/01_Purpose.md?raw';
import { SpatialInteractiveTarget } from '../corridor/corridorBuilder';
import { HubEngine, HubRenderTelemetry } from '../engine/hubEngine';
import { InputController } from '../engine/input/inputController';
import { webxrManager } from '../engine/xr/webxrManager';
import { ControlRevealId, eventBus } from '../events/eventBus';
import { t } from '../i18n/strings';
import { onboardingFSM } from '../onboarding/onboardingFSM';
import { OnboardingVisualState } from '../onboarding/types';
import { spatialAudioSystem } from '../systems/audio/spatialAudioSystem';
import { HubPlayerState, hubPlayerState } from '../state/playerState';
import { PlayerState } from '../types/artmaze';
import { getRoomV1Manifest } from '../world/roomStreamer';

interface LabyrinthViewportProps {
  lang?: 'en' | 'ru';
  playerState: PlayerState;
  onOpenStudioSection?: (
    section: 'protocol' | 'manifests' | 'registry' | 'validator'
  ) => void;
}

type ActiveContextualDrawer =
  | 'none'
  | 'codex'
  | 'radio'
  | 'comfort'
  | 'audio'
  | 'essay';

export const LabyrinthViewport: React.FC<LabyrinthViewportProps> = ({
  onOpenStudioSection,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<HubEngine | null>(null);
  const inputRef = useRef<InputController>(new InputController());

  const [hubState, setHubState] = useState<HubPlayerState>(() =>
    hubPlayerState.getState()
  );
  const [hoveredTarget, setHoveredTarget] =
    useState<SpatialInteractiveTarget | null>(null);
  const [hasFloorTeleportTarget, setHasFloorTeleportTarget] =
    useState<boolean>(false);
  const [onboardingVisual, setOnboardingVisual] =
    useState<OnboardingVisualState | null>(null);
  const [telemetry, setTelemetry] = useState<HubRenderTelemetry>({
    fps: 72,
    frameTimeMs: 11.2,
    drawCalls: 16,
    triangles: 4100,
    geometries: 22,
    textures: 6,
    textureMemoryMB: 4.8,
    resolutionScale: 1.0,
    nebulaId: 'NEB_0001',
    nebulaName: 'Carina Nebula Cosmic Cliffs (NGC 3372)',
    nebulaCredit: 'NASA, ESA, CSA, and STScI',
    nebulaLicense: 'PD-NASA',
    nebulaPalette: ['#c46a3a', '#2b5f8c', '#e8d9b5'],
    skyDrawCalls: 3,
    skyTextureMemoryMB: 5.4,
    isPaused: false,
    gameTimeSec: 0,
  });
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [activeDrawer, setActiveDrawer] =
    useState<ActiveContextualDrawer>('none');
  const [inspectedArtRoomId, setInspectedArtRoomId] =
    useState<string>('ROOM_001');
  const [essayText, setEssayText] = useState<string>(essay01PurposeRaw);
  const [zoomActive, setZoomActive] = useState<boolean>(false);
  const [xrActive, setXrActive] = useState<boolean>(() =>
    webxrManager.isSessionActive()
  );
  const [vrSupported, setVrSupported] = useState<boolean>(false);
  const [webglError, setWebglError] = useState<string | null>(null);
  const [whisperText, setWhisperText] = useState<string | null>(null);
  const [captionText, setCaptionText] = useState<string | null>(null);
  const [radioDraft, setRadioDraft] = useState<string>('');
  const [leakResult, setLeakResult] = useState<{
    iterations: number;
    passed: boolean;
    geometriesDelta: number;
    texturesDelta: number;
    materialLeaks: number;
  } | null>(null);

  const hoveredRef = useRef<SpatialInteractiveTarget | null>(null);

  useEffect(() => {
    void webxrManager.checkSupport().then((supported) => {
      setVrSupported(supported);
    });
    return hubPlayerState.subscribe((next) => {
      setHubState(next);
    });
  }, []);

  useEffect(() => {
    const offSession = webxrManager.onSessionChange((active) => {
      setXrActive(active);
    });
    // Auto-pause when XR headset is removed or Quest system menu blurs session (TZ.md §6.3)
    const offBlur = webxrManager.onVisibilityBlurred(() => {
      engineRef.current?.setPaused(true);
    });
    // Auto-pause when browser tab becomes hidden (TZ.md §6.3)
    const onDocVisibility = () => {
      if (document.visibilityState === 'hidden') {
        engineRef.current?.setPaused(true);
      }
    };
    document.addEventListener('visibilitychange', onDocVisibility);
    return () => {
      offSession();
      offBlur();
      document.removeEventListener('visibilitychange', onDocVisibility);
    };
  }, []);

  // Subscribe to EventBus for mythic commitment whisper & accessibility captions (§2.7, §2.8)
  useEffect(() => {
    const offStep = eventBus.on('onboarding:step', ({ to }) => {
      if (to === 'COMMITTED') {
        setWhisperText(t('onboarding.commit.memory', 'en'));
        window.setTimeout(() => setWhisperText(null), 4200);
      }
    });

    const offCaption = eventBus.on('audio:caption', ({ textId }) => {
      const st = hubPlayerState.getState();
      if (!st.comfort.captions) return;
      setCaptionText(t(textId, 'en'));
      window.setTimeout(() => setCaptionText(null), 4500);
    });

    return () => {
      offStep();
      offCaption();
    };
  }, []);

  // Desktop Hotkeys: P / Esc (Pause), M (Mute), [ / ] (Master Vol -/+ 5%), R (Codex), T (Radio), C (Zoom), Alt (Comfort), Z (Audio Mixer)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (e.code === 'KeyP' || e.code === 'Escape') {
        e.preventDefault();
        engineRef.current?.togglePause();
      } else if (e.code === 'KeyM') {
        e.preventDefault();
        hubPlayerState.revealControl('audio');
        hubPlayerState.toggleAudioMuted();
        if (engineRef.current?.isPaused()) {
          engineRef.current.mountWorldLockedPausePanel();
        }
      } else if (e.code === 'BracketLeft') {
        e.preventDefault();
        hubPlayerState.revealControl('audio');
        hubPlayerState.adjustMasterVolumeDelta(-0.05);
        if (engineRef.current?.isPaused()) {
          engineRef.current.mountWorldLockedPausePanel();
        }
      } else if (e.code === 'BracketRight') {
        e.preventDefault();
        hubPlayerState.revealControl('audio');
        hubPlayerState.adjustMasterVolumeDelta(0.05);
        if (engineRef.current?.isPaused()) {
          engineRef.current.mountWorldLockedPausePanel();
        }
      } else if (e.code === 'KeyR') {
        e.preventDefault();
        hubPlayerState.revealControl('codex');
        setActiveDrawer((prev) => (prev === 'codex' ? 'none' : 'codex'));
      } else if (e.code === 'KeyT') {
        e.preventDefault();
        hubPlayerState.revealControl('radio');
        setActiveDrawer((prev) => (prev === 'radio' ? 'none' : 'radio'));
      } else if (e.code === 'KeyC') {
        e.preventDefault();
        hubPlayerState.revealControl('zoom');
        const eng = engineRef.current;
        if (eng) {
          const next = !eng.isFovZoom();
          eng.setFovZoom(next);
          setZoomActive(next);
        }
      } else if (e.key === 'Alt') {
        e.preventDefault();
        hubPlayerState.revealControl('comfort');
        setActiveDrawer((prev) => (prev === 'comfort' ? 'none' : 'comfort'));
      } else if (e.code === 'KeyZ') {
        e.preventDefault();
        hubPlayerState.revealControl('audio');
        setActiveDrawer((prev) => (prev === 'audio' ? 'none' : 'audio'));
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const executeSpatialAction = (target: SpatialInteractiveTarget) => {
    const eng = engineRef.current;
    const st = hubPlayerState.getState();

    // 0. World-Locked 3D VR Pause & Volume Mixer Panel Actions (TZ.md §5.2 & §6.1)
    if (target.kind === 'pause-action' && target.pauseAction) {
      const act = target.pauseAction;
      if (act === 'resume') {
        eng?.setPaused(false);
      } else if (act === 'mute') {
        hubPlayerState.toggleAudioMuted();
        eng?.mountWorldLockedPausePanel();
      } else if (act === 'master-up') {
        hubPlayerState.adjustMasterVolumeDelta(0.1);
        eng?.mountWorldLockedPausePanel();
      } else if (act === 'master-down') {
        hubPlayerState.adjustMasterVolumeDelta(-0.1);
        eng?.mountWorldLockedPausePanel();
      } else if (act === 'music-up') {
        hubPlayerState.setAudioVolume('music', st.audio.music + 0.1);
        eng?.mountWorldLockedPausePanel();
      } else if (act === 'music-down') {
        hubPlayerState.setAudioVolume('music', st.audio.music - 0.1);
        eng?.mountWorldLockedPausePanel();
      } else if (act === 'ambient-up') {
        hubPlayerState.setAudioVolume('ambient', st.audio.ambient + 0.1);
        eng?.mountWorldLockedPausePanel();
      } else if (act === 'ambient-down') {
        hubPlayerState.setAudioVolume('ambient', st.audio.ambient - 0.1);
        eng?.mountWorldLockedPausePanel();
      } else if (act === 'sfx-up') {
        hubPlayerState.setAudioVolume('sfx', st.audio.sfx + 0.1);
        eng?.mountWorldLockedPausePanel();
      } else if (act === 'sfx-down') {
        hubPlayerState.setAudioVolume('sfx', st.audio.sfx - 0.1);
        eng?.mountWorldLockedPausePanel();
      } else if (act === 'voice-up') {
        hubPlayerState.setAudioVolume('voice', st.audio.voice + 0.1);
        eng?.mountWorldLockedPausePanel();
      } else if (act === 'voice-down') {
        hubPlayerState.setAudioVolume('voice', st.audio.voice - 0.1);
        eng?.mountWorldLockedPausePanel();
      } else if (act === 'return-corridor') {
        eng?.setPaused(false);
        eng?.transitionToDestination('CORRIDOR');
      } else if (act === 'open-codex') {
        eng?.setPaused(false);
        setActiveDrawer('codex');
      }
      return;
    }

    if (eng?.isPaused()) return;

    // 1. Onboarding Central Pedestal (§2.2 Beat 25–45 s)
    if (target.kind === 'onboarding-pedestal') {
      spatialAudioSystem.triggerChime(392);
      onboardingFSM.notifyPedestalInteracted();
      return;
    }

    // 2. Diegetic Comfort Calibration Marks (§2.4 Seated vs Standing)
    if (target.kind === 'comfort-posture') {
      const isSeated = Boolean(target.seatedChoice);
      spatialAudioSystem.triggerChime(isSeated ? 330 : 440);
      hubPlayerState.setSeatedPosture(isSeated);
      return;
    }

    // 3. In-World Physical Locomotion Switch unlocked after 5 teleports (§2.4)
    if (target.kind === 'locomotion-switch') {
      const nextMode =
        st.comfort.locomotion === 'teleport' ? 'smooth' : 'teleport';
      spatialAudioSystem.triggerChime(nextMode === 'smooth' ? 523.25 : 392);
      hubPlayerState.setComfortMode(nextMode);
      return;
    }

    // 4. Threshold Branch Choice (Ascent / Descent)
    if (target.kind === 'threshold-branch' && target.branch) {
      const chosen = target.branch;
      spatialAudioSystem.triggerChime(chosen === 'ascend' ? 523.25 : 293.66);
      eng?.comfort.triggerFadeTransition(() => {
        hubPlayerState.chooseBranchFromThreshold(chosen);
      });
      return;
    }

    // 5. Corridor Segment Portal
    if (target.kind === 'segment-portal' && target.branch && target.segment) {
      const b = target.branch;
      const s = target.segment;
      spatialAudioSystem.triggerChime(440);
      eng?.comfort.triggerFadeTransition(() => {
        hubPlayerState.setCorridorSegment(b, s);
      });
      return;
    }

    // 6. Return to Threshold Atrium
    if (target.kind === 'corridor-return') {
      spatialAudioSystem.triggerChime(392);
      eng?.transitionToDestination('THRESHOLD');
      return;
    }

    // 7. Corridor Portal -> Room or Designed Void Fallback (§7.2.3)
    if (target.kind === 'corridor-door' && target.roomId) {
      spatialAudioSystem.triggerChime(
        target.status === 'planned' ? 220 : 523.25
      );
      eng?.transitionToDestination(target.roomId, {
        status: target.status,
        fromBranch: st.branch,
        fromSegment: st.segmentIndex,
      });
      return;
    }

    // 8. Room Portal -> Next Room, Corridor, or Designed Void Fallback (§7.2.3)
    if (target.kind === 'room-door' && target.roomId) {
      spatialAudioSystem.triggerChime(
        target.status === 'planned' ? 220 : 587.33
      );
      eng?.transitionToDestination(target.roomId, {
        status: target.status,
      });
      return;
    }

    // 9. Room Object / Mirror Reflection Anomaly
    if (target.kind === 'room-object' && target.objectId) {
      const roomId = st.currentRoomId || 'ROOM_073';
      const manifest = getRoomV1Manifest(roomId);
      if (!manifest) return;
      const objDef = manifest.objects.find((o) => o.id === target.objectId);
      if (!objDef) return;

      spatialAudioSystem.triggerChime(objDef.onlyInMirror ? 659.25 : 440);

      if (objDef.onlyInMirror) {
        const discoveryKey = `${roomId}:interactReflection:${objDef.id}`;
        hubPlayerState.unlockDiscovery(discoveryKey);
        hubPlayerState.unlockDiscovery('codex.entry.rabbit_hole');
        hubPlayerState.markQuestCompleted(roomId);
        return;
      }

      const inspectKey = `${roomId}:interact:${objDef.id}`;
      hubPlayerState.unlockDiscovery(inspectKey);
      if (manifest.quest.completion.target === objDef.id) {
        hubPlayerState.markQuestCompleted(roomId);
      }
      return;
    }

    // 10. Mirror Choice (Accept / Reject / Back to Corridor)
    if (target.kind === 'room-mirror' && target.mirrorChoice) {
      const roomId = st.currentRoomId || 'ROOM_073';
      const choice = target.mirrorChoice;

      if (choice === 'back') {
        spatialAudioSystem.triggerChime(392);
        eng?.transitionToDestination('CORRIDOR');
        return;
      }

      spatialAudioSystem.triggerChime(choice === 'accept' ? 523.25 : 349.23);
      hubPlayerState.recordMirrorChoice(roomId, choice);
      return;
    }

    // 11. Artwork & Neuromicon Essay Inspection
    if (target.kind === 'artwork') {
      spatialAudioSystem.triggerChime(493.88);
      hubPlayerState.revealControl('zoom');
      const artRoomId = target.roomId || st.currentRoomId || 'ROOM_001';
      const manifest = getRoomV1Manifest(artRoomId);
      if (!manifest) return;
      setInspectedArtRoomId(artRoomId);
      setActiveDrawer('essay');
      if (st.location === 'room' && st.currentRoomId) {
        hubPlayerState.markQuestCompleted(st.currentRoomId);
      }
      if (artRoomId === 'ROOM_001') {
        setEssayText(essay01PurposeRaw);
      }
      if (manifest.artwork?.essayUrl) {
        void fetch(manifest.artwork.essayUrl)
          .then((res) => (res.ok ? res.text() : ''))
          .then((txt) => {
            if (txt.trim().length > 0) {
              setEssayText(txt);
            }
          })
          .catch(() => {
            // Keep local fallback essay
          });
      }
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    let engine: HubEngine;
    try {
      engine = new HubEngine(canvas);
    } catch (err) {
      setWebglError(
        err instanceof Error ? err.message : 'WebGL2 context unavailable'
      );
      return;
    }
    engineRef.current = engine;
    webxrManager.attachRenderer(engine.renderer);
    const offPause = engine.onPauseChange((p) => {
      setIsPaused(p);
    });

    const input = inputRef.current;
    input.attach(canvas);

    const handleResize = () => {
      if (!containerRef.current || !engineRef.current) return;
      engineRef.current.resize(
        containerRef.current.clientWidth,
        containerRef.current.clientHeight
      );
    };
    handleResize();
    window.addEventListener('resize', handleResize);

    let lastTime = performance.now();
    let uiSyncTimer = 0;

    engine.renderer.setAnimationLoop((now) => {
      const dt = Math.min(0.1, Math.max(0.001, (now - lastTime) / 1000));
      lastTime = now;

      const desktopInput = input.consumeState();
      const xrInput = webxrManager.pollControllerInput(dt);
      const curState = hubPlayerState.getState();

      if (xrInput.pauseJustPressed) {
        engine.togglePause();
      }

      const { hovered, telemetry: frameTelemetry, onboardingVisual: obVis } =
        engine.stepAndRender(dt, desktopInput, xrInput, curState, now / 1000);

      hoveredRef.current = hovered.target;

      if (desktopInput.interactPressed || xrInput.triggerJustPressed) {
        spatialAudioSystem.start();
        if (hovered.target) {
          executeSpatialAction(hovered.target);
        } else if (!engine.isPaused() && hovered.floorHitPoint) {
          engine.teleportTo(hovered.floorHitPoint.x, hovered.floorHitPoint.z);
        }
      }

      if (!engine.isPaused() && xrInput.squeezeJustPressed) {
        if (curState.location === 'room' || curState.location === 'void') {
          engine.transitionToDestination('CORRIDOR');
        } else if (curState.location === 'corridor') {
          engine.transitionToDestination('THRESHOLD');
        }
      }

      uiSyncTimer += dt;
      if (uiSyncTimer >= 0.12) {
        uiSyncTimer = 0;
        setHoveredTarget(hovered.target);
        setHasFloorTeleportTarget(
          !hovered.target && Boolean(hovered.floorHitPoint)
        );
        setTelemetry(frameTelemetry);
        setOnboardingVisual(obVis);
      }
    });

    return () => {
      offPause();
      window.removeEventListener('resize', handleResize);
      input.detach();
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  const handleCanvasClick = () => {
    // Unlock WebAudio context on user gesture; spatial interaction & teleportation are handled
    // once per frame via InputController.interactPressed so actions never fire twice.
    spatialAudioSystem.start();
  };

  const activeChannel =
    hubState.location === 'room' && hubState.currentRoomId
      ? hubState.currentRoomId
      : hubState.location === 'corridor'
      ? `CORRIDOR_${hubState.branch.toUpperCase()}`
      : 'THRESHOLD';

  const channelMessages = hubState.radioChannels[activeChannel] ?? [];
  const isOnboardingActive =
    hubState.location === 'threshold' &&
    onboardingVisual &&
    onboardingVisual.step !== 'COMMITTED';

  const isControlRevealed = (id: ControlRevealId) =>
    hubState.revealedControls.includes(id) ||
    hubState.onboarding.completedSteps.includes('COMMITTED');

  return (
    <div
      ref={containerRef}
      className="relative w-full h-screen min-h-[640px] bg-[#070605] overflow-hidden select-none"
    >
      <canvas
        ref={canvasRef}
        onClick={handleCanvasClick}
        className="block w-full h-full cursor-crosshair"
      />

      {/* Center Reticle + 3s Reversible Platform Hold Progress Ring (§2.2 Beat 70–90 s) */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="relative flex items-center justify-center">
          <div
            className={`w-2.5 h-2.5 rounded-full transition-all duration-150 ${
              hoveredTarget
                ? 'bg-[#e5c158] scale-125 shadow-[0_0_12px_#e5c158]'
                : hasFloorTeleportTarget
                ? 'bg-[#c8a464]/80 scale-105'
                : 'bg-white/25'
            }`}
          />
          {onboardingVisual && onboardingVisual.branchHoldProgress > 0 && (
            <svg
              className="absolute w-14 h-14 -rotate-90"
              viewBox="0 0 48 48"
            >
              <circle
                cx="24"
                cy="24"
                r="20"
                fill="none"
                stroke="rgba(255,255,255,0.12)"
                strokeWidth="2.5"
              />
              <circle
                cx="24"
                cy="24"
                r="20"
                fill="none"
                stroke={
                  onboardingVisual.holdingBranch === 'ascend'
                    ? '#e5c158'
                    : '#4ea8de'
                }
                strokeWidth="3"
                strokeDasharray={125.6}
                strokeDashoffset={
                  125.6 * (1 - onboardingVisual.branchHoldProgress)
                }
              />
            </svg>
          )}
        </div>
      </div>

      {/* Hover Target Label */}
      {hoveredTarget && (
        <div className="pointer-events-none absolute bottom-16 left-1/2 -translate-x-1/2 bg-[#0d0c0a]/85 border border-[#c8a464]/40 px-4 py-2 rounded text-center backdrop-blur-md">
          {isOnboardingActive &&
          hoveredTarget.kind === 'onboarding-pedestal' ? (
            <span className="font-display text-lg text-[#e5c158] tracking-widest">
              {t('onboarding.glyph.interact', 'en')}
            </span>
          ) : (
            <div>
              <div className="font-display text-xs font-semibold text-[#f3ede2] tracking-wider">
                {`${t('onboarding.glyph.interact', 'en')} ${hoveredTarget.title}`}
              </div>
              {hoveredTarget.subtitle && (
                <div className="text-[11px] font-mono text-[#a89f91] mt-0.5">
                  {hoveredTarget.subtitle}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Onboarding String #2: Rung 3 Hint Ladder Engraving after 45s of Inactivity (§2.6 & §2.7) */}
      {onboardingVisual && onboardingVisual.hintRung >= 3 && (
        <div className="pointer-events-none absolute top-14 left-1/2 -translate-x-1/2 bg-[#0e0c0a]/90 border border-[#c8a464]/35 px-6 py-2.5 rounded backdrop-blur-md">
          <p className="font-display text-sm tracking-[0.2em] uppercase text-[#e5c158]">
            {t('onboarding.hint.engraving', 'en')}
          </p>
        </div>
      )}

      {/* Onboarding String #3: Mythic Memory Confirmation on Branch Commit (§2.7) */}
      {whisperText && (
        <div className="pointer-events-none absolute top-14 left-1/2 -translate-x-1/2 bg-[#0e0c0a]/90 border border-[#c8a464]/45 px-6 py-2.5 rounded backdrop-blur-md">
          <p className="font-display text-sm tracking-[0.18em] text-[#f3ede2]">
            {whisperText}
          </p>
        </div>
      )}

      {/* Accessibility Audio Captions (§2.8) */}
      {captionText && (
        <div className="pointer-events-none absolute bottom-6 left-1/2 -translate-x-1/2 bg-black/80 border border-white/15 px-4 py-1.5 rounded text-xs font-mono text-[#d8cfc0]">
          {captionText}
        </div>
      )}

      {webglError && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#070605] text-[#f3ede2] p-6 z-30">
          <div className="max-w-md border border-[#c8a464]/40 bg-[#12100e] p-6 rounded text-center space-y-3">
            <div className="font-display text-base text-[#e5c158] tracking-widest uppercase">
              {t('entry.title', 'en')}
            </div>
            <p className="font-mono text-xs text-[#a89f91]">{webglError}</p>
          </div>
        </div>
      )}

      {/* Contextual Discovery & VR Wrist / Palm Non-Keyboard Controls (§2.5 & TZ.md §5.2, §6.1) */}
      <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
        {vrSupported && (
          <button
            onClick={() => {
              spatialAudioSystem.start();
              void webxrManager.toggleVRSession();
            }}
            title="Enter / Exit WebXR (Meta Quest 2)"
            className={`px-3 py-1.5 rounded text-xs font-mono border transition-colors ${
              xrActive
                ? 'bg-[#e5c158] text-[#0b0a09] border-[#e5c158] font-semibold'
                : 'bg-[#12100e]/85 text-[#e5c158] border-[#c8a464]/50 hover:border-[#e5c158]'
            }`}
          >
            {t('entry.vr', 'en')}
          </button>
        )}

        {isControlRevealed('zoom') && (
          <button
            onClick={() => {
              const eng = engineRef.current;
              if (eng) {
                const next = !eng.isFovZoom();
                eng.setFovZoom(next);
                setZoomActive(next);
              }
            }}
            title="Zoom (C)"
            className={`px-3 py-1.5 rounded text-xs font-mono border transition-colors ${
              zoomActive
                ? 'bg-[#c8a464] text-[#0b0a09] border-[#c8a464] font-semibold'
                : 'bg-[#12100e]/85 text-[#d8cfc0] border-white/15 hover:border-[#c8a464]/60'
            }`}
          >
            ◎ {!xrActive && 'C'}
          </button>
        )}

        {isControlRevealed('radio') && (
          <button
            onClick={() =>
              setActiveDrawer((prev) => (prev === 'radio' ? 'none' : 'radio'))
            }
            title="Radio Signal (T)"
            className={`px-3 py-1.5 rounded text-xs font-mono border transition-colors ${
              activeDrawer === 'radio'
                ? 'bg-[#c8a464] text-[#0b0a09] border-[#c8a464] font-semibold'
                : 'bg-[#12100e]/85 text-[#d8cfc0] border-white/15 hover:border-[#c8a464]/60'
            }`}
          >
            (((·))) {!xrActive && 'T'}
          </button>
        )}

        <button
          onClick={() => {
            hubPlayerState.toggleAudioMuted();
            if (engineRef.current?.isPaused()) {
              engineRef.current.mountWorldLockedPausePanel();
            }
          }}
          title="Mute / Unmute Audio (M)"
          className={`px-3 py-1.5 rounded text-xs font-mono border transition-colors ${
            hubState.audio.muted
              ? 'bg-[#ff6b6b]/20 text-[#ff6b6b] border-[#ff6b6b]/50 font-semibold'
              : 'bg-[#12100e]/85 text-[#d8cfc0] border-white/15 hover:border-[#c8a464]/60'
          }`}
        >
          {hubState.audio.muted ? '🔇' : '🔊'} {!xrActive && 'M'}
        </button>

        <button
          onClick={() =>
            setActiveDrawer((prev) => (prev === 'audio' ? 'none' : 'audio'))
          }
          title="4-Bus Audio Mixer (Z)"
          className={`px-3 py-1.5 rounded text-xs font-mono border transition-colors ${
            activeDrawer === 'audio'
              ? 'bg-[#c8a464] text-[#0b0a09] border-[#c8a464] font-semibold'
              : 'bg-[#12100e]/85 text-[#d8cfc0] border-white/15 hover:border-[#c8a464]/60'
          }`}
        >
          ♫ {!xrActive && 'Z'}
        </button>

        {isControlRevealed('comfort') && (
          <button
            onClick={() =>
              setActiveDrawer((prev) =>
                prev === 'comfort' ? 'none' : 'comfort'
              )
            }
            title="Comfort & Quality Tier (Alt)"
            className={`px-3 py-1.5 rounded text-xs font-mono border transition-colors ${
              activeDrawer === 'comfort'
                ? 'bg-[#c8a464] text-[#0b0a09] border-[#c8a464] font-semibold'
                : 'bg-[#12100e]/85 text-[#d8cfc0] border-white/15 hover:border-[#c8a464]/60'
            }`}
          >
            ✥ {!xrActive && 'Alt'}
          </button>
        )}

        <button
          onClick={() => {
            engineRef.current?.togglePause();
          }}
          title="Pause / Resume Game Clock & Audio (P / Esc)"
          className={`px-3 py-1.5 rounded text-xs font-mono border transition-colors ${
            isPaused
              ? 'bg-[#e5c158] text-[#0b0a09] border-[#e5c158] font-semibold'
              : 'bg-[#12100e]/85 text-[#d8cfc0] border-white/15 hover:border-[#c8a464]/60'
          }`}
        >
          {isPaused ? '▶' : '⏸'} {!xrActive && 'P'}
        </button>

        {/* Codex Journal button (replaces Rules overlay; always available via wrist/top-right or Key R, §2.5) */}
        <button
          onClick={() =>
            setActiveDrawer((prev) => (prev === 'codex' ? 'none' : 'codex'))
          }
          title="Codex Journal (R)"
          className={`px-3 py-1.5 rounded text-xs font-mono border transition-colors ${
            activeDrawer === 'codex'
              ? 'bg-[#c8a464] text-[#0b0a09] border-[#c8a464] font-semibold'
              : 'bg-[#12100e]/85 text-[#d8cfc0] border-white/15 hover:border-[#c8a464]/60'
          }`}
        >
          ❖ {!xrActive && 'R'}
        </button>
      </div>

      {/* Desktop & Non-Blocking Pause Overlay (Mirrors the 3D World-Locked VR Pause Panel, TZ.md §6.1–§6.3) */}
      {isPaused && (
        <div className="absolute top-16 left-4 w-[390px] max-w-[calc(100vw-2rem)] bg-[#080b14]/95 border border-[#e5c158]/50 rounded p-5 text-xs text-[#e8e2d5] backdrop-blur-md shadow-2xl z-20 space-y-3.5">
          <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
            <div>
              <span className="font-display text-sm font-semibold text-[#e5c158] tracking-wider block">
                ⏸ PAUSED · WORLD CLOCK FROZEN
              </span>
              <span className="font-mono text-[10px] text-[#a89f91]">
                {`Game Time ${telemetry.gameTimeSec.toFixed(
                  1
                )}s · Head tracking & 3D VR panel live`}
              </span>
            </div>
            <button
              onClick={() => engineRef.current?.setPaused(false)}
              className="px-3 py-1.5 rounded bg-[#66cc99] text-[#080b14] font-mono font-semibold text-xs hover:bg-[#7ee0b0]"
            >
              ▶ Resume (P)
            </button>
          </div>

          {/* Active Astronomical Nebula Attribution */}
          <div className="p-2.5 rounded bg-white/5 border border-white/10 font-mono text-[11px] space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[#e5c158] font-semibold truncate">
                {`${telemetry.nebulaId} · ${telemetry.nebulaName}`}
              </span>
              <div className="flex items-center gap-1 ml-2">
                {telemetry.nebulaPalette.map((hex, i) => (
                  <span
                    key={`${hex}-${i}`}
                    className="w-3 h-3 rounded-full border border-white/25 inline-block"
                    style={{ backgroundColor: hex }}
                  />
                ))}
              </div>
            </div>
            <div className="text-[10px] text-[#a89f91] truncate">
              {`Credit: ${telemetry.nebulaCredit} (${telemetry.nebulaLicense})`}
            </div>
          </div>

          {/* 4-Bus Volume Mixer inside Pause Menu (TZ.md §5.2 & §6.1) */}
          <div className="space-y-2 border-t border-white/10 pt-2.5">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[11px] text-[#d8cfc0]">
                Master / Bus Mixer (`[` `]` / `M`):
              </span>
              <button
                onClick={() => {
                  hubPlayerState.toggleAudioMuted();
                  engineRef.current?.mountWorldLockedPausePanel();
                }}
                className={`px-2.5 py-1 rounded font-mono text-[10px] ${
                  hubState.audio.muted
                    ? 'bg-[#ff6b6b]/20 text-[#ff6b6b] border border-[#ff6b6b]/40'
                    : 'bg-[#66cc99]/20 text-[#66cc99] border border-[#66cc99]/40'
                }`}
              >
                {hubState.audio.muted ? '🔇 MUTED (M)' : '🔊 ACTIVE (M)'}
              </button>
            </div>

            {(
              [
                { key: 'master', label: 'Master Volume ([ / ])' },
                { key: 'music', label: 'Music (Room MP3 Track)' },
                { key: 'ambient', label: 'Ambient (Atrium Drone)' },
                { key: 'sfx', label: 'Effects (Chimes & UI)' },
                { key: 'voice', label: 'Voice / Radio Signal' },
              ] as const
            ).map((bus) => (
              <div key={bus.key}>
                <div className="flex justify-between text-[10px] font-mono text-[#a89f91]">
                  <span>{bus.label}</span>
                  <span>{Math.round(hubState.audio[bus.key] * 100)}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.02}
                  value={hubState.audio[bus.key]}
                  onChange={(e) => {
                    hubPlayerState.setAudioVolume(
                      bus.key,
                      parseFloat(e.target.value)
                    );
                    engineRef.current?.mountWorldLockedPausePanel();
                  }}
                  className="w-full accent-[#c8a464] h-1.5"
                />
              </div>
            ))}
          </div>

          {/* Quick Actions in Pause Menu */}
          <div className="border-t border-white/10 pt-2.5 flex gap-2">
            {hubState.location === 'room' && (
              <button
                onClick={() => {
                  engineRef.current?.setPaused(false);
                  engineRef.current?.transitionToDestination('CORRIDOR');
                }}
                className="flex-1 py-1.5 px-2.5 rounded bg-white/10 hover:bg-white/15 text-[#f3ede2] font-mono text-[11px]"
              >
                ↺ Return to Sector Room
              </button>
            )}
            <button
              onClick={() => {
                setActiveDrawer('codex');
              }}
              className="flex-1 py-1.5 px-2.5 rounded bg-white/10 hover:bg-white/15 text-[#e5c158] font-mono text-[11px]"
            >
              ❖ Open Codex (R)
            </button>
          </div>
        </div>
      )}

      {/* Contextual Drawer: CODEX (Replaces the old Rules wall, §2.5) */}
      {activeDrawer === 'codex' && (
        <div className="absolute top-16 right-4 w-[420px] max-w-[calc(100vw-2rem)] max-h-[82vh] overflow-y-auto bg-[#0e0c0a]/95 border border-[#c8a464]/40 rounded p-5 text-xs text-[#e8e2d5] backdrop-blur-md shadow-2xl z-20">
          <div className="flex items-center justify-between border-b border-white/10 pb-2.5 mb-3">
            <span className="font-display text-sm font-semibold text-[#e5c158]">
              {t('codex.title', 'en')}
            </span>
            <button
              onClick={() => setActiveDrawer('none')}
              className="text-[#a89f91] hover:text-white font-mono"
            >
              ✕
            </button>
          </div>

          {/* Dynamic Journal Entries */}
          <div className="space-y-2 mb-4">
            {hubState.discoveries.filter((d) => d.startsWith('codex.entry.'))
              .length === 0 ? (
              <div className="p-3 bg-white/5 rounded text-[#a89f91] italic">
                The pages are blank. Explore the Threshold, light, and reflections.
              </div>
            ) : (
              hubState.discoveries
                .filter((d) => d.startsWith('codex.entry.'))
                .map((entryKey) => (
                  <div
                    key={entryKey}
                    className="p-2.5 bg-white/5 border-l-2 border-[#c8a464] rounded-r text-[#f3ede2] leading-relaxed"
                  >
                    {t(entryKey, 'en')}
                  </div>
                ))
            )}
          </div>

          {/* Visited Rooms & 3 Sector Rooms Quick Navigation */}
          <div className="border-t border-white/10 pt-3 mb-4 space-y-2 text-[11px] font-mono text-[#b5ab99]">
            <div className="flex items-center justify-between">
              <span>Location:</span>
              <span className="text-[#f3ede2]">
                {hubState.location === 'threshold'
                  ? 'GRAND COSMIC STARTING ROOM'
                  : hubState.location === 'corridor'
                  ? `SECTOR ROOM ${hubState.segmentIndex}`
                  : hubState.currentRoomId || 'VOID'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Visited Artwork & Audio Rooms:</span>
              <span className="text-[#f3ede2]">
                {hubState.visitedRooms.length} / 25
              </span>
            </div>
            <div className="p-2 rounded bg-white/5 border border-white/10 space-y-1">
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-[#e5c158] font-semibold truncate">
                  {`Sky: ${telemetry.nebulaId} · ${telemetry.nebulaName}`}
                </span>
                <span className="text-[#66cc99] ml-2">
                  {telemetry.nebulaLicense}
                </span>
              </div>
              <div className="text-[10px] text-[#a89f91] truncate">
                {`Credit: ${telemetry.nebulaCredit} (See CREDITS.md)`}
              </div>
            </div>
            <div className="pt-1 grid grid-cols-3 gap-1.5">
              {([1, 2, 3] as const).map((seg) => (
                <button
                  key={seg}
                  onClick={() => {
                    const targetBranch = seg === 2 ? 'descend' : 'ascend';
                    if (engineRef.current) {
                      engineRef.current.comfort.triggerFadeTransition(() => {
                        hubPlayerState.setCorridorSegment(targetBranch, seg);
                      });
                    } else {
                      hubPlayerState.setCorridorSegment(targetBranch, seg);
                    }
                    setActiveDrawer('none');
                  }}
                  className={`py-1.5 px-2 rounded border text-[10px] font-mono transition-colors ${
                    hubState.location === 'corridor' &&
                    hubState.segmentIndex === seg
                      ? 'bg-[#c8a464] text-[#0b0a09] border-[#c8a464] font-semibold'
                      : 'bg-white/5 hover:bg-white/10 text-[#f3ede2] border-white/10'
                  }`}
                >
                  {seg === 1
                    ? 'Room I (01–11)'
                    : seg === 2
                    ? 'Room II (12–19)'
                    : 'Room III (20–25)'}
                </button>
              ))}
            </div>
          </div>

          {/* Replay Onboarding & 30-Transition GPU Leak Verification (§2.3 & §9.1) */}
          <div className="border-t border-white/10 pt-3 flex flex-wrap gap-2">
            <button
              onClick={() => {
                hubPlayerState.replayOnboarding();
                setActiveDrawer('none');
              }}
              className="px-3 py-1.5 rounded bg-white/10 hover:bg-white/15 text-[#f3ede2] font-mono text-[11px]"
            >
              ↺ Replay Awakening
            </button>

            <button
              onClick={() => {
                const eng = engineRef.current;
                if (eng) {
                  setLeakResult(eng.runLeakCheck());
                }
              }}
              className="px-3 py-1.5 rounded bg-[#c8a464]/20 hover:bg-[#c8a464]/30 border border-[#c8a464]/40 text-[#e5c158] font-mono text-[11px]"
            >
              30-Transition GPU Test
            </button>
          </div>

          {leakResult && (
            <div className="mt-2.5 p-2.5 rounded bg-black/50 border border-white/10 font-mono text-[11px]">
              <div className="text-[#66cc99]">
                ✓ {leakResult.iterations} mount/unmount cycles:{' '}
                {leakResult.passed ? 'PASSED (0 leaks)' : 'FAILED'}
              </div>
              <div className="text-[#a89f91] mt-0.5">
                {`Δgeo: ${leakResult.geometriesDelta} · Δtex: ${leakResult.texturesDelta} · Δmat: ${leakResult.materialLeaks} · ${telemetry.fps} FPS (${telemetry.frameTimeMs} ms)`}
              </div>
            </div>
          )}

          {/* Optional Studio Inspector Links */}
          {onOpenStudioSection && (
            <div className="border-t border-white/10 mt-3 pt-3 flex flex-wrap gap-1.5">
              <button
                onClick={() => onOpenStudioSection('registry')}
                className="px-2.5 py-1 rounded bg-white/5 hover:bg-white/10 text-[11px] font-mono text-[#a89f91]"
              >
                World Graph
              </button>
              <button
                onClick={() => onOpenStudioSection('manifests')}
                className="px-2.5 py-1 rounded bg-white/5 hover:bg-white/10 text-[11px] font-mono text-[#a89f91]"
              >
                Room Bible
              </button>
              <button
                onClick={() => onOpenStudioSection('validator')}
                className="px-2.5 py-1 rounded bg-white/5 hover:bg-white/10 text-[11px] font-mono text-[#a89f91]"
              >
                Validator
              </button>
              <button
                onClick={() => onOpenStudioSection('protocol')}
                className="px-2.5 py-1 rounded bg-white/5 hover:bg-white/10 text-[11px] font-mono text-[#a89f91]"
              >
                Protocol Docs
              </button>
            </div>
          )}
        </div>
      )}

      {/* Contextual Drawer: RADIO (`T`, §2.5) */}
      {activeDrawer === 'radio' && (
        <div className="absolute top-16 right-4 w-[380px] max-w-[calc(100vw-2rem)] bg-[#0e0c0a]/95 border border-[#c8a464]/40 rounded p-5 text-xs text-[#e8e2d5] backdrop-blur-md shadow-2xl z-20">
          <div className="flex items-center justify-between border-b border-white/10 pb-2.5 mb-3">
            <span className="font-display text-sm font-semibold text-[#e5c158]">
              (((·))) {activeChannel}
            </span>
            <button
              onClick={() => setActiveDrawer('none')}
              className="text-[#a89f91] hover:text-white font-mono"
            >
              ✕
            </button>
          </div>

          <div className="max-h-44 overflow-y-auto space-y-2 mb-3 pr-1">
            {channelMessages.map((m, i) => (
              <div
                key={`${m.timestamp}-${i}`}
                className="bg-white/5 border border-white/10 rounded p-2.5"
              >
                <div className="flex items-center justify-between text-[10px] font-mono text-[#c8a464]">
                  <span>{m.author}</span>
                  <span>{m.timestamp}</span>
                </div>
                <p className="text-[#f3ede2] mt-1">{m.text}</p>
              </div>
            ))}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!radioDraft.trim()) return;
              hubPlayerState.postRadioMessage(
                activeChannel,
                radioDraft.trim(),
                'TRAVELER'
              );
              setRadioDraft('');
            }}
            className="flex gap-2"
          >
            <input
              type="text"
              value={radioDraft}
              onChange={(e) => setRadioDraft(e.target.value)}
              placeholder="Leave signal..."
              className="flex-1 bg-black/50 border border-white/15 rounded px-3 py-1.5 text-xs text-[#f3ede2] focus:outline-none focus:border-[#c8a464]"
            />
            <button
              type="submit"
              className="px-3 py-1.5 bg-[#c8a464] text-[#0b0a09] font-semibold rounded text-xs"
            >
              →
            </button>
          </form>
        </div>
      )}

      {/* Contextual Drawer: COMFORT & ACCESSIBILITY (`Alt` / Wrist, §2.4 & §2.8) */}
      {activeDrawer === 'comfort' && (
        <div className="absolute top-16 right-4 w-[380px] max-w-[calc(100vw-2rem)] bg-[#0e0c0a]/95 border border-[#c8a464]/40 rounded p-5 text-xs text-[#e8e2d5] backdrop-blur-md shadow-2xl z-20 space-y-4">
          <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
            <span className="font-display text-sm font-semibold text-[#e5c158]">
              ✥ COMFORT & ACCESS
            </span>
            <button
              onClick={() => setActiveDrawer('none')}
              className="text-[#a89f91] hover:text-white font-mono"
            >
              ✕
            </button>
          </div>

          <div>
            <div className="text-[11px] font-mono text-[#a89f91] mb-1.5">
              Locomotion:
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {(['teleport', 'smooth'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => hubPlayerState.setComfortMode(m)}
                  className={`py-1.5 rounded font-mono text-[11px] uppercase border ${
                    hubState.comfort.locomotion === m
                      ? 'bg-[#c8a464] text-[#0b0a09] border-[#c8a464] font-semibold'
                      : 'bg-white/5 text-[#d8cfc0] border-white/10'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-[#d8cfc0]">Posture (Seated / Standing):</span>
            <button
              onClick={() =>
                hubPlayerState.setSeatedPosture(!hubState.comfort.seated)
              }
              className="px-3 py-1 rounded font-mono text-[11px] bg-white/10 text-[#f3ede2]"
            >
              {hubState.comfort.seated ? 'SEATED' : 'STANDING'}
            </button>
          </div>

          <div>
            <div className="text-[11px] font-mono text-[#a89f91] mb-1.5">
              Snap Turn Angle (Q / E):
            </div>
            <div className="flex gap-2">
              {([30, 45] as const).map((deg) => (
                <button
                  key={deg}
                  onClick={() => hubPlayerState.setSnapTurnDegrees(deg)}
                  className={`flex-1 py-1.5 rounded font-mono text-xs border ${
                    hubState.snapTurnDegrees === deg
                      ? 'bg-[#c8a464] text-[#0b0a09] border-[#c8a464] font-semibold'
                      : 'bg-white/5 text-[#d8cfc0] border-white/10'
                  }`}
                >
                  {deg}°
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-[#d8cfc0]">Reduced Motion (Instant Cut):</span>
            <button
              onClick={() => hubPlayerState.toggleReducedMotion()}
              className={`px-3 py-1 rounded font-mono text-[11px] ${
                hubState.comfort.reducedMotion
                  ? 'bg-[#66cc99]/20 text-[#66cc99] border border-[#66cc99]/40'
                  : 'bg-white/10 text-[#a89f91]'
              }`}
            >
              {hubState.comfort.reducedMotion ? 'ON' : 'OFF'}
            </button>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-[#d8cfc0]">Audio Captions (§2.8):</span>
            <button
              onClick={() => hubPlayerState.toggleCaptions()}
              className={`px-3 py-1 rounded font-mono text-[11px] ${
                hubState.comfort.captions
                  ? 'bg-[#66cc99]/20 text-[#66cc99] border border-[#66cc99]/40'
                  : 'bg-white/10 text-[#a89f91]'
              }`}
            >
              {hubState.comfort.captions ? 'ON' : 'OFF'}
            </button>
          </div>

          <div>
            <div className="text-[11px] font-mono text-[#a89f91] mb-1.5">
              Sky & Lighting Quality Tier (TZ.md §4.5):
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {(
                ['auto', 'quest', 'desktop-low', 'desktop-high'] as const
              ).map((tier) => (
                <button
                  key={tier}
                  onClick={() => hubPlayerState.setQualityTier(tier)}
                  className={`py-1.5 rounded font-mono text-[10px] uppercase border ${
                    hubState.comfort.qualityTier === tier
                      ? 'bg-[#c8a464] text-[#0b0a09] border-[#c8a464] font-semibold'
                      : 'bg-white/5 text-[#d8cfc0] border-white/10'
                  }`}
                >
                  {tier}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Contextual Drawer: 4-BUS AUDIO MIXER (`Z`, TZ.md §5.1–§5.4) */}
      {activeDrawer === 'audio' && (
        <div className="absolute top-16 right-4 w-[390px] max-w-[calc(100vw-2rem)] bg-[#0e0c0a]/95 border border-[#c8a464]/40 rounded p-5 text-xs text-[#e8e2d5] backdrop-blur-md shadow-2xl z-20 space-y-3">
          <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
            <span className="font-display text-sm font-semibold text-[#e5c158]">
              ♫ 4-BUS AUDIO MIXER & LIMITER
            </span>
            <button
              onClick={() => setActiveDrawer('none')}
              className="text-[#a89f91] hover:text-white font-mono"
            >
              ✕
            </button>
          </div>

          <div className="p-2.5 rounded bg-white/5 border border-white/10 font-mono text-[11px] space-y-1">
            <div className="text-[#e5c158] font-semibold truncate">
              {spatialAudioSystem.getCurrentTrackLabel()}
            </div>
            <div className="text-[#a89f91] truncate text-[10px]">
              {spatialAudioSystem.getCurrentMp3Url() ||
                'Silent outside Artwork & Audio Rooms (Zero Overlap)'}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span>Master Mute (`M`):</span>
            <button
              onClick={() => {
                hubPlayerState.toggleAudioMuted();
                if (engineRef.current?.isPaused()) {
                  engineRef.current.mountWorldLockedPausePanel();
                }
              }}
              className={`px-3 py-1 rounded font-mono text-xs ${
                !hubState.audio.muted
                  ? 'bg-[#66cc99]/20 text-[#66cc99] border border-[#66cc99]/40'
                  : 'bg-[#ff6b6b]/20 text-[#ff6b6b] border border-[#ff6b6b]/40'
              }`}
            >
              {hubState.audio.muted ? '🔇 MUTED' : '🔊 ENABLED (IN ROOMS ONLY)'}
            </button>
          </div>

          <div className="space-y-2.5 pt-1">
            {(
              [
                { key: 'master', label: 'Master Volume ([ / ])' },
                { key: 'music', label: 'Music Bus (Room MP3 Track)' },
                { key: 'ambient', label: 'Ambient Bus (Atrium Drone)' },
                { key: 'sfx', label: 'Effects Bus (Chimes & UI)' },
                { key: 'voice', label: 'Voice / Radio Bus' },
              ] as const
            ).map((bus) => (
              <div key={bus.key}>
                <div className="flex justify-between text-[11px] font-mono text-[#a89f91] mb-0.5">
                  <span>{bus.label}</span>
                  <span>{Math.round(hubState.audio[bus.key] * 100)}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.02}
                  value={hubState.audio[bus.key]}
                  onChange={(e) => {
                    hubPlayerState.setAudioVolume(
                      bus.key,
                      parseFloat(e.target.value)
                    );
                    if (engineRef.current?.isPaused()) {
                      engineRef.current.mountWorldLockedPausePanel();
                    }
                  }}
                  className="w-full accent-[#c8a464]"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Contextual Drawer: NEUROMICON PAINTING & ESSAY TRANSMISSION */}
      {activeDrawer === 'essay' &&
        (() => {
          const artManifest = getRoomV1Manifest(inspectedArtRoomId);
          if (!artManifest) return null;
          return (
            <div className="absolute top-16 right-4 w-[480px] max-w-[calc(100vw-2rem)] max-h-[84vh] overflow-y-auto bg-[#0e0c0a]/95 border border-[#c8a464]/50 rounded p-5 text-xs text-[#e8e2d5] backdrop-blur-md shadow-2xl z-20 space-y-4">
              <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
                <div>
                  <span className="font-display text-sm font-semibold text-[#e5c158] block">
                    {artManifest.artwork?.title || artManifest.identity.name}
                  </span>
                  <span className="font-mono text-[10px] text-[#a89f91]">
                    {artManifest.artwork?.sector || artManifest.id} · MP3:{' '}
                    {artManifest.audio.track.split('/').pop()}
                  </span>
                </div>
                <button
                  onClick={() => setActiveDrawer('none')}
                  className="text-[#a89f91] hover:text-white font-mono text-sm px-2"
                >
                  ✕
                </button>
              </div>

              {artManifest.artwork?.imageUrl && (
                <div className="rounded overflow-hidden border border-[#c8a464]/35 bg-black">
                  <img
                    src={artManifest.artwork.imageUrl}
                    alt={artManifest.identity.name}
                    crossOrigin="anonymous"
                    className="w-full max-h-60 object-contain mx-auto"
                  />
                </div>
              )}

              <div className="p-3.5 rounded bg-white/5 border border-white/10 whitespace-pre-wrap leading-relaxed text-[#f3ede2] font-sans text-xs max-h-72 overflow-y-auto">
                {essayText}
              </div>
            </div>
          );
        })()}
    </div>
  );
};
