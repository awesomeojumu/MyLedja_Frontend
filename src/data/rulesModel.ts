export interface AllocationPillar {
  id: string;
  name: string;
  percentage: number; // 0 to 100
  color: string;
  icon: string;
  purposeAccountType: 'operating' | 'bills' | 'emergency' | 'savings' | 'investment' | 'project';
  description: string;
  mappedExpenseCategories: string[];
}

export interface AllocationFramework {
  id: string;
  name: string;
  tagline: string;
  description: string;
  pillars: AllocationPillar[];
}

export interface TaxRuleConfig {
  enabled: boolean;
  ratePercentage: number; // e.g. 10%
  targetAccountType: 'bills' | 'operating';
  exemptIncomeCategories: string[]; // e.g. ['Employment', 'Gifts', 'Government']
}

export interface TitheRuleConfig {
  enabled: boolean;
  ratePercentage: number; // e.g. 10%
  base: 'gross' | 'net_after_tax';
  targetEnvelope: string; // e.g. 'Spiritual & Religious'
}

export interface EarmarkedRule {
  id: string;
  name: string;
  triggerType: 'income_category' | 'keyword';
  triggerValue: string; // e.g. 'Gifts' or 'Rent'
  targetCategory: string; // e.g. 'Housing'
  targetAccountType: 'bills' | 'operating' | 'emergency' | 'savings' | 'investment' | 'project';
  passThroughPercentage: number; // default 100%
  active: boolean;
}

export interface SubcategoryAllocationItem {
  name: string;
  percentageOfCategory: number; // e.g. 70% of Housing
}

export interface SubAllocationItem {
  id: string;
  categoryId?: string;
  categoryName: string;
  percentageOfPillar: number; // percentage of the parent pillar (e.g. 40% of Needs)
  subAllocations?: SubcategoryAllocationItem[];
}

export interface SubAllocationConfig {
  enabled: boolean;
  parentPillarId: string; // e.g. 'needs' or 'living_needs'
  items: SubAllocationItem[];
  // Direct dictionary mapping of categoryName or categoryId -> percentage of pillar (0-100)
  categoryPercentages?: Record<string, number>;
  // Subcategory specific breakdown per category: categoryName -> subcategoryName -> percentage of category
  subcategoryPercentages?: Record<string, Record<string, number>>;
}

// ---------------------------------------------------------------------------
// Standard Allocation Presets
// ---------------------------------------------------------------------------

export const PRESET_USER_50_10_10_20_10: AllocationFramework = {
  id: 'user_50_10_10_20_10',
  name: 'Balanced Stewardship (50/10/10/20/10)',
  tagline: '50% Living · 10% Tithe · 10% Emergency · 20% Wealth · 10% Charity',
  description:
    'Distributes 50% to Living Needs & Wants, 10% Tithe, 10% Emergency cushion, 20% Wealth creation & investments, and 10% Charity/Family giving.',
  pillars: [
    {
      id: 'living_needs',
      name: 'Needs & Living Expenses',
      percentage: 50,
      color: '#2563EB', // Blue
      icon: 'Home',
      purposeAccountType: 'operating',
      description: 'Rent, food, groceries, fuel, electricity, daily bills & personal care',
      mappedExpenseCategories: [
        'Housing',
        'Food',
        'Transportation',
        'Utilities',
        'Healthcare',
        'Personal Care',
        'Communication & Technology',
        'Education',
      ],
    },
    {
      id: 'tithe_giving',
      name: 'Tithe & Spiritual',
      percentage: 10,
      color: '#8B5CF6', // Purple
      icon: 'Church',
      purposeAccountType: 'bills',
      description: 'Tithes, church projects, ministry & religious offerings',
      mappedExpenseCategories: ['Spiritual & Religious'],
    },
    {
      id: 'emergency_savings',
      name: 'Emergency & Reserves',
      percentage: 10,
      color: '#F59E0B', // Amber
      icon: 'Shield',
      purposeAccountType: 'emergency',
      description: 'Unexpected expenses, medical backup & financial peace of mind',
      mappedExpenseCategories: ['Financial Obligations'],
    },
    {
      id: 'wealth_investment',
      name: 'Wealth & Investments',
      percentage: 20,
      color: '#10B981', // Emerald
      icon: 'TrendingUp',
      purposeAccountType: 'investment',
      description: 'Stocks, mutual funds, real estate, capital assets & retirement',
      mappedExpenseCategories: ['Savings & Investments', 'Business & Professional'],
    },
    {
      id: 'charity_family',
      name: 'Charity & Family Support',
      percentage: 10,
      color: '#EC4899', // Pink
      icon: 'Heart',
      purposeAccountType: 'operating',
      description: 'Family support, gifts, benevolence, welfare & community giving',
      mappedExpenseCategories: [
        'Family',
        'Entertainment & Recreation',
        'Clothing',
        'Travel',
        'Marriage & Relationships',
        'Pets',
        'Children',
        'Miscellaneous',
      ],
    },
  ],
};

export const PRESET_CLASSIC_50_30_20: AllocationFramework = {
  id: 'classic_50_30_20',
  name: '50 / 30 / 20 Rule',
  tagline: '50% Needs · 30% Wants · 20% Savings & Investments',
  description:
    'The standard personal finance benchmark balancing essential living, lifestyle freedom, and wealth growth.',
  pillars: [
    {
      id: 'needs',
      name: 'Essential Needs',
      percentage: 50,
      color: '#2563EB',
      icon: 'Home',
      purposeAccountType: 'operating',
      description: 'Housing, utilities, groceries, transport, healthcare & minimum debt payments',
      mappedExpenseCategories: [
        'Housing',
        'Food',
        'Transportation',
        'Utilities',
        'Healthcare',
        'Personal Care',
        'Communication & Technology',
        'Financial Obligations',
      ],
    },
    {
      id: 'wants',
      name: 'Lifestyle & Wants',
      percentage: 30,
      color: '#EC4899',
      icon: 'Sparkles',
      purposeAccountType: 'operating',
      description: 'Dining out, entertainment, shopping, vacations & discretionary spending',
      mappedExpenseCategories: [
        'Entertainment & Recreation',
        'Clothing',
        'Travel',
        'Marriage & Relationships',
        'Family',
        'Education',
        'Pets',
        'Children',
        'Miscellaneous',
      ],
    },
    {
      id: 'savings',
      name: 'Savings & Investments',
      percentage: 20,
      color: '#10B981',
      icon: 'PiggyBank',
      purposeAccountType: 'savings',
      description: 'Emergency fund contributions, stocks, mutual funds & wealth creation',
      mappedExpenseCategories: ['Savings & Investments', 'Spiritual & Religious', 'Business & Professional'],
    },
  ],
};

export const PRESET_WEALTH_BUILDER_70_20_10: AllocationFramework = {
  id: 'wealth_builder_70_20_10',
  name: 'Wealth Builder (70 / 20 / 10)',
  tagline: '70% Living Expenses · 20% Investments · 10% Emergency Savings',
  description: 'Designed for aggressive wealth accumulation while keeping living expenses under 70%.',
  pillars: [
    {
      id: 'living',
      name: 'All Living Expenses',
      percentage: 70,
      color: '#2563EB',
      icon: 'Home',
      purposeAccountType: 'operating',
      description: 'Needs, housing, bills, groceries and lifestyle spending',
      mappedExpenseCategories: ['Housing', 'Food', 'Transportation', 'Utilities', 'Personal Care', 'Family'],
    },
    {
      id: 'investments',
      name: 'Growth & Investments',
      percentage: 20,
      color: '#10B981',
      icon: 'TrendingUp',
      purposeAccountType: 'investment',
      description: 'Stocks, real estate, business ventures and compounding assets',
      mappedExpenseCategories: ['Savings & Investments'],
    },
    {
      id: 'reserves',
      name: 'Emergency Vault',
      percentage: 10,
      color: '#F59E0B',
      icon: 'Shield',
      purposeAccountType: 'emergency',
      description: 'Liquid cash buffer for unforeseen shocks',
      mappedExpenseCategories: ['Financial Obligations'],
    },
  ],
};

export const PRESET_SIMPLE_80_20: AllocationFramework = {
  id: 'simple_80_20',
  name: 'Simple 80 / 20 Rule',
  tagline: '80% Living & Spending · 20% Wealth & Savings',
  description: 'Maximum simplicity: Pay yourself first with 20% savings, live comfortably on the remaining 80%.',
  pillars: [
    {
      id: 'spending',
      name: 'Living & Spending',
      percentage: 80,
      color: '#2563EB',
      icon: 'Home',
      purposeAccountType: 'operating',
      description: 'All monthly expenses, bills, discretionary spending and giving',
      mappedExpenseCategories: ['Housing', 'Food', 'Transportation', 'Utilities', 'Entertainment & Recreation'],
    },
    {
      id: 'pay_yourself',
      name: 'Pay Yourself First',
      percentage: 20,
      color: '#10B981',
      icon: 'PiggyBank',
      purposeAccountType: 'savings',
      description: 'Direct transfer to savings and wealth accumulation',
      mappedExpenseCategories: ['Savings & Investments'],
    },
  ],
};

export const PRESET_FAITH_PURPOSE: AllocationFramework = {
  id: 'faith_purpose_tithe_first',
  name: 'Faith and Purpose (Tithe First)',
  tagline: '10% Tithe · 10% Giving and Family · 50% Living · 30% Growth',
  description: 'The tithe comes off the top, then giving and family, everyday living, and growth for your goals.',
  pillars: [
    {
      id: 'tithe',
      name: 'Tithe',
      percentage: 10,
      color: '#7C3AED',
      icon: 'Heart',
      purposeAccountType: 'operating',
      description: 'Tithe and offerings, given first',
      mappedExpenseCategories: ['Spiritual & Religious'],
    },
    {
      id: 'giving_family',
      name: 'Giving and Family',
      percentage: 10,
      color: '#EC4899',
      icon: 'Users',
      purposeAccountType: 'operating',
      description: 'Support to family, gifts and charity',
      mappedExpenseCategories: ['Family', 'Marriage & Relationships'],
    },
    {
      id: 'living',
      name: 'Living',
      percentage: 50,
      color: '#2563EB',
      icon: 'Home',
      purposeAccountType: 'operating',
      description: 'Housing, food, transport, bills and everyday spending',
      mappedExpenseCategories: [
        'Housing',
        'Food',
        'Transportation',
        'Utilities',
        'Healthcare',
        'Personal Care',
        'Communication & Technology',
        'Education',
        'Clothing',
        'Household & Lifestyle',
        'Entertainment & Recreation',
        'Travel',
        'Business & Professional',
        'Government & Legal',
        'Financial Obligations',
        'Miscellaneous',
      ],
    },
    {
      id: 'growth',
      name: 'Growth',
      percentage: 30,
      color: '#10B981',
      icon: 'TrendingUp',
      purposeAccountType: 'investment',
      description: 'Emergency fund, savings goals and investments',
      mappedExpenseCategories: ['Savings & Investments'],
    },
  ],
};

/** A starting point the person reshapes: names stay, percentages are theirs. */
export const PRESET_CUSTOM_SPLIT: AllocationFramework = {
  id: 'custom_split',
  name: 'Custom Split',
  tagline: 'Set your own percentages',
  description: 'Start from 40 / 20 / 20 / 10 / 10 and change each part until it fits you.',
  pillars: [
    {
      id: 'custom_living',
      name: 'Living',
      percentage: 40,
      color: '#2563EB',
      icon: 'Home',
      purposeAccountType: 'operating',
      description: 'Housing, food, transport and bills',
      mappedExpenseCategories: [
        'Housing',
        'Food',
        'Transportation',
        'Utilities',
        'Healthcare',
        'Personal Care',
        'Communication & Technology',
        'Education',
        'Household & Lifestyle',
        'Business & Professional',
        'Government & Legal',
        'Financial Obligations',
      ],
    },
    {
      id: 'custom_investing',
      name: 'Investing',
      percentage: 20,
      color: '#10B981',
      icon: 'TrendingUp',
      purposeAccountType: 'investment',
      description: 'Stocks, funds, land and other investments',
      mappedExpenseCategories: [],
    },
    {
      id: 'custom_savings',
      name: 'Savings',
      percentage: 20,
      color: '#F59E0B',
      icon: 'PiggyBank',
      purposeAccountType: 'savings',
      description: 'Emergency fund and savings goals',
      mappedExpenseCategories: ['Savings & Investments'],
    },
    {
      id: 'custom_giving',
      name: 'Giving',
      percentage: 10,
      color: '#7C3AED',
      icon: 'Heart',
      purposeAccountType: 'operating',
      description: 'Tithe, offerings, family support and charity',
      mappedExpenseCategories: ['Spiritual & Religious', 'Family', 'Marriage & Relationships'],
    },
    {
      id: 'custom_free',
      name: 'Free Spending',
      percentage: 10,
      color: '#EC4899',
      icon: 'Sparkles',
      purposeAccountType: 'operating',
      description: 'Eating out, fun, clothes and treats',
      mappedExpenseCategories: ['Entertainment & Recreation', 'Clothing', 'Travel', 'Miscellaneous'],
    },
  ],
};

export const STANDARD_FRAMEWORK_PRESETS: AllocationFramework[] = [
  PRESET_CLASSIC_50_30_20,
  PRESET_FAITH_PURPOSE,
  PRESET_USER_50_10_10_20_10,
  PRESET_WEALTH_BUILDER_70_20_10,
  PRESET_SIMPLE_80_20,
  PRESET_CUSTOM_SPLIT,
];
