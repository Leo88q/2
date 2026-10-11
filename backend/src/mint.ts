// Copyright 2026 Piegeddon Contributors. Licensed under the Apache License, Version 2.0.
//
// Минт cNFT-наград (Metaplex Bubblegum).
// Режимы:
//   mock    — детерминированная заглушка (по умолчанию; для dev/CI/тестов);
//   solana  — реальный минт через @metaplex-foundation/umi + mpl-bubblegum.
//
// Продакшн-включение solana-режима (см. docs/DEPLOY.md):
//   npm i @metaplex-foundation/umi @metaplex-foundation/umi-bundle-defaults \
//        @metaplex-foundation/mpl-bubblegum
//   PIEGEDDON_MINT_MODE=solana SOLANA_RPC_URL=... BUBBLEGUM_TREE=... NFT_COLLECTION=...
import { createHash } from 'node:crypto';
import type { Reward } from './store.js';

export interface MintResult {
  ok: boolean;
  signature: string;
  mode: 'mock' | 'solana';
  error?: string;
}

export interface MintConfig {
  mintMode: 'mock' | 'solana';
  rpcUrl: string;
  treeAddress: string;
  collectionAddress: string;
  payerKeyPath: string;
}

function mockSignature(reward: Reward, wallet: string): string {
  const h = createHash('sha256').update(`${reward.id}:${wallet}:${reward.collection}`).digest('hex');
  return `mocktx_${h.slice(0, 32)}`;
}

export async function mintReward(reward: Reward, wallet: string, cfg: MintConfig): Promise<MintResult> {
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(wallet)) {
    return { ok: false, signature: '', mode: cfg.mintMode, error: 'invalid_wallet_address' };
  }

  if (cfg.mintMode === 'mock') {
    return { ok: true, signature: mockSignature(reward, wallet), mode: 'mock' };
  }

  // --- solana ---------------------------------------------------------------
  try {
    // Опциональные зависимости (см. docs/DEPLOY.md): импорт по строке,
    // чтобы сборка и тесты не требовали их установки.
    const load = (name: string) => import(/* @vite-ignore */ name) as Promise<any>;
    const umiPkg = await load('@metaplex-foundation/umi-bundle-defaults');
    const bubblegum = await load('@metaplex-foundation/mpl-bubblegum');
    const umiLib = await load('@metaplex-foundation/umi');

    const umi = umiPkg.createUmi(cfg.rpcUrl);
    if (!cfg.treeAddress || !cfg.collectionAddress) {
      return { ok: false, signature: '', mode: 'solana', error: 'missing_tree_or_collection' };
    }

    const metadata = {
      name: `Piegeddon · ${reward.title}`,
      symbol: 'PIEGEDDON',
      uri: '', // off-chain JSON; заполняется при настройке metadata-хостинга
      sellerFeeBasisPoints: 0,
      collection: { key: umiLib.publicKey(cfg.collectionAddress), verified: false },
      creators: null,
    };

    const { signature } = await bubblegum.mintToCollectionV1(umi, {
      leafOwner: umiLib.publicKey(wallet),
      merkleTree: umiLib.publicKey(cfg.treeAddress),
      collectionMetadata: umiLib.findMetadataPda(umi, { mint: umiLib.publicKey(cfg.collectionAddress) }),
      metadata,
    }).sendAndConfirm(umi);

    return { ok: true, signature: String(signature), mode: 'solana' };
  } catch (err) {
    return {
      ok: false,
      signature: '',
      mode: 'solana',
      error: `mint_failed: ${(err as Error).message}`,
    };
  }
}
