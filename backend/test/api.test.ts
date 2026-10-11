// Copyright 2026 Piegeddon Contributors. Licensed under the Apache License, Version 2.0.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import * as os from 'node:os';
import * as path from 'node:path';
import { Store } from '../src/store.js';
import { loadConfig } from '../src/config.js';
import { startServer, type AppServer } from '../src/server.js';

let app: AppServer;
let base: string;

test.before(async () => {
  const { promises: fs } = await import('node:fs');
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'piegeddon-api-'));
  const store = await Store.open(dir);
  const cfg = loadConfig({ PORT: '0', HOST: '127.0.0.1', PIEGEDDON_DATA: dir } as NodeJS.ProcessEnv);
  app = await startServer(cfg, store);
  const addr = app.server.address();
  if (!addr || typeof addr === 'string') throw new Error('no address');
  base = `http://127.0.0.1:${addr.port}`;
});

after(async () => {
  await app.close();
});

test('health', async () => {
  const res = await fetch(`${base}/api/health`);
  assert.equal(res.status, 200);
  const body = (await res.json()) as { ok: boolean; mintMode: string };
  assert.equal(body.ok, true);
  assert.equal(body.mintMode, 'mock');
});

test('профиль -> матч -> claim (mock mint)', async () => {
  const profile = { id: 'api_p1', name: 'Красти', faction: 'crust' };
  let res = await fetch(`${base}/api/profile`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(profile),
  });
  assert.equal(res.status, 200);

  res = await fetch(`${base}/api/match`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      matchId: 'api_match_0001',
      mode: 'ffa',
      durationSec: 90,
      source: 'web',
      players: [
        { id: 'api_p1', name: 'Красти', faction: 'crust', hitsLanded: 4, hitsTaken: 0, won: true, eliminated: false },
        { id: 'api_p2', name: 'Черри', faction: 'cherry', hitsLanded: 0, hitsTaken: 4, won: false, eliminated: true },
      ],
    }),
  });
  assert.equal(res.status, 200);
  const match = (await res.json()) as { players: Array<{ rewards: Array<{ title: string }> }> };
  assert.ok(match.players[0].rewards.some((r) => r.title === 'Ломоть славы'));

  res = await fetch(`${base}/api/rewards/api_p1`);
  const rewards = (await res.json()) as { pending: number };
  assert.ok(rewards.pending >= 1);

  res = await fetch(`${base}/api/claim`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      playerId: 'api_p1',
      wallet: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM',
    }),
  });
  assert.equal(res.status, 200);
  const claim = (await res.json()) as { claimed: number; results: Array<{ ok: boolean; signature: string }> };
  assert.ok(claim.claimed >= 1);
  assert.ok(claim.results[0].ok);
  assert.match(claim.results[0].signature, /^mocktx_/);

  res = await fetch(`${base}/api/rewards/api_p1`);
  const after1 = (await res.json()) as { pending: number };
  assert.equal(after1.pending, 0);
});

test('матч с читом отклоняется (422)', async () => {
  const res = await fetch(`${base}/api/match`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      matchId: 'api_match_cheat',
      mode: 'ffa',
      durationSec: 30,
      source: 'web',
      players: [
        { id: 'cheater', name: 'X', faction: 'crust', hitsLanded: 80, hitsTaken: 0, won: true, eliminated: false },
        { id: 'victim', name: 'Y', faction: 'cherry', hitsLanded: 0, hitsTaken: 5, won: false, eliminated: true },
      ],
    }),
  });
  assert.equal(res.status, 422);
});

test('рефералка через API', async () => {
  let res = await fetch(`${base}/api/referral`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ playerId: 'api_p1' }),
  });
  const { code, url } = (await res.json()) as { code: string; url: string };
  assert.match(code, /^[A-HJ-NP-Z2-9]{6}$/);
  assert.match(url, /^\/join\//);

  res = await fetch(`${base}/api/referral/redeem`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ code, playerId: 'api_friend', name: 'Друг', faction: 'cherry' }),
  });
  assert.equal(res.status, 200);
});

test('комнаты: создание и проверка', async () => {
  let res = await fetch(`${base}/api/rooms`, { method: 'POST' });
  const { code } = (await res.json()) as { code: string };
  assert.match(code, /^[A-HJ-NP-Z2-9]{4}$/);

  res = await fetch(`${base}/api/rooms/${code}`);
  assert.equal(res.status, 200);

  res = await fetch(`${base}/api/rooms/ZZZZ`);
  assert.equal(res.status, 404);
});

test('лидерборд', async () => {
  const res = await fetch(`${base}/api/leaderboard`);
  const body = (await res.json()) as { entries: Array<{ id: string }> };
  assert.ok(body.entries.length >= 1);
  assert.equal(body.entries[0].id, 'api_p1');
});
