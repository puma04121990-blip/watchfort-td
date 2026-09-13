import { waitForGp } from './platform/gp';
import { createGame } from './game/Game';
import { ads } from './platform/ads';

async function boot(): Promise<void> {
  // Phaser.Game only after GP init OR ~4.5s NullGp fallback
  await waitForGp(4500);

  const container = document.getElementById('game-container');
  if (!container) {
    throw new Error('#game-container missing');
  }

  await createGame(container);

  void ads.showPreloader();
  ads.showSticky();
}

void boot();
