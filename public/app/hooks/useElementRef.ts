import { useCallback, useState } from 'react';

/**
 * 同时提供 callback ref 和元素本身。
 *
 * 元素会被条件渲染（切换房主 / 观看者）挂载卸载，用 state 保存元素
 * 可以让依赖元素的 effect 在真正挂载后重新执行。
 */
export function useElementRef<T extends HTMLElement>(): {
  element: T | null;
  ref: (node: T | null) => void;
} {
  const [element, setElement] = useState<T | null>(null);
  const ref = useCallback((node: T | null) => setElement(node), []);

  return { element, ref };
}
