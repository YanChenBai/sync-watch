export type Role = 'host' | 'viewer';

export interface Peer {
  id: string;
  role: Role;

  write: (data: string) => unknown;
}

export interface Room {
  hostId?: string;

  peers: Map<string, Peer>;
}

/** 服务端 -> 浏览器 */
export type ServerMessage =
  | { type: 'error'; message: string }
  | { type: 'waiting-host' }
  | { type: 'ready'; peerId: string }
  | { type: 'peer-joined'; peerId: string }
  | { type: 'peer-left'; peerId: string }
  | { type: 'host-left' };

/** 浏览器 -> 服务端：只允许转发这三种信令。 */
export interface ForwardableMessage {
  type: 'offer' | 'answer' | 'ice';

  target: string;

  [key: string]: unknown;
}

const FORWARDABLE_TYPES = new Set<string>(['offer', 'answer', 'ice']);

export function isForwardableMessage(value: unknown): value is ForwardableMessage {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as { type?: unknown; target?: unknown };

  return typeof candidate.target === 'string' && FORWARDABLE_TYPES.has(String(candidate.type));
}
