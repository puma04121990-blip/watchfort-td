import Phaser from 'phaser';
import { BootScene } from './BootScene';
import { PreloadScene } from './PreloadScene';
import { MenuScene } from './MenuScene';
import { PlayScene } from './PlayScene';
import { bindPauseOnVisibility } from '../platform/pause';
import { AudioBus } from '../audio/AudioBus';
import { loadGameState } from '../platform/saves';
import { GameState } from '../state/GameState';
import { GAME_W, GAME_H, COLOR } from './defs';

export async function createGame(parent: string | HTMLElement): Promise<Phaser.Game> {
  const saved = await loadGameState();
  if (saved) {
    GameState.wins = saved.wins;
    GameState.map01Stars = saved.map01Stars;
    GameState.map02Stars = saved.map02Stars;
  }

  const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    parent,
    width: GAME_W,
    height: GAME_H,
    backgroundColor: `#${COLOR.shade.toString(16).padStart(6, '0')}`,
    pixelArt: false,
    roundPixels: true,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    scene: [BootScene, PreloadScene, MenuScene, PlayScene],
  };

  const game = new Phaser.Game(config);
  bindPauseOnVisibility(game);
  AudioBus.bindUnlock();
  AudioBus.bindVisibilityMute();
  return game;
}
