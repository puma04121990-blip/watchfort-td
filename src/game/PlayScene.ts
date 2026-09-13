import Phaser from 'phaser';
import { t } from '../i18n';
import { GameState } from '../state/GameState';
import { AudioBus } from '../audio/AudioBus';
import { hookLevelComplete, hookLevelFail } from '../platform/hooks';
import { ads } from '../platform/ads';
import { saveGameState } from '../platform/saves';
import {
  TILE,
  COLS,
  ROWS,
  HUD_H,
  GAME_W,
  GAME_H,
  COLOR,
  TOWERS,
  ENEMIES,
  getMap,
  isPath,
  isPlaceableGrass,
  cellCenter,
  isInGrid,
  type MapDef,
  type TowerKind,
  type EnemyKind,
  type TowerDef,
} from './defs';

interface EnemyActor {
  id: number;
  kind: EnemyKind;
  sprite: Phaser.GameObjects.Image;
  hpBg: Phaser.GameObjects.Rectangle;
  hpFg: Phaser.GameObjects.Rectangle;
  hp: number;
  maxHp: number;
  speed: number;
  gold: number;
  wp: number;
  x: number;
  y: number;
  slowUntil: number;
  slowFactor: number;
  alive: boolean;
}

interface SoldierActor {
  sprite: Phaser.GameObjects.Image;
  hpBg: Phaser.GameObjects.Rectangle;
  hpFg: Phaser.GameObjects.Rectangle;
  hp: number;
  maxHp: number;
  wp: number;
  x: number;
  y: number;
  alive: boolean;
  lastStrike: number;
}

interface TowerActor {
  col: number;
  row: number;
  kind: TowerKind;
  def: TowerDef;
  baseCost: number;
  level: number;
  totalSpent: number;
  sprite: Phaser.GameObjects.Image;
  starMark: Phaser.GameObjects.Text | null;
  lastShot: number;
  soldier: SoldierActor | null;
}

interface ShotActor {
  sprite: Phaser.GameObjects.Image;
  x: number;
  y: number;
  vx: number;
  vy: number;
  damage: number;
  splash: number;
  slowFactor: number;
  slowMs: number;
  targetId: number;
  spent: boolean;
}

interface PendingSpawn {
  kind: EnemyKind;
  at: number;
}

function cloneTowerDef(kind: TowerKind): TowerDef {
  const src = TOWERS[kind];
  return { ...src };
}

function upgradeCost(baseCost: number): number {
  return Math.floor(baseCost * 0.75);
}

function sellRefund(totalSpent: number): number {
  return Math.floor(totalSpent * 0.5);
}

function starString(n: number): string {
  const filled = Math.max(1, Math.min(3, n));
  return '★'.repeat(filled);
}

const HUD_KINDS: TowerKind[] = ['arrow', 'cannon', 'frost', 'barracks'];

const TOWER_COLORS: Record<TowerKind, number> = {
  arrow: COLOR.towerBlue,
  cannon: COLOR.cannon,
  frost: COLOR.frost,
  barracks: COLOR.barracks,
};

const SOLDIER_MELEE_MS = 400;
const SOLDIER_BLOCK_R = 30;

function enemyMeleeDamage(kind: EnemyKind): number {
  switch (kind) {
    case 'swarm':
      return 6;
    case 'runner':
      return 8;
    case 'tank':
      return 12;
    case 'brute':
      return 18;
  }
}

function enemySpriteSize(kind: EnemyKind): number {
  switch (kind) {
    case 'swarm':
      return 28;
    case 'runner':
      return 36;
    case 'tank':
      return 42;
    case 'brute':
      return 50;
  }
}

export class PlayScene extends Phaser.Scene {
  private selected: TowerKind = 'arrow';
  private occupied = new Set<string>();
  private towers: TowerActor[] = [];
  private enemies: EnemyActor[] = [];
  private shots: ShotActor[] = [];
  private pending: PendingSpawn[] = [];
  private waypoints: { x: number; y: number }[] = [];
  private waveLive = false;
  private ended = false;
  private paused = false;
  private nextId = 1;
  private goldText!: Phaser.GameObjects.Text;
  private gateText!: Phaser.GameObjects.Text;
  private waveText!: Phaser.GameObjects.Text;
  private startLabel!: Phaser.GameObjects.Text;
  private startBg!: Phaser.GameObjects.Rectangle;
  private rangeGfx!: Phaser.GameObjects.Graphics;
  private selectMarks: Phaser.GameObjects.Rectangle[] = [];
  private selectIcons: Phaser.GameObjects.Image[] = [];
  private hoverCol = -1;
  private hoverRow = -1;
  private endOverlay: Phaser.GameObjects.Container | null = null;
  private pauseOverlay: Phaser.GameObjects.Container | null = null;
  private towerPanel: Phaser.GameObjects.Container | null = null;
  private selectedTower: TowerActor | null = null;
  private navigating = false;
  private lastWinStars = 0;
  private lastWinMeta = 0;
  private metaDoubled = false;
  private mapDef!: MapDef;
  private totalWaves = 3;

  constructor() {
    super({ key: 'PlayScene' });
  }

  create(): void {
    GameState.resetRun();
    this.selected = 'arrow';
    this.occupied = new Set();
    this.towers = [];
    this.enemies = [];
    this.shots = [];
    this.pending = [];
    this.waveLive = false;
    this.ended = false;
    this.paused = false;
    this.nextId = 1;
    this.hoverCol = -1;
    this.hoverRow = -1;
    this.selectMarks = [];
    this.selectIcons = [];
    this.endOverlay = null;
    this.pauseOverlay = null;
    this.towerPanel = null;
    this.selectedTower = null;
    this.navigating = false;
    this.lastWinStars = 0;
    this.lastWinMeta = 0;
    this.metaDoubled = false;
    this.time.paused = false;

    this.mapDef = getMap(GameState.selectedMapId);
    this.totalWaves = this.mapDef.waves.length;

    AudioBus.playMusic('play');
    this.cameras.main.setBackgroundColor(`#${COLOR.shade.toString(16).padStart(6, '0')}`);

    this.waypoints = this.mapDef.path.map((p) => cellCenter(p.c, p.r));
    this.drawField();
    this.rangeGfx = this.add.graphics().setDepth(3);
    this.buildHud();
    this.buildPauseButton();

    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (this.ended || this.paused || p.y >= ROWS * TILE) {
        this.hoverCol = -1;
        this.hoverRow = -1;
        this.redrawRange();
        return;
      }
      this.hoverCol = Math.floor(p.x / TILE);
      this.hoverRow = Math.floor(p.y / TILE);
      this.redrawRange();
    });

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (this.ended || this.paused) return;
      if (p.y >= ROWS * TILE) return;
      const c = Math.floor(p.x / TILE);
      const r = Math.floor(p.y / TILE);
      this.onFieldTap(c, r);
    });
  }

  update(_time: number, delta: number): void {
    if (this.ended || this.paused) return;
    const now = this.time.now;
    this.spawnDue(now);
    this.stepEnemies(delta, now);
    this.stepSoldiers(now);
    this.stepTowers(now);
    this.stepShots(delta);
    this.refreshHud();
    this.checkWaveEnd();
  }

  private drawField(): void {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const { x, y } = cellCenter(c, r);
        const key = isPath(this.mapDef, c, r) ? 'tile_path' : 'tile_grass';
        this.add.image(x, y, key).setDisplaySize(TILE, TILE).setDepth(0);
      }
    }
    const gate = cellCenter(this.mapDef.gate.c, this.mapDef.gate.r);
    this.add.image(gate.x, gate.y, 'tile_gate').setDisplaySize(TILE, TILE).setDepth(2);
  }

  private buildHud(): void {
    const y0 = ROWS * TILE;
    this.add.rectangle(GAME_W / 2, y0 + HUD_H / 2, GAME_W, HUD_H, COLOR.panel).setDepth(100);
    this.add.rectangle(GAME_W / 2, y0 + 1, GAME_W, 2, COLOR.shade).setDepth(101);

    this.goldText = this.add
      .text(16, 10, '', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '16px',
        color: '#E8B84A',
        backgroundColor: '#111827',
        padding: { x: 8, y: 4 },
      })
      .setDepth(110);

    this.gateText = this.add
      .text(GAME_W / 2, 10, '', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '16px',
        color: '#F3F4F6',
        backgroundColor: '#111827',
        padding: { x: 8, y: 4 },
      })
      .setOrigin(0.5, 0)
      .setDepth(110);

    this.waveText = this.add
      .text(GAME_W - 56, 10, '', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '16px',
        color: '#F3F4F6',
        backgroundColor: '#111827',
        padding: { x: 8, y: 4 },
      })
      .setOrigin(1, 0)
      .setDepth(110);

    this.add
      .text(16, 38, t('play.hint'), {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '12px',
        color: '#F3F4F6',
      })
      .setAlpha(0.75)
      .setDepth(110);

    HUD_KINDS.forEach((kind, i) => {
      const x = 60 + i * 118;
      const y = y0 + HUD_H / 2;
      const locked = kind === 'barracks' && !GameState.isBarracksUnlocked();
      const mark = this.add
        .rectangle(x, y, 110, 68, COLOR.shade)
        .setStrokeStyle(2, this.selected === kind ? TOWER_COLORS[kind] : 0x374151)
        .setDepth(102)
        .setInteractive({ useHandCursor: !locked })
        .setAlpha(locked ? 0.5 : 1);
      this.selectMarks.push(mark);
      const icon = this.add
        .image(x - 32, y, TOWERS[kind].texture)
        .setDisplaySize(36, 36)
        .setDepth(103);
      if (locked) icon.setTint(0x667066);
      this.selectIcons.push(icon);
      this.add
        .text(x + 16, y - 12, t(`tower.${kind}`), {
          fontFamily: 'system-ui, sans-serif',
          fontSize: '13px',
          color: locked ? '#9CA3AF' : '#F3F4F6',
        })
        .setOrigin(0.5)
        .setDepth(103);
      this.add
        .text(x + 16, y + 10, locked ? t('menu.locked') : `${TOWERS[kind].cost}`, {
          fontFamily: 'system-ui, sans-serif',
          fontSize: '12px',
          color: locked ? '#9CA3AF' : '#E8B84A',
        })
        .setOrigin(0.5)
        .setDepth(103);
      mark.on('pointerdown', () => {
        if (this.paused) return;
        if (kind === 'barracks' && !GameState.isBarracksUnlocked()) {
          AudioBus.playUi('error');
          return;
        }
        this.selected = kind;
        this.clearTowerSelection();
        AudioBus.playUi('click');
        this.refreshSelect();
      });
    });

    this.startBg = this.add
      .rectangle(GAME_W - 96, y0 + HUD_H / 2, 156, 52, COLOR.towerBlue)
      .setStrokeStyle(2, COLOR.gold)
      .setDepth(102)
      .setInteractive({ useHandCursor: true });
    this.startLabel = this.add
      .text(GAME_W - 96, y0 + HUD_H / 2, t('play.startWave'), {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '16px',
        color: '#F3F4F6',
      })
      .setOrigin(0.5)
      .setDepth(103);
    this.startBg.on('pointerdown', () => {
      if (this.paused) return;
      this.tryStartWave();
    });

    this.refreshHud();
    this.refreshSelect();
  }

  private buildPauseButton(): void {
    const x = GAME_W - 28;
    const y = 28;
    const bg = this.add
      .rectangle(0, 0, 40, 36, COLOR.panel, 0.92)
      .setStrokeStyle(2, COLOR.gold)
      .setInteractive({ useHandCursor: true });
    const label = this.add
      .text(0, 0, 'II', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '16px',
        color: '#F3F4F6',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    this.add.container(x, y, [bg, label]).setDepth(120);
    bg.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      pointer.event?.stopPropagation?.();
      this.togglePause();
    });
  }

  private refreshSelect(): void {
    this.selectMarks.forEach((mark, i) => {
      const kind = HUD_KINDS[i];
      if (!kind) return;
      const locked = kind === 'barracks' && !GameState.isBarracksUnlocked();
      mark.setStrokeStyle(3, this.selected === kind ? TOWER_COLORS[kind] : 0x374151);
      mark.setAlpha(locked ? 0.5 : 1);
      const icon = this.selectIcons[i];
      if (icon) {
        if (locked) icon.setTint(0x667066);
        else icon.clearTint();
      }
    });
    this.redrawRange();
  }

  private refreshHud(): void {
    this.goldText.setText(`${t('play.gold')}: ${GameState.coins}`);
    this.gateText.setText(`${t('play.gate')}: ${GameState.gateHp}/${GameState.maxGateHp}`);
    const shown = Math.min(Math.max(GameState.wave, 0), this.totalWaves);
    const phase = this.waveLive ? `${shown}/${this.totalWaves}` : `${shown}/${this.totalWaves} · ${t('play.waiting')}`;
    this.waveText.setText(`${t('play.wave')}: ${phase}`);
    const canStart = !this.ended && !this.waveLive && !this.paused && GameState.wave < this.totalWaves;
    this.startBg.setFillStyle(canStart ? COLOR.towerBlue : COLOR.shade);
    this.startBg.setAlpha(canStart ? 1 : 0.55);
    this.startLabel.setText(canStart ? t('play.startWave') : t('play.waiting'));
  }

  private redrawRange(): void {
    this.rangeGfx.clear();
    if (this.ended || this.paused) return;

    if (this.selectedTower) {
      const tw = this.selectedTower;
      const { x, y } = cellCenter(tw.col, tw.row);
      this.rangeGfx.fillStyle(COLOR.gold, 0.14);
      this.rangeGfx.fillCircle(x, y, tw.def.range);
      this.rangeGfx.lineStyle(2, COLOR.gold, 0.9);
      this.rangeGfx.strokeCircle(x, y, tw.def.range);
      this.rangeGfx.lineStyle(2, COLOR.gold, 0.85);
      this.rangeGfx.strokeRect(tw.col * TILE + 2, tw.row * TILE + 2, TILE - 4, TILE - 4);
      return;
    }

    const c = this.hoverCol;
    const r = this.hoverRow;
    if (!isInGrid(c, r)) return;
    const key = `${c},${r}`;
    const ok = isPlaceableGrass(this.mapDef, c, r) && !this.occupied.has(key);
    const { x, y } = cellCenter(c, r);
    const def = TOWERS[this.selected];
    this.rangeGfx.fillStyle(ok ? COLOR.towerBlue : COLOR.enemyRed, 0.12);
    this.rangeGfx.fillCircle(x, y, def.range);
    this.rangeGfx.lineStyle(1, ok ? COLOR.gold : COLOR.enemyRed, 0.55);
    this.rangeGfx.strokeCircle(x, y, def.range);
    this.rangeGfx.lineStyle(2, ok ? COLOR.gold : COLOR.enemyRed, 0.7);
    this.rangeGfx.strokeRect(c * TILE + 2, r * TILE + 2, TILE - 4, TILE - 4);
  }

  private towerAt(c: number, r: number): TowerActor | null {
    return this.towers.find((tw) => tw.col === c && tw.row === r) ?? null;
  }

  private onFieldTap(c: number, r: number): void {
    if (this.ended || this.paused) return;
    const existing = this.towerAt(c, r);
    if (existing) {
      this.selectTower(existing);
      AudioBus.playUi('click');
      return;
    }
    this.clearTowerSelection();
    this.tryPlace(c, r);
  }

  private selectTower(tw: TowerActor): void {
    this.selectedTower = tw;
    this.showTowerPanel(tw);
    this.redrawRange();
  }

  private clearTowerSelection(): void {
    this.selectedTower = null;
    this.hideTowerPanel();
    this.redrawRange();
  }

  private hideTowerPanel(): void {
    if (this.towerPanel) {
      this.towerPanel.destroy(true);
      this.towerPanel = null;
    }
  }

  private showTowerPanel(tw: TowerActor): void {
    this.hideTowerPanel();
    const panelY = ROWS * TILE - 28;
    const root = this.add.container(GAME_W / 2, panelY).setDepth(150);
    this.towerPanel = root;

    const bg = this.add
      .rectangle(0, 0, 320, 52, COLOR.panel, 0.94)
      .setStrokeStyle(2, COLOR.gold);
    root.add(bg);

    const upCost = upgradeCost(tw.baseCost);
    const refund = sellRefund(tw.totalSpent);
    const atMax = tw.level >= 2;

    const upLabel = atMax
      ? t('play.maxLevel')
      : `${t('play.upgrade')} (${upCost})`;
    const upBg = this.add
      .rectangle(-78, 0, 140, 36, atMax ? COLOR.shade : COLOR.towerBlue)
      .setStrokeStyle(2, atMax ? 0x374151 : COLOR.gold)
      .setInteractive({ useHandCursor: !atMax });
    const upText = this.add
      .text(-78, 0, upLabel, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '14px',
        color: '#F3F4F6',
      })
      .setOrigin(0.5);
    if (!atMax) {
      upBg.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
        pointer.event?.stopPropagation?.();
        this.tryUpgradeSelected();
      });
    }
    root.add(upBg);
    root.add(upText);

    const sellBg = this.add
      .rectangle(78, 0, 140, 36, COLOR.shade)
      .setStrokeStyle(2, COLOR.enemyRed)
      .setInteractive({ useHandCursor: true });
    const sellText = this.add
      .text(78, 0, `${t('play.sell')} (+${refund})`, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '14px',
        color: '#F3F4F6',
      })
      .setOrigin(0.5);
    sellBg.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      pointer.event?.stopPropagation?.();
      this.trySellSelected();
    });
    root.add(sellBg);
    root.add(sellText);
  }

  private tryUpgradeSelected(): void {
    if (this.ended || this.paused) return;
    const tw = this.selectedTower;
    if (!tw || tw.level >= 2) {
      AudioBus.playUi('error');
      return;
    }
    const cost = upgradeCost(tw.baseCost);
    if (!GameState.spend(cost)) {
      AudioBus.playUi('error');
      this.goldText.setColor('#D64545');
      this.time.delayedCall(220, () => {
        this.goldText.setColor('#E8B84A');
      });
      return;
    }
    tw.level = 2;
    tw.totalSpent += cost;
    tw.def.damage = Math.floor(tw.def.damage * 1.4);
    tw.def.range = Math.floor(tw.def.range * 1.15);
    if (tw.kind === 'barracks') {
      tw.def.soldierHp = Math.floor(tw.def.soldierHp * 1.4);
      if (tw.soldier?.alive) {
        const bonus = tw.def.soldierHp - tw.soldier.maxHp;
        tw.soldier.maxHp = tw.def.soldierHp;
        tw.soldier.hp += Math.max(0, bonus);
        tw.soldier.hpFg.width = Math.max(1, 24 * (tw.soldier.hp / tw.soldier.maxHp));
      }
    }
    tw.sprite.setTint(0xffe08a);
    if (!tw.starMark) {
      const { x, y } = cellCenter(tw.col, tw.row);
      tw.starMark = this.add
        .text(x + 16, y - 18, '★', {
          fontFamily: 'system-ui, sans-serif',
          fontSize: '14px',
          color: '#E8B84A',
          fontStyle: 'bold',
        })
        .setOrigin(0.5)
        .setDepth(6);
    }
    AudioBus.playUi('confirm');
    this.refreshHud();
    this.showTowerPanel(tw);
    this.redrawRange();
  }

  private trySellSelected(): void {
    if (this.ended || this.paused) return;
    const tw = this.selectedTower;
    if (!tw) return;
    const refund = sellRefund(tw.totalSpent);
    GameState.addCoins(refund);
    const key = `${tw.col},${tw.row}`;
    this.occupied.delete(key);
    this.destroySoldier(tw);
    tw.sprite.destroy();
    tw.starMark?.destroy();
    this.towers = this.towers.filter((t) => t !== tw);
    this.clearTowerSelection();
    AudioBus.playUi('click');
    this.refreshHud();
  }

  private tryPlace(c: number, r: number): void {
    if (this.ended || this.paused) return;
    if (this.selected === 'barracks' && !GameState.isBarracksUnlocked()) {
      AudioBus.playUi('error');
      return;
    }
    const key = `${c},${r}`;
    if (!isPlaceableGrass(this.mapDef, c, r) || this.occupied.has(key)) {
      AudioBus.playUi('error');
      return;
    }
    const base = TOWERS[this.selected];
    if (!GameState.spend(base.cost)) {
      AudioBus.playUi('error');
      this.goldText.setColor('#D64545');
      this.time.delayedCall(220, () => {
        this.goldText.setColor('#E8B84A');
      });
      return;
    }
    const def = cloneTowerDef(this.selected);
    if (this.selected === 'arrow') {
      def.damage += GameState.arrowDamageBonus();
    }
    const { x, y } = cellCenter(c, r);
    const sprite = this.add.image(x, y, def.texture).setDisplaySize(52, 52).setDepth(5);
    const tw: TowerActor = {
      col: c,
      row: r,
      kind: this.selected,
      def,
      baseCost: base.cost,
      level: 1,
      totalSpent: base.cost,
      sprite,
      starMark: null,
      lastShot: 0,
      soldier: null,
    };
    this.towers.push(tw);
    this.occupied.add(key);
    AudioBus.playSfx('place');
    if (tw.kind === 'barracks') {
      this.spawnSoldier(tw);
    }
    this.refreshHud();
  }

  private tryStartWave(): void {
    if (this.ended || this.paused || this.waveLive || GameState.wave >= this.totalWaves) {
      AudioBus.playUi('error');
      return;
    }
    this.clearTowerSelection();
    GameState.wave += 1;
    this.waveLive = true;
    this.queueWave(GameState.wave);
    AudioBus.playSfx('start');
    AudioBus.playUi('confirm');
    this.refreshHud();
  }

  private queueWave(waveNum: number): void {
    const plan = this.mapDef.waves[waveNum - 1];
    if (!plan) return;
    const t0 = this.time.now;
    for (const group of plan) {
      for (let i = 0; i < group.count; i++) {
        this.pending.push({ kind: group.kind, at: t0 + group.delay + i * group.interval });
      }
    }
  }

  private spawnDue(now: number): void {
    if (this.pending.length === 0) return;
    const remain: PendingSpawn[] = [];
    for (const item of this.pending) {
      if (item.at <= now) this.spawnEnemy(item.kind);
      else remain.push(item);
    }
    this.pending = remain;
  }

  private spawnEnemy(kind: EnemyKind): void {
    const def = ENEMIES[kind];
    const start = this.waypoints[0];
    if (!start) return;
    const sprite = this.add.image(start.x, start.y, def.texture).setDepth(8);
    const sz = enemySpriteSize(kind);
    sprite.setDisplaySize(sz, sz);
    const hpBg = this.add.rectangle(start.x, start.y - 22, 28, 4, COLOR.shade).setDepth(11);
    const hpFg = this.add.rectangle(start.x, start.y - 22, 28, 4, COLOR.gold).setDepth(12);
    this.enemies.push({
      id: this.nextId++,
      kind,
      sprite,
      hpBg,
      hpFg,
      hp: def.hp,
      maxHp: def.hp,
      speed: def.speed,
      gold: def.gold,
      wp: 0,
      x: start.x,
      y: start.y,
      slowUntil: 0,
      slowFactor: 1,
      alive: true,
    });
  }

  private stepEnemies(delta: number, now: number): void {
    const dt = delta / 1000;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const factor = now < e.slowUntil ? e.slowFactor : 1;
      let budget = e.speed * factor * dt;
      const blocker = this.blockingSoldier(e);
      while (budget > 0 && e.wp < this.waypoints.length - 1) {
        if (blocker && Math.hypot(e.x - blocker.x, e.y - blocker.y) <= SOLDIER_BLOCK_R) {
          budget = 0;
          break;
        }
        const next = this.waypoints[e.wp + 1];
        if (!next) break;
        const dx = next.x - e.x;
        const dy = next.y - e.y;
        const dist = Math.hypot(dx, dy);
        if (dist <= budget || dist < 0.5) {
          e.x = next.x;
          e.y = next.y;
          e.wp += 1;
          budget -= dist;
        } else {
          e.x += (dx / dist) * budget;
          e.y += (dy / dist) * budget;
          budget = 0;
        }
      }
      e.sprite.setPosition(e.x, e.y);
      e.hpBg.setPosition(e.x, e.y - 22);
      e.hpFg.setPosition(e.x, e.y - 22);
      e.hpFg.width = Math.max(1, 28 * (e.hp / e.maxHp));
      if (e.wp >= this.waypoints.length - 1) {
        this.leak(e);
      }
    }
    this.enemies = this.enemies.filter((e) => e.alive);
  }

  private leak(e: EnemyActor): void {
    e.alive = false;
    e.sprite.destroy();
    e.hpBg.destroy();
    e.hpFg.destroy();
    AudioBus.playSfx('gate');
    const dead = GameState.hitGate(1);
    this.refreshHud();
    if (dead) this.fail();
  }

  private stepTowers(now: number): void {
    for (const tw of this.towers) {
      if (tw.kind === 'barracks') {
        this.stepBarracks(tw, now);
        continue;
      }
      if (now - tw.lastShot < tw.def.cooldown) continue;
      const pos = cellCenter(tw.col, tw.row);
      const target = this.nearestEnemy(pos.x, pos.y, tw.def.range);
      if (!target) continue;
      tw.lastShot = now;
      this.fire(tw, target, pos.x, pos.y);
    }
  }

  private stepBarracks(tw: TowerActor, now: number): void {
    if (tw.soldier?.alive) return;
    if (tw.lastShot > 0 && now - tw.lastShot < tw.def.cooldown) return;
    this.spawnSoldier(tw);
    tw.lastShot = now;
  }

  private closestPathWp(col: number, row: number): number {
    let best = 0;
    let bestD = Infinity;
    const last = this.mapDef.path.length - 1;
    for (let i = 0; i < last; i++) {
      const p = this.mapDef.path[i];
      if (!p) continue;
      const d = (p.c - col) * (p.c - col) + (p.r - row) * (p.r - row);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    return best;
  }

  private spawnSoldier(tw: TowerActor): void {
    this.destroySoldier(tw);
    const wp = this.closestPathWp(tw.col, tw.row);
    const cell = this.mapDef.path[wp];
    if (!cell) return;
    const { x, y } = cellCenter(cell.c, cell.r);
    const hp = Math.max(1, tw.def.soldierHp);
    const sprite = this.add.image(x, y, 'unit_soldier').setDisplaySize(32, 32).setDepth(7);
    const hpBg = this.add.rectangle(x, y - 20, 24, 4, COLOR.shade).setDepth(11);
    const hpFg = this.add.rectangle(x, y - 20, 24, 4, COLOR.barracks).setDepth(12);
    tw.soldier = {
      sprite,
      hpBg,
      hpFg,
      hp,
      maxHp: hp,
      wp,
      x,
      y,
      alive: true,
      lastStrike: 0,
    };
  }

  private destroySoldier(tw: TowerActor): void {
    const s = tw.soldier;
    if (!s) return;
    s.alive = false;
    s.sprite.destroy();
    s.hpBg.destroy();
    s.hpFg.destroy();
    tw.soldier = null;
  }

  private blockingSoldier(e: EnemyActor): SoldierActor | null {
    let best: SoldierActor | null = null;
    let bestD = SOLDIER_BLOCK_R;
    for (const tw of this.towers) {
      const s = tw.soldier;
      if (!s?.alive) continue;
      if (s.wp < e.wp) continue;
      const d = Math.hypot(s.x - e.x, s.y - e.y);
      if (d <= bestD) {
        bestD = d;
        best = s;
      }
    }
    return best;
  }

  private stepSoldiers(now: number): void {
    for (const tw of this.towers) {
      const s = tw.soldier;
      if (!s?.alive) continue;
      let foe: EnemyActor | null = null;
      let bestD = SOLDIER_BLOCK_R;
      for (const e of this.enemies) {
        if (!e.alive) continue;
        if (s.wp < e.wp) continue;
        const d = Math.hypot(e.x - s.x, e.y - s.y);
        if (d <= bestD) {
          bestD = d;
          foe = e;
        }
      }
      if (!foe) continue;
      if (now - s.lastStrike < SOLDIER_MELEE_MS) continue;
      s.lastStrike = now;
      this.hurt(foe, tw.def.damage, 1, 0);
      this.hurtSoldier(tw, enemyMeleeDamage(foe.kind));
      AudioBus.playSfx('hit');
    }
  }

  private hurtSoldier(tw: TowerActor, dmg: number): void {
    const s = tw.soldier;
    if (!s?.alive) return;
    s.hp -= dmg;
    s.hpFg.width = Math.max(1, 24 * (s.hp / s.maxHp));
    if (s.hp > 0) return;
    this.destroySoldier(tw);
    tw.lastShot = this.time.now;
    AudioBus.playSfx('die');
  }

  private nearestEnemy(x: number, y: number, range: number): EnemyActor | null {
    let best: EnemyActor | null = null;
    let bestD = range;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const d = Math.hypot(e.x - x, e.y - y);
      if (d <= bestD) {
        bestD = d;
        best = e;
      }
    }
    return best;
  }

  private fire(tw: TowerActor, target: EnemyActor, x: number, y: number): void {
    const def = tw.def;
    const dx = target.x - x;
    const dy = target.y - y;
    const dist = Math.hypot(dx, dy) || 1;
    const sprite = this.add.image(x, y, def.projectileKey).setDepth(10);
    sprite.setRotation(Math.atan2(dy, dx));
    this.shots.push({
      sprite,
      x,
      y,
      vx: (dx / dist) * def.projectileSpeed,
      vy: (dy / dist) * def.projectileSpeed,
      damage: def.damage,
      splash: def.splash,
      slowFactor: def.slowFactor,
      slowMs: def.slowMs,
      targetId: target.id,
      spent: false,
    });
    if (def.kind === 'arrow') AudioBus.playSfx('shot_arrow');
    else if (def.kind === 'cannon') AudioBus.playSfx('shot_cannon');
    else AudioBus.playSfx('shot_frost');
  }

  private stepShots(delta: number): void {
    const dt = delta / 1000;
    for (const s of this.shots) {
      if (s.spent) continue;
      const tgt = this.enemies.find((e) => e.alive && e.id === s.targetId);
      if (tgt) {
        const dx = tgt.x - s.x;
        const dy = tgt.y - s.y;
        const dist = Math.hypot(dx, dy) || 1;
        const spd = Math.hypot(s.vx, s.vy);
        s.vx = (dx / dist) * spd;
        s.vy = (dy / dist) * spd;
        s.sprite.setRotation(Math.atan2(dy, dx));
        if (dist < 16) {
          this.impact(s, tgt.x, tgt.y);
          continue;
        }
      }
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.sprite.setPosition(s.x, s.y);
      if (s.x < -40 || s.y < -40 || s.x > GAME_W + 40 || s.y > GAME_H + 40) {
        s.spent = true;
        s.sprite.destroy();
      }
    }
    this.shots = this.shots.filter((s) => !s.spent);
  }

  private impact(s: ShotActor, ix: number, iy: number): void {
    s.spent = true;
    s.sprite.destroy();
    AudioBus.playSfx('hit');
    const fx = this.add.image(ix, iy, 'fx_hit').setDepth(13);
    this.time.delayedCall(80, () => {
      fx.destroy();
    });
    if (s.splash > 0) {
      for (const e of this.enemies) {
        if (!e.alive) continue;
        if (Math.hypot(e.x - ix, e.y - iy) <= s.splash) {
          this.hurt(e, s.damage, s.slowFactor, s.slowMs);
        }
      }
    } else {
      const tgt = this.enemies.find((e) => e.alive && e.id === s.targetId);
      if (tgt) this.hurt(tgt, s.damage, s.slowFactor, s.slowMs);
    }
  }

  private hurt(e: EnemyActor, dmg: number, slowFactor: number, slowMs: number): void {
    if (!e.alive) return;
    e.hp -= dmg;
    if (slowMs > 0) {
      e.slowUntil = this.time.now + slowMs;
      e.slowFactor = slowFactor;
    }
    if (e.hp <= 0) {
      e.alive = false;
      e.sprite.destroy();
      e.hpBg.destroy();
      e.hpFg.destroy();
      GameState.addCoins(e.gold);
      AudioBus.playSfx('die');
      AudioBus.playSfx('coin');
      this.refreshHud();
    }
  }

  private checkWaveEnd(): void {
    if (!this.waveLive || this.ended || this.paused) return;
    if (this.pending.length > 0) return;
    if (this.enemies.some((e) => e.alive)) return;
    this.waveLive = false;
    this.refreshHud();
    if (GameState.wave >= this.totalWaves && GameState.gateHp > 0) {
      this.win();
    }
  }

  private togglePause(): void {
    if (this.ended || this.navigating) return;
    if (this.paused) {
      this.resumePlay();
    } else {
      this.pausePlay();
    }
  }

  private pausePlay(): void {
    if (this.paused || this.ended) return;
    this.paused = true;
    this.time.paused = true;
    this.clearTowerSelection();
    this.hoverCol = -1;
    this.hoverRow = -1;
    this.rangeGfx.clear();
    AudioBus.playUi('click');
    this.showPauseOverlay();
    this.refreshHud();
  }

  private resumePlay(): void {
    if (!this.paused) return;
    this.paused = false;
    this.time.paused = false;
    this.hidePauseOverlay();
    AudioBus.playUi('click');
    this.refreshHud();
    this.redrawRange();
  }

  private hidePauseOverlay(): void {
    if (this.pauseOverlay) {
      this.pauseOverlay.destroy(true);
      this.pauseOverlay = null;
    }
  }

  private showPauseOverlay(): void {
    this.hidePauseOverlay();
    const root = this.add.container(0, 0).setDepth(210);
    this.pauseOverlay = root;

    const dim = this.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, COLOR.panel, 0.78);
    dim.setInteractive();
    root.add(dim);

    root.add(
      this.add
        .text(GAME_W / 2, GAME_H / 2 - 70, t('play.pause'), {
          fontFamily: 'system-ui, sans-serif',
          fontSize: '32px',
          color: '#E8B84A',
          fontStyle: 'bold',
        })
        .setOrigin(0.5),
    );

    const btnW = 200;
    const btnH = 48;
    const resumeBg = this.add
      .rectangle(GAME_W / 2, GAME_H / 2 + 10, btnW, btnH, COLOR.towerBlue)
      .setStrokeStyle(2, COLOR.gold)
      .setInteractive({ useHandCursor: true });
    const resumeLabel = this.add
      .text(GAME_W / 2, GAME_H / 2 + 10, t('play.resume'), {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '18px',
        color: '#F3F4F6',
      })
      .setOrigin(0.5);
    resumeBg.on('pointerdown', () => {
      this.resumePlay();
    });
    root.add(resumeBg);
    root.add(resumeLabel);

    const menuBg = this.add
      .rectangle(GAME_W / 2, GAME_H / 2 + 74, btnW, btnH, COLOR.shade)
      .setStrokeStyle(2, 0x374151)
      .setInteractive({ useHandCursor: true });
    const menuLabel = this.add
      .text(GAME_W / 2, GAME_H / 2 + 74, t('play.menu'), {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '18px',
        color: '#F3F4F6',
      })
      .setOrigin(0.5);
    menuBg.on('pointerdown', () => {
      void this.onPauseMenu();
    });
    root.add(menuBg);
    root.add(menuLabel);
  }

  /** Mid-run leave via pause: skip interstitial. */
  private async onPauseMenu(): Promise<void> {
    if (this.navigating) return;
    this.navigating = true;
    AudioBus.playUi('click');
    this.paused = false;
    this.time.paused = false;
    this.scene.start('MenuScene');
  }

  private win(): void {
    if (this.ended) return;
    this.ended = true;
    this.clearTowerSelection();
    this.lastWinStars = starsForGate(GameState.gateHp, GameState.maxGateHp);
    this.lastWinMeta = hookLevelComplete(this.lastWinStars);
    this.metaDoubled = false;
    this.showBanner(t('play.win'), true);
  }

  private fail(): void {
    if (this.ended) return;
    this.ended = true;
    this.waveLive = false;
    this.pending = [];
    this.clearTowerSelection();
    hookLevelFail();
    this.showBanner(t('play.fail'), false);
  }

  private showBanner(title: string, victory: boolean): void {
    if (this.endOverlay) {
      this.endOverlay.destroy(true);
      this.endOverlay = null;
    }
    this.hidePauseOverlay();

    const root = this.add.container(0, 0).setDepth(200);
    this.endOverlay = root;

    const dim = this.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, COLOR.panel, 0.78);
    dim.setInteractive();
    root.add(dim);

    const titleY = victory ? GAME_H / 2 - 90 : GAME_H / 2 - 110;
    root.add(
      this.add
        .text(GAME_W / 2, titleY, title, {
          fontFamily: 'system-ui, sans-serif',
          fontSize: '36px',
          color: victory ? '#E8B84A' : '#D64545',
          fontStyle: 'bold',
        })
        .setOrigin(0.5),
    );

    if (victory) {
      root.add(
        this.add
          .text(GAME_W / 2, titleY + 42, starString(this.lastWinStars), {
            fontFamily: 'system-ui, sans-serif',
            fontSize: '28px',
            color: '#E8B84A',
          })
          .setOrigin(0.5),
      );
      if (this.lastWinMeta > 0) {
        root.add(
          this.add
            .text(GAME_W / 2, titleY + 72, t('play.metaGain', { n: this.lastWinMeta }), {
              fontFamily: 'system-ui, sans-serif',
              fontSize: '16px',
              color: '#E8B84A',
            })
            .setOrigin(0.5),
        );
      }
    }

    const btnW = 200;
    const btnH = 48;
    const gap = 16;
    let cy = victory ? GAME_H / 2 + 8 : GAME_H / 2 - 20;

    if (victory && this.lastWinMeta > 0 && !this.metaDoubled) {
      const dblBg = this.add
        .rectangle(GAME_W / 2, cy, btnW, btnH, COLOR.towerBlue)
        .setStrokeStyle(2, COLOR.gold)
        .setInteractive({ useHandCursor: true });
      const dblLabel = this.add
        .text(GAME_W / 2, cy, t('play.doubleMeta'), {
          fontFamily: 'system-ui, sans-serif',
          fontSize: '18px',
          color: '#F3F4F6',
        })
        .setOrigin(0.5);
      dblBg.on('pointerdown', () => {
        void this.onDoubleMeta();
      });
      root.add(dblBg);
      root.add(dblLabel);
      cy += btnH + gap;
    }

    if (!victory) {
      const contBg = this.add
        .rectangle(GAME_W / 2, cy, btnW, btnH, COLOR.towerBlue)
        .setStrokeStyle(2, COLOR.gold)
        .setInteractive({ useHandCursor: true });
      const contLabel = this.add
        .text(GAME_W / 2, cy, t('play.continue'), {
          fontFamily: 'system-ui, sans-serif',
          fontSize: '18px',
          color: '#F3F4F6',
        })
        .setOrigin(0.5);
      contBg.on('pointerdown', () => {
        void this.onContinue();
      });
      root.add(contBg);
      root.add(contLabel);
      cy += btnH / 2 + 18;
      root.add(
        this.add
          .text(GAME_W / 2, cy, t('play.continueHint'), {
            fontFamily: 'system-ui, sans-serif',
            fontSize: '13px',
            color: '#F3F4F6',
          })
          .setOrigin(0.5)
          .setAlpha(0.8),
      );
      cy += 36;
    }

    const retryBg = this.add
      .rectangle(GAME_W / 2, cy, btnW, btnH, COLOR.shade)
      .setStrokeStyle(2, COLOR.gold)
      .setInteractive({ useHandCursor: true });
    const retryLabel = this.add
      .text(GAME_W / 2, cy, t('play.retry'), {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '18px',
        color: '#F3F4F6',
      })
      .setOrigin(0.5);
    retryBg.on('pointerdown', () => {
      void this.onRetry();
    });
    root.add(retryBg);
    root.add(retryLabel);
    cy += btnH + gap;

    const menuBg = this.add
      .rectangle(GAME_W / 2, cy, btnW, btnH, COLOR.shade)
      .setStrokeStyle(2, 0x374151)
      .setInteractive({ useHandCursor: true });
    const menuLabel = this.add
      .text(GAME_W / 2, cy, t('play.menu'), {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '18px',
        color: '#F3F4F6',
      })
      .setOrigin(0.5);
    menuBg.on('pointerdown', () => {
      void this.onMenu();
    });
    root.add(menuBg);
    root.add(menuLabel);
  }

  private async onDoubleMeta(): Promise<void> {
    if (this.navigating || !this.ended || this.metaDoubled || this.lastWinMeta <= 0) return;
    this.navigating = true;
    AudioBus.playUi('click');
    const ok = await ads.showRewardedVideo();
    this.navigating = false;
    if (!ok) return;
    GameState.addMetaGold(this.lastWinMeta);
    this.metaDoubled = true;
    this.lastWinMeta *= 2;
    void saveGameState(GameState.snapshot());
    this.showBanner(t('play.win'), true);
  }

  private async onRetry(): Promise<void> {
    if (this.navigating) return;
    this.navigating = true;
    AudioBus.playUi('click');
    await ads.showFullscreen();
    this.scene.restart();
  }

  private async onMenu(): Promise<void> {
    if (this.navigating) return;
    this.navigating = true;
    AudioBus.playUi('click');
    await ads.showFullscreen();
    this.scene.start('MenuScene');
  }

  private async onContinue(): Promise<void> {
    if (this.navigating || !this.ended) return;
    this.navigating = true;
    AudioBus.playUi('click');
    const ok = await ads.showRewardedVideo();
    if (!ok) {
      this.navigating = false;
      return;
    }
    GameState.gateHp = Math.max(1, GameState.gateHp);
    this.clearEnemiesOnGateCell();
    this.ended = false;
    this.navigating = false;
    if (this.endOverlay) {
      this.endOverlay.destroy(true);
      this.endOverlay = null;
    }
    this.refreshHud();
    this.redrawRange();
  }

  private clearEnemiesOnGateCell(): void {
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const c = Math.floor(e.x / TILE);
      const r = Math.floor(e.y / TILE);
      if (c === this.mapDef.gate.c && r === this.mapDef.gate.r) {
        e.alive = false;
        e.sprite.destroy();
        e.hpBg.destroy();
        e.hpFg.destroy();
      }
    }
    this.enemies = this.enemies.filter((e) => e.alive);
  }
}

function starsForGate(gateHp: number, maxGateHp: number): number {
  if (maxGateHp <= 0) return 1;
  if (gateHp >= maxGateHp) return 3;
  if (gateHp >= maxGateHp / 2) return 2;
  return 1;
}
