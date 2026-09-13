import { saveGameState } from './saves';
import { GameState } from '../state/GameState';
import { AudioBus } from '../audio/AudioBus';

/**
 * Called once when all waves are cleared and the gate still stands.
 * Returns meta gold granted for this win (before any rewarded double).
 */
export function hookLevelComplete(stars?: number): number {
  AudioBus.playSfx('complete');
  GameState.wins += 1;
  const starCount = typeof stars === 'number' ? stars : 0;
  if (typeof stars === 'number') {
    GameState.recordMapStars(GameState.selectedMapId, stars);
  }
  const metaGain = GameState.grantWinMeta(starCount);
  void saveGameState(GameState.snapshot());
  return metaGain;
}

/** Called once when gate HP reaches 0. */
export function hookLevelFail(): void {
  AudioBus.playSfx('fail');
}
