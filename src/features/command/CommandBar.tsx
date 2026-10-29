import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Modal, Platform, Pressable, ScrollView, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Search } from 'lucide-react-native';

import tokens from '@/design/tokens.json';
import { useSizeClass } from '@/design/size';
import { useTheme } from '@/design/ThemeProvider';
import { Text, TextInput, useToast } from '@/design/components';
import { useWorkspace } from '@/data/workspace/WorkspaceProvider';
import { useOptionalAddTransaction } from '@/features/transactions/AddTransaction';
import { ledgerMessage, today } from '@/features/transactions/helpers';
import { t, type TextKey } from '@/i18n';

import {
  flattenHits,
  getRecentSearches,
  rememberSearch,
  searchWorkspace,
  type SearchGroupId,
  type SearchGroupResult,
  type SearchHit,
} from './searchIndex';

const sp = tokens.spacing;
const backdrop = `${tokens.color['brand-dark-900']}73`;
const COMMAND_WIDTH = 640;

const GROUP_LABEL: Record<SearchGroupId, TextKey> = {
  actions: 'command.group.actions',
  pages: 'command.group.pages',
  transactions: 'command.group.transactions',
  accounts: 'command.group.accounts',
  categories: 'command.group.categories',
  payees: 'command.group.payees',
  goals: 'command.group.goals',
  debts: 'command.group.debts',
  holdings: 'command.group.holdings',
};

function billDueDate(snapshot: NonNullable<ReturnType<typeof useWorkspace>['snapshot']>, recurringId: string): string | null {
  const bill = snapshot.recurring.find((r) => r.id === recurringId);
  if (!bill) return null;
  const day = today();
  const month = day.slice(0, 7);
  const occurrence = snapshot.occurrences.find((o) => o.recurringId === recurringId && o.status !== 'paid' && o.dueDate.slice(0, 7) === month);
  if (occurrence) return occurrence.dueDate;
  if (bill.rule.every === 'month') {
    const [y, m] = month.split('-').map(Number) as [number, number];
    const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const on = bill.rule.on === 31 ? last : Math.min(bill.rule.on, last);
    return `${month}-${String(on).padStart(2, '0')}`;
  }
  return bill.startDate;
}

/** PU-03 command bar: dialog search over device data, `?search=`, Ctrl/⌘K. */
export function CommandBar() {
  const theme = useTheme();
  const phone = useSizeClass() === 'phone';
  const router = useRouter();
  const params = useLocalSearchParams<{ search?: string }>();
  const { snapshot, repo } = useWorkspace();
  const add = useOptionalAddTransaction();
  const toast = useToast();
  const open = params.search !== undefined;
  const query = typeof params.search === 'string' ? params.search : '';
  const [active, setActive] = useState(0);

  const setQuery = useCallback(
    (next: string) => {
      router.setParams({ search: next });
    },
    [router],
  );

  const close = useCallback(() => {
    router.setParams({ search: undefined });
  }, [router]);

  const openBar = useCallback(
    (initial = '') => {
      router.setParams({ search: initial });
    },
    [router],
  );

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 'k') return;
      e.preventDefault();
      if (open) close();
      else openBar('');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, close, openBar]);

  const groups: SearchGroupResult[] = useMemo(() => {
    if (!snapshot || !query.trim()) return [];
    return searchWorkspace(snapshot, query);
  }, [snapshot, query]);

  const recent = useMemo(() => (open && !query.trim() ? getRecentSearches() : []), [open, query]);

  const flat = useMemo(() => {
    if (recent.length && !query.trim()) {
      return recent.map(
        (q): SearchHit => ({
          id: `recent-${q}`,
          group: 'actions',
          label: q,
          action: { kind: 'recent', query: q },
        }),
      );
    }
    return flattenHits(groups);
  }, [groups, recent, query]);

  const [activeKey, setActiveKey] = useState(`${open}:${query}`);
  if (`${open}:${query}` !== activeKey) {
    setActiveKey(`${open}:${query}`);
    setActive(0);
  }

  const run = useCallback(
    async (hit: SearchHit) => {
      rememberSearch(query.trim() || (hit.action.kind === 'recent' ? hit.action.query : hit.label));
      const a = hit.action;
      if (a.kind === 'recent') {
        setQuery(a.query);
        return;
      }
      close();
      if (a.kind === 'add') {
        add?.open(a.add);
        return;
      }
      if (a.kind === 'navigate') {
        router.push(a.href as never);
        return;
      }
      if (a.kind === 'reconcile') {
        router.push(`/accounts/${a.accountId}/reconcile`);
        return;
      }
      if (a.kind === 'budget-month') {
        router.push(`/budget?month=${a.month}` as never);
        return;
      }
      if (a.kind === 'see-all-transactions') {
        router.push(`/transactions?q=${encodeURIComponent(a.query)}` as never);
        return;
      }
      if (a.kind === 'mark-bill-paid' && snapshot) {
        const bill = snapshot.recurring.find((r) => r.id === a.recurringId);
        const due = billDueDate(snapshot, a.recurringId);
        if (!bill || !due) {
          router.push('/plan');
          return;
        }
        const categoryId = bill.categoryId ?? snapshot.categories.find((c) => c.kind === 'expense')?.id;
        if (!categoryId) {
          router.push('/plan');
          return;
        }
        const r = await repo.markBillPaid(a.recurringId, due, {
          accountId: bill.accountId,
          categoryId,
          amount: BigInt(bill.amountMinor),
          date: today(),
        });
        if (!r.ok) toast.show(ledgerMessage(r.error));
        else toast.show(t('notifications.markedPaid'));
      }
    },
    [add, close, query, repo, router, setQuery, snapshot, toast],
  );

  useEffect(() => {
    if (!open || Platform.OS !== 'web' || typeof window === 'undefined') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActive((i) => Math.min(i + 1, Math.max(flat.length - 1, 0)));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActive((i) => Math.max(i - 1, 0));
        return;
      }
      if (e.key === 'Enter' && flat[active]) {
        e.preventDefault();
        void run(flat[active]!);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, flat, active, close, run]);

  if (!open) return null;

  let flatIndex = 0;

  return (
    <Modal visible transparent animationType={phone ? 'slide' : 'fade'} onRequestClose={close} aria-label={t('command.title')}>
      <View
        style={{
          flex: 1,
          backgroundColor: backdrop,
          justifyContent: phone ? 'flex-end' : 'flex-start',
          alignItems: 'center',
          paddingTop: phone ? 0 : sp['spacing-huge'],
        }}
      >
        <Pressable accessibilityRole="button" accessibilityLabel={t('common.close')} onPress={close} style={{ position: 'absolute', inset: 0 }} />
        <View
          testID="command-bar"
          accessibilityViewIsModal
          style={{
            backgroundColor: theme.card,
            width: phone ? '100%' : COMMAND_WIDTH,
            maxWidth: '100%',
            maxHeight: phone ? '92%' : '70%',
            borderRadius: tokens.radius['rounded-lg'],
            borderBottomLeftRadius: phone ? 0 : tokens.radius['rounded-lg'],
            borderBottomRightRadius: phone ? 0 : tokens.radius['rounded-lg'],
            borderTopLeftRadius: phone ? tokens.radius['rounded-xl'] : tokens.radius['rounded-lg'],
            borderTopRightRadius: phone ? tokens.radius['rounded-xl'] : tokens.radius['rounded-lg'],
            padding: sp['spacing-lg'],
            gap: sp['spacing-md'],
            boxShadow: tokens.elevation['elevation-2'],
          }}
        >
          <TextInput
            testID="command-search"
            label={t('command.placeholder')}
            value={query}
            onChangeText={setQuery}
            autoFocus
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
            onSubmitEditing={() => {
              if (flat[active]) void run(flat[active]!);
            }}
          />
          <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: phone ? 420 : 480 }}>
            {!query.trim() && recent.length === 0 ? (
              <Text tone="textSecondary">{t('command.recentEmpty')}</Text>
            ) : null}
            {!query.trim() && recent.length > 0 ? (
              <View style={{ gap: sp['spacing-xs'] }}>
                <Text variant="micro" tone="textSecondary" style={{ textTransform: 'uppercase' }}>
                  {t('command.recent')}
                </Text>
                {recent.map((q, i) => {
                  const idx = i;
                  const selected = idx === active;
                  return (
                    <ResultRow
                      key={`recent-${q}`}
                      testID={`command-hit-recent-${i}`}
                      label={q}
                      selected={selected}
                      onPress={() => void run(flat[idx]!)}
                    />
                  );
                })}
              </View>
            ) : null}
            {query.trim() && groups.length === 0 ? (
              <Text tone="textSecondary">{t('command.noResults')}</Text>
            ) : null}
            {groups.map((g) => (
              <View key={g.id} testID={`command-group-${g.id}`} style={{ gap: sp['spacing-xs'], marginBottom: sp['spacing-md'] }}>
                <Text variant="micro" tone="textSecondary" style={{ textTransform: 'uppercase' }}>
                  {t(GROUP_LABEL[g.id])}
                </Text>
                {g.hits.map((hit) => {
                  const idx = flatIndex++;
                  return (
                    <ResultRow
                      key={hit.id}
                      testID={`command-hit-${hit.id}`}
                      label={hit.label}
                      detail={hit.detail}
                      selected={idx === active}
                      onPress={() => void run(hit)}
                    />
                  );
                })}
              </View>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function ResultRow({
  label,
  detail,
  selected,
  onPress,
  testID,
}: {
  label: string;
  detail?: string;
  selected: boolean;
  onPress: () => void;
  testID: string;
}) {
  const theme = useTheme();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={detail ? `${label}, ${detail}` : label}
      onPress={onPress}
      style={{
        minHeight: 44,
        paddingVertical: sp['spacing-sm'],
        paddingHorizontal: sp['spacing-md'],
        borderRadius: tokens.radius['rounded-md'],
        backgroundColor: selected ? theme.page : undefined,
        gap: sp['spacing-xxs'],
      }}
    >
      <Text>{label}</Text>
      {detail ? (
        <Text variant="caption" tone="textSecondary">
          {detail}
        </Text>
      ) : null}
    </Pressable>
  );
}

/** Phone top-bar control that opens the command bar (PU-03). */
export function CommandSearchButton(): ReactNode {
  const theme = useTheme();
  const router = useRouter();
  return (
    <Pressable
      testID="command-open"
      accessibilityRole="button"
      accessibilityLabel={t('command.open')}
      onPress={() => router.setParams({ search: '' })}
      style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}
    >
      <Search size={18} color={theme.textSecondary} />
    </Pressable>
  );
}
