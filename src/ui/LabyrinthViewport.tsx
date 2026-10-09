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
import { getRoomV1Manifest, roomStreamer } from '../world/roomStreamer';

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
  });
  const [activeDrawer, setActiveDrawer] =
    useState<ActiveContextualDrawer>('none');
  const [inspectedArtRoomId, setInspectedArtRoomId] =
    useState<string>('ROOM_001');
  const [essayText, setEssayText] = useState<string>(essay01PurposeRaw);
  const [zoomActive, setZoomActive] = useState<boolean>(false);
  const [xrActive, setXrActive] = useState<boolean>(() =>
    webxrManager.isSessionActive()
  );
  const [audioActive, setAudioActive] = useState<boolean>(() =>
    spatialAudioSystem.isPlaying()
  );
  const [whisperText, setWhisperText] = useState<string | null>(null);
  const [captionText, setCaptionText] = useState<string | null>(null);
  const [radioDraft, setRadioDraft] = useState<string>('');
  const [leakResult, setLeakResult] = useState<{
    iterations: number;
    passed: boolean;
    geometriesDelta: number;
    materialLeaks: number;
  } | null>(null);

  const hoveredRef = useRef<SpatialInteractiveTarget | null>(null);
  const floorHitRef = useRef<{ x: number; z: number } | null>(null);

  useEffect(() => {
    return hubPlayerState.subscribe((next) => {
      setHubState(next);
    });
  }, []);

  useEffect(() => {
    return webxrManager.onSessionChange((active) => {
      setXrActive(active);
    });
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

  // Desktop Hotkeys: R (Codex), T (Radio), C (Zoom), Alt (Comfort), Z (Audio)
  // Q / E are Snap Turn in InputController, so R has zero collision (§7.4)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (e.code === 'KeyR') {
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
        const nextAudio = spatialAudioSystem.toggle();
        setAudioActive(nextAudio);
        setActiveDrawer((prev) => (prev === 'audio' ? 'none' : 'audio'));
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const executeSpatialAction = (target: SpatialInteractiveTarget) => {
    const eng = engineRef.current;
    const st = hubPlayerState.getState();

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
      eng?.comfort.triggerFadeTransition(() => {
        hubPlayerState.returnToThreshold();
      });
      return;
    }

    // 7. Corridor Door -> Room or Designed Void Fallback (§7.2.3)
    if (target.kind === 'corridor-door' && target.roomId) {
      const rid = target.roomId;
      if (target.status === 'planned') {
        spatialAudioSystem.triggerChime(220);
        eng?.comfort.triggerFadeTransition(() => {
          hubPlayerState.enterVoidFallback(rid);
        });
        return;
      }

      spatialAudioSystem.triggerChime(523.25);
      let settled = false;
      const timeoutId = window.setTimeout(() => {
        if (!settled) {
          settled = true;
          eng?.comfort.triggerFadeTransition(() => {
            hubPlayerState.enterVoidFallback(rid);
          });
        }
      }, 8000);

      void roomStreamer.verifyRoomEntryHash(rid).then((valid) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeoutId);
        eng?.comfort.triggerFadeTransition(() => {
          if (valid) {
            hubPlayerState.enterRoom(rid, st.branch, st.segmentIndex);
          } else {
            hubPlayerState.enterVoidFallback(rid);
          }
        });
      });
      return;
    }

    // 8. Room Door -> Next Room or Designed Void Fallback (§7.2.3)
    if (target.kind === 'room-door' && target.roomId) {
      const rid = target.roomId;
      if (target.status === 'planned') {
        spatialAudioSystem.triggerChime(220);
        eng?.comfort.triggerFadeTransition(() => {
          hubPlayerState.enterVoidFallback(rid);
        });
        return;
      }

      spatialAudioSystem.triggerChime(587.33);
      eng?.comfort.triggerFadeTransition(() => {
        hubPlayerState.enterRoom(rid);
      });
      return;
    }

    // 9. Room Object / Mirror Reflection Anomaly
    if (target.kind === 'room-object' && target.objectId) {
      const roomId = st.currentRoomId || 'ROOM_073';
      const manifest = getRoomV1Manifest(roomId);
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
        eng?.comfort.triggerFadeTransition(() => {
          hubPlayerState.returnToCorridor();
        });
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

    const engine = new HubEngine(canvas);
    engineRef.current = engine;
    webxrManager.attachRenderer(engine.renderer);

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

      const { hovered, telemetry: frameTelemetry, onboardingVisual: obVis } =
        engine.stepAndRender(dt, desktopInput, xrInput, curState, now / 1000);

      hoveredRef.current = hovered.target;
      floorHitRef.current = hovered.floorHitPoint
        ? { x: hovered.floorHitPoint.x, z: hovered.floorHitPoint.z }
        : null;

      if (desktopInput.interactPressed || xrInput.triggerJustPressed) {
        if (hovered.target) {
          executeSpatialAction(hovered.target);
        } else if (hovered.floorHitPoint) {
          engine.teleportTo(hovered.floorHitPoint.x, hovered.floorHitPoint.z);
        }
      }

      if (xrInput.squeezeJustPressed) {
        if (curState.location === 'room' || curState.location === 'void') {
          engine.comfort.triggerFadeTransition(() => {
            hubPlayerState.returnToCorridor();
          });
        } else if (curState.location === 'corridor') {
          engine.comfort.triggerFadeTransition(() => {
            hubPlayerState.returnToThreshold();
          });
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
      window.removeEventListener('resize', handleResize);
      input.detach();
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  const handleCanvasClick = () => {
    if (!inputRef.current.wasClickNotDrag()) return;
    if (!spatialAudioSystem.isPlaying()) {
      spatialAudioSystem.start();
      setAudioActive(true);
    }

    if (hoveredRef.current) {
      executeSpatialAction(hoveredRef.current);
    } else if (floorHitRef.current && engineRef.current) {
      engineRef.current.teleportTo(
        floorHitRef.current.x,
        floorHitRef.current.z
      );
    }
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

      {/* Contextual Discovery & VR Wrist / Palm Non-Keyboard Controls (§2.5) */}
      <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
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

        {isControlRevealed('audio') && (
          <button
            onClick={() =>
              setActiveDrawer((prev) => (prev === 'audio' ? 'none' : 'audio'))
            }
            title="Resonance (Z)"
            className={`px-3 py-1.5 rounded text-xs font-mono border transition-colors ${
              activeDrawer === 'audio'
                ? 'bg-[#c8a464] text-[#0b0a09] border-[#c8a464] font-semibold'
                : 'bg-[#12100e]/85 text-[#d8cfc0] border-white/15 hover:border-[#c8a464]/60'
            }`}
          >
            ♫ {!xrActive && 'Z'}
          </button>
        )}

        {isControlRevealed('comfort') && (
          <button
            onClick={() =>
              setActiveDrawer((prev) =>
                prev === 'comfort' ? 'none' : 'comfort'
              )
            }
            title="Comfort & Posture (Alt)"
            className={`px-3 py-1.5 rounded text-xs font-mono border transition-colors ${
              activeDrawer === 'comfort'
                ? 'bg-[#c8a464] text-[#0b0a09] border-[#c8a464] font-semibold'
                : 'bg-[#12100e]/85 text-[#d8cfc0] border-white/15 hover:border-[#c8a464]/60'
            }`}
          >
            ✥ {!xrActive && 'Alt'}
          </button>
        )}

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
            <div className="pt-1 grid grid-cols-3 gap-1.5">
              {([1, 2, 3] as const).map((seg) => (
                <button
                  key={seg}
                  onClick={() => {
                    hubPlayerState.setCorridorSegment(
                      seg === 2 ? 'descend' : 'ascend',
                      seg
                    );
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
                {`${telemetry.fps} FPS (${telemetry.frameTimeMs} ms) · ${telemetry.drawCalls} DC · ${telemetry.textureMemoryMB} MB GPU`}
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
        </div>
      )}

      {/* Contextual Drawer: AUDIO (`Z`, §2.5) */}
      {activeDrawer === 'audio' && (
        <div className="absolute top-16 right-4 w-[370px] max-w-[calc(100vw-2rem)] bg-[#0e0c0a]/95 border border-[#c8a464]/40 rounded p-5 text-xs text-[#e8e2d5] backdrop-blur-md shadow-2xl z-20 space-y-3">
          <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
            <span className="font-display text-sm font-semibold text-[#e5c158]">
              ♫ NEUROMICON AUDIO CARRIER
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
            <span>Room Audio Carrier:</span>
            <button
              onClick={() => {
                const next = spatialAudioSystem.toggle();
                setAudioActive(next);
              }}
              className={`px-3 py-1 rounded font-mono text-xs ${
                audioActive
                  ? 'bg-[#66cc99]/20 text-[#66cc99] border border-[#66cc99]/40'
                  : 'bg-white/10 text-[#a89f91]'
              }`}
            >
              {audioActive ? 'ENABLED (IN ROOMS ONLY)' : 'MUTED'}
            </button>
          </div>

          <div>
            <div className="flex justify-between text-[11px] font-mono text-[#a89f91] mb-1">
              <span>Volume</span>
              <span>{Math.round(spatialAudioSystem.getVolume() * 100)}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              defaultValue={spatialAudioSystem.getVolume()}
              onChange={(e) => {
                spatialAudioSystem.setVolume(parseFloat(e.target.value));
              }}
              className="w-full accent-[#c8a464]"
            />
          </div>
        </div>
      )}

      {/* Contextual Drawer: NEUROMICON PAINTING & ESSAY TRANSMISSION */}
      {activeDrawer === 'essay' &&
        (() => {
          const artManifest = getRoomV1Manifest(inspectedArtRoomId);
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
