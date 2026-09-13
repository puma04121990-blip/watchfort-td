export const TILE = 64;
export const COLS = 12;
export const ROWS = 10;
export const HUD_H = 88;
export const GAME_W = COLS * TILE;
export const GAME_H = ROWS * TILE + HUD_H;
export const TOTAL_WAVES = 3;

export const COLOR = {
  grass: 0x4a7c59,
  path: 0xc4a574,
  towerBlue: 0x3b82c4,
  cannon: 0xf97316,
  frost: 0x22d3ee,
  enemyRed: 0xd64545,
  gold: 0xe8b84a,
  panel: 0x111827,
  text: 0xf3f4f6,
  shade: 0x1f2933,
} as const;

export type TowerKind = 'arrow' | 'cannon' | 'frost';
export type EnemyKind = 'runner' | 'tank' | 'brute';

export interface TowerDef {
  kind: TowerKind;
  cost: number;
  damage: number;
  range: number;
  cooldown: number;
  splash: number;
  slowFactor: number;
  slowMs: number;
  projectileKey: string;
  projectileSpeed: number;
  texture: string;
}

export interface EnemyDef {
  kind: EnemyKind;
  hp: number;
  speed: number;
  gold: number;
  texture: string;
}

export const TOWERS: Record<TowerKind, TowerDef> = {
  arrow: {
    kind: 'arrow',
    cost: 50,
    damage: 12,
    range: 150,
    cooldown: 480,
    splash: 0,
    slowFactor: 1,
    slowMs: 0,
    projectileKey: 'projectile_arrow',
    projectileSpeed: 420,
    texture: 'tower_arrow',
  },
  cannon: {
    kind: 'cannon',
    cost: 80,
    damage: 22,
    range: 135,
    cooldown: 1100,
    splash: 70,
    slowFactor: 1,
    slowMs: 0,
    projectileKey: 'projectile_cannon',
    projectileSpeed: 300,
    texture: 'tower_cannon',
  },
  frost: {
    kind: 'frost',
    cost: 65,
    damage: 6,
    range: 155,
    cooldown: 700,
    splash: 0,
    slowFactor: 0.5,
    slowMs: 1600,
    projectileKey: 'projectile_frost',
    projectileSpeed: 360,
    texture: 'tower_frost',
  },
};

export const ENEMIES: Record<EnemyKind, EnemyDef> = {
  runner: { kind: 'runner', hp: 36, speed: 68, gold: 10, texture: 'enemy_runner' },
  tank: { kind: 'tank', hp: 95, speed: 44, gold: 16, texture: 'enemy_tank' },
  brute: { kind: 'brute', hp: 190, speed: 36, gold: 28, texture: 'enemy_brute' },
};

export interface WaveSpawn {
  kind: EnemyKind;
  count: number;
  interval: number;
  delay: number;
}

export const WAVES: WaveSpawn[][] = [
  [{ kind: 'runner', count: 8, interval: 750, delay: 200 }],
  [
    { kind: 'runner', count: 6, interval: 650, delay: 200 },
    { kind: 'tank', count: 3, interval: 1400, delay: 1800 },
  ],
  [
    { kind: 'runner', count: 8, interval: 550, delay: 200 },
    { kind: 'tank', count: 4, interval: 1100, delay: 1600 },
    { kind: 'brute', count: 2, interval: 2200, delay: 4200 },
  ],
];

export interface Cell {
  c: number;
  r: number;
}

/** Winding dirt path from the west spawn to the east gate. */
export const PATH: Cell[] = [
  { c: 0, r: 2 },
  { c: 1, r: 2 },
  { c: 2, r: 2 },
  { c: 3, r: 2 },
  { c: 3, r: 3 },
  { c: 3, r: 4 },
  { c: 3, r: 5 },
  { c: 4, r: 5 },
  { c: 5, r: 5 },
  { c: 6, r: 5 },
  { c: 7, r: 5 },
  { c: 7, r: 4 },
  { c: 7, r: 3 },
  { c: 7, r: 2 },
  { c: 7, r: 1 },
  { c: 8, r: 1 },
  { c: 9, r: 1 },
  { c: 10, r: 1 },
  { c: 10, r: 2 },
  { c: 10, r: 3 },
  { c: 10, r: 4 },
  { c: 10, r: 5 },
  { c: 10, r: 6 },
  { c: 10, r: 7 },
  { c: 9, r: 7 },
  { c: 8, r: 7 },
  { c: 7, r: 7 },
  { c: 6, r: 7 },
  { c: 6, r: 8 },
  { c: 7, r: 8 },
  { c: 8, r: 8 },
  { c: 9, r: 8 },
  { c: 10, r: 8 },
  { c: 11, r: 8 },
];

const PATH_SET = new Set(PATH.map((p) => `${p.c},${p.r}`));

export function isPath(c: number, r: number): boolean {
  return PATH_SET.has(`${c},${r}`);
}

export function cellCenter(c: number, r: number): { x: number; y: number } {
  return { x: c * TILE + TILE / 2, y: r * TILE + TILE / 2 };
}

export function isInGrid(c: number, r: number): boolean {
  return c >= 0 && r >= 0 && c < COLS && r < ROWS;
}

const ORTHO: Cell[] = [
  { c: 1, r: 0 },
  { c: -1, r: 0 },
  { c: 0, r: 1 },
  { c: 0, r: -1 },
];

export function isAdjacentToPath(c: number, r: number): boolean {
  for (const d of ORTHO) {
    if (isPath(c + d.c, r + d.r)) return true;
  }
  return false;
}

export function isPlaceableGrass(c: number, r: number): boolean {
  return isInGrid(c, r) && !isPath(c, r) && isAdjacentToPath(c, r);
}

export const GATE_CELL: Cell = PATH[PATH.length - 1] ?? { c: 11, r: 8 };
export const SPAWN_CELL: Cell = PATH[0] ?? { c: 0, r: 2 };
