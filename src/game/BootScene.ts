import Phaser from 'phaser';
import { COLOR } from './defs';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  create(): void {
    this.cameras.main.setBackgroundColor(`#${COLOR.panel.toString(16).padStart(6, '0')}`);
    this.scene.start('PreloadScene');
  }
}
