import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { ACCOUNT_KINDS, ACCOUNT_KIND_INFO, type AccountKind } from '@/data/workspace/model';
import { useWorkspace } from '@/data/workspace/WorkspaceProvider';
import {
  RedesignButton,
  RedesignField,
  RedesignIcon,
  RedesignInlineError,
  RedesignListRow,
  RedesignSheet,
  RedesignText,
} from '@/design/redesign';
import { redesignLight as theme, redesignTokens as tokens } from '@/design/redesign/theme';
import { NG_INSTITUTIONS } from '@/features/setup/institutions';
import { today } from '@/features/transactions/helpers';
import { t } from '@/i18n';
import { parseAmount } from '@/money';

import { redesignGroupFor, redesignGroupLabel, REDESIGN_ACCOUNT_GROUPS } from './redesignGroups';

const sp = tokens.space;

const CURRENCIES: { value: string; label: string }[] = [
  { value: 'NGN', label: t('redesign.accounts.currencyNgn') },
  { value: 'USD', label: t('redesign.accounts.currencyUsd') },
  { value: 'GBP', label: t('redesign.accounts.currencyGbp') },
  { value: 'EUR', label: t('redesign.accounts.currencyEur') },
];

const POPULAR_BANK_IDS = ['access', 'gtbank', 'kuda', 'opay', 'moniepoint', 'zenith', 'first-bank'] as const;

/** Figma Phone / Accounts / Add account `3:1787` — single-step sheet. */
export function RedesignAddAccountSheet({ onClose }: { onClose: () => void }) {
  const { repo } = useWorkspace();
  const [name, setName] = useState('');
  const [type, setType] = useState<AccountKind | null>(null);
  const [currency, setCurrency] = useState('NGN');
  const [balanceText, setBalanceText] = useState('');
  const [countInBudget, setCountInBudget] = useState(true);
  const [nameTouched, setNameTouched] = useState(false);
  const [typeOpen, setTypeOpen] = useState(false);
  const [currencyOpen, setCurrencyOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const balanceParsed = balanceText.trim() === '' ? { ok: true as const, minor: 0n } : parseAmount(balanceText);
  const nameOk = name.trim() !== '';
  const typeOk = type !== null;
  const balanceOk = balanceParsed.ok;
  const canSave = nameOk && typeOk && balanceOk && !busy;

  const typeLabel = type ? t(`accounts.kind.${type}`) : '';
  const currencyLabel = CURRENCIES.find((c) => c.value === currency)?.label ?? currency;

  const save = async () => {
    setNameTouched(true);
    if (!canSave || !type || !balanceParsed.ok) return;
    setBusy(true);
    setError(null);
    const result = await repo.addAccount({
      name: name.trim(),
      type,
      currency,
      countInBudget,
      openingBalance: balanceParsed.minor < 0n ? -balanceParsed.minor : balanceParsed.minor,
      openingDate: today(),
    });
    setBusy(false);
    if (!result.ok) {
      setError(t('accounts.connect.failed'));
      return;
    }
    onClose();
  };

  const dirty = name !== '' || type !== null || balanceText !== '' || currency !== 'NGN';

  return (
    <>
      <RedesignSheet
        visible
        title={t('redesign.accounts.addTitle')}
        onClose={onClose}
        dirty={dirty}
        testID="redesign-add-account-sheet"
        footer={
          <RedesignButton
            testID="redesign-add-account-save"
            label={t('redesign.accounts.add')}
            onPress={() => void save()}
            disabled={!canSave}
            fullWidth
          />
        }
      >
        <RedesignField
          testID="redesign-account-name"
          label={t('redesign.accounts.name')}
          value={name}
          onChangeText={setName}
          onSubmitEditing={() => setNameTouched(true)}
          error={nameTouched && !nameOk ? t('redesign.accounts.nameRequired') : null}
          autoCapitalize="words"
        />
        <Pressable
          testID="redesign-account-type"
          accessibilityRole="button"
          accessibilityLabel={t('redesign.accounts.type')}
          onPress={() => setTypeOpen(true)}
          style={{
            gap: sp.xs,
          }}
        >
          <RedesignText variant="label">{t('redesign.accounts.type')}</RedesignText>
          <View
            style={{
              minHeight: tokens.size.field,
              borderWidth: 1,
              borderColor: nameTouched && !typeOk ? theme.danger : theme.border,
              borderRadius: tokens.shape['radius-md'],
              paddingHorizontal: tokens.density.touch.fieldPadX,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <RedesignText tone={type ? 'text' : 'textSecondary'}>{typeLabel || t('redesign.accounts.chooseOption')}</RedesignText>
            <RedesignIcon name="chevron-down" size={20} color={theme.textSecondary} />
          </View>
          {nameTouched && !typeOk ? <RedesignInlineError message={t('redesign.accounts.chooseOption')} /> : null}
        </Pressable>
        <Pressable
          testID="redesign-account-currency"
          accessibilityRole="button"
          accessibilityLabel={t('redesign.accounts.currency')}
          onPress={() => setCurrencyOpen(true)}
          style={{ gap: sp.xs }}
        >
          <RedesignText variant="label">{t('redesign.accounts.currency')}</RedesignText>
          <View
            style={{
              minHeight: tokens.size.field,
              borderWidth: 1,
              borderColor: theme.border,
              borderRadius: tokens.shape['radius-md'],
              paddingHorizontal: tokens.density.touch.fieldPadX,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <RedesignText>{currencyLabel}</RedesignText>
            <RedesignIcon name="chevron-down" size={20} color={theme.textSecondary} />
          </View>
        </Pressable>
        <RedesignField
          testID="redesign-account-balance"
          label={t('redesign.accounts.balanceToday')}
          value={balanceText}
          onChangeText={setBalanceText}
          keyboardType="decimal-pad"
          placeholder="0.00"
          error={!balanceOk ? t('redesign.accounts.balanceInvalid') : null}
        />
        <Pressable
          testID="redesign-count-in-budget"
          accessibilityRole="switch"
          accessibilityState={{ checked: countInBudget }}
          onPress={() => setCountInBudget((v) => !v)}
          style={{
            minHeight: tokens.density.touch.minTarget,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: sp.md,
          }}
        >
          <RedesignText>{t('redesign.accounts.countInBudget')}</RedesignText>
          <View
            style={{
              width: 52,
              height: 32,
              borderRadius: tokens.shape['radius-pill'],
              backgroundColor: countInBudget ? theme.primary : theme.border,
              padding: 2,
              justifyContent: 'center',
              alignItems: countInBudget ? 'flex-end' : 'flex-start',
            }}
          >
            <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: theme.surface }} />
          </View>
        </Pressable>
        {error ? <RedesignInlineError message={error} /> : null}
      </RedesignSheet>

      {typeOpen ? (
        <RedesignSheet visible title={t('redesign.accounts.type')} onClose={() => setTypeOpen(false)} testID="redesign-type-picker">
          {REDESIGN_ACCOUNT_GROUPS.map((group) => {
            const kinds = ACCOUNT_KINDS.filter((k) => redesignGroupFor(k) === group);
            if (kinds.length === 0) return null;
            return (
              <View key={group} style={{ gap: sp.sm }}>
                <RedesignText variant="label" tone="textSecondary">
                  {redesignGroupLabel(group)}
                </RedesignText>
                {kinds.map((k) => (
                  <Pressable
                    key={k}
                    testID={`redesign-type-${k}`}
                    accessibilityRole="button"
                    onPress={() => {
                      setType(k);
                      setCountInBudget(ACCOUNT_KIND_INFO[k].countInBudget);
                      setTypeOpen(false);
                    }}
                    style={{
                      minHeight: tokens.density.touch.minTarget,
                      paddingVertical: sp.sm,
                      borderBottomWidth: 1,
                      borderColor: theme.border,
                    }}
                  >
                    <RedesignText tone={type === k ? 'primary' : 'text'}>{t(`accounts.kind.${k}`)}</RedesignText>
                  </Pressable>
                ))}
              </View>
            );
          })}
        </RedesignSheet>
      ) : null}

      {currencyOpen ? (
        <RedesignSheet visible title={t('redesign.accounts.currency')} onClose={() => setCurrencyOpen(false)} testID="redesign-currency-picker">
          {CURRENCIES.map((c) => (
            <Pressable
              key={c.value}
              testID={`redesign-currency-${c.value}`}
              accessibilityRole="button"
              onPress={() => {
                setCurrency(c.value);
                setCurrencyOpen(false);
              }}
              style={{
                minHeight: tokens.density.touch.minTarget,
                paddingVertical: sp.sm,
                borderBottomWidth: 1,
                borderColor: theme.border,
              }}
            >
              <RedesignText tone={currency === c.value ? 'primary' : 'text'}>{c.label}</RedesignText>
            </Pressable>
          ))}
        </RedesignSheet>
      ) : null}
    </>
  );
}

/** Figma Phone / Accounts / Connect a bank `3:1974` — search + popular. Full Mono steps → Page 10. */
export function RedesignConnectBankSearchSheet({
  onClose,
  onContinue,
}: {
  onClose: () => void;
  onContinue: (bankLabel: string) => void;
}) {
  const [query, setQuery] = useState('');
  const popular = useMemo(
    () => POPULAR_BANK_IDS.map((id) => NG_INSTITUTIONS.find((i) => i.id === id)).filter(Boolean) as typeof NG_INSTITUTIONS,
    [],
  );
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return NG_INSTITUTIONS.filter(
      (i) => i.label.toLowerCase().includes(q) || i.keywords.some((k) => k.includes(q)),
    );
  }, [query]);

  return (
    <RedesignSheet visible title={t('redesign.accounts.connectTitle')} onClose={onClose} testID="redesign-connect-bank-sheet">
      <RedesignField
        testID="redesign-bank-search"
        label={t('redesign.accounts.searchBanks')}
        value={query}
        onChangeText={setQuery}
        placeholder={t('redesign.accounts.searchBanksPlaceholder')}
        autoCapitalize="words"
      />
      <RedesignText variant="helper" tone="textSecondary">
        {t('redesign.accounts.connectPrivacy')}
      </RedesignText>
      {query.trim() ? (
        <View style={{ gap: sp.xs }}>
          {results.length === 0 ? (
            <RedesignText tone="textSecondary">{t('redesign.accounts.noBanks')}</RedesignText>
          ) : (
            results.map((bank) => (
              <RedesignListRow
                key={bank.id}
                testID={`redesign-bank-${bank.id}`}
                title={bank.label}
                onPress={() => onContinue(bank.label)}
              />
            ))
          )}
        </View>
      ) : (
        <View style={{ gap: sp.sm }}>
          <RedesignText variant="label" tone="textSecondary">
            {t('redesign.accounts.popular')}
          </RedesignText>
          {popular.map((bank) => (
            <RedesignListRow
              key={bank.id}
              testID={`redesign-bank-${bank.id}`}
              title={bank.label}
              onPress={() => onContinue(bank.label)}
            />
          ))}
        </View>
      )}
    </RedesignSheet>
  );
}
