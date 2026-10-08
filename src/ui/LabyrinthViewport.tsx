import React, { useEffect, useRef, useState } from 'react';
import {
  getWorldNodes,
  SpatialInteractiveTarget,
} from '../corridor/corridorBuilder';
import {
  HubEngine,
  HubRenderTelemetry,
} from '../engine/hubEngine';
import { InputController } from '../engine/input/inputController';
import { webxrManager } from '../engine/xr/webxrManager';
import { spatialAudioSystem } from '../systems/audio/spatialAudioSystem';
import { HubPlayerState, hubPlayerState } from '../state/playerState';
import { PlayerState } from '../types/artmaze';
import { getRoomV1Manifest } from '../world/roomStreamer';

interface LabyrinthViewportProps {
  lang: 'en' | 'ru';
  playerState: PlayerState;
}

type ActiveHotkeyOverlay = 'none' | 'rules' | 'radio' | 'comfort' | 'audio';

export const LabyrinthViewport: React.FC<LabyrinthViewportProps> = ({
  lang,
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
  const [telemetry, setTelemetry] = useState<HubRenderTelemetry>({
    fps: 72,
    drawCalls: 18,
    triangles: 4200,
    geometries: 24,
    textures: 8,
  });
  const [activeOverlay, setActiveOverlay] =
    useState<ActiveHotkeyOverlay>('none');
  const [zoomActive, setZoomActive] = useState<boolean>(false);
  const [xrActive, setXrActive] = useState<boolean>(() =>
    webxrManager.isSessionActive()
  );
  const [audioActive, setAudioActive] = useState<boolean>(() =>
    spatialAudioSystem.isPlaying()
  );
  const [notice, setNotice] = useState<{ title: string; body: string } | null>(
    null
  );
  const [radioDraft, setRadioDraft] = useState<string>('');

  const hoveredRef = useRef<SpatialInteractiveTarget | null>(null);
  const floorHitRef = useRef<{ x: number; z: number } | null>(null);
  const langRef = useRef<'en' | 'ru'>(lang);
  langRef.current = lang;

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

  // Desktop Hotkeys: R (Rules), T (Radio/Comments), C (Zoom), Alt (Comfort/Settings), Z (Audio)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (e.code === 'KeyR') {
        e.preventDefault();
        setActiveOverlay((prev) => (prev === 'rules' ? 'none' : 'rules'));
      } else if (e.code === 'KeyT') {
        e.preventDefault();
        setActiveOverlay((prev) => (prev === 'radio' ? 'none' : 'radio'));
      } else if (e.code === 'KeyC') {
        e.preventDefault();
        const eng = engineRef.current;
        if (eng) {
          const next = !eng.isFovZoom();
          eng.setFovZoom(next);
          setZoomActive(next);
        }
      } else if (e.key === 'Alt') {
        e.preventDefault();
        setActiveOverlay((prev) => (prev === 'comfort' ? 'none' : 'comfort'));
      } else if (e.code === 'KeyZ') {
        e.preventDefault();
        const nextAudio = spatialAudioSystem.toggle();
        setAudioActive(nextAudio);
        setActiveOverlay((prev) => (prev === 'audio' ? 'none' : 'audio'));
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const executeSpatialAction = (target: SpatialInteractiveTarget) => {
    const eng = engineRef.current;
    const curLang = langRef.current;
    const st = hubPlayerState.getState();

    if (target.kind === 'threshold-branch' && target.branch) {
      const chosen = target.branch;
      spatialAudioSystem.triggerChime(chosen === 'ascend' ? 523.25 : 293.66);
      eng?.comfort.triggerFadeTransition(() => {
        hubPlayerState.chooseBranchFromThreshold(chosen);
      });
      setNotice({
        title:
          chosen === 'ascend'
            ? curLang === 'ru'
              ? 'Путь Выбран: ВОСХОЖДЕНИЕ (Ascent)'
              : 'Path Chosen: ASCENT (Grow / Embody)'
            : curLang === 'ru'
            ? 'Путь Выбран: НИСХОЖДЕНИЕ (Descent)'
            : 'Path Chosen: DESCENT (Search / Explore)',
        body:
          curLang === 'ru'
            ? `Записано player.path = "${chosen}". Вы вошли в Сегмент 1.`
            : `Persisted player.path = "${chosen}". Entered Segment 1.`,
      });
      return;
    }

    if (target.kind === 'segment-portal' && target.branch && target.segment) {
      const b = target.branch;
      const s = target.segment;
      spatialAudioSystem.triggerChime(440);
      eng?.comfort.triggerFadeTransition(() => {
        hubPlayerState.setCorridorSegment(b, s);
      });
      return;
    }

    if (target.kind === 'corridor-return') {
      spatialAudioSystem.triggerChime(392);
      eng?.comfort.triggerFadeTransition(() => {
        hubPlayerState.returnToThreshold();
      });
      return;
    }

    if (target.kind === 'corridor-door' && target.roomId) {
      if (target.status === 'planned') {
        spatialAudioSystem.triggerChime(220);
        setNotice({
          title:
            curLang === 'ru'
              ? `${target.roomId} · Дверь Запечатана (Planned)`
              : `${target.roomId} · Door Sealed (Planned)`,
          body:
            curLang === 'ru'
              ? 'Этот узел графа имеет статус "planned" в world.graph.json и ожидает публикации репозитория комнаты.'
              : 'This graph node is marked status: "planned" in world.graph.json and renders as a sealed architectural door.',
        });
        return;
      }

      const rid = target.roomId;
      spatialAudioSystem.triggerChime(523.25);
      eng?.comfort.triggerFadeTransition(() => {
        hubPlayerState.enterRoom(rid, st.branch, st.segment);
      });
      return;
    }

    if (target.kind === 'room-door' && target.roomId) {
      if (target.status === 'planned') {
        spatialAudioSystem.triggerChime(220);
        setNotice({
          title: `${target.roomId} · Sealed Door`,
          body:
            curLang === 'ru'
              ? 'Комната в статусе "planned". Используйте другие двери или вернитесь в коридор через Зеркало (BACK).'
              : 'Destination room is marked "planned". Choose another door or return to the Corridor via the Mirror (BACK).',
        });
        return;
      }

      const rid = target.roomId;
      spatialAudioSystem.triggerChime(587.33);
      eng?.comfort.triggerFadeTransition(() => {
        hubPlayerState.enterRoom(rid);
      });
      return;
    }

    if (target.kind === 'room-object' && target.objectId) {
      const roomId = st.currentRoomId || 'ROOM_073';
      const manifest = getRoomV1Manifest(roomId);
      const isGhost = target.id.startsWith('GHOST_');

      if (isGhost) {
        const discKey = `${roomId}:interactReflection:${target.objectId}`;
        hubPlayerState.unlockDiscovery(discKey);
        hubPlayerState.markQuestCompleted(roomId);
        spatialAudioSystem.triggerChime(659.25);
        setNotice({
          title:
            curLang === 'ru'
              ? 'Кроличья Нора Открыта (Door RH → ROOM_1149)'
              : 'Rabbit Hole Unlocked (Door RH → ROOM_1149)',
          body:
            curLang === 'ru'
              ? 'Вы взаимодействовали с отражением объекта, которого нет в комнате! На западной стене открылась скрытая дверь RH.'
              : 'You interacted with a reflection that has no physical object! Hidden Door RH has materialized on the West wall.',
        });
        return;
      }

      hubPlayerState.markQuestCompleted(roomId);
      spatialAudioSystem.triggerChime(493.88);
      setNotice({
        title: curLang === 'ru' ? target.titleRu : target.title,
        body:
          curLang === 'ru'
            ? `Квест комнаты ${manifest.id} выполнен! Объект непереносим (portable: false) и остаётся в комнате.`
            : `Quest objective in ${manifest.id} completed! Object is non-portable (portable: false) and remains in the room.`,
      });
      return;
    }

    if (target.kind === 'room-mirror' && target.mirrorChoice) {
      const roomId = st.currentRoomId || 'ROOM_073';
      if (target.mirrorChoice === 'back') {
        spatialAudioSystem.triggerChime(392);
        eng?.comfort.triggerFadeTransition(() => {
          hubPlayerState.returnToCorridor();
        });
        setNotice({
          title:
            curLang === 'ru'
              ? 'Возврат в Главный Коридор'
              : 'Returned to Main Corridor',
          body:
            curLang === 'ru'
              ? `Вы вернулись в ветвь ${st.branch.toUpperCase()}, Сегмент ${st.segment}.`
              : `Restored to ${st.branch.toUpperCase()} Branch, Segment ${st.segment}.`,
        });
        return;
      }

      hubPlayerState.recordMirrorChoice(roomId, target.mirrorChoice);
      spatialAudioSystem.triggerChime(523.25);
      setNotice({
        title:
          curLang === 'ru'
            ? `Зеркало: ${target.mirrorChoice.toUpperCase()}`
            : `Mirror Identity: ${target.mirrorChoice.toUpperCase()}`,
        body:
          curLang === 'ru'
            ? `Выбор идентичности (${target.mirrorChoice}) сохранён в состоянии игрока.`
            : `Identity choice (${target.mirrorChoice}) recorded in persistent state.`,
      });
      return;
    }

    if (target.kind === 'artwork') {
      spatialAudioSystem.triggerChime(440);
      setNotice({
        title: curLang === 'ru' ? target.titleRu : target.title,
        body: target.subtitle,
      });
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
      const rect = container.getBoundingClientRect();
      engine.resize(rect.width, rect.height);
    };
    handleResize();

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    let lastTime = performance.now();
    let lastTelemetryTime = 0;

    engine.renderer.setAnimationLoop((now) => {
      const dt = Math.min(0.1, Math.max(0.001, (now - lastTime) / 1000));
      lastTime = now;

      const desktopInput = input.consumeState();
      const xrInput = webxrManager.pollControllerInput(dt);
      const currentState = hubPlayerState.getState();

      const { hovered, telemetry: frameTelemetry } = engine.stepAndRender(
        dt,
        desktopInput,
        xrInput,
        currentState
      );

      if (hovered.target?.id !== hoveredRef.current?.id) {
        hoveredRef.current = hovered.target;
        setHoveredTarget(hovered.target);
      }

      if (hovered.floorHitPoint) {
        floorHitRef.current = {
          x: hovered.floorHitPoint.x,
          z: hovered.floorHitPoint.z,
        };
        setHasFloorTeleportTarget(true);
      } else {
        floorHitRef.current = null;
        setHasFloorTeleportTarget(false);
      }

      if (now - lastTelemetryTime > 400) {
        lastTelemetryTime = now;
        setTelemetry(frameTelemetry);
      }

      if (desktopInput.interactPressed || xrInput.triggerJustPressed) {
        if (hovered.target) {
          executeSpatialAction(hovered.target);
        } else if (hovered.floorHitPoint) {
          engine.teleportTo(hovered.floorHitPoint.x, hovered.floorHitPoint.z);
        }
      }
    });

    return () => {
      resizeObserver.disconnect();
      input.detach();
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  const activeRoomManifest =
    hubState.location === 'room' && hubState.currentRoomId
      ? getRoomV1Manifest(hubState.currentRoomId)
      : null;

  const activeChannel =
    hubState.location === 'room' && activeRoomManifest
      ? activeRoomManifest.radio.channel
      : 'THRESHOLD';

  const currentSegmentNodes = getWorldNodes().filter(
    (n) => n.branch === hubState.branch && n.segment === hubState.segment
  );

  return (
    <div
      ref={containerRef}
      className="relative w-full h-[calc(100vh-61px)] bg-[#0b0a09] overflow-hidden select-none"
    >
      {/* WebGL2 + WebXR Canvas */}
      <canvas
        ref={canvasRef}
        onClick={() => {
          if (!inputRef.current.wasClickNotDrag()) return;
          if (hoveredRef.current) {
            executeSpatialAction(hoveredRef.current);
          } else if (floorHitRef.current && engineRef.current) {
            engineRef.current.teleportTo(
              floorHitRef.current.x,
              floorHitRef.current.z
            );
          }
        }}
        className="w-full h-full block cursor-crosshair"
      />

      {/* Center Reticle */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div
          className={`w-2.5 h-2.5 rounded-full transition-transform duration-150 ${
            hoveredTarget
              ? 'bg-[#c8a464] scale-125'
              : hasFloorTeleportTarget
              ? 'bg-[#c8a464]/70 scale-105'
              : 'bg-white/35 scale-100'
          }`}
        />
      </div>

      {/* Top-Left Minimal Context Header (§4A.1 - Keep greeting minimal, no text wall) */}
      <div className="z-10 pointer-events-auto absolute top-5 left-5 max-w-md p-4 bg-black/60 backdrop-blur-md border border-white/10 rounded space-y-2">
        <div className="flex items-center justify-between gap-4 text-xs font-mono text-[#a89f91]">
          <span>
            {hubState.location === 'threshold'
              ? 'THE THRESHOLD · ATRIUM'
              : hubState.location === 'corridor'
              ? `${hubState.branch.toUpperCase()} · SEGMENT ${hubState.segment}`
              : `${activeRoomManifest?.id} · ${activeRoomManifest?.identity.dimension}`}
          </span>
          <span className="text-[#c8a464]">
            {hubState.path
              ? `PATH: ${hubState.path.toUpperCase()}`
              : 'PATH: UNCHOSEN'}
          </span>
        </div>

        <h1 className="text-lg font-semibold text-[#f3ede2]">
          {hubState.location === 'threshold'
            ? lang === 'ru'
              ? 'Порог · Выберите Восхождение или Нисхождение'
              : 'The Threshold · Choose Ascent or Descent'
            : hubState.location === 'corridor'
            ? lang === 'ru'
              ? `${
                  hubState.branch === 'ascend'
                    ? 'Ветвь Восхождения (Воплощать / Расти)'
                    : 'Ветвь Нисхождения (Искать / Исследовать)'
                } · Сегмент ${hubState.segment}`
              : `${
                  hubState.branch === 'ascend'
                    ? 'Ascent Branch (Grow / Embody)'
                    : 'Descent Branch (Search / Explore)'
                } · Segment ${hubState.segment}`
            : lang === 'ru'
            ? `${activeRoomManifest?.identity.symbol} · ${
                activeRoomManifest?.identity.nameRu ||
                activeRoomManifest?.identity.name
              }`
            : `${activeRoomManifest?.identity.symbol} · ${activeRoomManifest?.identity.name}`}
        </h1>

        {hubState.location === 'room' && activeRoomManifest && (
          <div className="pt-1.5 border-t border-white/10 space-y-1">
            <p className="text-xs text-[#c8a464] italic">
              «
              {lang === 'ru'
                ? activeRoomManifest.quest.questionRu ||
                  activeRoomManifest.quest.question
                : activeRoomManifest.quest.question}
              »
            </p>
            <p className="text-xs text-[#a89f91] font-mono">
              {lang === 'ru'
                ? `Задача: ${
                    activeRoomManifest.quest.objectiveRu ||
                    activeRoomManifest.quest.objective
                  }`
                : `Objective: ${activeRoomManifest.quest.objective}`}
            </p>
          </div>
        )}
      </div>

      {/* Top-Right Quick Navigation & Comfort Bar */}
      <div className="z-10 pointer-events-auto absolute top-5 right-5 max-w-xs p-4 bg-black/60 backdrop-blur-md border border-white/10 rounded space-y-3">
        <div className="flex items-center justify-between gap-3 text-xs font-mono tabular-nums text-[#a89f91]">
          <span>
            {telemetry.fps} FPS · {telemetry.drawCalls} DC
          </span>
          <span className="text-[#c8a464]">
            {hubState.comfortMode.toUpperCase()}
          </span>
        </div>

        {/* Diegetic Quick Actions for Desktop & Quest 2 Browser */}
        {hubState.location === 'threshold' && (
          <div className="space-y-1.5">
            <p className="text-xs text-[#9c9488]">
              {lang === 'ru'
                ? 'Выбор ветви лабиринта (§4A):'
                : 'Choose Labyrinth Branch (§4A):'}
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() =>
                  executeSpatialAction({
                    id: 'THRESHOLD_ASCENT',
                    kind: 'threshold-branch',
                    branch: 'ascend',
                    title: 'UP — ASCENT',
                    titleRu: 'ВВЕРХ — ВОСХОЖДЕНИЕ',
                    subtitle: '',
                    subtitleRu: '',
                  })
                }
                className="px-3 py-2 text-xs font-semibold bg-[#c8a464] text-[#0b0a09] hover:bg-[#d8b676] rounded transition-colors"
              >
                ▲ {lang === 'ru' ? 'ВВЕРХ (Расти)' : 'UP · Ascent'}
              </button>
              <button
                onClick={() =>
                  executeSpatialAction({
                    id: 'THRESHOLD_DESCENT',
                    kind: 'threshold-branch',
                    branch: 'descend',
                    title: 'DOWN — DESCENT',
                    titleRu: 'ВНИЗ — НИСХОЖДЕНИЕ',
                    subtitle: '',
                    subtitleRu: '',
                  })
                }
                className="px-3 py-2 text-xs font-semibold bg-[#1c3b57] text-[#e8f4fc] border border-[#4ea8de]/50 hover:bg-[#254d70] rounded transition-colors"
              >
                ▼ {lang === 'ru' ? 'ВНИЗ (Искать)' : 'DOWN · Descent'}
              </button>
            </div>
          </div>
        )}

        {hubState.location === 'corridor' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <button
                onClick={() =>
                  hubPlayerState.setCorridorSegment(
                    hubState.branch,
                    hubState.segment === 1 ? 2 : 1
                  )
                }
                className="flex-1 px-2.5 py-1.5 text-xs font-mono bg-white/5 hover:bg-white/10 border border-white/10 rounded text-[#f3ede2]"
              >
                → {lang === 'ru' ? 'Сегмент' : 'Segment'}{' '}
                {hubState.segment === 1 ? 2 : 1}
              </button>
              <button
                onClick={() => hubPlayerState.returnToThreshold()}
                className="px-2.5 py-1.5 text-xs font-mono bg-white/5 hover:bg-white/10 border border-white/10 rounded text-[#a89f91]"
              >
                ↺ {lang === 'ru' ? 'Порог' : 'Threshold'}
              </button>
            </div>

            <div className="space-y-1 pt-1 border-t border-white/10">
              <p className="text-xs text-[#9c9488]">
                {lang === 'ru' ? 'Двери сегмента:' : 'Segment Doors:'}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {currentSegmentNodes.map((n) => (
                  <button
                    key={n.id}
                    onClick={() =>
                      executeSpatialAction({
                        id: `CORRIDOR_DOOR_${n.id}`,
                        kind: 'corridor-door',
                        roomId: n.id,
                        status: n.status,
                        title: n.title,
                        titleRu: n.titleRu || n.title,
                        subtitle: n.dimension,
                        subtitleRu: n.dimension,
                      })
                    }
                    className={`px-2.5 py-1 text-xs font-mono rounded border transition-colors ${
                      n.status === 'planned'
                        ? 'bg-white/5 text-[#777] border-white/5'
                        : 'bg-white/5 hover:bg-white/15 text-[#f3ede2] border-[#c8a464]/40'
                    }`}
                  >
                    {n.symbol} · {n.id}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {hubState.location === 'room' && activeRoomManifest && (
          <div className="space-y-2">
            <button
              onClick={() =>
                executeSpatialAction({
                  id: 'MIRROR_CHOICE_back',
                  kind: 'room-mirror',
                  mirrorChoice: 'back',
                  title: 'Back to Corridor',
                  titleRu: 'В Коридор',
                  subtitle: '',
                  subtitleRu: '',
                })
              }
              className="w-full py-1.5 px-3 text-xs font-semibold bg-[#c8a464] text-[#0b0a09] hover:bg-[#d8b676] rounded transition-colors"
            >
              ↺{' '}
              {lang === 'ru'
                ? `Вернуться в Коридор (${hubState.branch.toUpperCase()} Seg ${
                    hubState.segment
                  })`
                : `Return to Corridor (${hubState.branch.toUpperCase()} Seg ${
                    hubState.segment
                  })`}
            </button>
          </div>
        )}

        {/* Hotkey Bar (§7.9: R, T, C, Alt, Z) */}
        <div className="pt-2 border-t border-white/10 grid grid-cols-5 gap-1">
          <button
            onClick={() =>
              setActiveOverlay((p) => (p === 'rules' ? 'none' : 'rules'))
            }
            className={`py-1 text-[11px] font-mono rounded border ${
              activeOverlay === 'rules'
                ? 'bg-[#c8a464] text-[#0b0a09] border-[#c8a464]'
                : 'bg-white/5 text-[#d8cfc0] border-white/10'
            }`}
            title="Rules (Key R)"
          >
            [R]
          </button>
          <button
            onClick={() =>
              setActiveOverlay((p) => (p === 'radio' ? 'none' : 'radio'))
            }
            className={`py-1 text-[11px] font-mono rounded border ${
              activeOverlay === 'radio'
                ? 'bg-[#c8a464] text-[#0b0a09] border-[#c8a464]'
                : 'bg-white/5 text-[#d8cfc0] border-white/10'
            }`}
            title="Radio / Comments (Key T)"
          >
            [T]
          </button>
          <button
            onClick={() => {
              const eng = engineRef.current;
              if (eng) {
                const next = !eng.isFovZoom();
                eng.setFovZoom(next);
                setZoomActive(next);
              }
            }}
            className={`py-1 text-[11px] font-mono rounded border ${
              zoomActive
                ? 'bg-[#c8a464] text-[#0b0a09] border-[#c8a464]'
                : 'bg-white/5 text-[#d8cfc0] border-white/10'
            }`}
            title="Zoom / Scale (Key C)"
          >
            [C]
          </button>
          <button
            onClick={() =>
              setActiveOverlay((p) => (p === 'comfort' ? 'none' : 'comfort'))
            }
            className={`py-1 text-[11px] font-mono rounded border ${
              activeOverlay === 'comfort'
                ? 'bg-[#c8a464] text-[#0b0a09] border-[#c8a464]'
                : 'bg-white/5 text-[#d8cfc0] border-white/10'
            }`}
            title="VR Comfort Settings (Key Alt)"
          >
            [Alt]
          </button>
          <button
            onClick={() => {
              const next = spatialAudioSystem.toggle();
              setAudioActive(next);
              setActiveOverlay((p) => (p === 'audio' ? 'none' : 'audio'));
            }}
            className={`py-1 text-[11px] font-mono rounded border ${
              audioActive
                ? 'bg-[#c8a464] text-[#0b0a09] border-[#c8a464]'
                : 'bg-white/5 text-[#d8cfc0] border-white/10'
            }`}
            title="Soundtrack & Volume (Key Z)"
          >
            [Z]
          </button>
        </div>
      </div>

      {/* Hotkey Overlay Panels (R, T, Alt, Z) */}
      {activeOverlay !== 'none' && (
        <div className="z-30 pointer-events-auto absolute top-24 left-1/2 -translate-x-1/2 max-w-lg w-full p-5 bg-[#12110f]/95 backdrop-blur-md border border-[#c8a464]/40 rounded space-y-4">
          <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
            <h2 className="text-sm font-mono uppercase tracking-wider text-[#c8a464]">
              {activeOverlay === 'rules' &&
                (lang === 'ru'
                  ? '[R] Правила Лабиринта & Room API v1'
                  : '[R] Labyrinth Rules & Room API v1')}
              {activeOverlay === 'radio' &&
                (lang === 'ru'
                  ? `[T] Радиоканал · ${activeChannel}`
                  : `[T] Radio Channel · ${activeChannel}`)}
              {activeOverlay === 'comfort' &&
                (lang === 'ru'
                  ? '[Alt] Настройки VR-Комфорта (Без Укачивания)'
                  : '[Alt] VR Comfort & Anti-Vection Settings')}
              {activeOverlay === 'audio' &&
                (lang === 'ru'
                  ? '[Z] Управление Звуком и Саундтреком'
                  : '[Z] Audio & Branch Crossfade Control')}
            </h2>
            <button
              onClick={() => setActiveOverlay('none')}
              className="text-xs text-[#a89f91] hover:text-white"
            >
              ×
            </button>
          </div>

          {activeOverlay === 'rules' && (
            <div className="space-y-2 text-xs text-[#d8cfc0] leading-relaxed">
              <p>
                •{' '}
                {lang === 'ru'
                  ? 'Порог разделён вертикально: ВВЕРХ (Восхождение — воплощать, расти) и ВНИЗ (Нисхождение — искать, исследовать).'
                  : 'The Threshold splits vertically: UP (Ascent — grow, embody) and DOWN (Descent — search, explore).'}
              </p>
              <p>
                •{' '}
                {lang === 'ru'
                  ? 'В каждой комнате: вопрос, квест, 3 двери (A, B, C), Зеркало идентичности (Accept / Reject / Back) и скрытая Кроличья Нора (RH).'
                  : 'Every room holds a question, a quest, 3 doors (A, B, C), an Identity Mirror (Accept / Reject / Back), and a hidden Rabbit Hole (RH).'}
              </p>
              <p>
                •{' '}
                {lang === 'ru'
                  ? 'Объекты никогда не покидают комнату (portable: false); между комнатами передаётся только знание.'
                  : 'Objects never leave their room (portable: false); only knowledge travels across thresholds.'}
              </p>
            </div>
          )}

          {activeOverlay === 'comfort' && (
            <div className="space-y-3 text-xs">
              <div className="space-y-1.5">
                <p className="text-[#a89f91] font-mono">
                  {lang === 'ru'
                    ? 'Режим перемещения в VR / Десктоп (§4A.3):'
                    : 'Locomotion Mode (§4A.3):'}
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {(['teleport', 'smooth', 'seated'] as const).map((m) => (
                    <button
                      key={m}
                      onClick={() => hubPlayerState.setComfortMode(m)}
                      className={`py-2 px-3 font-mono rounded border ${
                        hubState.comfortMode === m
                          ? 'bg-[#c8a464] text-[#0b0a09] border-[#c8a464] font-semibold'
                          : 'bg-white/5 text-[#e8e2d5] border-white/10'
                      }`}
                    >
                      {m.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-white/10">
                <span className="text-[#d8cfc0]">
                  {lang === 'ru'
                    ? 'Дискретный поворот (Snap Turn, без «плывущего» вращения):'
                    : 'Discrete Snap Turn Angle:'}
                </span>
                <div className="flex gap-2">
                  {([30, 45] as const).map((deg) => (
                    <button
                      key={deg}
                      onClick={() => hubPlayerState.setSnapTurnDegrees(deg)}
                      className={`px-3 py-1 font-mono rounded border ${
                        hubState.snapTurnDegrees === deg
                          ? 'bg-[#c8a464] text-[#0b0a09] border-[#c8a464]'
                          : 'bg-white/5 text-[#d8cfc0] border-white/10'
                      }`}
                    >
                      {deg}°
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-white/10">
                <span className="text-[#d8cfc0]">
                  {lang === 'ru'
                    ? 'Периферийная виньетка комфорта при движении:'
                    : 'Peripheral Comfort Vignette + Horizon Frame:'}
                </span>
                <button
                  onClick={() => hubPlayerState.toggleVignette()}
                  className="px-3 py-1 font-mono bg-white/10 rounded text-[#c8a464]"
                >
                  {hubState.vignetteEnabled ? 'ON' : 'OFF'}
                </button>
              </div>

              <div className="p-2.5 bg-black/50 rounded font-mono text-[11px] text-[#a89f91] flex justify-between">
                <span>FPS: {telemetry.fps} (Target ≥72)</span>
                <span>Draw Calls: {telemetry.drawCalls}/150</span>
                <span>Tris: {telemetry.triangles}</span>
              </div>
            </div>
          )}

          {activeOverlay === 'radio' && (
            <div className="space-y-3 text-xs">
              <div className="max-h-40 overflow-y-auto space-y-1.5 p-2.5 bg-black/50 rounded border border-white/10 font-mono">
                {(hubState.radioChannels[activeChannel] ?? []).map((m, i) => (
                  <div key={i} className="text-[#d8cfc0]">
                    <span className="text-[#c8a464]">
                      [{m.timestamp}] {m.author}:
                    </span>{' '}
                    {m.text}
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={radioDraft}
                  onChange={(e) => setRadioDraft(e.target.value)}
                  placeholder={
                    lang === 'ru'
                      ? 'Оставить наблюдение в канале...'
                      : 'Broadcast discovery to channel...'
                  }
                  className="flex-1 px-3 py-1.5 bg-black/60 border border-white/15 rounded text-xs text-[#f3ede2]"
                />
                <button
                  onClick={() => {
                    if (!radioDraft.trim()) return;
                    hubPlayerState.postRadioMessage(
                      activeChannel,
                      radioDraft.trim()
                    );
                    setRadioDraft('');
                  }}
                  className="px-3 py-1.5 bg-[#c8a464] text-[#0b0a09] font-semibold rounded"
                >
                  {lang === 'ru' ? 'Отправить' : 'Send'}
                </button>
              </div>
            </div>
          )}

          {activeOverlay === 'audio' && (
            <div className="space-y-3 text-xs">
              <p className="font-mono text-[#c8a464]">
                {spatialAudioSystem.getCurrentTrackLabel()}
              </p>
              <div className="flex items-center gap-3">
                <span className="text-[#a89f91]">Volume:</span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  defaultValue={spatialAudioSystem.getVolume()}
                  onChange={(e) =>
                    spatialAudioSystem.setVolume(parseFloat(e.target.value))
                  }
                  className="flex-1"
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Bottom-Right Dedicated Meta Quest 2 WebXR Button */}
      <div className="z-10 pointer-events-auto absolute bottom-5 right-5 flex items-center gap-2">
        <button
          onClick={async () => {
            const status = await webxrManager.toggleVRSession();
            setNotice({
              title: 'WebXR · Meta Quest 2',
              body: status.message,
            });
          }}
          className="px-4 py-2.5 text-xs font-semibold text-[#0b0a09] bg-[#c8a464] hover:bg-[#d6b475] rounded shadow-lg transition-colors whitespace-nowrap"
        >
          {xrActive
            ? lang === 'ru'
              ? 'Выйти из VR (Quest 2)'
              : 'Exit VR (Quest 2)'
            : lang === 'ru'
            ? 'Войти в VR (Meta Quest 2)'
            : 'Enter VR (Meta Quest 2)'}
        </button>
      </div>

      {/* Hovered Target or Floor Teleport Prompt */}
      {(hoveredTarget || hasFloorTeleportTarget) && (
        <div className="z-10 pointer-events-none absolute bottom-16 left-1/2 -translate-x-1/2 px-4 py-2 bg-black/75 backdrop-blur-md border border-[#c8a464]/40 rounded text-center">
          {hoveredTarget ? (
            <>
              <p className="text-xs font-semibold text-[#f3ede2]">
                [Click / E / VR Trigger]{' '}
                {lang === 'ru' ? hoveredTarget.titleRu : hoveredTarget.title}
              </p>
              <p className="text-xs text-[#a89f91] font-mono mt-0.5">
                {lang === 'ru'
                  ? hoveredTarget.subtitleRu
                  : hoveredTarget.subtitle}
              </p>
            </>
          ) : (
            <p className="text-xs font-mono text-[#c8a464]">
              {lang === 'ru'
                ? '[Клик / Курок VR] Телепорт в точку (с комфортным затуханием)'
                : '[Click / VR Trigger] Blink-Teleport to Floor Ring (Comfort Fade)'}
            </p>
          )}
        </div>
      )}

      {/* Toast Notice */}
      {notice && (
        <div className="z-20 pointer-events-auto absolute bottom-16 left-5 max-w-md p-4 bg-[#141210]/95 backdrop-blur-md border border-[#c8a464]/40 rounded space-y-1">
          <div className="flex items-center justify-between gap-4">
            <span className="text-xs font-semibold text-[#c8a464]">
              {notice.title}
            </span>
            <button
              onClick={() => setNotice(null)}
              className="text-xs text-[#9c9488] hover:text-white"
            >
              ×
            </button>
          </div>
          <p className="text-xs text-[#e8e2d5] leading-relaxed">
            {notice.body}
          </p>
        </div>
      )}

      {/* Bottom Controls Legend */}
      <div className="z-10 pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-1.5 bg-black/50 backdrop-blur-sm border border-white/10 rounded text-xs text-[#a89f91] font-mono whitespace-nowrap">
        {lang === 'ru'
          ? 'Телепорт: Клик/Курок в пол · Стики/WASD: Ходьба · Q/R/Стик: Snap-Поворот · Горячие клавиши: R, T, C, Alt, Z'
          : 'Teleport: Click/Trigger Floor · Sticks/WASD: Move · Q/R/Stick: Snap-Turn · Hotkeys: R, T, C, Alt, Z'}
      </div>
    </div>
  );
};
