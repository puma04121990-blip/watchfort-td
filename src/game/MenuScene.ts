import Phaser from 'phaser';
import { t, setLocale, getLocale } from '../i18n';
import { AudioBus } from '../audio/AudioBus';
import { COLOR, MAP_LIST } from './defs';
import { GameState, type MapId } from '../state/GameState';

export class MenuScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MenuScene' });
  }

  create(): void {
    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor(`#${COLOR.panel.toString(16).padStart(6, '0')}`);
    AudioBus.playMusic('menu');

    if (!GameState.isMapUnlocked(GameState.selectedMapId)) {
      GameState.selectedMapId = 'map01';
    }

    this.add.rectangle(width / 2, height / 2, width, height, COLOR.panel);
    this.add
      .rectangle(width / 2, height / 2, width * 0.82, height * 0.78, COLOR.shade, 0.96)
      .setStrokeStyle(2, COLOR.gold);

    this.add
      .text(width / 2, height * 0.16, t('menu.title'), {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '34px',
        color: '#F3F4F6',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, height * 0.23, t('menu.subtitle'), {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '15px',
        color: '#E8B84A',
      })
      .setOrigin(0.5);

    const cardW = 200;
    const cardH = 110;
    const gap = 24;
    const totalW = MAP_LIST.length * cardW + (MAP_LIST.length - 1) * gap;
    const startX = width / 2 - totalW / 2 + cardW / 2;
    const cardY = height * 0.42;

    const nameKey: Record<string, string> = {
      map01: 'menu.map1',
      map02: 'menu.map2',
    };

    for (let i = 0; i < MAP_LIST.length; i++) {
      const map = MAP_LIST[i]!;
      const mapId = map.id as MapId;
      const x = startX + i * (cardW + gap);
      const unlocked = GameState.isMapUnlocked(mapId);
      const selected = GameState.selectedMapId === mapId;
      const stars = GameState.bestStars(mapId);

      const stroke = selected ? COLOR.gold : unlocked ? 0x4b5563 : 0x374151;
      const fill = selected ? 0x1e3a5f : COLOR.panel;
      const card = this.add
        .rectangle(x, cardY, cardW, cardH, fill, unlocked ? 0.98 : 0.7)
        .setStrokeStyle(selected ? 3 : 2, stroke);

      this.add
        .text(x, cardY - 28, t(nameKey[mapId] ?? map.id), {
          fontFamily: 'system-ui, sans-serif',
          fontSize: '20px',
          color: unlocked ? '#F3F4F6' : '#9CA3AF',
          fontStyle: 'bold',
        })
        .setOrigin(0.5);

      const starLabel =
        stars > 0
          ? '★'.repeat(stars) + '☆'.repeat(Math.max(0, 3 - stars))
          : unlocked
            ? t('menu.stars', { n: 0 })
            : t('menu.locked');
      this.add
        .text(x, cardY + 8, starLabel, {
          fontFamily: 'system-ui, sans-serif',
          fontSize: unlocked && stars === 0 ? '14px' : '18px',
          color: unlocked ? '#E8B84A' : '#9CA3AF',
        })
        .setOrigin(0.5);

      if (!unlocked) {
        this.add
          .text(x, cardY + 36, t('menu.locked'), {
            fontFamily: 'system-ui, sans-serif',
            fontSize: '12px',
            color: '#9CA3AF',
          })
          .setOrigin(0.5);
      }

      if (unlocked) {
        card.setInteractive({ useHandCursor: true });
        card.on('pointerover', () => {
          if (GameState.selectedMapId !== mapId) card.setStrokeStyle(2, COLOR.gold);
        });
        card.on('pointerout', () => {
          if (GameState.selectedMapId !== mapId) card.setStrokeStyle(2, 0x4b5563);
        });
        card.on('pointerdown', () => {
          AudioBus.playUi('click');
          GameState.selectedMapId = mapId;
          this.scene.restart();
        });
      } else {
        card.setInteractive({ useHandCursor: false });
        card.on('pointerdown', () => {
          AudioBus.playUi('error');
        });
      }
    }

    const playBtn = this.add
      .image(width / 2, height * 0.64, 'btn_play')
      .setInteractive({ useHandCursor: true });

    const playLabel = this.add
      .text(width / 2, height * 0.64, t('menu.play'), {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '22px',
        color: '#F3F4F6',
      })
      .setOrigin(0.5);

    const start = (): void => {
      if (!GameState.isMapUnlocked(GameState.selectedMapId)) {
        AudioBus.playUi('error');
        return;
      }
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
      .text(width / 2, height * 0.78, getLocale() === 'ru' ? 'RU | en' : 'ru | EN', {
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
