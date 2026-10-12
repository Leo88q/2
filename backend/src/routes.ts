// Copyright 2026 Piegeddon Contributors. Licensed under the Apache License, Version 2.0.
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import type { Config } from './config.js';
import type { Store } from './store.js';
import { matchReportSchema, processMatch } from './match.js';
import { createReferralCode, redeemReferral, ensureProfile } from './referrals.js';
import { mintReward, mintConfigFrom } from './mint.js';
import { rewardMetadata, collectionMetadata } from './metadata.js';

const profileSchema = z.object({
  id: z.string().min(4).max(64),
  name: z.string().min(1).max(24),
  faction: z.enum(['crust', 'custard', 'cherry', 'meringue']),
});

export function buildRoutes(store: Store, cfg: Config): Router {
  const r = Router();

  // Метаданные cNFT (стандарт Metaplex JSON) — публичный URI для минта.
  r.get('/api/metadata/collection', (_req, res) => {
    res.json(collectionMetadata(cfg));
  });

  r.get('/api/metadata/:rewardId', (req, res) => {
    const reward = store.state.rewards.find((x) => x.id === req.params.rewardId);
    if (!reward) return res.status(404).json({ error: 'not_found' });
    res.json(rewardMetadata(reward, cfg));
  });

  r.get('/api/health', (_req, res) => {
    res.json({ ok: true, version: cfg.appVersion, mintMode: cfg.mintMode });
  });

  r.get('/api/config', (_req, res) => {
    res.json({
      mintMode: cfg.mintMode,
      season: cfg.season,
      version: cfg.appVersion,
      factions: ['crust', 'custard', 'cherry', 'meringue'],
    });
  });

  r.post('/api/profile', (req: Request, res: Response) => {
    const parsed = profileSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'bad_profile' });
    const p = ensureProfile(store, parsed.data.id, parsed.data.name, parsed.data.faction);
    res.json(p);
  });

  r.get('/api/profile/:id', (req, res) => {
    const p = store.getProfile(req.params.id);
    if (!p) return res.status(404).json({ error: 'not_found' });
    res.json(p);
  });

  r.post('/api/match', (req: Request, res: Response) => {
    const parsed = matchReportSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'bad_match', details: parsed.error.issues });
    }
    const result = processMatch(store, parsed.data);
    if (!result.accepted) return res.status(422).json({ error: result.error });
    res.json(result);
  });

  r.get('/api/rewards/:playerId', (req, res) => {
    const rewards = store.rewardsOf(req.params.playerId);
    res.json({ rewards, pending: rewards.filter((x) => x.mint.status === 'pending').length });
  });

  r.post('/api/claim', async (req: Request, res: Response) => {
    const schema = z.object({ playerId: z.string().min(1), wallet: z.string().min(32).max(64) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'bad_claim' });
    const { playerId, wallet } = parsed.data;

    const profile = store.getProfile(playerId);
    if (profile) {
      profile.wallet = wallet;
      store.upsertProfile(profile);
    }

    const pending = store.pendingRewards(playerId);
    const results = [];
    for (const reward of pending) {
      const minted = await mintReward(reward, wallet, mintConfigFrom(cfg));
      if (minted.ok) {
        store.markMinted(reward.id, minted.signature);
        results.push({ rewardId: reward.id, title: reward.title, ok: true, signature: minted.signature });
      } else {
        store.markFailed(reward.id);
        results.push({ rewardId: reward.id, title: reward.title, ok: false, error: minted.error });
      }
    }
    res.json({ claimed: results.length, results });
  });

  r.post('/api/referral', (req: Request, res: Response) => {
    const schema = z.object({ playerId: z.string().min(1) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'bad_request' });
    if (!store.getProfile(parsed.data.playerId)) return res.status(404).json({ error: 'not_found' });
    res.json(createReferralCode(store, parsed.data.playerId));
  });

  r.post('/api/referral/redeem', (req: Request, res: Response) => {
    const schema = z.object({
      code: z.string().min(4).max(12),
      playerId: z.string().min(1),
      name: z.string().min(1).max(24).optional(),
      faction: z.enum(['crust', 'custard', 'cherry', 'meringue']).optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'bad_request' });
    const { code, playerId } = parsed.data;
    ensureProfile(store, playerId, parsed.data.name ?? 'Гость', parsed.data.faction ?? 'crust');
    const outcome = redeemReferral(store, code, playerId);
    if (!outcome.ok) return res.status(422).json({ error: outcome.error });
    res.json(outcome);
  });

  r.get('/api/leaderboard', (_req, res) => {
    res.json({
      season: cfg.season,
      entries: store.leaderboard(20).map((p, i) => ({
        rank: i + 1,
        id: p.id,
        name: p.name,
        faction: p.faction,
        wins: p.wins,
        seasonPoints: p.seasonPoints,
      })),
    });
  });

  return r;
}
