import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts.ts';
import { useMediaVolume } from '../hooks/useMediaVolume.ts';
import { useRemotePlayback } from '../hooks/useRemotePlayback.ts';
import { useVideoSize } from '../hooks/useVideoSize.ts';
import { isFullscreenSupported, toggleFullscreen } from '../lib/fullscreen.ts';
import { formatTime } from '../lib/media.ts';
import type { PlaybackState } from '../types.ts';
import { CastButton, CastNotice } from './CastControls.tsx';
import { ExpandIcon, PauseIcon, PlayIcon, VolumeIcon, VolumeOffIcon } from './Icons.tsx';

export interface ViewerPlayerProps {
  video: HTMLVideoElement | null;
  videoRef: (node: HTMLVideoElement | null) => void;
  state: PlaybackState | null;
  blocked: boolean;
  onEnableSound: () => void;
  onTogglePlay: () => void;
}

function describeTitle(state: PlaybackState | null): string {
  return state?.title ?? '等待房主...';
}

function describePlaybackState(state: PlaybackState | null): string {
  if (!state) {
    return '等待视频流';
  }

  return state.paused ? '已暂停' : '播放中';
}

function isPlaying(state: PlaybackState | null): boolean {
  return state !== null && !state.paused;
}

function describeMuteLabel(muted: boolean): string {
  return muted ? '取消静音' : '静音';
}

function resolveVolume(muted: boolean, volume: number): number {
  return muted ? 0 : volume;
}

function ViewerMeta({ state }: { state: PlaybackState | null }) {
  if (!state) {
    return (
      <div className="meta-row">
        <span className="badge">{describePlaybackState(state)}</span>
      </div>
    );
  }

  return (
    <div className="meta-row">
      <span className="badge">{describePlaybackState(state)}</span>

      <span className="badge">
        {formatTime(state.currentTime)} / {formatTime(state.duration)}
      </span>

      <span className="badge">{state.playbackRate}x</span>
    </div>
  );
}

export function ViewerPlayer({
  video,
  videoRef,
  state,
  blocked,
  onEnableSound,
  onTogglePlay,
}: ViewerPlayerProps) {
  const volume = useMediaVolume(video);
  const cast = useRemotePlayback(video);
  const fullscreenSupported = isFullscreenSupported();
  const size = useVideoSize(video);

  function requestFullscreen(): void {
    void toggleFullscreen(video);
  }

  useKeyboardShortcuts([
    { keys: [' ', 'Space', 'k', 'K'], run: onTogglePlay },
    { keys: ['ArrowUp'], run: () => volume.nudgeVolume(0.1) },
    { keys: ['ArrowDown'], run: () => volume.nudgeVolume(-0.1) },
    { keys: ['m', 'M'], run: () => volume.toggleMute() },
    { keys: ['f', 'F'], run: requestFullscreen },
  ]);

  return (
    <section className="panel panel-player">
      <div className="panel-head">
        <h2 className="panel-title">{describeTitle(state)}</h2>

        <span className="chip chip-live">LIVE</span>
      </div>

      <ViewerMeta state={state} />

      <div className="stage" style={{ aspectRatio: size.aspect }}>
        <video ref={videoRef} className="stage-video" controls playsInline />

        {blocked && (
          <button type="button" className="stage-overlay" onClick={onEnableSound}>
            <span className="stage-overlay-title">点击开启声音</span>
            <span className="stage-overlay-hint">浏览器阻止了自动播放，画面已静音播放</span>
          </button>
        )}
      </div>

      <div className="player-bar">
        <button
          type="button"
          className="btn btn-icon"
          title="播放 / 暂停（空格）"
          aria-label={isPlaying(state) ? '暂停' : '播放'}
          onClick={onTogglePlay}
        >
          {isPlaying(state) ? <PauseIcon /> : <PlayIcon />}
        </button>

        <button
          type="button"
          className="btn btn-icon player-mute"
          title="静音（M）"
          aria-label={describeMuteLabel(volume.muted)}
          onClick={() => volume.toggleMute()}
        >
          {volume.muted ? <VolumeOffIcon /> : <VolumeIcon />}
        </button>

        <input
          className="range range-volume"
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={resolveVolume(volume.muted, volume.volume)}
          aria-label="音量"
          onChange={event => volume.setVolume(Number(event.target.value))}
        />

        <span className="time">
          {Math.round(resolveVolume(volume.muted, volume.volume) * 100)}%
        </span>

        <span className="spacer" />

        <button
          type="button"
          className="btn btn-icon"
          title="全屏（F）"
          aria-label="全屏"
          disabled={!fullscreenSupported}
          onClick={requestFullscreen}
        >
          <ExpandIcon />
        </button>

        <CastButton playback={cast} />
      </div>

      <CastNotice playback={cast} />

      <p className="hint">音量、全屏、投屏都只作用于你自己的设备，不会影响房主或其他观看者。</p>
    </section>
  );
}
