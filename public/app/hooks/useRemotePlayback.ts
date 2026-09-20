import { useCallback, useEffect, useState } from 'react';

export type RemotePlaybackState = 'disconnected' | 'connecting' | 'connected';

export interface RemotePlaybackApi {
  /** 浏览器是否提供投屏能力（Chrome Cast / Safari AirPlay）。 */
  supported: boolean;

  state: RemotePlaybackState;

  /** 是否能探测到投屏设备；null 表示浏览器未提供该信息。 */
  deviceAvailable: boolean | null;

  error: string | null;

  clearError: () => void;

  prompt: () => Promise<void>;
}

const CAST_ERROR_MESSAGES: Record<string, string> = {
  NotFoundError: '没有找到可用的投屏设备，请确认设备和电视在同一个网络。',
  NotSupportedError:
    '当前视频无法直接投屏：接收设备需要能自己访问视频地址，WebRTC 实时流和本地文件都不行。可以改用浏览器自带的「投放标签页 / 屏幕镜像」。',
  InvalidStateError: '视频还没有可用于投屏的地址，请先播放一下再试。',
  NotAllowedError: '投屏被浏览器或权限设置阻止了，请检查站点的投屏权限。',
};

function describeCastError(cause: unknown): string {
  const name = cause instanceof DOMException ? cause.name : '';
  const message = CAST_ERROR_MESSAGES[name];

  if (message) {
    return message;
  }

  return cause instanceof Error ? cause.message : '投屏失败，请改用系统屏幕镜像。';
}

function hasSafariPicker(video: HTMLVideoElement | null): boolean {
  return typeof video?.webkitShowPlaybackTargetPicker === 'function';
}

/**
 * 观察投屏设备。
 *
 * `watchAvailability()` 在没有 Media Router 的浏览器上会直接 reject，
 * 此时保持 `null`，仍然允许用户点击按钮手动选择设备。
 */
function watchDevices(
  remote: RemotePlayback,
  onChange: (available: boolean) => void,
): Promise<number | null> {
  if (typeof remote.watchAvailability !== 'function') {
    return Promise.resolve(null);
  }

  try {
    return remote.watchAvailability(onChange).catch(() => null);
  } catch {
    return Promise.resolve(null);
  }
}

/**
 * 把 `<video>` 投到电视 / 投影仪（Remote Playback API + Safari AirPlay）。
 *
 * 注意：接收设备需要自己能够访问视频地址，因此 WebRTC 实时流与
 * 本地 `blob:` 文件通常无法投屏，失败时会给出替代方案。
 */
export function useRemotePlayback(video: HTMLVideoElement | null): RemotePlaybackApi {
  const [state, setState] = useState<RemotePlaybackState>('disconnected');
  const [deviceAvailable, setDeviceAvailable] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const remote = video?.remote;

    if (!remote || typeof remote.prompt !== 'function') {
      return;
    }

    const sync = (): void => setState(remote.state as RemotePlaybackState);

    let disposed = false;
    let watchId: number | null = null;

    sync();
    remote.addEventListener('connecting', sync);
    remote.addEventListener('connect', sync);
    remote.addEventListener('disconnect', sync);

    void watchDevices(remote, available => {
      if (!disposed) {
        setDeviceAvailable(available);
      }
    }).then(id => {
      if (disposed) {
        if (id !== null) {
          void remote.cancelWatchAvailability(id);
        }

        return;
      }

      watchId = id;
    });

    return () => {
      disposed = true;

      remote.removeEventListener('connecting', sync);
      remote.removeEventListener('connect', sync);
      remote.removeEventListener('disconnect', sync);

      if (watchId !== null) {
        void remote.cancelWatchAvailability(watchId);
      }
    };
  }, [video]);

  const prompt = useCallback(async () => {
    if (!video) {
      return;
    }

    setError(null);

    const remote = video.remote;

    try {
      if (remote && typeof remote.prompt === 'function') {
        await remote.prompt();

        return;
      }

      if (typeof video.webkitShowPlaybackTargetPicker === 'function') {
        video.webkitShowPlaybackTargetPicker();

        return;
      }

      setError('当前浏览器不支持网页投屏，请使用系统「屏幕镜像 / 投屏」。');
    } catch (cause) {
      setError(describeCastError(cause));
    }
  }, [video]);

  const clearError = useCallback(() => setError(null), []);

  return {
    supported: typeof video?.remote?.prompt === 'function' || hasSafariPicker(video),
    state,
    deviceAvailable,
    error,
    clearError,
    prompt,
  };
}
