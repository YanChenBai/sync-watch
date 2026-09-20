import type { HostPlayerApi } from '../hooks/useHostPlayer.ts';
import { RATE_STEPS } from '../hooks/useHostPlayer.ts';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts.ts';
import { useMediaVolume } from '../hooks/useMediaVolume.ts';
import { useRemotePlayback } from '../hooks/useRemotePlayback.ts';
import { useVideoSize } from '../hooks/useVideoSize.ts';
import {
  describeEncodingHint,
  VIDEO_QUALITY_ORDER,
  VIDEO_QUALITY_PROFILES,
  type VideoQuality,
} from '../lib/encoding.ts';
import { isFullscreenSupported } from '../lib/fullscreen.ts';
import { formatTime } from '../lib/media.ts';
import { CastButton, CastNotice } from './CastControls.tsx';
import { ExpandIcon, PauseIcon, PlayIcon, VolumeIcon, VolumeOffIcon } from './Icons.tsx';

export interface HostPlayerProps {
  player: HostPlayerApi;
  quality: VideoQuality;
  onQualityChange: (quality: VideoQuality) => void;
  onSelectItem: (index: number) => void;
}

export function HostPlayer({ player, quality, onQualityChange, onSelectItem }: HostPlayerProps) {
  const volume = useMediaVolume(player.video);
  const cast = useRemotePlayback(player.video);
  const fullscreenSupported = isFullscreenSupported();
  const size = useVideoSize(player.video);
  const duration = player.duration || 0;

  useKeyboardShortcuts([
    { keys: [' ', 'Space', 'k', 'K'], run: () => void player.togglePlay() },
    { keys: ['ArrowLeft', 'j', 'J'], run: () => player.seekBy(-10) },
    { keys: ['ArrowRight', 'l', 'L'], run: () => player.seekBy(10) },
    { keys: ['ArrowUp'], run: () => volume.nudgeVolume(0.1) },
    { keys: ['ArrowDown'], run: () => volume.nudgeVolume(-0.1) },
    { keys: ['m', 'M'], run: () => volume.toggleMute() },
    { keys: ['f', 'F'], run: () => void player.toggleFullscreen() },
    { keys: [',', '<'], run: () => player.stepRate(-1) },
    { keys: ['.', '>'], run: () => player.stepRate(1) },
  ]);

  return (
    <section className="panel panel-player">
      <div className="panel-head">
        <h2 className="panel-title">房主播放器</h2>

        <span className="badge">
          {player.playlist ? `${player.playlist.items.length} 个视频` : '未加载播放列表'}
        </span>
      </div>

      <label className="field">
        <span className="field-label">播放列表</span>

        <select
          className="select"
          disabled={!player.playlist}
          value={player.currentIndex}
          onChange={event => onSelectItem(Number(event.target.value))}
        >
          {player.playlist?.items.map((item, index) => (
            <option key={`${item.src}-${index}`} value={index}>
              {item.title}
            </option>
          ))}
        </select>
      </label>

      <div className="stage" style={{ aspectRatio: size.aspect }}>
        <video
          ref={player.videoRef}
          className="stage-video"
          controls
          playsInline
          preload="metadata"
        />
      </div>

      <input
        className="range range-seek"
        type="range"
        min={0}
        max={Math.max(duration, 0.1)}
        step={0.1}
        value={Math.min(player.currentTime, Math.max(duration, 0.1))}
        disabled={duration <= 0}
        aria-label="播放进度"
        onChange={event => player.seekTo(Number(event.target.value))}
      />

      <div className="player-bar">
        <button
          type="button"
          className="btn btn-icon"
          title="播放 / 暂停（空格）"
          aria-label={player.paused ? '播放' : '暂停'}
          onClick={() => void player.togglePlay()}
        >
          {player.paused ? <PlayIcon /> : <PauseIcon />}
        </button>

        <button
          type="button"
          className="btn"
          title="后退 10 秒（←）"
          onClick={() => player.seekBy(-10)}
        >
          -10s
        </button>

        <button
          type="button"
          className="btn"
          title="前进 10 秒（→）"
          onClick={() => player.seekBy(10)}
        >
          +10s
        </button>

        <button
          type="button"
          className="btn btn-icon player-mute"
          title="静音（M）"
          aria-label={volume.muted ? '取消静音' : '静音'}
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
          value={volume.muted ? 0 : volume.volume}
          aria-label="音量"
          onChange={event => volume.setVolume(Number(event.target.value))}
        />

        <span className="time">
          {formatTime(player.currentTime)} / {formatTime(player.duration)}
        </span>

        <span className="spacer" />

        <label className="field field-compact">
          <span className="field-label">倍速</span>

          <select
            className="select"
            value={player.rate}
            title="播放速度"
            aria-label="播放速度"
            onChange={event => player.setRate(Number(event.target.value))}
          >
            {RATE_STEPS.map(step => (
              <option key={step} value={step}>
                {step}x
              </option>
            ))}
          </select>
        </label>

        <label className="field field-compact">
          <span className="field-label">画质</span>

          <select
            className="select"
            value={quality}
            title="画质"
            aria-label="画质"
            onChange={event => onQualityChange(event.target.value as VideoQuality)}
          >
            {VIDEO_QUALITY_ORDER.map(value => (
              <option key={value} value={value}>
                {VIDEO_QUALITY_PROFILES[value].label}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          className="btn btn-icon"
          title="全屏（F）"
          aria-label="全屏"
          disabled={!fullscreenSupported}
          onClick={() => void player.toggleFullscreen()}
        >
          <ExpandIcon />
        </button>

        <CastButton playback={cast} />
      </div>

      <CastNotice playback={cast} />

      <p className="hint">{describeEncodingHint(quality, size.width, size.height)}</p>
    </section>
  );
}
