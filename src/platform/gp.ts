/**
 * GamePush thin wrapper. Allowed stubs only — no invented APIs.
 */

export type GpPlatformType = string;

export interface GpPlayer {
  ready: boolean;
  isLoggedIn: boolean;
  get: (key: string) => unknown;
  set: (key: string, value: unknown) => void;
  add: (key: string, value: number) => void;
  sync: () => Promise<void>;
  load: () => Promise<void>;
  logout: () => void;
  enableAutoSync: (enabled?: boolean) => void;
}

export interface GpAds {
  showPreloader: () => Promise<void>;
  showSticky: () => void;
  showFullscreen: () => Promise<boolean>;
  showRewardedVideo: () => Promise<boolean>;
  isStickyAvailable: boolean;
  isFullscreenAvailable: boolean;
  isRewardedAvailable: boolean;
  isPreloaderAvailable: boolean;
}

export interface GpSdk {
  player: GpPlayer;
  ads: GpAds;
  platform: { type: GpPlatformType };
}

declare global {
  interface Window {
    onGPInit?: (gp: GpSdk) => void;
    GamePush?: unknown;
  }
}

const LOCAL_PREFIX = 'watchfort_gp_';

function createNullPlayer(): GpPlayer {
  const store = new Map<string, unknown>();

  const hydrate = (): void => {
    try {
      const raw = localStorage.getItem(`${LOCAL_PREFIX}player`);
      if (!raw) return;
      const parsed: unknown = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
          store.set(k, v);
        }
      }
    } catch {
      /* ignore corrupt local save */
    }
  };

  const persist = (): void => {
    const obj: Record<string, unknown> = {};
    store.forEach((v, k) => {
      obj[k] = v;
    });
    try {
      localStorage.setItem(`${LOCAL_PREFIX}player`, JSON.stringify(obj));
    } catch {
      /* quota / private mode */
    }
  };

  hydrate();

  return {
    ready: true,
    isLoggedIn: false,
    get(key: string): unknown {
      return store.get(key);
    },
    set(key: string, value: unknown): void {
      store.set(key, value);
      persist();
    },
    add(key: string, value: number): void {
      const cur = store.get(key);
      const n = typeof cur === 'number' ? cur : 0;
      store.set(key, n + value);
      persist();
    },
    async sync(): Promise<void> {
      persist();
    },
    async load(): Promise<void> {
      hydrate();
    },
    logout(): void {
      store.clear();
      persist();
    },
    enableAutoSync(_enabled = true): void {
      /* no-op for NullGp */
    },
  };
}

function createNullAds(): GpAds {
  return {
    async showPreloader(): Promise<void> {
      /* no-op */
    },
    showSticky(): void {
      /* no-op */
    },
    async showFullscreen(): Promise<boolean> {
      return false;
    },
    async showRewardedVideo(): Promise<boolean> {
      return false;
    },
    isStickyAvailable: false,
    isFullscreenAvailable: false,
    isRewardedAvailable: false,
    isPreloaderAvailable: false,
  };
}

export function createNullGp(): GpSdk {
  return {
    player: createNullPlayer(),
    ads: createNullAds(),
    platform: { type: 'null' },
  };
}

let gpInstance: GpSdk = createNullGp();
let resolved = false;

export function getGp(): GpSdk {
  return gpInstance;
}

export function isGpReady(): boolean {
  return resolved;
}

/**
 * Wait for window.onGPInit or fall back after timeoutMs (default 4500).
 */
export function waitForGp(timeoutMs = 4500): Promise<GpSdk> {
  if (resolved) return Promise.resolve(gpInstance);

  return new Promise((resolve) => {
    let settled = false;

    const finish = (sdk: GpSdk): void => {
      if (settled) return;
      settled = true;
      resolved = true;
      gpInstance = sdk;
      resolve(sdk);
    };

    const prev = window.onGPInit;
    window.onGPInit = (gp: GpSdk): void => {
      if (typeof prev === 'function') {
        try {
          prev(gp);
        } catch {
          /* ignore host handler errors */
        }
      }
      finish(gp);
    };

    window.setTimeout(() => {
      finish(createNullGp());
    }, timeoutMs);
  });
}
