export interface GameStateSnapshot {
  coins: number;
  gateHp: number;
  maxGateHp: number;
  wave: number;
  wins: number;
  /** Best star rating for map01 (0–3). */
  map01Stars: number;
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
};

/** Mutable runtime game state (singleton). */
class GameStateImpl {
  coins = DEFAULT.coins;
  gateHp = DEFAULT.gateHp;
  maxGateHp = DEFAULT.maxGateHp;
  wave = DEFAULT.wave;
  wins = DEFAULT.wins;
  map01Stars = DEFAULT.map01Stars;

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
  }

  snapshot(): GameStateSnapshot {
    return {
      coins: this.coins,
      gateHp: this.gateHp,
      maxGateHp: this.maxGateHp,
      wave: this.wave,
      wins: this.wins,
      map01Stars: this.map01Stars,
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

  /** Record best stars for map01; returns true if a new best was saved. */
  recordMap01Stars(stars: number): boolean {
    const clamped = Math.max(0, Math.min(3, Math.floor(stars)));
    if (clamped <= this.map01Stars) return false;
    this.map01Stars = clamped;
    return true;
  }
}

export const GameState = new GameStateImpl();
