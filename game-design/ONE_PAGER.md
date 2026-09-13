# Watchfort — Tower Defense one-pager

**Рабочее имя:** Watchfort / Сторожевой форт  
**Площадки:** GamePush → Яндекс.Игры, VK Games, CrazyGames  
**Движок:** Phaser 4 · TypeScript · Vite  
**Камера:** top-down, лёгкий «три четверти» у башен (ноги на сетке)  
**Стиль:** stylized 2D casual (не пиксель)  
**Длина попытки:** 2–4 минуты на волновую карту  

## Фантазия
Ты комендант маленького форта на тропе набегов. Враги идут по одной дороге к воротам. Ставишь башни на клетки у дороги, апгрейдишь, пережишь волны — звезда за жизни / скорость / без апгрейда за деньги.

## Цикл попытки
1. Меню → выбор карты (сначала 1 карта)  
2. Фаза стройки 8–12 сек (или «старт волны»)  
3. Волна идёт по path; золото с киллов  
4. Между волнами — короткая стройка  
5. Win: все волны + ворота > 0 HP → `hook_level_complete`  
6. Fail: HP ворот = 0 → `hook_level_fail` → retry  

## Win / Fail
- **Win:** N волн очищены, ворота живы  
- **Fail:** враг дошёл, HP кончились  
- 3★: без пропущенных / за время / только 2 типа башен (упростим до: жизни 100% / ≥50% / победа)

## Башни (P0 — 4 типа)
| ID | Роль | Цвет | Особенность |
|---|---|---|---|
| `tower_arrow` | DPS | `#3B82C4` | дёшево, быстро |
| `tower_cannon` | splash | `#F97316` | медленно, АОЕ |
| `tower_frost` | slow | `#22D3EE` / `#8B5CF6` | мало урона, −speed |
| `tower_barracks` | block | `#3D9B6E` | юнит на path (позже P1; в P0 заглушка или skip) |

P0 можно стартовать с **3 башнями** (arrow/cannon/frost), barracks — P1.

## Враги (P0)
`enemy_runner` · `enemy_tank` · `enemy_swarm` (пачка мелких) · босс волны 5 `enemy_brute`

## Монетизация (не бесит)
- **Interstitial:** только после complete/fail, перед меню карт — не в середине волны  
- **Rewarded:** «×2 золото за волну» или «продолжить с 1 HP ворот» — награда **только после success**  
- **Sticky:** вне playfield (снизу/сверху), safe area  
- Preloader при старте сессии, если available  

## Сейв (cloud < 1 МБ)
```ts
{
  saveVersion: 1,
  coins: number,
  unlockedMaps: string[],
  towerLevels: Record<string, number>, // meta-upgrade
  settings: { lang: 'ru'|'en', sfx: bool, music: bool }
}
```
`gp.player.set` + `sync()` после complete / purchase / reward.

## Почему зайдёт на площадках
Короткая сессия, понятный фейл, апгрейд между забегами, реклама на стыках, один клиент через GamePush.
