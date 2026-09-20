import { Elysia, t } from 'elysia';

import { log } from './logger.ts';
import { createPeer, deleteRoom, findRoom, getOrCreateRoom, send } from './rooms.ts';
import type { Peer, Role, Room } from './types.ts';
import { isForwardableMessage } from './types.ts';

const roleSchema = t.Union([t.Literal('host'), t.Literal('viewer')]);

interface JoinRequest {
  roomId: string;

  peerId: string;

  role: Role;

  write: (data: string) => unknown;

  close: () => unknown;
}

/** 房主入场时，把已经等待的观看者告诉房主。 */
function announceExistingViewers(room: Room, host: Peer): void {
  for (const peer of room.peers.values()) {
    if (peer.role !== 'viewer') {
      continue;
    }

    send(host, { type: 'peer-joined', peerId: peer.id });
  }
}

function announceViewerToHost(room: Room, viewer: Peer): void {
  const host = room.hostId ? room.peers.get(room.hostId) : undefined;

  if (host) {
    send(host, { type: 'peer-joined', peerId: viewer.id });

    return;
  }

  send(viewer, { type: 'waiting-host' });
}

function joinRoom(request: JoinRequest): void {
  const { roomId, peerId, role } = request;
  const room = getOrCreateRoom(roomId);

  //
  // 一个房间只允许一个房主
  //
  if (role === 'host' && room.hostId) {
    request.write(JSON.stringify({ type: 'error', message: '房间已存在房主' }));
    request.close();

    return;
  }

  const peer = createPeer(peerId, role, request.write);

  room.peers.set(peerId, peer);

  if (role === 'host') {
    room.hostId = peerId;
    announceExistingViewers(room, peer);
  } else {
    announceViewerToHost(room, peer);
  }

  send(peer, { type: 'ready', peerId });

  log(`[${roomId}] ${role}: ${peerId}`);
}

function parseMessage(raw: unknown): unknown {
  if (typeof raw !== 'string') {
    return raw;
  }

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function forwardSignal(roomId: string, peerId: string, raw: unknown): void {
  const room = findRoom(roomId);

  if (!room) {
    return;
  }

  const message = parseMessage(raw);

  if (!isForwardableMessage(message)) {
    return;
  }

  const source = room.peers.get(peerId);
  const target = room.peers.get(message.target);

  if (!source || !target) {
    return;
  }

  //
  // 禁止 Viewer <-> Viewer 之间互相发送信令
  //
  if (source.role === target.role) {
    return;
  }

  send(target, { ...message, from: peerId });
}

function leaveRoom(roomId: string, peerId: string): void {
  const room = findRoom(roomId);

  if (!room) {
    return;
  }

  const peer = room.peers.get(peerId);

  room.peers.delete(peerId);

  if (room.hostId === peerId) {
    room.hostId = undefined;

    for (const other of room.peers.values()) {
      send(other, { type: 'host-left' });
    }
  } else if (peer) {
    const host = room.hostId ? room.peers.get(room.hostId) : undefined;

    send(host, { type: 'peer-left', peerId });
  }

  if (room.peers.size === 0) {
    deleteRoom(roomId);
  }
}

export const signaling = new Elysia({ name: 'signaling' }).ws('/signal/:roomId/:peerId/:role', {
  params: t.Object({
    roomId: t.String(),

    peerId: t.String(),

    role: roleSchema,
  }),

  open(ws) {
    const { roomId, peerId, role } = ws.data.params;

    joinRoom({
      roomId,
      peerId,
      role,

      write: data => ws.send(data),

      close: () => ws.close(),
    });
  },

  message(ws, raw) {
    const { roomId, peerId } = ws.data.params;

    forwardSignal(roomId, peerId, raw);
  },

  close(ws) {
    const { roomId, peerId } = ws.data.params;

    leaveRoom(roomId, peerId);
  },
});
