import type { Role } from '../types.ts';

type Shortcut = [key: string, label: string];

const HOST_SHORTCUTS: Shortcut[] = [
  ['空格 / K', '播放 / 暂停'],
  ['← / →', '后退 / 前进 10 秒'],
  ['↑ / ↓', '调整音量'],
  ['M', '静音'],
  ['F', '全屏'],
  [', / .', '降低 / 提高倍速'],
];

const VIEWER_SHORTCUTS: Shortcut[] = [
  ['空格 / K', '播放 / 暂停'],
  ['↑ / ↓', '调整音量'],
  ['M', '静音'],
  ['F', '全屏'],
];

export function ShortcutHints({ role }: { role: Role | null }) {
  const shortcuts = role === 'viewer' ? VIEWER_SHORTCUTS : HOST_SHORTCUTS;

  return (
    <section className="panel panel-quiet panel-shortcuts">
      <h2 className="panel-title">键盘快捷键</h2>

      <dl className="shortcuts">
        {shortcuts.map(([key, label]) => (
          <div className="shortcut" key={key}>
            <dt>
              <kbd>{key}</kbd>
            </dt>

            <dd>{label}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
