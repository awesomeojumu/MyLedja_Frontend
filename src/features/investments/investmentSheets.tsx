import { useMemo, useState } from 'react';
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
import { ledgerMessage, today } from '@/features/transactions/helpers';
import { t } from '@/i18n';
import { formatNaira } from '@/money';
import { costOfPurchase } from '@/ledger';

import { HOLDING_TYPES, fifoCost, holdingUnits } from './helpers';

const sp = tokens.spacing;

/** PU-37 Add / edit holding */
export function HoldingSheet({
  holding,
  accountId,
  onClose,
  onCreated,
}: {
  holding?: Holding;
  accountId?: string;
  onClose: () => void;
  onCreated?: (h: Holding) => void;
}) {
  const { snapshot, repo } = useWorkspace();
  const toast = useToast();
  const investments = (snapshot?.accounts ?? []).filter((a) => a.type === 'investment' && !a.archived);
  const [name, setName] = useState(holding?.name ?? '');
  const [symbol, setSymbol] = useState(holding?.symbol ?? '');
  const [type, setType] = useState<HoldingType>(holding?.type ?? 'stock');
  const [heldIn, setHeldIn] = useState(holding?.accountId ?? accountId ?? investments[0]?.id ?? '');
  const [priceText, setPriceText] = useState('');
  const [priceMinor, setPriceMinor] = useState<bigint | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const valid = name.trim().length > 0 && !!heldIn;

  const save = async () => {
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    try {
      if (holding) {
        await repo.updateHolding({
          ...holding,
          name: name.trim(),
          symbol: symbol.trim().toUpperCase() || undefined,
          type,
          accountId: heldIn,
        });
        toast.show(t('investments.holdingSaved'));
        onClose();
        return;
      }
      const r = await repo.createHolding({
        name: name.trim(),
        symbol: symbol.trim() || undefined,
        type,
        accountId: heldIn,
        currentPriceMinor: priceMinor ?? undefined,
      });
      if (!r.ok) return setError(ledgerMessage(r.error));
      toast.show(t('investments.holdingAdded'));
      onCreated?.(r.value);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
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
        <TextInput testID="holding-name" label={t('investments.name')} value={name} onChangeText={setName} />
        <TextInput
          testID="holding-symbol"
          label={`${t('investments.symbol')} ${t('common.optional')}`}
          value={symbol}
          onChangeText={(v) => setSymbol(v.toUpperCase())}
          autoCapitalize="characters"
        />
        <Select
          testID="holding-type"
          label={t('investments.type')}
          value={type}
          onChange={(v) => setType(v as HoldingType)}
          options={HOLDING_TYPES.map((x) => ({ value: x, label: t(`investments.type.${x}`) }))}
        />
        <Select
          testID="holding-account"
          label={t('investments.heldIn')}
          value={heldIn}
          onChange={setHeldIn}
          options={investments.map((a) => ({ value: a.id, label: a.name }))}
        />
        {!holding ? (
          <AmountInput
            testID="holding-price"
            label={`${t('investments.currentPrice')} ${t('common.optional')}`}
            value={priceText}
            onChange={(text, minor) => {
              setPriceText(text);
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
  );
}

/** PU-38 Buy / sell */
export function TradeSheet({
  direction: initial,
  holdingId,
  onClose,
}: {
  direction: 'buy' | 'sell';
  holdingId?: string;
  onClose: () => void;
}) {
  const { snapshot, repo } = useWorkspace();
  const toast = useToast();
  const holdings = snapshot?.holdings ?? [];
  const cashAccounts = (snapshot?.accounts ?? []).filter((a) => !a.archived && ['bank', 'savings', 'cash', 'wallet'].includes(a.type));
  const [direction, setDirection] = useState<'buy' | 'sell'>(initial);
  const [holding, setHolding] = useState(holdingId ?? holdings[0]?.id ?? '');
  const [units, setUnits] = useState('');
  const [priceText, setPriceText] = useState('');
  const [priceMinor, setPriceMinor] = useState<bigint | null>(null);
  const [feesText, setFeesText] = useState('');
  const [feesMinor, setFeesMinor] = useState<bigint | null>(0n);
  const [cashId, setCashId] = useState(cashAccounts[0]?.id ?? '');
  const [date, setDate] = useState(today());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const held = useMemo(() => (snapshot && holding ? holdingUnits(snapshot, holding) : 0), [snapshot, holding]);
  const unitsNum = Number(units);
  const fees = feesMinor ?? 0n;
  const total =
    priceMinor !== null && units && !Number.isNaN(unitsNum) && unitsNum > 0
      ? costOfPurchase(units, priceMinor, direction === 'buy' ? fees : 0n)
      : null;
  const sellCost = useMemo(() => {
    if (!snapshot || direction !== 'sell' || !holding || !(unitsNum > 0)) return null;
    return fifoCost(snapshot, holding, unitsNum);
  }, [snapshot, direction, holding, unitsNum]);
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
              date,
            })
          : await repo.sellHolding({
              holdingId: holding,
              units,
              pricePerUnit: priceMinor,
              fees,
              cashAccountId: cashId,
              date,
              costOfLots: sellCost?.cost,
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
          onChange={setDirection}
          options={[
            { value: 'buy', label: t('investments.buy') },
            { value: 'sell', label: t('investments.sell') },
          ]}
        />
        <Select
          testID="trade-holding"
          label={t('investments.holding')}
          value={holding}
          onChange={setHolding}
          options={holdings.map((h) => ({ value: h.id, label: h.symbol ? `${h.name} (${h.symbol})` : h.name }))}
        />
        <TextInput testID="trade-units" label={t('investments.units')} value={units} onChangeText={setUnits} keyboardType="decimal-pad" />
        {direction === 'sell' ? (
          <Text variant="caption" tone="textSecondary">
            {t('investments.youHold', { units: String(held) })}
          </Text>
        ) : null}
        <AmountInput
          testID="trade-price"
          label={t('investments.pricePerUnit')}
          value={priceText}
          onChange={(text, minor) => {
            setPriceText(text);
            setPriceMinor(minor);
          }}
        />
        <AmountInput
          testID="trade-fees"
          label={`${t('investments.fees')} ${t('common.optional')}`}
          value={feesText}
          onChange={(text, minor) => {
            setFeesText(text);
            setFeesMinor(minor ?? 0n);
          }}
        />
        <Select
          testID="trade-cash"
          label={direction === 'buy' ? t('investments.moneyFrom') : t('investments.moneyTo')}
          value={cashId}
          onChange={setCashId}
          options={cashAccounts.map((a) => ({ value: a.id, label: a.name }))}
        />
        <DatePicker testID="trade-date" label={t('common.date')} value={date} onChange={setDate} />
        {direction === 'buy' && total !== null ? (
          <Text tone="textSecondary">{t('investments.buyTotal', { amount: formatNaira(total) })}</Text>
        ) : null}
        {direction === 'sell' && proceeds !== null && sellCost?.ok && gain !== null ? (
          <Text tone="textSecondary">
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
export function DividendSheet({ holdingId, onClose }: { holdingId?: string; onClose: () => void }) {
  const { snapshot, repo } = useWorkspace();
  const toast = useToast();
  const holdings = snapshot?.holdings ?? [];
  const cashAccounts = (snapshot?.accounts ?? []).filter((a) => !a.archived && ['bank', 'savings', 'cash', 'wallet'].includes(a.type));
  const [holding, setHolding] = useState(holdingId ?? holdings[0]?.id ?? '');
  const [amountText, setAmountText] = useState('');
  const [amountMinor, setAmountMinor] = useState<bigint | null>(null);
  const [cashId, setCashId] = useState(cashAccounts[0]?.id ?? '');
  const [date, setDate] = useState(today());
  const [reinvested, setReinvested] = useState(false);
  const [units, setUnits] = useState('');
  const [priceText, setPriceText] = useState('');
  const [priceMinor, setPriceMinor] = useState<bigint | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const valid =
    !!holding &&
    !!cashId &&
    amountMinor !== null &&
    amountMinor > 0n &&
    (!reinvested || (!!units && Number(units) > 0 && priceMinor !== null && priceMinor > 0n));

  const save = async () => {
    if (!valid || busy || amountMinor === null) return;
    setBusy(true);
    setError(null);
    try {
      const r = await repo.recordDividend({
        holdingId: holding,
        amount: amountMinor,
        date,
        cashAccountId: cashId,
        reinvested,
        units: reinvested ? units : undefined,
        pricePerUnit: reinvested ? priceMinor ?? undefined : undefined,
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
          value={holding}
          onChange={setHolding}
          options={holdings.map((h) => ({ value: h.id, label: h.name }))}
        />
        <AmountInput
          testID="dividend-amount"
          label={t('common.amount')}
          value={amountText}
          onChange={(text, minor) => {
            setAmountText(text);
            setAmountMinor(minor);
          }}
        />
        <DatePicker label={t('common.date')} value={date} onChange={setDate} />
        <Select
          testID="dividend-cash"
          label={t('investments.paidInto')}
          value={cashId}
          onChange={setCashId}
          options={cashAccounts.map((a) => ({ value: a.id, label: a.name }))}
        />
        <Switch testID="dividend-reinvest" label={t('investments.reinvested')} value={reinvested} onChange={setReinvested} />
        {reinvested ? (
          <>
            <TextInput testID="dividend-units" label={t('investments.unitsBought')} value={units} onChangeText={setUnits} keyboardType="decimal-pad" />
            <AmountInput
              testID="dividend-price"
              label={t('investments.pricePerUnit')}
              value={priceText}
              onChange={(text, minor) => {
                setPriceText(text);
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
export function UpdatePricesSheet({ holdingId, onClose }: { holdingId?: string; onClose: () => void }) {
  const { snapshot, repo } = useWorkspace();
  const toast = useToast();
  const rows = (snapshot?.holdings ?? []).filter((h) => !holdingId || h.id === holdingId);
  const [values, setValues] = useState<Record<string, { text: string; minor: bigint | null }>>({});
  const [date, setDate] = useState(today());
  const [busy, setBusy] = useState(false);
  const filled = rows.filter((h) => (values[h.id]?.minor ?? null) !== null && (values[h.id]?.minor ?? 0n) > 0n);

  const save = async () => {
    if (busy || filled.length === 0) return;
    setBusy(true);
    try {
      await repo.savePrices(
        filled.map((h) => ({ holdingId: h.id, priceMinor: values[h.id]!.minor! })),
        date,
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
        <DatePicker label={t('common.date')} value={date} onChange={setDate} />
        {rows.map((h) => (
          <AmountInput
            key={h.id}
            testID={`price-row-${h.id}`}
            label={h.name}
            value={values[h.id]?.text ?? ''}
            onChange={(text, minor) => setValues((v) => ({ ...v, [h.id]: { text, minor } }))}
          />
        ))}
        <Text variant="caption" tone="textSecondary">
          {t('investments.pricesCaption')}
        </Text>
      </View>
    </Sheet>
  );
}
