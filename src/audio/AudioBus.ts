/**
 * Silent until first pointerdown. Buses: music / sfx / ui.
 * Mute-all on document visibility hide.
 */

export type AudioBusId = 'music' | 'sfx' | 'ui';
export type UiClip = 'click' | 'confirm' | 'error';
export type SfxClip =
  | 'place'
  | 'shot_arrow'
  | 'shot_cannon'
  | 'shot_frost'
  | 'hit'
  | 'die'
  | 'coin'
  | 'gate'
  | 'complete'
  | 'fail'
  | 'start';
export type MusicClip = 'menu' | 'play';

let ctx: AudioContext | null = null;
let unlocked = false;
let unlockBound = false;
let visibilityBound = false;
let muted = false;
let musicTimer: number | null = null;
let musicKind: MusicClip | null = null;
let musicStep = 0;

const BUS_GAIN: Record<AudioBusId, number> = {
  music: 0.028,
  sfx: 0.055,
  ui: 0.045,
};

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  return ctx;
}

async function unlock(): Promise<void> {
  const c = getCtx();
  if (!c) return;
  if (c.state === 'suspended') {
    try {
      await c.resume();
    } catch {
      return;
    }
  }
  unlocked = true;
  if (musicKind && !muted) {
    startMusicTimer(musicKind);
  }
}

function onFirstPointer(): void {
  void unlock();
}

function beep(
  freq: number,
  dur: number,
  type: OscillatorType,
  bus: AudioBusId,
  volScale = 1,
): void {
  if (!unlocked || muted) return;
  const c = getCtx();
  if (!c || c.state !== 'running') return;

  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  const vol = BUS_GAIN[bus] * volScale;
  const now = c.currentTime;
  gain.gain.setValueAtTime(vol, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
  osc.connect(gain);
  gain.connect(c.destination);
  osc.start(now);
  osc.stop(now + dur + 0.02);
}

function stopMusicTimer(): void {
  if (musicTimer !== null) {
    window.clearInterval(musicTimer);
    musicTimer = null;
  }
}

const MENU_NOTES = [196, 247, 294, 247, 220, 196, 165, 196];
const PLAY_NOTES = [262, 330, 392, 330, 294, 392, 349, 330];

function startMusicTimer(kind: MusicClip): void {
  stopMusicTimer();
  musicKind = kind;
  musicStep = 0;
  if (!unlocked || muted) return;
  const notes = kind === 'menu' ? MENU_NOTES : PLAY_NOTES;
  const interval = kind === 'menu' ? 380 : 300;
  const tick = (): void => {
    if (!unlocked || muted || musicKind !== kind) return;
    const freq = notes[musicStep % notes.length] ?? 220;
    beep(freq, kind === 'menu' ? 0.22 : 0.16, 'triangle', 'music', 1);
    musicStep += 1;
  };
  tick();
  musicTimer = window.setInterval(tick, interval);
}

function onVisibility(): void {
  if (document.hidden) {
    muted = true;
    stopMusicTimer();
  } else {
    muted = false;
    if (musicKind) startMusicTimer(musicKind);
  }
}

export function bindAudioUnlock(): void {
  if (unlockBound) return;
  unlockBound = true;
  const opts: AddEventListenerOptions = { once: true, capture: true };
  window.addEventListener('pointerdown', onFirstPointer, opts);
  window.addEventListener('touchstart', onFirstPointer, opts);
  window.addEventListener('keydown', onFirstPointer, opts);
}

export function bindVisibilityMute(): void {
  if (visibilityBound) return;
  visibilityBound = true;
  document.addEventListener('visibilitychange', onVisibility);
}

export function isAudioUnlocked(): boolean {
  return unlocked;
}

export function playUi(clip: UiClip): void {
  switch (clip) {
    case 'click':
      beep(660, 0.08, 'square', 'ui');
      break;
    case 'confirm':
      beep(520, 0.07, 'square', 'ui');
      beep(780, 0.1, 'square', 'ui', 0.8);
      break;
    case 'error':
      beep(180, 0.14, 'sawtooth', 'ui', 1.1);
      break;
  }
}

export function playSfx(clip: SfxClip): void {
  switch (clip) {
    case 'place':
      beep(300, 0.08, 'triangle', 'sfx');
      beep(440, 0.1, 'square', 'sfx', 0.7);
      break;
    case 'shot_arrow':
      beep(880, 0.05, 'square', 'sfx', 0.7);
      break;
    case 'shot_cannon':
      beep(140, 0.14, 'sawtooth', 'sfx', 1.2);
      break;
    case 'shot_frost':
      beep(980, 0.09, 'sine', 'sfx', 0.8);
      break;
    case 'hit':
      beep(220, 0.06, 'square', 'sfx', 0.6);
      break;
    case 'die':
      beep(160, 0.16, 'triangle', 'sfx');
      break;
    case 'coin':
      beep(880, 0.07, 'square', 'sfx', 0.7);
      beep(1180, 0.09, 'square', 'sfx', 0.5);
      break;
    case 'gate':
      beep(90, 0.2, 'sawtooth', 'sfx', 1.3);
      break;
    case 'complete':
      beep(392, 0.12, 'triangle', 'sfx');
      beep(523, 0.14, 'triangle', 'sfx');
      beep(659, 0.22, 'triangle', 'sfx');
      break;
    case 'fail':
      beep(196, 0.18, 'sawtooth', 'sfx');
      beep(147, 0.28, 'sawtooth', 'sfx', 1.1);
      break;
    case 'start':
      beep(330, 0.08, 'square', 'sfx');
      beep(494, 0.12, 'square', 'sfx', 0.8);
      break;
  }
}

export function playMusic(kind: MusicClip): void {
  if (musicKind === kind && musicTimer !== null) return;
  startMusicTimer(kind);
}

export function stopMusic(): void {
  musicKind = null;
  stopMusicTimer();
}

export const AudioBus = {
  bindUnlock: bindAudioUnlock,
  bindVisibilityMute,
  isUnlocked: isAudioUnlocked,
  playUi,
  playSfx,
  playMusic,
  stopMusic,
  uiClick: (): void => {
    playUi('click');
  },
};
