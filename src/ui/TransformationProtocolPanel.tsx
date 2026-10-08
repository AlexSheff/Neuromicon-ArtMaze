import React, { useState } from 'react';
import { computeCognitiveProfile } from '../systems/measurement/protocolMeasurementSystem';
import { playerStateStore } from '../systems/state/playerStateStore';
import { PlayerState } from '../types/artmaze';
import { getAllLoadedRoomManifests } from '../world/loader/roomLoader';

interface TransformationProtocolPanelProps {
  lang: 'en' | 'ru';
  playerState: PlayerState;
  onEnterRoom: (roomId: string) => void;
}

type DocTab =
  | 'overview'
  | 'doc1_cognitive'
  | 'doc2_protocol'
  | 'doc3_lore'
  | 'doc4_mechanics'
  | 'doc5_measurement'
  | 'doc6_room_bible';

const STAGES_LIST = [
  { num: 'I', code: 'ENTRY', ru: 'Вход (Baseline)', room: 'ROOM_0000' },
  { num: 'II', code: 'SEPARATION', ru: 'Отделение', room: 'ROOM_0000' },
  { num: 'III', code: 'FIRST CHOICE', ru: 'Первый выбор (A / B / C / RH)', room: 'ROOM_0000' },
  { num: 'IV', code: 'DISORIENTATION', ru: 'Слом привычного алгоритма', room: 'ROOM_0001' },
  { num: 'V', code: 'MIRROR', ru: 'Зеркало Идентичности', room: 'ROOM_0107' },
  { num: 'VI', code: 'TRIAL', ru: 'Испытание действием', room: 'ROOM_0107' },
  { num: 'VII', code: 'GROUP', ru: 'Коллективный интеллект (A/B/C/D)', room: 'ROOM_0204' },
  { num: 'VIII', code: 'TRUST / CONFLICT', ru: 'Доверие и расхождение интересов', room: 'ROOM_0204' },
  { num: 'IX', code: 'RABBIT HOLE', ru: 'Скрытый слой в каждой комнате', room: 'ROOM_0042' },
  { num: 'X', code: 'SYSTEM BREAK', ru: 'Обнаружение правил лабиринта', room: 'ROOM_0404' },
  { num: 'XI', code: 'CREATOR ROOM', ru: 'Игрок → Дизайнер', room: 'ROOM_0404' },
  { num: 'XII', code: 'META MIRROR', ru: 'Второе зеркало (История решений)', room: 'ROOM_0999' },
  { num: 'XIII', code: 'DEATH / RESET', ru: 'Новый эксперимент идентичности', room: 'ROOM_0999' },
  { num: 'XIV', code: 'INITIATION', ru: 'Посвящение (Статус)', room: 'ROOM_0999' },
  { num: 'XV', code: 'RETURN / PROFILE', ru: 'Игровой профиль поведения', room: 'ROOM_0999' },
  { num: 'XVI', code: 'THE LAST DOOR', ru: 'Последняя дверь → Начало', room: 'ROOM_0999' },
];

export const TransformationProtocolPanel: React.FC<TransformationProtocolPanelProps> = ({
  lang,
  playerState,
  onEnterRoom,
}) => {
  const [activeDoc, setActiveDoc] = useState<DocTab>('overview');
  const profile = computeCognitiveProfile(playerState);
  const rooms = getAllLoadedRoomManifests();

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
      <div className="border-b border-white/10 pb-6 flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-mono text-[#a89f91]">
            docs/01..06 · 16-Stage Transformation Protocol · Cycle {playerState.cycleCount}
          </p>
          <h1 className="text-2xl md:text-3xl font-semibold text-[#f3ede2] mt-1">
            {lang === 'ru'
              ? 'Протокол Трансформации и Архитектура 5 Документов + Room Bible'
              : 'Transformation Protocol, 5 Core Documents & Room Bible'}
          </h1>
        </div>

        {/* Document Switcher (Segmented functional controls) */}
        <div className="flex flex-wrap items-center gap-1 p-1 bg-[#141311] border border-white/10 rounded">
          {[
            { id: 'overview', label: lang === 'ru' ? 'Профиль & 16 Этапов' : 'Profile & 16 Stages' },
            { id: 'doc1_cognitive', label: '01. Cognitive Spec' },
            { id: 'doc2_protocol', label: '02. Protocol' },
            { id: 'doc3_lore', label: '03. World & Lore' },
            { id: 'doc4_mechanics', label: '04. Mechanics' },
            { id: 'doc5_measurement', label: '05. Measurement' },
            { id: 'doc6_room_bible', label: '06. Room Bible' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveDoc(tab.id as DocTab)}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                activeDoc === tab.id
                  ? 'bg-[#c8a464] text-[#0b0a09] font-semibold'
                  : 'text-[#a89f91] hover:text-[#f3ede2]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeDoc === 'overview' && (
        <div className="space-y-10">
          {/* Live Meta-Mirror & Personal Cognitive Profile (Stages XII, XIV, XV) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Left: Stage XII Meta-Mirror & Stage XIV Initiation */}
            <div className="lg:col-span-6 p-6 bg-[#141311] border border-white/10 rounded space-y-5 flex flex-col justify-between">
              <div className="space-y-4">
                <div className="border-b border-white/10 pb-3">
                  <p className="text-xs font-mono text-[#c8a464]">
                    XII. META MIRROR · XIV. INITIATION · CYCLE {playerState.cycleCount}
                  </p>
                  <h2 className="text-xl font-semibold text-[#f3ede2] mt-1">
                    {lang === 'ru' ? profile.initiationTitleRu : profile.initiationTitleEn}
                  </h2>
                </div>

                <div className="space-y-2 font-mono text-xs text-[#e8e2d5] bg-[#0e0d0b] p-4 border border-white/10 rounded">
                  {(lang === 'ru'
                    ? profile.metaMirrorLinesRu
                    : profile.metaMirrorLinesEn
                  ).map((line, i) => (
                    <div key={i} className="py-0.5">
                      {line}
                    </div>
                  ))}
                </div>

                {playerState.createdArtifacts.length > 0 && (
                  <div className="space-y-1.5 pt-2">
                    <p className="text-xs text-[#a89f91]">
                      {lang === 'ru'
                        ? 'Созданные правила (XI. Creator Room):'
                        : 'Created Rules & Artifacts (XI. Creator Room):'}
                    </p>
                    {playerState.createdArtifacts.map((art) => (
                      <div
                        key={art.id}
                        className="text-xs font-mono text-[#c8a464] border-l-2 border-[#c8a464] pl-3 py-0.5"
                      >
                        [{art.roomId} · Cycle {art.cycle}] {art.ruleText}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-white/10 flex flex-wrap items-center justify-between gap-3">
                <span className="text-xs italic text-[#a89f91]">
                  {lang === 'ru'
                    ? '«Это действительно был лабиринт?»'
                    : '"Was this truly a labyrinth?"'}
                </span>
                <button
                  onClick={() => {
                    playerStateStore.startNewIdentityCycle();
                    onEnterRoom('ROOM_0000');
                  }}
                  className="px-3.5 py-2 text-xs font-semibold text-[#0b0a09] bg-[#c8a464] hover:bg-[#d6b475] rounded transition-colors whitespace-nowrap"
                >
                  {lang === 'ru'
                    ? 'XIII. Начать Новый Цикл (New Identity Experiment)'
                    : 'XIII. Start New Identity Cycle (Replay Experiment)'}
                </button>
              </div>
            </div>

            {/* Right: Stage XV Personal Cognitive Profile */}
            <div className="lg:col-span-6 p-6 bg-[#141311] border border-white/10 rounded space-y-5">
              <div className="border-b border-white/10 pb-3 flex items-center justify-between">
                <div>
                  <p className="text-xs font-mono text-[#a89f91]">
                    XV. RETURN — PERSONAL COGNITIVE PROFILE
                  </p>
                  <h2 className="text-xl font-semibold text-[#f3ede2] mt-1">
                    {lang === 'ru'
                      ? 'Игровой Профиль Поведения в ArtMaze'
                      : 'Behavioral Profile Inside ArtMaze'}
                  </h2>
                </div>
                <span className="text-xs font-mono text-[#9c9488]">
                  {lang === 'ru' ? 'Не диагноз · Локально' : 'Non-diagnostic · Local-first'}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="p-3.5 bg-[#0e0d0b] border border-white/10 rounded">
                  <span className="text-[#9c9488] font-mono block">PRIMARY MODE</span>
                  <span className="text-sm font-semibold text-[#f3ede2] mt-1 block">
                    {lang === 'ru' ? profile.primaryModeRu : profile.primaryModeEn}
                  </span>
                </div>
                <div className="p-3.5 bg-[#0e0d0b] border border-white/10 rounded">
                  <span className="text-[#9c9488] font-mono block">SECONDARY MODE</span>
                  <span className="text-sm font-semibold text-[#f3ede2] mt-1 block">
                    {lang === 'ru' ? profile.secondaryModeRu : profile.secondaryModeEn}
                  </span>
                </div>
                <div className="p-3.5 bg-[#0e0d0b] border border-white/10 rounded">
                  <span className="text-[#9c9488] font-mono block">SOCIAL MODE</span>
                  <span className="text-sm font-semibold text-[#f3ede2] mt-1 block">
                    {lang === 'ru' ? profile.socialModeRu : profile.socialModeEn}
                  </span>
                </div>
                <div className="p-3.5 bg-[#0e0d0b] border border-white/10 rounded">
                  <span className="text-[#9c9488] font-mono block">RISK PROFILE</span>
                  <span className="text-sm font-semibold text-[#f3ede2] mt-1 block">
                    {lang === 'ru' ? profile.riskProfileRu : profile.riskProfileEn}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 pt-2 font-mono tabular-nums">
                <div className="p-3 bg-[#0e0d0b] border border-white/10 rounded">
                  <span className="text-xs text-[#9c9488] block">DISCOVERY INDEX</span>
                  <span className="text-xl font-semibold text-[#c8a464] mt-0.5 block">
                    {profile.discoveryIndex}
                  </span>
                </div>
                <div className="p-3 bg-[#0e0d0b] border border-white/10 rounded">
                  <span className="text-xs text-[#9c9488] block">SYSTEM AWARENESS</span>
                  <span className="text-xl font-semibold text-[#c8a464] mt-0.5 block">
                    {profile.systemAwareness}
                  </span>
                </div>
                <div className="p-3 bg-[#0e0d0b] border border-white/10 rounded">
                  <span className="text-xs text-[#9c9488] block">ADAPTATION</span>
                  <span className="text-xl font-semibold text-[#c8a464] mt-0.5 block">
                    {profile.adaptationIndex}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 16 Stages Interactive Map */}
          <section className="space-y-4">
            <h2 className="text-lg font-semibold text-[#f3ede2]">
              {lang === 'ru'
                ? 'Архитектура 16 Этапов Протокола Трансформации (I – XVI)'
                : '16-Stage Transformation Protocol Architecture (I – XVI)'}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              {STAGES_LIST.map((st) => {
                const isVisited = playerState.visitedRooms.includes(st.room);
                return (
                  <div
                    key={st.num}
                    className="p-4 bg-[#131210] border border-white/10 rounded flex flex-col justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-center justify-between text-xs font-mono tabular-nums">
                        <span className="text-[#c8a464] font-semibold">
                          {st.num}. {st.code}
                        </span>
                        <span className={isVisited ? 'text-emerald-400' : 'text-[#9c9488]'}>
                          {st.room}
                        </span>
                      </div>
                      <p className="text-xs text-[#e8e2d5] mt-1.5">{st.ru}</p>
                    </div>
                    <button
                      onClick={() => onEnterRoom(st.room)}
                      className="w-full py-1.5 px-3 text-xs font-medium text-[#d8cfc0] bg-white/5 hover:bg-white/10 border border-white/10 rounded transition-colors whitespace-nowrap"
                    >
                      {lang === 'ru' ? `Перейти в ${st.room}` : `Enter ${st.room}`}
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      )}

      {activeDoc === 'doc1_cognitive' && (
        <section className="p-6 bg-[#141311] border border-white/10 rounded space-y-6">
          <div>
            <p className="text-xs font-mono text-[#c8a464]">docs/01_COGNITIVE_SPECIFICATION.md</p>
            <h2 className="text-2xl font-semibold text-[#f3ede2] mt-1">
              01. Cognitive Specification — Design Target
            </h2>
            <p className="text-sm text-[#c2b9aa] mt-2 max-w-3xl">
              {lang === 'ru'
                ? 'Сначала определяется не сюжет, а целевой набор когнитивных свойств участника. Сюжет — внешний слой; изменение способа мышления — внутренний.'
                : 'Defines the target cognitive properties rather than a linear plot. The narrative is the outer vessel; shifting the participant’s relationship to observation and model-building is the inner core.'}
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            {[
              { title: '1. Самостоятельность / Autonomy', desc: 'Способность действовать без ожидания внешней инструкции и выходить за рамки навязанных бинарных выборов.' },
              { title: '2. Любопытство / Curiosity', desc: 'Исследование неочевидных объектов, надписей, теней и отражений без гарантированной награды.' },
              { title: '3. Альтернативное видение / Alternatives', desc: 'Обнаружение скрытого 4-го пути (Rabbit Hole) там, где предложены очевидные двери A / B / C.' },
              { title: '4. Терпимость к неопределённости / Uncertainty', desc: 'Спокойное исследование пространств Void (fractal, infinity, starfield) без потери субъектности.' },
              { title: '5. Системное мышление / Systems Thinking', desc: 'Понимание того, что комнаты связаны направленным графом и реагируют на прошлые решения.' },
              { title: '6. Сотрудничество / Asymmetric Collaboration', desc: 'Объединение частичных перспектив (Пространство + Звук + Правило + Механизм) в ROOM_0204.' },
              { title: '7. Изменение точки зрения / Model Revision', desc: 'Отказ от привычного алгоритма, когда комната меняет правила (ROOM_0001, ROOM_0042).' },
              { title: '8. Созидание / Player → Designer', desc: 'Создание собственных правил и комнат вместо поиска «правильного ответа» (ROOM_0404).' },
              { title: '9. Ответственность за выбор / Responsibility', desc: 'Подтверждение выбранной в Зеркале идентичности реальным действием в испытании (Identity → Action → Consequence).' },
            ].map((item, idx) => (
              <div key={idx} className="p-4 bg-[#0e0d0b] border border-white/10 rounded space-y-1.5">
                <h3 className="font-semibold text-[#f3ede2]">{item.title}</h3>
                <p className="text-[#9c9488] leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {activeDoc === 'doc2_protocol' && (
        <section className="p-6 bg-[#141311] border border-white/10 rounded space-y-6">
          <div>
            <p className="text-xs font-mono text-[#c8a464]">docs/02_TRANSFORMATION_PROTOCOL.md</p>
            <h2 className="text-2xl font-semibold text-[#f3ede2] mt-1">
              02. Transformation Protocol (Stages I – XVI)
            </h2>
          </div>
          <div className="space-y-3 text-xs font-mono">
            {STAGES_LIST.map((s) => (
              <div
                key={s.num}
                className="p-3.5 bg-[#0e0d0b] border border-white/10 rounded flex flex-col sm:flex-row sm:items-center justify-between gap-2"
              >
                <div>
                  <span className="text-[#c8a464] font-semibold">
                    STAGE {s.num} · {s.code}
                  </span>{' '}
                  — <span className="font-sans text-[#e8e2d5]">{s.ru}</span>
                </div>
                <button
                  onClick={() => onEnterRoom(s.room)}
                  className="text-xs text-[#c8a464] hover:underline self-start sm:self-auto"
                >
                  → {s.room}
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {activeDoc === 'doc3_lore' && (
        <section className="p-6 bg-[#141311] border border-white/10 rounded space-y-5">
          <p className="text-xs font-mono text-[#c8a464]">docs/03_WORLD_AND_LORE.md</p>
          <h2 className="text-2xl font-semibold text-[#f3ede2]">
            03. World & Lore — Why the 1149 Manifold Exists
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm text-[#c2b9aa] leading-relaxed">
            <div className="space-y-3">
              <h3 className="text-base font-semibold text-[#f3ede2]">
                Константа 1149 и Архитектура Восприятия
              </h3>
              <p>
                ArtMaze — это не место, а инструмент наблюдения за тем, как человек конструирует реальность, когда она отказывается объяснять себя сама. Число 1149 задаёт масштаб разнообразия локальных реальностей, чтобы ни одна механическая стратегия не могла оптимизировать весь мир.
              </p>
            </div>
            <div className="space-y-3">
              <h3 className="text-base font-semibold text-[#f3ede2]">
                Почему физические объекты остаются в комнатах
              </h3>
              <p>
                В ArtMaze нет инвентаря для предметов (`portable: false`). Между комнатами перемещаются только открытия (`discoveries`), изменения идентичности (`identity`), принятые решения и память о предыдущих циклах (`cycleCount`).
              </p>
            </div>
          </div>
        </section>
      )}

      {activeDoc === 'doc4_mechanics' && (
        <section className="p-6 bg-[#141311] border border-white/10 rounded space-y-5">
          <p className="text-xs font-mono text-[#c8a464]">docs/04_GAME_MECHANICS.md</p>
          <h2 className="text-2xl font-semibold text-[#f3ede2]">
            04. Game Mechanics — Doors, Mirrors, Trials, Rabbit Holes & Creator Room
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-[#c2b9aa]">
            <div className="p-4 bg-[#0e0d0b] border border-white/10 rounded space-y-1.5">
              <h3 className="text-sm font-semibold text-[#f3ede2]">
                Двери как диагностическое окно (A / B / C / Hidden Path)
              </h3>
              <p>
                Никакой вариант не объявляется «правильным». Очевидные варианты проверяют следование инструкции, исследование или готовность шагнуть в неизвестность (Void), а 4-й путь (Rabbit Hole) открывается только через наблюдение аномалии в самой комнате.
              </p>
            </div>
            <div className="p-4 bg-[#0e0d0b] border border-white/10 rounded space-y-1.5">
              <h3 className="text-sm font-semibold text-[#f3ede2]">
                Три уровня Зеркал (Entry · Identity · Meta-Mirror)
              </h3>
              <p>
                Первое зеркало в ROOM_0000 фиксирует ожидание на входе; Зеркало Идентичности в ROOM_0107 требует доказать выбранную роль действием; Мета-Зеркало в ROOM_0999 отражает историю решений за весь путь.
              </p>
            </div>
            <div className="p-4 bg-[#0e0d0b] border border-white/10 rounded space-y-1.5">
              <h3 className="text-sm font-semibold text-[#f3ede2]">
                Асимметричная группа и Доверие (ROOM_0204)
              </h3>
              <p>
                Информация разделена между четырьмя точками восприятия (Пространство, Звук, Правило, Механизм), а выход ставит перед выбором: личная выгода, помощь группе, соглашение или поиск третьего системного решения.
              </p>
            </div>
            <div className="p-4 bg-[#0e0d0b] border border-white/10 rounded space-y-1.5">
              <h3 className="text-sm font-semibold text-[#f3ede2]">
                Переход Игрок → Дизайнер (ROOM_0404)
              </h3>
              <p>
                Участник создаёт собственное правило или монтирует новую комнату (`room.json`), воздействуя на саму систему лабиринта.
              </p>
            </div>
          </div>
        </section>
      )}

      {activeDoc === 'doc5_measurement' && (
        <section className="p-6 bg-[#141311] border border-white/10 rounded space-y-5">
          <p className="text-xs font-mono text-[#c8a464]">docs/05_MEASUREMENT_SYSTEM.md</p>
          <h2 className="text-2xl font-semibold text-[#f3ede2]">
            05. Measurement System — Live Behavioral Counters
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 font-mono tabular-nums text-xs">
            <div className="p-4 bg-[#0e0d0b] border border-white/10 rounded">
              <span className="text-[#9c9488] block">uncertaintyAvoided</span>
              <span className="text-lg font-semibold text-[#f3ede2]">
                {playerState.metrics.uncertaintyAvoided}
              </span>
            </div>
            <div className="p-4 bg-[#0e0d0b] border border-white/10 rounded">
              <span className="text-[#9c9488] block">uncertaintyEmbraced</span>
              <span className="text-lg font-semibold text-[#f3ede2]">
                {playerState.metrics.uncertaintyEmbraced}
              </span>
            </div>
            <div className="p-4 bg-[#0e0d0b] border border-white/10 rounded">
              <span className="text-[#9c9488] block">hiddenPathsSearched</span>
              <span className="text-lg font-semibold text-[#c8a464]">
                {playerState.metrics.hiddenPathsSearched}
              </span>
            </div>
            <div className="p-4 bg-[#0e0d0b] border border-white/10 rounded">
              <span className="text-[#9c9488] block">strangersTrusted</span>
              <span className="text-lg font-semibold text-[#f3ede2]">
                {playerState.metrics.strangersTrusted}
              </span>
            </div>
            <div className="p-4 bg-[#0e0d0b] border border-white/10 rounded">
              <span className="text-[#9c9488] block">strategyChanges</span>
              <span className="text-lg font-semibold text-[#f3ede2]">
                {playerState.metrics.strategyChanges}
              </span>
            </div>
            <div className="p-4 bg-[#0e0d0b] border border-white/10 rounded">
              <span className="text-[#9c9488] block">pathsCreated</span>
              <span className="text-lg font-semibold text-[#c8a464]">
                {playerState.metrics.pathsCreated}
              </span>
            </div>
            <div className="p-4 bg-[#0e0d0b] border border-white/10 rounded">
              <span className="text-[#9c9488] block">reflectionChecks</span>
              <span className="text-lg font-semibold text-[#f3ede2]">
                {playerState.metrics.reflectionChecks}
              </span>
            </div>
            <div className="p-4 bg-[#0e0d0b] border border-white/10 rounded">
              <span className="text-[#9c9488] block">cycleCount</span>
              <span className="text-lg font-semibold text-[#c8a464]">
                {playerState.cycleCount}
              </span>
            </div>
          </div>
        </section>
      )}

      {activeDoc === 'doc6_room_bible' && (
        <section className="space-y-4">
          <div className="p-6 bg-[#141311] border border-white/10 rounded space-y-4">
            <p className="text-xs font-mono text-[#c8a464]">docs/06_ROOM_BIBLE.md</p>
            <h2 className="text-2xl font-semibold text-[#f3ede2]">
              06. Room Bible — Complete Catalog of Protocol Rooms
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-white/10 text-[#9c9488] font-mono">
                    <th className="py-3 px-3">Room ID</th>
                    <th className="py-3 px-3">Protocol Stage</th>
                    <th className="py-3 px-3">Title & Purpose</th>
                    <th className="py-3 px-3">Hidden Layer / Rabbit Hole</th>
                    <th className="py-3 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {rooms.map((r) => {
                    const rhDoor = r.doors.find(
                      (d) => d.type === 'rabbit-hole' || d.id === 'RH' || d.id === 'OMEGA'
                    );
                    return (
                      <tr key={r.id} className="hover:bg-white/[0.02]">
                        <td className="py-3.5 px-3 font-mono font-semibold text-[#f3ede2]">
                          {r.id}
                        </td>
                        <td className="py-3.5 px-3 font-mono text-[#c8a464]">
                          {r.protocolStage || 'CUSTOM'}
                        </td>
                        <td className="py-3.5 px-3">
                          <div className="font-semibold text-[#f3ede2]">
                            {lang === 'ru' ? r.titleRu || r.title : r.title}
                          </div>
                          <div className="text-[#9c9488] mt-0.5 max-w-md">
                            {lang === 'ru'
                              ? r.descriptionRu || r.description
                              : r.description}
                          </div>
                        </td>
                        <td className="py-3.5 px-3 font-mono text-[#d8cfc0]">
                          {rhDoor
                            ? `${rhDoor.id} → ${rhDoor.destination || 'VOID'} (${
                                rhDoor.requirement
                                  ? `${rhDoor.requirement.type}:${rhDoor.requirement.id}`
                                  : 'Cycle Loop'
                              })`
                            : 'None'}
                        </td>
                        <td className="py-3.5 px-3 text-right">
                          <button
                            onClick={() => onEnterRoom(r.id)}
                            className="px-3 py-1.5 text-xs font-semibold text-[#0b0a09] bg-[#c8a464] hover:bg-[#d6b475] rounded transition-colors whitespace-nowrap"
                          >
                            {lang === 'ru' ? 'Войти в 3D' : 'Enter in 3D'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}
    </div>
  );
};
