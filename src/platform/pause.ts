import type Phaser from 'phaser';

let bound = false;
let gameRef: Phaser.Game | null = null;

function onVisibility(): void {
  if (!gameRef) return;
  if (document.hidden) {
    gameRef.scene.getScenes(true).forEach((scene) => {
      if (scene.scene.isActive()) {
        scene.scene.pause();
      }
    });
    gameRef.sound.pauseAll();
  } else {
    gameRef.scene.getScenes(false).forEach((scene) => {
      if (scene.scene.isPaused()) {
        scene.scene.resume();
      }
    });
    gameRef.sound.resumeAll();
  }
}

/** Pause / resume all scenes on document visibilitychange. */
export function bindPauseOnVisibility(game: Phaser.Game): void {
  gameRef = game;
  if (bound) return;
  bound = true;
  document.addEventListener('visibilitychange', onVisibility);
}

export function unbindPauseOnVisibility(): void {
  if (!bound) return;
  document.removeEventListener('visibilitychange', onVisibility);
  bound = false;
  gameRef = null;
}
