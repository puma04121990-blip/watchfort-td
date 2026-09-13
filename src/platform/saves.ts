import { getGp } from './gp';
import type { GameStateSnapshot } from '../state/GameState';

const SAVE_KEY = 'gameState';

function num(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

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
    maxGateHp: num(s.maxGateHp, 15),
    wave: num(s.wave, 0),
    wins: num(s.wins, 0),
    map01Stars: num(s.map01Stars, 0),
    map02Stars: num(s.map02Stars, 0),
    map03Stars: num(s.map03Stars, 0),
    map04Stars: num(s.map04Stars, 0),
    map05Stars: num(s.map05Stars, 0),
    map06Stars: num(s.map06Stars, 0),
    metaGold: num(s.metaGold, 0),
    startGoldLevel: num(s.startGoldLevel, 0),
    arrowDmgLevel: num(s.arrowDmgLevel, 0),
    cannonDmgLevel: num(s.cannonDmgLevel, 0),
    frostDmgLevel: num(s.frostDmgLevel, 0),
    lightningDmgLevel: num(s.lightningDmgLevel, 0),
    sniperDmgLevel: num(s.sniperDmgLevel, 0),
    musicOn: s.musicOn !== false,
    sfxOn: s.sfxOn !== false,
    tutorialDone: s.tutorialDone === true,
    difficulty: s.difficulty === 'hard' ? 'hard' : 'normal',
  };
}

export async function saveGameState(snapshot: GameStateSnapshot): Promise<void> {
  const gp = getGp();
  gp.player.set(SAVE_KEY, snapshot);
  await gp.player.sync();
}
