// Copyright 2026 Piegeddon Contributors. Licensed under the Apache License, Version 2.0.
import { promises as fs } from 'node:fs';
import * as path from 'node:path';

export type Faction = 'crust' | 'custard' | 'cherry' | 'meringue';

export interface QuestState {
  date: string; // YYYY-MM-DD (UTC)
  hits: number;
  claimed: boolean;
}

export interface PlayerProfile {
  id: string;
  name: string;
  faction: Faction;
  wallet?: string;
  wins: number;
  winStreak: number;
  bestStreak: number;
  totalHits: number;
  coins: number;
  xp: number;
  seasonPoints: number;
  quests: QuestState;
  referredBy?: string;
  createdAt: number;
}

export type RewardKind =
  | 'skin'
  | 'recipe'
  | 'splat_fx'
  | 'golden_fling'
  | 'slice'
  | 'guest_skin'
  | 'coin_pack';

export interface Reward {
  id: string;
  playerId: string;
  kind: RewardKind;
  collection: string;
  title: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  reason: string;
  earnedAt: number;
  mint: { status: 'pending' | 'minted' | 'failed'; signature?: string; mintedAt?: number };
}

export interface ReferralCode {
  code: string;
  ownerId: string;
  uses: number;
  maxUses: number;
  createdAt: number;
}

export interface DbShape {
  profiles: Record<string, PlayerProfile>;
  rewards: Reward[];
  referrals: Record<string, ReferralCode>;
  redeemedBy: Record<string, string>; // playerId -> code
  processedMatches: Record<string, number>; // matchId -> processedAt
  weeklySlices: Record<string, string>; // `${playerId}:${yearWeek}` -> rewardId
}

export function emptyDb(): DbShape {
  return {
    profiles: {},
    rewards: [],
    referrals: {},
    redeemedBy: {},
    processedMatches: {},
    weeklySlices: {},
  };
}

export class Store {
  private db: DbShape;
  private file: string;
  private saveTimer: NodeJS.Timeout | null = null;

  private constructor(db: DbShape, file: string) {
    this.db = db;
    this.file = file;
  }

  static async open(dataDir: string): Promise<Store> {
    await fs.mkdir(dataDir, { recursive: true });
    const file = path.join(dataDir, 'db.json');
    let db = emptyDb();
    try {
      const raw = await fs.readFile(file, 'utf8');
      db = { ...emptyDb(), ...(JSON.parse(raw) as DbShape) };
    } catch {
      /* first start */
    }
    return new Store(db, file);
  }

  get state(): DbShape {
    return this.db;
  }

  getProfile(id: string): PlayerProfile | undefined {
    return this.db.profiles[id];
  }

  upsertProfile(p: PlayerProfile): void {
    this.db.profiles[p.id] = p;
    this.scheduleSave();
  }

  addReward(r: Reward): void {
    this.db.rewards.push(r);
    this.scheduleSave();
  }

  rewardsOf(playerId: string): Reward[] {
    return this.db.rewards.filter((r) => r.playerId === playerId);
  }

  pendingRewards(playerId: string): Reward[] {
    return this.rewardsOf(playerId).filter((r) => r.mint.status === 'pending');
  }

  markMinted(rewardId: string, signature: string): void {
    const r = this.db.rewards.find((x) => x.id === rewardId);
    if (r) {
      r.mint = { status: 'minted', signature, mintedAt: Date.now() };
      this.scheduleSave();
    }
  }

  markFailed(rewardId: string): void {
    const r = this.db.rewards.find((x) => x.id === rewardId);
    if (r) {
      r.mint.status = 'failed';
      this.scheduleSave();
    }
  }

  markMatchProcessed(matchId: string): boolean {
    if (this.db.processedMatches[matchId]) return false;
    this.db.processedMatches[matchId] = Date.now();
    this.scheduleSave();
    return true;
  }

  leaderboard(limit = 20): PlayerProfile[] {
    return Object.values(this.db.profiles)
      .sort((a, b) => b.seasonPoints - a.seasonPoints || b.wins - a.wins)
      .slice(0, limit);
  }

  private scheduleSave(): void {
    if (this.saveTimer) return;
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      void this.flush();
    }, 100);
    this.saveTimer.unref?.();
  }

  private flushing: Promise<void> = Promise.resolve();

  flush(): Promise<void> {
    // Последовательные сбросы: параллельные вызовы не гоняются за tmp-файлом.
    this.flushing = this.flushing.then(async () => {
      const tmp = this.file + '.tmp';
      await fs.writeFile(tmp, JSON.stringify(this.db, null, 2), 'utf8');
      await fs.rename(tmp, this.file);
    });
    return this.flushing;
  }
}
