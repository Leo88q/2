// Copyright 2026 Piegeddon Contributors. Licensed under the Apache License, Version 2.0.
import type { Store, PlayerProfile } from './store.js';
import { makeRewardId } from './ids.js';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function randomCode(len = 6, rand: () => number = Math.random): string {
  let s = '';
  for (let i = 0; i < len; i++) s += ALPHABET[Math.floor(rand() * ALPHABET.length)];
  return s;
}

export const REFERRAL_MAX_USES = 50;

export interface ReferralOutcome {
  ok: boolean;
  error?: string;
  rewardIds?: string[];
}

/** Создаёт (или возвращает) реферальный код игрока. */
export function createReferralCode(store: Store, playerId: string, now = Date.now()): { code: string; url: string } {
  const existing = Object.values(store.state.referrals).find((r) => r.ownerId === playerId);
  const code = existing?.code ?? randomCode();
  if (!existing) {
    store.state.referrals[code] = {
      code,
      ownerId: playerId,
      uses: 0,
      maxUses: REFERRAL_MAX_USES,
      createdAt: now,
    };
  }
  return { code, url: `/join/${code}` };
}

/**
 * Активация реферального кода новым игроком.
 * Оба получают гостевой скин «Зрительский Пирог» (коллекция PanicWardrobe).
 */
export function redeemReferral(store: Store, code: string, newPlayerId: string, now = Date.now()): ReferralOutcome {
  const ref = store.state.referrals[code.toUpperCase().trim()];
  if (!ref) return { ok: false, error: 'unknown_code' };
  if (ref.ownerId === newPlayerId) return { ok: false, error: 'self_referral' };
  if (store.state.redeemedBy[newPlayerId]) return { ok: false, error: 'already_redeemed' };
  if (ref.uses >= ref.maxUses) return { ok: false, error: 'code_exhausted' };

  ref.uses += 1;
  store.state.redeemedBy[newPlayerId] = ref.code;

  const ids: string[] = [];
  for (const playerId of [ref.ownerId, newPlayerId]) {
    const r = {
      id: makeRewardId(now),
      playerId,
      kind: 'guest_skin' as const,
      collection: 'PanicWardrobe',
      title: 'Зрительский Пирог',
      rarity: 'common' as const,
      reason: 'referral',
      earnedAt: now,
      mint: { status: 'pending' as const },
    };
    store.addReward(r);
    ids.push(r.id);
  }
  void store.flush();
  return { ok: true, rewardIds: ids };
}

export function ensureProfile(store: Store, id: string, name: string, faction: PlayerProfile['faction'], now = Date.now()): PlayerProfile {
  let p = store.getProfile(id);
  if (!p) {
    p = {
      id,
      name,
      faction,
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
    store.upsertProfile(p);
  }
  return p;
}
