// Copyright 2026 Piegeddon Contributors. Licensed under the Apache License, Version 2.0.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deriveForPlayer, utcYearWeek, utcDay } from '../src/rewards.js';
import type { MatchReport } from '../src/match.js';

const NOW = Date.UTC(2026, 9, 12, 12, 0, 0);

function report(over: Partial<MatchReport> = {}): MatchReport {
  return {
    matchId: 'm_test_0001',
    mode: 'ffa',
    durationSec: 120,
    source: 'web',
    players: [
      { id: 'p1', name: 'Красти', faction: 'crust', hitsLanded: 5, hitsTaken: 1, won: true, eliminated: false },
      { id: 'p2', name: 'Черри', faction: 'cherry', hitsLanded: 1, hitsTaken: 5, won: false, eliminated: true },
    ],
    ...over,
  };
}

function snap(over = {}) {
  return {
    wins: 0,
    winStreak: 0,
    bestStreak: 0,
    questDate: '',
    questClaimed: false,
    hasWeeklySlice: false,
    ...over,
  };
}

test('первая победа даёт «Ломоть славы»', () => {
  const out = deriveForPlayer(report(), 'p1', snap(), NOW);
  assert.equal(out.rewards.length, 2); // skin + coin_pack (5 хитов >= 3)
  const first = out.rewards.find((r) => r.reason === 'first_win');
  assert.ok(first);
  assert.equal(first!.title, 'Ломоть славы');
  assert.equal(first!.collection, 'PanicWardrobe');
  assert.equal(out.newWins, 1);
});

test('вторая победа не даёт первый скин повторно', () => {
  const out = deriveForPlayer(report(), 'p1', snap({ wins: 1 }), NOW);
  assert.ok(!out.rewards.some((r) => r.reason === 'first_win'));
});

test('серия из 3 побед даёт «Рецепт Золотого Пирога»', () => {
  const out = deriveForPlayer(report(), 'p1', snap({ wins: 2, winStreak: 2 }), NOW);
  const streak = out.rewards.find((r) => r.reason === 'win_streak_3');
  assert.ok(streak);
  assert.equal(streak!.collection, 'GoldenRecipes');
  assert.equal(out.newWinStreak, 3);
});

test('поражение обнуляет серию', () => {
  const rep = report({
    players: [
      { id: 'p1', name: 'Красти', faction: 'crust', hitsLanded: 2, hitsTaken: 4, won: false, eliminated: true },
    ],
  });
  rep.players.push({ id: 'p2', name: 'Черри', faction: 'cherry', hitsLanded: 4, hitsTaken: 2, won: true, eliminated: false });
  const out = deriveForPlayer(rep, 'p1', snap({ wins: 3, winStreak: 3 }), NOW);
  assert.equal(out.newWinStreak, 0);
  assert.equal(out.rewards.length, 0);
});

test('заказ пекарни: 3 попадания за матч, раз в день', () => {
  const out = deriveForPlayer(report(), 'p1', snap(), NOW);
  const quest = out.rewards.find((r) => r.reason === 'daily_quest');
  assert.ok(quest);
  assert.equal(out.coinsGained, 5 * 10 + 50 + 150);

  const out2 = deriveForPlayer(report(), 'p1', snap({ questDate: utcDay(NOW), questClaimed: true }), NOW);
  assert.ok(!out2.rewards.some((r) => r.reason === 'daily_quest'));
  assert.equal(out2.coinsGained, 5 * 10 + 50);
});

test('турнирная победа даёт «Ломоть недели» один раз в неделю', () => {
  const rep = report({ mode: 'tournament' });
  const out = deriveForPlayer(rep, 'p1', snap(), NOW);
  const slice = out.rewards.find((r) => r.reason === 'tournament_win');
  assert.ok(slice);
  assert.equal(slice!.collection, 'TwelveSlices');

  const out2 = deriveForPlayer(rep, 'p1', snap({ wins: 5, hasWeeklySlice: true }), NOW);
  assert.ok(!out2.rewards.some((r) => r.reason === 'tournament_win'));
});

test('utcYearWeek стабилен в пределах недели', () => {
  assert.equal(utcYearWeek(Date.UTC(2026, 9, 12)), utcYearWeek(Date.UTC(2026, 9, 14)));
  assert.notEqual(utcYearWeek(Date.UTC(2026, 9, 12)), utcYearWeek(Date.UTC(2026, 9, 19)));
});

test('монеты/XP считаются по формуле', () => {
  const out = deriveForPlayer(
    report({ players: [{ id: 'p1', name: 'К', faction: 'crust', hitsLanded: 2, hitsTaken: 0, won: true, eliminated: false }] }),
    'p1',
    snap(),
    NOW,
  );
  assert.equal(out.coinsGained, 2 * 10 + 50);
  assert.equal(out.xpGained, 2 * 5 + 100);
});
