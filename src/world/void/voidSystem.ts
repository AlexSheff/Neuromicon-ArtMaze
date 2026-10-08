import { VoidType } from '../../types/artmaze';

export interface VoidDescriptor {
  type: VoidType;
  title: string;
  titleRu: string;
  subtitle: string;
  subtitleRu: string;
  atmosphereColor: string;
  accentColor: string;
}

export const VOID_DESCRIPTORS: Record<VoidType, VoidDescriptor> = {
  infinity: {
    type: 'infinity',
    title: 'Infinity Horizon',
    titleRu: 'Горизонт Бесконечности',
    subtitle: 'An unbuilt room resolves into endless architectural colonnades.',
    subtitleRu: 'Непостроенная комната раскрывается бесконечной колоннадой.',
    atmosphereColor: '#0e1116',
    accentColor: '#c8a464',
  },
  fractal: {
    type: 'fractal',
    title: '3D Fractal Manifold',
    titleRu: 'Трёхмерное Фрактальное Многообразие',
    subtitle: 'Self-similar recursive geometry unfolding without a floor or ceiling.',
    subtitleRu: 'Самоподобная рекурсивная геометрия без пола и потолка.',
    atmosphereColor: '#090b10',
    accentColor: '#7da2c4',
  },
  fog: {
    type: 'fog',
    title: 'Dense Liminal Fog',
    titleRu: 'Густой Пограничный Туман',
    subtitle: 'Light scatters without edges; distance loses metric meaning.',
    subtitleRu: 'Свет рассеивается без границ; расстояние теряет меру.',
    atmosphereColor: '#1a1c1e',
    accentColor: '#9ea7b0',
  },
  darkness: {
    type: 'darkness',
    title: 'Absolute Darkness',
    titleRu: 'Абсолютная Темнота',
    subtitle: 'Only faint acoustic resonance and distant horizon markers remain.',
    subtitleRu: 'Остаётся лишь тихий акустический резонанс и далёкий контур.',
    atmosphereColor: '#030304',
    accentColor: '#524b42',
  },
  starfield: {
    type: 'starfield',
    title: 'Deep Astral Void',
    titleRu: 'Глубокое Звёздное Поле',
    subtitle: 'A silent vault of parallax stars beyond the labyrinth walls.',
    subtitleRu: 'Безмолвный свод параллаксных звёзд за пределами стен лабиринта.',
    atmosphereColor: '#05070c',
    accentColor: '#d4af37',
  },
  mirror: {
    type: 'mirror',
    title: 'Infinite Mirror Space',
    titleRu: 'Бесконечное Зазеркалье',
    subtitle: 'Every step reflects across an unbroken obsidian horizon.',
    subtitleRu: 'Каждый шаг отражается в непрерывном обсидиановом горизонте.',
    atmosphereColor: '#0a0f14',
    accentColor: '#8eb4d4',
  },
  unknown: {
    type: 'unknown',
    title: 'Unclassified Threshold (1149)',
    titleRu: 'Неклассифицированный Порог (1149)',
    subtitle: 'The world is larger than the currently available model.',
    subtitleRu: 'Мир больше, чем доступная в настоящий момент модель.',
    atmosphereColor: '#0d0b12',
    accentColor: '#c49a6c',
  },
};

export function getVoidDescriptor(type: VoidType): VoidDescriptor {
  return VOID_DESCRIPTORS[type] ?? VOID_DESCRIPTORS.unknown;
}
