import type { TextKey } from '@/i18n';

/** The Nigerian starter set shown in Welcome step 4 (DESIGN.md page 4). */
export const STARTER_GROUPS: { group: TextKey; categories: TextKey[] }[] = [
  { group: 'group.home', categories: ['cat.rent', 'cat.electricity', 'cat.water'] },
  { group: 'group.gettingAround', categories: ['cat.fuel', 'cat.rideHailing', 'cat.okada'] },
  { group: 'group.food', categories: ['cat.market', 'cat.eatingOut'] },
  { group: 'group.family', categories: ['cat.schoolFees', 'cat.familySupport'] },
  { group: 'group.faith', categories: ['cat.tithe', 'cat.offering'] },
];

export const ACCOUNT_TYPES = ['bank', 'cash', 'wallet', 'card', 'savings', 'investment', 'loan'] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

export const WEEK_STARTS = ['monday', 'sunday', 'saturday'] as const;
