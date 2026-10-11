// Copyright 2026 Piegeddon Contributors. Licensed under the Apache License, Version 2.0.
import { loadConfig } from './config.js';
import { Store } from './store.js';
import { startServer } from './server.js';

const cfg = loadConfig();
const store = await Store.open(cfg.dataDir);
const app = await startServer(cfg, store);

console.log(`[piegeddon] server on http://${cfg.host}:${cfg.port} (mint: ${cfg.mintMode}, season: ${cfg.season.name})`);

for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sig, () => {
    void app.close().then(() => process.exit(0));
  });
}
