// Copyright 2026 Piegeddon Contributors. Licensed under the Apache License, Version 2.0.
import express from 'express';
import { createServer, type Server } from 'node:http';
import * as path from 'node:path';
import { promises as fs, existsSync } from 'node:fs';
import type { Config } from './config.js';
import type { Store } from './store.js';
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

  app.use(buildRoutes(store, cfg));

  // Статика веб-игры (лендинг, ТВ-арена, контроллер).
  const root = webRoot ?? resolveWebRoot();
  if (await fs.stat(root).then(() => true).catch(() => false)) {
    app.use(express.static(root, { extensions: ['html'] }));
    console.log(`[piegeddon] static web root: ${root}`);
    // Реферальная ссылка /join/CODE -> контроллер с подставленным кодом.
    app.get('/join/:code', (req, res) => {
      res.redirect(`/?ref=${encodeURIComponent(req.params.code.toUpperCase())}`);
    });
  }

  const server = createServer(app);

  await new Promise<void>((resolve) => server.listen(cfg.port, cfg.host, resolve));

  return {
    server,
    async close() {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await store.flush();
    },
  };
}
