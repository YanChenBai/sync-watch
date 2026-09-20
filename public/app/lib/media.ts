/** 等待视频可以播放，超时由调用方处理。 */
export function waitForMedia(video: HTMLVideoElement): Promise<void> {
  if (video.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) {
    return Promise.resolve();
  }

  return new Promise<void>((resolve, reject) => {
    function cleanup(): void {
      video.removeEventListener('canplay', onLoaded);
      video.removeEventListener('error', onError);
    }

    function onLoaded(): void {
      cleanup();
      resolve();
    }

    function onError(): void {
      cleanup();
      reject(new Error('视频加载失败'));
    }

    video.addEventListener('canplay', onLoaded, { once: true });
    video.addEventListener('error', onError, { once: true });
  });
}

export function formatTime(value: number): string {
  if (!Number.isFinite(value) || value < 0) {
    return '00:00';
  }

  const totalSeconds = Math.floor(value);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  }

  return `${pad(minutes)}:${pad(seconds)}`;
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/** 捕获正在播放的视频流，供 WebRTC 发送。 */
export function captureStreamFromVideo(video: HTMLVideoElement | null): MediaStream {
  if (!video) {
    throw new Error('播放器尚未准备好');
  }

  if (typeof video.captureStream !== 'function') {
    throw new Error('当前浏览器不支持 video.captureStream()，请使用桌面版 Chrome / Edge');
  }

  const stream = video.captureStream();

  if (stream.getTracks().length === 0) {
    throw new Error('没有捕获到音视频轨道，请先播放视频');
  }

  return stream;
}
