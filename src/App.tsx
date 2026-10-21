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
    <div className="fixed inset-0 w-screen h-screen overflow-hidden bg-[#0b0a09] text-[#e8e2d5] flex flex-col">
      {/* §2.1 Minimal Pre-World Entry Screen (English-only: Title + Enter + conditional VR button) */}
      {!hasEnteredWorld && (
        <div className="artmaze-entry fixed inset-0 z-50 text-[#f3ede2] select-none overflow-hidden">
          <div className="artmaze-entry__grid pointer-events-none absolute inset-0" />
          <div className="artmaze-entry__glow artmaze-entry__glow--gold pointer-events-none absolute" />
          <div className="artmaze-entry__glow artmaze-entry__glow--blue pointer-events-none absolute" />

          <div className="relative z-10 mx-auto flex min-h-full w-full max-w-[1440px] flex-col px-6 py-6 sm:px-10 sm:py-8 lg:px-16">
            <header className="flex items-center justify-between border-b border-white/10 pb-5">
              <div className="flex items-center gap-3">
                <span className="artmaze-entry__sigil grid size-10 place-items-center rounded-full border border-[#d8bd80]/45 text-lg text-[#e7d5a9]">◈</span>
                <div>
                  <div className="font-mono text-[11px] font-semibold tracking-[0.24em] text-[#f0e9dc]">NEUROMICON</div>
                  <div className="mt-1 font-mono text-[9px] tracking-[0.2em] text-[#a8a5a0]">SPATIAL ART EXPERIENCE</div>
                </div>
              </div>
              <div className="hidden items-center gap-2 font-mono text-[10px] tracking-[0.15em] text-[#b9c0cb] sm:flex">
                <span className="size-1.5 rounded-full bg-[#8bd7c4] shadow-[0_0_12px_#8bd7c4]" />
                DESKTOP <span className="text-white/25">/</span> WEBXR
              </div>
            </header>

            <div className="grid flex-1 items-center gap-12 py-12 lg:grid-cols-[minmax(0,1fr)_minmax(250px,390px)] lg:gap-16">
              <section className="max-w-3xl">
                <p className="mb-5 flex items-center gap-3 font-mono text-[10px] font-semibold tracking-[0.28em] text-[#d6bd88] sm:text-xs">
                  <span className="h-px w-8 bg-[#d6bd88]/70" />
                  A LABYRINTH OF ART, SPACE & SOUND
                </p>
                <h1 className="font-display text-[clamp(3.25rem,9vw,7.5rem)] font-medium leading-[0.88] tracking-[0.035em] text-[#f7f2e9]">
                  NEURO<span className="text-[#d8bd80]">MICON</span>
                  <span className="mt-3 block font-sans text-[0.24em] font-light tracking-[0.42em] text-[#b9c4d6] sm:text-[0.2em]">ARTMAZE</span>
                </h1>
                <p className="mt-8 max-w-xl text-base leading-7 text-[#c0c2c8] sm:text-lg sm:leading-8">
                  Step into a living gallery. Follow the music through distant nebulae, monumental rooms and artworks that change when you look away.
                </p>

                <div className="mt-9 flex flex-wrap items-center gap-3">
                  <button
                    onClick={() => void handleEnterWorld(false)}
                    className="group inline-flex min-h-14 items-center gap-8 rounded-full bg-[#dfc48b] px-7 font-mono text-xs font-bold tracking-[0.16em] text-[#11131a] shadow-[0_8px_40px_rgba(223,196,139,0.22)] transition hover:-translate-y-0.5 hover:bg-[#f0d9a6] hover:shadow-[0_12px_48px_rgba(223,196,139,0.3)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#dfc48b]"
                  >
                    {t('entry.enter', 'en').toUpperCase()}
                    <span aria-hidden="true" className="text-lg transition-transform group-hover:translate-x-1">↗</span>
                  </button>

                  {vrSupported && (
                    <button
                      onClick={() => void handleEnterWorld(true)}
                      className="inline-flex min-h-14 items-center gap-3 rounded-full border border-white/20 bg-white/[0.045] px-6 font-mono text-xs font-semibold tracking-[0.14em] text-[#e8e3da] transition hover:border-[#d8bd80]/60 hover:bg-white/[0.09] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#dfc48b]"
                    >
                      <span className="text-[#d8bd80]">◉</span>
                      ENTER IN {t('entry.vr', 'en').toUpperCase()}
                    </button>
                  )}
                </div>

                <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 font-mono text-[10px] tracking-[0.08em] text-[#aeb2bb]">
                  <span><kbd className="mr-1.5 rounded border border-white/20 px-1.5 py-0.5 text-[#eee7d8]">WASD</kbd> MOVE</span>
                  <span><kbd className="mr-1.5 rounded border border-white/20 px-1.5 py-0.5 text-[#eee7d8]">MOUSE</kbd> LOOK</span>
                  <span>GAMEPAD + HEADSET READY</span>
                </div>
              </section>

              <aside className="artmaze-entry__orbit relative mx-auto hidden aspect-square w-full max-w-[350px] lg:block" aria-label="A map of the three connected sectors">
                <div className="absolute inset-[8%] rounded-full border border-white/10" />
                <div className="absolute inset-[20%] rounded-full border border-[#d8bd80]/20" />
                <div className="absolute inset-[34%] rounded-full border border-[#91b9df]/20" />
                <div className="artmaze-entry__orbit-core absolute left-1/2 top-1/2 grid size-24 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-[#e5d3a5]/55 bg-[#11151d]/75 text-3xl text-[#ead8a8] shadow-[0_0_65px_rgba(140,165,201,0.2)]">◈</div>
                <span className="artmaze-entry__orbit-dot artmaze-entry__orbit-dot--one absolute left-[19%] top-[27%]" />
                <span className="artmaze-entry__orbit-dot artmaze-entry__orbit-dot--two absolute right-[16%] top-[37%]" />
                <span className="artmaze-entry__orbit-dot artmaze-entry__orbit-dot--three absolute bottom-[15%] left-[42%]" />
                <div className="absolute left-0 top-[23%] rounded-full border border-white/10 bg-[#11141a]/80 px-3 py-1.5 font-mono text-[9px] tracking-[0.16em] text-[#d7c89f]">ASCENT</div>
                <div className="absolute right-0 top-[35%] rounded-full border border-white/10 bg-[#11141a]/80 px-3 py-1.5 font-mono text-[9px] tracking-[0.16em] text-[#a7c9e5]">DEEP FIELD</div>
                <div className="absolute bottom-[10%] left-[32%] rounded-full border border-white/10 bg-[#11141a]/80 px-3 py-1.5 font-mono text-[9px] tracking-[0.16em] text-[#dbc2a1]">DESCENT</div>
                <div className="absolute inset-0 animate-[spin_48s_linear_infinite] rounded-full border border-dashed border-white/[0.08] motion-reduce:animate-none" />
              </aside>
            </div>

            <footer className="flex flex-col gap-4 border-t border-white/10 pt-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap gap-5 font-mono text-[9px] tracking-[0.12em] text-[#b0b2b8] sm:gap-8">
                <span><strong className="mr-2 text-[#e6d5ad]">1,149</strong>CONNECTED ROOMS</span>
                <span><strong className="mr-2 text-[#e6d5ad]">LIVE</strong>MUSIC-REACTIVE WORLDS</span>
                <span><strong className="mr-2 text-[#e6d5ad]">NASA</strong>DEEP-SPACE IMAGERY</span>
              </div>
              <span className="font-mono text-[9px] tracking-[0.16em] text-white/35">AN ATELIER FOR OTHER WORLDS</span>
            </footer>
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

      <main className="flex-1 relative w-full h-full overflow-hidden">
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
