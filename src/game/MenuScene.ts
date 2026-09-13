import Phaser from 'phaser';
import { t, setLocale, getLocale } from '../i18n';
import { AudioBus } from '../audio/AudioBus';
import { COLOR } from './defs';

export class MenuScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MenuScene' });
  }

  create(): void {
    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor(`#${COLOR.panel.toString(16).padStart(6, '0')}`);
    AudioBus.playMusic('menu');

    this.add.rectangle(width / 2, height / 2, width, height, COLOR.panel);
    this.add
      .rectangle(width / 2, height / 2, width * 0.7, height * 0.58, COLOR.shade, 0.96)
      .setStrokeStyle(2, COLOR.gold);

    this.add
      .text(width / 2, height * 0.3, t('menu.title'), {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '36px',
        color: '#F3F4F6',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, height * 0.38, t('menu.subtitle'), {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '16px',
        color: '#E8B84A',
      })
      .setOrigin(0.5);

    const playBtn = this.add
      .image(width / 2, height * 0.54, 'btn_play')
      .setInteractive({ useHandCursor: true });

    const playLabel = this.add
      .text(width / 2, height * 0.54, t('menu.play'), {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '22px',
        color: '#F3F4F6',
      })
      .setOrigin(0.5);

    const start = (): void => {
      AudioBus.playUi('confirm');
      this.scene.start('PlayScene');
    };

    playBtn.on('pointerover', () => {
      playBtn.setTint(0xffe08a);
    });
    playBtn.on('pointerout', () => {
      playBtn.clearTint();
    });
    playBtn.on('pointerdown', start);
    playLabel.setInteractive({ useHandCursor: true }).on('pointerdown', start);

    const locLabel = this.add
      .text(width / 2, height * 0.7, getLocale() === 'ru' ? 'RU | en' : 'ru | EN', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '14px',
        color: '#22D3EE',
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    locLabel.on('pointerdown', () => {
      AudioBus.playUi('click');
      setLocale(getLocale() === 'ru' ? 'en' : 'ru');
      this.scene.restart();
    });
  }
}
