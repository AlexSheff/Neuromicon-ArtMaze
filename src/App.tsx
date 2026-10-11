/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { webxrManager } from './engine/xr/webxrManager';
import { t } from './i18n/strings';
import { onboardingFSM } from './onboarding/onboardingFSM';
import { spatialAudioSystem } from './systems/audio/spatialAudioSystem';
import { hubPlayerState } from './state/playerState';
import { playerStateStore } from './systems/state/playerStateStore';
import { PlayerState, VoidType } from './types/artmaze';
import { LabyrinthViewport } from './ui/LabyrinthViewport';
import { RoomManifestsExplorer } from './ui/RoomManifestsExplorer';
import { RoomValidatorPanel } from './ui/RoomValidatorPanel';
import { TransformationProtocolPanel } from './ui/TransformationProtocolPanel';
import { WorldRegistryPanel } from './ui/WorldRegistryPanel';

type ActiveSection =
  | 'labyrinth'
  | 'protocol'
  | 'manifests'
  | 'registry'
  | 'validator';

export default function App() {
  const [hasEnteredWorld, setHasEnteredWorld] = useState<boolean>(false);
  const [vrSupported, setVrSupported] = useState<boolean>(false);
  const [activeSection, setActiveSection] =
    useState<ActiveSection>('labyrinth');
  const [playerState, setPlayerState] = useState<PlayerState>(() =>
    playerStateStore.getState()
  );

  useEffect(() => {
    void webxrManager.checkSupport().then((supported) => {
      setVrSupported(supported);
    });
    return playerStateStore.subscribe((next) => {
      setPlayerState(next);
    });
  }, []);

  /**
   * §2.1 Entry Sequence: Single user gesture that unlocks WebAudio, advances Onboarding FSM,
   * and (if VR button clicked) starts the immersive-vr WebXR session synchronously within user activation.
   */
  const handleEnterWorld = async (startVR: boolean) => {
    spatialAudioSystem.start();
    onboardingFSM.startFromEntryGesture();
    setHasEnteredWorld(true);
    if (startVR) {
      await webxrManager.toggleVRSession();
    }
  };

  const handleEnterRoom = (roomId: string) => {
    hubPlayerState.enterRoom(roomId);
    setActiveSection('labyrinth');
  };

  const handleEnterVoid = (voidType: VoidType) => {
    hubPlayerState.enterVoidFallback(`VOID_${voidType.toUpperCase()}`);
    setActiveSection('labyrinth');
  };

  return (
    <div className="min-h-screen bg-[#0b0a09] text-[#e8e2d5] flex flex-col relative">
      {/* §2.1 Minimal Pre-World Entry Screen (English-only: Title + Enter + conditional VR button) */}
      {!hasEnteredWorld && (
        <div className="fixed inset-0 z-50 bg-[#070605]/90 backdrop-blur-sm text-[#f3ede2] flex flex-col items-center justify-center px-6 select-none overflow-hidden">
          {/* Subtle vertical light line evoking the Threshold atrium */}
          <div className="pointer-events-none absolute inset-y-0 left-1/2 -translate-x-1/2 w-[1px] bg-gradient-to-b from-[#e5c158]/40 via-[#c8a464]/15 to-[#4ea8de]/40" />

          <div className="relative z-10 flex flex-col items-center text-center max-w-md">
            <h1 className="font-display text-2xl md:text-4xl font-semibold tracking-[0.28em] text-[#f3ede2] mb-10">
              {t('entry.title', 'en')}
            </h1>

            <div className="flex items-center gap-4">
              <button
                onClick={() => void handleEnterWorld(false)}
                className="px-10 py-3.5 rounded bg-[#c8a464] hover:bg-[#d6b475] text-[#0b0a09] font-display text-sm font-semibold tracking-[0.2em] uppercase transition-all shadow-[0_0_32px_rgba(200,164,100,0.28)] cursor-pointer"
              >
                {t('entry.enter', 'en')}
              </button>

              {vrSupported && (
                <button
                  onClick={() => void handleEnterWorld(true)}
                  className="px-5 py-3.5 rounded bg-white/5 hover:bg-white/10 border border-[#c8a464]/50 text-[#e5c158] font-mono text-xs font-semibold tracking-[0.18em] uppercase transition-colors cursor-pointer"
                >
                  {t('entry.vr', 'en')}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      {activeSection !== 'labyrinth' && (
        <header className="h-[54px] flex items-center justify-between px-6 border-b border-white/10 bg-[#0e0d0b] shrink-0">
          <button
            onClick={() => setActiveSection('labyrinth')}
            className="font-display text-sm font-semibold tracking-wider text-[#e5c158] hover:text-[#f3ede2]"
          >
            ← Return to Labyrinth
          </button>

          <nav className="flex items-center gap-5 text-xs font-mono text-[#a89f91]">
            <button
              onClick={() => setActiveSection('registry')}
              className={
                activeSection === 'registry' ? 'text-[#f3ede2]' : undefined
              }
            >
              World Graph
            </button>
            <button
              onClick={() => setActiveSection('manifests')}
              className={
                activeSection === 'manifests' ? 'text-[#f3ede2]' : undefined
              }
            >
              Room Bible
            </button>
            <button
              onClick={() => setActiveSection('validator')}
              className={
                activeSection === 'validator' ? 'text-[#f3ede2]' : undefined
              }
            >
              Validator
            </button>
            <button
              onClick={() => setActiveSection('protocol')}
              className={
                activeSection === 'protocol' ? 'text-[#f3ede2]' : undefined
              }
            >
              Protocol
            </button>
          </nav>

          <span className="px-2.5 py-1 text-xs font-mono text-[#d8cfc0] bg-white/5 border border-white/10 rounded">
            EN
          </span>
        </header>
      )}

      <main className="flex-1">
        {activeSection === 'labyrinth' && (
          <LabyrinthViewport
            lang="en"
            playerState={playerState}
            onOpenStudioSection={(sec) => setActiveSection(sec)}
          />
        )}
        {activeSection === 'protocol' && (
          <TransformationProtocolPanel
            lang="en"
            playerState={playerState}
            onEnterRoom={handleEnterRoom}
          />
        )}
        {activeSection === 'manifests' && (
          <RoomManifestsExplorer
            lang="en"
            currentRoomId={playerState.currentRoomId}
            onSelectRoom={handleEnterRoom}
          />
        )}
        {activeSection === 'registry' && (
          <WorldRegistryPanel
            lang="en"
            playerState={playerState}
            onTeleportToRoom={handleEnterRoom}
            onEnterVoid={handleEnterVoid}
          />
        )}
        {activeSection === 'validator' && (
          <RoomValidatorPanel
            lang="en"
            onEnterValidatedRoom={handleEnterRoom}
          />
        )}
      </main>
    </div>
  );
}
