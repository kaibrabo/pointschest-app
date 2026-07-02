import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CreditCard } from '../types';

interface ApiCardsResponse {
  cards?: ApiCard[];
}

interface ApiCard {
  id: string;
  name: string;
  issuer: string;
  type?: string;
  rewardRate?: number;
  rewardCategories?: Record<string, number>;
  welcomeBonus?: string | null;
  annualFee?: number;
  apr?: string;
  creditScore?: string;
  benefits?: string[];
  applyUrl?: string;
}

interface CachedCardsPayload {
  cachedAt: number;
  cards: CreditCard[];
}

const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  (Platform.OS === 'android' ? 'http://10.0.2.2:4000' : 'http://localhost:4000');
const CARDS_CACHE_KEY = 'cardsCacheV1';
const CARDS_CACHE_TTL_MS = 1000 * 60 * 30;

const DEFAULT_APR = {
  purchase: 19.99,
  balance: 19.99,
  cash: 29.99,
};

const DEFAULT_CREDIT_SCORE = {
  min: 670,
  recommended: 700,
};

function mapCardType(type?: string): CreditCard['cardType'] {
  if (type === 'Travel' || type === 'Cash Back' || type === 'Business' || type === 'Student' || type === 'Secured') {
    return type;
  }
  return 'Cash Back';
}

function formatCategory(category: string): string {
  return category
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function mapRewards(card: ApiCard): CreditCard['rewards'] {
  const entries = Object.entries(card.rewardCategories || {});
  if (entries.length) {
    return entries.map(([category, rate]) => ({
      category: formatCategory(category),
      rate,
    }));
  }

  return [{ category: 'Other', rate: card.rewardRate || 1 }];
}

function mapWelcomeBonus(welcomeBonus?: string | null): CreditCard['welcomeBonus'] {
  if (!welcomeBonus) return undefined;

  const splitMatch = welcomeBonus.match(/\s(after|when|if|with)\s/i);
  if (!splitMatch || splitMatch.index == null) {
    return {
      amount: welcomeBonus,
      requirement: 'See issuer terms',
    };
  }

  const amount = welcomeBonus.slice(0, splitMatch.index).trim().replace(/[\s,.;:]+$/, '');
  const requirement = welcomeBonus.slice(splitMatch.index).trim();

  return {
    amount: amount || welcomeBonus,
    requirement: requirement || 'See issuer terms',
  };
}

function mapApr(apr?: string): CreditCard['apr'] {
  if (!apr) return DEFAULT_APR;

  const values = [...apr.matchAll(/(\d+(?:\.\d+)?)/g)].map((match) => Number(match[1]));
  if (!values.length) return DEFAULT_APR;

  const purchase = values[0] || DEFAULT_APR.purchase;
  const upperBound = values[1] || purchase;

  return {
    purchase,
    balance: upperBound,
    cash: Math.max(upperBound, 29.99),
  };
}

function mapCreditScore(creditScore?: string): CreditCard['creditScore'] {
  if (!creditScore) return DEFAULT_CREDIT_SCORE;
  const normalized = creditScore.toLowerCase();

  if (normalized.includes('building') || normalized.includes('rebuilding')) {
    return { min: 300, recommended: 580 };
  }
  if (normalized.includes('excellent')) {
    if (normalized.includes('good')) {
      return { min: 670, recommended: 720 };
    }
    return { min: 740, recommended: 760 };
  }
  if (normalized.includes('fair')) {
    return { min: 580, recommended: 670 };
  }

  return DEFAULT_CREDIT_SCORE;
}

function mapApiCard(card: ApiCard): CreditCard {
  return {
    id: card.id,
    name: card.name,
    issuer: card.issuer,
    cardType: mapCardType(card.type),
    annualFee: card.annualFee || 0,
    rewards: mapRewards(card),
    creditScore: mapCreditScore(card.creditScore),
    applicationLink: card.applyUrl || '',
    welcomeBonus: mapWelcomeBonus(card.welcomeBonus),
    benefits: card.benefits || [],
    apr: mapApr(card.apr),
  };
}

async function readCachedCards(): Promise<CachedCardsPayload | null> {
  try {
    const raw = await AsyncStorage.getItem(CARDS_CACHE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as CachedCardsPayload;
    if (!Array.isArray(parsed.cards) || typeof parsed.cachedAt !== 'number') {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

async function writeCachedCards(cards: CreditCard[]): Promise<void> {
  const payload: CachedCardsPayload = {
    cachedAt: Date.now(),
    cards,
  };

  try {
    await AsyncStorage.setItem(CARDS_CACHE_KEY, JSON.stringify(payload));
  } catch {
    // no-op
  }
}

export async function fetchCreditCardsFromApi(options?: { forceRefresh?: boolean }): Promise<CreditCard[]> {
  const forceRefresh = options?.forceRefresh === true;
  const cached = await readCachedCards();
  const isFreshCache =
    cached != null &&
    Date.now() - cached.cachedAt <= CARDS_CACHE_TTL_MS &&
    cached.cards.length > 0;

  if (!forceRefresh && isFreshCache) {
    return cached.cards;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetch(`${API_BASE_URL}/cards`, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`Cards API request failed (${response.status})`);
    }

    const payload = (await response.json()) as ApiCardsResponse;
    if (!Array.isArray(payload.cards)) {
      throw new Error('Cards API returned an unexpected response shape');
    }

    const mappedCards = payload.cards.map(mapApiCard).filter((card) => Boolean(card.id && card.name));
    if (mappedCards.length) {
      await writeCachedCards(mappedCards);
    }
    return mappedCards;
  } catch (error) {
    if (cached?.cards?.length) {
      return cached.cards;
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}
