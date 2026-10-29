import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useGlobalSearchParams } from 'expo-router';
import { MoreHorizontal } from 'lucide-react-native';

import {
  Button,
  Card,
  EmptyState,
  InlineError,
  Menu,
  PillTag,
  Placeholder,
  Switch,
  Text,
  TextInput,
  formatDay,
  useToast,
} from '@/design/components';
import tokens from '@/design/tokens.json';
import { useSizeClass } from '@/design/size';
import { useTheme } from '@/design/ThemeProvider';
import type { TransactionRule } from '@/data/workspace/model';
import { useWorkspace } from '@/data/workspace/WorkspaceProvider';
import { AppFrame } from '@/features/frame/AppFrame';
import { orderedRules } from '@/features/rules/ruleEngine';
import { ledgerMessage } from '@/features/transactions/helpers';
import { t } from '@/i18n';

import { RULE_STAGES, newBlankRule, ruleSentence, showRuleStages, stageTitle } from './helpers';
import { RuleEditorSheet } from './RuleEditorSheet';
import { RunRulesSheet } from './RunRulesSheet';

const sp = tokens.spacing;

function matchesRule(rule: TransactionRule, query: string, snapshot: Parameters<typeof ruleSentence>[1]): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const { when, then } = ruleSentence(rule, snapshot);
  return when.toLowerCase().includes(q) || then.toLowerCase().includes(q);
}

export function RulesScreen() {
  const { snapshot, repo } = useWorkspace();
  const toast = useToast();
  const size = useSizeClass();
  const twoCol = size === 'wide' || size === 'desktop';
  const params = useGlobalSearchParams<{ edit?: string; rule?: string; runRules?: string }>();
  const [query, setQuery] = useState('');
  const [runOpen, setRunOpen] = useState(params.runRules === '1');
  const [editRule, setEditRule] = useState<TransactionRule | null>(null);
  const [error, setError] = useState<string | null>(null);

  const rules = useMemo(() => {
    if (!snapshot) return null;
    return orderedRules(snapshot.rules).filter((r) => matchesRule(r, query, snapshot));
  }, [snapshot, query]);

  const openNew = async () => {
    if (!snapshot) return;
    const draft = newBlankRule(snapshot.rules.length);
    const created = await repo.createRule(draft);
    setEditRule(created);
  };

  // Open the rule named in the link once it has loaded (`?rule=` addendum; `?edit=` legacy).
  const [openedFromLink, setOpenedFromLink] = useState<string | null>(null);
  const linkId = params.rule && params.rule !== 'new' ? params.rule : params.edit;
  if (snapshot && linkId && linkId !== openedFromLink) {
    const found = snapshot.rules.find((r) => r.id === linkId);
    if (found) {
      setOpenedFromLink(linkId);
      setEditRule(found);
    }
  }
  const [runLinked, setRunLinked] = useState(false);
  if (params.runRules === '1' && !runLinked) {
    setRunLinked(true);
    setRunOpen(true);
  }

  const grouped = useMemo(() => {
    if (!rules) return null;
    const stages = showRuleStages(rules.length) ? RULE_STAGES : (['normal'] as const);
    return stages.map((stage) => ({ stage, items: rules.filter((r) => r.stage === stage) }));
  }, [rules]);

  return (
    <AppFrame title={t('rules.title')}>
      <ScrollView contentContainerStyle={{ gap: sp['spacing-lg'], paddingBottom: sp['spacing-xl'] }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: sp['spacing-sm'], alignItems: 'center' }}>
          <View style={{ flex: 1, minWidth: 200 }}>
            <TextInput testID="rules-search" label={t('rules.search')} value={query} onChangeText={setQuery} />
          </View>
          <Button testID="rules-run" kind="secondary" label={t('rules.run')} onPress={() => setRunOpen(true)} disabled={!snapshot?.rules.length} />
          <Button testID="rules-new" label={t('rules.new')} onPress={() => void openNew()} />
        </View>
        {error ? <InlineError message={error} /> : null}
        {!grouped ? (
          <Placeholder height={120} />
        ) : grouped.every((g) => g.items.length === 0) ? (
          <EmptyState title={t('rules.emptyTitle')} body={t('rules.emptyBody')} actionLabel={t('rules.new')} onAction={() => void openNew()} />
        ) : (
          grouped.map(({ stage, items }) =>
            items.length === 0 ? null : (
              <View key={stage} style={{ gap: sp['spacing-md'] }}>
                {showRuleStages(rules?.length ?? 0) ? (
                  <Text variant="heading-sm">{stageTitle(stage)}</Text>
                ) : null}
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: sp['spacing-md'] }}>
                  {items.map((rule) => (
                    <RuleCard
                      key={rule.id}
                      rule={rule}
                      snapshot={snapshot!}
                      wide={twoCol}
                      onEdit={() => setEditRule(rule)}
                      onToggle={async (enabled) => {
                        await repo.saveRule({ ...rule, enabled });
                      }}
                      onReorder={(dir) => void repo.reorderRules(rule.id, dir)}
                      onDelete={async () => {
                        await repo.deleteRule(rule.id);
                        toast.show(t('rules.deleted'));
                      }}
                    />
                  ))}
                </View>
              </View>
            ),
          )
        )}
      </ScrollView>

      {editRule && snapshot ? (
        <RuleEditorSheet
          rule={editRule}
          snapshot={snapshot}
          onClose={() => setEditRule(null)}
          onSave={async (draft) => {
            setError(null);
            await repo.saveRule(draft);
            toast.show(t('common.saved'));
            setEditRule(null);
          }}
          onSaveAndRun={async (draft) => {
            setError(null);
            await repo.saveRule(draft);
            const r = await repo.runRule(draft.id, {});
            if (!r.ok) {
              setError(ledgerMessage(r.error));
              return;
            }
            toast.show(t('rules.ran', { count: r.value.changed }));
            setEditRule(null);
          }}
        />
      ) : null}

      {runOpen && snapshot ? (
        <RunRulesSheet
          snapshot={snapshot}
          rules={snapshot.rules}
          onClose={() => setRunOpen(false)}
          onRun={async (ids, range) => {
            setError(null);
            const r = await repo.runRules(ids, range);
            if (!r.ok) {
              setError(ledgerMessage(r.error));
              return;
            }
            toast.show(t('rules.ran', { count: r.value.changed }));
            setRunOpen(false);
          }}
        />
      ) : null}
    </AppFrame>
  );
}

function RuleCard({
  rule,
  snapshot,
  wide,
  onEdit,
  onToggle,
  onReorder,
  onDelete,
}: {
  rule: TransactionRule;
  snapshot: NonNullable<ReturnType<typeof useWorkspace>['snapshot']>;
  wide: boolean;
  onEdit: () => void;
  onToggle: (enabled: boolean) => Promise<void>;
  onReorder: (dir: 'up' | 'down') => void;
  onDelete: () => Promise<void>;
}) {
  const theme = useTheme();
  const last = rule.lastUsedAt ? formatDay(rule.lastUsedAt) : t('rules.neverUsed');

  return (
    <Card
      testID={`rule-card-${rule.id}`}
      style={{
        gap: sp['spacing-sm'],
        flexGrow: 1,
        flexBasis: wide ? '48%' : '100%',
        maxWidth: wide ? '48%' : '100%',
        opacity: rule.enabled ? 1 : 0.65,
      }}
    >
      <Pressable accessibilityRole="button" onPress={onEdit}>
        <Text tone="textSecondary">{t('rules.whenPrefix')}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginVertical: 4 }}>
          {rule.conditions.map((c, i) => (
            <PillTag key={i} label={`${t(`rules.field.${c.field}`)} ${c.value}`} />
          ))}
        </View>
        <Text tone="textSecondary">{t('rules.thenPrefix')}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginVertical: 4 }}>
          {rule.actions.map((a, i) => (
            <PillTag
              key={i}
              label={
                a.kind === 'setCategory'
                  ? snapshot.categories.find((c) => c.id === a.value)?.name ?? a.value
                  : a.value
              }
            />
          ))}
        </View>
        <Text variant="caption" tone="textSecondary">
          {t('rules.stats', { matched: rule.matchedCount, last })}
        </Text>
      </Pressable>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: sp['spacing-sm'] }}>
        <Switch testID={`rule-enabled-${rule.id}`} label={rule.enabled ? t('rules.on') : t('rules.off')} value={rule.enabled} onChange={(v) => void onToggle(v)} />
        <Menu
          testID={`rule-menu-${rule.id}`}
          trigger={(open) => (
            <Pressable accessibilityRole="button" accessibilityLabel={t('common.options')} onPress={open} style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
              <MoreHorizontal size={18} color={theme.textSecondary} />
            </Pressable>
          )}
          items={[
            { key: 'edit', label: t('rules.edit'), onPress: onEdit },
            { key: 'up', label: t('rules.moveUp'), onPress: () => onReorder('up') },
            { key: 'down', label: t('rules.moveDown'), onPress: () => onReorder('down') },
            { key: 'delete', label: t('rules.delete'), onPress: () => void onDelete() },
          ]}
        />
      </View>
    </Card>
  );
}
