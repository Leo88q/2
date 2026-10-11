// Copyright 2026 Piegeddon Contributors. Licensed under the Apache License, Version 2.0.
//
// Чистый движок наград. Правила — из docs/concept.md (лор «Пирогеддон»):
//  - первая победа -> «Ломоть славы» (крючок конверсии в Web3);
//  - серия из 3 побед -> «Рецепт Золотого Пирога»;
//  - ежедневный «Заказ Пекарни» (3 попадания за матч) -> монеты;
//  - победа в турнире -> «Ломоть недели» (не чаще раза в неделю);
//  - монеты и XP за попадания и победы.
import type { MatchReport } from './match.js';
import type { PlayerProfile, Reward } from './store.js';

export const DAILY_QUEST_HITS = 3;
export const DAILY_QUEST_COINS = 150;
export const COINS_PER_HIT = 10;
export const COINS_PER_WIN = 50;
export const XP_PER_HIT = 5;
export const XP_PER_WIN = 100;

export function utcDay(ts: number): string {
  return new Date(ts).toISOString().slice(0, 10);
}

export function utcYearWeek(ts: number): string {
  const d = new Date(ts);
  const day = (d.getUTCDay() + 6) % 7; // Monday = 0
  d.setUTCDate(d.getUTCDate() - day + 3); // Thursday of this week (ISO)
  const year = d.getUTCFullYear();
  const jan4 = Date.UTC(year, 0, 4);
  const week = 1 + Math.round(((d.getTime() - jan4) / 86400000 - 3 + ((new Date(jan4).getUTCDay() + 6) % 7)) / 7);
  return `${year}-W${String(week).padStart(2, '0')}`;
}

export interface ProfileSnapshot {
  wins: number;
  winStreak: number;
  bestStreak: number;
  questDate: string;
  questClaimed: boolean;
  hasWeeklySlice: boolean;
}

let rewardSeq = 0;
function rewardId(now: number): string {
  rewardSeq += 1;
  return `rw_${now.toString(36)}_${rewardSeq.toString(36)}`;
}

function makeReward(
  playerId: string,
  kind: Reward['kind'],
  collection: string,
  title: string,
  rarity: Reward['rarity'],
  reason: string,
  now: number,
): Reward {
  return {
    id: rewardId(now),
    playerId,
    kind,
    collection,
    title,
    rarity,
    reason,
    earnedAt: now,
    mint: { status: 'pending' },
  };
}

export interface DerivedOutcome {
  rewards: Reward[];
  coinsGained: number;
  xpGained: number;
  seasonPointsGained: number;
  newWins: number;
  newWinStreak: number;
  newBestStreak: number;
  newQuest: { date: string; hits: number; claimed: boolean };
}

/** Вычисляет награды одного матча для одного игрока (чистая функция). */
export function deriveForPlayer(
  report: MatchReport,
  playerId: string,
  snap: ProfileSnapshot,
  now: number,
): DerivedOutcome {
  const mp = report.players.find((p) => p.id === playerId);
  if (!mp) throw new Error(`player ${playerId} not in match`);

  const rewards: Reward[] = [];
  const day = utcDay(now);
  // «Заказ Пекарни» — дневной квест «3 попадания за матч»; once per day.
  const questClaimedToday = snap.questDate === day && snap.questClaimed;
  const newQuest = { date: day, hits: mp.hitsLanded, claimed: questClaimedToday };

  let coins = mp.hitsLanded * COINS_PER_HIT;
  let xp = mp.hitsLanded * XP_PER_HIT;
  let seasonPoints = mp.hitsLanded * 2;

  const newWins = snap.wins + (mp.won ? 1 : 0);
  const newWinStreak = mp.won ? snap.winStreak + 1 : 0;
  const newBestStreak = Math.max(newWinStreak, snap.bestStreak);

  if (mp.won) {
    coins += COINS_PER_WIN;
    xp += XP_PER_WIN;
    seasonPoints += 100;

    // Первая победа — «Ломоть славы», главный крючок конверсии.
    if (snap.wins === 0) {
      rewards.push(
        makeReward(playerId, 'skin', 'PanicWardrobe', 'Ломоть славы', 'rare', 'first_win', now),
      );
    }
    // Серия из 3 побед — «Рецепт Золотого Пирога».
    if (newWinStreak > 0 && newWinStreak % 3 === 0) {
      rewards.push(
        makeReward(playerId, 'recipe', 'GoldenRecipes', 'Рецепт Золотого Пирога', 'epic', 'win_streak_3', now),
      );
    }
    // Победа в турнире — «Ломоть недели» (раз в неделю).
    if (report.mode === 'tournament' && !snap.hasWeeklySlice) {
      rewards.push(
        makeReward(playerId, 'slice', 'TwelveSlices', 'Ломоть недели', 'legendary', 'tournament_win', now),
      );
    }
  }

  // «Заказ Пекарни»: 3 попадания за матч.
  if (mp.hitsLanded >= DAILY_QUEST_HITS && !snap.questClaimed) {
    coins += DAILY_QUEST_COINS;
    newQuest.claimed = true;
    rewards.push(
      makeReward(playerId, 'coin_pack', 'coins', 'Заказ Пекарни', 'common', 'daily_quest', now),
    );
  }

  return {
    rewards,
    coinsGained: coins,
    xpGained: xp,
    seasonPointsGained: seasonPoints,
    newWins,
    newWinStreak,
    newBestStreak,
    newQuest,
  };
}
