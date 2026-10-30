import { useMemo, useState, type ReactNode } from 'react';
import { Image, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';

import type { Payee } from '@/data/workspace/model';
import { useWorkspace } from '@/data/workspace/WorkspaceProvider';
import { useDesign } from '@/design/ThemeProvider';
import { formatDay, useToast } from '@/design/components';
import {
  RedesignAmount,
  RedesignButton,
  RedesignCheckbox,
  RedesignChip,
  RedesignDialog,
  RedesignField,
  RedesignIcon,
  RedesignInlineError,
  RedesignListRow,
  RedesignSheet,
  RedesignText,
} from '@/design/redesign';
import { redesignLight as theme, redesignTokens as tokens } from '@/design/redesign/theme';
import { t } from '@/i18n';
import { formatNaira } from '@/money';
import { ruleFromPayee, payeeMonogram } from '@/features/rules/helpers';
import { ledgerMessage, today } from '@/features/transactions/helpers';

import {
  aliasOwner,
  applyPayeeChipFilter,
  debtForPayee,
  payeeRowSubtitle,
  payeeRows,
  payeeTransactions,
  yearOf,
  type PayeeChipFilter,
  type PayeeRow,
} from './helpers';
import { pickImageUri } from './pickMedia';

const sp = tokens.space;
const shape = tokens.shape;
const size = tokens.size;
const density = tokens.density.touch;

function paramId(raw: string | string[] | undefined): string | undefined {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return v || undefined;
}

function timesLabel(n: number) {
  return n === 1 ? t('payees.redesign.once') : t('payees.redesign.times', { count: n });
}

/**
 * Page 24 Payees redesign (Figma Mobile Phone / Payees 6:2230, Payee 8:3481,
 * Rename 12:5589, Merge 12:5666, Empty 13:6372). Flagged via EXPO_PUBLIC_REDESIGN.
 */
export function RedesignPayeesScreen() {
  const { snapshot, repo } = useWorkspace();
  const toast = useToast();
  const router = useRouter();
  const params = useLocalSearchParams<{ payee?: string; merge?: string }>();
  const year = yearOf(today());
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [chip, setChip] = useState<PayeeChipFilter>('all');
  const [error, setError] = useState<string | null>(null);
  const [renameOpen, setRenameOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const rows = useMemo(() => {
    if (!snapshot) return null;
    const q = query.trim().toLowerCase();
    const filtered = payeeRows(snapshot, year).filter((r) => {
      if (!q) return true;
      return (
        r.payee.name.toLowerCase().includes(q) ||
        r.defaultCategoryName.toLowerCase().includes(q) ||
        (r.payee.aliases ?? []).some((a) => a.toLowerCase().includes(q))
      );
    });
    return applyPayeeChipFilter(filtered, chip);
  }, [snapshot, year, query, chip]);

  const selected = useMemo(() => {
    const id = paramId(params.payee);
    if (!id || !snapshot) return null;
    return snapshot.payees.find((p) => p.id === id) ?? null;
  }, [params.payee, snapshot]);

  const mergeIds = useMemo(() => {
    const raw = paramId(params.merge);
    if (!raw) return [] as string[];
    return raw.split(',').filter(Boolean);
  }, [params.merge]);
  const mergeOpen = mergeIds.length >= 2;

  const openPayee = (payee: Payee) => router.setParams({ payee: payee.id, merge: undefined });
  const closePayee = () => router.setParams({ payee: undefined });
  const openMerge = (list: Payee[]) => {
    if (list.length < 2) return;
    router.setParams({ merge: list.map((p) => p.id).join(','), payee: undefined });
  };
  const closeMerge = () => router.setParams({ merge: undefined });

  const selectedRow = useMemo(() => {
    if (!selected || !snapshot) return null;
    return payeeRows(snapshot, year).find((r) => r.payee.id === selected.id) ?? null;
  }, [selected, snapshot, year]);

  const savePayee = async (p: Payee) => {
    setError(null);
    for (const alias of p.aliases ?? []) {
      const owner = snapshot ? aliasOwner(snapshot, alias, p.id) : undefined;
      if (owner) return { ok: false as const, aliasConflict: owner.name };
    }
    const r = await repo.updatePayee(p);
    if (!r.ok) return { ok: false as const };
    toast.show(t('payees.saved'));
    return { ok: true as const };
  };

  const openCreateRule = async (payee: Payee) => {
    if (!snapshot) return;
    const draft = ruleFromPayee(payee.name, payee.defaultCategoryId);
    const rule = await repo.createRule({ ...draft, order: snapshot.rules.length });
    closePayee();
    router.push(`/rules?edit=${rule.id}`);
  };

  if (mergeOpen && snapshot) {
    const list = mergeIds.map((id) => snapshot.payees.find((p) => p.id === id)).filter(Boolean) as Payee[];
    if (list.length >= 2) {
      return (
        <RedesignMergeView
          snapshotPayees={snapshot.payees}
          initial={list}
          year={year}
          rows={payeeRows(snapshot, year)}
          onBack={closeMerge}
          onMerge={async (keepId, ids, keepName) => {
            setError(null);
            const keep = snapshot.payees.find((p) => p.id === keepId);
            if (keep && keep.name !== keepName.trim() && keepName.trim()) {
              await repo.updatePayee({ ...keep, name: keepName.trim() });
            }
            const r = await repo.mergePayees(keepId, ids, {
              nameId: keepId,
              logoId: keepId,
              categoryId: keepId,
            });
            if (r.ok) {
              toast.show(t('payees.merged'), () => {
                void repo.undoMergePayees(r.value.mergeId).then(() => toast.show(t('common.undo')));
              });
              closeMerge();
              return;
            }
            setError(ledgerMessage(r.error));
          }}
          error={error}
        />
      );
    }
  }

  if (selected && snapshot && selectedRow) {
    return (
      <RedesignPayeeDetail
        payee={selected}
        row={selectedRow}
        snapshot={snapshot}
        error={error}
        renameOpen={renameOpen}
        setRenameOpen={setRenameOpen}
        menuOpen={menuOpen}
        setMenuOpen={setMenuOpen}
        categoryOpen={categoryOpen}
        setCategoryOpen={setCategoryOpen}
        confirmDelete={confirmDelete}
        setConfirmDelete={setConfirmDelete}
        onBack={closePayee}
        onSave={savePayee}
        onCreateRule={() => void openCreateRule(selected)}
        onMergeWith={() => {
          const others = snapshot.payees.filter((p) => p.id !== selected.id);
          openMerge([selected, ...others]);
        }}
        onDelete={async () => {
          const r = await repo.deletePayee(selected.id);
          if (!r.ok) {
            setError(t('payees.deleteHasTx'));
            return false;
          }
          toast.show(t('payees.deleted'));
          return true;
        }}
      />
    );
  }

  return (
    <SafeAreaView testID="redesign-payees" style={{ flex: 1, backgroundColor: theme.page }} edges={['top', 'bottom']}>
      <StackTopBar
        title={t('payees.title')}
        onBack={() => router.back()}
        trailing={
          <Pressable
            testID="payees-search-toggle"
            accessibilityRole="button"
            accessibilityLabel={t('payees.search')}
            onPress={() => setSearchOpen((v) => !v)}
            style={{ width: density.minTarget, height: density.minTarget, alignItems: 'center', justifyContent: 'center' }}
          >
            <RedesignIcon name="search" size={size['icon-lg']} color={theme.text} />
          </Pressable>
        }
      />
      <ScrollView contentContainerStyle={{ padding: sp.lg, gap: sp.lg, paddingBottom: sp.xxl }}>
        {searchOpen ? (
          <RedesignField
            testID="payees-search"
            label={t('payees.search')}
            value={query}
            onChangeText={setQuery}
            autoFocus
            autoCapitalize="none"
          />
        ) : null}

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: sp.sm }}>
          {(
            [
              { key: 'all', label: t('payees.redesign.chipAll') },
              { key: 'mostUsed', label: t('payees.redesign.chipMostUsed') },
              { key: 'notSorted', label: t('payees.redesign.chipNotSorted') },
            ] as const
          ).map((c) => (
            <RedesignChip
              key={c.key}
              testID={`payees-chip-${c.key}`}
              label={c.label}
              selected={chip === c.key}
              onPress={() => setChip(c.key)}
            />
          ))}
        </ScrollView>

        {error ? <RedesignInlineError message={error} /> : null}

        {!rows ? (
          <View style={{ height: 120, borderRadius: shape['radius-lg'], backgroundColor: theme.surfaceMuted }} />
        ) : rows.length === 0 && !query && chip === 'all' ? (
          <EmptyPayees />
        ) : rows.length === 0 ? (
          <View
            style={{
              backgroundColor: theme.surface,
              borderRadius: shape['radius-lg'],
              borderWidth: 1,
              borderColor: theme.border,
              padding: sp.xl,
            }}
          >
            <RedesignText tone="textSecondary" style={{ textAlign: 'center' }}>
              {t('payees.redesign.noMatches')}
            </RedesignText>
          </View>
        ) : (
          <View
            testID="payees-list"
            style={{
              backgroundColor: theme.surface,
              borderRadius: shape['radius-lg'],
              borderWidth: 1,
              borderColor: theme.border,
              paddingVertical: sp.xs,
              overflow: 'hidden',
            }}
          >
            {rows.map((row) => (
              <PayeeListRow key={row.payee.id} row={row} onPress={() => openPayee(row.payee)} />
            ))}
          </View>
        )}

        {rows && rows.length > 0 ? (
          <RedesignText variant="helper" tone="textSecondary" style={{ textAlign: 'center' }}>
            {t('payees.redesign.listHint')}
          </RedesignText>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function StackTopBar({
  title,
  onBack,
  trailing,
}: {
  title: string;
  onBack: () => void;
  trailing?: ReactNode;
}) {
  return (
    <View
      testID="redesign-payees-top-bar"
      style={{
        minHeight: Math.max(size['top-bar'], tokens.frame.topBarHeadroom),
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: sp.sm,
        backgroundColor: theme.surface,
        borderBottomWidth: 1,
        borderColor: theme.border,
        gap: sp.xs,
      }}
    >
      <Pressable
        testID="payees-back"
        accessibilityRole="button"
        accessibilityLabel={t('common.back')}
        onPress={onBack}
        style={{ width: density.minTarget, height: density.minTarget, alignItems: 'center', justifyContent: 'center' }}
      >
        <RedesignIcon name="arrow-left" size={size['icon-lg']} color={theme.text} />
      </Pressable>
      <RedesignText variant="headline" accessibilityRole="header" style={{ flex: 1 }} numberOfLines={1}>
        {title}
      </RedesignText>
      {trailing ?? <View style={{ width: density.minTarget }} />}
    </View>
  );
}

function PayeeListRow({ row, onPress }: { row: PayeeRow; onPress: () => void }) {
  const { privacy } = useDesign();
  const subtitle = payeeRowSubtitle(row, t('payees.redesign.chipNotSorted'), timesLabel);
  const spent = row.spentThisYear;
  const trailing = privacy
    ? undefined
    : spent > 0n
      ? formatNaira(-spent)
      : formatNaira(0n);
  return (
    <RedesignListRow
      testID={`payee-row-${row.payee.id}`}
      title={row.payee.name}
      subtitle={subtitle}
      trailing={trailing}
      onPress={onPress}
    />
  );
}

function EmptyPayees() {
  return (
    <View
      testID="payees-empty"
      style={{
        backgroundColor: theme.surface,
        borderRadius: shape['radius-lg'],
        borderWidth: 1,
        borderColor: theme.border,
        paddingVertical: sp.xxl,
        paddingHorizontal: sp.xl,
        alignItems: 'center',
        gap: sp.md,
      }}
    >
      <View
        style={{
          width: 48,
          height: 48,
          borderRadius: 24,
          backgroundColor: theme.primarySoft,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <RedesignIcon name="users" size={size['icon-lg']} color={theme.text} />
      </View>
      <RedesignText variant="label">{t('payees.emptyTitle')}</RedesignText>
      <RedesignText variant="helper" tone="textSecondary" style={{ textAlign: 'center' }}>
        {t('payees.redesign.emptyBody')}
      </RedesignText>
    </View>
  );
}

function RedesignPayeeDetail({
  payee,
  row,
  snapshot,
  error,
  renameOpen,
  setRenameOpen,
  menuOpen,
  setMenuOpen,
  categoryOpen,
  setCategoryOpen,
  confirmDelete,
  setConfirmDelete,
  onBack,
  onSave,
  onCreateRule,
  onMergeWith,
  onDelete,
}: {
  payee: Payee;
  row: PayeeRow;
  snapshot: NonNullable<ReturnType<typeof useWorkspace>['snapshot']>;
  error: string | null;
  renameOpen: boolean;
  setRenameOpen: (v: boolean) => void;
  menuOpen: boolean;
  setMenuOpen: (v: boolean) => void;
  categoryOpen: boolean;
  setCategoryOpen: (v: boolean) => void;
  confirmDelete: boolean;
  setConfirmDelete: (v: boolean) => void;
  onBack: () => void;
  onSave: (p: Payee) => Promise<{ ok: boolean; aliasConflict?: string }>;
  onCreateRule: () => void;
  onMergeWith: () => void;
  onDelete: () => Promise<boolean>;
}) {
  const router = useRouter();
  const { privacy } = useDesign();
  const [name, setName] = useState(payee.name);
  const [renameDraft, setRenameDraft] = useState(payee.name);
  const [categoryId, setCategoryId] = useState(payee.defaultCategoryId ?? '');
  const [aliases, setAliases] = useState<string[]>(payee.aliases ?? []);
  const [logoUri, setLogoUri] = useState(payee.logoUri ?? '');
  const [newAlias, setNewAlias] = useState('');
  const [aliasError, setAliasError] = useState<string | null>(null);

  const categories = snapshot.categories.filter((c) => c.kind === 'expense' && !c.hidden);
  const categoryName =
    categories.find((c) => c.id === categoryId)?.name ?? t('payees.redesign.chipNotSorted');
  const txns = useMemo(() => payeeTransactions(snapshot, payee.id, 10), [snapshot, payee.id]);
  const linkedDebt = useMemo(() => debtForPayee(snapshot, payee.id), [snapshot, payee.id]);
  const avg =
    row.txCount > 0 && row.spentThisYear > 0n ? row.spentThisYear / BigInt(row.txCount) : 0n;

  const persist = async (next: Partial<Payee>) => {
    const body: Payee = {
      ...payee,
      name: (next.name ?? name).trim() || payee.name,
      defaultCategoryId: next.defaultCategoryId !== undefined ? next.defaultCategoryId || undefined : categoryId || undefined,
      aliases: next.aliases ?? aliases,
      logoUri: next.logoUri !== undefined ? next.logoUri || undefined : logoUri || undefined,
    };
    const r = await onSave(body);
    if (!r.ok && r.aliasConflict) {
      setAliasError(t('payees.aliasTaken', { name: r.aliasConflict }));
      return false;
    }
    setAliasError(null);
    return true;
  };

  const addAlias = async () => {
    const value = newAlias.trim();
    if (!value) return;
    const owner = aliasOwner(snapshot, value, payee.id);
    if (owner) {
      setAliasError(t('payees.aliasTaken', { name: owner.name }));
      return;
    }
    if (aliases.some((a) => a.toLowerCase() === value.toLowerCase())) {
      setNewAlias('');
      return;
    }
    const next = [...aliases, value];
    setAliases(next);
    setNewAlias('');
    await persist({ aliases: next });
  };

  const saveRename = async () => {
    const next = renameDraft.trim();
    if (!next) return;
    setName(next);
    const ok = await persist({ name: next });
    if (ok) setRenameOpen(false);
  };

  const changeLogo = async (camera = false) => {
    setMenuOpen(false);
    const uri = await pickImageUri({ camera });
    if (!uri) return;
    setLogoUri(uri);
    await persist({ logoUri: uri });
  };

  return (
    <SafeAreaView testID="redesign-payee-detail" style={{ flex: 1, backgroundColor: theme.page }} edges={['top', 'bottom']}>
      <StackTopBar
        title={name}
        onBack={onBack}
        trailing={
          <Pressable
            testID="payee-menu-open"
            accessibilityRole="button"
            accessibilityLabel={t('common.options')}
            onPress={() => setMenuOpen(true)}
            style={{ width: density.minTarget, height: density.minTarget, alignItems: 'center', justifyContent: 'center' }}
          >
            <RedesignIcon name="more" size={size['icon-lg']} color={theme.text} />
          </Pressable>
        }
      />
      <ScrollView contentContainerStyle={{ padding: sp.lg, gap: sp.lg, paddingBottom: sp.xl * 2 }}>
        {error ? <RedesignInlineError message={error} /> : null}

        <View
          testID="payee-spent-card"
          style={{
            backgroundColor: theme.surface,
            borderRadius: shape['radius-lg'],
            borderWidth: 1,
            borderColor: theme.border,
            padding: sp.lg,
            gap: sp.sm,
          }}
        >
          <RedesignText variant="helper" tone="textSecondary">
            {t('payees.redesign.spentHere')}
          </RedesignText>
          <RedesignAmount
            testID="payee-spent-year"
            text={formatNaira(row.spentThisYear)}
            hidden={privacy}
            sizeVariant="display"
          />
          <RedesignText variant="helper" tone="textSecondary">
            {t('payees.redesign.visitsAbout', {
              count: row.txCount,
              avg: privacy ? '••••' : formatNaira(avg),
            })}
          </RedesignText>
        </View>

        <Pressable
          testID="payee-name"
          accessibilityRole="button"
          accessibilityLabel={t('payees.name')}
          onPress={() => {
            setRenameDraft(name);
            setRenameOpen(true);
          }}
        >
          <View pointerEvents="none">
            <RedesignField label={t('payees.name')} value={name} onChangeText={() => undefined} />
          </View>
        </Pressable>

        <Pressable
          testID="payee-category"
          accessibilityRole="button"
          accessibilityLabel={t('payees.defaultCategoryLabel')}
          onPress={() => setCategoryOpen(true)}
        >
          <View style={{ gap: sp.xs }}>
            <RedesignText variant="label">{t('payees.defaultCategoryLabel')}</RedesignText>
            <View
              style={{
                minHeight: size['control-lg'],
                borderWidth: 1,
                borderColor: theme.borderStrong,
                borderRadius: shape['radius-md'],
                paddingHorizontal: sp.md,
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: theme.surface,
                gap: sp.sm,
              }}
            >
              <RedesignText style={{ flex: 1 }}>{categoryName}</RedesignText>
              <RedesignIcon name="chevron-down" size={size['icon-lg']} color={theme.text} />
            </View>
          </View>
        </Pressable>

        <View style={{ gap: sp.sm }}>
          <RedesignText variant="label">{t('payees.aliases')}</RedesignText>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: sp.xs }}>
            {aliases.map((a) => (
              <RedesignChip
                key={a}
                testID={`payee-alias-${a}`}
                label={`${a} ×`}
                onPress={() => {
                  const next = aliases.filter((x) => x !== a);
                  setAliases(next);
                  void persist({ aliases: next });
                }}
              />
            ))}
          </View>
          <RedesignField
            testID="payee-alias-input"
            label={t('payees.addAlias')}
            value={newAlias}
            onChangeText={(v) => {
              setNewAlias(v);
              setAliasError(null);
            }}
            onSubmitEditing={() => void addAlias()}
            autoCapitalize="none"
          />
          <RedesignButton testID="payee-alias-add" kind="secondary" label={t('payees.addAliasButton')} onPress={() => void addAlias()} />
          {aliasError ? (
            <View testID="payee-alias-error">
              <RedesignInlineError message={aliasError} />
            </View>
          ) : null}
        </View>

        {linkedDebt ? (
          <Pressable testID="payee-linked-debt" accessibilityRole="button" onPress={() => router.push(`/debts/${linkedDebt.id}`)}>
            <View
              style={{
                backgroundColor: theme.surface,
                borderRadius: shape['radius-lg'],
                borderWidth: 1,
                borderColor: theme.border,
                padding: sp.lg,
                gap: sp.xs,
              }}
            >
              <RedesignText variant="label">{t('payees.linkedPerson')}</RedesignText>
              <RedesignText tone="textSecondary">{linkedDebt.name}</RedesignText>
            </View>
          </Pressable>
        ) : null}

        {txns.length ? (
          <View style={{ gap: sp.sm }}>
            <RedesignText variant="helper" tone="textSecondary">
              {t('payees.redesign.recent')}
            </RedesignText>
            <View
              style={{
                backgroundColor: theme.surface,
                borderRadius: shape['radius-lg'],
                borderWidth: 1,
                borderColor: theme.border,
                paddingVertical: sp.xs,
              }}
            >
              {txns.map((txn) => (
                <RedesignListRow
                  key={txn.id}
                  testID={`payee-tx-${txn.id}`}
                  title={formatDay(txn.date)}
                  subtitle={txn.accountName || txn.category}
                  trailing={privacy ? undefined : formatNaira(txn.amount)}
                  onPress={() => router.push(`/transactions?tx=${txn.id}`)}
                />
              ))}
            </View>
            <RedesignButton
              testID="payee-see-all"
              kind="link"
              label={t('payees.seeAll')}
              onPress={() => router.push(`/transactions?payee=${payee.id}`)}
            />
          </View>
        ) : null}

        <RedesignButton
          testID="payee-merge-with"
          kind="link"
          label={t('payees.redesign.mergeWith')}
          onPress={onMergeWith}
        />
      </ScrollView>

      <RedesignSheet visible={renameOpen} title={t('payees.redesign.renameTitle')} onClose={() => setRenameOpen(false)} testID="payee-rename-sheet">
        <RedesignField testID="payee-rename-input" label={t('payees.name')} value={renameDraft} onChangeText={setRenameDraft} autoFocus />
        <RedesignText variant="helper" tone="textSecondary">
          {t('payees.redesign.renameHint', { count: row.txCount, name: payee.name })}
        </RedesignText>
        <RedesignButton testID="payee-rename-save" label={t('common.save')} onPress={() => void saveRename()} fullWidth />
      </RedesignSheet>

      <RedesignSheet visible={categoryOpen} title={t('payees.defaultCategoryLabel')} onClose={() => setCategoryOpen(false)} testID="payee-category-sheet">
        <Pressable
          testID="payee-category-none"
          accessibilityRole="button"
          onPress={() => {
            setCategoryId('');
            setCategoryOpen(false);
            void persist({ defaultCategoryId: '' });
          }}
          style={{ minHeight: density.minTarget, justifyContent: 'center' }}
        >
          <RedesignText>{t('payees.redesign.chipNotSorted')}</RedesignText>
        </Pressable>
        {categories.map((c) => (
          <Pressable
            key={c.id}
            testID={`payee-category-option-${c.id}`}
            accessibilityRole="button"
            onPress={() => {
              setCategoryId(c.id);
              setCategoryOpen(false);
              void persist({ defaultCategoryId: c.id });
            }}
            style={{ minHeight: density.minTarget, justifyContent: 'center' }}
          >
            <RedesignText>{c.name}</RedesignText>
          </Pressable>
        ))}
      </RedesignSheet>

      <RedesignSheet visible={menuOpen} title={name} onClose={() => setMenuOpen(false)} testID="payee-menu">
        <RedesignButton
          kind="link"
          label={t('payees.redesign.renameTitle')}
          onPress={() => {
            setMenuOpen(false);
            setRenameDraft(name);
            setRenameOpen(true);
          }}
        />
        <RedesignButton kind="link" label={t('payees.changeLogo')} onPress={() => void changeLogo(false)} />
        <RedesignButton kind="link" label={t('payees.takePhoto')} onPress={() => void changeLogo(true)} />
        {logoUri ? (
          <RedesignButton
            kind="link"
            label={t('payees.removeLogo')}
            onPress={() => {
              setLogoUri('');
              setMenuOpen(false);
              void persist({ logoUri: '' });
            }}
          />
        ) : null}
        <RedesignButton
          kind="link"
          label={t('payees.createRule')}
          testID="payee-create-rule"
          onPress={() => {
            setMenuOpen(false);
            onCreateRule();
          }}
        />
        <RedesignButton
          kind="link"
          label={t('payees.redesign.mergeWith')}
          onPress={() => {
            setMenuOpen(false);
            onMergeWith();
          }}
        />
        <RedesignButton
          kind="link"
          label={t('payees.deletePayee')}
          testID="payee-delete"
          onPress={() => {
            setMenuOpen(false);
            if (row.txCount > 0) onMergeWith();
            else setConfirmDelete(true);
          }}
        />
        {logoUri && !logoUri.startsWith('mono://') ? (
          <Image source={{ uri: logoUri }} style={{ width: 48, height: 48, borderRadius: 24 }} accessibilityIgnoresInvertColors />
        ) : (
          <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: theme.surfaceMuted, alignItems: 'center', justifyContent: 'center' }}>
            <RedesignText variant="label">{payeeMonogram(name)}</RedesignText>
          </View>
        )}
      </RedesignSheet>

      <RedesignDialog
        visible={confirmDelete}
        title={t('payees.deleteTitle', { name: payee.name })}
        body={t('payees.deleteBody')}
        confirmLabel={t('payees.deletePayee')}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => {
          setConfirmDelete(false);
          void onDelete().then((ok) => {
            if (ok) onBack();
          });
        }}
        destructive
      />
    </SafeAreaView>
  );
}

function RedesignMergeView({
  snapshotPayees,
  initial,
  year,
  rows,
  onBack,
  onMerge,
  error,
}: {
  snapshotPayees: Payee[];
  initial: Payee[];
  year: number;
  rows: PayeeRow[];
  onBack: () => void;
  onMerge: (keepId: string, mergeIds: string[], keepName: string) => Promise<void>;
  error: string | null;
}) {
  void year;
  void snapshotPayees;
  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of rows) map.set(r.payee.id, r.txCount);
    return map;
  }, [rows]);

  const [checked, setChecked] = useState(() => new Set(initial.map((p) => p.id)));
  const [keepName, setKeepName] = useState(initial[0]?.name ?? '');
  const [busy, setBusy] = useState(false);

  const selected = initial.filter((p) => checked.has(p.id));
  // Offer other payees from the initial list only (opened with candidates).
  const candidates = initial;

  const toggle = (id: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        if (next.size <= 2) return prev;
        next.delete(id);
      } else next.add(id);
      return next;
    });
  };

  const keepId = selected[0]?.id ?? initial[0]!.id;
  const mergeIds = selected.map((p) => p.id).filter((id) => id !== keepId);
  const canMerge = selected.length >= 2 && keepName.trim().length > 0;

  return (
    <SafeAreaView testID="payees-merge-sheet" style={{ flex: 1, backgroundColor: theme.page }} edges={['top', 'bottom']}>
      <StackTopBar title={t('payees.mergeTitle')} onBack={onBack} />
      <ScrollView contentContainerStyle={{ padding: sp.lg, gap: sp.lg, flexGrow: 1 }}>
        <RedesignText>{t('payees.redesign.mergeIntro')}</RedesignText>
        {error ? <RedesignInlineError message={error} /> : null}
        {candidates.map((p) => {
          const n = counts.get(p.id) ?? 0;
          const label = t('payees.redesign.mergeRow', {
            name: p.name,
            count: n,
            tx: n === 1 ? t('payees.redesign.txOne') : t('payees.redesign.txMany'),
          });
          return (
            <RedesignCheckbox
              key={p.id}
              testID={`payees-merge-check-${p.id}`}
              label={label}
              checked={checked.has(p.id)}
              onChange={() => toggle(p.id)}
            />
          );
        })}
        <RedesignField
          testID="payees-merge-keep-name"
          label={t('payees.mergeKeepName')}
          value={keepName}
          onChangeText={setKeepName}
        />
      </ScrollView>
      <View style={{ padding: sp.lg, borderTopWidth: 1, borderColor: theme.border, backgroundColor: theme.surface }}>
        <RedesignButton
          testID="payees-merge-save"
          label={t('payees.redesign.mergeAction', { count: selected.length, name: keepName.trim() || '…' })}
          disabled={!canMerge || busy}
          fullWidth
          onPress={() => {
            setBusy(true);
            void onMerge(keepId, mergeIds, keepName).finally(() => setBusy(false));
          }}
        />
      </View>
    </SafeAreaView>
  );
}
