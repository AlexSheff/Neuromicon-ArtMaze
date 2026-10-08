import React, { useEffect, useRef, useState } from 'react';
import { InputController } from '../engine/input/inputController';
import {
  CameraPose,
  LocomotionSystem,
} from '../engine/locomotion/locomotionSystem';
import {
  RaycastTarget,
  ThreeLabyrinthEngine,
} from '../engine/renderer/labyrinthRenderer';
import { webxrManager } from '../engine/xr/webxrManager';
import { spatialAudioSystem } from '../systems/audio/spatialAudioSystem';
import { evaluateDoor } from '../systems/doors/doorSystem';
import {
  performObjectInteraction,
  performPaintingInteraction,
} from '../systems/interaction/interactionSystem';
import { computeCognitiveProfile } from '../systems/measurement/protocolMeasurementSystem';
import { resolveMirrorProposition } from '../systems/mirror/mirrorSystem';
import { observationSystem } from '../systems/observation/observationSystem';
import { getActiveRoomObjects } from '../systems/rooms/roomStateSystem';
import { playerStateStore } from '../systems/state/playerStateStore';
import {
  DoorDefinition,
  MirrorDefinition,
  PlayerState,
  RoomManifest,
} from '../types/artmaze';
import { loadRoomManifest } from '../world/loader/roomLoader';
import { getRoomRegistry } from '../world/registry/roomRegistry';
import { executeDoorTransition } from '../world/transitions/transitionSystem';
import { getVoidDescriptor } from '../world/void/voidSystem';

interface LabyrinthViewportProps {
  lang: 'en' | 'ru';
  playerState: PlayerState;
}

export const LabyrinthViewport: React.FC<LabyrinthViewportProps> = ({
  lang,
  playerState,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const inputRef = useRef<InputController>(new InputController());
  const locomotionRef = useRef<LocomotionSystem>(new LocomotionSystem());
  const hoveredRef = useRef<RaycastTarget | null>(null);
  const langRef = useRef<'en' | 'ru'>(lang);
  langRef.current = lang;

  const [hoveredTarget, setHoveredTarget] = useState<RaycastTarget | null>(null);
  const [gazeProgress, setGazeProgress] = useState<number>(0);
  const [xrActive, setXrActive] = useState<boolean>(() =>
    webxrManager.isSessionActive()
  );
  const [narrativeNotice, setNarrativeNotice] = useState<{
    title: string;
    body: string;
  } | null>(null);
  const [activeDoorProposition, setActiveDoorProposition] =
    useState<DoorDefinition | null>(null);
  const [activeMirrorModal, setActiveMirrorModal] =
    useState<MirrorDefinition | null>(null);
  const [creatorModalOpen, setCreatorModalOpen] = useState<boolean>(false);
  const [customRuleText, setCustomRuleText] = useState<string>(
    'A door that is observed twice must reveal its hidden counterpart.'
  );
  const [audioActive, setAudioActive] = useState<boolean>(() =>
    spatialAudioSystem.isPlaying()
  );
  const [poseSnapshot, setPoseSnapshot] = useState<CameraPose>(() =>
    locomotionRef.current.getPose()
  );

  const currentManifest: RoomManifest =
    loadRoomManifest(playerState.currentRoomId) ??
    loadRoomManifest('ROOM_0000')!;

  const registry = getRoomRegistry();
  const visitCount =
    playerState.roomStates[currentManifest.id]?.visitCount ?? 1;
  const cognitiveProfile = computeCognitiveProfile(playerState);

  useEffect(() => {
    return webxrManager.onSessionChange((active) => {
      setXrActive(active);
    });
  }, []);

  // Reset camera pose on room change
  useEffect(() => {
    locomotionRef.current.resetToRoomSpawn(currentManifest);
    inputRef.current.setPitch(0);
    setPoseSnapshot(locomotionRef.current.getPose());
    setActiveDoorProposition(null);
    setActiveMirrorModal(null);
    setCreatorModalOpen(false);
    spatialAudioSystem.updateRoomAcoustics(
      currentManifest.audio?.baseFrequency ?? 110,
      currentManifest.audio?.harmonicProfile ?? 'labyrinth',
      playerState.activeVoid
    );
  }, [currentManifest.id, playerState.activeVoid]);

  const triggerTargetInteraction = (
    target: RaycastTarget,
    inImmersiveVR = false
  ) => {
    const curLang = langRef.current;
    const latestState = playerStateStore.getState();
    const manifest =
      loadRoomManifest(latestState.currentRoomId) ??
      loadRoomManifest('ROOM_0000')!;

    if (target.kind === 'door' && target.door) {
      if (target.id === 'VOID_RETURN') {
        playerStateStore.exitVoidToRoom(
          latestState.currentRoomId || 'ROOM_0000'
        );
        spatialAudioSystem.triggerChime(523.25);
        return;
      }

      // In immersive VR headset, directly transition through doors so 2D modals never block VR locomotion
      if (
        !inImmersiveVR &&
        target.door.proposition &&
        target.door.proposition.options.length > 0
      ) {
        setActiveDoorProposition(target.door);
        return;
      }

      if (
        inImmersiveVR &&
        target.door.proposition &&
        target.door.proposition.options.length > 0
      ) {
        const firstOpt = target.door.proposition.options[0];
        playerStateStore.recordDecision(
          `door:${manifest.id}:${target.door.id}`,
          firstOpt.id,
          undefined,
          firstOpt.behavioralSignal
        );
      }

      const res = executeDoorTransition(target.door);
      spatialAudioSystem.triggerChime(440);
      setNarrativeNotice({
        title: `Door ${target.door.id}`,
        body: curLang === 'ru' ? res.messageRu : res.message,
      });
      return;
    }

    if (target.kind === 'mirror' && target.mirror) {
      if (inImmersiveVR) {
        resolveMirrorProposition(manifest.id, target.mirror, 'accept');
        spatialAudioSystem.triggerChime(523.25);
        return;
      }
      setActiveMirrorModal(target.mirror);
      return;
    }

    if (target.kind === 'painting' && target.painting) {
      const out = performPaintingInteraction(manifest.id, target.painting);
      spatialAudioSystem.triggerChime(440);
      setNarrativeNotice({
        title:
          curLang === 'ru'
            ? target.painting.metadata.titleRu || target.painting.metadata.title
            : target.painting.metadata.title,
        body: curLang === 'ru' ? out.messageRu : out.message,
      });
      return;
    }

    if (target.kind === 'object' && target.object) {
      if (
        !inImmersiveVR &&
        manifest.creatorPrompt?.enabled &&
        target.object.discoveryId === 'SYSTEM_RULE_CREATED'
      ) {
        setCreatorModalOpen(true);
        return;
      }
      if (
        inImmersiveVR &&
        manifest.creatorPrompt?.enabled &&
        target.object.discoveryId === 'SYSTEM_RULE_CREATED'
      ) {
        playerStateStore.recordCreatedRule(manifest.id, customRuleText);
        spatialAudioSystem.triggerChime(587.33);
        return;
      }
      const out = performObjectInteraction(
        manifest.id,
        target.object,
        'inspect'
      );
      spatialAudioSystem.triggerChime(392);
      setNarrativeNotice({
        title:
          curLang === 'ru'
            ? target.object.titleRu || target.object.title || target.object.id
            : target.object.title || target.object.id,
        body: curLang === 'ru' ? out.messageRu : out.message,
      });
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const engine = new ThreeLabyrinthEngine(canvas);
    webxrManager.attachRenderer(engine.renderer);

    const input = inputRef.current;
    input.attach(canvas);

    const handleResize = () => {
      const rect = container.getBoundingClientRect();
      engine.resize(rect.width, rect.height);
    };
    handleResize();

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    const onContextLost = (e: Event) => {
      e.preventDefault();
    };
    canvas.addEventListener('webglcontextlost', onContextLost);

    let lastTime = performance.now();
    let lastUiSync = 0;

    // Three.js WebXR-compatible animation loop (runs at 72Hz/90Hz on Quest 2 and 60Hz on Desktop)
    engine.renderer.setAnimationLoop((now) => {
      const dt = Math.min(0.1, Math.max(0.001, (now - lastTime) / 1000));
      lastTime = now;

      const latestState = playerStateStore.getState();
      const manifest =
        loadRoomManifest(latestState.currentRoomId) ??
        loadRoomManifest('ROOM_0000')!;

      const desktopInput = input.consumeState();
      const xrInput = webxrManager.pollControllerInput(dt);
      const isPresenting = engine.renderer.xr.isPresenting;

      const mergedInput = {
        ...desktopInput,
        analogForward: -xrInput.moveZ,
        analogStrafe: xrInput.moveX,
        analogTurn: xrInput.turnX,
        interactPressed:
          desktopInput.interactPressed || xrInput.triggerJustPressed,
      };

      const headingOverride = isPresenting
        ? engine.getWorldHeadingYaw(locomotionRef.current.getPose().yaw)
        : undefined;

      const pose = locomotionRef.current.step(
        mergedInput,
        dt,
        manifest,
        Boolean(latestState.activeVoid),
        headingOverride
      );

      const { hovered } = engine.updateAndRender(
        pose,
        manifest,
        latestState,
        getRoomRegistry(),
        now / 1000
      );

      // Update hovered target & HUD state without excessive React re-renders
      if (hovered?.id !== hoveredRef.current?.id) {
        hoveredRef.current = hovered;
        setHoveredTarget(hovered);
      }

      if (now - lastUiSync > 120) {
        lastUiSync = now;
        setPoseSnapshot(pose);
      }

      // Sustained Gaze Observation Mechanic (Looking vs Seeing)
      const gazeRes = observationSystem.updateGaze(
        hovered?.id ?? null,
        dt,
        hovered?.discoveryId,
        manifest.id
      );
      setGazeProgress(gazeRes.progress);

      if (gazeRes.triggeredDiscovery) {
        spatialAudioSystem.triggerChime(587.33);
        const curLang = langRef.current;
        setNarrativeNotice({
          title:
            curLang === 'ru'
              ? 'Замечена Аномалия Пространства'
              : 'Spatial Anomaly Observed',
          body:
            curLang === 'ru'
              ? `Наблюдение открыло скрытую закономерность: ${gazeRes.triggeredDiscovery}. Проверьте двери комнаты.`
              : `Sustained observation revealed: ${gazeRes.triggeredDiscovery}. A hidden threshold may now be visible.`,
        });
      }

      if (mergedInput.interactPressed) {
        if (hovered) {
          triggerTargetInteraction(hovered, isPresenting);
        } else if (latestState.activeVoid && isPresenting) {
          playerStateStore.exitVoidToRoom(
            latestState.currentRoomId || 'ROOM_0000'
          );
          spatialAudioSystem.triggerChime(523.25);
        }
      }
    });

    return () => {
      resizeObserver.disconnect();
      canvas.removeEventListener('webglcontextlost', onContextLost);
      input.detach();
      engine.dispose();
    };
  }, []);

  const handleToggleAudio = () => {
    const next = spatialAudioSystem.toggle();
    setAudioActive(next);
    if (next) {
      spatialAudioSystem.updateRoomAcoustics(
        currentManifest.audio?.baseFrequency ?? 110,
        currentManifest.audio?.harmonicProfile ?? 'labyrinth',
        playerState.activeVoid
      );
    }
  };

  const handleEnterVRClick = async () => {
    const status = await webxrManager.toggleVRSession();
    setNarrativeNotice({
      title: 'WebXR · Meta Quest 2',
      body: status.message,
    });
  };

  const handleLookAtPosition = (targetPos: [number, number, number]) => {
    const pose = locomotionRef.current.getPose();
    const dx = targetPos[0] - pose.x;
    const dz = targetPos[2] - pose.z;
    const yaw = Math.atan2(-dx, -dz);
    inputRef.current.setPitch(0);
    locomotionRef.current.setPose({
      yaw,
      pitch: 0,
    });
  };

  const visibleDoors = currentManifest.doors.filter(
    (d) => evaluateDoor(d, playerState, registry).isVisible
  );
  const activeObjects = getActiveRoomObjects(currentManifest, playerState);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-[calc(100vh-61px)] bg-[#0b0a09] overflow-hidden select-none"
    >
      {/* Three.js WebGL2 + WebXR Canvas */}
      <canvas
        ref={canvasRef}
        onClick={() => {
          if (inputRef.current.wasClickNotDrag() && hoveredRef.current) {
            triggerTargetInteraction(hoveredRef.current, false);
          }
        }}
        className="w-full h-full block cursor-crosshair"
      />

      {/* Center Reticle & Observation Ring */}
      {!playerState.activeVoid && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="relative flex items-center justify-center">
            <div
              className={`w-2.5 h-2.5 rounded-full transition-transform duration-150 ${
                hoveredTarget
                  ? 'bg-[#c8a464] scale-125'
                  : 'bg-white/40 scale-100'
              }`}
            />
            {gazeProgress > 0.05 && (
              <svg className="absolute w-9 h-9 -rotate-90" viewBox="0 0 36 36">
                <circle
                  cx="18"
                  cy="18"
                  r="15"
                  fill="none"
                  stroke="rgba(200, 164, 100, 0.25)"
                  strokeWidth="2"
                />
                <circle
                  cx="18"
                  cy="18"
                  r="15"
                  fill="none"
                  stroke="#c8a464"
                  strokeWidth="2.2"
                  strokeDasharray={`${Math.round(gazeProgress * 94)} 94`}
                />
              </svg>
            )}
          </div>
        </div>
      )}

      {/* Top-Left Architectural Room HUD */}
      <div className="z-10 pointer-events-auto absolute top-5 left-5 max-w-md p-4 bg-black/55 backdrop-blur-md border border-white/10 rounded space-y-2.5">
        <div className="flex items-center justify-between gap-4 text-xs font-mono tabular-nums text-[#a89f91]">
          <span>
            {currentManifest.id} ·{' '}
            {lang === 'ru' ? `Визит ${visitCount}` : `Visit ${visitCount}`} ·{' '}
            {lang === 'ru'
              ? `Цикл ${playerState.cycleCount}`
              : `Cycle ${playerState.cycleCount}`}
          </span>
          <button
            onClick={handleToggleAudio}
            className="text-xs font-mono text-[#c8a464] hover:underline whitespace-nowrap"
          >
            {audioActive
              ? lang === 'ru'
                ? 'Звук: ВКЛ'
                : 'Acoustics: ON'
              : lang === 'ru'
              ? 'Звук: ВЫКЛ'
              : 'Acoustics: OFF'}
          </button>
        </div>

        {currentManifest.protocolStage && !playerState.activeVoid && (
          <p className="text-xs font-mono text-[#c8a464]">
            {currentManifest.protocolStage}
          </p>
        )}

        <h1 className="text-lg font-semibold text-[#f3ede2]">
          {playerState.activeVoid
            ? lang === 'ru'
              ? `ПУСТОТА · ${getVoidDescriptor(playerState.activeVoid).titleRu}`
              : `VOID · ${getVoidDescriptor(playerState.activeVoid).title}`
            : lang === 'ru'
            ? currentManifest.titleRu || currentManifest.title
            : currentManifest.title}
        </h1>

        <p className="text-xs text-[#c2b9aa] leading-relaxed">
          {playerState.activeVoid
            ? lang === 'ru'
              ? getVoidDescriptor(playerState.activeVoid).subtitleRu
              : getVoidDescriptor(playerState.activeVoid).subtitle
            : lang === 'ru'
            ? currentManifest.descriptionRu || currentManifest.description
            : currentManifest.description}
        </p>

        {currentManifest.quest && !playerState.activeVoid && (
          <div className="pt-2 border-t border-white/10 space-y-1">
            <p className="text-xs text-[#c8a464] italic">
              «
              {lang === 'ru'
                ? currentManifest.quest.questionRu ||
                  currentManifest.quest.question
                : currentManifest.quest.question}
              »
            </p>
          </div>
        )}
      </div>

      {/* Top-Right Spatial Orientation & Direct Interaction Bar */}
      <div className="z-10 pointer-events-auto absolute top-5 right-5 max-w-xs p-4 bg-black/55 backdrop-blur-md border border-white/10 rounded space-y-3">
        <div className="flex items-center justify-between text-xs font-mono tabular-nums text-[#a89f91]">
          <span>
            X:{poseSnapshot.x.toFixed(1)} Z:{poseSnapshot.z.toFixed(1)}
          </span>
          <span>
            {lang === 'ru' ? 'Открытий:' : 'Discoveries:'}{' '}
            {playerState.discoveries.length}
          </span>
        </div>

        {!playerState.activeVoid && (
          <>
            <div className="space-y-1.5">
              <p className="text-xs text-[#9c9488]">
                {lang === 'ru'
                  ? 'Двери в этой реальности:'
                  : 'Doors in this reality:'}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {visibleDoors.map((door) => (
                  <button
                    key={door.id}
                    onClick={() => {
                      if (door.position) handleLookAtPosition(door.position);
                      if (
                        door.proposition &&
                        door.proposition.options.length > 0
                      ) {
                        setActiveDoorProposition(door);
                      } else {
                        const res = executeDoorTransition(door);
                        setNarrativeNotice({
                          title: `Door ${door.id}`,
                          body: lang === 'ru' ? res.messageRu : res.message,
                        });
                      }
                    }}
                    className={`px-2.5 py-1 text-xs font-mono rounded border transition-colors whitespace-nowrap ${
                      door.type === 'rabbit-hole' || door.id === 'RH'
                        ? 'bg-[#241a2e] text-[#f0d27a] border-[#d4af37]/50 hover:bg-[#312340]'
                        : 'bg-white/5 text-[#e8e2d5] border-white/10 hover:bg-white/10'
                    }`}
                  >
                    {door.symbol || '→'} Door {door.label || door.id}
                  </button>
                ))}
              </div>
            </div>

            {(activeObjects.length > 0 ||
              currentManifest.mirror ||
              currentManifest.creatorPrompt?.enabled) && (
              <div className="space-y-1.5 pt-2 border-t border-white/10">
                <p className="text-xs text-[#9c9488]">
                  {lang === 'ru'
                    ? 'Объекты, Зеркало и инструменты:'
                    : 'Objects, Mirror & instruments:'}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {activeObjects.map((obj) => (
                    <button
                      key={obj.id}
                      onClick={() => {
                        handleLookAtPosition(obj.position);
                        if (
                          currentManifest.creatorPrompt?.enabled &&
                          obj.discoveryId === 'SYSTEM_RULE_CREATED'
                        ) {
                          setCreatorModalOpen(true);
                          return;
                        }
                        const out = performObjectInteraction(
                          currentManifest.id,
                          obj,
                          'inspect'
                        );
                        spatialAudioSystem.triggerChime(392);
                        setNarrativeNotice({
                          title:
                            lang === 'ru'
                              ? obj.titleRu || obj.title || obj.id
                              : obj.title || obj.id,
                          body: lang === 'ru' ? out.messageRu : out.message,
                        });
                      }}
                      className="px-2.5 py-1 text-xs bg-white/5 hover:bg-white/10 text-[#d8cfc0] border border-white/10 rounded transition-colors truncate max-w-[240px]"
                    >
                      {lang === 'ru'
                        ? obj.titleRu || obj.title
                        : obj.title || obj.id}
                    </button>
                  ))}
                  {currentManifest.mirror && (
                    <button
                      onClick={() => {
                        if (currentManifest.mirror?.position) {
                          handleLookAtPosition(currentManifest.mirror.position);
                        }
                        setActiveMirrorModal(currentManifest.mirror!);
                      }}
                      className="px-2.5 py-1 text-xs bg-[#16222f] hover:bg-[#1e2f40] text-[#b8d4ec] border border-[#7da2c4]/40 rounded transition-colors whitespace-nowrap"
                    >
                      {lang === 'ru'
                        ? `Зеркало (${
                            currentManifest.mirror.characterStateRu ||
                            currentManifest.mirror.characterState
                          })`
                        : `Mirror (${currentManifest.mirror.characterState})`}
                    </button>
                  )}
                  {currentManifest.creatorPrompt?.enabled && (
                    <button
                      onClick={() => setCreatorModalOpen(true)}
                      className="px-2.5 py-1 text-xs bg-[#261f12] hover:bg-[#332917] text-[#f0d27a] border border-[#c8a464]/50 rounded transition-colors whitespace-nowrap"
                    >
                      {lang === 'ru'
                        ? 'XI. Создать Правило (Игрок → Дизайнер)'
                        : 'XI. Author Rule (Player → Designer)'}
                    </button>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {playerState.activeVoid && (
          <div className="pt-2 space-y-2">
            <button
              onClick={() =>
                playerStateStore.exitVoidToRoom(
                  playerState.currentRoomId || 'ROOM_0000'
                )
              }
              className="w-full py-2 px-3 text-xs font-semibold text-[#0b0a09] bg-[#c8a464] hover:bg-[#d6b475] rounded transition-colors whitespace-nowrap"
            >
              {lang === 'ru'
                ? `Вернуться из Пустоты в ${playerState.currentRoomId}`
                : `Step Back from Void into ${playerState.currentRoomId}`}
            </button>
            <button
              onClick={() => playerStateStore.exitVoidToRoom('ROOM_0000')}
              className="w-full py-1.5 px-3 text-xs text-[#d8cfc0] bg-white/5 hover:bg-white/10 border border-white/10 rounded transition-colors whitespace-nowrap"
            >
              {lang === 'ru'
                ? 'Вернуться в ROOM_0000 (Центральный Лабиринт)'
                : 'Return to ROOM_0000 (Central Labyrinth)'}
            </button>
          </div>
        )}
      </div>

      {/* Bottom-Right Dedicated Meta Quest 2 WebXR Launch Button */}
      <div className="z-10 pointer-events-auto absolute bottom-5 right-5">
        <button
          onClick={handleEnterVRClick}
          className="px-4 py-2.5 text-xs font-semibold text-[#0b0a09] bg-[#c8a464] hover:bg-[#d6b475] rounded shadow-lg transition-colors whitespace-nowrap"
        >
          {xrActive
            ? lang === 'ru'
              ? 'Выйти из VR (Quest 2)'
              : 'Exit VR (Quest 2)'
            : lang === 'ru'
            ? 'Войти в 6DOF VR (Meta Quest 2)'
            : 'Enter 6DOF VR (Meta Quest 2)'}
        </button>
      </div>

      {/* Hovered Target Prompt */}
      {hoveredTarget && !playerState.activeVoid && (
        <div className="z-10 pointer-events-none absolute bottom-16 left-1/2 -translate-x-1/2 px-4 py-2 bg-black/70 backdrop-blur-md border border-[#c8a464]/40 rounded text-center">
          <p className="text-xs font-semibold text-[#f3ede2]">
            [Click / E / VR Trigger]{' '}
            {lang === 'ru'
              ? hoveredTarget.titleRu || hoveredTarget.title
              : hoveredTarget.title}
          </p>
          {hoveredTarget.subtitle && (
            <p className="text-xs text-[#a89f91] font-mono mt-0.5">
              {lang === 'ru'
                ? hoveredTarget.subtitleRu || hoveredTarget.subtitle
                : hoveredTarget.subtitle}
            </p>
          )}
        </div>
      )}

      {/* Narrative / Discovery Toast */}
      {narrativeNotice && (
        <div className="z-20 pointer-events-auto absolute bottom-16 left-5 max-w-md p-4 bg-[#141210]/95 backdrop-blur-md border border-[#c8a464]/40 rounded space-y-1.5">
          <div className="flex items-center justify-between gap-4">
            <span className="text-xs font-semibold text-[#c8a464]">
              {narrativeNotice.title}
            </span>
            <button
              onClick={() => setNarrativeNotice(null)}
              className="text-xs text-[#9c9488] hover:text-white"
            >
              ×
            </button>
          </div>
          <p className="text-xs text-[#e8e2d5] leading-relaxed">
            {narrativeNotice.body}
          </p>
        </div>
      )}

      {/* Door Proposition Modal (A / B / C Options + Behavioral Signal Recording) */}
      {activeDoorProposition && (
        <div className="z-30 pointer-events-auto absolute inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-lg w-full p-6 bg-[#141311] border border-[#c8a464]/40 rounded space-y-5">
            <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-4">
              <div>
                <p className="text-xs font-mono text-[#c8a464]">
                  DOOR {activeDoorProposition.id} ·{' '}
                  {activeDoorProposition.subtitle ||
                    activeDoorProposition.destination}
                </p>
                <h2 className="text-xl font-semibold text-[#f3ede2] mt-1">
                  {lang === 'ru'
                    ? activeDoorProposition.proposition?.promptRu ||
                      activeDoorProposition.proposition?.prompt
                    : activeDoorProposition.proposition?.prompt}
                </h2>
              </div>
              <button
                onClick={() => setActiveDoorProposition(null)}
                className="text-xs text-[#9c9488] hover:text-white px-2 py-1"
              >
                {lang === 'ru' ? 'Отойти' : 'Step Back'}
              </button>
            </div>

            <div className="space-y-2.5">
              {activeDoorProposition.proposition?.options.map((opt, idx) => (
                <button
                  key={opt.id}
                  onClick={() => {
                    playerStateStore.recordDecision(
                      `door:${currentManifest.id}:${activeDoorProposition.id}`,
                      opt.id,
                      undefined,
                      opt.behavioralSignal
                    );
                    if (opt.behavioralSignal === 'cycle_reset') {
                      setActiveDoorProposition(null);
                      setNarrativeNotice({
                        title:
                          lang === 'ru'
                            ? 'XVI. Последняя Дверь → Новый Цикл'
                            : 'XVI. The Last Door → New Cycle',
                        body:
                          lang === 'ru'
                            ? 'Лабиринт не закончился. Вы вернулись в начало в новом цикле идентичности.'
                            : 'The labyrinth has not ended. You have returned to the beginning in a new identity cycle.',
                      });
                      return;
                    }
                    const res = executeDoorTransition(
                      activeDoorProposition,
                      opt.destinationOverride,
                      opt.voidOverride
                    );
                    setActiveDoorProposition(null);
                    setNarrativeNotice({
                      title: `Door ${activeDoorProposition.id}`,
                      body: lang === 'ru' ? res.messageRu : res.message,
                    });
                  }}
                  className="w-full text-left p-3.5 bg-white/[0.03] hover:bg-white/[0.08] border border-white/10 hover:border-[#c8a464]/50 rounded transition-colors flex items-center justify-between gap-4"
                >
                  <span className="text-xs text-[#f3ede2]">
                    0{idx + 1}.{' '}
                    {lang === 'ru' ? opt.textRu || opt.text : opt.text}
                  </span>
                  <span className="text-xs font-mono text-[#c8a464] shrink-0">
                    →
                  </span>
                </button>
              ))}
            </div>

            <p className="text-xs text-[#9c9488] pt-2 border-t border-white/10">
              {lang === 'ru'
                ? 'Никакой вариант не объявляется «правильным». Вы также можете отойти от двери и исследовать скрытый слой самой комнаты.'
                : 'No option is declared "correct." You may also step away from the door and examine the hidden layer of the room itself.'}
            </p>
          </div>
        </div>
      )}

      {/* Mirror Instrument Modal (Supports Entry Mirror, Identity Mirror, and Meta-Mirror) */}
      {activeMirrorModal && (
        <div className="z-30 pointer-events-auto absolute inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-xl w-full p-6 bg-[#11161c] border border-[#7da2c4]/40 rounded space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="border-b border-white/10 pb-4 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-mono text-[#7da2c4]">
                  {activeMirrorModal.mode === 'meta'
                    ? 'XII. META MIRROR · DECISION HISTORY'
                    : activeMirrorModal.mode === 'first'
                    ? 'I. ENTRY MIRROR · BASELINE EXPECTATION'
                    : `V. IDENTITY MIRROR · ${activeMirrorModal.characterState}`}
                </p>
                <h2 className="text-xl font-semibold text-[#f3ede2] mt-1">
                  {lang === 'ru'
                    ? activeMirrorModal.characterStateRu ||
                      activeMirrorModal.characterState
                    : activeMirrorModal.characterState}
                </h2>
                <p className="text-xs text-[#c2cfd9] mt-2 leading-relaxed">
                  {lang === 'ru'
                    ? activeMirrorModal.propositionRu ||
                      activeMirrorModal.proposition
                    : activeMirrorModal.proposition}
                </p>
              </div>
              <button
                onClick={() => setActiveMirrorModal(null)}
                className="text-xs text-[#9c9488] hover:text-white px-2 py-1"
              >
                ×
              </button>
            </div>

            {activeMirrorModal.mode === 'meta' && (
              <div className="space-y-4">
                <div className="p-4 bg-[#0a0d12] border border-white/10 rounded font-mono text-xs text-[#e8e2d5] space-y-1.5">
                  {(lang === 'ru'
                    ? cognitiveProfile.metaMirrorLinesRu
                    : cognitiveProfile.metaMirrorLinesEn
                  ).map((line, idx) => (
                    <div key={idx}>{line}</div>
                  ))}
                </div>

                <div className="p-4 bg-[#141920] border border-[#c8a464]/30 rounded space-y-2">
                  <p className="text-xs font-mono text-[#c8a464]">
                    XIV. INITIATION · XV. PERSONAL COGNITIVE PROFILE
                  </p>
                  <p className="text-sm font-semibold text-[#f3ede2]">
                    {lang === 'ru'
                      ? cognitiveProfile.initiationTitleRu
                      : cognitiveProfile.initiationTitleEn}
                  </p>
                  <div className="grid grid-cols-2 gap-2 text-xs text-[#c2cfd9] pt-1">
                    <div>
                      <span className="text-[#9c9488] font-mono">PRIMARY: </span>
                      {lang === 'ru'
                        ? cognitiveProfile.primaryModeRu
                        : cognitiveProfile.primaryModeEn}
                    </div>
                    <div>
                      <span className="text-[#9c9488] font-mono">
                        SECONDARY:{' '}
                      </span>
                      {lang === 'ru'
                        ? cognitiveProfile.secondaryModeRu
                        : cognitiveProfile.secondaryModeEn}
                    </div>
                    <div>
                      <span className="text-[#9c9488] font-mono">SOCIAL: </span>
                      {lang === 'ru'
                        ? cognitiveProfile.socialModeRu
                        : cognitiveProfile.socialModeEn}
                    </div>
                    <div>
                      <span className="text-[#9c9488] font-mono">RISK: </span>
                      {lang === 'ru'
                        ? cognitiveProfile.riskProfileRu
                        : cognitiveProfile.riskProfileEn}
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 pt-2 font-mono tabular-nums text-xs border-t border-white/10">
                    <div>
                      DISCOVERY:{' '}
                      <strong className="text-[#c8a464]">
                        {cognitiveProfile.discoveryIndex}
                      </strong>
                    </div>
                    <div>
                      AWARENESS:{' '}
                      <strong className="text-[#c8a464]">
                        {cognitiveProfile.systemAwareness}
                      </strong>
                    </div>
                    <div>
                      ADAPTATION:{' '}
                      <strong className="text-[#c8a464]">
                        {cognitiveProfile.adaptationIndex}
                      </strong>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button
                onClick={() => {
                  resolveMirrorProposition(
                    currentManifest.id,
                    activeMirrorModal,
                    'accept'
                  );
                  spatialAudioSystem.triggerChime(523.25);
                  setActiveMirrorModal(null);
                  setNarrativeNotice({
                    title: activeMirrorModal.characterState,
                    body:
                      activeMirrorModal.mode === 'first'
                        ? lang === 'ru'
                          ? 'Ожидание зафиксировано: встретить неизвестную версию себя.'
                          : 'Baseline recorded: expecting an unknown version of oneself.'
                        : lang === 'ru'
                        ? 'Вы приняли отражение. Состояние идентичности обновлено.'
                        : 'You accepted the reflection. Persistent identity state updated.',
                  });
                }}
                className="py-2.5 px-4 text-xs font-semibold text-[#0b0a09] bg-[#c8a464] hover:bg-[#d6b475] rounded transition-colors whitespace-nowrap"
              >
                {activeMirrorModal.mode === 'first'
                  ? lang === 'ru'
                    ? 'Себя иного'
                    : 'Another Self'
                  : lang === 'ru'
                  ? 'ПРИНЯТЬ (ACCEPT)'
                  : 'ACCEPT'}
              </button>
              <button
                onClick={() => {
                  resolveMirrorProposition(
                    currentManifest.id,
                    activeMirrorModal,
                    'reject'
                  );
                  spatialAudioSystem.triggerChime(349.23);
                  setActiveMirrorModal(null);
                  setNarrativeNotice({
                    title: activeMirrorModal.characterState,
                    body:
                      activeMirrorModal.mode === 'first'
                        ? lang === 'ru'
                          ? 'Ожидание зафиксировано: встретить архитектора системы.'
                          : 'Baseline recorded: expecting the system architect.'
                        : lang === 'ru'
                        ? 'Вы отвергли предложенный образ.'
                        : 'You rejected the proposed reflection.',
                  });
                }}
                className="py-2.5 px-4 text-xs font-medium text-[#e8e2d5] bg-white/5 hover:bg-white/10 border border-white/15 rounded transition-colors whitespace-nowrap"
              >
                {activeMirrorModal.mode === 'first'
                  ? lang === 'ru'
                    ? 'Создателя'
                    : 'The Architect'
                  : lang === 'ru'
                  ? 'ОТВЕРГНУТЬ (REJECT)'
                  : 'REJECT'}
              </button>
              <button
                onClick={() => {
                  resolveMirrorProposition(
                    currentManifest.id,
                    activeMirrorModal,
                    'return'
                  );
                  setActiveMirrorModal(null);
                }}
                className="py-2.5 px-4 text-xs font-medium text-[#a89f91] bg-transparent hover:bg-white/5 border border-white/10 rounded transition-colors whitespace-nowrap"
              >
                {activeMirrorModal.mode === 'first'
                  ? lang === 'ru'
                    ? 'Никого (Пустоту)'
                    : 'No One'
                  : lang === 'ru'
                  ? 'ВЕРНУТЬСЯ (RETURN)'
                  : 'RETURN'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stage XI: Creator Room Modal (Player → Designer) */}
      {creatorModalOpen && currentManifest.creatorPrompt && (
        <div className="z-30 pointer-events-auto absolute inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-lg w-full p-6 bg-[#16131a] border border-[#c8a464]/50 rounded space-y-5">
            <div className="border-b border-white/10 pb-4 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-mono text-[#c8a464]">
                  XI. CREATOR ROOM · PLAYER → DESIGNER
                </p>
                <h2 className="text-xl font-semibold text-[#f3ede2] mt-1">
                  {lang === 'ru'
                    ? currentManifest.creatorPrompt.titleRu ||
                      currentManifest.creatorPrompt.title
                    : currentManifest.creatorPrompt.title}
                </h2>
                <p className="text-xs text-[#c2b9aa] mt-1.5">
                  {lang === 'ru'
                    ? currentManifest.creatorPrompt.descriptionRu ||
                      currentManifest.creatorPrompt.description
                    : currentManifest.creatorPrompt.description}
                </p>
              </div>
              <button
                onClick={() => setCreatorModalOpen(false)}
                className="text-xs text-[#9c9488] hover:text-white"
              >
                ×
              </button>
            </div>

            <div className="space-y-2">
              <label
                htmlFor="creator-rule-input"
                className="text-xs font-mono text-[#a89f91] block"
              >
                {lang === 'ru'
                  ? 'Формулировка нового правила или загадки для лабиринта:'
                  : 'Inscribe a new rule or proposition into the labyrinth:'}
              </label>
              <textarea
                id="creator-rule-input"
                rows={3}
                value={customRuleText}
                onChange={(e) => setCustomRuleText(e.target.value)}
                className="w-full p-3 bg-[#0e0c10] text-xs font-mono text-[#f3ede2] border border-white/15 rounded focus:outline-none focus:border-[#c8a464]"
              />
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setCreatorModalOpen(false)}
                className="px-4 py-2 text-xs text-[#a89f91] hover:text-white"
              >
                {lang === 'ru' ? 'Отмена' : 'Cancel'}
              </button>
              <button
                onClick={() => {
                  if (!customRuleText.trim()) return;
                  playerStateStore.recordCreatedRule(
                    currentManifest.id,
                    customRuleText.trim()
                  );
                  spatialAudioSystem.triggerChime(587.33);
                  setCreatorModalOpen(false);
                  setNarrativeNotice({
                    title:
                      lang === 'ru'
                        ? 'XI. Правило Вписано в Лабиринт (Player → Designer)'
                        : 'XI. Rule Inscribed (Player → Designer)',
                    body:
                      lang === 'ru'
                        ? `Создано новое правило и открыт прямой переход (Door RH → ROOM_0999).`
                        : `Your rule has been inscribed into the world state and unlocked Door RH → ROOM_0999.`,
                  });
                }}
                className="px-4 py-2 text-xs font-semibold text-[#0b0a09] bg-[#c8a464] hover:bg-[#d6b475] rounded transition-colors whitespace-nowrap"
              >
                {lang === 'ru'
                  ? 'Запечатлеть Правило и Открыть Путь'
                  : 'Inscribe Rule & Unlock Threshold'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Subtle Bottom Controls Bar */}
      <div className="z-10 pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-1.5 bg-black/45 backdrop-blur-sm border border-white/10 rounded text-xs text-[#a89f91] font-mono whitespace-nowrap">
        {lang === 'ru'
          ? 'WASD / Стики Quest: Движение · Мышь / 6DOF VR: Обзор · E / Курок VR: Взаимодействие'
          : 'WASD / Quest Sticks: Walk · Mouse / 6DOF VR: Look · E / VR Trigger: Interact'}
      </div>
    </div>
  );
};
