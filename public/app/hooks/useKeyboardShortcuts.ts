import { useEffect, useRef } from 'react';

export interface ShortcutDefinition {
  /** 匹配 KeyboardEvent.key 或 KeyboardEvent.code。 */
  keys: string[];
  run: () => void;
  /** 默认阻止浏览器默认行为（空格滚动页面等）。 */
  preventDefault?: boolean;
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  if (target.isContentEditable) {
    return true;
  }

  return target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT';
}

/** 在 window 上注册快捷键，输入框聚焦时自动让路。 */
export function useKeyboardShortcuts(shortcuts: ShortcutDefinition[], enabled = true): void {
  const shortcutsRef = useRef(shortcuts);

  shortcutsRef.current = shortcuts;

  useEffect(() => {
    if (!enabled) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent): void {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }

      if (isTypingTarget(event.target)) {
        return;
      }

      const shortcut = shortcutsRef.current.find(candidate =>
        candidate.keys.some(key => key === event.key || key === event.code),
      );

      if (!shortcut) {
        return;
      }

      if (shortcut.preventDefault !== false) {
        event.preventDefault();
      }

      shortcut.run();
    }

    window.addEventListener('keydown', handleKeyDown);

    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enabled]);
}
