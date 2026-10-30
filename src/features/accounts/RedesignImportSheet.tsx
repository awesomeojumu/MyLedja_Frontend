import * as DocumentPicker from 'expo-document-picker';
import { useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';

import { aiApi, type StatementImport, toBase64 } from '@/api/ai';
import { ApiError } from '@/api/client';
import { useAuth } from '@/features/auth/AuthProvider';
import { useOnline } from '@/lib/useOnline';
import {
  RedesignAmount,
  RedesignButton,
  RedesignCheckbox,
  RedesignDialog,
  RedesignField,
  RedesignInlineError,
  RedesignSegmented,
  RedesignSheet,
  RedesignSwitch,
  RedesignText,
} from '@/design/redesign';
import { redesignTokens as tokens } from '@/design/redesign/theme';
import type { Account, DateFormat, ImportMapping } from '@/data/workspace/model';
import { useWorkspace } from '@/data/workspace/WorkspaceProvider';
import { guessMapping, isDuplicate, parseCsv, readRows } from '@/features/import/csv';
import { t } from '@/i18n';
import { formatNaira } from '@/money';
import { formatDay } from '@/design/components';

import { ALLOWED_EXT, MAX_IMPORT_BYTES, STATEMENT_EXT, STATEMENT_TYPES, statementCsv } from './AccountImportSheet';
import { importRulesApplied } from './helpers';

const sp = tokens.space;
const NONE = 'none';
const FORMATS: DateFormat[] = ['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD'];

type Step = 'upload' | 'map' | 'review' | 'done' | 'unreadable';
type Picked = { kind: 'csv'; text: string } | { kind: 'statement'; fileName: string; base64: string };

async function pickFile(): Promise<{ ok: true; value: Picked } | { ok: false; error: 'type' | 'size' } | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['text/csv', 'text/comma-separated-values', 'text/plain', ...STATEMENT_TYPES],
    copyToCacheDirectory: true,
  });
  if (result.canceled) return null;
  const asset = result.assets[0];
  if (!asset) return null;
  if (
    asset.name &&
    !ALLOWED_EXT.test(asset.name) &&
    asset.mimeType &&
    !['text/csv', 'text/comma-separated-values', 'text/plain', ...STATEMENT_TYPES].includes(asset.mimeType)
  ) {
    return { ok: false, error: 'type' };
  }
  if (typeof asset.size === 'number' && asset.size > MAX_IMPORT_BYTES) return { ok: false, error: 'size' };
  const isStatement = STATEMENT_EXT.test(asset.name) || STATEMENT_TYPES.includes(asset.mimeType ?? '');
  if (!isStatement) {
    const text = asset.file ? await asset.file.text() : await (await fetch(asset.uri)).text();
    return { ok: true, value: { kind: 'csv', text } };
  }
  const buffer = asset.file ? await asset.file.arrayBuffer() : await (await fetch(asset.uri)).arrayBuffer();
  if (buffer.byteLength > MAX_IMPORT_BYTES) return { ok: false, error: 'size' };
  return { ok: true, value: { kind: 'statement', fileName: asset.name, base64: toBase64(new Uint8Array(buffer)) } };
}

/** Figma Phone / Import `10:5052`–`10:5228` — Choose → Match → Review → Done / Could not read. */
export function RedesignImportSheet({
  account,
  initialText,
  initialStatement,
  onClose,
  onImported,
}: {
  account: Account;
  initialText?: string | null;
  initialStatement?: { fileName: string; base64: string } | null;
  onClose: () => void;
  onImported: (importId: string, count: number) => void;
}) {
  const { snapshot, repo } = useWorkspace();
  const { client, user } = useAuth();
  const online = useOnline();
  const ai = useMemo(() => aiApi(client), [client]);
  const [askAi, setAskAi] = useState<{ fileName: string; base64: string } | null>(null);
  const [reading, setReading] = useState(false);
  const [fileName, setFileName] = useState('statement.csv');
  const [table, setTable] = useState<string[][] | null>(() => (initialText ? parseCsv(initialText) : null));
  const [step, setStep] = useState<Step>(initialText ? 'map' : 'upload');
  const [mapping, setMapping] = useState<ImportMapping | null>(() =>
    initialText ? guessMapping(parseCsv(initialText)[0], account.importMapping) : null,
  );
  const [ticked, setTicked] = useState<Map<number, boolean>>(new Map());
  const [categories, setCategories] = useState<Map<number, string>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ importId: string; count: number; rules: number } | null>(null);
  const [showAll, setShowAll] = useState(false);
  const statementBootRef = useRef(false);

  const load = (text: string, name = 'statement.csv') => {
    const parsed = parseCsv(text);
    if (parsed.length === 0) return setError(t('import.emptyFile'));
    setError(null);
    setFileName(name);
    setTable(parsed);
    setMapping(guessMapping(parsed[0], account.importMapping));
    setStep('map');
  };

  const readStatement = async (file: { fileName: string; base64: string }, useAi: boolean) => {
    if (!online || !user) return setError(t('import.statementOffline'));
    setReading(true);
    setError(null);
    try {
      const res = await ai.uploadStatement(user.workspaceId, {
        accountId: account.id,
        fileName: file.fileName,
        fileBase64: file.base64,
        useAi,
      });
      const kept = res.rows.filter((r: StatementImport['rows'][number]) => r.date && r.amount);
      load(statementCsv(res.rows), file.fileName);
      setCategories(new Map(kept.flatMap((r, i) => (r.categoryId ? [[i, r.categoryId] as const] : []))));
    } catch (e) {
      const code = e instanceof ApiError ? e.body?.code : undefined;
      if (!useAi && (code === 'statement_unreadable' || code === 'ai_consent_needed')) {
        const settings = await ai.settings(user.workspaceId).catch(() => null);
        if (settings && (settings.available.claude || settings.available.gemini)) {
          if (settings.consent.statements) return void readStatement(file, true);
          return setAskAi(file);
        }
      }
      setStep('unreadable');
      setError(e instanceof ApiError ? e.body.message : t('redesign.import.unreadableBody'));
    } finally {
      setReading(false);
    }
  };

  const agreeAndRead = async () => {
    const file = askAi;
    setAskAi(null);
    if (!file || !user) return;
    const settings = await ai.settings(user.workspaceId);
    const { updatedAt: _u, ...consent } = settings.consent;
    await ai.setConsent(user.workspaceId, { ...consent, statements: true });
    await readStatement(file, true);
  };

  useEffect(() => {
    if (!initialStatement || statementBootRef.current) return;
    statementBootRef.current = true;
    void readStatement(initialStatement, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialStatement]);

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
      const fromRules = { categoryId: payee?.defaultCategoryId };
      return {
        row,
        duplicate: isDuplicate(row, account.id, snapshot.events, payeeNames),
        suggested: fromRules.categoryId,
      };
    });
  }, [read, snapshot, account.id, payeeNames]);

  const columns = (table?.[0] ?? []).map((h, i) => ({
    value: String(i),
    label: mapping?.hasHeader && h.trim() ? `Column ${String.fromCharCode(65 + i)}, "${h.trim()}"` : t('import.column', { n: i + 1 }),
  }));
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
  };

  const post = async () => {
    if (!mapping || !snapshot) return;
    setBusy(true);
    setError(null);
    const r = await repo.importRows(
      account.id,
      chosen.map(({ row, suggested }) => ({
        date: row.date,
        amount: row.amount,
        categoryId: categoryOf(row.line, row.amount < 0n, suggested),
        payeeName: row.payee,
        notes: row.notes,
      })),
      mapping,
    );
    setBusy(false);
    if (!r.ok) return setError(t('import.failedPartial'));
    const result = { importId: r.value.importId, count: r.value.count, rules: counts.rules };
    setDone(result);
    setStep('done');
    onImported(result.importId, result.count);
  };

  const chooseFile = () =>
    void pickFile()
      .then((picked) => {
        if (!picked) return;
        if (!picked.ok) {
          setStep('unreadable');
          setError(picked.error === 'size' ? t('import.tooBig') : t('redesign.import.unreadableBody'));
          return;
        }
        if (picked.value.kind === 'csv') load(picked.value.text);
        else void readStatement({ fileName: picked.value.fileName, base64: picked.value.base64 }, false);
      })
      .catch(() => {
        setStep('unreadable');
        setError(t('redesign.import.unreadableBody'));
      });

  const sheetTitle =
    step === 'upload'
      ? t('redesign.import.title')
      : step === 'map'
        ? t('redesign.import.matchTitle')
        : step === 'review'
          ? t('redesign.import.reviewTitle')
          : step === 'done'
            ? t('redesign.import.doneTitle', { count: done?.count ?? 0 })
            : t('redesign.import.unreadableTitle');

  const footer =
    step === 'upload' ? (
      <View style={{ gap: sp.sm }}>
        <RedesignButton testID="import-choose" label={t('redesign.import.chooseFile')} onPress={chooseFile} fullWidth />
        <RedesignButton testID="import-how" kind="secondary" label={t('redesign.import.howToGet')} onPress={() => undefined} fullWidth />
      </View>
    ) : step === 'map' ? (
      <RedesignButton
        testID="import-next"
        label={t('redesign.import.continue')}
        disabled={!read || read.rows.length === 0}
        onPress={() => setStep('review')}
        fullWidth
      />
    ) : step === 'review' ? (
      <RedesignButton
        testID="import-post"
        label={t('redesign.import.importCount', { count: chosen.length })}
        disabled={chosen.length === 0 || busy}
        onPress={() => void post()}
        fullWidth
      />
    ) : step === 'done' && done ? (
      <View style={{ gap: sp.sm }}>
        <RedesignButton
          testID="import-sort-now"
          label={t('redesign.import.sortNow')}
          onPress={onClose}
          fullWidth
        />
        <RedesignButton testID="import-done-close" kind="secondary" label={t('redesign.import.later')} onPress={onClose} fullWidth />
      </View>
    ) : (
      <View style={{ gap: sp.sm }}>
        <RedesignButton testID="import-choose-another" label={t('redesign.import.chooseAnother')} onPress={() => { setStep('upload'); setError(null); chooseFile(); }} fullWidth />
        <RedesignButton testID="import-get-help" kind="secondary" label={t('redesign.import.getHelp')} onPress={onClose} fullWidth />
      </View>
    );

  const previewRows = showAll ? review : review.slice(0, 4);

  return (
    <>
      <RedesignSheet visible testID="import-sheet" title={sheetTitle} onClose={onClose} footer={footer}>
        <View style={{ gap: sp.lg }}>
          {step === 'upload' ? (
            <>
              <RedesignText tone="textSecondary">{t('redesign.import.uploadBody')}</RedesignText>
              <RedesignText variant="label">{t('redesign.import.addToAccount')}</RedesignText>
              <RedesignText>{account.name}</RedesignText>
              {reading ? <RedesignText tone="textSecondary">{t('import.reading')}</RedesignText> : null}
            </>
          ) : null}

          {step === 'map' && mapping && read ? (
            <>
              <RedesignText tone="textSecondary">
                {t('redesign.import.matchHint', { file: fileName, rows: read.rows.length })}
              </RedesignText>
              <RedesignSwitch
                testID="import-header"
                label={t('import.hasHeader')}
                value={mapping.hasHeader}
                onChange={(v) => setMapping({ ...mapping, hasHeader: v })}
              />
              <MapSelect
                testID="map-date"
                label={t('import.field.date')}
                options={columns}
                value={String(mapping.date)}
                onChange={(v) => setMapping({ ...mapping, date: Number(v) })}
              />
              <MapSelect
                testID="map-description"
                label={t('import.field.description')}
                options={optional}
                value={pick(mapping.description)}
                onChange={set('description')}
              />
              <RedesignSegmented
                testID="map-amount-mode"
                value={mapping.amount !== null ? 'one' : 'two'}
                onChange={(v) =>
                  setMapping(
                    v === 'one'
                      ? { ...mapping, amount: mapping.moneyOut ?? 1, moneyIn: null, moneyOut: null }
                      : { ...mapping, amount: null, moneyIn: mapping.amount ?? 1, moneyOut: null },
                  )
                }
                options={[
                  { key: 'one', label: t('import.oneColumn') },
                  { key: 'two', label: t('import.twoColumns') },
                ]}
              />
              {mapping.amount !== null ? (
                <MapSelect testID="map-amount" label={t('import.field.amount')} options={columns} value={String(mapping.amount)} onChange={set('amount')} />
              ) : (
                <>
                  <MapSelect testID="map-out" label={t('import.field.moneyOut')} options={optional} value={pick(mapping.moneyOut)} onChange={set('moneyOut')} />
                  <MapSelect testID="map-in" label={t('import.field.moneyIn')} options={optional} value={pick(mapping.moneyIn)} onChange={set('moneyIn')} />
                </>
              )}
              <MapSelect
                testID="map-date-format"
                label={t('import.dateFormat')}
                options={FORMATS.map((f) => ({ value: f, label: t(`import.format.${f}`) }))}
                value={mapping.dateFormat}
                onChange={(v) => setMapping({ ...mapping, dateFormat: v as DateFormat })}
              />
              <RedesignText variant="label">{t('import.preview')}</RedesignText>
              <View testID="import-preview" style={{ gap: sp.xs }}>
                {read.rows.slice(0, 3).map((r) => (
                  <View key={r.line} style={{ flexDirection: 'row', gap: sp.md, alignItems: 'center' }}>
                    <RedesignText style={{ width: 88 }}>{formatDay(r.date)}</RedesignText>
                    <RedesignText style={{ flex: 1 }} numberOfLines={1}>
                      {r.description || r.payee}
                    </RedesignText>
                    <RedesignAmount text={formatNaira(r.amount, { signed: true })} />
                  </View>
                ))}
              </View>
            </>
          ) : null}

          {step === 'review' ? (
            <>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: sp.lg }}>
                <Stat label={t('redesign.import.statNew')} value={String(counts.fresh)} />
                <Stat label={t('redesign.import.statDupes')} value={String(counts.duplicates)} />
                <Stat label={t('redesign.import.statRules')} value={String(counts.rules)} />
              </View>
              <RedesignText variant="label">{t('redesign.import.newTransactions')}</RedesignText>
              {previewRows.map(({ row, duplicate, suggested }) => (
                <View key={row.line} testID={`review-${row.line}`} style={{ gap: sp.xs }}>
                  <RedesignCheckbox
                    testID={`review-tick-${row.line}`}
                    label={`${row.description || row.payee}, ${formatNaira(row.amount, { signed: true })}`}
                    checked={isTicked(row.line, duplicate)}
                    onChange={(v) => setTicked(new Map(ticked).set(row.line, v))}
                    caption={duplicate ? t('import.duplicate') : suggested ? t('import.ruleApplied') : undefined}
                  />
                </View>
              ))}
              {review.length > 4 && !showAll ? (
                <RedesignButton
                  testID="import-show-all"
                  kind="link"
                  label={t('redesign.import.showAll', { count: counts.fresh })}
                  onPress={() => setShowAll(true)}
                />
              ) : null}
            </>
          ) : null}

          {step === 'done' && done ? (
            <RedesignText tone="textSecondary">
              {t('redesign.import.doneBody', {
                sorted: done.rules,
                need: Math.max(0, done.count - done.rules),
              })}
            </RedesignText>
          ) : null}

          {step === 'unreadable' ? (
            <RedesignText tone="textSecondary">{error ?? t('redesign.import.unreadableBody')}</RedesignText>
          ) : null}

          {error && step !== 'unreadable' ? <RedesignInlineError message={error} /> : null}
        </View>
      </RedesignSheet>
      <RedesignDialog
        visible={askAi !== null}
        title={t('import.aiConsentTitle')}
        body={t('import.aiConsentBody')}
        confirmLabel={t('import.aiConsentConfirm')}
        onConfirm={() => void agreeAndRead().catch(() => setError(t('import.unreadable')))}
        onCancel={() => setAskAi(null)}
      />
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ minWidth: 96, gap: 2 }}>
      <RedesignText variant="caption" tone="textSecondary">
        {label}
      </RedesignText>
      <RedesignText variant="headline">{value}</RedesignText>
    </View>
  );
}

/** Compact column picker using RedesignField pressable options list. */
function MapSelect({
  label,
  options,
  value,
  onChange,
  testID,
}: {
  label: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
  testID?: string;
}) {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value)?.label ?? t('redesign.accounts.chooseOption');
  return (
    <>
      <RedesignField
        testID={testID}
        label={label}
        value={current}
        editable={false}
        onPress={() => setOpen(true)}
        placeholder={t('redesign.accounts.chooseOption')}
      />
      {open ? (
        <RedesignSheet visible title={label} onClose={() => setOpen(false)}>
          {options.map((o) => (
            <RedesignCheckbox
              key={o.value}
              testID={testID ? `${testID}-opt-${o.value}` : undefined}
              label={o.label}
              checked={o.value === value}
              onChange={() => {
                onChange(o.value);
                setOpen(false);
              }}
            />
          ))}
        </RedesignSheet>
      ) : null}
    </>
  );
}
