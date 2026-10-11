// Copyright 2026 Piegeddon Contributors. Licensed under the Apache License, Version 2.0.
import express from 'express';
import { createServer, type Server } from 'node:http';
import { WebSocketServer, type WebSocket } from 'ws';
import * as path from 'node:path';
import { promises as fs, existsSync } from 'node:fs';
import type { Config } from './config.js';
import type { Store } from './store.js';
import { RoomHub } from './rooms.js';
import { buildRoutes } from './routes.js';

function resolveWebRoot(): string {
  const candidates = [
    process.env.WEB_ROOT,
    new URL('../../../web', import.meta.url).pathname, // backend/dist/src -> repo/web
    new URL('../../web', import.meta.url).pathname,
    path.resolve(process.cwd(), '../web'),
    path.resolve(process.cwd(), 'web'),
  ].filter(Boolean) as string[];
  for (const c of candidates) {
    try {
      if (existsSync(path.join(c, 'index.html'))) return c;
    } catch {
      /* fallthrough */
    }
  }
  return candidates[1] ?? path.resolve(process.cwd(), 'web');
}

export interface AppServer {
  server: Server;
  close(): Promise<void>;
}

export async function startServer(cfg: Config, store: Store, webRoot?: string): Promise<AppServer> {
  const app = express();
  app.use(express.json({ limit: '256kb' }));

  const hub = new RoomHub();
  app.use(buildRoutes(store, cfg, hub));

  // Статика веб-игры (лендинг, ТВ-арена, контроллер).
  const root = webRoot ?? resolveWebRoot();
  if (await fs.stat(root).then(() => true).catch(() => false)) {
    app.use(express.static(root, { extensions: ['html'] }));
    console.log(`[piegeddon] static web root: ${root}`);
    // Реферальная ссылка /join/CODE -> контроллер с подставленным кодом.
    app.get('/join/:code', (req, res) => {
      res.redirect(`/play.html?ref=${encodeURIComponent(req.params.code.toUpperCase())}`);
    });
  }

  const server = createServer(app);
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (socket: WebSocket, req) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const roomCode = url.searchParams.get('room') ?? '';
    const role = (url.searchParams.get('role') ?? 'controller') === 'tv' ? 'tv' : 'controller';
    const playerId = url.searchParams.get('player') ?? `guest_${Math.random().toString(36).slice(2, 10)}`;
    const name = url.searchParams.get('name') ?? 'Гость';

    const room = hub.join(roomCode, { socket, role, playerId, name });
    if (!room) {
      hub.send(socket, { type: 'error', error: 'unknown_room' });
      socket.close();
      return;
    }

    hub.send(socket, { type: 'joined', code: room.code, role, playerId });

    socket.on('message', (raw) => {
      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(String(raw));
      } catch {
        return;
      }
      const t = msg.type;
      if (t === 'input') {
        // Контроллер -> ТВ: цель/угол/зарядка/блок/бросок.
        hub.broadcast(room, { ...msg, from: playerId }, 'tv');
      } else if (t === 'state' || t === 'round_end' || t === 'hud') {
        // ТВ -> контроллеры: состояние арены и HUD.
        hub.broadcast(room, msg, 'controller');
      } else if (t === 'ping') {
        hub.send(socket, { type: 'pong', t: Date.now() });
      }
    });

    socket.on('close', () => hub.leave(socket));
  });

  await new Promise<void>((resolve) => server.listen(cfg.port, cfg.host, resolve));

  return {
    server,
    async close() {
      wss.close();
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await store.flush();
    },
  };
}
