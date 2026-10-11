// Copyright 2026 Piegeddon Contributors. Licensed under the Apache License, Version 2.0.
export interface Config {
  port: number;
  host: string;
  mintMode: 'mock' | 'solana';
  rpcUrl: string;
  treeAddress: string;
  collectionAddress: string;
  payerKeyPath: string;
  metadataBaseUrl: string;
  dataDir: string;
  season: { id: number; name: string; startsAt: number };
  appVersion: string;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return {
    port: Number(env.PORT ?? 8080),
    host: env.HOST ?? '0.0.0.0',
    mintMode: env.PIEGEDDON_MINT_MODE === 'solana' ? 'solana' : 'mock',
    rpcUrl: env.SOLANA_RPC_URL ?? 'https://api.mainnet-beta.solana.com',
    treeAddress: env.BUBBLEGUM_TREE ?? '',
    collectionAddress: env.NFT_COLLECTION ?? '',
    payerKeyPath: env.PAYER_KEYPAIR_PATH ?? '',
    metadataBaseUrl: (env.METADATA_BASE_URL ?? 'https://api.piegeddon.game').replace(/\/$/, ''),
    dataDir: env.PIEGEDDON_DATA ?? new URL('../data/', import.meta.url).pathname,
    season: {
      id: Number(env.SEASON_ID ?? 1),
      name: env.SEASON_NAME ?? 'Сезон 1: Первый Ломоть',
      startsAt: Number(env.SEASON_START ?? Date.UTC(2026, 9, 1)),
    },
    appVersion: env.APP_VERSION ?? '1.0.0',
  };
}
