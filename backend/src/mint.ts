// Copyright 2026 Piegeddon Contributors. Licensed under the Apache License, Version 2.0.
//
// Минт cNFT-наград (Metaplex Bubblegum, сжатые NFT).
//
// Режимы:
//   mock    — детерминированная заглушка (dev/CI/тесты);
//   solana  — реальный минт через @metaplex-foundation/umi + mpl-bubblegum.
//             Создание дерева и коллекции: backend/scripts/create_tree.mjs
//
// Экономика: комиссию платит проект (payer), игрок — никогда.
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import {
  base58,
  createSignerFromKeypair,
  keypairIdentity,
  publicKey,
  type Umi,
} from '@metaplex-foundation/umi';
import { mintToCollectionV1, TokenProgramVersion } from '@metaplex-foundation/mpl-bubblegum';
import type { Reward } from './store.js';
import type { Config } from './config.js';

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
  metadataBaseUrl: string;
}

function mockSignature(reward: Reward, wallet: string): string {
  const h = createHash('sha256').update(`${reward.id}:${wallet}:${reward.collection}`).digest('hex');
  return `mocktx_${h.slice(0, 32)}`;
}

export function mintConfigFrom(cfg: Config): MintConfig {
  return {
    mintMode: cfg.mintMode,
    rpcUrl: cfg.rpcUrl,
    treeAddress: cfg.treeAddress,
    collectionAddress: cfg.collectionAddress,
    payerKeyPath: cfg.payerKeyPath,
    metadataBaseUrl: cfg.metadataBaseUrl,
  };
}

/** Загружает payer-keypair (формат Solana CLI: JSON-массив байт). */
async function loadUmi(cfg: MintConfig): Promise<Umi> {
  const umi = createUmi(cfg.rpcUrl);
  const secret = JSON.parse(await fs.readFile(cfg.payerKeyPath, 'utf8')) as number[];
  const keypair = umi.eddsa.createKeypairFromSecretKey(Uint8Array.from(secret));
  umi.use(keypairIdentity(createSignerFromKeypair(umi, keypair)));
  return umi;
}

export async function mintReward(reward: Reward, wallet: string, cfg: MintConfig): Promise<MintResult> {
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(wallet)) {
    return { ok: false, signature: '', mode: cfg.mintMode, error: 'invalid_wallet_address' };
  }

  if (cfg.mintMode === 'mock') {
    return { ok: true, signature: mockSignature(reward, wallet), mode: 'mock' };
  }

  // --- solana (Bubblegum, сжатый NFT) -------------------------------------
  try {
    if (!cfg.treeAddress || !cfg.collectionAddress || !cfg.payerKeyPath) {
      return {
        ok: false,
        signature: '',
        mode: 'solana',
        error: 'missing_config: BUBBLEGUM_TREE / NFT_COLLECTION / PAYER_KEYPAIR_PATH (см. backend/scripts/create_tree.mjs)',
      };
    }

    const umi = await loadUmi(cfg);
    const metadata = {
      name: `Piegeddon · ${reward.title}`,
      symbol: 'PIEGEDDON',
      uri: `${cfg.metadataBaseUrl}/api/metadata/${reward.id}`,
      sellerFeeBasisPoints: 0,
      collection: { key: publicKey(cfg.collectionAddress), verified: false },
      creators: [{ address: umi.identity.publicKey, verified: false, share: 100 }],
      tokenProgramVersion: TokenProgramVersion.Original,
    };

    const tx = mintToCollectionV1(umi, {
      leafOwner: publicKey(wallet),
      merkleTree: publicKey(cfg.treeAddress),
      collectionMint: publicKey(cfg.collectionAddress),
      metadata,
    });

    const { signature } = await tx.sendAndConfirm(umi);
    return { ok: true, signature: base58.deserialize(signature)[0], mode: 'solana' };
  } catch (err) {
    return {
      ok: false,
      signature: '',
      mode: 'solana',
      error: `mint_failed: ${(err as Error).message}`,
    };
  }
}
