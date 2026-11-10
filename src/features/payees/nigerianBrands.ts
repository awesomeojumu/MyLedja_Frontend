import type { Category } from '@/data/workspace/model';
import { normalizeMerchantName } from './fuzzyDuplicates';

export type NigerianBrand = {
  id: string;
  name: string;
  categoryKeywords: string[];
  aliases: string[];
  logoMonogram?: string;
};

/**
 * Curated Nigerian brand directory covering major retail, food, energy, telco, transport, utilities, and fintech.
 */
export const NIGERIAN_BRANDS: NigerianBrand[] = [
  // Supermarkets & Retail
  {
    id: 'shoprite',
    name: 'Shoprite',
    categoryKeywords: ['groceries', 'food', 'market', 'supermarket', 'household'],
    aliases: ['shoprite', 'shoprite lekki', 'shoprite ikeja', 'shoprite mall'],
  },
  {
    id: 'spar',
    name: 'SPAR',
    categoryKeywords: ['groceries', 'food', 'market', 'supermarket'],
    aliases: ['spar', 'spar nigeria', 'spar supermarket'],
  },
  {
    id: 'ebeano',
    name: 'Prince Ebeano Supermarket',
    categoryKeywords: ['groceries', 'food', 'market', 'supermarket'],
    aliases: ['ebeano', 'prince ebeano', 'ebeano supermarket'],
  },
  {
    id: 'hubmart',
    name: 'Hubmart',
    categoryKeywords: ['groceries', 'food', 'supermarket'],
    aliases: ['hubmart', 'hubmart stores'],
  },
  {
    id: 'justrite',
    name: 'Justrite Superstore',
    categoryKeywords: ['groceries', 'food', 'supermarket'],
    aliases: ['justrite', 'justrite store'],
  },

  // Dining & Fast Food
  {
    id: 'chicken_republic',
    name: 'Chicken Republic',
    categoryKeywords: ['dining', 'food', 'eating out', 'restaurant', 'fast food'],
    aliases: ['chicken republic', 'chicken rep', 'chickenrepublic'],
  },
  {
    id: 'the_place',
    name: 'The Place Restaurant',
    categoryKeywords: ['dining', 'food', 'eating out', 'restaurant'],
    aliases: ['the place', 'the place restaurant', 'the place ikeja', 'the place lekki'],
  },
  {
    id: 'kilimanjaro',
    name: 'Kilimanjaro',
    categoryKeywords: ['dining', 'food', 'eating out', 'restaurant', 'fast food'],
    aliases: ['kilimanjaro', 'kilimanjaro restaurant'],
  },
  {
    id: 'dominos',
    name: "Domino's Pizza",
    categoryKeywords: ['dining', 'food', 'eating out', 'fast food'],
    aliases: ['dominos', "domino's", 'dominos pizza', 'cold stone'],
  },
  {
    id: 'sweet_sensation',
    name: 'Sweet Sensation',
    categoryKeywords: ['dining', 'food', 'fast food'],
    aliases: ['sweet sensation'],
  },

  // Fuel & Energy
  {
    id: 'totalenergies',
    name: 'TotalEnergies',
    categoryKeywords: ['transport', 'fuel', 'gas', 'car', 'petrol'],
    aliases: ['total', 'totalenergies', 'total filling station'],
  },
  {
    id: 'mobil',
    name: 'Mobil / 11Plc',
    categoryKeywords: ['transport', 'fuel', 'gas', 'car', 'petrol'],
    aliases: ['mobil', '11plc', 'mobil filling station'],
  },
  {
    id: 'nnpc',
    name: 'NNPC Retail',
    categoryKeywords: ['transport', 'fuel', 'gas', 'car', 'petrol'],
    aliases: ['nnpc', 'nnpc retail', 'nnpc mega station'],
  },

  // Telco & Internet
  {
    id: 'mtn',
    name: 'MTN Nigeria',
    categoryKeywords: ['utilities', 'bills', 'internet', 'airtime', 'telephone'],
    aliases: ['mtn', 'mtn ng', 'mtn vtu', 'mtn airtime'],
  },
  {
    id: 'airtel',
    name: 'Airtel Nigeria',
    categoryKeywords: ['utilities', 'bills', 'internet', 'airtime', 'telephone'],
    aliases: ['airtel', 'airtel ng', 'airtel vtu'],
  },
  {
    id: 'glo',
    name: 'Glo (Globacom)',
    categoryKeywords: ['utilities', 'bills', 'internet', 'airtime', 'telephone'],
    aliases: ['glo', 'globacom', 'glo vtu'],
  },
  {
    id: '9mobile',
    name: '9mobile',
    categoryKeywords: ['utilities', 'bills', 'internet', 'airtime', 'telephone'],
    aliases: ['9mobile', 'etisalat'],
  },
  {
    id: 'starlink',
    name: 'Starlink Internet',
    categoryKeywords: ['utilities', 'bills', 'internet', 'subscription'],
    aliases: ['starlink', 'spacex starlink'],
  },

  // Ride-Hailing & Transport
  {
    id: 'uber',
    name: 'Uber',
    categoryKeywords: ['transport', 'taxi', 'travel'],
    aliases: ['uber', 'uber *trip', 'uber bv', 'uber trip'],
  },
  {
    id: 'bolt',
    name: 'Bolt',
    categoryKeywords: ['transport', 'taxi', 'travel'],
    aliases: ['bolt', 'bolt *trip', 'taxify', 'bolt trip'],
  },

  // Digital Subscriptions & Entertainment
  {
    id: 'netflix',
    name: 'Netflix',
    categoryKeywords: ['entertainment', 'subscription', 'streaming', 'leisure'],
    aliases: ['netflix', 'netflix.com'],
  },
  {
    id: 'spotify',
    name: 'Spotify',
    categoryKeywords: ['entertainment', 'subscription', 'streaming', 'music'],
    aliases: ['spotify', 'spotify premium'],
  },
  {
    id: 'apple',
    name: 'Apple Services',
    categoryKeywords: ['entertainment', 'subscription', 'digital', 'tech'],
    aliases: ['apple.com/bill', 'apple', 'itunes'],
  },
  {
    id: 'dstv',
    name: 'DSTV / GOtv (MultiChoice)',
    categoryKeywords: ['utilities', 'bills', 'entertainment', 'cable tv'],
    aliases: ['dstv', 'gotv', 'multichoice'],
  },

  // Electricity Distribution (DisCos)
  {
    id: 'ikedc',
    name: 'Ikeja Electric (IKEDC)',
    categoryKeywords: ['utilities', 'bills', 'electricity', 'power'],
    aliases: ['ikeja electric', 'ikedc', 'ikeja electric payment'],
  },
  {
    id: 'ekedc',
    name: 'Eko Electricity (EKEDC)',
    categoryKeywords: ['utilities', 'bills', 'electricity', 'power'],
    aliases: ['eko electric', 'ekedc', 'eko electricity distribution'],
  },
  {
    id: 'aedc',
    name: 'Abuja Electricity (AEDC)',
    categoryKeywords: ['utilities', 'bills', 'electricity', 'power'],
    aliases: ['abuja electricity', 'aedc'],
  },
];

export type BrandMatch = {
  brand: NigerianBrand;
  confidence: number;
};

/**
 * Identifies if a merchant name matches a known Nigerian brand.
 */
export function identifyNigerianBrand(merchantName: string): BrandMatch | null {
  const norm = normalizeMerchantName(merchantName);
  if (!norm) return null;

  for (const brand of NIGERIAN_BRANDS) {
    for (const alias of brand.aliases) {
      const normAlias = normalizeMerchantName(alias);
      if (norm === normAlias) {
        return { brand, confidence: 1.0 };
      }
      if (norm.includes(normAlias) || (normAlias.length > 4 && normAlias.includes(norm))) {
        return { brand, confidence: 0.85 };
      }
    }
  }

  return null;
}

/**
 * Suggests the best matching category from the user's workspace categories based on a brand.
 */
export function suggestCategoryForBrand(brand: NigerianBrand, categories: Category[]): Category | null {
  const expenseCategories = categories.filter((c) => c.kind === 'expense');

  for (const keyword of brand.categoryKeywords) {
    const directMatch = expenseCategories.find(
      (c) =>
        c.name.toLowerCase().includes(keyword) ||
        (c.key && c.key.toLowerCase().includes(keyword)) ||
        (c.group && c.group.toLowerCase().includes(keyword)),
    );
    if (directMatch) return directMatch;
  }

  return null;
}
