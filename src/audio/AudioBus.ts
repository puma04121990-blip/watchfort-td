/**
 * Buffer-based buses: music / sfx / ui.
 * Silent until first pointerdown/touch/keydown. Mute-all on tab hide.
 */

export type AudioBusId = 'music' | 'sfx' | 'ui';
export type UiClip = 'click' | 'confirm' | 'error';
export type SfxClip =
  | 'place'
  | 'shot_arrow'
  | 'shot_cannon'
  | 'shot_frost'
  | 'shot_lightning'
  | 'shot_sniper'
  | 'shot_mortar'
  | 'hit'
  | 'die'
  | 'coin'
  | 'gate'
  | 'complete'
  | 'fail'
  | 'start';
export type MusicClip = 'menu' | 'play';

type ClipId = UiClip | SfxClip | 'bgm_menu' | 'bgm_play';

const FILE_STEM: Record<ClipId, string> = {
  click: 'click',
  confirm: 'confirm',
  error: 'error',
  place: 'place',
  shot_arrow: 'shot_arrow',
  shot_cannon: 'shot_cannon',
  shot_frost: 'shot_frost',
  shot_lightning: 'shot_lightning',
  shot_sniper: 'shot_sniper',
  shot_mortar: 'shot_mortar',
  hit: 'hit',
  die: 'die',
  coin: 'coin',
  gate: 'gate',
  complete: 'complete',
  fail: 'fail',
  start: 'start',
  bgm_menu: 'bgm_menu',
  bgm_play: 'bgm_play',
};

const BUS_GAIN: Record<AudioBusId, number> = {
  music: 0.22,
  sfx: 0.55,
  ui: 0.42,
};

const COOLDOWN_MS: Partial<Record<ClipId, number>> = {
  shot_arrow: 40,
  shot_cannon: 80,
  shot_frost: 60,
  shot_lightning: 70,
  shot_sniper: 90,
  shot_mortar: 120,
  hit: 35,
  coin: 50,
  click: 30,
};

const POLY_LIMIT: Partial<Record<ClipId, number>> = {
  shot_arrow: 4,
  shot_cannon: 3,
  shot_frost: 3,
  shot_lightning: 3,
  shot_sniper: 2,
  shot_mortar: 2,
  hit: 5,
  coin: 4,
  die: 3,
};

let ctx: AudioContext | null = null;
let unlocked = false;
let unlockBound = false;
let visibilityBound = false;
let muted = false;
let musicEnabled = true;
let sfxEnabled = true;
let loadPromise: Promise<void> | null = null;
let loaded = false;

const buffers = new Map<ClipId, AudioBuffer>();
const lastPlay = new Map<ClipId, number>();
const activeCount = new Map<ClipId, number>();

let masterGain: GainNode | null = null;
let busNodes: Record<AudioBusId, GainNode> | null = null;

let musicKind: MusicClip | null = null;
let musicSource: AudioBufferSourceNode | null = null;
let musicGain: GainNode | null = null;

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

function ensureGraph(c: AudioContext): void {
  if (masterGain && busNodes) return;
  masterGain = c.createGain();
  masterGain.gain.value = 1;
  masterGain.connect(c.destination);
  busNodes = {
    music: c.createGain(),
    sfx: c.createGain(),
    ui: c.createGain(),
  };
  (Object.keys(BUS_GAIN) as AudioBusId[]).forEach((id) => {
    const g = busNodes![id];
    g.gain.value = BUS_GAIN[id];
    g.connect(masterGain!);
  });
}

function audioUrl(stem: string, ext: 'ogg' | 'm4a'): string {
  return new URL(`../../assets/audio/${stem}.${ext}`, import.meta.url).href;
}

async function decodeStem(c: AudioContext, stem: string): Promise<AudioBuffer | null> {
  for (const ext of ['ogg', 'm4a'] as const) {
    try {
      const res = await fetch(audioUrl(stem, ext));
      if (!res.ok) continue;
      const arr = await res.arrayBuffer();
      return await c.decodeAudioData(arr.slice(0));
    } catch {
      // try next format
    }
  }
  // Vite public path fallback (Pages / dev)
  for (const ext of ['ogg', 'm4a'] as const) {
    try {
      const res = await fetch(`./assets/audio/${stem}.${ext}`);
      if (!res.ok) continue;
      const arr = await res.arrayBuffer();
      return await c.decodeAudioData(arr.slice(0));
    } catch {
      // continue
    }
  }
  return null;
}

async function loadAll(): Promise<void> {
  const c = getCtx();
  if (!c) return;
  ensureGraph(c);
  const entries = Object.entries(FILE_STEM) as [ClipId, string][];
  await Promise.all(
    entries.map(async ([id, stem]) => {
      const buf = await decodeStem(c, stem);
      if (buf) buffers.set(id, buf);
    }),
  );
  loaded = true;
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
  ensureGraph(c);
  if (!loadPromise) {
    loadPromise = loadAll().catch(() => {
      /* silent */
    });
  }
  await loadPromise;
  if (musicKind && !muted && musicEnabled) {
    startMusic(musicKind, true);
  }
}

function onFirstPointer(): void {
  void unlock();
}

function nowMs(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

function canPlay(id: ClipId): boolean {
  const cd = COOLDOWN_MS[id];
  if (cd) {
    const last = lastPlay.get(id) ?? 0;
    if (nowMs() - last < cd) return false;
  }
  const lim = POLY_LIMIT[id];
  if (lim !== undefined && (activeCount.get(id) ?? 0) >= lim) return false;
  return true;
}

function playBuffer(id: ClipId, bus: AudioBusId, opts?: { loop?: boolean }): AudioBufferSourceNode | null {
  if (!unlocked || muted) return null;
  const c = getCtx();
  if (!c || c.state !== 'running' || !busNodes) return null;
  const buf = buffers.get(id);
  if (!buf) return null;
  if (!opts?.loop && !canPlay(id)) return null;

  const src = c.createBufferSource();
  src.buffer = buf;
  src.loop = Boolean(opts?.loop);
  src.connect(busNodes[bus]);
  activeCount.set(id, (activeCount.get(id) ?? 0) + 1);
  lastPlay.set(id, nowMs());
  src.onended = () => {
    activeCount.set(id, Math.max(0, (activeCount.get(id) ?? 1) - 1));
  };
  try {
    src.start(0);
  } catch {
    activeCount.set(id, Math.max(0, (activeCount.get(id) ?? 1) - 1));
    return null;
  }
  return src;
}

function fadeOutMusic(ms: number): void {
  const c = getCtx();
  if (!c || !musicGain || !musicSource) {
    stopMusicNode();
    return;
  }
  const g = musicGain;
  const src = musicSource;
  const t = c.currentTime;
  const dur = Math.max(0.05, ms / 1000);
  try {
    g.gain.cancelScheduledValues(t);
    g.gain.setValueAtTime(g.gain.value, t);
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
  } catch {
    /* ignore */
  }
  window.setTimeout(() => {
    try {
      src.stop();
    } catch {
      /* ignore */
    }
    try {
      src.disconnect();
      g.disconnect();
    } catch {
      /* ignore */
    }
    if (musicSource === src) {
      musicSource = null;
      musicGain = null;
    }
  }, ms + 30);
}

function stopMusicNode(): void {
  if (musicSource) {
    try {
      musicSource.stop();
    } catch {
      /* ignore */
    }
    try {
      musicSource.disconnect();
    } catch {
      /* ignore */
    }
  }
  if (musicGain) {
    try {
      musicGain.disconnect();
    } catch {
      /* ignore */
    }
  }
  musicSource = null;
  musicGain = null;
}

function startMusic(kind: MusicClip, immediate = false): void {
  musicKind = kind;
  if (!unlocked || muted || !musicEnabled || !loaded) return;
  const c = getCtx();
  if (!c || !busNodes) return;
  const id: ClipId = kind === 'menu' ? 'bgm_menu' : 'bgm_play';
  const buf = buffers.get(id);
  if (!buf) return;

  if (musicSource) {
    if (!immediate) fadeOutMusic(280);
    else stopMusicNode();
  }

  const start = (): void => {
    if (musicKind !== kind || muted || !musicEnabled || !unlocked || !busNodes) return;
    const src = c.createBufferSource();
    const g = c.createGain();
    src.buffer = buf;
    src.loop = true;
    g.gain.value = 0.0001;
    src.connect(g);
    g.connect(busNodes.music);
    const t = c.currentTime;
    g.gain.linearRampToValueAtTime(1, t + 0.25);
    try {
      src.start(0);
    } catch {
      return;
    }
    musicSource = src;
    musicGain = g;
  };

  if (immediate || !musicSource) start();
  else window.setTimeout(start, 300);
}

function onVisibility(): void {
  if (document.hidden) {
    muted = true;
    stopMusicNode();
  } else {
    muted = false;
    if (musicKind && musicEnabled) startMusic(musicKind, true);
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
  if (!sfxEnabled) return;
  playBuffer(clip, 'ui');
}

export function playSfx(clip: SfxClip): void {
  if (!sfxEnabled) return;
  playBuffer(clip, 'sfx');
}

export function setMusicEnabled(on: boolean): void {
  musicEnabled = Boolean(on);
  if (!musicEnabled) {
    fadeOutMusic(200);
  } else if (musicKind && !muted && unlocked) {
    startMusic(musicKind, true);
  }
}

export function setSfxEnabled(on: boolean): void {
  sfxEnabled = Boolean(on);
}

export function isMusicEnabled(): boolean {
  return musicEnabled;
}

export function isSfxEnabled(): boolean {
  return sfxEnabled;
}

export function playMusic(kind: MusicClip): void {
  if (musicKind === kind && musicSource) return;
  startMusic(kind);
}

export function stopMusic(): void {
  musicKind = null;
  fadeOutMusic(200);
}

export const AudioBus = {
  bindUnlock: bindAudioUnlock,
  bindVisibilityMute,
  isUnlocked: isAudioUnlocked,
  playUi,
  playSfx,
  playMusic,
  stopMusic,
  setMusicEnabled,
  setSfxEnabled,
  isMusicEnabled,
  isSfxEnabled,
  uiClick: (): void => {
    playUi('click');
  },
};
