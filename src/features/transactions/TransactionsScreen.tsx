import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { MoreHorizontal } from 'lucide-react-native';

import { Amount, Button, Card, EmptyState, formatDay, InlineError, Menu, Placeholder, StatusPill, Text, TextInput, useToast } from '@/design/components';
import tokens from '@/design/tokens.json';
import { useTheme } from '@/design/ThemeProvider';
import { useWorkspace } from '@/data/workspace/WorkspaceProvider';
import { AppFrame } from '@/features/frame/AppFrame';
import { t } from '@/i18n';
import { formatNaira } from '@/money';

import { useGlobalSearchParams, useRouter } from 'expo-router';

import { useAddTransaction } from './AddTransaction';
import { TransactionPanel } from './TransactionPanel';
import { ledgerMessage, rowsFor, today, type Row } from './helpers';

const sp = tokens.spacing;

/** Search matches payee, note, category or amount (P11-02). */
export function matches(row: Row, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const digits = q.replace(/[₦,\s]/g, '');
  const amount = (row.amount < 0n ? -row.amount : row.amount).toString();
  const naira = formatNaira(row.amount < 0n ? -row.amount : row.amount).replace(/[₦,]/g, '');
  return (
    row.title.toLowerCase().includes(q) ||
    row.category.toLowerCase().includes(q) ||
    (row.event.notes ?? '').toLowerCase().includes(q) ||
    (digits !== '' && /^\d+(\.\d{0,2})?$/.test(digits) && (naira.startsWith(digits) || amount.startsWith(digits)))
  );
}

export function TransactionsScreen() {
  const { repo, snapshot } = useWorkspace();
  const add = useAddTransaction();
  const toast = useToast();
  const theme = useTheme();
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const params = useGlobalSearchParams<{ tx?: string }>();

  const days = useMemo(() => {
    if (!snapshot) return [];
    const groups = new Map<string, Row[]>();
    for (const row of rowsFor(snapshot).filter((r) => matches(r, query))) {
      const list = groups.get(row.event.date) ?? [];
      list.push(row);
      groups.set(row.event.date, list);
    }
    return [...groups.entries()].map(([date, rows]) => ({
      date,
      rows,
      net: rows.filter((r) => r.event.type !== 'transfer').reduce((s, r) => s + r.amount, 0n),
    }));
  }, [snapshot, query]);

  const remove = async (row: Row) => {
    setError(null);
    const result = await repo.deleteTransaction(row.event.id, today());
    if (!result.ok) {
      setError(ledgerMessage(result.error));
      return;
    }
    toast.show(t('tx.deleted'), () => void repo.restore(row.event));
  };

  return (
    <AppFrame title={t('tx.title')}>
      <View
        style={{
          flexDirection: 'row',
          gap: sp['spacing-md'],
          alignItems: 'flex-end',
          marginBottom: sp['spacing-lg'],
        }}
      >
        <View style={{ flex: 1 }}>
          <TextInput testID="tx-search" label={t('tx.search')} value={query} onChangeText={setQuery} />
        </View>
        <Button testID="tx-add" label={t('tx.add')} onPress={() => add.open('expense')} />
      </View>
      {error ? <InlineError message={error} /> : null}
      {!snapshot ? (
        <View style={{ gap: sp['spacing-md'] }}>
          <Placeholder height={20} />
          <Placeholder height={56} />
          <Placeholder height={56} />
        </View>
      ) : days.length === 0 && !query ? (
        <EmptyState title={t('tx.emptyTitle')} body={t('tx.emptyBody')} actionLabel={t('tx.add')} onAction={() => add.open('expense')} />
      ) : days.length === 0 ? (
        <Text tone="textSecondary">{t('tx.noMatches')}</Text>
      ) : (
        <ScrollView contentContainerStyle={{ gap: sp['spacing-lg'] }}>
          {days.map((day) => (
            <View key={day.date} testID={`day-${day.date}`} style={{ gap: sp['spacing-xs'] }}>
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                }}
              >
                <Text variant="caption" tone="textSecondary" accessibilityRole="header">
                  {formatDay(day.date)}
                </Text>
                <Amount minor={day.net} variant="caption" signed />
              </View>
              <Card style={{ padding: 0 }}>
                {day.rows.map((row, i) => (
                  <View
                    key={row.event.id}
                    testID={`tx-${row.event.id}`}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: sp['spacing-md'],
                      padding: sp['spacing-md'],
                      borderTopWidth: i === 0 ? 0 : 1,
                      borderTopColor: theme.border,
                    }}
                  >
                    <Pressable
                      testID={`open-${row.event.id}`}
                      accessibilityRole="button"
                      onPress={() => router.setParams({ tx: row.event.id })}
                      accessibilityLabel={t('tx.rowLabel', {
                        title: row.title,
                        category: row.category,
                        amount: formatNaira(row.amount, {
                          signed: row.event.type !== 'transfer',
                        }),
                      })}
                      style={{ flex: 1, gap: sp['spacing-xxs'] }}
                    >
                      <Text>{row.title}</Text>
                      <Text variant="caption" tone="textSecondary">
                        {[row.category, row.account].filter(Boolean).join(' · ')}
                      </Text>
                      {row.event.notes ? (
                        <Text variant="caption" tone="textSecondary">
                          {row.event.notes}
                        </Text>
                      ) : null}
                      {row.event.correctionOf ? (
                        <Text variant="caption" tone="textSecondary">
                          {t('panel.edited')}
                        </Text>
                      ) : null}
                    </Pressable>
                    {row.waiting ? <StatusPill label={t('tx.waiting')} kind="pending" /> : null}
                    <Amount minor={row.amount} signed={row.event.type !== 'transfer'} />
                    <Menu
                      testID={`tx-menu-${row.event.id}`}
                      trigger={(open) => (
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={t('tx.actions')}
                          onPress={open}
                          style={{
                            minWidth: 44,
                            minHeight: 44,
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <MoreHorizontal size={18} color={theme.textSecondary} />
                        </Pressable>
                      )}
                      items={[
                        {
                          key: 'delete',
                          label: t('tx.delete'),
                          onPress: () => void remove(row),
                        },
                      ]}
                    />
                  </View>
                ))}
              </Card>
            </View>
          ))}
        </ScrollView>
      )}
      {params.tx ? <TransactionPanel id={params.tx} onClose={() => router.setParams({ tx: undefined })} /> : null}
    </AppFrame>
  );
}
