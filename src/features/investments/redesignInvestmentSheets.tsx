import { useMemo, useState } from 'react';
import { View } from 'react-native';

import type { Holding, HoldingType } from '@/data/workspace/model';
import { useWorkspace } from '@/data/workspace/WorkspaceProvider';
import { useToast } from '@/design/components';
import {
  RedesignButton,
  RedesignField,
  RedesignIcon,
  RedesignSheet,
  RedesignSwitch,
  RedesignText,
} from '@/design/redesign';
import { redesignTokens as tokens } from '@/design/redesign/theme';
import { t } from '@/i18n';
import { parseAmount } from '@/money';

import { HOLDING_TYPES, defaultCashAccountId, formatGain } from './helpers';

const sp = tokens.space;

export type AddInvestmentDraft = {
  name: string;
  type: HoldingType;
  valueText: string;
  putInText: string;
  countInBudget: boolean;
};

export const emptyAddInvestmentDraft = (): AddInvestmentDraft => ({
  name: '',
  type: 'fund',
  valueText: '',
  putInText: '',
  countInBudget: false,
});

function typeLabel(type: HoldingType): string {
  return t(`investments.redesign.type.${type}` as 'investments.redesign.type.fund');
}

/** Figma Phone / Investments / Add investment (11:4706). */
export function RedesignAddInvestmentSheet({
  onClose,
  onCreated,
  initial,
}: {
  onClose: () => void;
  onCreated?: (h: Holding) => void;
  initial?: AddInvestmentDraft;
}) {
  const { snapshot, repo } = useWorkspace();
  const toast = useToast();
  const [draft, setDraft] = useState<AddInvestmentDraft>(() => initial ?? emptyAddInvestmentDraft());
  const [busy, setBusy] = useState(false);
  const [pickingType, setPickingType] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [valueError, setValueError] = useState<string | null>(null);
  const [putInError, setPutInError] = useState<string | null>(null);

  const dirty = useMemo(
    () =>
      draft.name.trim().length > 0 ||
      draft.valueText.trim().length > 0 ||
      draft.putInText.trim().length > 0 ||
      draft.type !== 'fund' ||
      draft.countInBudget,
    [draft],
  );

  const save = async () => {
    setNameError(null);
    setValueError(null);
    setPutInError(null);
    const name = draft.name.trim();
    if (!name) {
      setNameError(t('investments.redesign.error.name'));
      return;
    }
    const valueParsed = draft.valueText.trim() ? parseAmount(draft.valueText) : { ok: true as const, minor: 0n };
    const putInParsed = draft.putInText.trim() ? parseAmount(draft.putInText) : { ok: true as const, minor: 0n };
    if (!valueParsed.ok) {
      setValueError(t('investments.redesign.error.amount'));
      return;
    }
    if (!putInParsed.ok) {
      setPutInError(t('investments.redesign.error.amount'));
      return;
    }
    if (valueParsed.minor === 0n && putInParsed.minor === 0n) {
      setValueError(t('investments.redesign.error.amount'));
      return;
    }
    let account = snapshot?.accounts.find((a) => a.type === 'investment' && !a.archived);
    setBusy(true);
    try {
      if (!account) {
        const added = await repo.addAccount({
          name: t('investments.redesign.defaultAccount'),
          type: 'investment',
          openingBalance: 0n,
          openingDate: new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lagos' }).format(new Date()),
          countInBudget: draft.countInBudget,
        });
        if (!added.ok) {
          setNameError(t('investments.redesign.error.save'));
          return;
        }
        account = added.value;
      }
      const created = await repo.seedHoldingBook({
        name,
        type: draft.type,
        accountId: account.id,
        costMinor: putInParsed.minor,
        valueMinor: valueParsed.minor,
        countInBudget: draft.countInBudget,
      });
      if (!created.ok) {
        setNameError(t('investments.redesign.error.save'));
        return;
      }
      onClose();
      onCreated?.(created.value);
      toast.show(t('investments.redesign.addedToast'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <RedesignSheet
        visible
        testID="redesign-add-investment-sheet"
        title={t('investments.redesign.addTitle')}
        onClose={onClose}
        dirty={dirty}
        footer={
          <RedesignButton
            testID="redesign-add-investment-save"
            label={t('investments.redesign.addAction')}
            onPress={() => void save()}
            disabled={busy}
            fullWidth
          />
        }
      >
        <RedesignField
          testID="redesign-add-investment-name"
          label={t('investments.name')}
          value={draft.name}
          onChangeText={(name) => setDraft((d) => ({ ...d, name }))}
          error={nameError}
          autoCapitalize="words"
        />
        <RedesignField
          testID="redesign-add-investment-type"
          label={t('investments.type')}
          value={typeLabel(draft.type)}
          editable={false}
          onPress={() => setPickingType(true)}
          trailing={<RedesignIcon name="chevron-down" size={20} color={tokens.color.light.textSecondary} />}
        />
        <RedesignField
          testID="redesign-add-investment-value"
          label={t('investments.redesign.valueToday')}
          value={draft.valueText}
          onChangeText={(valueText) => setDraft((d) => ({ ...d, valueText }))}
          prefix="₦"
          keyboardType="decimal-pad"
          error={valueError}
        />
        <RedesignField
          testID="redesign-add-investment-put-in"
          label={t('investments.redesign.youPutIn')}
          value={draft.putInText}
          onChangeText={(putInText) => setDraft((d) => ({ ...d, putInText }))}
          prefix="₦"
          keyboardType="decimal-pad"
          error={putInError}
        />
        <RedesignSwitch
          testID="redesign-add-investment-budget"
          label={t('investments.redesign.countInBudget')}
          value={draft.countInBudget}
          onChange={(countInBudget) => setDraft((d) => ({ ...d, countInBudget }))}
        />
      </RedesignSheet>

      <RedesignSheet
        visible={pickingType}
        title={t('investments.type')}
        onClose={() => setPickingType(false)}
        testID="redesign-add-investment-type-sheet"
      >
        <View style={{ gap: sp.sm }}>
          {HOLDING_TYPES.map((type) => (
            <RedesignButton
              key={type}
              testID={`redesign-type-${type}`}
              kind={draft.type === type ? 'primary' : 'secondary'}
              label={typeLabel(type)}
              onPress={() => {
                setDraft((d) => ({ ...d, type }));
                setPickingType(false);
              }}
              fullWidth
            />
          ))}
        </View>
        <RedesignText variant="helper" tone="textSecondary">
          {t('investments.redesign.typeHint')}
        </RedesignText>
      </RedesignSheet>
    </>
  );
}

/** Figma Phone / Holding / Update value (5:2131). */
export function RedesignUpdateValueSheet({
  holdingId,
  currentValue,
  lastPriceDate,
  units,
  onClose,
}: {
  holdingId: string;
  currentValue: bigint;
  lastPriceDate: string | null;
  units: number;
  onClose: () => void;
}) {
  const { repo } = useWorkspace();
  const toast = useToast();
  const [valueText, setValueText] = useState('');
  const [asOf, setAsOf] = useState(today());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const parsed = valueText.trim() ? parseAmount(valueText) : null;
  const nextValue = parsed?.ok ? parsed.minor : null;
  const delta = nextValue !== null ? nextValue - currentValue : null;
  const sinceLabel = lastPriceDate
    ? t('investments.redesign.deltaSince', {
        delta: delta !== null ? formatGain(delta, null) : '',
        date: formatMonthDay(lastPriceDate),
      })
    : null;

  const save = async () => {
    setError(null);
    if (!parsed || !parsed.ok || parsed.minor <= 0n) {
      setError(t('investments.redesign.error.amount'));
      return;
    }
    const u = units > 0 ? units : 1;
    // Price is per unit; total value = units × price.
    const price =
      u === 1 ? parsed.minor : (parsed.minor * 1_000_000n) / BigInt(Math.round(u * 1e6));
    if (price <= 0n) {
      setError(t('investments.redesign.error.amount'));
      return;
    }
    setBusy(true);
    try {
      await repo.savePrices([{ holdingId, priceMinor: price }], asOf || today());
      toast.show(t('investments.redesign.valueUpdated'));
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <RedesignSheet
      visible
      testID="redesign-update-value-sheet"
      title={t('investments.redesign.updateValue')}
      onClose={onClose}
      dirty={valueText.trim().length > 0}
      footer={
        <RedesignButton
          testID="redesign-update-value-save"
          label={t('common.save')}
          onPress={() => void save()}
          disabled={busy}
          fullWidth
        />
      }
    >
      <RedesignField
        testID="redesign-update-value-amount"
        label={t('investments.redesign.valueToday')}
        value={valueText}
        onChangeText={setValueText}
        prefix="₦"
        keyboardType="decimal-pad"
        error={error}
      />
      <RedesignField
        testID="redesign-update-value-as-of"
        label={t('investments.redesign.asOf')}
        value={asOf === today() ? t('investments.redesign.today') : asOf}
        onChangeText={setAsOf}
        placeholder={t('investments.redesign.today')}
      />
      {delta !== null && lastPriceDate ? (
        <RedesignText testID="redesign-update-value-delta" tone="textSecondary">
          {sinceLabel}
        </RedesignText>
      ) : null}
    </RedesignSheet>
  );
}

/** Add money → buy against cash (Figma Holding footer Add money). */
export function RedesignAddMoneySheet({
  holdingId,
  onClose,
}: {
  holdingId: string;
  onClose: () => void;
}) {
  const { snapshot, repo } = useWorkspace();
  const toast = useToast();
  const [amountText, setAmountText] = useState('');
  const [cashId, setCashId] = useState(() => (snapshot ? defaultCashAccountId(snapshot, holdingId) : ''));
  const [date, setDate] = useState(today());
  const [pickingCash, setPickingCash] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const cashAccounts =
    snapshot?.accounts.filter((a) => !a.archived && ['bank', 'savings', 'cash', 'wallet'].includes(a.type)) ?? [];
  const cashName = cashAccounts.find((a) => a.id === cashId)?.name ?? '';

  const save = async () => {
    setError(null);
    const parsed = parseAmount(amountText);
    if (!parsed.ok || parsed.minor <= 0n) {
      setError(t('investments.redesign.error.amount'));
      return;
    }
    if (!cashId) {
      setError(t('investments.redesign.error.cash'));
      return;
    }
    // One unit at this cost (value-tracked style), matching seedHoldingBook.
    setBusy(true);
    try {
      const r = await repo.buyHolding({
        holdingId,
        units: '1',
        pricePerUnit: parsed.minor,
        fees: 0n,
        cashAccountId: cashId,
        date: date || today(),
      });
      if (!r.ok) {
        setError(t('investments.redesign.error.save'));
        return;
      }
      toast.show(t('investments.redesign.moneyAdded'));
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <RedesignSheet
        visible
        testID="redesign-add-money-sheet"
        title={t('investments.redesign.addMoney')}
        onClose={onClose}
        dirty={amountText.trim().length > 0}
        footer={
          <RedesignButton
            testID="redesign-add-money-save"
            label={t('common.save')}
            onPress={() => void save()}
            disabled={busy}
            fullWidth
          />
        }
      >
        <RedesignField
          testID="redesign-add-money-amount"
          label={t('investments.redesign.amount')}
          value={amountText}
          onChangeText={setAmountText}
          prefix="₦"
          keyboardType="decimal-pad"
          error={error}
        />
        <RedesignField
          testID="redesign-add-money-cash"
          label={t('investments.redesign.payFrom')}
          value={cashName || t('investments.redesign.chooseAccount')}
          editable={false}
          onPress={() => setPickingCash(true)}
          trailing={<RedesignIcon name="chevron-down" size={20} color={tokens.color.light.textSecondary} />}
        />
        <RedesignField
          testID="redesign-add-money-date"
          label={t('investments.redesign.date')}
          value={date === today() ? t('investments.redesign.today') : date}
          onChangeText={setDate}
        />
      </RedesignSheet>

      <RedesignSheet
        visible={pickingCash}
        title={t('investments.redesign.payFrom')}
        onClose={() => setPickingCash(false)}
        testID="redesign-add-money-cash-sheet"
      >
        <View style={{ gap: sp.sm }}>
          {cashAccounts.map((a) => (
            <RedesignButton
              key={a.id}
              kind={cashId === a.id ? 'primary' : 'secondary'}
              label={a.name}
              onPress={() => {
                setCashId(a.id);
                setPickingCash(false);
              }}
              fullWidth
            />
          ))}
        </View>
      </RedesignSheet>
    </>
  );
}

function formatMonthDay(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long' }).format(new Date(Date.UTC(y, m - 1, d)));
}

function today() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lagos' }).format(new Date());
}
