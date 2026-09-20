import type { RemotePlaybackApi } from '../hooks/useRemotePlayback.ts';
import { CastIcon } from './Icons.tsx';

function describeCastTitle(playback: RemotePlaybackApi): string {
  if (playback.state === 'connected') {
    return '正在投屏，点击可切换设备';
  }

  if (playback.deviceAvailable === true) {
    return '发现可用投屏设备，点击投屏';
  }

  return '投屏到电视 / 投影仪';
}

/** 投屏按钮：浏览器不支持时完全不渲染。 */
export function CastButton({ playback }: { playback: RemotePlaybackApi }) {
  if (!playback.supported) {
    return null;
  }

  const connected = playback.state === 'connected';

  return (
    <button
      type="button"
      className={connected ? 'btn btn-icon btn-active' : 'btn btn-icon'}
      title={describeCastTitle(playback)}
      aria-label="投屏"
      aria-pressed={connected}
      onClick={() => void playback.prompt()}
    >
      <CastIcon />
    </button>
  );
}

/** 投屏失败原因，例如实时流 / 本地文件无法被接收设备拉取。 */
export function CastNotice({ playback }: { playback: RemotePlaybackApi }) {
  if (!playback.error) {
    return null;
  }

  return (
    <p className="alert" role="alert">
      {playback.error}
    </p>
  );
}
