import { saveGameState } from './saves';
import { GameState } from '../state/GameState';
import { AudioBus } from '../audio/AudioBus';

/** Called once when all waves are cleared and the gate still stands. */
export function hookLevelComplete(): void {
  AudioBus.playSfx('complete');
  GameState.wins += 1;
  void saveGameState(GameState.snapshot());
}

/** Called once when gate HP reaches 0. */
export function hookLevelFail(): void {
  AudioBus.playSfx('fail');
}
