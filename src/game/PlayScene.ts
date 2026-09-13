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

type TargetMode = 'first' | 'closest' | 'strong';

const TARGET_MODES: TargetMode[] = ['first', 'closest', 'strong'];

interface EnemyActor {
  id: number;
  kind: EnemyKind;
  sprite: Phaser.GameObjects.Image;
  shadow: Phaser.GameObjects.Ellipse;
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
  shadow: Phaser.GameObjects.Ellipse;
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
  shadow: Phaser.GameObjects.Ellipse;
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

interface FloatDmgActor {
  text: Phaser.GameObjects.Text;
  x: number;
  startY: number;
  age: number;
  life: number;
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

const HUD_KINDS: TowerKind[] = ['arrow', 'cannon', 'frost', 'lightning', 'barracks'];


const SOLDIER_MELEE_MS = 400;
const SOLDIER_BLOCK_R = 30;
const BUILD_SECONDS = 15;
const FLOAT_DMG_CAP = 20;
const FLOAT_DMG_MS = 450;
const FLOAT_DMG_RISE = 24;
const BOSS_BAR_W = 320;
const BOSS_BAR_H = 14;
const STREAK_MS = 1800;

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


/** Soft elliptical contact shadow (Pixar-appeal ground contact). */
function contactShadow(
  scene: Phaser.Scene,
  x: number,
  y: number,
  width: number,
  height: number,
  depth: number,
): Phaser.GameObjects.Ellipse {
  return scene.add
    .ellipse(x, y, width, height, 0x000000, 0.25)
    .setDepth(depth);
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
  private speedMul = 1;
  private speedLabel!: Phaser.GameObjects.Text;
  private targetMode: TargetMode = 'first';
  private targetLabel!: Phaser.GameObjects.Text;
  private nextWaveText!: Phaser.GameObjects.Text;
  private towerPanel: Phaser.GameObjects.Container | null = null;
  private selectedTower: TowerActor | null = null;
  private navigating = false;
  private lastWinStars = 0;
  private lastWinMeta = 0;
  private metaDoubled = false;
  private mapDef!: MapDef;
  private totalWaves = 3;
  /** Scene-time deadline for auto-start; 0 = inactive. */
  private buildDeadline = 0;
  private tutorialOpen = false;
  private tutorialStep = 0;
  private tutorialOverlay: Phaser.GameObjects.Container | null = null;
  private floatDmgs: FloatDmgActor[] = [];
  private bossBarRoot: Phaser.GameObjects.Container | null = null;
  private bossBarFill: Phaser.GameObjects.Rectangle | null = null;
  private bossBarLabel: Phaser.GameObjects.Text | null = null;
  private runKills = 0;
  private goldEarned = 0;
  private runMs = 0;
  private killStreak = 0;
  private lastKillAt = 0;
  private streakLabel!: Phaser.GameObjects.Text;

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
    this.speedMul = 1;
    this.targetMode = 'first';
    this.time.timeScale = 1;
    this.time.paused = false;
    this.buildDeadline = 0;
    this.tutorialOpen = false;
    this.tutorialStep = 0;
    this.tutorialOverlay = null;
    for (const f of this.floatDmgs) f.text.destroy();
    this.floatDmgs = [];
    this.bossBarRoot = null;
    this.bossBarFill = null;
    this.bossBarLabel = null;
    this.runKills = 0;
    this.goldEarned = 0;
    this.runMs = 0;
    this.killStreak = 0;
    this.lastKillAt = 0;

    this.mapDef = getMap(GameState.selectedMapId);
    this.totalWaves = this.mapDef.waves.length;

    AudioBus.playMusic('play');
    this.cameras.main.setBackgroundColor(`#${COLOR.shade.toString(16).padStart(6, '0')}`);

    this.waypoints = this.mapDef.path.map((p) => cellCenter(p.c, p.r));
    this.drawField();
    this.rangeGfx = this.add.graphics().setDepth(3);
    this.buildHud();
    this.buildBossBar();
    this.buildPauseButton();
    this.buildSpeedButton();
    this.buildTargetButton();

    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (this.ended || this.paused || this.tutorialOpen || p.y >= ROWS * TILE) {
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
      if (this.ended || this.paused || this.tutorialOpen) return;
      if (p.y >= ROWS * TILE) return;
      const c = Math.floor(p.x / TILE);
      const r = Math.floor(p.y / TILE);
      this.onFieldTap(c, r);
    });

    this.maybeShowTutorial();
  }

  update(_time: number, delta: number): void {
    if (this.ended || this.paused || this.tutorialOpen) return;
    const now = this.time.now;
    // Scene delta is not scaled by Clock.timeScale; multiply for movement/shots.
    const dt = delta * this.speedMul;
    this.runMs += dt;
    this.tickBuildTimer();
    this.spawnDue(now);
    this.stepEnemies(dt, now);
    this.stepSoldiers(now);
    this.stepTowers(now);
    this.stepShots(dt);
    this.stepFloatDmgs(dt);
    this.tickKillStreak(now);
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

    this.streakLabel = this.add
      .text(16, 40, '', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '15px',
        color: '#86EFAC',
        backgroundColor: '#111827',
        padding: { x: 8, y: 3 },
        fontStyle: 'bold',
      })
      .setDepth(110)
      .setAlpha(0)
      .setVisible(false);

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

    this.nextWaveText = this.add
      .text(16, 54, '', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '12px',
        color: '#E8B84A',
      })
      .setAlpha(0.9)
      .setDepth(110);

    HUD_KINDS.forEach((kind, i) => {
      const x = 48 + i * 98;
      const y = y0 + HUD_H / 2;
      const locked =
        (kind === 'barracks' && !GameState.isBarracksUnlocked()) ||
        (kind === 'lightning' && !GameState.isLightningUnlocked());
      const mark = this.add
        .rectangle(x, y, 94, 70, 0x162033)
        .setStrokeStyle(3, this.selected === kind ? COLOR.gold : 0x4b5568)
        .setDepth(102)
        .setInteractive({ useHandCursor: !locked })
        .setAlpha(locked ? 0.5 : 1);
      this.selectMarks.push(mark);
      const icon = this.add
        .image(x - 28, y, TOWERS[kind].texture)
        .setDisplaySize(36, 36)
        .setDepth(103);
      if (locked) icon.setTint(0x667066);
      this.selectIcons.push(icon);
      this.add
        .text(x + 14, y - 12, t(`tower.${kind}`), {
          fontFamily: 'system-ui, sans-serif',
          fontSize: '11px',
          color: locked ? '#9CA3AF' : '#F3F4F6',
        })
        .setOrigin(0.5)
        .setDepth(103);
      this.add
        .text(x + 14, y + 10, locked ? t('menu.locked') : `${TOWERS[kind].cost}`, {
          fontFamily: 'system-ui, sans-serif',
          fontSize: '11px',
          color: locked ? '#9CA3AF' : '#E8B84A',
        })
        .setOrigin(0.5)
        .setDepth(103);
      mark.on('pointerdown', () => {
        if (this.paused || this.tutorialOpen) return;
        if (
          (kind === 'barracks' && !GameState.isBarracksUnlocked()) ||
          (kind === 'lightning' && !GameState.isLightningUnlocked())
        ) {
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
      .setStrokeStyle(3, COLOR.gold)
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
      if (this.paused || this.tutorialOpen) return;
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

  private buildSpeedButton(): void {
    const x = GAME_W - 76;
    const y = 28;
    const bg = this.add
      .rectangle(0, 0, 44, 36, COLOR.panel, 0.92)
      .setStrokeStyle(2, COLOR.gold)
      .setInteractive({ useHandCursor: true });
    this.speedLabel = this.add
      .text(0, 0, t('play.speed1'), {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '14px',
        color: '#F3F4F6',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    this.add.container(x, y, [bg, this.speedLabel]).setDepth(120);
    bg.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      pointer.event?.stopPropagation?.();
      this.toggleSpeed();
    });
  }

  private toggleSpeed(): void {
    if (this.ended || this.paused) return;
    this.speedMul = this.speedMul >= 2 ? 1 : 2;
    this.time.timeScale = this.speedMul;
    this.speedLabel.setText(this.speedMul >= 2 ? t('play.speed2') : t('play.speed1'));
    AudioBus.playUi('click');
  }

  private buildTargetButton(): void {
    const x = GAME_W - 186;
    const y = 28;
    const bg = this.add
      .rectangle(0, 0, 128, 36, COLOR.panel, 0.92)
      .setStrokeStyle(2, COLOR.gold)
      .setInteractive({ useHandCursor: true });
    this.targetLabel = this.add
      .text(0, 0, this.targetModeLabel(), {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '11px',
        color: '#F3F4F6',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    this.add.container(x, y, [bg, this.targetLabel]).setDepth(120);
    bg.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      pointer.event?.stopPropagation?.();
      this.cycleTargetMode();
    });
  }

  private targetModeLabel(): string {
    if (this.targetMode === 'closest') return t('play.targetClosest');
    if (this.targetMode === 'strong') return t('play.targetStrong');
    return t('play.targetFirst');
  }

  private cycleTargetMode(): void {
    if (this.ended || this.paused) return;
    const idx = TARGET_MODES.indexOf(this.targetMode);
    this.targetMode = TARGET_MODES[(idx + 1) % TARGET_MODES.length] ?? 'first';
    if (this.targetLabel) this.targetLabel.setText(this.targetModeLabel());
    AudioBus.playUi('click');
  }

  private refreshSelect(): void {
    this.selectMarks.forEach((mark, i) => {
      const kind = HUD_KINDS[i];
      if (!kind) return;
      const locked =
        (kind === 'barracks' && !GameState.isBarracksUnlocked()) ||
        (kind === 'lightning' && !GameState.isLightningUnlocked());
      mark.setStrokeStyle(3, this.selected === kind ? COLOR.gold : 0x4b5568);
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
    const canStart =
      !this.ended && !this.waveLive && !this.paused && !this.tutorialOpen && GameState.wave < this.totalWaves;
    this.startBg.setFillStyle(canStart ? COLOR.towerBlue : COLOR.shade);
    this.startBg.setAlpha(canStart ? 1 : 0.55);
    const secs = this.buildSecondsLeft();
    if (canStart && secs !== null) {
      this.startLabel.setText(t('play.autoStart', { n: secs }));
    } else if (canStart) {
      this.startLabel.setText(t('play.startWave'));
    } else {
      this.startLabel.setText(t('play.waiting'));
    }
    this.refreshNextWavePreview();
    if (this.speedLabel) {
      this.speedLabel.setText(this.speedMul >= 2 ? t('play.speed2') : t('play.speed1'));
    }
    if (this.targetLabel) {
      this.targetLabel.setText(this.targetModeLabel());
    }
    this.refreshBossBar();
  }

  private refreshNextWavePreview(): void {
    if (!this.nextWaveText) return;
    if (this.waveLive || this.ended || GameState.wave >= this.totalWaves) {
      this.nextWaveText.setText('');
      this.nextWaveText.setVisible(false);
      return;
    }
    const plan = this.mapDef.waves[GameState.wave];
    if (!plan || plan.length === 0) {
      this.nextWaveText.setText('');
      this.nextWaveText.setVisible(false);
      return;
    }
    const parts = plan.map((g) => `${t(`enemy.${g.kind}`)}×${g.count}`);
    this.nextWaveText.setText(t('play.nextWave', { list: parts.join(', ') }));
    this.nextWaveText.setVisible(true);
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
    if (tw.kind === 'lightning') {
      tw.def.chainHops = Math.min(4, tw.def.chainHops + 1);
      tw.def.chainRange = Math.floor(tw.def.chainRange * 1.15);
    }
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
    tw.shadow.destroy();
    tw.starMark?.destroy();
    this.towers = this.towers.filter((t) => t !== tw);
    this.clearTowerSelection();
    AudioBus.playUi('click');
    this.refreshHud();
  }

  private tryPlace(c: number, r: number): void {
    if (this.ended || this.paused) return;
    if (
      (this.selected === 'barracks' && !GameState.isBarracksUnlocked()) ||
      (this.selected === 'lightning' && !GameState.isLightningUnlocked())
    ) {
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
    } else if (this.selected === 'cannon') {
      def.damage += GameState.cannonDamageBonus();
    } else if (this.selected === 'frost') {
      def.damage += GameState.frostDamageBonus();
    }
    const { x, y } = cellCenter(c, r);
    const shadow = contactShadow(this, x, y + 22, 40, 14, 4);
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
      shadow,
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
    if (
      this.ended ||
      this.paused ||
      this.tutorialOpen ||
      this.waveLive ||
      GameState.wave >= this.totalWaves
    ) {
      AudioBus.playUi('error');
      return;
    }
    this.cancelBuildTimer();
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
    const sz = enemySpriteSize(kind);
    const shadow = contactShadow(this, start.x, start.y + sz * 0.38, sz * 0.72, sz * 0.28, 6);
    const sprite = this.add.image(start.x, start.y, def.texture).setDepth(8);
    sprite.setDisplaySize(sz, sz);
    const hpBg = this.add.rectangle(start.x, start.y - 22, 28, 4, COLOR.shade).setDepth(11);
    const hpFg = this.add.rectangle(start.x, start.y - 22, 28, 4, COLOR.gold).setDepth(12);
    const hp = Math.max(1, Math.round(def.hp * GameState.enemyHpMult()));
    const speed = def.speed * GameState.enemySpeedMult();
    this.enemies.push({
      id: this.nextId++,
      kind,
      sprite,
      shadow,
      hpBg,
      hpFg,
      hp,
      maxHp: hp,
      speed,
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
      const esz = enemySpriteSize(e.kind);
      e.shadow.setPosition(e.x, e.y + esz * 0.38);
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
    e.shadow.destroy();
    e.hpBg.destroy();
    e.hpFg.destroy();
    AudioBus.playSfx('gate');
    if (!this.ended) {
      this.cameras.main.shake(120, 0.004);
    }
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
      const target = this.pickEnemy(pos.x, pos.y, tw.def.range);
      if (!target) continue;
      tw.lastShot = now;
      if (tw.kind === 'lightning') {
        this.fireLightning(tw, target, pos.x, pos.y);
      } else {
        this.fire(tw, target, pos.x, pos.y);
      }
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
    const shadow = contactShadow(this, x, y + 12, 26, 10, 6);
    const sprite = this.add.image(x, y, 'unit_soldier').setDisplaySize(32, 32).setDepth(7);
    const hpBg = this.add.rectangle(x, y - 20, 24, 4, COLOR.shade).setDepth(11);
    const hpFg = this.add.rectangle(x, y - 20, 24, 4, COLOR.barracks).setDepth(12);
    tw.soldier = {
      sprite,
      shadow,
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
    s.shadow.destroy();
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
      const candidates: EnemyActor[] = [];
      for (const e of this.enemies) {
        if (!e.alive) continue;
        if (s.wp < e.wp) continue;
        const d = Math.hypot(e.x - s.x, e.y - s.y);
        if (d <= SOLDIER_BLOCK_R) candidates.push(e);
      }
      const foe = this.pickEnemyFrom(s.x, s.y, candidates);
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

  private pickEnemy(x: number, y: number, range: number): EnemyActor | null {
    const candidates: EnemyActor[] = [];
    for (const e of this.enemies) {
      if (!e.alive) continue;
      if (Math.hypot(e.x - x, e.y - y) <= range) candidates.push(e);
    }
    return this.pickEnemyFrom(x, y, candidates);
  }

  /** Path progress: waypoint index + fraction toward next waypoint (0..1). */
  private enemyProgress(e: EnemyActor): number {
    const next = this.waypoints[e.wp + 1];
    if (!next) return e.wp + 1;
    const prev = this.waypoints[e.wp];
    if (!prev) return e.wp;
    const seg = Math.hypot(next.x - prev.x, next.y - prev.y) || 1;
    const toNext = Math.hypot(next.x - e.x, next.y - e.y);
    const along = Math.max(0, Math.min(1, 1 - toNext / seg));
    return e.wp + along;
  }

  private pickEnemyFrom(x: number, y: number, candidates: EnemyActor[]): EnemyActor | null {
    if (candidates.length === 0) return null;
    let best: EnemyActor | null = null;
    let bestDist = Infinity;
    let bestProgress = -Infinity;
    let bestHp = -Infinity;
    for (const e of candidates) {
      const d = Math.hypot(e.x - x, e.y - y);
      if (this.targetMode === 'closest') {
        if (!best || d < bestDist) {
          best = e;
          bestDist = d;
        }
        continue;
      }
      if (this.targetMode === 'strong') {
        const hp = e.hp;
        if (!best || hp > bestHp || (hp === bestHp && d < bestDist)) {
          best = e;
          bestHp = hp;
          bestDist = d;
        }
        continue;
      }
      // first — furthest along path; tie-break higher progress / closer to next wp, then closer
      const prog = this.enemyProgress(e);
      if (
        !best ||
        prog > bestProgress ||
        (prog === bestProgress && d < bestDist)
      ) {
        best = e;
        bestProgress = prog;
        bestDist = d;
      }
    }
    return best;
  }

  private fireLightning(tw: TowerActor, primary: EnemyActor, x: number, y: number): void {
    const hops = Math.max(0, tw.def.chainHops);
    const chainRange = Math.max(40, tw.def.chainRange);
    const hit: EnemyActor[] = [primary];
    let from = primary;
    for (let h = 0; h < hops; h++) {
      let best: EnemyActor | null = null;
      let bestD = Infinity;
      for (const e of this.enemies) {
        if (!e.alive || hit.includes(e)) continue;
        const d = Math.hypot(e.x - from.x, e.y - from.y);
        if (d <= chainRange && d < bestD) {
          best = e;
          bestD = d;
        }
      }
      if (!best) break;
      hit.push(best);
      from = best;
    }

    const g = this.add.graphics().setDepth(14);
    g.lineStyle(3, COLOR.lightning, 0.95);
    let px = x;
    let py = y;
    for (const e of hit) {
      g.lineBetween(px, py, e.x, e.y);
      px = e.x;
      py = e.y;
    }
    this.time.delayedCall(90, () => {
      g.destroy();
    });

    AudioBus.playSfx('shot_lightning');
    hit.forEach((e, i) => {
      const falloff = i === 0 ? 1 : i === 1 ? 0.7 : 0.5;
      const dmg = Math.max(1, Math.floor(tw.def.damage * falloff));
      this.hurt(e, dmg, 1, 0);
      const fx = this.add.image(e.x, e.y, 'projectile_lightning').setDisplaySize(22, 22).setDepth(13);
      this.time.delayedCall(70, () => {
        fx.destroy();
      });
    });
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
    this.spawnFloatDmg(e.x, e.y, dmg, slowMs > 0);
    if (slowMs > 0) {
      e.slowUntil = this.time.now + slowMs;
      e.slowFactor = slowFactor;
    }
    if (e.hp <= 0) {
      e.alive = false;
      e.sprite.destroy();
      e.shadow.destroy();
      e.hpBg.destroy();
      e.hpFg.destroy();
      this.runKills += 1;
      const now = this.time.now;
      if (this.lastKillAt > 0 && now - this.lastKillAt <= STREAK_MS) {
        this.killStreak += 1;
      } else {
        this.killStreak = 1;
      }
      this.lastKillAt = now;
      const bonus = Math.min(5, Math.max(0, this.killStreak - 1));
      const gained = e.gold + bonus;
      this.goldEarned += gained;
      GameState.addCoins(gained);
      if (bonus > 0) {
        this.spawnFloatBonus(e.x, e.y, bonus);
      }
      this.showStreakLabel();
      if (e.kind === 'brute' && !this.ended) {
        this.cameras.main.shake(180, 0.006);
      }
      AudioBus.playSfx('die');
      AudioBus.playSfx('coin');
      this.refreshHud();
    }
  }

  private spawnFloatDmg(x: number, y: number, dmg: number, frost: boolean): void {
    const amount = Math.max(0, Math.round(dmg));
    if (amount <= 0) return;
    while (this.floatDmgs.length >= FLOAT_DMG_CAP) {
      const oldest = this.floatDmgs.shift();
      oldest?.text.destroy();
    }
    const color = frost ? '#22D3EE' : '#E8B84A';
    const text = this.add
      .text(x, y - 28, String(amount), {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '18px',
        color,
        fontStyle: 'bold',
        stroke: '#111827',
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(14);
    this.floatDmgs.push({
      text,
      x,
      startY: y - 28,
      age: 0,
      life: FLOAT_DMG_MS,
    });
  }

  private stepFloatDmgs(delta: number): void {
    const remain: FloatDmgActor[] = [];
    for (const f of this.floatDmgs) {
      f.age += delta;
      const p = Math.min(1, f.age / f.life);
      f.text.setPosition(f.x, f.startY - FLOAT_DMG_RISE * p);
      f.text.setAlpha(1 - p);
      if (f.age >= f.life) {
        f.text.destroy();
      } else {
        remain.push(f);
      }
    }
    this.floatDmgs = remain;
  }

  private spawnFloatBonus(x: number, y: number, amount: number): void {
    const n = Math.max(0, Math.round(amount));
    if (n <= 0) return;
    while (this.floatDmgs.length >= FLOAT_DMG_CAP) {
      const oldest = this.floatDmgs.shift();
      oldest?.text.destroy();
    }
    const text = this.add
      .text(x, y - 40, `+${n}`, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '18px',
        color: '#86EFAC',
        fontStyle: 'bold',
        stroke: '#111827',
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(14);
    this.floatDmgs.push({
      text,
      x,
      startY: y - 40,
      age: 0,
      life: FLOAT_DMG_MS,
    });
  }

  private showStreakLabel(): void {
    if (!this.streakLabel) return;
    if (this.killStreak < 2) {
      this.hideStreakLabel();
      return;
    }
    this.streakLabel.setText(t('play.streak', { n: this.killStreak }));
    this.streakLabel.setVisible(true);
    this.streakLabel.setAlpha(1);
  }

  private hideStreakLabel(): void {
    if (!this.streakLabel) return;
    this.streakLabel.setVisible(false);
    this.streakLabel.setAlpha(0);
    this.streakLabel.setText('');
  }

  private tickKillStreak(now: number): void {
    if (this.killStreak <= 0 || this.lastKillAt <= 0) return;
    const elapsed = now - this.lastKillAt;
    if (elapsed >= STREAK_MS) {
      this.resetKillStreak();
      return;
    }
    if (this.killStreak >= 2 && this.streakLabel?.visible) {
      // Fade in the last ~400ms of the streak window.
      const remain = STREAK_MS - elapsed;
      if (remain < 400) {
        this.streakLabel.setAlpha(Math.max(0, remain / 400));
      } else {
        this.streakLabel.setAlpha(1);
      }
    }
  }

  private resetKillStreak(): void {
    this.killStreak = 0;
    this.lastKillAt = 0;
    this.hideStreakLabel();
  }

  private buildBossBar(): void {
    const y = 48;
    const bg = this.add
      .rectangle(0, 0, BOSS_BAR_W + 8, BOSS_BAR_H + 28, COLOR.panel, 0.92)
      .setStrokeStyle(2, COLOR.gold);
    const track = this.add.rectangle(0, 8, BOSS_BAR_W, BOSS_BAR_H, COLOR.shade);
    this.bossBarFill = this.add
      .rectangle(-BOSS_BAR_W / 2, 8, BOSS_BAR_W, BOSS_BAR_H, COLOR.enemyRed)
      .setOrigin(0, 0.5);
    this.bossBarLabel = this.add
      .text(0, -10, '', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '13px',
        color: '#F3F4F6',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    this.bossBarRoot = this.add
      .container(GAME_W / 2, y, [bg, track, this.bossBarFill, this.bossBarLabel])
      .setDepth(115)
      .setVisible(false);
  }

  private refreshBossBar(): void {
    if (!this.bossBarRoot || !this.bossBarFill || !this.bossBarLabel) return;
    let best: EnemyActor | null = null;
    for (const e of this.enemies) {
      if (!e.alive || e.kind !== 'brute') continue;
      if (!best || e.hp > best.hp) best = e;
    }
    if (!best) {
      this.bossBarRoot.setVisible(false);
      return;
    }
    this.bossBarRoot.setVisible(true);
    const ratio = Math.max(0, Math.min(1, best.hp / best.maxHp));
    this.bossBarFill.width = Math.max(1, BOSS_BAR_W * ratio);
    this.bossBarLabel.setText(`${t('play.boss')} · ${t('enemy.brute')}`);
  }

  private checkWaveEnd(): void {
    if (!this.waveLive || this.ended || this.paused) return;
    if (this.pending.length > 0) return;
    if (this.enemies.some((e) => e.alive)) return;
    this.waveLive = false;
    this.refreshHud();
    if (GameState.wave >= this.totalWaves && GameState.gateHp > 0) {
      this.win();
    } else if (!this.ended) {
      this.startBuildTimer();
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
    this.cancelBuildTimer();
    this.clearTowerSelection();
    this.resetKillStreak();
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
    this.cancelBuildTimer();
    this.clearTowerSelection();
    this.resetKillStreak();
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

    const titleY = victory ? GAME_H / 2 - 120 : GAME_H / 2 - 140;
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

    const statStyle = {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '16px',
      color: '#F3F4F6',
    } as const;
    const statY = titleY + 40;
    root.add(
      this.add
        .text(GAME_W / 2, statY, t('play.statKills', { n: this.runKills }), statStyle)
        .setOrigin(0.5),
    );
    root.add(
      this.add
        .text(GAME_W / 2, statY + 22, t('play.statGold', { n: this.goldEarned }), statStyle)
        .setOrigin(0.5),
    );
    root.add(
      this.add
        .text(GAME_W / 2, statY + 44, t('play.statTime', { n: formatRunTime(this.runMs) }), statStyle)
        .setOrigin(0.5),
    );

    let belowStats = statY + 72;
    if (victory) {
      root.add(
        this.add
          .text(GAME_W / 2, belowStats, starString(this.lastWinStars), {
            fontFamily: 'system-ui, sans-serif',
            fontSize: '28px',
            color: '#E8B84A',
          })
          .setOrigin(0.5),
      );
      belowStats += 34;
      if (this.lastWinMeta > 0) {
        root.add(
          this.add
            .text(GAME_W / 2, belowStats, t('play.metaGain', { n: this.lastWinMeta }), {
              fontFamily: 'system-ui, sans-serif',
              fontSize: '16px',
              color: '#E8B84A',
            })
            .setOrigin(0.5),
        );
        belowStats += 28;
      }
    }

    const btnW = 200;
    const btnH = 48;
    const gap = 16;
    let cy = belowStats + 16;

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
    if (!this.waveLive && GameState.wave < this.totalWaves) {
      this.startBuildTimer();
    }
  }

  private clearEnemiesOnGateCell(): void {
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const c = Math.floor(e.x / TILE);
      const r = Math.floor(e.y / TILE);
      if (c === this.mapDef.gate.c && r === this.mapDef.gate.r) {
        e.alive = false;
        e.sprite.destroy();
        e.shadow.destroy();
        e.hpBg.destroy();
        e.hpFg.destroy();
      }
    }
    this.enemies = this.enemies.filter((e) => e.alive);
  }
  private buildSecondsLeft(): number | null {
    if (this.buildDeadline <= 0) return null;
    return Math.max(0, Math.ceil((this.buildDeadline - this.time.now) / 1000));
  }

  private cancelBuildTimer(): void {
    this.buildDeadline = 0;
  }

  /** Reset countdown when entering build phase (create / wave clear). */
  private startBuildTimer(): void {
    if (this.ended || this.waveLive || this.tutorialOpen || GameState.wave >= this.totalWaves) {
      this.cancelBuildTimer();
      return;
    }
    this.buildDeadline = this.time.now + BUILD_SECONDS * 1000;
    this.refreshHud();
  }

  private tickBuildTimer(): void {
    if (this.buildDeadline <= 0) return;
    if (this.waveLive || this.ended || GameState.wave >= this.totalWaves) {
      this.cancelBuildTimer();
      return;
    }
    if (this.time.now >= this.buildDeadline) {
      this.cancelBuildTimer();
      this.tryStartWave();
    }
  }

  private maybeShowTutorial(): void {
    if (GameState.tutorialDone) {
      this.startBuildTimer();
      return;
    }
    this.tutorialOpen = true;
    this.tutorialStep = 0;
    this.cancelBuildTimer();
    this.showTutorialOverlay();
    this.refreshHud();
  }

  private hideTutorialOverlay(): void {
    if (this.tutorialOverlay) {
      this.tutorialOverlay.destroy(true);
      this.tutorialOverlay = null;
    }
  }

  private showTutorialOverlay(): void {
    this.hideTutorialOverlay();
    const keys = ['play.tut1', 'play.tut2', 'play.tut3'] as const;
    const root = this.add.container(0, 0).setDepth(220);
    this.tutorialOverlay = root;

    const dim = this.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, COLOR.panel, 0.72);
    dim.setInteractive();
    dim.on('pointerdown', () => {
      this.advanceTutorial();
    });
    root.add(dim);

    root.add(
      this.add
        .rectangle(GAME_W / 2, GAME_H / 2 - 10, 420, 200, COLOR.shade, 0.95)
        .setStrokeStyle(2, COLOR.gold),
    );

    const body = this.add
      .text(GAME_W / 2, GAME_H / 2 - 40, t(keys[this.tutorialStep] ?? 'play.tut1'), {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '18px',
        color: '#F3F4F6',
        align: 'center',
        wordWrap: { width: 380 },
      })
      .setOrigin(0.5);
    root.add(body);

    const stepLabel = this.add
      .text(GAME_W / 2, GAME_H / 2 - 88, `${this.tutorialStep + 1}/3`, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '14px',
        color: '#E8B84A',
      })
      .setOrigin(0.5);
    root.add(stepLabel);

    const nextBg = this.add
      .rectangle(GAME_W / 2 - 90, GAME_H / 2 + 58, 150, 40, COLOR.towerBlue)
      .setStrokeStyle(2, COLOR.gold)
      .setInteractive({ useHandCursor: true });
    const nextLabel = this.add
      .text(GAME_W / 2 - 90, GAME_H / 2 + 58, t('play.tutNext'), {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '16px',
        color: '#F3F4F6',
      })
      .setOrigin(0.5);
    nextBg.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      pointer.event?.stopPropagation?.();
      this.advanceTutorial();
    });
    root.add(nextBg);
    root.add(nextLabel);

    const skipBg = this.add
      .rectangle(GAME_W / 2 + 90, GAME_H / 2 + 58, 150, 40, COLOR.shade)
      .setStrokeStyle(2, 0x374151)
      .setInteractive({ useHandCursor: true });
    const skipLabel = this.add
      .text(GAME_W / 2 + 90, GAME_H / 2 + 58, t('play.tutSkip'), {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '16px',
        color: '#F3F4F6',
      })
      .setOrigin(0.5);
    skipBg.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      pointer.event?.stopPropagation?.();
      this.finishTutorial();
    });
    root.add(skipBg);
    root.add(skipLabel);
  }

  private advanceTutorial(): void {
    if (!this.tutorialOpen) return;
    if (this.tutorialStep >= 2) {
      this.finishTutorial();
      return;
    }
    this.tutorialStep += 1;
    AudioBus.playUi('click');
    this.showTutorialOverlay();
  }

  private finishTutorial(): void {
    if (!this.tutorialOpen && GameState.tutorialDone) return;
    this.tutorialOpen = false;
    this.hideTutorialOverlay();
    GameState.tutorialDone = true;
    void saveGameState(GameState.snapshot());
    AudioBus.playUi('confirm');
    this.startBuildTimer();
    this.refreshHud();
    this.redrawRange();
  }


}


function formatRunTime(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function starsForGate(gateHp: number, maxGateHp: number): number {
  if (maxGateHp <= 0) return 1;
  if (gateHp >= maxGateHp) return 3;
  if (gateHp >= maxGateHp / 2) return 2;
  return 1;
}
