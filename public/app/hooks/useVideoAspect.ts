import { useEffect, useState } from 'react';

const DEFAULT_ASPECT = '16 / 9';

/**
 * 跟随视频真实宽高比。
 *
 * 播放器容器如果固定 16:9，宽银幕片源会白白多出一大块黑边，
 * 在手机上尤其浪费垂直空间。这里让容器跟着片源走，
 * 只有真的需要时才会出现黑边。
 */
export function useVideoAspect(video: HTMLVideoElement | null): string {
  const [aspect, setAspect] = useState(DEFAULT_ASPECT);

  useEffect(() => {
    if (!video) {
      setAspect(DEFAULT_ASPECT);

      return;
    }

    const element = video;

    function sync(): void {
      const { videoWidth, videoHeight } = element;

      setAspect(
        videoWidth > 0 && videoHeight > 0 ? `${videoWidth} / ${videoHeight}` : DEFAULT_ASPECT,
      );
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

  return aspect;
}
