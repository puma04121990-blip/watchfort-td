import { getGp } from './gp';

/** Thin ads facade over GP / NullGp. */
export const ads = {
  async showPreloader(): Promise<void> {
    const gp = getGp();
    if (gp.ads.isPreloaderAvailable) {
      await gp.ads.showPreloader();
    }
  },

  showSticky(): void {
    const gp = getGp();
    if (gp.ads.isStickyAvailable) {
      gp.ads.showSticky();
    }
  },

  async showFullscreen(): Promise<boolean> {
    const gp = getGp();
    if (!gp.ads.isFullscreenAvailable) return false;
    return gp.ads.showFullscreen();
  },

  async showRewardedVideo(): Promise<boolean> {
    const gp = getGp();
    if (!gp.ads.isRewardedAvailable) return false;
    return gp.ads.showRewardedVideo();
  },
};
