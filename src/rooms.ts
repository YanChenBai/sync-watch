import type { Peer, Role, Room } from './types.ts';

const rooms = new Map<string, Room>();

export function getOrCreateRoom(roomId: string): Room {
  const existing = rooms.get(roomId);

  if (existing) {
    return existing;
  }

  const room: Room = { peers: new Map() };

  rooms.set(roomId, room);

  return room;
}

export function findRoom(roomId: string): Room | undefined {
  return rooms.get(roomId);
}

export function deleteRoom(roomId: string): void {
  rooms.delete(roomId);
}

export function createPeer(id: string, role: Role, write: (data: string) => unknown): Peer {
  return { id, role, write };
}

export function send(peer: Peer | undefined, message: unknown): void {
  if (!peer) {
    return;
  }

  peer.write(JSON.stringify(message));
}
