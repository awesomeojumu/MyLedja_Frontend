import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';

import {
  AmountInput,
  Button,
  DatePicker,
  Footer,
  InlineError,
  SegmentedControl,
  Select,
  Sheet,
  Switch,
  Text,
  TextInput,
  useToast,
} from '@/design/components';
import tokens from '@/design/tokens.json';
import type { Holding, HoldingType } from '@/data/workspace/model';
import { useWorkspace } from '@/data/workspace/WorkspaceProvider';
import { AddAccountSheet } from '@/features/accounts/accountSheets';
import { ledgerMessage, today } from '@/features/transactions/helpers';
import { t } from '@/i18n';
import { formatNaira } from '@/money';
import { costOfPurchase } from '@/ledger';

import { HOLDING_TYPES, defaultCashAccountId, fifoCost, holdingUnits, latestPrice, lotsFor, openUnits } from './helpers';

const sp = tokens.spacing;

const CURRENCY_OPTIONS = [
  { value: 'NGN', label: '₦ Naira (NGN)' },
  { value: 'USD', label: '$ US dollar (USD)' },
  { value: 'GBP', label: '£ Pound (GBP)' },
  { value: 'EUR', label: '€ Euro (EUR)' },
];

export type HoldingDraft = {
  name: string;
  symbol: string;
  type: HoldingType;
  heldIn: string;
  currency: string;
  priceText: string;
};

export type TradeDraft = {
  direction: 'buy' | 'sell';
  holding: string;
  units: string;
  priceText: string;
  feesText: string;
  cashId: string;
  date: string;
};

export type DividendDraft = {
  holding: string;
  amountText: string;
  cashId: string;
  date: string;
  reinvested: boolean;
  units: string;
  priceText: string;
};

export type PricesDraft = {
  date: string;
  values: Record<string, string>;
};

export const emptyHoldingDraft = (): HoldingDraft => ({
  name: '',
  symbol: '',
  type: 'stock',
  heldIn: '',
  currency: 'NGN',
  priceText: '',
});

export const emptyTradeDraft = (direction: 'buy' | 'sell' = 'buy'): TradeDraft => ({
  direction,
  holding: '',
  units: '',
  priceText: '',
  feesText: '',
  cashId: '',
  date: today(),
});

export const emptyDividendDraft = (): DividendDraft => ({
  holding: '',
  amountText: '',
  cashId: '',
  date: today(),
  reinvested: false,
  units: '',
  priceText: '',
});

export const emptyPricesDraft = (): PricesDraft => ({
  date: today(),
  values: {},
});

/** PU-37 Add / edit holding */
export function HoldingSheet({
  holding,
  accountId,
  onClose,
  onCreated,
  draft,
  setDraft,
}: {
  holding?: Holding;
  accountId?: string;
  onClose: () => void;
  onCreated?: (h: Holding) => void;
  draft?: HoldingDraft;
  setDraft?: (next: HoldingDraft | ((prev: HoldingDraft) => HoldingDraft)) => void;
}) {
  const { snapshot, repo } = useWorkspace();
  const toast = useToast();
  const investments = (snapshot?.accounts ?? []).filter((a) => a.type === 'investment' && !a.archived);
  const defaultHeld = holding?.accountId ?? accountId ?? investments[0]?.id ?? '';
  const defaultCurrency =
    holding?.currency ??
    investments.find((a) => a.id === defaultHeld)?.currency ??
    snapshot?.accounts.find((a) => a.id === defaultHeld)?.currency ??
    'NGN';

  const [local, setLocal] = useState<HoldingDraft>(() => ({
    name: holding?.name ?? '',
    symbol: holding?.symbol ?? '',
    type: holding?.type ?? 'stock',
    heldIn: defaultHeld,
    currency: defaultCurrency,
    priceText: '',
  }));
  const state = draft ?? local;
  const update = setDraft ?? setLocal;

  const heldIn = state.heldIn || defaultHeld;
  const currency = state.currency || defaultCurrency;
  const [priceMinor, setPriceMinor] = useState<bigint | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [addingAccount, setAddingAccount] = useState(false);
  const [knownInvestmentIds, setKnownInvestmentIds] = useState<string[]>([]);
  const valid = state.name.trim().length > 0 && !!heldIn;

  useEffect(() => {
    if (holding || !defaultHeld) return;
    if (!state.heldIn) update((s) => ({ ...s, heldIn: defaultHeld, currency: s.currency || defaultCurrency }));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- seed once when account list is ready
  }, [defaultHeld, defaultCurrency, holding, state.heldIn]);

  const save = async () => {
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    try {
      if (holding) {
        await repo.updateHolding({
          ...holding,
          name: state.name.trim(),
          symbol: state.symbol.trim().toUpperCase() || undefined,
          type: state.type,
          accountId: heldIn,
          currency,
        });
        toast.show(t('investments.holdingSaved'));
        onClose();
        return;
      }
      const r = await repo.createHolding({
        name: state.name.trim(),
        symbol: state.symbol.trim() || undefined,
        type: state.type,
        accountId: heldIn,
        currency,
        currentPriceMinor: priceMinor ?? undefined,
      });
      if (!r.ok) return setError(ledgerMessage(r.error));
      toast.show(t('investments.holdingAdded'));
      // Keep sheet mounted until parent opens buy — do not call onClose (P1 #14).
      if (onCreated) onCreated(r.value);
      else onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Sheet
        visible
        testID="holding-sheet"
        title={holding ? t('investments.editHolding') : t('investments.addHolding')}
        onClose={onClose}
        footer={
          <Footer>
            <Button kind="secondary" label={t('common.cancel')} onPress={onClose} />
            <Button
              testID="holding-save"
              label={holding ? t('common.saveChanges') : t('investments.addHolding')}
              disabled={!valid || busy}
              onPress={() => void save()}
            />
          </Footer>
        }
      >
        <View style={{ gap: sp['spacing-md'] }}>
          <TextInput
            testID="holding-name"
            label={t('investments.name')}
            value={state.name}
            onChangeText={(name) => update((s) => ({ ...s, name }))}
          />
          <TextInput
            testID="holding-symbol"
            label={`${t('investments.symbol')} ${t('common.optional')}`}
            value={state.symbol}
            onChangeText={(v) => update((s) => ({ ...s, symbol: v.toUpperCase() }))}
            autoCapitalize="characters"
          />
          <Select
            testID="holding-type"
            label={t('investments.type')}
            value={state.type}
            onChange={(v) => update((s) => ({ ...s, type: v as HoldingType }))}
            options={HOLDING_TYPES.map((x) => ({ value: x, label: t(`investments.type.${x}`) }))}
          />
          <Select
            testID="holding-account"
            label={t('investments.heldIn')}
            value={heldIn}
            onChange={(next) => {
              const nextCurrency = investments.find((a) => a.id === next)?.currency ?? currency;
              update((s) => ({ ...s, heldIn: next, currency: nextCurrency }));
            }}
            options={investments.map((a) => ({ value: a.id, label: a.name }))}
            addNewLabel={t('investments.addAccountOption')}
            onAddNew={() => {
              setKnownInvestmentIds(investments.map((a) => a.id));
              setAddingAccount(true);
            }}
          />
          <Select
            testID="holding-currency"
            label={t('investments.currency')}
            value={currency}
            onChange={(next) => update((s) => ({ ...s, currency: next }))}
            options={CURRENCY_OPTIONS}
          />
          {!holding ? (
            <AmountInput
              testID="holding-price"
              label={`${t('investments.currentPrice')} ${t('common.optional')}`}
              value={state.priceText}
              onChange={(text, minor) => {
                update((s) => ({ ...s, priceText: text }));
                setPriceMinor(minor);
              }}
            />
          ) : null}
          <Text variant="caption" tone="textSecondary">
            {t('investments.holdingCaption')}
          </Text>
          {error ? <InlineError message={error} /> : null}
        </View>
      </Sheet>
      {addingAccount ? (
        <AddAccountSheet
          onClose={() => {
            setAddingAccount(false);
            void repo.load().then((s) => {
              const known = new Set(knownInvestmentIds);
              const created = s.accounts.find((a) => a.type === 'investment' && !a.archived && !known.has(a.id));
              if (created) update((d) => ({ ...d, heldIn: created.id, currency: created.currency }));
            });
          }}
        />
      ) : null}
    </>
  );
}

/** PU-38 Buy / sell */
export function TradeSheet({
  direction: initial,
  holdingId,
  onClose,
  draft,
  setDraft,
}: {
  direction: 'buy' | 'sell';
  holdingId?: string;
  onClose: () => void;
  draft?: TradeDraft;
  setDraft?: (next: TradeDraft | ((prev: TradeDraft) => TradeDraft)) => void;
}) {
  const { snapshot, repo } = useWorkspace();
  const toast = useToast();
  const holdings = useMemo(() => snapshot?.holdings ?? [], [snapshot?.holdings]);
  const cashAccounts = (snapshot?.accounts ?? []).filter((a) => !a.archived && ['bank', 'savings', 'cash', 'wallet'].includes(a.type));
  const defaultHolding = holdingId ?? holdings[0]?.id ?? '';
  const defaultPrice = snapshot && defaultHolding ? latestPrice(snapshot, defaultHolding) : null;
  const defaultCash = snapshot ? defaultCashAccountId(snapshot, defaultHolding || undefined) : cashAccounts[0]?.id ?? '';

  const [local, setLocal] = useState<TradeDraft>(() => ({
    direction: initial,
    holding: defaultHolding,
    units: '',
    priceText: defaultPrice ? formatNaira(BigInt(defaultPrice.priceMinor)) : '',
    feesText: '',
    cashId: defaultCash,
    date: today(),
  }));
  const state = draft ?? local;
  const update = setDraft ?? setLocal;
  const [priceMinor, setPriceMinor] = useState<bigint | null>(defaultPrice ? BigInt(defaultPrice.priceMinor) : null);
  const [feesMinor, setFeesMinor] = useState<bigint | null>(0n);
  const [chooseLots, setChooseLots] = useState(false);
  const [chosen, setChosen] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const direction = state.direction;
  const holding = state.holding || holdingId || defaultHolding;
  const units = state.units;
  const cashId = state.cashId || defaultCash;

  const held = useMemo(() => (snapshot && holding ? holdingUnits(snapshot, holding) : 0), [snapshot, holding]);
  const openLots = useMemo(
    () => (snapshot && holding ? lotsFor(snapshot, holding).filter((l) => openUnits(l) > 0) : []),
    [snapshot, holding],
  );
  const unitsNum = Number(units);
  const fees = feesMinor ?? 0n;
  const total =
    priceMinor !== null && units && !Number.isNaN(unitsNum) && unitsNum > 0
      ? costOfPurchase(units, priceMinor, direction === 'buy' ? fees : 0n)
      : null;
  const lotsInput = chooseLots
    ? Object.entries(chosen)
        .filter(([, v]) => v.trim() !== '' && Number(v) > 0)
        .map(([lotId, v]) => ({ lotId, units: v.trim() }))
    : undefined;
  let sellCost: { cost: bigint; ok: boolean } | null = null;
  if (snapshot && direction === 'sell' && holding && unitsNum > 0) {
    if (lotsInput?.length) {
      let cost = 0n;
      let sum = 0;
      let ok = true;
      for (const pick of lotsInput) {
        const lot = openLots.find((l) => l.id === pick.lotId);
        if (!lot) {
          ok = false;
          break;
        }
        const take = Number(pick.units);
        const available = openUnits(lot);
        if (take > available + 1e-9) {
          ok = false;
          break;
        }
        const lotUnits = Number(lot.units);
        cost += lotUnits > 0 ? (BigInt(lot.costMinor) * BigInt(Math.round(take * 1e6))) / BigInt(Math.round(lotUnits * 1e6)) : 0n;
        sum += take;
      }
      sellCost = { cost, ok: ok && Math.abs(sum - unitsNum) <= 1e-6 };
    } else {
      sellCost = fifoCost(snapshot, holding, unitsNum);
    }
  }
  const proceeds =
    direction === 'sell' && priceMinor !== null && unitsNum > 0
      ? costOfPurchase(units, priceMinor, 0n) - fees
      : null;
  const gain = proceeds !== null && sellCost?.ok ? proceeds - sellCost.cost : null;

  const valid =
    !!holding &&
    !!cashId &&
    priceMinor !== null &&
    priceMinor > 0n &&
    unitsNum > 0 &&
    (direction === 'buy' || (unitsNum <= held + 1e-9 && sellCost?.ok));

  const save = async () => {
    if (!valid || busy || priceMinor === null) return;
    setBusy(true);
    setError(null);
    try {
      const r =
        direction === 'buy'
          ? await repo.buyHolding({
              holdingId: holding,
              units,
              pricePerUnit: priceMinor,
              fees,
              cashAccountId: cashId,
              date: state.date,
            })
          : await repo.sellHolding({
              holdingId: holding,
              units,
              pricePerUnit: priceMinor,
              fees,
              cashAccountId: cashId,
              date: state.date,
              costOfLots: sellCost?.cost,
              lots: lotsInput,
            });
      if (!r.ok) return setError(ledgerMessage(r.error));
      toast.show(direction === 'buy' ? t('investments.purchaseRecorded') : t('investments.saleRecorded'));
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      visible
      testID="trade-sheet"
      title={direction === 'buy' ? t('investments.buy') : t('investments.sell')}
      onClose={onClose}
      footer={
        <Footer>
          <Button kind="secondary" label={t('common.cancel')} onPress={onClose} />
          <Button
            testID="trade-save"
            label={direction === 'buy' ? t('investments.recordPurchase') : t('investments.recordSale')}
            disabled={!valid || busy}
            onPress={() => void save()}
          />
        </Footer>
      }
    >
      <View style={{ gap: sp['spacing-md'] }}>
        <SegmentedControl
          testID="trade-direction"
          label={t('investments.direction')}
          value={direction}
          onChange={(v) => update((s) => ({ ...s, direction: v }))}
          options={[
            { value: 'buy', label: t('investments.buy') },
            { value: 'sell', label: t('investments.sell') },
          ]}
        />
        <Select
          testID="trade-holding"
          label={t('investments.holding')}
          value={holding}
          onChange={(id) => {
            const px = snapshot ? latestPrice(snapshot, id) : null;
            update((s) => ({
              ...s,
              holding: id,
              priceText: px ? formatNaira(BigInt(px.priceMinor)) : s.priceText,
              cashId: snapshot ? defaultCashAccountId(snapshot, id) : s.cashId,
            }));
            setPriceMinor(px ? BigInt(px.priceMinor) : null);
          }}
          options={holdings.map((h) => ({ value: h.id, label: h.symbol ? `${h.name} (${h.symbol})` : h.name }))}
        />
        <TextInput
          testID="trade-units"
          label={t('investments.units')}
          value={units}
          onChangeText={(v) => update((s) => ({ ...s, units: v }))}
          keyboardType="decimal-pad"
        />
        {direction === 'sell' ? (
          <Text variant="caption" tone="textSecondary">
            {t('investments.youHold', { units: String(held) })}
          </Text>
        ) : null}
        <AmountInput
          testID="trade-price"
          label={t('investments.pricePerUnit')}
          value={state.priceText}
          onChange={(text, minor) => {
            update((s) => ({ ...s, priceText: text }));
            setPriceMinor(minor);
          }}
        />
        <AmountInput
          testID="trade-fees"
          label={`${t('investments.fees')} ${t('common.optional')}`}
          value={state.feesText}
          onChange={(text, minor) => {
            update((s) => ({ ...s, feesText: text }));
            setFeesMinor(minor ?? 0n);
          }}
        />
        <Select
          testID="trade-cash"
          label={direction === 'buy' ? t('investments.moneyFrom') : t('investments.moneyTo')}
          value={cashId}
          onChange={(id) => update((s) => ({ ...s, cashId: id }))}
          options={cashAccounts.map((a) => ({ value: a.id, label: a.name }))}
        />
        <DatePicker testID="trade-date" label={t('common.date')} value={state.date} onChange={(date) => update((s) => ({ ...s, date }))} />
        {direction === 'sell' ? (
          <View style={{ gap: sp['spacing-sm'] }}>
            <Switch testID="trade-choose-lots" label={t('investments.chooseLots')} value={chooseLots} onChange={setChooseLots} />
            {chooseLots ? (
              openLots.map((l) => (
                <TextInput
                  key={l.id}
                  testID={`trade-lot-${l.id}`}
                  label={t('investments.lotLabel', { date: l.date, units: String(openUnits(l)) })}
                  value={chosen[l.id] ?? ''}
                  onChangeText={(v) => setChosen({ ...chosen, [l.id]: v })}
                  keyboardType="decimal-pad"
                />
              ))
            ) : (
              <Text variant="caption" tone="textSecondary">
                {t('investments.oldestFirst')}
              </Text>
            )}
          </View>
        ) : null}
        {direction === 'buy' && total !== null ? (
          <Text tone="textSecondary">{t('investments.buyTotal', { amount: formatNaira(total) })}</Text>
        ) : null}
        {direction === 'sell' && proceeds !== null && sellCost?.ok && gain !== null ? (
          <Text testID="trade-preview" tone="textSecondary">
            {t('investments.sellPreview', {
              receive: formatNaira(proceeds),
              cost: formatNaira(sellCost.cost),
              gain: formatNaira(gain),
            })}
          </Text>
        ) : null}
        <Text variant="caption" tone="textSecondary">
          {t('investments.tradeCaption')}
        </Text>
        {error ? <InlineError message={error} /> : null}
      </View>
    </Sheet>
  );
}

/** PU-39 Dividend */
export function DividendSheet({
  holdingId,
  onClose,
  draft,
  setDraft,
}: {
  holdingId?: string;
  onClose: () => void;
  draft?: DividendDraft;
  setDraft?: (next: DividendDraft | ((prev: DividendDraft) => DividendDraft)) => void;
}) {
  const { snapshot, repo } = useWorkspace();
  const toast = useToast();
  const holdings = snapshot?.holdings ?? [];
  const cashAccounts = (snapshot?.accounts ?? []).filter((a) => !a.archived && ['bank', 'savings', 'cash', 'wallet'].includes(a.type));
  const defaultHolding = holdingId ?? holdings[0]?.id ?? '';
  const defaultCash = snapshot ? defaultCashAccountId(snapshot, defaultHolding || undefined) : cashAccounts[0]?.id ?? '';

  const [local, setLocal] = useState<DividendDraft>(() => ({
    holding: defaultHolding,
    amountText: '',
    cashId: defaultCash,
    date: today(),
    reinvested: false,
    units: '',
    priceText: '',
  }));
  const state = draft ?? local;
  const update = setDraft ?? setLocal;

  const [amountMinor, setAmountMinor] = useState<bigint | null>(null);
  const [priceMinor, setPriceMinor] = useState<bigint | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const cashId = state.cashId || defaultCash;
  const valid =
    !!state.holding &&
    !!cashId &&
    amountMinor !== null &&
    amountMinor > 0n &&
    (!state.reinvested || (!!state.units && Number(state.units) > 0 && priceMinor !== null && priceMinor > 0n));

  const save = async () => {
    if (!valid || busy || amountMinor === null) return;
    setBusy(true);
    setError(null);
    try {
      const r = await repo.recordDividend({
        holdingId: state.holding,
        amount: amountMinor,
        date: state.date,
        cashAccountId: cashId,
        reinvested: state.reinvested,
        units: state.reinvested ? state.units : undefined,
        pricePerUnit: state.reinvested ? priceMinor ?? undefined : undefined,
      });
      if (!r.ok) return setError(ledgerMessage(r.error));
      toast.show(t('investments.dividendRecorded'));
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      visible
      testID="dividend-sheet"
      title={t('investments.dividend')}
      onClose={onClose}
      footer={
        <Footer>
          <Button kind="secondary" label={t('common.cancel')} onPress={onClose} />
          <Button testID="dividend-save" label={t('investments.recordDividend')} disabled={!valid || busy} onPress={() => void save()} />
        </Footer>
      }
    >
      <View style={{ gap: sp['spacing-md'] }}>
        <Select
          testID="dividend-holding"
          label={t('investments.holding')}
          value={state.holding}
          onChange={(holding) => update((s) => ({ ...s, holding, cashId: snapshot ? defaultCashAccountId(snapshot, holding) : s.cashId }))}
          options={holdings.map((h) => ({ value: h.id, label: h.name }))}
        />
        <AmountInput
          testID="dividend-amount"
          label={t('common.amount')}
          value={state.amountText}
          onChange={(text, minor) => {
            update((s) => ({ ...s, amountText: text }));
            setAmountMinor(minor);
          }}
        />
        <DatePicker label={t('common.date')} value={state.date} onChange={(date) => update((s) => ({ ...s, date }))} />
        <Select
          testID="dividend-cash"
          label={t('investments.paidInto')}
          value={cashId}
          onChange={(id) => update((s) => ({ ...s, cashId: id }))}
          options={cashAccounts.map((a) => ({ value: a.id, label: a.name }))}
        />
        <Switch
          testID="dividend-reinvest"
          label={t('investments.reinvested')}
          value={state.reinvested}
          onChange={(reinvested) => update((s) => ({ ...s, reinvested }))}
        />
        {state.reinvested ? (
          <>
            <TextInput
              testID="dividend-units"
              label={t('investments.unitsBought')}
              value={state.units}
              onChangeText={(units) => update((s) => ({ ...s, units }))}
              keyboardType="decimal-pad"
            />
            <AmountInput
              testID="dividend-price"
              label={t('investments.pricePerUnit')}
              value={state.priceText}
              onChange={(text, minor) => {
                update((s) => ({ ...s, priceText: text }));
                setPriceMinor(minor);
              }}
            />
          </>
        ) : null}
        {error ? <InlineError message={error} /> : null}
      </View>
    </Sheet>
  );
}

/** PU-40 Update prices */
export function UpdatePricesSheet({
  holdingId,
  onClose,
  draft,
  setDraft,
}: {
  holdingId?: string;
  onClose: () => void;
  draft?: PricesDraft;
  setDraft?: (next: PricesDraft | ((prev: PricesDraft) => PricesDraft)) => void;
}) {
  const { snapshot, repo } = useWorkspace();
  const toast = useToast();
  const rows = (snapshot?.holdings ?? []).filter((h) => !holdingId || h.id === holdingId);
  const [local, setLocal] = useState<PricesDraft>(() => ({ date: today(), values: {} }));
  const state = draft ?? local;
  const update = setDraft ?? setLocal;
  const [minors, setMinors] = useState<Record<string, bigint | null>>({});
  const [busy, setBusy] = useState(false);
  const filled = rows.filter((h) => (minors[h.id] ?? null) !== null && (minors[h.id] ?? 0n) > 0n);
  const [focusIndex, setFocusIndex] = useState(0);

  const save = async () => {
    if (busy || filled.length === 0) return;
    setBusy(true);
    try {
      await repo.savePrices(
        filled.map((h) => ({ holdingId: h.id, priceMinor: minors[h.id]! })),
        state.date,
      );
      toast.show(t('investments.pricesUpdated'));
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      visible
      testID="prices-sheet"
      title={t('investments.updatePrices')}
      onClose={onClose}
      footer={
        <Footer>
          <Button kind="secondary" label={t('common.cancel')} onPress={onClose} />
          <Button
            testID="prices-save"
            label={t('investments.savePrices', { count: filled.length })}
            disabled={filled.length === 0 || busy}
            onPress={() => void save()}
          />
        </Footer>
      }
    >
      <View style={{ gap: sp['spacing-md'] }}>
        <DatePicker label={t('common.date')} value={state.date} onChange={(date) => update((s) => ({ ...s, date }))} />
        {rows.map((h, i) => {
          const last = snapshot ? latestPrice(snapshot, h.id) : null;
          const label = last
            ? `${h.name} · ${t('investments.lastPrice', { price: formatNaira(BigInt(last.priceMinor)), date: last.date })}`
            : h.name;
          const isLast = i === rows.length - 1;
          return (
            <AmountInput
              key={`${h.id}-${focusIndex === i ? 'f' : 'b'}`}
              testID={`price-row-${h.id}`}
              label={label}
              value={state.values[h.id] ?? ''}
              onChange={(text, minor) => {
                update((s) => ({ ...s, values: { ...s.values, [h.id]: text } }));
                setMinors((v) => ({ ...v, [h.id]: minor }));
              }}
              returnKeyType={isLast ? 'done' : 'next'}
              blurOnSubmit={isLast}
              autoFocus={focusIndex === i && i > 0}
              onSubmitEditing={() => {
                if (!isLast) setFocusIndex(i + 1);
              }}
            />
          );
        })}
        <Text variant="caption" tone="textSecondary">
          {t('investments.pricesCaption')}
        </Text>
      </View>
    </Sheet>
  );
}
