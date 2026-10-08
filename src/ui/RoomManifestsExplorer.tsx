import React from 'react';
import { getAllLoadedRoomManifests } from '../world/loader/roomLoader';

interface RoomManifestsExplorerProps {
  lang: 'en' | 'ru';
  currentRoomId: string;
  onSelectRoom: (roomId: string) => void;
}

export const RoomManifestsExplorer: React.FC<RoomManifestsExplorerProps> = ({
  lang,
  currentRoomId,
  onSelectRoom,
}) => {
  const manifests = getAllLoadedRoomManifests();

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
      <div className="border-b border-white/10 pb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <p className="text-xs text-[#a89f91] font-mono">
            docs/06_ROOM_BIBLE.md · ONE ROOM = ONE REPOSITORY · ROOM_SPEC v1.0
          </p>
          <h1 className="text-2xl md:text-3xl font-semibold text-[#f3ede2] mt-1">
            {lang === 'ru'
              ? 'Room Bible — Полный Каталог Комнат Протокола'
              : 'Room Bible — Complete Catalog of Protocol Rooms'}
          </h1>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {manifests.map((room) => {
          const isCurrent = room.id === currentRoomId;
          return (
            <article
              key={room.id}
              className="p-6 bg-[#141311] border border-white/10 rounded flex flex-col justify-between gap-6"
            >
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-mono tabular-nums text-[#c8a464]">
                      {room.id} · {room.protocolStage || `Spec ${room.specVersion || '1.0'}`}
                    </p>
                    <h2 className="text-xl font-semibold text-[#f3ede2] mt-1">
                      {lang === 'ru' ? room.titleRu || room.title : room.title}
                    </h2>
                  </div>
                  <button
                    onClick={() => onSelectRoom(room.id)}
                    className={`px-4 py-2 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
                      isCurrent
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : 'bg-[#c8a464] text-[#0b0a09] hover:bg-[#d6b475] font-semibold'
                    }`}
                  >
                    {isCurrent
                      ? lang === 'ru'
                        ? 'Активна в 3D'
                        : 'Active in 3D'
                      : lang === 'ru'
                      ? 'Войти в 3D'
                      : 'Enter in 3D'}
                  </button>
                </div>

                <p className="text-sm text-[#c2b9aa] leading-relaxed">
                  {lang === 'ru'
                    ? room.descriptionRu || room.description
                    : room.description}
                </p>

                {room.quest && (
                  <div className="p-3 bg-[#0e0d0b] border border-white/10 rounded text-xs space-y-1">
                    <span className="font-mono text-[#a89f91] block">
                      {lang === 'ru' ? 'Задача / Вопрос комнаты:' : 'Room Proposition / Quest:'}
                    </span>
                    <span className="text-[#e8e2d5] italic block">
                      «{lang === 'ru' ? room.quest.questionRu || room.quest.question : room.quest.question}»
                    </span>
                  </div>
                )}

                <div className="text-xs text-[#9c9488] font-mono space-y-1 pt-2 border-t border-white/10">
                  <div>
                    Rules: entryAllowed={String(room.rules?.entryAllowed ?? true)} ·
                    returnAllowed={String(room.rules?.returnAllowed ?? true)} · locomotion=
                    {room.rules?.locomotion || 'standard'}
                  </div>
                  <div>
                    Content: {room.doors.length} Doors · {(room.paintings ?? []).length}{' '}
                    Paintings · {(room.objects ?? []).length} Objects · Mirror:{' '}
                    {room.mirror
                      ? `${room.mirror.characterState} (${room.mirror.mode || 'identity'})`
                      : 'none'}
                  </div>
                </div>

                {/* Doors & Hidden Layers list */}
                <div className="space-y-1.5 pt-2">
                  <p className="text-xs font-semibold text-[#d8cfc0]">
                    {lang === 'ru'
                      ? 'Возможные исходы, двери и скрытый слой (Rabbit Hole):'
                      : 'Outcomes, Doors & Hidden Layer (Rabbit Hole):'}
                  </p>
                  {room.doors.map((d) => (
                    <div
                      key={d.id}
                      className="text-xs font-mono text-[#a89f91] flex items-center justify-between border-b border-white/5 pb-1"
                    >
                      <span>
                        Door {d.id} ({d.status}
                        {d.visibility === 'hidden' ? ' · hidden rabbit-hole' : ''}
                        {d.requirement ? ` · req:${d.requirement.id}` : ''})
                      </span>
                      <span className="text-[#e8e2d5]">
                        {d.destination
                          ? `→ ${d.destination}`
                          : `→ VOID (${d.fallback?.type || 'infinity'})`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
};
