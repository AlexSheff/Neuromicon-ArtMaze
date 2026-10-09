export type Locale = 'en' | 'ru';

export interface I18nEntry {
  en: string;
  ru: string;
  /** Required by EXPERIENCE_PROTOCOL.md §2.7: justification why space/light/sound alone cannot convey this */
  justification: string;
}

/**
 * Authoritative RU/EN string dictionary (EXPERIENCE_PROTOCOL.md §2.7).
 * Onboarding uses <= 3 strings in the first 2 minutes, each <= 12 words, preferring glyphs.
 */
export const I18N_STRINGS: Record<string, I18nEntry> = {
  // Entry Screen (§2.1)
  'entry.title': {
    en: 'NEUROMICON ARTMAZE',
    ru: 'NEUROMICON ARTMAZE',
    justification: 'Identifies the work on the minimal pre-world HTML entry gate (§2.1.1).',
  },
  'entry.enter': {
    en: 'Enter',
    ru: 'Войти',
    justification: 'Required browser user-gesture button to unlock WebAudio context (§2.1.1).',
  },
  'entry.vr': {
    en: 'VR',
    ru: 'VR',
    justification: 'Required browser user-gesture button to start WebXR immersive-vr session (§2.1.1).',
  },

  // Onboarding Beat Sheet (§2.2 & §2.7: <= 3 strings, <= 12 words, mythic tone)
  'onboarding.glyph.interact': {
    en: '◈',
    ru: '◈',
    justification: 'Single non-verbal glyph confirming interactive focus at LEARN_INTERACT (§2.2).',
  },
  'onboarding.hint.engraving': {
    en: 'Choose the way.',
    ru: 'Выбери путь.',
    justification: 'Rung 3 hint-ladder engraved stone inscription after 45s of inactivity (§2.6, §2.7).',
  },
  'onboarding.commit.memory': {
    en: 'It remembers you.',
    ru: 'Оно помнит тебя.',
    justification: 'Confirms persistent path commitment when entering the chosen branch (§2.7).',
  },

  // Audio Accessibility Captions (§2.8)
  'caption.drone_swell': {
    en: '[Low subterranean resonance swells below; faint harmonic shimmer above]',
    ru: '[Внизу нарастает глубокий гул; вверху мерцает высокий гармонический тон]',
    justification: 'Deaf/hard-of-hearing accessibility caption for vertical acoustic cues (§2.8).',
  },
  'caption.pedestal_hum': {
    en: '[The central stone monolith hums with a warm chord]',
    ru: '[Центральный каменный монолит отзывается тёплым аккордом]',
    justification: 'Accessibility caption for spatial interaction cue (§2.8).',
  },
  'caption.atrium_reveal': {
    en: '[Stone vaults part; looking up brightens the chord, looking down deepens the bass]',
    ru: '[Своды раскрываются: взгляд вверх осветляет звук, взгляд вниз углубляет бас]',
    justification: 'Accessibility caption for head-pitch audio crossfade (§2.2, §2.8).',
  },
  'caption.lift_hold': {
    en: '[Platform resonance rising — 3 seconds to commit]',
    ru: '[Резонанс платформы нарастает — 3 секунды до перехода]',
    justification: 'Accessibility caption for reversible 3s platform hold (§2.2, §2.8).',
  },

  // Contextual Discovery Glyphs & Codex Entries (§2.5)
  'codex.title': {
    en: 'CODEX · JOURNAL OF DISCOVERIES',
    ru: 'КОДЕКС · ЖУРНАЛ ОТКРЫТИЙ',
    justification: 'Titles the player-opened discovery journal replacing the old Rules overlay (§2.5).',
  },
  'codex.entry.threshold': {
    en: 'The Threshold splits vertically: Ascent embodies form; Descent explores the unseen.',
    ru: 'Порог разделён по вертикали: Восхождение воплощает форму, Нисхождение исследует сокрытое.',
    justification: 'Recorded in Codex after the player discovers both vertical paths (§2.5).',
  },
  'codex.entry.comfort_standing': {
    en: 'Posture attuned: Standing scale.',
    ru: 'Положение настроено: В полный рост.',
    justification: 'Confirms diegetic posture calibration in Codex (§2.4).',
  },
  'codex.entry.comfort_seated': {
    en: 'Posture attuned: Seated scale.',
    ru: 'Положение настроено: Сидячий режим.',
    justification: 'Confirms diegetic posture calibration in Codex (§2.4).',
  },
  'codex.entry.smooth_unlocked': {
    en: 'Locomotion attuned: Smooth glide unlocked after five threshold steps.',
    ru: 'Движение настроено: Плавный шаг открыт после пяти перемещений.',
    justification: 'Logs unlock of smooth movement switch after 5 teleports (§2.4).',
  },
  'codex.entry.rabbit_hole': {
    en: 'An object absent from the room endured inside the mirror, opening an unmarked threshold.',
    ru: 'Объект, отсутствующий в зале, сохранился в отражении зеркала и открыл незримый порог.',
    justification: 'Records discovery of a rule-violation Rabbit Hole in the Codex (§2.5).',
  },
  'codex.entry.void_fallback': {
    en: 'Where a room is not yet woven, the Void receives the traveler and offers a way back.',
    ru: 'Там, где комната ещё не соткана, Пустота принимает путника и хранит путь назад.',
    justification: 'Explains diegetic Void fallback when entering an unbuilt/timed-out node (§7.2).',
  },
};

export function t(key: string, locale: Locale = 'ru'): string {
  const entry = I18N_STRINGS[key];
  if (!entry) return '';
  return locale === 'ru' ? entry.ru : entry.en;
}
