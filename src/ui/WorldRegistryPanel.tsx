import React from 'react';
import { PlayerState, VoidType } from '../types/artmaze';
import { getWorldGraph } from '../world/graph/worldGraph';
import { loadRoomManifest } from '../world/loader/roomLoader';
import { getRoomRegistry } from '../world/registry/roomRegistry';
import { VOID_DESCRIPTORS } from '../world/void/voidSystem';

interface WorldRegistryPanelProps {
  lang: 'en' | 'ru';
  playerState: PlayerState;
  onTeleportToRoom: (roomId: string) => void;
  onEnterVoid: (voidType: VoidType) => void;
}

export const WorldRegistryPanel: React.FC<WorldRegistryPanelProps> = ({
  lang,
  playerState,
  onTeleportToRoom,
  onEnterVoid,
}) => {
  const registry = getRoomRegistry();
  const graph = getWorldGraph();
  const entries = Object.values(registry.rooms);

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-10">
      <div className="border-b border-white/10 pb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <p className="text-xs text-[#a89f91] font-mono tabular-nums">
            registry/rooms.json · registry/world.graph.json · Scale Constant:{' '}
            {registry.worldScaleConstant}
          </p>
          <h1 className="text-2xl md:text-3xl font-semibold text-[#f3ede2] mt-1">
            {lang === 'ru'
              ? 'Реестр Мира и Направленный Граф Пространств'
              : 'Canonical Room Registry & Directed World Graph'}
          </h1>
        </div>
        <p className="text-xs text-[#9c9488] max-w-md">
          {lang === 'ru'
            ? 'Физическая топология ≠ логическая топология ≠ состояние игрока. Ребро A → B не означает существования пути B → A.'
            : 'Physical topology ≠ logical topology ≠ player state. A directed edge A → B does not imply a return path B → A.'}
        </p>
      </div>

      {/* Room Registry Table */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-[#f3ede2]">
          {lang === 'ru' ? '01. Зарегистрированные Репозитории Комнат' : '01. Registered Room Repositories'}
        </h2>
        <div className="overflow-x-auto border border-white/10 rounded bg-[#12110f]">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-white/10 text-[#9c9488] font-mono">
                <th className="py-3 px-4">Room ID</th>
                <th className="py-3 px-4">{lang === 'ru' ? 'Название' : 'Title'}</th>
                <th className="py-3 px-4">{lang === 'ru' ? 'Тип / Источник' : 'Type / Repository'}</th>
                <th className="py-3 px-4">{lang === 'ru' ? 'Статус' : 'Status'}</th>
                <th className="py-3 px-4 text-right">{lang === 'ru' ? 'Визиты' : 'Visits'}</th>
                <th className="py-3 px-4 text-right">{lang === 'ru' ? 'Действие' : 'Action'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 font-mono tabular-nums">
              {entries.map((entry) => {
                const isLoaded = Boolean(loadRoomManifest(entry.id));
                const visits = playerState.roomStates[entry.id]?.visitCount ?? 0;
                return (
                  <tr key={entry.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-3.5 px-4 font-semibold text-[#f3ede2]">{entry.id}</td>
                    <td className="py-3.5 px-4 font-sans text-[#e8e2d5]">
                      {lang === 'ru' ? entry.titleRu || entry.title : entry.title}
                    </td>
                    <td className="py-3.5 px-4 text-[#9c9488]">
                      {entry.type} · {entry.repository || entry.manifestPath || 'local'}
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={
                          entry.status === 'ready'
                            ? 'text-emerald-400'
                            : 'text-amber-400/90'
                        }
                      >
                        {entry.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right text-[#d8cfc0]">{visits}</td>
                    <td className="py-3.5 px-4 text-right">
                      {isLoaded ? (
                        <button
                          onClick={() => onTeleportToRoom(entry.id)}
                          className="px-3 py-1 text-xs font-sans font-medium text-[#0b0a09] bg-[#c8a464] hover:bg-[#d6b475] rounded transition-colors whitespace-nowrap"
                        >
                          {lang === 'ru' ? 'Войти в Комнату' : 'Enter Room'}
                        </button>
                      ) : (
                        <button
                          onClick={() => onEnterVoid('infinity')}
                          className="px-3 py-1 text-xs font-sans font-medium text-[#d8cfc0] bg-white/5 hover:bg-white/10 border border-white/10 rounded transition-colors whitespace-nowrap"
                        >
                          {lang === 'ru' ? 'Открыть Пустоту' : 'Fallback Void'}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Directed Topology Graph Edges */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-[#f3ede2]">
          {lang === 'ru'
            ? '02. Направленные Переходы и Кроличьи Норы (world.graph.json)'
            : '02. Directed Transitions & Rabbit Holes (world.graph.json)'}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {graph.edges.map((edge, idx) => (
            <div
              key={`${edge.from}-${edge.doorId}-${idx}`}
              className="p-4 bg-[#141311] border border-white/10 rounded space-y-2"
            >
              <div className="flex items-center justify-between text-xs font-mono tabular-nums">
                <span className="text-[#f3ede2] font-semibold">
                  {edge.from} · Door {edge.doorId}
                </span>
                <span className="text-[#c8a464]">
                  {edge.to ? `→ ${edge.to}` : `→ VOID (${edge.voidFallback || 'infinity'})`}
                </span>
              </div>
              <p className="text-xs text-[#9c9488] font-mono">
                status: {edge.status} · directed: {String(edge.directed)}
                {edge.condition ? ` · req: ${edge.condition}` : ''}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* First-Class Void System Catalog */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-[#f3ede2]">
          {lang === 'ru'
            ? '03. Система Пустоты Первого Класса (ROOM_SPEC §13 / Plan §8)'
            : '03. First-Class Void System (ROOM_SPEC §13 / Plan §8)'}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Object.values(VOID_DESCRIPTORS).map((v) => (
            <div
              key={v.type}
              className="p-4 bg-[#131210] border border-white/10 rounded flex flex-col justify-between gap-4"
            >
              <div>
                <p className="text-xs font-mono text-[#c8a464]">VOID · {v.type.toUpperCase()}</p>
                <h3 className="text-base font-semibold text-[#f3ede2] mt-1">
                  {lang === 'ru' ? v.titleRu : v.title}
                </h3>
                <p className="text-xs text-[#9c9488] mt-1.5 leading-relaxed">
                  {lang === 'ru' ? v.subtitleRu : v.subtitle}
                </p>
              </div>
              <button
                onClick={() => onEnterVoid(v.type)}
                className="w-full py-2 px-3 text-xs font-medium text-[#e8e2d5] bg-white/5 hover:bg-white/10 border border-white/10 rounded transition-colors whitespace-nowrap"
              >
                {lang === 'ru' ? `Войти в ${v.type}` : `Preview ${v.type} Void`}
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
