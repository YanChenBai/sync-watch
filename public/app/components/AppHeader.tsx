import type { Role } from '../types.ts';
import { ScreenIcon } from './Icons.tsx';

const ROLE_LABELS: Record<Role, string> = {
  host: '房主',
  viewer: '观看者',
};

export interface AppHeaderProps {
  role: Role | null;
  status: string;
  path: string;
}

export function AppHeader({ role, status, path }: AppHeaderProps) {
  return (
    <header className="app-header">
      <div className="brand">
        <span className="brand-mark">
          <ScreenIcon size={22} />
        </span>

        <div className="brand-text">
          <h1 className="brand-title">Sync Watch</h1>
          <p className="brand-tagline">点对点同步观影</p>
        </div>
      </div>

      <div className="chips">
        <span className={role ? 'chip chip-accent' : 'chip'}>
          <span className="chip-label">身份</span>
          <span className="chip-value">{role ? ROLE_LABELS[role] : '未加入'}</span>
        </span>

        <span className="chip" title={status}>
          <span className="chip-label">状态</span>
          <span className="chip-value">{status}</span>
        </span>

        <span className="chip" title={path}>
          <span className="chip-label">链路</span>
          <span className="chip-value">{path}</span>
        </span>
      </div>
    </header>
  );
}
