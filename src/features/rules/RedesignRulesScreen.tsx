import { useMemo, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useGlobalSearchParams, useRouter } from 'expo-router';

import type { RuleConditionField, RuleConditionOp, TransactionRule } from '@/data/workspace/model';
import { useWorkspace } from '@/data/workspace/WorkspaceProvider';
import { useToast } from '@/design/components';
import {
  RedesignButton,
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
import { ledgerMessage } from '@/features/transactions/helpers';
import { orderedRules, previewMatches } from '@/features/rules/ruleEngine';

import {
  newBlankRule,
  ruleFromPayee,
  ruleIfTitle,
  ruleThenTitle,
  suggestRules,
  type SuggestedRule,
} from './helpers';
import { RunRulesSheet } from './RunRulesSheet';

const sp = tokens.space;
const shape = tokens.shape;
const size = tokens.size;
const density = tokens.density.touch;

const FIELD_OPTIONS: { value: RuleConditionField; label: string }[] = [
  { value: 'payee', label: t('rules.field.payee') },
  { value: 'description', label: t('rules.field.description') },
  { value: 'notes', label: t('rules.field.notes') },
  { value: 'amount', label: t('rules.field.amount') },
  { value: 'money', label: t('rules.field.money') },
  { value: 'account', label: t('rules.field.account') },
  { value: 'category', label: t('rules.field.category') },
];

/** Figma Rule `6:2377` Matches value is title-case (Contains), not legacy lowercase ops. */
const OP_OPTIONS: { value: RuleConditionOp; label: string }[] = [
  { value: 'contains', label: t('rules.redesign.opContains') },
  { value: 'equals', label: t('rules.redesign.opEquals') },
  { value: 'greaterThan', label: t('rules.redesign.opGreaterThan') },
  { value: 'lessThan', label: t('rules.redesign.opLessThan') },
  { value: 'isIn', label: t('rules.redesign.opIsIn') },
  { value: 'isOut', label: t('rules.redesign.opIsOut') },
];

/**
 * Page 25 Rules redesign (Figma Mobile Phone / Rules 6:2315, Rule 6:2377,
 * Suggested 12:5713, Empty 13:6390). Behind EXPO_PUBLIC_REDESIGN.
 */
export function RedesignRulesScreen() {
  const { snapshot, repo } = useWorkspace();
  const toast = useToast();
  const router = useRouter();
  const params = useGlobalSearchParams<{ edit?: string; rule?: string; runRules?: string; suggested?: string }>();
  const [error, setError] = useState<string | null>(null);
  const [editRule, setEditRule] = useState<TransactionRule | null>(null);
  const [runOpen, setRunOpen] = useState(params.runRules === '1');
  const [suggestedOpen, setSuggestedOpen] = useState(params.suggested === '1');
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set());
  const [openedFromLink, setOpenedFromLink] = useState<string | null>(null);
  const [runLinked, setRunLinked] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<TransactionRule | null>(null);

  const rules = useMemo(() => (snapshot ? orderedRules(snapshot.rules) : null), [snapshot]);
  const suggestions = useMemo(() => {
    if (!snapshot) return [] as SuggestedRule[];
    return suggestRules(snapshot).filter((s) => !dismissed.has(s.key));
  }, [snapshot, dismissed]);

  const openNew = async () => {
    if (!snapshot) return;
    const draft = newBlankRule(snapshot.rules.length);
    const created = await repo.createRule(draft);
    setEditRule(created);
    router.setParams({ rule: created.id, edit: undefined });
  };

  if (snapshot && params.rule === 'new' && openedFromLink !== 'new') {
    setOpenedFromLink('new');
    queueMicrotask(() => {
      void openNew();
    });
  }

  const linkId = params.rule && params.rule !== 'new' ? params.rule : params.edit;
  if (snapshot && linkId && linkId !== openedFromLink) {
    const found = snapshot.rules.find((r) => r.id === linkId);
    if (found) {
      setOpenedFromLink(linkId);
      setEditRule(found);
    }
  }
  if (params.runRules === '1' && !runLinked) {
    setRunLinked(true);
    setRunOpen(true);
  }

  const showRan = (changed: number, undoId?: string) => {
    toast.show(
      t('rules.ran', { count: changed }),
      undoId ? () => void repo.undoRuleRun(undoId).then(() => toast.show(t('common.undo'))) : undefined,
    );
  };

  if (editRule && snapshot) {
    return (
      <RedesignRuleEditor
        rule={editRule}
        snapshot={snapshot}
        error={error}
        onBack={() => {
          setEditRule(null);
          router.setParams({ rule: undefined, edit: undefined });
        }}
        onSave={async (draft, andRun) => {
          setError(null);
          await repo.saveRule(draft);
          if (andRun) {
            const r = await repo.runRule(draft.id, {});
            if (!r.ok) {
              setError(ledgerMessage(r.error));
              return;
            }
            showRan(r.value.changed, r.value.undoId);
          } else {
            toast.show(t('common.saved'));
          }
          setEditRule(null);
          router.setParams({ rule: undefined, edit: undefined });
        }}
        onDelete={() => setConfirmDelete(editRule)}
      />
    );
  }

  if (suggestedOpen && snapshot) {
    return (
      <SuggestedRulesView
        suggestions={suggestions}
        onBack={() => {
          setSuggestedOpen(false);
          router.setParams({ suggested: undefined });
        }}
        onAdd={async (s) => {
          await repo.createRule({ ...ruleFromPayee(s.payeeName, s.categoryId), order: snapshot.rules.length });
          setDismissed((prev) => new Set(prev).add(s.key));
          toast.show(t('common.saved'));
        }}
        onDismiss={(s) => setDismissed((prev) => new Set(prev).add(s.key))}
      />
    );
  }

  return (
    <SafeAreaView testID="redesign-rules" style={{ flex: 1, backgroundColor: theme.page }} edges={['top', 'bottom']}>
      <StackTopBar
        title={t('rules.title')}
        onBack={() => router.back()}
        trailing={
          <Pressable
            testID="rules-new"
            accessibilityRole="button"
            accessibilityLabel={t('rules.new')}
            onPress={() => void openNew()}
            style={{ width: density.minTarget, height: density.minTarget, alignItems: 'center', justifyContent: 'center' }}
          >
            <RedesignIcon name="plus" size={size['icon-lg']} color={theme.text} />
          </Pressable>
        }
      />
      <ScrollView contentContainerStyle={{ padding: sp.lg, gap: sp.lg, paddingBottom: sp.xxl }}>
        {error ? <RedesignInlineError message={error} /> : null}

        {!rules ? (
          <View style={{ height: 120, borderRadius: shape['radius-lg'], backgroundColor: theme.surfaceMuted }} />
        ) : rules.length === 0 ? (
          <EmptyRules onNew={() => void openNew()} />
        ) : (
          <>
            <RedesignText variant="helper" tone="textSecondary">
              {t('rules.redesign.intro')}
            </RedesignText>
            <View
              testID="rules-list"
              style={{
                backgroundColor: theme.surface,
                borderRadius: shape['radius-lg'],
                borderWidth: 1,
                borderColor: theme.border,
                paddingVertical: sp.xs,
              }}
            >
              {rules.map((rule) => (
                <View key={rule.id} style={{ opacity: rule.enabled ? 1 : 0.55 }}>
                  <RedesignListRow
                    testID={`rule-card-${rule.id}`}
                    title={ruleIfTitle(rule, snapshot!)}
                    subtitle={ruleThenTitle(rule, snapshot!)}
                    onPress={() => setEditRule(rule)}
                  />
                </View>
              ))}
            </View>
            {suggestions.length > 0 ? (
              <Pressable
                testID="rules-suggested-banner"
                accessibilityRole="button"
                onPress={() => setSuggestedOpen(true)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: sp.md,
                  backgroundColor: theme.primarySoft,
                  borderRadius: shape['radius-lg'],
                  paddingHorizontal: sp.lg,
                  minHeight: 68,
                }}
              >
                <RedesignIcon name="zap" size={size['icon-md']} color={theme.text} />
                <RedesignText style={{ flex: 1 }}>{t('rules.redesign.suggestedCount', { count: suggestions.length })}</RedesignText>
                <RedesignText tone="primary" style={{ textDecorationLine: 'underline' }}>
                  {t('rules.redesign.review')}
                </RedesignText>
              </Pressable>
            ) : null}
            <RedesignButton
              testID="rules-run"
              kind="link"
              label={t('rules.run')}
              onPress={() => setRunOpen(true)}
              disabled={!rules.length}
            />
          </>
        )}
      </ScrollView>

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
            showRan(r.value.changed, r.value.undoId);
            setRunOpen(false);
          }}
        />
      ) : null}

      <RedesignDialog
        visible={!!confirmDelete}
        title={t('rules.delete')}
        body={confirmDelete ? ruleIfTitle(confirmDelete, snapshot!) : ''}
        confirmLabel={t('rules.delete')}
        onCancel={() => setConfirmDelete(null)}
        onConfirm={() => {
          const target = confirmDelete;
          setConfirmDelete(null);
          if (!target) return;
          void repo.deleteRule(target.id).then(() => {
            toast.show(t('rules.deleted'));
            setEditRule(null);
            router.setParams({ rule: undefined, edit: undefined });
          });
        }}
        destructive
      />
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
      testID="redesign-rules-top-bar"
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
        testID="rules-back"
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

function EmptyRules({ onNew }: { onNew: () => void }) {
  return (
    <View
      testID="rules-empty"
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
        <RedesignIcon name="zap" size={size['icon-lg']} color={theme.text} />
      </View>
      <RedesignText variant="label">{t('rules.emptyTitle')}</RedesignText>
      <RedesignText variant="helper" tone="textSecondary" style={{ textAlign: 'center' }}>
        {t('rules.redesign.emptyBody')}
      </RedesignText>
      <RedesignButton testID="rules-empty-new" label={t('rules.new')} onPress={onNew} />
    </View>
  );
}

function SuggestedRulesView({
  suggestions,
  onBack,
  onAdd,
  onDismiss,
}: {
  suggestions: SuggestedRule[];
  onBack: () => void;
  onAdd: (s: SuggestedRule) => Promise<void>;
  onDismiss: (s: SuggestedRule) => void;
}) {
  return (
    <SafeAreaView testID="rules-suggested" style={{ flex: 1, backgroundColor: theme.page }} edges={['top', 'bottom']}>
      <StackTopBar title={t('rules.redesign.suggestedTitle')} onBack={onBack} />
      <ScrollView contentContainerStyle={{ padding: sp.lg, gap: sp.lg }}>
        <RedesignText>{t('rules.redesign.suggestedIntro')}</RedesignText>
        {suggestions.length === 0 ? (
          <RedesignText tone="textSecondary">{t('rules.redesign.noSuggestions')}</RedesignText>
        ) : (
          suggestions.map((s) => (
            <View
              key={s.key}
              testID={`rules-suggestion-${s.key}`}
              style={{
                backgroundColor: theme.surface,
                borderRadius: shape['radius-lg'],
                borderWidth: 1,
                borderColor: theme.border,
                padding: sp.lg,
                gap: sp.sm,
              }}
            >
              <RedesignText variant="label">{t('rules.redesign.ifPayeeContains', { name: s.payeeName })}</RedesignText>
              <RedesignText variant="helper" tone="textSecondary">
                {t('rules.redesign.suggestionDetail', { category: s.categoryName, count: s.matchCount })}
              </RedesignText>
              <View style={{ flexDirection: 'row', gap: sp.sm }}>
                <View style={{ flex: 1 }}>
                  <RedesignButton
                    testID={`rules-suggestion-add-${s.key}`}
                    label={t('rules.redesign.addRule')}
                    onPress={() => void onAdd(s)}
                    fullWidth
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <RedesignButton
                    testID={`rules-suggestion-dismiss-${s.key}`}
                    kind="secondary"
                    label={t('rules.redesign.notNow')}
                    onPress={() => onDismiss(s)}
                    fullWidth
                  />
                </View>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function RedesignRuleEditor({
  rule,
  snapshot,
  error,
  onBack,
  onSave,
  onDelete,
}: {
  rule: TransactionRule;
  snapshot: NonNullable<ReturnType<typeof useWorkspace>['snapshot']>;
  error: string | null;
  onBack: () => void;
  onSave: (draft: TransactionRule, andRun: boolean) => Promise<void>;
  onDelete: () => void;
}) {
  const [draft, setDraft] = useState(rule);
  const [applyPast, setApplyPast] = useState(false);
  const [fieldOpen, setFieldOpen] = useState(false);
  const [opOpen, setOpOpen] = useState(false);
  const [setOpen, setSetOpen] = useState(false);
  const [toOpen, setToOpen] = useState(false);
  const [validation, setValidation] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const cond = draft.conditions[0] ?? { field: 'payee' as const, op: 'contains' as const, value: '' };
  const action = draft.actions[0] ?? { kind: 'setCategory' as const, value: '' };
  const categories = snapshot.categories.filter((c) => !c.hidden);
  const changing = useMemo(
    () => previewMatches(snapshot, draft, undefined, undefined, { onlyChanging: true }),
    [snapshot, draft],
  );
  const blank =
    !(rule.conditions[0]?.value || '').trim() &&
    !(rule.actions[0]?.value || '').trim() &&
    (rule.matchedCount ?? 0) === 0;

  const setCond = (patch: Partial<typeof cond>) => {
    setDraft((d) => {
      const next = { ...(d.conditions[0] ?? cond), ...patch };
      return { ...d, conditions: [next, ...d.conditions.slice(1)] };
    });
  };

  const setAction = (patch: Partial<typeof action>) => {
    setDraft((d) => {
      const next = { ...(d.actions[0] ?? action), ...patch };
      return { ...d, actions: [next, ...d.actions.slice(1)] };
    });
  };

  const categoryName = categories.find((c) => c.id === action.value)?.name ?? t('common.notSet');
  const fieldLabel = FIELD_OPTIONS.find((f) => f.value === cond.field)?.label ?? cond.field;
  const opLabel = OP_OPTIONS.find((o) => o.value === cond.op)?.label ?? cond.op;

  const trySave = async () => {
    if (!cond.value.trim() && cond.op !== 'isIn' && cond.op !== 'isOut' && cond.op !== 'isEmpty') {
      setValidation(t('rules.needCondition'));
      return;
    }
    if (action.kind === 'setCategory' && !action.value.trim()) {
      setValidation(t('rules.needActionValue'));
      return;
    }
    setValidation(null);
    setBusy(true);
    try {
      await onSave(draft, applyPast);
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView testID="rule-editor" style={{ flex: 1, backgroundColor: theme.page }} edges={['top', 'bottom']}>
      <StackTopBar title={blank ? t('rules.redesign.newTitle') : t('rules.editorTitle')} onBack={onBack} />
      <ScrollView contentContainerStyle={{ padding: sp.lg, gap: sp.lg, flexGrow: 1 }}>
        {error ? <RedesignInlineError message={error} /> : null}
        {validation ? <RedesignInlineError message={validation} /> : null}

        <RedesignText variant="helper" tone="textSecondary">
          {t('rules.redesign.whenTxn')}
        </RedesignText>

        <PickerField testID="rule-field" label={t('rules.redesign.field')} value={fieldLabel} onPress={() => setFieldOpen(true)} />
        <PickerField testID="rule-op" label={t('rules.redesign.matches')} value={opLabel} onPress={() => setOpOpen(true)} />

        {cond.op !== 'isIn' && cond.op !== 'isOut' && cond.op !== 'isEmpty' ? (
          <RedesignField
            testID="rule-value"
            label={t('rules.redesign.text')}
            value={cond.value}
            onChangeText={(value) => setCond({ value })}
            autoCapitalize="none"
          />
        ) : null}

        <RedesignButton
          testID="rule-add-condition"
          kind="link"
          label={t('rules.redesign.addCondition')}
          onPress={() =>
            setDraft((d) => ({
              ...d,
              conditions: [...d.conditions, { field: 'payee', op: 'contains', value: '' }],
            }))
          }
        />

        <RedesignText variant="helper" tone="textSecondary">
          {t('rules.then')}
        </RedesignText>

        <PickerField
          testID="rule-action-kind"
          label={t('rules.redesign.set')}
          value={t('rules.redesign.setValueCategory')}
          onPress={() => setSetOpen(true)}
        />
        <PickerField testID="rule-action-value" label={t('rules.redesign.to')} value={categoryName} onPress={() => setToOpen(true)} />

        <Pressable
          testID="rule-apply-past"
          accessibilityRole="switch"
          accessibilityState={{ checked: applyPast }}
          onPress={() => setApplyPast((v) => !v)}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            minHeight: density.minTarget,
            gap: sp.md,
          }}
        >
          <RedesignText style={{ flex: 1 }}>
            {t('rules.redesign.applyPast', { count: changing.length })}
          </RedesignText>
          <View
            style={{
              width: 52,
              height: 32,
              borderRadius: 16,
              backgroundColor: applyPast ? theme.primary : theme.border,
              padding: 4,
              justifyContent: 'center',
            }}
          >
            <View
              style={{
                width: 24,
                height: 24,
                borderRadius: 12,
                backgroundColor: theme.surface,
                alignSelf: applyPast ? 'flex-end' : 'flex-start',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {applyPast ? <RedesignIcon name="check" size={size['icon-sm']} color={theme.primary} /> : null}
            </View>
          </View>
        </Pressable>

        <RedesignButton testID="rule-delete" kind="link" label={t('rules.delete')} onPress={onDelete} />
      </ScrollView>

      <View style={{ padding: sp.lg, borderTopWidth: 1, borderColor: theme.border, backgroundColor: theme.surface }}>
        <RedesignButton
          testID="rule-save"
          label={t('rules.redesign.saveRule')}
          disabled={busy}
          fullWidth
          onPress={() => void trySave()}
        />
      </View>

      <OptionSheet
        visible={fieldOpen}
        title={t('rules.redesign.field')}
        options={FIELD_OPTIONS}
        onClose={() => setFieldOpen(false)}
        onPick={(value) => {
          setCond({ field: value as RuleConditionField, value: '' });
          setFieldOpen(false);
        }}
      />
      <OptionSheet
        visible={opOpen}
        title={t('rules.redesign.matches')}
        options={OP_OPTIONS}
        onClose={() => setOpOpen(false)}
        onPick={(value) => {
          setCond({ op: value as RuleConditionOp });
          setOpOpen(false);
        }}
      />
      <OptionSheet
        visible={setOpen}
        title={t('rules.redesign.set')}
        options={[{ value: 'setCategory', label: t('rules.redesign.setValueCategory') }]}
        onClose={() => setSetOpen(false)}
        onPick={() => {
          setAction({ kind: 'setCategory' });
          setSetOpen(false);
        }}
      />
      <OptionSheet
        visible={toOpen}
        title={t('rules.redesign.to')}
        options={categories.map((c) => ({ value: c.id, label: c.name }))}
        onClose={() => setToOpen(false)}
        onPick={(value) => {
          setAction({ kind: 'setCategory', value });
          setToOpen(false);
        }}
      />
    </SafeAreaView>
  );
}

function PickerField({
  label,
  value,
  onPress,
  testID,
}: {
  label: string;
  value: string;
  onPress: () => void;
  testID?: string;
}) {
  return (
    <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={label} onPress={onPress}>
      <View style={{ gap: sp.xs }}>
        <RedesignText variant="label">{label}</RedesignText>
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
          <RedesignText style={{ flex: 1 }}>{value}</RedesignText>
          <RedesignIcon name="chevron-down" size={size['icon-lg']} color={theme.text} />
        </View>
      </View>
    </Pressable>
  );
}

function OptionSheet({
  visible,
  title,
  options,
  onClose,
  onPick,
}: {
  visible: boolean;
  title: string;
  options: { value: string; label: string }[];
  onClose: () => void;
  onPick: (value: string) => void;
}) {
  return (
    <RedesignSheet visible={visible} title={title} onClose={onClose}>
      {options.map((opt) => (
        <Pressable
          key={opt.value}
          testID={`rule-option-${opt.value}`}
          accessibilityRole="button"
          onPress={() => onPick(opt.value)}
          style={{ minHeight: density.minTarget, justifyContent: 'center' }}
        >
          <RedesignText>{opt.label}</RedesignText>
        </Pressable>
      ))}
    </RedesignSheet>
  );
}
