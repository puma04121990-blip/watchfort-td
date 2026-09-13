import Phaser from 'phaser';
import { t, setLocale, getLocale } from '../i18n';
import { AudioBus } from '../audio/AudioBus';
import { COLOR, MAP_LIST } from './defs';
import { GameState, type MapId } from '../state/GameState';
import { saveGameState } from '../platform/saves';

export class MenuScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MenuScene' });
  }

  create(): void {
    const { width, height } = this.scale;
    // Slightly warmer clear than raw panel gray
    const warmClear = 0x1a1624;
    this.cameras.main.setBackgroundColor(`#${warmClear.toString(16).padStart(6, '0')}`);
    AudioBus.playMusic('menu');

    if (!GameState.isMapUnlocked(GameState.selectedMapId)) {
      GameState.selectedMapId = 'map01';
    }
    if (GameState.difficulty === 'hard' && !GameState.isHardUnlocked()) {
      GameState.difficulty = 'normal';
    }

    this.add.rectangle(width / 2, height / 2, width, height, warmClear);

    // Soft vignette (corners darker) — drawn under panel/UI
    const vig = this.add.graphics();
    vig.fillStyle(0x0a0810, 0.35);
    vig.fillEllipse(width * 0.12, height * 0.1, width * 0.55, height * 0.45);
    vig.fillEllipse(width * 0.88, height * 0.1, width * 0.55, height * 0.45);
    vig.fillEllipse(width * 0.12, height * 0.92, width * 0.55, height * 0.5);
    vig.fillEllipse(width * 0.88, height * 0.92, width * 0.55, height * 0.5);

    // Rounded-feel panel: thicker gold stroke + inner shade bands
    const pw = width * 0.82;
    const ph = height * 0.86;
    this.add
      .rectangle(width / 2, height / 2, pw, ph, COLOR.shade, 0.96)
      .setStrokeStyle(4, COLOR.gold);
    this.add
      .rectangle(width / 2, height / 2, pw - 14, ph - 14, 0x162032, 0.55)
      .setStrokeStyle(2, 0xc9a227);
    this.add.rectangle(width / 2, height / 2, pw - 28, ph - 28, COLOR.shade, 0.35);

    this.add
      .text(width / 2, height * 0.088, t('menu.title'), {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '34px',
        color: '#F3F4F6',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, height * 0.148, t('menu.subtitle'), {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '14px',
        color: '#E8B84A',
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, height * 0.198, t('menu.metaGold', { n: GameState.metaGold }), {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '16px',
        color: '#E8B84A',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

    const cardW = 148;
    const cardH = 92;
    const gap = 12;
    const totalW = MAP_LIST.length * cardW + (MAP_LIST.length - 1) * gap;
    const startX = width / 2 - totalW / 2 + cardW / 2;
    const cardY = height * 0.34;

    const nameKey: Record<string, string> = {
      map01: 'menu.map1',
      map02: 'menu.map2',
      map03: 'menu.map3',
      map04: 'menu.map4',
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
        .text(x, cardY - 24, t(nameKey[mapId] ?? map.id), {
          fontFamily: 'system-ui, sans-serif',
          fontSize: '18px',
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
        .text(x, cardY + 6, starLabel, {
          fontFamily: 'system-ui, sans-serif',
          fontSize: unlocked && stars === 0 ? '13px' : '16px',
          color: unlocked ? '#E8B84A' : '#9CA3AF',
        })
        .setOrigin(0.5);

      if (!unlocked) {
        this.add
          .text(x, cardY + 30, t('menu.locked'), {
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

    this.buildDifficulty(width, height);

    this.buildShop(width, height);

    this.buildAudioToggles(width, height);

    const playBtn = this.add
      .image(width / 2, height * 0.8, 'btn_play')
      .setDisplaySize(220, 68)
      .setInteractive({ useHandCursor: true });

    const playLabel = this.add
      .text(width / 2, height * 0.8, t('menu.play'), {
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
      .text(width / 2, height * 0.915, getLocale() === 'ru' ? 'RU | en' : 'ru | EN', {
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


  private buildDifficulty(width: number, height: number): void {
    const y = height * 0.435;
    const hardUnlocked = GameState.isHardUnlocked();
    const isHard = GameState.difficulty === 'hard';
    let label: string;
    let color: string;
    if (isHard && hardUnlocked) {
      label = t('menu.diffHard');
      color = '#F87171';
    } else if (!hardUnlocked && isHard) {
      label = t('menu.diffLocked');
      color = '#9CA3AF';
    } else if (!hardUnlocked) {
      // Show normal + locked hint for hard
      label = `${t('menu.diffNormal')} · ${t('menu.diffLocked')}`;
      color = '#E8B84A';
    } else {
      label = t('menu.diffNormal');
      color = '#E8B84A';
    }

    const btn = this.add
      .text(width / 2, y, label, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '15px',
        color,
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    btn.on('pointerdown', () => {
      if (GameState.difficulty === 'normal') {
        if (!GameState.isHardUnlocked()) {
          AudioBus.playUi('error');
          return;
        }
        GameState.difficulty = 'hard';
      } else {
        GameState.difficulty = 'normal';
      }
      AudioBus.playUi('click');
      void saveGameState(GameState.snapshot());
      this.scene.restart();
    });
  }

  private buildShop(width: number, height: number): void {
    const shopY0 = height * 0.48;
    const rowH = 32;
    const rows: Array<{
      labelKey: string;
      level: number;
      cost: number | null;
      buy: () => boolean;
    }> = [
      {
        labelKey: 'menu.upStartGold',
        level: GameState.startGoldLevel,
        cost: GameState.startGoldNextCost(),
        buy: () => GameState.buyStartGold(),
      },
      {
        labelKey: 'menu.upArrowDmg',
        level: GameState.arrowDmgLevel,
        cost: GameState.arrowDmgNextCost(),
        buy: () => GameState.buyArrowDmg(),
      },
      {
        labelKey: 'menu.upCannonDmg',
        level: GameState.cannonDmgLevel,
        cost: GameState.cannonDmgNextCost(),
        buy: () => GameState.buyCannonDmg(),
      },
      {
        labelKey: 'menu.upFrostDmg',
        level: GameState.frostDmgLevel,
        cost: GameState.frostDmgNextCost(),
        buy: () => GameState.buyFrostDmg(),
      },
    ];

    rows.forEach((row, i) => {
      const y = shopY0 + i * rowH;
      const maxed = row.cost === null;
      const info = maxed
        ? `${t(row.labelKey)}  Lv.${row.level}  ${t('menu.maxed')}`
        : `${t(row.labelKey)}  Lv.${row.level}  (${row.cost})`;

      this.add
        .text(width / 2 - 110, y, info, {
          fontFamily: 'system-ui, sans-serif',
          fontSize: '13px',
          color: maxed ? '#9CA3AF' : '#F3F4F6',
        })
        .setOrigin(0, 0.5);

      if (maxed) return;

      const btn = this.add
        .rectangle(width / 2 + 130, y, 72, 30, COLOR.towerBlue)
        .setStrokeStyle(2, COLOR.gold)
        .setInteractive({ useHandCursor: true });
      this.add
        .text(width / 2 + 130, y, t('menu.buy'), {
          fontFamily: 'system-ui, sans-serif',
          fontSize: '13px',
          color: '#F3F4F6',
        })
        .setOrigin(0.5);

      btn.on('pointerdown', () => {
        if (!row.buy()) {
          AudioBus.playUi('error');
          return;
        }
        AudioBus.playUi('confirm');
        void saveGameState(GameState.snapshot());
        this.scene.restart();
      });
    });
  }
  private buildAudioToggles(width: number, height: number): void {
    const y = height * 0.705;
    const musicLabel = this.add
      .text(width / 2 - 90, y, GameState.musicOn ? t('menu.musicOn') : t('menu.musicOff'), {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '14px',
        color: '#22D3EE',
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    musicLabel.on('pointerdown', () => {
      GameState.musicOn = !GameState.musicOn;
      AudioBus.setMusicEnabled(GameState.musicOn);
      void saveGameState(GameState.snapshot());
      if (GameState.sfxOn) AudioBus.playUi('click');
      this.scene.restart();
    });

    const sfxLabel = this.add
      .text(width / 2 + 90, y, GameState.sfxOn ? t('menu.sfxOn') : t('menu.sfxOff'), {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '14px',
        color: '#22D3EE',
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    sfxLabel.on('pointerdown', () => {
      GameState.sfxOn = !GameState.sfxOn;
      AudioBus.setSfxEnabled(GameState.sfxOn);
      void saveGameState(GameState.snapshot());
      if (GameState.sfxOn) AudioBus.playUi('click');
      this.scene.restart();
    });
  }
}
