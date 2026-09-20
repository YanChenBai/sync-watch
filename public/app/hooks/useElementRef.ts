import { type RefObject, useCallback, useRef, useState } from 'react';

/**
 * 同时提供 callback ref、ref 对象和元素本身。
 *
 * 元素会被条件渲染（切换房主 / 观看者）挂载卸载，用 state 保存元素
 * 可以让依赖元素的 effect 在真正挂载后重新执行；ref 对象则给那些
 * 需要「随时读取最新值」的回调使用（例如读取片源分辨率）。
 */
export function useElementRef<T extends HTMLElement>(): {
  element: T | null;
  elementRef: RefObject<T | null>;
  ref: (node: T | null) => void;
} {
  const elementRef = useRef<T | null>(null);
  const [element, setElement] = useState<T | null>(null);

  const ref = useCallback((node: T | null) => {
    elementRef.current = node;
    setElement(node);
  }, []);

  return { element, elementRef, ref };
}
