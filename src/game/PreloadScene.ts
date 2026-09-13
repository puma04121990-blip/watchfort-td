import Phaser from 'phaser';
import { t } from '../i18n';
import { COLOR } from './defs';

const IMAGES = [
  'tile_grass',
  'tile_path',
  'tile_gate',
  'tower_arrow',
  'tower_cannon',
  'tower_frost',
  'tower_barracks',
  'tower_lightning',
  'unit_soldier',
  'enemy_runner',
  'enemy_tank',
  'enemy_brute',
  'enemy_swarm',
  'projectile_arrow',
  'projectile_cannon',
  'projectile_frost',
  'projectile_lightning',
  'btn_play',
  'ui_coin',
  'fx_hit',
] as const;

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super({ key: 'PreloadScene' });
  }

  preload(): void {
    const { width, height } = this.scale;
    const barW = Math.min(300, width * 0.6);
    const barH = 12;
    const cx = width / 2;
    const cy = height / 2;

    const label = this.add
      .text(cx, cy - 28, t('menu.loading'), {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '16px',
        color: '#F3F4F6',
      })
      .setOrigin(0.5);

    const track = this.add.rectangle(cx, cy, barW, barH, COLOR.shade).setStrokeStyle(1, COLOR.gold);
    const fill = this.add.rectangle(cx - barW / 2 + 2, cy, 4, barH - 4, COLOR.towerBlue).setOrigin(0, 0.5);

    this.load.on('progress', (value: number) => {
      fill.width = Math.max(4, (barW - 4) * value);
      label.setText(t('menu.loading'));
    });

    this.load.on('complete', () => {
      track.destroy();
      fill.destroy();
      label.destroy();
    });

    for (const key of IMAGES) {
      this.load.image(key, `assets/${key}.png`);
    }
  }

  create(): void {
    this.scene.start('MenuScene');
  }
}
