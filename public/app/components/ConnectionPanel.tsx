import type { Role } from '../types.ts';

export interface ConnectionPanelProps {
  roomId: string;
  onRoomIdChange: (value: string) => void;
  role: Role | null;
  forceRelay: boolean;
  onForceRelayChange: (value: boolean) => void;
  hasLibrary: boolean;
  librarySummary: string | null;
  error: string | null;
  directorySupported: boolean;
  onPickDirectory: () => void;
  onStartHost: () => void;
  onStartViewer: () => void;
  onLeave: () => void;
}

export function ConnectionPanel({
  roomId,
  onRoomIdChange,
  role,
  forceRelay,
  onForceRelayChange,
  hasLibrary,
  librarySummary,
  error,
  directorySupported,
  onPickDirectory,
  onStartHost,
  onStartViewer,
  onLeave,
}: ConnectionPanelProps) {
  const joined = role !== null;

  return (
    <section className="panel panel-room">
      <div className="panel-head">
        <h2 className="panel-title">房间</h2>

        {joined && (
          <button type="button" className="btn btn-ghost" onClick={onLeave}>
            离开房间
          </button>
        )}
      </div>

      <div className="room-setup">
        <label className="field">
          <span className="field-label">房间 ID（房主与观看者需一致）</span>

          <input
            value={roomId}
            disabled={joined}
            placeholder="demo"
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            onChange={event => onRoomIdChange(event.target.value)}
          />
        </label>

        <label
          className="field field-check"
          title="连不上时勾选：强制走 TURN 中继转发，更耗流量但更容易连通"
        >
          <input
            type="checkbox"
            checked={forceRelay}
            disabled={joined}
            onChange={event => onForceRelayChange(event.target.checked)}
          />

          <span>强制 TURN 中继</span>
        </label>
      </div>

      {librarySummary && <p className="hint">{librarySummary}</p>}

      {!directorySupported && (
        <p className="hint">这里没法选本地文件夹，所以不能当房主。填入房间 ID 直接加入观看即可。</p>
      )}

      <div className="room-actions">
        {directorySupported && (
          <div className="action-card">
            <p className="action-title">作为房主</p>

            <p className="action-desc">选择本机视频目录，创建房间并同步播放。</p>

            <div className="action-buttons">
              <button type="button" className="btn" disabled={joined} onClick={onPickDirectory}>
                {hasLibrary ? '重新选择目录' : '选择播放目录'}
              </button>

              <button
                type="button"
                className="btn btn-primary"
                disabled={joined || !hasLibrary}
                onClick={onStartHost}
              >
                创建房间
              </button>
            </div>
          </div>
        )}

        <div className="action-card">
          <p className="action-title">作为观看者</p>

          <p className="action-desc">填入相同的房间 ID，加入后跟随房主播放。</p>

          <div className="action-buttons">
            <button
              type="button"
              className="btn btn-primary"
              disabled={joined}
              onClick={onStartViewer}
            >
              加入观看
            </button>
          </div>
        </div>
      </div>

      {error && (
        <p className="alert" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
