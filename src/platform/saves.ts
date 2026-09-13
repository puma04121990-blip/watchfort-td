import { getGp } from './gp';
import type { GameStateSnapshot } from '../state/GameState';

const SAVE_KEY = 'gameState';

export async function loadGameState(): Promise<GameStateSnapshot | null> {
  const gp = getGp();
  await gp.player.load();
  const raw = gp.player.get(SAVE_KEY);
  if (!raw || typeof raw !== 'object') return null;
  const s = raw as Record<string, unknown>;
  if (typeof s.coins !== 'number' || typeof s.gateHp !== 'number') return null;
  return {
    coins: s.coins,
    gateHp: s.gateHp,
    maxGateHp: typeof s.maxGateHp === 'number' ? s.maxGateHp : 15,
    wave: typeof s.wave === 'number' ? s.wave : 0,
    wins: typeof s.wins === 'number' ? s.wins : 0,
    map01Stars: typeof s.map01Stars === 'number' ? s.map01Stars : 0,
  };
}

export async function saveGameState(snapshot: GameStateSnapshot): Promise<void> {
  const gp = getGp();
  gp.player.set(SAVE_KEY, snapshot);
  await gp.player.sync();
}
