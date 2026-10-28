import * as DocumentPicker from 'expo-document-picker';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { Amount, Button, Checkbox, EmptyState, Footer, formatDay, InlineError, SegmentedControl, Select, Sheet, Switch, Text } from '@/design/components';
import tokens from '@/design/tokens.json';
import type { Account, DateFormat, ImportMapping } from '@/data/workspace/model';
import { useWorkspace } from '@/data/workspace/WorkspaceProvider';
import { guessMapping, isDuplicate, parseCsv, readRows } from '@/features/import/csv';
import { ledgerMessage } from '@/features/transactions/helpers';
import { t } from '@/i18n';

import { suggestMoneyBack } from '@/features/debts/moneyBack';

import { importRulesApplied } from './helpers';

const sp = tokens.spacing;
const NONE = 'none';
const FORMATS: DateFormat[] = ['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD'];

type Step = 'upload' | 'map' | 'review';

async function pickCsv(): Promise<string | null> {
  const result = await DocumentPicker.getDocumentAsync({ type: ['text/csv', 'text/comma-separated-values', 'text/plain'], copyToCacheDirectory: true });
  if (result.canceled) return null;
  const asset = result.assets[0];
  if (!asset) return null;
  if (asset.file) return asset.file.text();
  return (await fetch(asset.uri)).text();
}

/** DESIGN popup #17 — Import file (CSV in Phase 1–2). */
export function AccountImportSheet({
  account,
  initialText,
  onClose,
  onImported,
}: {
  account: Account;
  initialText?: string | null;
  onClose: () => void;
  onImported: (importId: string, count: number) => void;
}) {
  const { snapshot, repo } = useWorkspace();
  const [table, setTable] = useState<string[][] | null>(() => (initialText ? parseCsv(initialText) : null));
  const [step, setStep] = useState<Step>(initialText ? 'map' : 'upload');
  const [mapping, setMapping] = useState<ImportMapping | null>(() => (initialText ? guessMapping(parseCsv(initialText)[0], account.importMapping) : null));
  const [ticked, setTicked] = useState<Map<number, boolean>>(new Map());
  const [categories, setCategories] = useState<Map<number, string>>(new Map());
  /** Per-line money-back choice when a debt person matches (A-13). Default unset = ask via buttons. */
  const [moneyBackChoice, setMoneyBackChoice] = useState<Map<number, 'money_back' | 'income'>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = (text: string) => {
    const parsed = parseCsv(text);
    if (parsed.length === 0) return setError(t('import.emptyFile'));
    setError(null);
    setTable(parsed);
    setMapping(guessMapping(parsed[0], account.importMapping));
    setStep('map');
  };

  const read = useMemo(() => (table && mapping ? readRows(table, mapping) : null), [table, mapping]);
  const payeeNames = useMemo(() => new Map((snapshot?.payees ?? []).map((p) => [p.id, p.name])), [snapshot]);
  const review = useMemo(() => {
    if (!read || !snapshot) return [];
    return read.rows.map((row) => {
      const payee = snapshot.payees.find(
        (p) =>
          p.name.toLowerCase() === row.payee.toLowerCase() ||
          p.aliases?.some((a) => a.toLowerCase() === row.payee.toLowerCase()),
      );
      const amountAbs = row.amount < 0n ? -row.amount : row.amount;
      const moneyBack = suggestMoneyBack(snapshot, {
        amount: amountAbs,
        date: row.date,
        accountId: account.id,
        payeeId: payee?.id,
        payeeName: row.payee,
        movement: row.amount < 0n ? 'expense' : 'income',
      })[0];
      return {
        row,
        duplicate: isDuplicate(row, account.id, snapshot.events, payeeNames),
        suggested: payee?.defaultCategoryId,
        moneyBack,
      };
    });
  }, [read, snapshot, account.id, payeeNames]);

  const columns = (table?.[0] ?? []).map((h, i) => ({ value: String(i), label: mapping?.hasHeader && h.trim() ? h.trim() : t('import.column', { n: i + 1 }) }));
  const optional = [{ value: NONE, label: t('import.notInFile') }, ...columns];
  const pick = (v: number | null) => (v === null ? NONE : String(v));
  const set = (key: keyof ImportMapping) => (v: string) => mapping && setMapping({ ...mapping, [key]: v === NONE ? null : Number(v) });

  const expenseCats = (snapshot?.categories ?? []).filter((c) => c.kind === 'expense');
  const incomeCats = (snapshot?.categories ?? []).filter((c) => c.kind === 'income');
  const isTicked = (line: number, duplicate: boolean) => ticked.get(line) ?? !duplicate;
  const categoryOf = (line: number, out: boolean, suggested?: string) =>
    categories.get(line) ?? suggested ?? (out ? expenseCats[0]?.id : incomeCats[0]?.id) ?? '';
  const chosen = review.filter((r) => isTicked(r.row.line, r.duplicate));
  const counts = {
    fresh: review.filter((r) => !r.duplicate).length,
    duplicates: review.filter((r) => r.duplicate).length,
    rules: snapshot && read ? importRulesApplied(snapshot, read.rows) : 0,
    broken: read?.broken.length ?? 0,
  };

  const post = async () => {
    if (!mapping || !snapshot) return;
    // Require an explicit choice before posting matching rows as money back (TECH-SPEC 6.15).
    for (const item of chosen) {
      if (item.moneyBack && !moneyBackChoice.has(item.row.line)) {
        setError(t('debts.moneyBack.importChoice', { name: item.moneyBack.personName }));
        return;
      }
    }
    setBusy(true);
    setError(null);
    const asIncomeOrExpense = chosen.filter((item) => !item.moneyBack || moneyBackChoice.get(item.row.line) === 'income');
    const asMoneyBack = chosen.filter((item) => item.moneyBack && moneyBackChoice.get(item.row.line) === 'money_back');
    let importId = '';
    let count = 0;
    if (asIncomeOrExpense.length > 0) {
      const r = await repo.importRows(
        account.id,
        asIncomeOrExpense.map(({ row, suggested }) => ({
          date: row.date,
          amount: row.amount,
          categoryId: categoryOf(row.line, row.amount < 0n, suggested),
          payeeName: row.payee,
          notes: row.notes,
        })),
        mapping,
      );
      if (!r.ok) {
        setBusy(false);
        return setError(ledgerMessage(r.error));
      }
      importId = r.value.importId;
      count = r.value.count;
    }
    for (const item of asMoneyBack) {
      const suggestion = item.moneyBack!;
      const confirmed = await repo.confirmMoneyBack(
        {
          debtId: suggestion.debtId,
          amount: suggestion.amount,
          date: suggestion.date,
          accountId: account.id,
          payeeId: suggestion.payeeId,
        },
        'money_back',
      );
      if (!confirmed.ok) {
        setBusy(false);
        return setError(ledgerMessage(confirmed.error));
      }
      count += 1;
    }
    setBusy(false);
    onImported(importId || 'money-back', count);
    onClose();
  };

  const stepLabel = step === 'upload' ? t('import.step.upload') : step === 'map' ? t('import.step.map') : t('import.step.review');

  const footer =
    step === 'upload' ? (
      <Footer>
        <Button kind="secondary" label={t('common.cancel')} onPress={onClose} />
      </Footer>
    ) : step === 'map' ? (
      <Footer>
        <Button kind="secondary" label={t('common.back')} onPress={() => setStep('upload')} />
        <Button testID="import-next" label={t('import.toReview')} disabled={!read || read.rows.length === 0} onPress={() => setStep('review')} />
      </Footer>
    ) : (
      <Footer>
        <Button kind="secondary" label={t('common.back')} onPress={() => setStep('map')} />
        <Button testID="import-post" label={t('import.post', { count: chosen.length })} disabled={chosen.length === 0 || busy} onPress={() => void post()} />
      </Footer>
    );

  return (
    <Sheet visible testID="import-sheet" title={t('import.title', { account: account.name })} onClose={onClose} footer={footer}>
      <View style={{ gap: sp['spacing-lg'] }}>
        <Text variant="caption" tone="textSecondary">
          {stepLabel}
        </Text>
        {step === 'upload' ? (
          <EmptyState
            title={t('import.uploadTitle')}
            body={t('import.uploadBody')}
            actionLabel={t('import.choose')}
            onAction={() =>
              void pickCsv()
                .then((text) => text !== null && load(text))
                .catch(() => setError(t('import.unreadable')))
            }
          />
        ) : null}

        {step === 'map' && mapping && read ? (
          <>
            <Switch testID="import-header" label={t('import.hasHeader')} value={mapping.hasHeader} onChange={(v) => setMapping({ ...mapping, hasHeader: v })} />
            <Select testID="map-date" label={t('import.field.date')} options={columns} value={String(mapping.date)} onChange={(v) => setMapping({ ...mapping, date: Number(v) })} />
            <Select
              testID="map-date-format"
              label={t('import.dateFormat')}
              options={FORMATS.map((f) => ({ value: f, label: t(`import.format.${f}`) }))}
              value={mapping.dateFormat}
              onChange={(v) => setMapping({ ...mapping, dateFormat: v })}
            />
            <SegmentedControl
              testID="map-amount-mode"
              label={t('import.amountMode')}
              options={[
                { value: 'one', label: t('import.oneColumn') },
                { value: 'two', label: t('import.twoColumns') },
              ]}
              value={mapping.amount !== null ? 'one' : 'two'}
              onChange={(v) =>
                setMapping(
                  v === 'one'
                    ? { ...mapping, amount: mapping.moneyOut ?? 1, moneyIn: null, moneyOut: null }
                    : { ...mapping, amount: null, moneyIn: mapping.amount ?? 1, moneyOut: null },
                )
              }
            />
            {mapping.amount !== null ? (
              <Select testID="map-amount" label={t('import.field.amount')} options={columns} value={String(mapping.amount)} onChange={set('amount')} />
            ) : (
              <>
                <Select testID="map-in" label={t('import.field.moneyIn')} options={optional} value={pick(mapping.moneyIn)} onChange={set('moneyIn')} />
                <Select testID="map-out" label={t('import.field.moneyOut')} options={optional} value={pick(mapping.moneyOut)} onChange={set('moneyOut')} />
              </>
            )}
            <Select testID="map-description" label={t('import.field.description')} options={optional} value={pick(mapping.description)} onChange={set('description')} />
            <Select testID="map-payee" label={t('import.field.payee')} options={optional} value={pick(mapping.payee)} onChange={set('payee')} />
            <Select testID="map-notes" label={t('import.field.notes')} options={optional} value={pick(mapping.notes)} onChange={set('notes')} />
            <Text variant="heading-sm" accessibilityRole="header">
              {t('import.preview')}
            </Text>
            <View testID="import-preview" style={{ gap: sp['spacing-xs'] }}>
              {read.rows.slice(0, 10).map((r) => (
                <View key={r.line} style={{ flexDirection: 'row', gap: sp['spacing-md'] }}>
                  <Text style={{ width: 96 }}>{formatDay(r.date)}</Text>
                  <Text style={{ flex: 1 }} numberOfLines={1}>
                    {r.description || r.payee}
                  </Text>
                  <Amount minor={r.amount} signed />
                </View>
              ))}
            </View>
            {read.broken.length > 0 ? (
              <InlineError testID="import-broken" message={t('import.broken', { lines: read.broken.map((b) => b.line).join(', ') })} />
            ) : null}
          </>
        ) : null}

        {step === 'review' ? (
          <>
            <Text testID="import-counts">
              {t('import.countsFull', { fresh: counts.fresh, duplicates: counts.duplicates, rules: counts.rules })}
            </Text>
            {counts.broken > 0 ? <InlineError message={t('import.broken', { lines: read?.broken.map((b) => b.line).join(', ') ?? '' })} /> : null}
            {review.map(({ row, duplicate, suggested, moneyBack }) => {
              const out = row.amount < 0n;
              const ruleApplied = suggested && !duplicate;
              const choice = moneyBackChoice.get(row.line);
              return (
                <View key={row.line} testID={`review-${row.line}`} style={{ gap: sp['spacing-xs'] }}>
                  <Checkbox
                    testID={`review-tick-${row.line}`}
                    label={t('import.rowLabel', { date: formatDay(row.date), description: row.description || row.payee })}
                    checked={isTicked(row.line, duplicate)}
                    onChange={(v) => setTicked(new Map(ticked).set(row.line, v))}
                    caption={duplicate ? t('import.duplicate') : ruleApplied ? t('import.ruleApplied') : undefined}
                  />
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: sp['spacing-md'] }}>
                    <Text style={{ flex: 1, textDecorationLine: duplicate ? 'line-through' : 'none' }} tone="textSecondary">
                      {row.payee}
                    </Text>
                    <Amount minor={row.amount} signed />
                  </View>
                  {moneyBack && !duplicate ? (
                    <View testID={`review-money-back-${row.line}`} style={{ gap: sp['spacing-xs'] }}>
                      <Text variant="caption">{t('debts.moneyBack.importChoice', { name: moneyBack.personName })}</Text>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: sp['spacing-sm'] }}>
                        <Button
                          testID={`review-mb-income-${row.line}`}
                          kind={choice === 'income' ? 'primary-pill' : 'secondary'}
                          size="sm"
                          label={t('debts.moneyBack.choiceIncome')}
                          onPress={() => setMoneyBackChoice(new Map(moneyBackChoice).set(row.line, 'income'))}
                        />
                        <Button
                          testID={`review-mb-back-${row.line}`}
                          kind={choice === 'money_back' ? 'primary-pill' : 'secondary'}
                          size="sm"
                          label={t('debts.moneyBack.choiceMoneyBack')}
                          onPress={() => setMoneyBackChoice(new Map(moneyBackChoice).set(row.line, 'money_back'))}
                        />
                      </View>
                    </View>
                  ) : null}
                  {!moneyBack || choice === 'income' || duplicate ? (
                    <Select
                      testID={`review-cat-${row.line}`}
                      label={t('import.category')}
                      options={(out ? expenseCats : incomeCats).map((c) => ({ value: c.id, label: c.name }))}
                      value={categoryOf(row.line, out, suggested) || null}
                      onChange={(v) => setCategories(new Map(categories).set(row.line, v))}
                    />
                  ) : null}
                </View>
              );
            })}
          </>
        ) : null}
        {error ? <InlineError message={error} /> : null}
      </View>
    </Sheet>
  );
}
