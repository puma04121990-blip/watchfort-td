export type Locale = 'ru' | 'en';

type Dict = Record<string, string>;

const ru: Dict = {
  'menu.title': 'Сторожевой форт',
  'menu.subtitle': 'Watchfort',
  'menu.play': 'Играть',
  'menu.loading': 'Загрузка…',
  'menu.map1': 'Тропа',
  'menu.map2': 'Ущелье',
  'menu.map3': 'Мост',
  'menu.locked': 'Закрыто',
  'menu.stars': '★ {n}',
  'menu.metaGold': 'Мета: {n}',
  'menu.upStartGold': 'Старт. золото +20',
  'menu.upArrowDmg': 'Урон стрел +3',
  'menu.upCannonDmg': 'Урон пушки +4',
  'menu.buy': 'Купить',
  'menu.maxed': 'Макс.',
  'play.gold': 'Золото',
  'play.gate': 'Ворота',
  'play.wave': 'Волна',
  'play.startWave': 'Старт волны',
  'play.waiting': 'Стройка',
  'play.win': 'Форт устоял!',
  'play.fail': 'Ворота пали…',
  'play.tapMenu': 'Нажмите, чтобы в меню',
  'play.retry': 'Заново',
  'play.menu': 'Меню',
  'play.continue': 'Продолжить',
  'play.continueHint': 'Реклама: восстановить ворота (+1 HP)',
  'play.hint': 'Ставьте башни на траву у дороги',
  'play.upgrade': 'Улучшить',
  'play.sell': 'Продать',
  'play.maxLevel': 'Макс. ур.',
  'play.pause': 'Пауза',
  'play.resume': 'Продолжить',
  'play.doubleMeta': '×2 мета',
  'play.metaGain': '+{n} мета',
  'tower.arrow': 'Стрелы',
  'tower.cannon': 'Пушка',
  'tower.frost': 'Иней',
  'tower.barracks': 'Казарма',
};

const en: Dict = {
  'menu.title': 'Watchfort',
  'menu.subtitle': 'Сторожевой форт',
  'menu.play': 'Play',
  'menu.loading': 'Loading…',
  'menu.map1': 'Path',
  'menu.map2': 'Gorge',
  'menu.map3': 'Bridge',
  'menu.locked': 'Locked',
  'menu.stars': '★ {n}',
  'menu.metaGold': 'Meta: {n}',
  'menu.upStartGold': 'Start gold +20',
  'menu.upArrowDmg': 'Arrow dmg +3',
  'menu.upCannonDmg': 'Cannon dmg +4',
  'menu.buy': 'Buy',
  'menu.maxed': 'Max',
  'play.gold': 'Gold',
  'play.gate': 'Gate',
  'play.wave': 'Wave',
  'play.startWave': 'Start Wave',
  'play.waiting': 'Build',
  'play.win': 'The fort holds!',
  'play.fail': 'The gate has fallen…',
  'play.tapMenu': 'Tap to return to menu',
  'play.retry': 'Retry',
  'play.menu': 'Menu',
  'play.continue': 'Continue',
  'play.continueHint': 'Watch an ad to restore gate (+1 HP)',
  'play.hint': 'Place towers on grass next to the path',
  'play.upgrade': 'Upgrade',
  'play.sell': 'Sell',
  'play.maxLevel': 'Max level',
  'play.pause': 'Pause',
  'play.resume': 'Resume',
  'play.doubleMeta': '×2 meta',
  'play.metaGain': '+{n} meta',
  'tower.arrow': 'Arrow',
  'tower.cannon': 'Cannon',
  'tower.frost': 'Frost',
  'tower.barracks': 'Barracks',
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
