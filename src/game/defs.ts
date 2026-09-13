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
  barracks: 0x3d9b6e,
  enemyRed: 0xd64545,
  gold: 0xe8b84a,
  panel: 0x111827,
  text: 0xf3f4f6,
  shade: 0x1f2933,
} as const;

export type TowerKind = 'arrow' | 'cannon' | 'frost' | 'barracks';
export type EnemyKind = 'runner' | 'tank' | 'brute' | 'swarm';

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
  /** Barracks blocker HP; unused (0) on projectile towers. */
  soldierHp: number;
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
    soldierHp: 0,
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
    soldierHp: 0,
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
    soldierHp: 0,
  },
  barracks: {
    kind: 'barracks',
    cost: 90,
    damage: 18,
    range: 90,
    cooldown: 2200,
    splash: 0,
    slowFactor: 1,
    slowMs: 0,
    projectileKey: 'projectile_arrow',
    projectileSpeed: 0,
    texture: 'tower_barracks',
    soldierHp: 50,
  },
};

export const ENEMIES: Record<EnemyKind, EnemyDef> = {
  runner: { kind: 'runner', hp: 36, speed: 68, gold: 10, texture: 'enemy_runner' },
  tank: { kind: 'tank', hp: 95, speed: 44, gold: 16, texture: 'enemy_tank' },
  brute: { kind: 'brute', hp: 190, speed: 36, gold: 28, texture: 'enemy_brute' },
  swarm: { kind: 'swarm', hp: 18, speed: 96, gold: 5, texture: 'enemy_swarm' },
};

export interface WaveSpawn {
  kind: EnemyKind;
  count: number;
  interval: number;
  delay: number;
}

export interface Cell {
  c: number;
  r: number;
}

export interface MapDef {
  id: string;
  path: Cell[];
  gate: Cell;
  waves: WaveSpawn[][];
}

/** Winding dirt path from the west spawn to the east gate. */
const PATH_MAP01: Cell[] = [
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

const WAVES_MAP01: WaveSpawn[][] = [
  [{ kind: 'runner', count: 8, interval: 750, delay: 200 }],
  [
    { kind: 'runner', count: 6, interval: 650, delay: 200 },
    { kind: 'swarm', count: 6, interval: 320, delay: 900 },
    { kind: 'tank', count: 3, interval: 1400, delay: 1800 },
  ],
  [
    { kind: 'runner', count: 8, interval: 550, delay: 200 },
    { kind: 'swarm', count: 8, interval: 280, delay: 400 },
    { kind: 'tank', count: 4, interval: 1100, delay: 1600 },
    { kind: 'brute', count: 2, interval: 2200, delay: 4200 },
  ],
];

/** North spawn → winding gorge → south gate. */
const PATH_MAP02: Cell[] = [
  { c: 5, r: 0 },
  { c: 5, r: 1 },
  { c: 5, r: 2 },
  { c: 4, r: 2 },
  { c: 3, r: 2 },
  { c: 2, r: 2 },
  { c: 1, r: 2 },
  { c: 1, r: 3 },
  { c: 1, r: 4 },
  { c: 1, r: 5 },
  { c: 2, r: 5 },
  { c: 3, r: 5 },
  { c: 4, r: 5 },
  { c: 5, r: 5 },
  { c: 6, r: 5 },
  { c: 7, r: 5 },
  { c: 8, r: 5 },
  { c: 8, r: 4 },
  { c: 8, r: 3 },
  { c: 8, r: 2 },
  { c: 9, r: 2 },
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
  { c: 5, r: 7 },
  { c: 4, r: 7 },
  { c: 3, r: 7 },
  { c: 3, r: 8 },
  { c: 3, r: 9 },
];

/** Slightly harder: more tanks/brutes. */
const WAVES_MAP02: WaveSpawn[][] = [
  [
    { kind: 'runner', count: 8, interval: 700, delay: 200 },
    { kind: 'swarm', count: 6, interval: 300, delay: 600 },
    { kind: 'tank', count: 2, interval: 1400, delay: 2200 },
  ],
  [
    { kind: 'runner', count: 8, interval: 600, delay: 200 },
    { kind: 'swarm', count: 8, interval: 260, delay: 400 },
    { kind: 'tank', count: 5, interval: 1200, delay: 1400 },
    { kind: 'brute', count: 1, interval: 2000, delay: 5000 },
  ],
  [
    { kind: 'runner', count: 10, interval: 500, delay: 200 },
    { kind: 'swarm', count: 10, interval: 240, delay: 300 },
    { kind: 'tank', count: 6, interval: 1000, delay: 1200 },
    { kind: 'brute', count: 3, interval: 2000, delay: 3800 },
  ],
];


/** West spawn → bridge zigzags → east gate (not map01/02). */
const PATH_MAP03: Cell[] = [
  { c: 0, r: 4 },
  { c: 1, r: 4 },
  { c: 2, r: 4 },
  { c: 2, r: 5 },
  { c: 2, r: 6 },
  { c: 3, r: 6 },
  { c: 4, r: 6 },
  { c: 5, r: 6 },
  { c: 5, r: 5 },
  { c: 5, r: 4 },
  { c: 5, r: 3 },
  { c: 6, r: 3 },
  { c: 7, r: 3 },
  { c: 8, r: 3 },
  { c: 8, r: 4 },
  { c: 8, r: 5 },
  { c: 8, r: 6 },
  { c: 8, r: 7 },
  { c: 9, r: 7 },
  { c: 10, r: 7 },
  { c: 10, r: 6 },
  { c: 10, r: 5 },
  { c: 10, r: 4 },
  { c: 10, r: 3 },
  { c: 11, r: 3 },
];

/** Harder: dense swarm packs, tanks, brute finale. Still 3 waves. */
const WAVES_MAP03: WaveSpawn[][] = [
  [
    { kind: 'runner', count: 10, interval: 600, delay: 200 },
    { kind: 'swarm', count: 12, interval: 250, delay: 400 },
    { kind: 'tank', count: 3, interval: 1300, delay: 2000 },
  ],
  [
    { kind: 'runner', count: 10, interval: 520, delay: 200 },
    { kind: 'swarm', count: 14, interval: 210, delay: 300 },
    { kind: 'tank', count: 6, interval: 1000, delay: 1100 },
    { kind: 'brute', count: 2, interval: 1800, delay: 4500 },
  ],
  [
    { kind: 'swarm', count: 18, interval: 180, delay: 100 },
    { kind: 'runner', count: 12, interval: 450, delay: 200 },
    { kind: 'tank', count: 8, interval: 850, delay: 900 },
    { kind: 'brute', count: 4, interval: 1500, delay: 3000 },
  ],
];


/** East spawn → trench ditches → south-west gate (not map01–03). */
const PATH_MAP04: Cell[] = [
  { c: 11, r: 3 },
  { c: 10, r: 3 },
  { c: 9, r: 3 },
  { c: 8, r: 3 },
  { c: 8, r: 4 },
  { c: 8, r: 5 },
  { c: 8, r: 6 },
  { c: 7, r: 6 },
  { c: 6, r: 6 },
  { c: 5, r: 6 },
  { c: 5, r: 5 },
  { c: 5, r: 4 },
  { c: 5, r: 3 },
  { c: 5, r: 2 },
  { c: 4, r: 2 },
  { c: 3, r: 2 },
  { c: 2, r: 2 },
  { c: 2, r: 3 },
  { c: 2, r: 4 },
  { c: 2, r: 5 },
  { c: 2, r: 6 },
  { c: 2, r: 7 },
  { c: 3, r: 7 },
  { c: 4, r: 7 },
  { c: 5, r: 7 },
  { c: 6, r: 7 },
  { c: 7, r: 7 },
  { c: 7, r: 8 },
  { c: 7, r: 9 },
  { c: 6, r: 9 },
  { c: 5, r: 9 },
  { c: 4, r: 9 },
  { c: 3, r: 9 },
  { c: 2, r: 9 },
  { c: 1, r: 9 },
  { c: 0, r: 9 },
];

/** Denser than map03: more swarm + tanks; brute only on last wave. */
const WAVES_MAP04: WaveSpawn[][] = [
  [
    { kind: 'runner', count: 12, interval: 550, delay: 200 },
    { kind: 'swarm', count: 16, interval: 220, delay: 300 },
    { kind: 'tank', count: 5, interval: 1200, delay: 1800 },
  ],
  [
    { kind: 'runner', count: 12, interval: 480, delay: 200 },
    { kind: 'swarm', count: 20, interval: 180, delay: 250 },
    { kind: 'tank', count: 8, interval: 900, delay: 1000 },
  ],
  [
    { kind: 'swarm', count: 24, interval: 150, delay: 100 },
    { kind: 'runner', count: 14, interval: 400, delay: 200 },
    { kind: 'tank', count: 10, interval: 750, delay: 800 },
    { kind: 'brute', count: 5, interval: 1400, delay: 2800 },
  ],
];

/** North spawn → west pocket → east channel → south-east gate (not map01–04). */
const PATH_MAP05: Cell[] = [
  { c: 5, r: 0 },
  { c: 5, r: 1 },
  { c: 5, r: 2 },
  { c: 4, r: 2 },
  { c: 3, r: 2 },
  { c: 2, r: 2 },
  { c: 2, r: 3 },
  { c: 2, r: 4 },
  { c: 2, r: 5 },
  { c: 3, r: 5 },
  { c: 4, r: 5 },
  { c: 5, r: 5 },
  { c: 6, r: 5 },
  { c: 7, r: 5 },
  { c: 8, r: 5 },
  { c: 8, r: 4 },
  { c: 8, r: 3 },
  { c: 9, r: 3 },
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
  { c: 6, r: 9 },
  { c: 7, r: 9 },
  { c: 8, r: 9 },
  { c: 9, r: 9 },
  { c: 10, r: 9 },
  { c: 11, r: 9 },
];

/** Longest path: early mixed packs, tanks mid, brutes from wave 2. */
const WAVES_MAP05: WaveSpawn[][] = [
  [
    { kind: 'runner', count: 14, interval: 500, delay: 200 },
    { kind: 'swarm', count: 18, interval: 200, delay: 250 },
    { kind: 'tank', count: 6, interval: 1100, delay: 1600 },
  ],
  [
    { kind: 'runner', count: 14, interval: 440, delay: 150 },
    { kind: 'swarm', count: 22, interval: 160, delay: 200 },
    { kind: 'tank', count: 9, interval: 820, delay: 900 },
    { kind: 'brute', count: 2, interval: 1600, delay: 3600 },
  ],
  [
    { kind: 'swarm', count: 28, interval: 130, delay: 80 },
    { kind: 'runner', count: 16, interval: 360, delay: 150 },
    { kind: 'tank', count: 12, interval: 700, delay: 700 },
    { kind: 'brute', count: 6, interval: 1200, delay: 2400 },
  ],
];

export const MAPS: Record<string, MapDef> = {
  map01: {
    id: 'map01',
    path: PATH_MAP01,
    gate: PATH_MAP01[PATH_MAP01.length - 1] ?? { c: 11, r: 8 },
    waves: WAVES_MAP01,
  },
  map02: {
    id: 'map02',
    path: PATH_MAP02,
    gate: PATH_MAP02[PATH_MAP02.length - 1] ?? { c: 3, r: 9 },
    waves: WAVES_MAP02,
  },
  map03: {
    id: 'map03',
    path: PATH_MAP03,
    gate: PATH_MAP03[PATH_MAP03.length - 1] ?? { c: 11, r: 3 },
    waves: WAVES_MAP03,
  },
  map04: {
    id: 'map04',
    path: PATH_MAP04,
    gate: PATH_MAP04[PATH_MAP04.length - 1] ?? { c: 0, r: 9 },
    waves: WAVES_MAP04,
  },
  map05: {
    id: 'map05',
    path: PATH_MAP05,
    gate: PATH_MAP05[PATH_MAP05.length - 1] ?? { c: 11, r: 9 },
    waves: WAVES_MAP05,
  },
};

export const MAP_LIST: MapDef[] = [MAPS.map01, MAPS.map02, MAPS.map03, MAPS.map04, MAPS.map05];

export function getMap(id: string): MapDef {
  return MAPS[id] ?? MAPS.map01;
}

const pathSetCache = new Map<string, Set<string>>();

function pathSetFor(map: MapDef): Set<string> {
  let s = pathSetCache.get(map.id);
  if (!s) {
    s = new Set(map.path.map((p) => `${p.c},${p.r}`));
    pathSetCache.set(map.id, s);
  }
  return s;
}

export function isPath(map: MapDef, c: number, r: number): boolean {
  return pathSetFor(map).has(`${c},${r}`);
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

export function isAdjacentToPath(map: MapDef, c: number, r: number): boolean {
  for (const d of ORTHO) {
    if (isPath(map, c + d.c, r + d.r)) return true;
  }
  return false;
}

export function isPlaceableGrass(map: MapDef, c: number, r: number): boolean {
  return isInGrid(c, r) && !isPath(map, c, r) && isAdjacentToPath(map, c, r);
}
