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
}

const RUN_COINS = 120;
const RUN_GATE = 15;

const DEFAULT: GameStateSnapshot = {
  coins: RUN_COINS,
  gateHp: RUN_GATE,
  maxGateHp: RUN_GATE,
  wave: 0,
  wins: 0,
  map01Stars: 0,
  map02Stars: 0,
};

/** Mutable runtime game state (singleton). */
class GameStateImpl {
  coins = DEFAULT.coins;
  gateHp = DEFAULT.gateHp;
  maxGateHp = DEFAULT.maxGateHp;
  wave = DEFAULT.wave;
  wins = DEFAULT.wins;
  map01Stars = DEFAULT.map01Stars;
  map02Stars = DEFAULT.map02Stars;
  /** Currently selected map for the next / active run (not persisted). */
  selectedMapId: MapId = 'map01';

  resetRun(): void {
    this.coins = RUN_COINS;
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
}

export const GameState = new GameStateImpl();
