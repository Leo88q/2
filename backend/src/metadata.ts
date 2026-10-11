// Copyright 2026 Piegeddon Contributors. Licensed under the Apache License, Version 2.0.
//
// Метаданные cNFT-наград (стандарт Metaplex JSON).
// URI метаданных указывает на этот backend: GET /api/metadata/:rewardId.
import type { Reward } from './store.js';
import type { Config } from './config.js';

export const COLLECTIONS: Record<string, { title: string; image: string; description: string }> = {
  PanicWardrobe: {
    title: 'Panic Wardrobe',
    image: '/img/collection_icon.png',
    description: 'Костюмы шоу «Пирогеддон» — скины картонных героев.',
  },
  GoldenRecipes: {
    title: 'Golden Recipes',
    image: '/img/collection_icon.png',
    description: 'Редкие рецепты пирогов — заряд для пирогомёта.',
  },
  SplatFX: {
    title: 'Splat FX',
    image: '/img/collection_icon.png',
    description: 'Уникальные эффекты попаданий на арене.',
  },
  GoldenFling: {
    title: 'Golden Fling',
    image: '/img/collection_icon.png',
    description: 'Золотые пирогомёты — редкий реквизит чемпионов.',
  },
  TwelveSlices: {
    title: 'Twelve Slices',
    image: '/img/collection_icon.png',
    description: 'Ломтья Золотого Пирога — главные трофеи сезона.',
  },
};

const REASON_RU: Record<string, string> = {
  first_win: 'За первую победу',
  win_streak_3: 'За серию из 3 побед',
  tournament_win: 'За победу в турнире',
  daily_quest: 'За выполнение Заказа Пекарни',
  referral: 'За приглашение друга',
};

export function rewardMetadata(reward: Reward, cfg: Config): Record<string, unknown> {
  const col = COLLECTIONS[reward.collection] ?? {
    title: reward.collection,
    image: '/img/collection_icon.png',
    description: 'Награда шоу «Пирогеддон».',
  };
  return {
    name: `Piegeddon · ${reward.title}`,
    symbol: 'PIEGEDDON',
    description: `${col.description} Награда сезона «${cfg.season.name}». ${REASON_RU[reward.reason] ?? reward.reason}.`,
    image: `${cfg.metadataBaseUrl}${col.image}`,
    external_url: 'https://piegeddon.game',
    attributes: [
      { trait_type: 'Коллекция', value: col.title },
      { trait_type: 'Редкость', value: reward.rarity },
      { trait_type: 'Сезон', value: cfg.season.name },
      { trait_type: 'Тип', value: reward.kind },
      { trait_type: 'Причина', value: REASON_RU[reward.reason] ?? reward.reason },
    ],
    properties: {
      category: 'image',
      files: [{ uri: `${cfg.metadataBaseUrl}${col.image}`, type: 'image/png' }],
    },
  };
}

export function collectionMetadata(cfg: Config): Record<string, unknown> {
  return {
    name: 'Piegeddon Rewards',
    symbol: 'PIEGEDDON',
    description: `NFT-награды шоу «Пирогеддон»: скины, рецепты, эффекты и Ломтья Золотого Пирога. Сезон: ${cfg.season.name}.`,
    image: `${cfg.metadataBaseUrl}/img/collection_icon.png`,
    external_url: 'https://piegeddon.game',
    attributes: [{ trait_type: 'Сезон', value: cfg.season.name }],
  };
}
