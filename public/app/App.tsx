import { useCallback, useEffect, useRef, useState } from 'react';

import { AppHeader } from './components/AppHeader.tsx';
import { ConnectionPanel } from './components/ConnectionPanel.tsx';
import { HostPlayer } from './components/HostPlayer.tsx';
import { ShortcutHints } from './components/ShortcutHints.tsx';
import { ViewerPlayer } from './components/ViewerPlayer.tsx';
import { useElementRef } from './hooks/useElementRef.ts';
import { useHostPlayer } from './hooks/useHostPlayer.ts';
import type { VideoQuality } from './lib/encoding.ts';
import { supportsDirectoryPicker } from './lib/file-system.ts';
import { WebRtcSession } from './lib/webrtc-session.ts';
import type { PlaybackState, Role } from './types.ts';

function toMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}

/**
 * 停止旧的采集流。
 *
 * 换片源时 canvas 采集流是同一个对象（音轨还来自共享的音频图），
 * 所以只停那些真的不在新流里的轨道，避免把正在用的流一起停掉。
 */
function stopStream(stream: MediaStream | null, keep?: MediaStream): void {
  const keptIds = new Set(keep?.getTracks().map(track => track.id) ?? []);

  stream?.getTracks().forEach(track => {
    if (keptIds.has(track.id)) {
      return;
    }

    track.stop();
  });
}

export function App() {
  const [roomId, setRoomId] = useState('demo');
  const [role, setRole] = useState<Role | null>(null);
  const [status, setStatus] = useState('未连接');
  const [path, setPath] = useState('unknown');
  const [forceRelay, setForceRelay] = useState(false);
  const [quality, setQuality] = useState<VideoQuality>('high');
  const [remoteState, setRemoteState] = useState<PlaybackState | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [blocked, setBlocked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [librarySummary, setLibrarySummary] = useState<string | null>(null);

  const viewer = useElementRef<HTMLVideoElement>();
  const sessionRef = useRef<WebRtcSession | null>(null);
  const hostStreamRef = useRef<MediaStream | null>(null);

  const host = useHostPlayer({
    quality,
    onStateChange: state => sessionRef.current?.broadcastState(state),
  });

  const viewerElement = viewer.element;

  useEffect(() => {
    return () => {
      sessionRef.current?.close();
      sessionRef.current = null;

      stopStream(hostStreamRef.current);
      hostStreamRef.current = null;
    };
  }, []);

  const startViewerPlayback = useCallback(async (video: HTMLVideoElement) => {
    try {
      await video.play();
      setBlocked(false);

      return;
    } catch {
      // 自动播放被拦截：退化为静音播放，先保证画面出来
    }

    video.muted = true;

    try {
      await video.play();
    } catch {
      // 仍然需要用户手势，由浮层上的按钮兜底
    }

    setBlocked(true);
  }, []);

  useEffect(() => {
    if (!viewerElement || !remoteStream) {
      return;
    }

    viewerElement.srcObject = remoteStream;

    void startViewerPlayback(viewerElement);
  }, [remoteStream, startViewerPlayback, viewerElement]);

  const enableViewerSound = useCallback(async () => {
    if (!viewerElement) {
      return;
    }

    viewerElement.muted = false;

    try {
      await viewerElement.play();
    } catch (cause) {
      console.warn('[viewer] 播放失败', cause);
    }

    setBlocked(false);
  }, [viewerElement]);

  const toggleViewerPlayback = useCallback(async () => {
    if (!viewerElement) {
      return;
    }

    if (viewerElement.paused) {
      try {
        await viewerElement.play();
      } catch (cause) {
        console.warn('[viewer] 播放失败', cause);
      }

      return;
    }

    viewerElement.pause();
  }, [viewerElement]);

  async function pickDirectory() {
    setError(null);

    try {
      const data = await host.loadLibrary();

      if (!data) {
        return;
      }

      const summary = `已加载 ${data.items.length} 个视频`;

      setLibrarySummary(summary);
      setStatus(summary);
    } catch (cause) {
      setError(toMessage(cause));
    }
  }

  async function startHost() {
    setError(null);

    try {
      if (!host.playlist) {
        throw new Error('请先选择包含 playlist.json 的目录');
      }

      await host.openItem(host.currentIndex, true);

      const stream = host.captureStream();

      hostStreamRef.current = stream;

      const session = new WebRtcSession({
        roomId,
        role: 'host',
        forceRelay,
        quality,
        getHostStream: () => hostStreamRef.current,
        onRemoteStream: () => {},
        onRemoteState: () => {},
        onStatus: setStatus,
        onPath: setPath,
      });

      sessionRef.current = session;

      await session.connect();

      setRole('host');
      setStatus('房间已创建');
    } catch (cause) {
      setError(toMessage(cause));
    }
  }

  async function startViewer() {
    setError(null);

    try {
      const session = new WebRtcSession({
        roomId,
        role: 'viewer',
        forceRelay,
        quality,
        getHostStream: () => null,
        onRemoteStream: setRemoteStream,
        onRemoteState: setRemoteState,
        onStatus: setStatus,
        onPath: setPath,
      });

      sessionRef.current = session;

      await session.connect();

      setRole('viewer');
      setStatus('已加入房间，等待视频...');
    } catch (cause) {
      setError(toMessage(cause));
    }
  }

  async function switchItem(index: number) {
    setError(null);

    try {
      await host.selectItem(index);

      if (role !== 'host') {
        return;
      }

      const stream = host.captureStream();

      await sessionRef.current?.replaceHostStream(stream);

      const previous = hostStreamRef.current;

      hostStreamRef.current = stream;
      stopStream(previous, stream);
    } catch (cause) {
      setError(toMessage(cause));
    }
  }

  function changeQuality(next: VideoQuality) {
    setQuality(next);
    sessionRef.current?.setVideoQuality(next);
  }

  function leaveRoom() {
    sessionRef.current?.close();
    sessionRef.current = null;

    host.releaseCaptureStream();
    hostStreamRef.current = null;

    setRemoteStream(null);
    setRemoteState(null);
    setBlocked(false);
    setRole(null);
    setStatus('未连接');
    setPath('unknown');
  }

  const directorySupported = supportsDirectoryPicker();

  return (
    <main className={role ? 'app app-joined' : 'app'}>
      <AppHeader role={role} status={status} path={path} />

      <ConnectionPanel
        roomId={roomId}
        onRoomIdChange={setRoomId}
        role={role}
        forceRelay={forceRelay}
        onForceRelayChange={setForceRelay}
        hasLibrary={host.playlist !== null}
        librarySummary={librarySummary}
        error={error}
        directorySupported={directorySupported}
        onPickDirectory={() => void pickDirectory()}
        onStartHost={() => void startHost()}
        onStartViewer={() => void startViewer()}
        onLeave={leaveRoom}
      />

      {role !== 'viewer' && (
        <HostPlayer
          player={host}
          quality={quality}
          onQualityChange={changeQuality}
          onSelectItem={index => void switchItem(index)}
        />
      )}

      {role === 'viewer' && (
        <ViewerPlayer
          video={viewerElement}
          videoRef={viewer.ref}
          state={remoteState}
          blocked={blocked}
          onEnableSound={() => void enableViewerSound()}
          onTogglePlay={() => void toggleViewerPlayback()}
        />
      )}

      <ShortcutHints role={role} />
    </main>
  );
}
