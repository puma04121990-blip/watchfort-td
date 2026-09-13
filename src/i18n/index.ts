export type Locale = 'ru' | 'en';

type Dict = Record<string, string>;

const ru: Dict = {
  'menu.title': 'Сторожевой форт',
  'menu.subtitle': 'Watchfort',
  'menu.play': 'Играть',
  'menu.loading': 'Загрузка…',
  'play.gold': 'Золото',
  'play.gate': 'Ворота',
  'play.wave': 'Волна',
  'play.startWave': 'Старт волны',
  'play.waiting': 'Стройка',
  'play.win': 'Форт устоял!',
  'play.fail': 'Ворота пали…',
  'play.tapMenu': 'Нажмите, чтобы в меню',
  'play.hint': 'Ставьте башни на траву у дороги',
  'tower.arrow': 'Стрелы',
  'tower.cannon': 'Пушка',
  'tower.frost': 'Иней',
};

const en: Dict = {
  'menu.title': 'Watchfort',
  'menu.subtitle': 'Сторожевой форт',
  'menu.play': 'Play',
  'menu.loading': 'Loading…',
  'play.gold': 'Gold',
  'play.gate': 'Gate',
  'play.wave': 'Wave',
  'play.startWave': 'Start Wave',
  'play.waiting': 'Build',
  'play.win': 'The fort holds!',
  'play.fail': 'The gate has fallen…',
  'play.tapMenu': 'Tap to return to menu',
  'play.hint': 'Place towers on grass next to the path',
  'tower.arrow': 'Arrow',
  'tower.cannon': 'Cannon',
  'tower.frost': 'Frost',
};

const catalogs: Record<Locale, Dict> = { ru, en };

let locale: Locale = 'ru';

export function setLocale(next: Locale): void {
  locale = next;
}

export function getLocale(): Locale {
  return locale;
}

export function t(key: string, vars?: Record<string, string | number>): string {
  const dict = catalogs[locale] ?? catalogs.ru;
  let s = dict[key] ?? catalogs.en[key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      s = s.replace(`{${k}}`, String(v));
    }
  }
  return s;
}
