import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';

import type { Holding, HoldingType, HoldingUnitType } from '@/data/workspace/model';
import { useWorkspace } from '@/data/workspace/WorkspaceProvider';
import { useToast } from '@/design/components';
import {
  RedesignButton,
  RedesignChip,
  RedesignField,
  RedesignIcon,
  RedesignSheet,
  RedesignSwitch,
  RedesignText,
} from '@/design/redesign';
import { redesignTokens as tokens } from '@/design/redesign/theme';
import { t } from '@/i18n';
import { formatNaira, parseAmount } from '@/money';

import { HOLDING_TYPES, defaultCashAccountId, formatGain } from './helpers';

const sp = tokens.space;

export type AddInvestmentDraft = {
  name: string;
  type: HoldingType;
  valueText: string;
  putInText: string;
  countInBudget: boolean;
  unitType?: HoldingUnitType;
  unitsText?: string;
  location?: string;
  titleStatus?: string;
};

export const emptyAddInvestmentDraft = (): AddInvestmentDraft => ({
  name: '',
  type: 'fund',
  valueText: '',
  putInText: '',
  countInBudget: false,
  unitType: 'units',
  unitsText: '1',
  location: '',
  titleStatus: '',
});

function typeLabel(type: HoldingType): string {
  return t(`investments.redesign.type.${type}` as 'investments.redesign.type.fund');
}

/** Figma Phone / Investments / Add investment (11:4706) + Extended Real Estate / Land profiling. */
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

  const isLandOrProperty = draft.type === 'land' || draft.type === 'realEstate';

  const dirty = useMemo(
    () =>
      draft.name.trim().length > 0 ||
      draft.valueText.trim().length > 0 ||
      draft.putInText.trim().length > 0 ||
      draft.type !== 'fund' ||
      draft.countInBudget ||
      (draft.location?.trim().length ?? 0) > 0,
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
        unitType: isLandOrProperty ? (draft.unitType ?? 'plots') : draft.unitType,
        units: isLandOrProperty && draft.unitsText?.trim() ? draft.unitsText.trim() : '1',
        location: draft.location?.trim() || undefined,
        titleStatus: draft.titleStatus?.trim() || undefined,
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

  const titleStatuses = ["C of O", "Governor's Consent", 'Registered Survey', 'Gazette', 'Deed of Assignment'];
  const landUnits: HoldingUnitType[] = ['plots', 'acres', 'sqm', 'lumpSum'];

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

        {isLandOrProperty ? (
          <>
            <RedesignField
              testID="redesign-add-investment-location"
              label={t('investments.redesign.location')}
              value={draft.location ?? ''}
              onChangeText={(location) => setDraft((d) => ({ ...d, location }))}
              placeholder="e.g. Epe Corridor, Lagos"
            />
            <View style={{ gap: sp.xs }}>
              <RedesignText variant="caption" tone="textSecondary">
                {t('investments.redesign.unitType')}
              </RedesignText>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: sp.xs }}>
                {landUnits.map((u) => (
                  <RedesignChip
                    key={u}
                    testID={`redesign-unit-${u}`}
                    label={t(`investments.redesign.unit.${u}` as 'investments.redesign.unit.plots')}
                    selected={(draft.unitType ?? 'plots') === u}
                    onPress={() => setDraft((d) => ({ ...d, unitType: u }))}
                  />
                ))}
              </View>
            </View>
            <RedesignField
              testID="redesign-add-investment-units"
              label={t('investments.redesign.size')}
              value={draft.unitsText ?? '1'}
              onChangeText={(unitsText) => setDraft((d) => ({ ...d, unitsText }))}
              keyboardType="decimal-pad"
            />
            <View style={{ gap: sp.xs }}>
              <RedesignText variant="caption" tone="textSecondary">
                {t('investments.redesign.titleStatus')}
              </RedesignText>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: sp.xs }}>
                {titleStatuses.map((s) => (
                  <RedesignChip
                    key={s}
                    label={s}
                    selected={draft.titleStatus === s}
                    onPress={() => setDraft((d) => ({ ...d, titleStatus: d.titleStatus === s ? '' : s }))}
                  />
                ))}
              </View>
            </View>
          </>
        ) : null}

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
                setDraft((d) => ({
                  ...d,
                  type,
                  unitType: type === 'land' || type === 'realEstate' ? 'plots' : 'units',
                }));
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

/** Update value sheet (Figma 5:2131) */
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

/** Capitalized improvement sheet ("Add cost to property") */
export function RedesignAddCostSheet({
  holdingId,
  onClose,
}: {
  holdingId: string;
  onClose: () => void;
}) {
  const { snapshot, repo } = useWorkspace();
  const toast = useToast();
  const [category, setCategory] = useState('fencing');
  const [amountText, setAmountText] = useState('');
  const [notes, setNotes] = useState('');
  const [cashId, setCashId] = useState(() => (snapshot ? defaultCashAccountId(snapshot, holdingId) : ''));
  const [date, setDate] = useState(today());
  const [pickingCash, setPickingCash] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const categories = [
    { key: 'fencing', label: t('investments.redesign.improvements.fencing') },
    { key: 'survey', label: t('investments.redesign.improvements.survey') },
    { key: 'title', label: t('investments.redesign.improvements.title') },
    { key: 'gate', label: t('investments.redesign.improvements.gate') },
    { key: 'clearing', label: t('investments.redesign.improvements.clearing') },
    { key: 'construction', label: t('investments.redesign.improvements.construction') },
    { key: 'renovation', label: t('investments.redesign.improvements.renovation') },
    { key: 'other', label: t('investments.redesign.improvements.other') },
  ];

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
    setBusy(true);
    try {
      const selectedCategory = categories.find((c) => c.key === category)?.label ?? category;
      const r = await repo.addCapitalImprovement(holdingId, {
        amountMinor: parsed.minor,
        date: date || today(),
        category: selectedCategory,
        note: notes.trim() || selectedCategory,
        cashAccountId: cashId,
      });
      if (!r.ok) {
        setError(t('investments.redesign.error.save'));
        return;
      }
      toast.show(t('investments.redesign.costAdded'));
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <RedesignSheet
        visible
        testID="redesign-add-cost-sheet"
        title={t('investments.redesign.addCostTitle')}
        onClose={onClose}
        dirty={amountText.trim().length > 0}
        footer={
          <RedesignButton
            testID="redesign-add-cost-save"
            label={t('investments.redesign.addCostAction')}
            onPress={() => void save()}
            disabled={busy}
            fullWidth
          />
        }
      >
        <RedesignText variant="helper" tone="textSecondary">
          {t('investments.redesign.addCostHelper')}
        </RedesignText>

        <View style={{ gap: sp.xs }}>
          <RedesignText variant="caption" tone="textSecondary">
            {t('investments.redesign.category')}
          </RedesignText>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: sp.xs }}>
            {categories.map((c) => (
              <RedesignChip
                key={c.key}
                label={c.label}
                selected={category === c.key}
                onPress={() => setCategory(c.key)}
              />
            ))}
          </View>
        </View>

        <RedesignField
          testID="redesign-add-cost-amount"
          label={t('investments.redesign.amount')}
          value={amountText}
          onChangeText={setAmountText}
          prefix="₦"
          keyboardType="decimal-pad"
          error={error}
        />
        <RedesignField
          testID="redesign-add-cost-cash"
          label={t('investments.redesign.payFrom')}
          value={cashName || t('investments.redesign.chooseAccount')}
          editable={false}
          onPress={() => setPickingCash(true)}
          trailing={<RedesignIcon name="chevron-down" size={20} color={tokens.color.light.textSecondary} />}
        />
        <RedesignField
          testID="redesign-add-cost-date"
          label={t('investments.redesign.date')}
          value={date === today() ? t('investments.redesign.today') : date}
          onChangeText={setDate}
        />
        <RedesignField
          testID="redesign-add-cost-notes"
          label={t('investments.redesign.notes')}
          value={notes}
          onChangeText={setNotes}
          placeholder="e.g. Survey contractor fee, perimeter wire"
        />
      </RedesignSheet>

      <RedesignSheet
        visible={pickingCash}
        title={t('investments.redesign.payFrom')}
        onClose={() => setPickingCash(false)}
        testID="redesign-add-cost-cash-sheet"
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

/** Disaster / write-off sheet */
export function RedesignWriteOffSheet({
  holding,
  currentValue,
  onClose,
}: {
  holding: Holding;
  currentValue: bigint;
  onClose: () => void;
}) {
  const { repo } = useWorkspace();
  const toast = useToast();
  const [kind, setKind] = useState<'full' | 'partial'>('full');
  const [reason, setReason] = useState('titleDispute');
  const [amountText, setAmountText] = useState(kind === 'full' ? formatNaira(currentValue).replace('₦', '').trim() : '');
  const [salvageText, setSalvageText] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reasons = [
    { key: 'titleDispute', label: t('investments.redesign.reasons.titleDispute') },
    { key: 'governmentDemolition', label: t('investments.redesign.reasons.governmentDemolition') },
    { key: 'companyLiquidation', label: t('investments.redesign.reasons.companyLiquidation') },
    { key: 'cryptoCollapse', label: t('investments.redesign.reasons.cryptoCollapse') },
    { key: 'marketDownturn', label: t('investments.redesign.reasons.marketDownturn') },
    { key: 'other', label: t('investments.redesign.reasons.other') },
  ];

  const save = async () => {
    setError(null);
    const parsedLoss = kind === 'full' ? { ok: true, minor: currentValue } : parseAmount(amountText);
    if (!parsedLoss.ok || parsedLoss.minor <= 0n) {
      setError(t('investments.redesign.error.amount'));
      return;
    }
    const salvageParsed = salvageText.trim() ? parseAmount(salvageText) : { ok: true, minor: 0n };
    if (!salvageParsed.ok) {
      setError(t('investments.redesign.error.amount'));
      return;
    }

    setBusy(true);
    try {
      const selectedReason = reasons.find((r) => r.key === reason)?.label ?? reason;
      const r = await repo.writeOffHolding(holding.id, {
        kind,
        amountMinor: parsedLoss.minor,
        salvageMinor: salvageParsed.minor,
        date: today(),
        reason: selectedReason,
        notes: notes.trim() || undefined,
      });
      if (!r.ok) {
        setError(t('investments.redesign.error.save'));
        return;
      }
      toast.show(t('investments.redesign.writeOffRecorded'));
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <RedesignSheet
      visible
      testID="redesign-write-off-sheet"
      title={t('investments.redesign.writeOffTitle')}
      onClose={onClose}
      dirty
      footer={
        <RedesignButton
          testID="redesign-write-off-save"
          label={t('investments.redesign.writeOffAction')}
          kind="secondary"
          onPress={() => void save()}
          disabled={busy}
          fullWidth
        />
      }
    >
      <RedesignText variant="helper" tone="textSecondary">
        {t('investments.redesign.writeOffHelper')}
      </RedesignText>

      <View style={{ gap: sp.xs }}>
        <RedesignText variant="caption" tone="textSecondary">
          {t('investments.redesign.writeOffKind')}
        </RedesignText>
        <View style={{ flexDirection: 'row', gap: sp.xs }}>
          <RedesignChip
            label={t('investments.redesign.fullWriteOff')}
            selected={kind === 'full'}
            onPress={() => {
              setKind('full');
              setAmountText(formatNaira(currentValue).replace('₦', '').trim());
            }}
          />
          <RedesignChip
            label={t('investments.redesign.partialImpairment')}
            selected={kind === 'partial'}
            onPress={() => setKind('partial')}
          />
        </View>
      </View>

      <View style={{ gap: sp.xs }}>
        <RedesignText variant="caption" tone="textSecondary">
          {t('investments.redesign.writeOffReason')}
        </RedesignText>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: sp.xs }}>
          {reasons.map((r) => (
            <RedesignChip
              key={r.key}
              label={r.label}
              selected={reason === r.key}
              onPress={() => setReason(r.key)}
            />
          ))}
        </View>
      </View>

      {kind === 'partial' ? (
        <RedesignField
          testID="redesign-write-off-amount"
          label={t('investments.redesign.amount')}
          value={amountText}
          onChangeText={setAmountText}
          prefix="₦"
          keyboardType="decimal-pad"
          error={error}
        />
      ) : null}

      <RedesignField
        testID="redesign-write-off-salvage"
        label={t('investments.redesign.salvageProceeds')}
        value={salvageText}
        onChangeText={setSalvageText}
        prefix="₦"
        keyboardType="decimal-pad"
        placeholder="0.00"
      />

      <RedesignField
        testID="redesign-write-off-notes"
        label={t('investments.redesign.notes')}
        value={notes}
        onChangeText={setNotes}
        placeholder="What happened and key lessons learned"
      />
    </RedesignSheet>
  );
}

/** Batch valuation modal to quickly type updated numbers for all holdings */
export function RedesignBatchValuationSheet({
  holdings,
  onClose,
}: {
  holdings: { holding: Holding; currentValue: bigint }[];
  onClose: () => void;
}) {
  const { repo } = useWorkspace();
  const toast = useToast();
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      const updates: { holdingId: string; priceMinor: bigint }[] = [];
      for (const [id, text] of Object.entries(values)) {
        if (!text.trim()) continue;
        const p = parseAmount(text);
        if (p.ok && p.minor > 0n) {
          updates.push({ holdingId: id, priceMinor: p.minor });
        }
      }
      if (updates.length > 0) {
        await repo.savePrices(updates, today());
        toast.show(t('investments.redesign.batchSaved'));
      }
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <RedesignSheet
      visible
      testID="redesign-batch-valuation-sheet"
      title={t('investments.redesign.batchValuationTitle')}
      onClose={onClose}
      footer={
        <RedesignButton
          testID="redesign-batch-valuation-save"
          label={t('common.save')}
          onPress={() => void save()}
          disabled={busy}
          fullWidth
        />
      }
    >
      <ScrollView style={{ maxHeight: 380 }}>
        <View style={{ gap: sp.md }}>
          {holdings.map(({ holding, currentValue }) => (
            <View key={holding.id} style={{ gap: sp.xs }}>
              <RedesignText variant="label">{holding.name}</RedesignText>
              <RedesignText variant="caption" tone="textSecondary">
                Current: {formatNaira(currentValue)}
              </RedesignText>
              <RedesignField
                testID={`redesign-batch-val-${holding.id}`}
                label={t('investments.redesign.valueToday')}
                value={values[holding.id] ?? ''}
                onChangeText={(text) => setValues((v) => ({ ...v, [holding.id]: text }))}
                prefix="₦"
                keyboardType="decimal-pad"
                placeholder={formatNaira(currentValue).replace('₦', '').trim()}
              />
            </View>
          ))}
        </View>
      </ScrollView>
    </RedesignSheet>
  );
}

function formatMonthDay(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long' }).format(new Date(Date.UTC(y, m - 1, d)));
}

function today() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lagos' }).format(new Date());
}
