import Phaser from 'phaser';

const UI_TEXT = '#F3F4F6';
const UI_PANEL = '#111827';

export function createHudText(
  scene: Phaser.Scene,
  x: number,
  y: number,
  content: string,
  fontSize = 14,
): Phaser.GameObjects.Text {
  return scene.add
    .text(x, y, content, {
      fontFamily: 'system-ui, sans-serif',
      fontSize: `${fontSize}px`,
      color: UI_TEXT,
      backgroundColor: UI_PANEL,
      padding: { x: 8, y: 5 },
    })
    .setScrollFactor(0)
    .setDepth(1000);
}
