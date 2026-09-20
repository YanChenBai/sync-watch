/** 是否可能进入全屏（iOS Safari 上 document.fullscreenEnabled 为 false，但视频可以）。 */
export function isFullscreenSupported(): boolean {
  return (
    Boolean(document.fullscreenEnabled) || 'webkitEnterFullscreen' in HTMLVideoElement.prototype
  );
}

/**
 * 全屏切换。
 *
 * iOS Safari 只支持视频元素的 `webkitEnterFullscreen`，因此先走标准 API，
 * 不可用时再退到 webkit 前缀实现。
 */
export async function toggleFullscreen(element: HTMLElement | null): Promise<void> {
  if (!element) {
    return;
  }

  const video = element as HTMLVideoElement;

  try {
    if (document.fullscreenElement) {
      await document.exitFullscreen();

      return;
    }

    if (video.webkitDisplayingFullscreen) {
      video.webkitExitFullscreen?.();

      return;
    }

    if (typeof element.requestFullscreen === 'function') {
      await element.requestFullscreen();

      return;
    }

    video.webkitEnterFullscreen?.();
  } catch (cause) {
    console.warn('[fullscreen] 切换全屏失败', cause);
  }
}
