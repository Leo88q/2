// Copyright 2026 Piegeddon Contributors. Licensed under the Apache License, Version 2.0.
//
// Игровые комнаты для multi-screen режима (ТВ = арена, телефоны = контроллеры).
// Транспорт: WebSocket. Сервер — релей: входы контроллеров -> ТВ, состояние ТВ -> контроллеры.
import type { WebSocket } from 'ws';

export type Role = 'tv' | 'controller';

export interface RoomMember {
  socket: WebSocket;
  role: Role;
  playerId: string;
  name: string;
}

export interface Room {
  code: string;
  createdAt: number;
  members: Map<WebSocket, RoomMember>;
}

export class RoomHub {
  private rooms = new Map<string, Room>();

  create(): Room {
    for (let i = 0; i < 100; i++) {
      const code = [...Array(4)].map(() => 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 29)]).join('');
      if (!this.rooms.has(code)) {
        const room: Room = { code, createdAt: Date.now(), members: new Map() };
        this.rooms.set(code, room);
        return room;
      }
    }
    throw new Error('room_code_space_exhausted');
  }

  get(code: string): Room | undefined {
    return this.rooms.get(code.toUpperCase());
  }

  join(code: string, member: RoomMember): Room | null {
    const room = this.get(code);
    if (!room) return null;
    room.members.set(member.socket, member);
    this.broadcast(room, {
      type: 'presence',
      players: this.controllers(room).map((m) => ({ playerId: m.playerId, name: m.name })),
      tvConnected: this.hasTv(room),
    });
    return room;
  }

  leave(socket: WebSocket): void {
    for (const room of this.rooms.values()) {
      const member = room.members.get(socket);
      if (member) {
        room.members.delete(socket);
        this.broadcast(room, {
          type: 'presence',
          players: this.controllers(room).map((m) => ({ playerId: m.playerId, name: m.name })),
          tvConnected: this.hasTv(room),
        });
        if (room.members.size === 0) this.rooms.delete(room.code);
      }
    }
  }

  controllers(room: Room): RoomMember[] {
    return [...room.members.values()].filter((m) => m.role === 'controller');
  }

  hasTv(room: Room): boolean {
    return [...room.members.values()].some((m) => m.role === 'tv');
  }

  /** Рассылка сообщения всем участникам (или только одной роли). */
  broadcast(room: Room, msg: unknown, onlyRole?: Role): void {
    const data = JSON.stringify(msg);
    for (const m of room.members.values()) {
      if (onlyRole && m.role !== onlyRole) continue;
      if (m.socket.readyState === 1) m.socket.send(data);
    }
  }

  /** Сообщение конкретному участнику. */
  send(socket: WebSocket, msg: unknown): void {
    if (socket.readyState === 1) socket.send(JSON.stringify(msg));
  }
}
