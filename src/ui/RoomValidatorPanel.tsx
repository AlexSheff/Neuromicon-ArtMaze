import React, { useState } from 'react';
import {
  asTypedRoomManifest,
  validateRoomManifest,
  ValidationResult,
} from '../../tools/room-validator/validator';
import { runRepositoryValidationSuite } from '../../tests/room-validator.test';
import {
  getAllLoadedRoomManifests,
  loadRoomManifest,
  mountCustomRoomManifest,
} from '../world/loader/roomLoader';

interface RoomValidatorPanelProps {
  lang: 'en' | 'ru';
  onEnterValidatedRoom: (roomId: string) => void;
}

const SAMPLE_NEW_ROOM_TEMPLATE = JSON.stringify(
  {
    specVersion: '1.0',
    id: 'ROOM_0088',
    version: '1.0',
    title: 'The Chamber of Two Horizons',
    titleRu: 'Зал Двух Горизонтов',
    author: 'Alex',
    description: 'An independent room package created and validated via ROOM_SPEC v1.0.',
    descriptionRu: 'Независимый пакет комнаты, созданный и проверенный по ROOM_SPEC v1.0.',
    type: 'custom',
    environment: {
      scene: 'assets/models/room_0088.glb',
      scale: 1.0,
      dimensions: [15, 5.0, 15],
      palette: {
        wall: '#19171b',
        floor: '#100e12',
        ceiling: '#09080b',
        fog: '#0d0b10',
        accent: '#c8a464',
      },
      spawn: {
        position: [0, 1.7, 5.2],
        rotation: [0, 0, 0],
      },
    },
    rules: {
      entryAllowed: true,
      gravity: true,
      locomotion: 'standard',
      returnAllowed: true,
    },
    paintings: [
      {
        id: 'painting_088_1',
        image: 'assets/images/horizon_split.jpg',
        frame: 'classic_gold',
        position: [0, 2.1, -7.2],
        rotation: [0, 0, 0],
        scale: 1.3,
        metadata: {
          title: 'Bifurcated Perspective',
          author: 'Alex',
          license: 'CC-BY-4.0',
          source: 'ArtMaze-Room-0088',
          inscription: 'Where two horizons meet, neither is the ground.',
        },
        interaction: {
          type: 'discover',
          discovery: 'HORIZON_BIFURCATION',
        },
      },
    ],
    objects: [
      {
        id: 'obj_088_monolith',
        title: 'Split Meridian Stone',
        type: 'monolith',
        portable: false,
        position: [-1.8, 0, -1.5],
        interactions: ['inspect', 'observe'],
        discoveryId: 'HORIZON_BIFURCATION',
      },
    ],
    doors: [
      {
        id: 'A',
        label: 'A',
        subtitle: 'ROOM_0000 · Central Labyrinth',
        symbol: '←',
        destination: 'ROOM_0000',
        status: 'ready',
        position: [-4.5, 0, 4.2],
        rotation: [0, 1.5708, 0],
      },
      {
        id: 'B',
        label: 'B',
        subtitle: 'VOID · 3D Fractal',
        symbol: '∞',
        destination: null,
        status: 'void',
        position: [4.5, 0, 4.2],
        rotation: [0, -1.5708, 0],
        fallback: {
          type: 'fractal',
        },
      },
    ],
  },
  null,
  2
);

export const RoomValidatorPanel: React.FC<RoomValidatorPanelProps> = ({
  lang,
  onEnterValidatedRoom,
}) => {
  const [jsonInput, setJsonInput] = useState<string>(SAMPLE_NEW_ROOM_TEMPLATE);
  const [result, setResult] = useState<ValidationResult>(() =>
    validateRoomManifest(SAMPLE_NEW_ROOM_TEMPLATE)
  );
  const [mountStatus, setMountStatus] = useState<string | null>(null);
  const suiteSummary = runRepositoryValidationSuite();
  const loadedRooms = getAllLoadedRoomManifests();

  const handleValidate = (raw: string) => {
    setJsonInput(raw);
    setResult(validateRoomManifest(raw));
    setMountStatus(null);
  };

  const handleLoadExistingRoom = (roomId: string) => {
    const manifest = loadRoomManifest(roomId);
    if (!manifest) return;
    const formatted = JSON.stringify(manifest, null, 2);
    handleValidate(formatted);
  };

  const handleMountAndEnter = () => {
    const validation = validateRoomManifest(jsonInput);
    setResult(validation);
    if (!validation.valid) return;

    const parsed = asTypedRoomManifest(JSON.parse(jsonInput));
    const mounted = mountCustomRoomManifest(parsed);
    if (mounted.ok) {
      setMountStatus(
        lang === 'ru'
          ? `Комната ${parsed.id} зарегистрирована в мире и готова к входу.`
          : `Room ${parsed.id} mounted into world registry and ready.`
      );
      onEnterValidatedRoom(parsed.id);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <p className="text-xs text-[#a89f91]">
            ROOM_SPEC.md v1.0 · tools/room-validator · schema/room.schema.json
          </p>
          <h1 className="text-2xl md:text-3xl font-semibold text-[#f3ede2] mt-1">
            {lang === 'ru'
              ? 'Валидатор Пакетов Комнат (ROOM_SPEC v1.0)'
              : 'Standalone Room Package Validator (ROOM_SPEC v1.0)'}
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {loadedRooms.map((r) => (
            <button
              key={r.id}
              onClick={() => handleLoadExistingRoom(r.id)}
              className="px-3 py-1.5 text-xs font-mono tabular-nums text-[#d8cfc0] bg-[#171513] hover:bg-[#221f1c] border border-white/10 rounded transition-colors whitespace-nowrap"
            >
              {r.id}
            </button>
          ))}
          <button
            onClick={() => handleValidate(SAMPLE_NEW_ROOM_TEMPLATE)}
            className="px-3 py-1.5 text-xs font-medium text-[#c8a464] bg-[#1c1812] hover:bg-[#262017] border border-[#c8a464]/30 rounded transition-colors whitespace-nowrap"
          >
            {lang === 'ru' ? 'Шаблон ROOM_0088' : 'Template ROOM_0088'}
          </button>
        </div>
      </div>

      {/* Repository CI Suite Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pb-2 border-b border-white/10">
        {suiteSummary.results.map((item) => (
          <div key={item.id} className="p-4 bg-[#131210] border border-white/10 rounded">
            <div className="flex items-center justify-between text-xs font-mono tabular-nums">
              <span className="text-[#f3ede2] font-semibold">{item.id}</span>
              <span className={item.valid ? 'text-emerald-400' : 'text-rose-400'}>
                {item.valid ? 'VALID · PASS' : `${item.errorCount} ERRORS`}
              </span>
            </div>
            <p className="text-xs text-[#9c9488] mt-1">
              {item.id === 'ROOM_0000'
                ? 'main-maze/room.json'
                : `rooms/ArtMaze-${item.id.replace('_', '-')}/room.json`}
            </p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left: Manifest JSON Editor */}
        <div className="lg:col-span-7 space-y-3">
          <div className="flex items-center justify-between">
            <label
              htmlFor="room-manifest-editor"
              className="text-xs text-[#a89f91] font-mono"
            >
              room.json
            </label>
            <span className="text-xs text-[#9c9488]">
              {lang === 'ru'
                ? 'Никакого исполняемого JS или внешних секретов (§30–31)'
                : 'Declarative JSON only · No executable scripts (§30–31)'}
            </span>
          </div>
          <textarea
            id="room-manifest-editor"
            value={jsonInput}
            onChange={(e) => handleValidate(e.target.value)}
            rows={22}
            spellCheck={false}
            className="w-full p-4 bg-[#0f0e0c] text-[#e8e2d5] font-mono text-xs leading-relaxed border border-white/15 rounded focus:outline-none focus:border-[#c8a464] resize-y"
          />
        </div>

        {/* Right: Contract Validation Report */}
        <div className="lg:col-span-5 space-y-6">
          <div className="p-6 bg-[#141311] border border-white/10 rounded space-y-5">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <p className="text-xs text-[#9c9488]">
                  {lang === 'ru' ? 'Статус Контракта' : 'Contract Status'}
                </p>
                <h2 className="text-lg font-semibold text-[#f3ede2] font-mono tabular-nums mt-0.5">
                  {result.roomId || 'INVALID_ID'} · Spec {result.specVersion || '1.0'}
                </h2>
              </div>
              <span
                className={`text-xs font-mono font-semibold ${
                  result.valid ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {result.valid
                  ? lang === 'ru'
                    ? 'СООТВЕТСТВУЕТ ROOM_SPEC'
                    : 'COMPLIANT (PASS)'
                  : lang === 'ru'
                  ? 'ОШИБКА СХЕМЫ'
                  : 'CONTRACT VIOLATION'}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-4 text-xs font-mono tabular-nums">
              <div>
                <span className="text-[#9c9488] block">Doors</span>
                <span className="text-base text-[#f3ede2] font-semibold">
                  {result.summary.doorsCount}
                </span>
              </div>
              <div>
                <span className="text-[#9c9488] block">Paintings</span>
                <span className="text-base text-[#f3ede2] font-semibold">
                  {result.summary.paintingsCount}
                </span>
              </div>
              <div>
                <span className="text-[#9c9488] block">Objects</span>
                <span className="text-base text-[#f3ede2] font-semibold">
                  {result.summary.objectsCount}
                </span>
              </div>
              <div>
                <span className="text-[#9c9488] block">Rabbit Holes</span>
                <span className="text-base text-[#c8a464] font-semibold">
                  {result.summary.rabbitHolesCount}
                </span>
              </div>
              <div>
                <span className="text-[#9c9488] block">Mirror</span>
                <span className="text-base text-[#f3ede2] font-semibold">
                  {result.summary.hasMirror ? 'Yes' : 'No'}
                </span>
              </div>
              <div>
                <span className="text-[#9c9488] block">Quest</span>
                <span className="text-base text-[#f3ede2] font-semibold">
                  {result.summary.hasQuest ? 'Yes' : 'No'}
                </span>
              </div>
            </div>

            {result.errors.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-white/10">
                <p className="text-xs font-semibold text-rose-400">
                  {lang === 'ru' ? 'Ошибки Валидации' : 'Validation Errors'} (
                  {result.errors.length})
                </p>
                <ul className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {result.errors.map((err, i) => (
                    <li
                      key={i}
                      className="text-xs text-rose-200/90 font-mono border-l-2 border-rose-500 pl-3 py-1"
                    >
                      <span className="text-rose-400">{err.path}</span> ({err.rule}):{' '}
                      {err.message}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {result.warnings.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-white/10">
                <p className="text-xs font-semibold text-amber-400">
                  {lang === 'ru' ? 'Предупреждения' : 'Warnings'} ({result.warnings.length})
                </p>
                <ul className="space-y-1.5">
                  {result.warnings.map((w, i) => (
                    <li
                      key={i}
                      className="text-xs text-amber-200/90 font-mono border-l-2 border-amber-500 pl-3 py-0.5"
                    >
                      {w.path}: {w.message}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {mountStatus && (
              <p className="text-xs text-emerald-400 font-mono">{mountStatus}</p>
            )}

            <div className="pt-2">
              <button
                onClick={handleMountAndEnter}
                disabled={!result.valid}
                className={`w-full py-2.5 px-4 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                  result.valid
                    ? 'bg-[#c8a464] text-[#0b0a09] hover:bg-[#d6b475] cursor-pointer font-semibold'
                    : 'bg-white/5 text-white/30 cursor-not-allowed'
                }`}
              >
                {lang === 'ru'
                  ? 'Зарегистрировать в Реестре и Войти в 3D Комнату'
                  : 'Mount Room into Registry & Enter in 3D Engine'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
