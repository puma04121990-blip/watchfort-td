export type MapId = 'map01' | 'map02';

export interface GameStateSnapshot {
  coins: number;
  gateHp: number;
  maxGateHp: number;
  wave: number;
  wins: number;
  /** Best star rating for map01 (0–3). */
  map01Stars: number;
  /** Best star rating for map02 (0–3). */
  map02Stars: number;
  /** Persistent meta currency for menu upgrades. */
  metaGold: number;
  /** 0–3: +20 starting run coins per level. */
  startGoldLevel: number;
  /** 0–3: +3 arrow tower damage per level. */
  arrowDmgLevel: number;
}

const RUN_COINS = 120;
const RUN_GATE = 15;
const MAX_UPGRADE = 3;

export const START_GOLD_COSTS = [40, 80, 140] as const;
export const ARROW_DMG_COSTS = [50, 100, 160] as const;

const DEFAULT: GameStateSnapshot = {
  coins: RUN_COINS,
  gateHp: RUN_GATE,
  maxGateHp: RUN_GATE,
  wave: 0,
  wins: 0,
  map01Stars: 0,
  map02Stars: 0,
  metaGold: 0,
  startGoldLevel: 0,
  arrowDmgLevel: 0,
};

function clampUpgrade(level: number): number {
  return Math.max(0, Math.min(MAX_UPGRADE, Math.floor(level)));
}

/** Mutable runtime game state (singleton). */
class GameStateImpl {
  coins = DEFAULT.coins;
  gateHp = DEFAULT.gateHp;
  maxGateHp = DEFAULT.maxGateHp;
  wave = DEFAULT.wave;
  wins = DEFAULT.wins;
  map01Stars = DEFAULT.map01Stars;
  map02Stars = DEFAULT.map02Stars;
  metaGold = DEFAULT.metaGold;
  startGoldLevel = DEFAULT.startGoldLevel;
  arrowDmgLevel = DEFAULT.arrowDmgLevel;
  /** Currently selected map for the next / active run (not persisted). */
  selectedMapId: MapId = 'map01';

  resetRun(): void {
    this.coins = RUN_COINS + this.startGoldLevel * 20;
    this.gateHp = this.maxGateHp;
    this.wave = 0;
  }

  apply(snapshot: GameStateSnapshot): void {
    this.coins = snapshot.coins;
    this.gateHp = snapshot.gateHp;
    this.maxGateHp = snapshot.maxGateHp;
    this.wave = snapshot.wave;
    this.wins = snapshot.wins;
    this.map01Stars = snapshot.map01Stars;
    this.map02Stars = snapshot.map02Stars;
    this.metaGold = snapshot.metaGold;
    this.startGoldLevel = clampUpgrade(snapshot.startGoldLevel);
    this.arrowDmgLevel = clampUpgrade(snapshot.arrowDmgLevel);
  }

  snapshot(): GameStateSnapshot {
    return {
      coins: this.coins,
      gateHp: this.gateHp,
      maxGateHp: this.maxGateHp,
      wave: this.wave,
      wins: this.wins,
      map01Stars: this.map01Stars,
      map02Stars: this.map02Stars,
      metaGold: this.metaGold,
      startGoldLevel: this.startGoldLevel,
      arrowDmgLevel: this.arrowDmgLevel,
    };
  }

  spend(amount: number): boolean {
    if (this.coins < amount) return false;
    this.coins -= amount;
    return true;
  }

  addCoins(amount: number): void {
    this.coins = Math.max(0, this.coins + amount);
  }

  hitGate(amount = 1): boolean {
    this.gateHp = Math.max(0, this.gateHp - amount);
    return this.gateHp <= 0;
  }

  bestStars(mapId: string): number {
    if (mapId === 'map02') return this.map02Stars;
    return this.map01Stars;
  }

  /** Record best stars for a map; returns true if a new best was saved. */
  recordMapStars(mapId: string, stars: number): boolean {
    const clamped = Math.max(0, Math.min(3, Math.floor(stars)));
    if (mapId === 'map02') {
      if (clamped <= this.map02Stars) return false;
      this.map02Stars = clamped;
      return true;
    }
    if (clamped <= this.map01Stars) return false;
    this.map01Stars = clamped;
    return true;
  }

  isMapUnlocked(mapId: string): boolean {
    if (mapId === 'map01') return true;
    if (mapId === 'map02') return this.map01Stars >= 1;
    return false;
  }

  /** Barracks unlocks after the first map01 clear (any stars). */
  isBarracksUnlocked(): boolean {
    return this.map01Stars >= 1;
  }

  /** Meta reward for a win: 15 + gateHp*2 + stars*5. Returns amount granted. */
  grantWinMeta(stars: number): number {
    const s = Math.max(0, Math.min(3, Math.floor(stars)));
    const amount = 15 + this.gateHp * 2 + s * 5;
    this.metaGold += amount;
    return amount;
  }

  /** Add bonus meta (e.g. rewarded ×2 of the win grant). */
  addMetaGold(amount: number): void {
    if (amount <= 0) return;
    this.metaGold += amount;
  }

  startGoldNextCost(): number | null {
    if (this.startGoldLevel >= MAX_UPGRADE) return null;
    return START_GOLD_COSTS[this.startGoldLevel] ?? null;
  }

  arrowDmgNextCost(): number | null {
    if (this.arrowDmgLevel >= MAX_UPGRADE) return null;
    return ARROW_DMG_COSTS[this.arrowDmgLevel] ?? null;
  }

  /** Buy one level of startGold; false if maxed or not enough meta. */
  buyStartGold(): boolean {
    const cost = this.startGoldNextCost();
    if (cost === null || this.metaGold < cost) return false;
    this.metaGold -= cost;
    this.startGoldLevel += 1;
    return true;
  }

  /** Buy one level of arrowDmg; false if maxed or not enough meta. */
  buyArrowDmg(): boolean {
    const cost = this.arrowDmgNextCost();
    if (cost === null || this.metaGold < cost) return false;
    this.metaGold -= cost;
    this.arrowDmgLevel += 1;
    return true;
  }

  /** Effective arrow damage bonus from meta upgrade. */
  arrowDamageBonus(): number {
    return this.arrowDmgLevel * 3;
  }
}

export const GameState = new GameStateImpl();
