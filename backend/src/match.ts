// Copyright 2026 Piegeddon Contributors. Licensed under the Apache License, Version 2.0.
import { z } from 'zod';
import type { Store, PlayerProfile, Faction } from './store.js';
import { deriveForPlayer, utcDay, utcYearWeek, type ProfileSnapshot } from './rewards.js';

const faction = z.enum(['crust', 'custard', 'cherry', 'meringue']);

export const matchReportSchema = z.object({
  matchId: z.string().min(8).max(64),
  mode: z.enum(['ffa', 'duel', 'tournament']),
  durationSec: z.number().int().min(5).max(900),
  source: z.enum(['web', 'android', 'native']),
  players: z
    .array(
      z.object({
        id: z.string().min(1).max(64),
        name: z.string().min(1).max(24),
        faction,
        hitsLanded: z.number().int().min(0).max(100),
        hitsTaken: z.number().int().min(0).max(100),
        won: z.boolean(),
        eliminated: z.boolean(),
      }),
    )
    .min(2)
    .max(8),
});

export type MatchReport = z.infer<typeof matchReportSchema>;

export interface MatchResult {
  accepted: boolean;
  duplicate?: boolean;
  error?: string;
  players: Array<{
    playerId: string;
    rewards: Array<{ id: string; title: string; rarity: string; kind: string }>;
    coinsGained: number;
    xpGained: number;
    seasonPointsGained: number;
  }>;
}

/** Анти-чит эвристики: больше 2 попаданий в секунду невозможно. */
export function validateAntiCheat(r: MatchReport): string | null {
  const maxHits = Math.max(2, Math.ceil(r.durationSec * 2));
  for (const p of r.players) {
    if (p.hitsLanded > maxHits) return `implausible hit count for ${p.id}`;
    if (p.won && p.eliminated) return `player ${p.id} both won and eliminated`;
  }
  const winners = r.players.filter((p) => p.won);
  if (r.mode !== 'tournament' && winners.length > 1) return 'multiple winners in single-round mode';
  return null;
}

function snapshotOf(p: PlayerProfile, now: number): ProfileSnapshot {
  const day = utcDay(now);
  return {
    wins: p.wins,
    winStreak: p.winStreak,
    bestStreak: p.bestStreak,
    questDate: p.quests?.date ?? '',
    questClaimed: p.quests?.date === day ? !!p.quests.claimed : false,
    hasWeeklySlice: false, // вычисляется вызывающей стороной по store.weeklySlices
  };
}

export function processMatch(store: Store, report: MatchReport, now = Date.now()): MatchResult {
  const cheat = validateAntiCheat(report);
  if (cheat) return { accepted: false, error: cheat, players: [] };

  if (!store.markMatchProcessed(report.matchId)) {
    return { accepted: true, duplicate: true, players: [] };
  }

  const week = utcYearWeek(now);
  const out: MatchResult = { accepted: true, players: [] };

  for (const mp of report.players) {
    let profile = store.getProfile(mp.id);
    if (!profile) {
      profile = {
        id: mp.id,
        name: mp.name,
        faction: mp.faction as Faction,
        wins: 0,
        winStreak: 0,
        bestStreak: 0,
        totalHits: 0,
        coins: 0,
        xp: 0,
        seasonPoints: 0,
        quests: { date: '', hits: 0, claimed: false },
        createdAt: now,
      };
    }

    const snap = snapshotOf(profile, now);
    snap.hasWeeklySlice = !!store.state.weeklySlices[`${mp.id}:${week}`];

    const derived = deriveForPlayer(report, mp.id, snap, now);

    for (const r of derived.rewards) {
      store.addReward(r);
      if (r.reason === 'tournament_win') {
        store.state.weeklySlices[`${mp.id}:${week}`] = r.id;
      }
    }

    profile.wins = derived.newWins;
    profile.winStreak = derived.newWinStreak;
    profile.bestStreak = derived.newBestStreak;
    profile.totalHits += mp.hitsLanded;
    profile.coins += derived.coinsGained;
    profile.xp += derived.xpGained;
    profile.seasonPoints += derived.seasonPointsGained;
    profile.quests = derived.newQuest;
    store.upsertProfile(profile);

    out.players.push({
      playerId: mp.id,
      rewards: derived.rewards.map((r) => ({ id: r.id, title: r.title, rarity: r.rarity, kind: r.kind })),
      coinsGained: derived.coinsGained,
      xpGained: derived.xpGained,
      seasonPointsGained: derived.seasonPointsGained,
    });
  }

  void store.flush();
  return out;
}
