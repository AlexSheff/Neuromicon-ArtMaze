/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { webxrManager } from './engine/xr/webxrManager';
import { hubPlayerState } from './state/playerState';
import { playerStateStore } from './systems/state/playerStateStore';
import { PlayerState, VoidType } from './types/artmaze';
import { LabyrinthViewport } from './ui/LabyrinthViewport';
import { RoomManifestsExplorer } from './ui/RoomManifestsExplorer';
import { RoomValidatorPanel } from './ui/RoomValidatorPanel';
import { TransformationProtocolPanel } from './ui/TransformationProtocolPanel';
import { WorldRegistryPanel } from './ui/WorldRegistryPanel';

type ActiveSection = 'labyrinth' | 'protocol' | 'manifests' | 'registry' | 'validator';

export default function App() {
  const [activeSection, setActiveSection] = useState<ActiveSection>('labyrinth');
  const [lang, setLang] = useState<'en' | 'ru'>('ru');
  const [playerState, setPlayerState] = useState<PlayerState>(() =>
    playerStateStore.getState()
  );
  const [xrBanner, setXrBanner] = useState<string | null>(null);

  useEffect(() => {
    return playerStateStore.subscribe((next) => {
      setPlayerState(next);
    });
  }, []);

  const handleToggleXR = async () => {
    const status = await webxrManager.toggleVRSession();
    setXrBanner(status.message);
    window.setTimeout(() => setXrBanner(null), 4000);
  };

  const handleEnterRoom = (roomId: string) => {
    playerStateStore.enterRoom(roomId);
    hubPlayerState.enterRoom(roomId);
    setActiveSection('labyrinth');
  };

  const handleEnterVoid = (voidType: VoidType) => {
    playerStateStore.enterVoid(voidType);
    setActiveSection('labyrinth');
  };

  return (
    <div className="min-h-screen bg-[#0b0a09] text-[#e8e2d5] flex flex-col">
      {/* Strict 3-Zone Top Bar Contract */}
      <header className="h-[61px] flex items-center justify-between px-6 border-b border-white/10 bg-[#0e0d0b] shrink-0">
        {/* Zone 1: Single text element wordmark */}
        <a
          href="#labyrinth"
          onClick={(e) => {
            e.preventDefault();
            setActiveSection('labyrinth');
          }}
          className="font-display text-lg font-semibold tracking-tight text-[#f3ede2] whitespace-nowrap"
        >
          Neuromicon ArtMaze
        </a>

        {/* Zone 2: 5 clean navigation links */}
        <nav className="flex items-center gap-6 text-xs md:text-sm font-medium text-[#a89f91]">
          <a
            href="#labyrinth"
            onClick={(e) => {
              e.preventDefault();
              setActiveSection('labyrinth');
            }}
            className={`transition-colors whitespace-nowrap py-1 ${
              activeSection === 'labyrinth'
                ? 'text-[#f3ede2] border-b border-[#c8a464]'
                : 'hover:text-[#f3ede2]'
            }`}
          >
            {lang === 'ru' ? 'Лабиринт 3D' : 'Labyrinth'}
          </a>
          <a
            href="#protocol"
            onClick={(e) => {
              e.preventDefault();
              setActiveSection('protocol');
            }}
            className={`transition-colors whitespace-nowrap py-1 ${
              activeSection === 'protocol'
                ? 'text-[#f3ede2] border-b border-[#c8a464]'
                : 'hover:text-[#f3ede2]'
            }`}
          >
            {lang === 'ru' ? 'Протокол & Документы' : 'Protocol & Docs'}
          </a>
          <a
            href="#manifests"
            onClick={(e) => {
              e.preventDefault();
              setActiveSection('manifests');
            }}
            className={`transition-colors whitespace-nowrap py-1 ${
              activeSection === 'manifests'
                ? 'text-[#f3ede2] border-b border-[#c8a464]'
                : 'hover:text-[#f3ede2]'
            }`}
          >
            {lang === 'ru' ? 'Room Bible' : 'Room Bible'}
          </a>
          <a
            href="#registry"
            onClick={(e) => {
              e.preventDefault();
              setActiveSection('registry');
            }}
            className={`transition-colors whitespace-nowrap py-1 ${
              activeSection === 'registry'
                ? 'text-[#f3ede2] border-b border-[#c8a464]'
                : 'hover:text-[#f3ede2]'
            }`}
          >
            {lang === 'ru' ? 'Реестр Мира' : 'World Registry'}
          </a>
          <a
            href="#validator"
            onClick={(e) => {
              e.preventDefault();
              setActiveSection('validator');
            }}
            className={`transition-colors whitespace-nowrap py-1 ${
              activeSection === 'validator'
                ? 'text-[#f3ede2] border-b border-[#c8a464]'
                : 'hover:text-[#f3ede2]'
            }`}
          >
            {lang === 'ru' ? 'Валидатор' : 'Room Validator'}
          </a>
        </nav>

        {/* Zone 3: 2 primary actions */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setLang((prev) => (prev === 'ru' ? 'en' : 'ru'))}
            className="px-3 py-1.5 text-xs font-mono text-[#d8cfc0] bg-white/5 hover:bg-white/10 border border-white/10 rounded transition-colors whitespace-nowrap shrink-0"
          >
            {lang === 'ru' ? 'RU / EN' : 'EN / RU'}
          </button>
          <button
            onClick={handleToggleXR}
            className="px-4 py-1.5 text-xs font-semibold text-[#0b0a09] bg-[#c8a464] hover:bg-[#d6b475] rounded transition-colors whitespace-nowrap shrink-0"
          >
            {lang === 'ru' ? 'WebXR (Quest 2)' : 'Enter WebXR'}
          </button>
        </div>
      </header>

      {xrBanner && (
        <div className="bg-[#1b1814] border-b border-[#c8a464]/30 px-6 py-2 text-xs text-[#e8e2d5] font-mono flex items-center justify-between">
          <span>{xrBanner}</span>
          <button
            onClick={() => setXrBanner(null)}
            className="text-[#a89f91] hover:text-white"
          >
            ×
          </button>
        </div>
      )}

      <main className="flex-1">
        {activeSection === 'labyrinth' && (
          <LabyrinthViewport lang={lang} playerState={playerState} />
        )}
        {activeSection === 'protocol' && (
          <TransformationProtocolPanel
            lang={lang}
            playerState={playerState}
            onEnterRoom={handleEnterRoom}
          />
        )}
        {activeSection === 'manifests' && (
          <RoomManifestsExplorer
            lang={lang}
            currentRoomId={playerState.currentRoomId}
            onSelectRoom={handleEnterRoom}
          />
        )}
        {activeSection === 'registry' && (
          <WorldRegistryPanel
            lang={lang}
            playerState={playerState}
            onTeleportToRoom={handleEnterRoom}
            onEnterVoid={handleEnterVoid}
          />
        )}
        {activeSection === 'validator' && (
          <RoomValidatorPanel
            lang={lang}
            onEnterValidatedRoom={handleEnterRoom}
          />
        )}
      </main>
    </div>
  );
}
