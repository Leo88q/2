#!/usr/bin/env node
// Copyright 2026 Piegeddon Contributors. Licensed under the Apache License, Version 2.0.
//
// Создание Bubblegum-дерева и коллекции наград Piegeddon (один раз на кластер).
//
// Использование:
//   PAYER_KEYPAIR_PATH=~/.config/solana/id.json \
//   SOLANA_RPC_URL=https://api.mainnet-beta.solana.com \
//   node scripts/create_tree.mjs [--depth 14 --buffer 64 --canopy 10]
//
// Результат: печатает BUBBLEGUM_TREE и NFT_COLLECTION для backend/.env.
// Стоимость: создание дерева ~$5-10 (зависит от глубины); минт cNFT — доли цента.
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { generateSigner, keypairIdentity, createSignerFromKeypair, percentAmount } from '@metaplex-foundation/umi';
import { createTree } from '@metaplex-foundation/mpl-bubblegum';
import { createNft, mplTokenMetadata } from '@metaplex-foundation/mpl-token-metadata';
import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

function arg(name, dflt) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? Number(process.argv[i + 1]) : dflt;
}

const rpcUrl = process.env.SOLANA_RPC_URL ?? 'https://api.mainnet-beta.solana.com';
const keyPath = process.env.PAYER_KEYPAIR_PATH ?? path.join(os.homedir(), '.config/solana/id.json');
const maxDepth = arg('depth', 14);
const maxBufferSize = arg('buffer', 64);
const canopyDepth = arg('canopy', 10);

const secret = JSON.parse(await fs.readFile(keyPath, 'utf8'));
const umi = createUmi(rpcUrl).use(mplTokenMetadata());
const payer = umi.eddsa.createKeypairFromSecretKey(Uint8Array.from(secret));
umi.use(keypairIdentity(createSignerFromKeypair(umi, payer)));

console.log(`[create_tree] payer: ${payer.publicKey}`);
console.log(`[create_tree] rpc:   ${rpcUrl}`);
console.log(`[create_tree] tree:  depth=${maxDepth} buffer=${maxBufferSize} canopy=${canopyDepth} (~${2 ** maxDepth} cNFT)`);

// 1. Merkle-дерево (Bubblegum)
const merkleTree = generateSigner(umi);
const treeTx = await createTree(umi, {
  merkleTree,
  maxDepth,
  maxBufferSize,
  canopyDepth,
  public: true,
});
await treeTx.sendAndConfirm(umi);
console.log(`[create_tree] BUBBLEGUM_TREE=${merkleTree.publicKey}`);

// 2. Коллекция наград (Metaplex Certified Collection)
const collectionMint = generateSigner(umi);
await createNft(umi, {
  mint: collectionMint,
  name: 'Piegeddon Rewards',
  symbol: 'PIEGEDDON',
  uri: `${process.env.METADATA_BASE_URL ?? 'https://api.piegeddon.game'}/api/metadata/collection`,
  sellerFeeBasisPoints: percentAmount(0),
  isCollection: true,
}).sendAndConfirm(umi);
console.log(`[create_tree] NFT_COLLECTION=${collectionMint.publicKey}`);

console.log(`
Готово. Добавьте в backend/.env:
  PIEGEDDON_MINT_MODE=solana
  SOLANA_RPC_URL=${rpcUrl}
  BUBBLEGUM_TREE=${merkleTree.publicKey}
  NFT_COLLECTION=${collectionMint.publicKey}
  PAYER_KEYPAIR_PATH=${keyPath}
`);
