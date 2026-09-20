import { useEffect, useState } from 'react';

export interface VideoSize {
  width: number;
  height: number;
  /** 供 CSS aspect-ratio 使用。 */
  aspect: string;
}

const DEFAULT_SIZE: VideoSize = { width: 0, height: 0, aspect: '16 / 9' };

/**
 * 跟随片源真实尺寸。
 *
 * 容器高度用它避免多余黑边；房主界面还用它告诉用户
 * 4K 片源会被降采样到什么分辨率再编码。
 */
export function useVideoSize(video: HTMLVideoElement | null): VideoSize {
  const [size, setSize] = useState<VideoSize>(DEFAULT_SIZE);

  useEffect(() => {
    if (!video) {
      setSize(DEFAULT_SIZE);

      return;
    }

    const element = video;

    function sync(): void {
      const { videoWidth, videoHeight } = element;

      if (videoWidth <= 0 || videoHeight <= 0) {
        setSize(DEFAULT_SIZE);

        return;
      }

      setSize({
        width: videoWidth,
        height: videoHeight,
        aspect: `${videoWidth} / ${videoHeight}`,
      });
    }

    sync();
    element.addEventListener('loadedmetadata', sync);
    element.addEventListener('resize', sync);
    element.addEventListener('emptied', sync);

    return () => {
      element.removeEventListener('loadedmetadata', sync);
      element.removeEventListener('resize', sync);
      element.removeEventListener('emptied', sync);
    };
  }, [video]);

  return size;
}
