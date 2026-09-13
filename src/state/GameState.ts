export type MapId = 'map01' | 'map02' | 'map03' | 'map04' | 'map05' | 'map06';

export type Difficulty = 'normal' | 'hard';

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
  /** Best star rating for map03 (0–3). */
  map03Stars: number;
  /** Best star rating for map04 (0–3). */
  map04Stars: number;
  /** Best star rating for map05 (0–3). */
  map05Stars: number;
  /** Best star rating for map06 (0–3). */
  map06Stars: number;
  /** Persistent meta currency for menu upgrades. */
  metaGold: number;
  /** 0–3: +20 starting run coins per level. */
  startGoldLevel: number;
  /** 0–3: +3 arrow tower damage per level. */
  arrowDmgLevel: number;
  /** 0–3: +4 cannon tower damage per level. */
  cannonDmgLevel: number;
  /** 0–3: +2 frost tower damage per level. */
  frostDmgLevel: number;
  /** 0–3: +3 lightning tower damage per level. */
  lightningDmgLevel: number;
  /** Music bus enabled (persisted). */
  musicOn: boolean;
  /** SFX + UI buses enabled (persisted). */
  sfxOn: boolean;
  /** First-run play tutorial completed. */
  tutorialDone: boolean;
  /** Run difficulty (persisted). */
  difficulty: Difficulty;
}

const RUN_COINS = 120;
const RUN_GATE = 15;
const MAX_UPGRADE = 3;

export const START_GOLD_COSTS = [40, 80, 140] as const;
export const ARROW_DMG_COSTS = [50, 100, 160] as const;
export const CANNON_DMG_COSTS = [55, 110, 180] as const;
export const FROST_DMG_COSTS = [45, 90, 150] as const;
export const LIGHTNING_DMG_COSTS = [50, 100, 165] as const;

const DEFAULT: GameStateSnapshot = {
  coins: RUN_COINS,
  gateHp: RUN_GATE,
  maxGateHp: RUN_GATE,
  wave: 0,
  wins: 0,
  map01Stars: 0,
  map02Stars: 0,
  map03Stars: 0,
  map04Stars: 0,
  map05Stars: 0,
  map06Stars: 0,
  metaGold: 0,
  startGoldLevel: 0,
  arrowDmgLevel: 0,
  cannonDmgLevel: 0,
  frostDmgLevel: 0,
  lightningDmgLevel: 0,
  musicOn: true,
  sfxOn: true,
  tutorialDone: false,
  difficulty: 'normal',
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
  map03Stars = DEFAULT.map03Stars;
  map04Stars = DEFAULT.map04Stars;
  map05Stars = DEFAULT.map05Stars;
  map06Stars = DEFAULT.map06Stars;
  metaGold = DEFAULT.metaGold;
  startGoldLevel = DEFAULT.startGoldLevel;
  arrowDmgLevel = DEFAULT.arrowDmgLevel;
  cannonDmgLevel = DEFAULT.cannonDmgLevel;
  frostDmgLevel = DEFAULT.frostDmgLevel;
  lightningDmgLevel = DEFAULT.lightningDmgLevel;
  musicOn = DEFAULT.musicOn;
  sfxOn = DEFAULT.sfxOn;
  tutorialDone = DEFAULT.tutorialDone;
  difficulty: Difficulty = DEFAULT.difficulty;
  /** Currently selected map for the next / active run (not persisted). */
  selectedMapId: MapId = 'map01';

  resetRun(): void {
    const start = Math.round((RUN_COINS + this.startGoldLevel * 20) * this.startGoldMult());
    this.coins = Math.max(40, start);
    this.gateHp = this.runGateHp();
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
    this.map03Stars = snapshot.map03Stars;
    this.map04Stars = snapshot.map04Stars;
    this.map05Stars = snapshot.map05Stars;
    this.map06Stars = snapshot.map06Stars;
    this.metaGold = snapshot.metaGold;
    this.startGoldLevel = clampUpgrade(snapshot.startGoldLevel);
    this.arrowDmgLevel = clampUpgrade(snapshot.arrowDmgLevel);
    this.cannonDmgLevel = clampUpgrade(snapshot.cannonDmgLevel);
    this.frostDmgLevel = clampUpgrade(snapshot.frostDmgLevel);
    this.lightningDmgLevel = clampUpgrade(snapshot.lightningDmgLevel);
    this.musicOn = snapshot.musicOn !== false;
    this.sfxOn = snapshot.sfxOn !== false;
    this.tutorialDone = snapshot.tutorialDone === true;
    this.difficulty = snapshot.difficulty === 'hard' ? 'hard' : 'normal';
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
      map03Stars: this.map03Stars,
      map04Stars: this.map04Stars,
      map05Stars: this.map05Stars,
      map06Stars: this.map06Stars,
      metaGold: this.metaGold,
      startGoldLevel: this.startGoldLevel,
      arrowDmgLevel: this.arrowDmgLevel,
      cannonDmgLevel: this.cannonDmgLevel,
      frostDmgLevel: this.frostDmgLevel,
      lightningDmgLevel: this.lightningDmgLevel,
      musicOn: this.musicOn,
      sfxOn: this.sfxOn,
      tutorialDone: this.tutorialDone,
      difficulty: this.difficulty,
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
    if (mapId === 'map06') return this.map06Stars;
    if (mapId === 'map05') return this.map05Stars;
    if (mapId === 'map04') return this.map04Stars;
    if (mapId === 'map03') return this.map03Stars;
    if (mapId === 'map02') return this.map02Stars;
    return this.map01Stars;
  }

  /** Record best stars for a map; returns true if a new best was saved. */
  recordMapStars(mapId: string, stars: number): boolean {
    const clamped = Math.max(0, Math.min(3, Math.floor(stars)));
    if (mapId === 'map06') {
      if (clamped <= this.map06Stars) return false;
      this.map06Stars = clamped;
      return true;
    }
    if (mapId === 'map05') {
      if (clamped <= this.map05Stars) return false;
      this.map05Stars = clamped;
      return true;
    }
    if (mapId === 'map04') {
      if (clamped <= this.map04Stars) return false;
      this.map04Stars = clamped;
      return true;
    }
    if (mapId === 'map03') {
      if (clamped <= this.map03Stars) return false;
      this.map03Stars = clamped;
      return true;
    }
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
    if (mapId === 'map03') return this.map02Stars >= 1;
    if (mapId === 'map04') return this.map03Stars >= 1;
    if (mapId === 'map05') return this.map04Stars >= 1;
    if (mapId === 'map06') return this.map05Stars >= 1;
    return false;
  }

  /** Barracks unlocks after the first map01 clear (any stars). */
  isBarracksUnlocked(): boolean {
    return this.map01Stars >= 1;
  }

  /** Lightning unlocks after map02 clear (Gorge). */
  isLightningUnlocked(): boolean {
    return this.map02Stars >= 1;
  }

  /** Hard difficulty unlocks with the same gate as barracks. */
  isHardUnlocked(): boolean {
    return this.map01Stars >= 1;
  }

  /** Enemy HP multiplier for the selected difficulty. */
  enemyHpMult(): number {
    return this.difficulty === 'hard' ? 1.55 : 1.0;
  }

  /** Enemy speed multiplier for the selected difficulty. */
  enemySpeedMult(): number {
    return this.difficulty === 'hard' ? 1.12 : 1.0;
  }

  /** Win meta-gold multiplier for the selected difficulty. */
  winMetaMult(): number {
    return this.difficulty === 'hard' ? 1.55 : 1.0;
  }

  /** Starting run gold multiplier (Hard pays less up front). */
  startGoldMult(): number {
    return this.difficulty === 'hard' ? 0.85 : 1.0;
  }

  /** Gate HP for a fresh run. */
  runGateHp(): number {
    return this.difficulty === 'hard' ? Math.max(8, this.maxGateHp - 3) : this.maxGateHp;
  }

  /** Shaman heal pulse multiplier. */
  shamanHealMult(): number {
    return this.difficulty === 'hard' ? 1.35 : 1.0;
  }

  /** Meta reward for a win: 15 + gateHp*2 + stars*5. Returns amount granted. */
  grantWinMeta(stars: number): number {
    const s = Math.max(0, Math.min(3, Math.floor(stars)));
    const amount = Math.round((15 + this.gateHp * 2 + s * 5) * this.winMetaMult());
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

  cannonDmgNextCost(): number | null {
    if (this.cannonDmgLevel >= MAX_UPGRADE) return null;
    return CANNON_DMG_COSTS[this.cannonDmgLevel] ?? null;
  }

  frostDmgNextCost(): number | null {
    if (this.frostDmgLevel >= MAX_UPGRADE) return null;
    return FROST_DMG_COSTS[this.frostDmgLevel] ?? null;
  }

  lightningDmgNextCost(): number | null {
    if (this.lightningDmgLevel >= MAX_UPGRADE) return null;
    return LIGHTNING_DMG_COSTS[this.lightningDmgLevel] ?? null;
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

  /** Buy one level of cannonDmg; false if maxed or not enough meta. */
  buyCannonDmg(): boolean {
    const cost = this.cannonDmgNextCost();
    if (cost === null || this.metaGold < cost) return false;
    this.metaGold -= cost;
    this.cannonDmgLevel += 1;
    return true;
  }

  /** Buy one level of frostDmg; false if maxed or not enough meta. */
  buyFrostDmg(): boolean {
    const cost = this.frostDmgNextCost();
    if (cost === null || this.metaGold < cost) return false;
    this.metaGold -= cost;
    this.frostDmgLevel += 1;
    return true;
  }

  /** Buy one level of lightningDmg; false if maxed or not enough meta. */
  buyLightningDmg(): boolean {
    const cost = this.lightningDmgNextCost();
    if (cost === null || this.metaGold < cost) return false;
    this.metaGold -= cost;
    this.lightningDmgLevel += 1;
    return true;
  }

  /** Effective arrow damage bonus from meta upgrade. */
  arrowDamageBonus(): number {
    return this.arrowDmgLevel * 3;
  }

  /** Effective cannon damage bonus from meta upgrade. */
  cannonDamageBonus(): number {
    return this.cannonDmgLevel * 4;
  }

  /** Effective frost damage bonus from meta upgrade. */
  frostDamageBonus(): number {
    return this.frostDmgLevel * 2;
  }

  /** Effective lightning damage bonus from meta upgrade. */
  lightningDamageBonus(): number {
    return this.lightningDmgLevel * 3;
  }
}

export const GameState = new GameStateImpl();
