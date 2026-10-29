import { useMemo, useState } from 'react';
import { View } from 'react-native';

import {
  Amount,
  AmountInput,
  Button,
  DatePicker,
  Footer,
  formatDay,
  GuardedSheet,
  InlineError,
  SegmentedControl,
  Select,
  Switch,
  Text,
  TextInput,
  useToast,
} from '@/design/components';
import tokens from '@/design/tokens.json';
import { HOLDING_TYPES, type Holding, type HoldingType } from '@/data/workspace/model';
import { openLotsOf, type Snapshot } from '@/data/workspace/repository';
import { useWorkspace } from '@/data/workspace/WorkspaceProvider';
import { ledgerMessage, today } from '@/features/transactions/helpers';
import { t, type TextKey } from '@/i18n';
import { formatUnits, parseUnits, pickLots, valueOf } from '@/ledger';
import { formatMoney, toInputText } from '@/money';

import { isUnits, priceStatus } from './helpers';

const sp = tokens.spacing;

export const holdingTypeLabel = (type: HoldingType) => t(`investments.type.${type}` as TextKey);

/** Accounts a holding can be held in: investment accounts (DESIGN.md page 17). */
export function holdingAccounts(snapshot: Snapshot) {
  return snapshot.accounts.filter((a) => !a.archived && a.type === 'investment');
}

/** Popup: Add / edit holding (DESIGN.md page 17). */
export function HoldingSheet({ existing, onClose }: { existing?: Holding; onClose: () => void }) {
  const { snapshot, repo } = useWorkspace();
  const toast = useToast();
  const accounts = snapshot ? holdingAccounts(snapshot) : [];
  const [name, setName] = useState(existing?.name ?? '');
  const [symbol, setSymbol] = useState(existing?.symbol ?? '');
  const [type, setType] = useState<HoldingType>(existing?.type ?? 'stock');
  const [accountId, setAccountId] = useState(existing?.accountId ?? accounts[0]?.id ?? '');
  const [price, setPrice] = useState<{ text: string; minor: bigint | null }>({ text: '', minor: null });
  const [error, setError] = useState<string | null>(null);
  const dirty = name !== (existing?.name ?? '') || symbol !== (existing?.symbol ?? '') || price.text !== '';
  const valid = name.trim() !== '' && accountId !== '' && (price.text === '' || (price.minor !== null && price.minor > 0n));

  const save = async () => {
    if (existing) {
      await repo.updateHolding({ ...existing, name: name.trim(), symbol: symbol.trim() || undefined, type });
      toast.show(t('common.saved'));
      onClose();
      return;
    }
    const r = await repo.addHolding({ name, symbol, type, accountId, price: price.minor ?? undefined, date: today() });
    if (!r.ok) {
      setError(ledgerMessage(r.error));
      return;
    }
    toast.show(t('investments.holdingAdded'));
    onClose();
  };

  return (
    <GuardedSheet
      visible
      dirty={dirty}
      testID="holding-sheet"
      title={existing ? t('investments.editHolding') : t('investments.addHolding')}
      onClose={onClose}
      footer={
        <Footer>
          <Button kind="secondary" label={t('common.cancel')} onPress={onClose} />
          <Button testID="holding-save" label={t('investments.saveHolding')} disabled={!valid} onPress={() => void save()} />
        </Footer>
      }
    >
      <View style={{ gap: sp['spacing-md'] }}>
        <TextInput testID="holding-name" label={t('investments.name')} value={name} onChangeText={setName} />
        <TextInput testID="holding-symbol" label={`${t('investments.symbol')} ${t('common.optional')}`} value={symbol} onChangeText={setSymbol} autoCapitalize="characters" />
        <Select
          testID="holding-type"
          label={t('investments.typeLabel')}
          value={type}
          onChange={setType}
          options={HOLDING_TYPES.map((v) => ({ value: v, label: holdingTypeLabel(v) }))}
        />
        {existing ? null : accounts.length === 0 ? (
          <InlineError testID="holding-no-account" message={t('investments.needAccount')} />
        ) : (
          <>
            <Select
              testID="holding-account"
              label={t('investments.heldIn')}
              value={accountId}
              onChange={setAccountId}
              options={accounts.map((a) => ({ value: a.id, label: `${a.name} · ${a.currency}` }))}
            />
            <AmountInput
              testID="holding-price"
              label={`${t('investments.currentPrice')} ${t('common.optional')}`}
              value={price.text}
              onChange={(text, minor) => setPrice({ text, minor })}
            />
          </>
        )}
        {error ? <InlineError message={error} /> : null}
      </View>
    </GuardedSheet>
  );
}

type TradeMode = 'buy' | 'sell';

/** Popup: Buy / sell (DESIGN.md page 17). Sell shows the lots it takes and the gain before saving (P18-03). */
export function TradeSheet({ holding, mode: initial, onClose }: { holding: Holding; mode: TradeMode; onClose: () => void }) {
  const { snapshot, repo } = useWorkspace();
  const toast = useToast();
  const [mode, setMode] = useState<TradeMode>(initial);
  const cashAccounts = (snapshot?.accounts ?? []).filter(
    (a) => !a.archived && a.currency === holding.currency && ['bank', 'savings', 'cash', 'wallet', 'investment'].includes(a.type),
  );
  const [units, setUnits] = useState('');
  const [price, setPrice] = useState<{ text: string; minor: bigint | null }>(() => {
    const last = snapshot ? priceStatus(snapshot, holding.id, today()) : null;
    return last ? { text: toInputText(last.price), minor: last.price } : { text: '', minor: null };
  });
  const [fees, setFees] = useState<{ text: string; minor: bigint | null }>({ text: '', minor: 0n });
  const [date, setDate] = useState(today());
  const [accountId, setAccountId] = useState(cashAccounts.find((a) => a.id === holding.accountId)?.id ?? cashAccounts[0]?.id ?? '');
  const [chooseLots, setChooseLots] = useState(false);
  const [chosen, setChosen] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const open = useMemo(() => (snapshot ? openLotsOf(snapshot.events, holding.id) : []), [snapshot, holding.id]);
  const held = open.reduce((s, l) => s + l.units, 0n);
  const unitsOk = isUnits(units);
  const feesMinor = fees.text === '' ? 0n : fees.minor;
  const lotsInput = chooseLots
    ? Object.entries(chosen)
        .filter(([, v]) => v.trim() !== '')
        .map(([lotId, v]) => ({ lotId, units: v.trim() }))
    : undefined;

  /** What the sale takes and gains, worked out before saving. */
  const preview = useMemo(() => {
    if (mode !== 'sell' || !unitsOk || price.minor === null || feesMinor === null) return null;
    const n = parseUnits(units);
    if (n > held) return { error: t('ledger.error.not_enough_units') };
    const picks = pickLots(
      open,
      n,
      lotsInput?.map((l) => ({ lotId: l.lotId, units: isUnits(l.units) ? parseUnits(l.units) : -1n })),
    );
    if (!picks) return { error: t('ledger.error.lots_mismatch') };
    const proceeds = valueOf(n, price.minor) - feesMinor;
    const cost = picks.reduce((s, p) => s + p.cost, 0n);
    return { proceeds, cost, gain: proceeds - cost };
  }, [mode, unitsOk, price.minor, feesMinor, units, held, open, lotsInput]);

  const cost = mode === 'buy' && unitsOk && price.minor !== null && feesMinor !== null ? valueOf(parseUnits(units), price.minor) + feesMinor : null;
  const valid =
    unitsOk && price.minor !== null && price.minor > 0n && feesMinor !== null && accountId !== '' && (mode === 'buy' || (preview !== null && !('error' in preview)));
  const dirty = units !== '' || fees.text !== '';

  const save = async () => {
    setError(null);
    const input = { holdingId: holding.id, accountId, units: units.trim(), price: price.minor!, fees: feesMinor ?? 0n, date };
    const r = mode === 'buy' ? await repo.buyHolding(input) : await repo.sellHolding({ ...input, lots: lotsInput });
    if (!r.ok) {
      setError(ledgerMessage(r.error));
      return;
    }
    toast.show(mode === 'buy' ? t('investments.bought') : t('investments.sold'));
    onClose();
  };

  return (
    <GuardedSheet
      visible
      dirty={dirty}
      testID="trade-sheet"
      title={`${mode === 'buy' ? t('investments.buyTitle') : t('investments.sellTitle')} · ${holding.name}`}
      onClose={onClose}
      footer={
        <Footer>
          <Button kind="secondary" label={t('common.cancel')} onPress={onClose} />
          <Button
            testID="trade-save"
            label={mode === 'buy' ? t('investments.saveBuy') : t('investments.saveSell')}
            disabled={!valid}
            onPress={() => void save()}
          />
        </Footer>
      }
    >
      <View style={{ gap: sp['spacing-md'] }}>
        <SegmentedControl
          testID="trade-mode"
          label={t('investments.tradeKind')}
          value={mode}
          onChange={setMode}
          options={[
            { value: 'buy', label: t('investments.buy') },
            { value: 'sell', label: t('investments.sell') },
          ]}
        />
        <TextInput
          testID="trade-units"
          label={t('investments.units')}
          value={units}
          onChangeText={setUnits}
          keyboardType="decimal-pad"
          placeholder={t('investments.unitsPlaceholder')}
          error={units !== '' && !unitsOk ? t('investments.unitsInvalid') : null}
          caption={mode === 'sell' ? t('investments.youHold', { units: formatUnits(held) }) : undefined}
        />
        <AmountInput testID="trade-price" label={t('investments.pricePerUnit')} value={price.text} onChange={(text, minor) => setPrice({ text, minor })} />
        <AmountInput testID="trade-fees" label={`${t('investments.fees')} ${t('common.optional')}`} value={fees.text} onChange={(text, minor) => setFees({ text, minor })} />
        <DatePicker testID="trade-date" label={t('investments.date')} value={date} onChange={setDate} />
        <Select
          testID="trade-account"
          label={mode === 'buy' ? t('investments.moneyFrom') : t('investments.moneyTo')}
          value={accountId}
          onChange={setAccountId}
          options={cashAccounts.map((a) => ({ value: a.id, label: a.name }))}
        />
        {mode === 'sell' ? (
          <View style={{ gap: sp['spacing-sm'] }}>
            <Switch testID="trade-choose-lots" label={t('investments.chooseLots')} value={chooseLots} onChange={setChooseLots} />
            {chooseLots
              ? open.map((l) => (
                  <TextInput
                    key={l.lotId}
                    testID={`trade-lot-${l.lotId}`}
                    label={t('investments.lotLabel', { date: formatDay(l.date), units: formatUnits(l.units) })}
                    value={chosen[l.lotId] ?? ''}
                    onChangeText={(v) => setChosen({ ...chosen, [l.lotId]: v })}
                    keyboardType="decimal-pad"
                  />
                ))
              : (
                  <Text variant="caption" tone="textSecondary">
                    {t('investments.oldestFirst')}
                  </Text>
                )}
          </View>
        ) : null}
        {cost !== null ? (
          <View accessible style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text>{t('investments.costWithFees')}</Text>
            <Amount testID="trade-cost" minor={cost} currency={holding.currency} />
          </View>
        ) : null}
        {preview && 'error' in preview ? <InlineError testID="trade-preview-error" message={preview.error ?? ''} /> : null}
        {preview && !('error' in preview) ? (
          <View style={{ gap: sp['spacing-xs'] }} testID="trade-preview">
            <Row label={t('investments.proceeds')} value={formatMoney(preview.proceeds, holding.currency)} />
            <Row label={t('investments.costOfLots')} value={formatMoney(preview.cost, holding.currency)} />
            <Row
              label={preview.gain >= 0n ? t('investments.gainOnSale') : t('investments.lossOnSale')}
              value={formatMoney(preview.gain, holding.currency, { signed: true })}
              testID="trade-gain"
            />
          </View>
        ) : null}
        <Text variant="caption" tone="textSecondary">
          {t('investments.buyCaption')}
        </Text>
        {error ? <InlineError message={error} /> : null}
      </View>
    </GuardedSheet>
  );
}

function Row({ label, value, testID }: { label: string; value: string; testID?: string }) {
  return (
    <View accessible accessibilityLabel={`${label}, ${value}`} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      <Text>{label}</Text>
      <Text testID={testID} style={{ fontVariant: ['tabular-nums'] }}>
        {value}
      </Text>
    </View>
  );
}

/** Popup: Dividend (DESIGN.md page 17): paid into an account, or reinvested (P18-04). */
export function DividendSheet({ holding, onClose }: { holding: Holding; onClose: () => void }) {
  const { snapshot, repo } = useWorkspace();
  const toast = useToast();
  const accounts = (snapshot?.accounts ?? []).filter((a) => !a.archived && a.currency === holding.currency && a.type !== 'loan' && a.type !== 'card');
  const [amount, setAmount] = useState<{ text: string; minor: bigint | null }>({ text: '', minor: null });
  const [date, setDate] = useState(today());
  const [accountId, setAccountId] = useState(accounts.find((a) => a.id === holding.accountId)?.id ?? accounts[0]?.id ?? '');
  const [reinvested, setReinvested] = useState(false);
  const [units, setUnits] = useState('');
  const [error, setError] = useState<string | null>(null);
  const valid = amount.minor !== null && amount.minor > 0n && (reinvested ? isUnits(units) : accountId !== '');

  const save = async () => {
    const r = await repo.recordDividend({
      holdingId: holding.id,
      amount: amount.minor!,
      date,
      ...(reinvested ? { reinvestedUnits: units.trim() } : { accountId }),
    });
    if (!r.ok) {
      setError(ledgerMessage(r.error));
      return;
    }
    toast.show(t('investments.dividendSaved'));
    onClose();
  };

  return (
    <GuardedSheet
      visible
      dirty={amount.text !== '' || units !== ''}
      testID="dividend-sheet"
      title={`${t('investments.dividendTitle')} · ${holding.name}`}
      onClose={onClose}
      footer={
        <Footer>
          <Button kind="secondary" label={t('common.cancel')} onPress={onClose} />
          <Button testID="dividend-save" label={t('investments.saveDividend')} disabled={!valid} onPress={() => void save()} />
        </Footer>
      }
    >
      <View style={{ gap: sp['spacing-md'] }}>
        <AmountInput testID="dividend-amount" label={t('investments.amount')} value={amount.text} onChange={(text, minor) => setAmount({ text, minor })} />
        <DatePicker testID="dividend-date" label={t('investments.date')} value={date} onChange={setDate} />
        <Switch testID="dividend-reinvested" label={t('investments.reinvested')} value={reinvested} onChange={setReinvested} />
        {reinvested ? (
          <TextInput
            testID="dividend-units"
            label={t('investments.unitsBought')}
            value={units}
            onChangeText={setUnits}
            keyboardType="decimal-pad"
            error={units !== '' && !isUnits(units) ? t('investments.unitsInvalid') : null}
          />
        ) : (
          <Select
            testID="dividend-account"
            label={t('investments.paidInto')}
            value={accountId}
            onChange={setAccountId}
            options={accounts.map((a) => ({ value: a.id, label: a.name }))}
          />
        )}
        <Text variant="caption" tone="textSecondary">
          {t('investments.dividendCaption')}
        </Text>
        {error ? <InlineError message={error} /> : null}
      </View>
    </GuardedSheet>
  );
}

/** Popup: Update prices (P17-04): each holding with its last price and a field for today's. */
export function UpdatePricesSheet({ holdings, onClose }: { holdings: Holding[]; onClose: () => void }) {
  const { snapshot, repo } = useWorkspace();
  const toast = useToast();
  const [date, setDate] = useState(today());
  const [values, setValues] = useState<Record<string, { text: string; minor: bigint | null }>>({});
  const entries = Object.entries(values).filter(([, v]) => v.text !== '');
  const valid = entries.length > 0 && entries.every(([, v]) => v.minor !== null && v.minor > 0n);

  const save = async () => {
    await repo.setPrices(
      date,
      entries.map(([holdingId, v]) => ({ holdingId, price: v.minor! })),
    );
    toast.show(t('investments.pricesSaved'));
    onClose();
  };

  return (
    <GuardedSheet
      visible
      dirty={entries.length > 0}
      testID="prices-sheet"
      title={t('investments.updatePrices')}
      onClose={onClose}
      footer={
        <Footer>
          <Button kind="secondary" label={t('common.cancel')} onPress={onClose} />
          <Button testID="prices-save" label={t('investments.savePrices')} disabled={!valid} onPress={() => void save()} />
        </Footer>
      }
    >
      <View style={{ gap: sp['spacing-md'] }}>
        <DatePicker testID="prices-date" label={t('investments.priceDate')} value={date} onChange={setDate} />
        {holdings.map((h) => {
          const last = snapshot ? priceStatus(snapshot, h.id, date) : null;
          return (
            <AmountInput
              key={h.id}
              testID={`price-${h.id}`}
              label={
                last
                  ? t('investments.priceField', { name: h.name, price: formatMoney(last.price, h.currency), date: formatDay(last.date) })
                  : t('investments.priceFieldNone', { name: h.name })
              }
              value={values[h.id]?.text ?? ''}
              onChange={(text, minor) => setValues({ ...values, [h.id]: { text, minor } })}
            />
          );
        })}
      </View>
    </GuardedSheet>
  );
}
