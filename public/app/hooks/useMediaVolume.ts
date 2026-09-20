import { useCallback, useEffect, useState } from 'react';

export interface MediaVolumeApi {
  volume: number;
  muted: boolean;
  setVolume: (value: number) => void;
  nudgeVolume: (delta: number) => void;
  toggleMute: () => void;
}

/**
 * 音量是每个观看者的本地状态：观看者可以自由调节 / 静音，
 * 不会影响房主或其他观看者。
 */
export function useMediaVolume(element: HTMLMediaElement | null): MediaVolumeApi {
  const [volume, setVolumeState] = useState(1);
  const [muted, setMutedState] = useState(false);

  const sync = useCallback(() => {
    if (!element) {
      return;
    }

    setVolumeState(element.volume);
    setMutedState(element.muted);
  }, [element]);

  useEffect(() => {
    if (!element) {
      return;
    }

    sync();
    element.addEventListener('volumechange', sync);

    return () => element.removeEventListener('volumechange', sync);
  }, [element, sync]);

  const setVolume = useCallback(
    (value: number) => {
      if (!element) {
        return;
      }

      const next = Math.min(1, Math.max(0, value));

      element.volume = next;

      if (next > 0 && element.muted) {
        element.muted = false;
      }
    },
    [element],
  );

  const toggleMute = useCallback(() => {
    if (!element) {
      return;
    }

    element.muted = !element.muted;
  }, [element]);

  const nudgeVolume = useCallback(
    (delta: number) => {
      if (!element) {
        return;
      }

      const base = element.muted ? 0 : element.volume;

      setVolume(base + delta);
    },
    [element, setVolume],
  );

  return { volume, muted, setVolume, nudgeVolume, toggleMute };
}
