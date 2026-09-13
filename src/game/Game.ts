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
    GameState.map03Stars = saved.map03Stars;
    GameState.map04Stars = saved.map04Stars;
    GameState.map05Stars = saved.map05Stars;
    GameState.map06Stars = saved.map06Stars;
    GameState.metaGold = Math.max(0, saved.metaGold);
    GameState.startGoldLevel = Math.max(0, Math.min(3, Math.floor(saved.startGoldLevel)));
    GameState.arrowDmgLevel = Math.max(0, Math.min(3, Math.floor(saved.arrowDmgLevel)));
    GameState.cannonDmgLevel = Math.max(0, Math.min(3, Math.floor(saved.cannonDmgLevel)));
    GameState.frostDmgLevel = Math.max(0, Math.min(3, Math.floor(saved.frostDmgLevel)));
    GameState.lightningDmgLevel = Math.max(0, Math.min(3, Math.floor(saved.lightningDmgLevel)));
    GameState.sniperDmgLevel = Math.max(0, Math.min(3, Math.floor(saved.sniperDmgLevel)));
    GameState.musicOn = saved.musicOn !== false;
    GameState.sfxOn = saved.sfxOn !== false;
  }

  AudioBus.setMusicEnabled(GameState.musicOn);
  AudioBus.setSfxEnabled(GameState.sfxOn);

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
