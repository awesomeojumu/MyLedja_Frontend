import { t } from '../../i18n';
import { ACCOUNT_PURPOSES, type Account, type AccountKind, type AccountPurpose } from '../../data/workspace/model';

export { ACCOUNT_PURPOSES, type AccountPurpose };

export type PurposeInfo = {
  purpose: AccountPurpose;
  readonly label: string;
  readonly subtitle: string;
  /** The real ledger kind an account with this purpose is saved as. */
  kind: AccountKind;
};

export const PURPOSE_INFO: Record<AccountPurpose, PurposeInfo> = {
  income: {
    purpose: 'income',
    get label() {
      return t('account.purpose.income');
    },
    get subtitle() {
      return t('account.purpose.incomeBody');
    },
    kind: 'bank',
  },
  operating: {
    purpose: 'operating',
    get label() {
      return t('account.purpose.operating');
    },
    get subtitle() {
      return t('account.purpose.operatingBody');
    },
    kind: 'bank',
  },
  bills: {
    purpose: 'bills',
    get label() {
      return t('account.purpose.bills');
    },
    get subtitle() {
      return t('account.purpose.billsBody');
    },
    kind: 'bank',
  },
  emergency: {
    purpose: 'emergency',
    get label() {
      return t('account.purpose.emergency');
    },
    get subtitle() {
      return t('account.purpose.emergencyBody');
    },
    kind: 'savings',
  },
  savings: {
    purpose: 'savings',
    get label() {
      return t('account.purpose.savings');
    },
    get subtitle() {
      return t('account.purpose.savingsBody');
    },
    kind: 'savings',
  },
  investment: {
    purpose: 'investment',
    get label() {
      return t('account.purpose.investment');
    },
    get subtitle() {
      return t('account.purpose.investmentBody');
    },
    kind: 'investment',
  },
  project: {
    purpose: 'project',
    get label() {
      return t('account.purpose.project');
    },
    get subtitle() {
      return t('account.purpose.projectBody');
    },
    kind: 'savings',
  },
};

/** Kinds that can hold investments (backend HOLDING_ACCOUNT_TYPES). */
export const HOLDING_ACCOUNT_KINDS: readonly AccountKind[] = ['investment', 'pension', 'fixed_deposit', 'other_asset'];

const SAVINGS_PURPOSES: readonly AccountPurpose[] = ['emergency', 'savings', 'project'];

/** The purpose shown for an account: the one chosen, or one that follows from its kind. */
export function purposeOf(account: Pick<Account, 'type' | 'purpose'>): AccountPurpose | 'credit' | 'loan' | 'property' {
  if (account.purpose) return account.purpose;
  switch (account.type) {
    case 'savings':
    case 'fixed_deposit':
      return 'savings';
    case 'investment':
    case 'pension':
      return 'investment';
    case 'property':
      return 'property';
    case 'card':
    case 'other_liability':
      return 'credit';
    case 'loan':
      return 'loan';
    default:
      return 'operating';
  }
}

/** Accounts a goal can be kept in: savings accounts, emergency funds and project accounts. */
export function isSavingsAccount(account: Pick<Account, 'type' | 'purpose' | 'archived'>): boolean {
  if (account.archived) return false;
  if (account.purpose) return SAVINGS_PURPOSES.includes(account.purpose);
  return account.type === 'savings' || account.type === 'fixed_deposit';
}

/** Accounts holdings can live in. */
export function isInvestmentAccount(account: Pick<Account, 'type' | 'archived'>): boolean {
  return !account.archived && HOLDING_ACCOUNT_KINDS.includes(account.type);
}

/** Everyday money: what you pay from and get paid into. */
export function isSpendingAccount(account: Pick<Account, 'type' | 'archived'>): boolean {
  if (account.archived) return false;
  return ['bank', 'cash', 'wallet', 'card', 'savings'].includes(account.type);
}
