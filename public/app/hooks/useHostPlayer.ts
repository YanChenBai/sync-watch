import { useCallback, useEffect, useRef, useState } from 'react';

import { pickLibraryDirectory, readPlaylist, resolveFile } from '../lib/file-system.ts';
import { toggleFullscreen as toggleElementFullscreen } from '../lib/fullscreen.ts';
import { captureStreamFromVideo, waitForMedia } from '../lib/media.ts';
import type { PlaybackState, Playlist } from '../types.ts';
import { useElementRef } from './useElementRef.ts';

export const RATE_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 2];

const MEDIA_EVENTS = ['play', 'pause', 'seeked', 'ratechange', 'loadedmetadata', 'durationchange'];

export interface HostPlayerApi {
  video: HTMLVideoElement | null;
  videoRef: (node: HTMLVideoElement | null) => void;
  playlist: Playlist | null;
  currentIndex: number;
  currentTitle: string;
  paused: boolean;
  currentTime: number;
  duration: number;
  rate: number;
  loadLibrary: () => Promise<Playlist | null>;
  openItem: (index: number, autoplay: boolean) => Promise<void>;
  selectItem: (index: number) => Promise<void>;
  togglePlay: () => Promise<void>;
  seekBy: (delta: number) => void;
  seekTo: (time: number) => void;
  setRate: (rate: number) => void;
  stepRate: (direction: number) => void;
  toggleFullscreen: () => Promise<void>;
  captureStream: () => MediaStream;
  /** 片源真实分辨率，供发送端换算降采样倍数。 */
  getSourceSize: () => { width: number; height: number };
}

export function useHostPlayer(options: {
  onStateChange?: (state: PlaybackState) => void;
}): HostPlayerApi {
  const { onStateChange } = options;

  const {
    element: video,
    elementRef: videoElementRef,
    ref: videoRef,
  } = useElementRef<HTMLVideoElement>();

  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [paused, setPaused] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [rate, setRateState] = useState(1);
  const [directory, setDirectory] = useState<FileSystemDirectoryHandle | null>(null);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const onStateChangeRef = useRef(onStateChange);

  onStateChangeRef.current = onStateChange;

  const notify = useCallback(() => {
    const item = playlist?.items[currentIndex];

    if (!video || !item) {
      return;
    }

    onStateChangeRef.current?.({
      type: 'state',
      index: currentIndex,
      title: item.title,
      paused: video.paused,
      currentTime: video.currentTime,
      duration: Number.isFinite(video.duration) ? video.duration : 0,
      playbackRate: video.playbackRate,
    });
  }, [currentIndex, playlist, video]);

  const syncMedia = useCallback(() => {
    if (!video) {
      return;
    }

    setPaused(video.paused);
    setCurrentTime(video.currentTime);
    setDuration(Number.isFinite(video.duration) ? video.duration : 0);
    setRateState(video.playbackRate);
  }, [video]);

  useEffect(() => {
    if (!video) {
      return;
    }

    function handleDiscrete(): void {
      syncMedia();
      notify();
    }

    const element = video;

    function handleTimeUpdate(): void {
      setCurrentTime(element.currentTime);
    }

    for (const name of MEDIA_EVENTS) {
      element.addEventListener(name, handleDiscrete);
    }

    element.addEventListener('timeupdate', handleTimeUpdate);

    const timer = window.setInterval(() => {
      if (!element.paused) {
        notify();
      }
    }, 1000);

    return () => {
      window.clearInterval(timer);

      for (const name of MEDIA_EVENTS) {
        element.removeEventListener(name, handleDiscrete);
      }

      element.removeEventListener('timeupdate', handleTimeUpdate);
    };
  }, [notify, syncMedia, video]);

  useEffect(() => {
    return () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [objectUrl]);

  const loadLibrary = useCallback(async () => {
    const nextDirectory = await pickLibraryDirectory();

    if (!nextDirectory) {
      return null;
    }

    const data = await readPlaylist(nextDirectory);

    setDirectory(nextDirectory);
    setPlaylist(data);
    setCurrentIndex(0);

    return data;
  }, []);

  const openItem = useCallback(
    async (index: number, autoplay: boolean) => {
      const item = playlist?.items[index];

      if (!directory || !video || !item) {
        throw new Error('请先选择包含 playlist.json 的目录');
      }

      const file = await resolveFile(directory, item.src);
      const nextUrl = URL.createObjectURL(file);

      video.src = nextUrl;
      video.load();

      setCurrentIndex(index);
      setObjectUrl(nextUrl);

      await waitForMedia(video);

      if (autoplay) {
        try {
          await video.play();
        } catch {
          // 自动播放被拦截时保持暂停，交给用户手势开始
        }
      }

      syncMedia();
      notify();
    },
    [directory, notify, playlist, syncMedia, video],
  );

  const selectItem = useCallback(
    async (index: number) => {
      await openItem(index, video ? !video.paused : true);
    },
    [openItem, video],
  );

  const togglePlay = useCallback(async () => {
    if (!video) {
      return;
    }

    if (video.paused) {
      try {
        await video.play();
      } catch (cause) {
        console.warn('[player] 播放失败', cause);
      }

      return;
    }

    video.pause();
  }, [video]);

  const seekTo = useCallback(
    (time: number) => {
      if (!video) {
        return;
      }

      const limit = Number.isFinite(video.duration) ? video.duration : Number.POSITIVE_INFINITY;

      video.currentTime = Math.min(Math.max(0, time), limit);
    },
    [video],
  );

  const seekBy = useCallback(
    (delta: number) => {
      if (!video) {
        return;
      }

      seekTo(video.currentTime + delta);
    },
    [seekTo, video],
  );

  const setRate = useCallback(
    (next: number) => {
      if (!video) {
        return;
      }

      video.playbackRate = next;
    },
    [video],
  );

  const stepRate = useCallback(
    (direction: number) => {
      if (!video) {
        return;
      }

      const current = RATE_STEPS.indexOf(video.playbackRate);
      const base = current === -1 ? RATE_STEPS.indexOf(1) : current;
      const next = Math.min(RATE_STEPS.length - 1, Math.max(0, base + direction));

      video.playbackRate = RATE_STEPS[next];
    },
    [video],
  );

  const toggleFullscreen = useCallback(() => toggleElementFullscreen(video), [video]);

  const captureStream = useCallback(() => captureStreamFromVideo(video), [video]);

  const getSourceSize = useCallback(() => {
    const element = videoElementRef.current;

    return {
      width: element?.videoWidth ?? 0,
      height: element?.videoHeight ?? 0,
    };
  }, [videoElementRef]);

  return {
    video,
    videoRef,
    playlist,
    currentIndex,
    currentTitle: playlist?.items[currentIndex]?.title ?? '',
    paused,
    currentTime,
    duration,
    rate,
    loadLibrary,
    openItem,
    selectItem,
    togglePlay,
    seekBy,
    seekTo,
    setRate,
    stepRate,
    toggleFullscreen,
    captureStream,
    getSourceSize,
  };
}
