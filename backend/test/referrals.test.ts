// Copyright 2026 Piegeddon Contributors. Licensed under the Apache License, Version 2.0.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as os from 'node:os';
import * as path from 'node:path';
import { Store } from '../src/store.js';
import { createReferralCode, redeemReferral, ensureProfile, randomCode } from '../src/referrals.js';

const NOW = Date.UTC(2026, 9, 12);

async function openStore(): Promise<Store> {
  const { promises: fs } = await import('node:fs');
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'piegeddon-ref-'));
  return Store.open(dir);
}

test('randomCode использует алфавит без неоднозначных символов', () => {
  for (let i = 0; i < 50; i++) {
    const c = randomCode(6);
    assert.match(c, /^[A-HJ-NP-Z2-9]{6}$/);
  }
});

test('рефералка: оба получают «Зрительский Пирог», защита от повторов', async () => {
  const store = await openStore();
  ensureProfile(store, 'owner1', 'Красти', 'crust', NOW);
  const { code } = createReferralCode(store, 'owner1', NOW);

  ensureProfile(store, 'friend1', 'Черри', 'cherry', NOW);
  const res = redeemReferral(store, code, 'friend1', NOW);
  assert.equal(res.ok, true);
  assert.equal(res.rewardIds!.length, 2);

  const ownerRewards = store.rewardsOf('owner1');
  const friendRewards = store.rewardsOf('friend1');
  assert.equal(ownerRewards[0].title, 'Зрительский Пирог');
  assert.equal(friendRewards[0].title, 'Зрительский Пирог');

  // Повторная активация тем же игроком запрещена.
  const again = redeemReferral(store, code, 'friend1', NOW);
  assert.equal(again.ok, false);
  assert.equal(again.error, 'already_redeemed');
});

test('рефералка: самоприглашение и чужие коды', async () => {
  const store = await openStore();
  ensureProfile(store, 'owner2', 'Завар', 'custard', NOW);
  const { code } = createReferralCode(store, 'owner2', NOW);

  assert.equal(redeemReferral(store, code, 'owner2', NOW).error, 'self_referral');
  assert.equal(redeemReferral(store, 'ZZZZZZ', 'someone', NOW).error, 'unknown_code');
});

test('код исчерпывается после maxUses', async () => {
  const store = await openStore();
  ensureProfile(store, 'owner3', 'М', 'meringue', NOW);
  const { code } = createReferralCode(store, 'owner3', NOW);
  store.state.referrals[code].maxUses = 1;

  ensureProfile(store, 'f1', 'А', 'crust', NOW);
  assert.equal(redeemReferral(store, code, 'f1', NOW).ok, true);
  ensureProfile(store, 'f2', 'Б', 'crust', NOW);
  assert.equal(redeemReferral(store, code, 'f2', NOW).error, 'code_exhausted');
});
