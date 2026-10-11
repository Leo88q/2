// Copyright 2026 Piegeddon Contributors. Licensed under the Apache License, Version 2.0.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as os from 'node:os';
import * as path from 'node:path';
import { Store } from '../src/store.js';
import { processMatch, validateAntiCheat, matchReportSchema, type MatchReport } from '../src/match.js';

const NOW = Date.UTC(2026, 9, 12, 12, 0, 0);

function report(id = 'm_test_0002'): MatchReport {
  return {
    matchId: id,
    mode: 'ffa',
    durationSec: 120,
    source: 'web',
    players: [
      { id: 'p1', name: 'Красти', faction: 'crust', hitsLanded: 5, hitsTaken: 1, won: true, eliminated: false },
      { id: 'p2', name: 'Черри', faction: 'cherry', hitsLanded: 1, hitsTaken: 5, won: false, eliminated: true },
    ],
  };
}

async function openStore(): Promise<Store> {
  return Store.open(await fs_mkdtemp());
}

async function fs_mkdtemp(): Promise<string> {
  const { promises: fs } = await import('node:fs');
  return fs.mkdtemp(path.join(os.tmpdir(), 'piegeddon-test-'));
}

test('анти-чит: нереальное число попаданий отклоняется', () => {
  const r = report();
  r.players[0].hitsLanded = 500;
  r.durationSec = 60; // лимит 120
  assert.ok(validateAntiCheat(r));
});

test('анти-чит: два победителя в ffa — ошибка', () => {
  const r = report();
  r.players[1].won = true;
  r.players[1].eliminated = false;
  assert.ok(validateAntiCheat(r));
});

test('схема отклоняет короткий matchId и лишних игроков', () => {
  assert.ok(matchReportSchema.safeParse({ ...report(), matchId: 'x' }).success === false);
  const r = report();
  r.players = [r.players[0]];
  assert.ok(matchReportSchema.safeParse(r).success === false);
});

test('processMatch: награды, профили, идемпотентность', async () => {
  const store = await openStore();
  const res1 = processMatch(store, report('m_idem_1'), NOW);
  assert.equal(res1.accepted, true);
  assert.equal(res1.players.length, 2);
  const p1 = res1.players.find((p) => p.playerId === 'p1')!;
  assert.ok(p1.rewards.some((r) => r.title === 'Ломоть славы'));

  const profile = store.getProfile('p1')!;
  assert.equal(profile.wins, 1);
  assert.equal(profile.coins, 5 * 10 + 50 + 150);

  // Повторная обработка того же матча — no-op.
  const res2 = processMatch(store, report('m_idem_1'), NOW);
  assert.equal(res2.duplicate, true);
  assert.equal(store.getProfile('p1')!.wins, 1);
});

test('processMatch: читерский матч отклоняется', async () => {
  const store = await openStore();
  const r = report('m_cheat_1');
  r.players[0].hitsLanded = 300;
  const res = processMatch(store, r, NOW);
  assert.equal(res.accepted, false);
});

test('leaderboard сортируется по seasonPoints', async () => {
  const store = await openStore();
  processMatch(store, report('m_lb_1'), NOW);
  processMatch(
    store,
    {
      matchId: 'm_lb_2',
      mode: 'ffa',
      durationSec: 60,
      source: 'web',
      players: [
        { id: 'p3', name: 'Завар', faction: 'custard', hitsLanded: 9, hitsTaken: 0, won: true, eliminated: false },
        { id: 'p4', name: 'Меренга', faction: 'meringue', hitsLanded: 0, hitsTaken: 9, won: false, eliminated: true },
      ],
    },
    NOW,
  );
  const top = store.leaderboard();
  assert.equal(top[0].id, 'p3');
  assert.ok(top.length >= 3);
});
