import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import {
  Button,
  Confirm,
  Footer,
  InlineError,
  SegmentedControl,
  Select,
  Sheet,
  Switch,
  Text,
  TextInput,
} from '@/design/components';
import tokens from '@/design/tokens.json';
import { useTheme } from '@/design/ThemeProvider';
import { BUDGET_TYPES, type BudgetType, type Category } from '@/data/workspace/model';
import type { Snapshot } from '@/data/workspace/repository';
import { t, type TextKey } from '@/i18n';
import { formatNaira } from '@/money';

import { assignedOf } from './helpers';
import { CATEGORY_ICONS, defaultIconForName } from './categoryIcons';

const sp = tokens.spacing;

const GROUP_OPTIONS: { value: string; labelKey: TextKey }[] = [
  { value: 'group.home', labelKey: 'group.home' },
  { value: 'group.gettingAround', labelKey: 'group.gettingAround' },
  { value: 'group.food', labelKey: 'group.food' },
  { value: 'group.family', labelKey: 'group.family' },
  { value: 'group.faith', labelKey: 'group.faith' },
  { value: 'group.income', labelKey: 'group.income' },
];

export function categoryHasTransactions(snapshot: Snapshot, categoryId: string): boolean {
  return snapshot.events.some(
    (e) => e.status === 'posted' && e.lines.some((l) => l.ledgerAccountId === categoryId),
  );
}

export function categoryTxnCount(snapshot: Snapshot, categoryId: string): number {
  return snapshot.events.filter(
    (e) => e.status === 'posted' && (e.type === 'expense' || e.type === 'income') && e.lines.some((l) => l.ledgerAccountId === categoryId),
  ).length;
}

export function duplicateCategoryName(snapshot: Snapshot, name: string, group: string, exceptId?: string): boolean {
  const needle = name.trim().toLowerCase();
  return snapshot.categories.some((c) => c.id !== exceptId && c.group === group && c.name.trim().toLowerCase() === needle);
}

export type CategoryDraft = {
  name: string;
  group: string;
  kind: 'income' | 'expense';
  budgetType: BudgetType;
  icon: string;
  essential: boolean;
  hidden: boolean;
};

export function EditCategorySheet({
  visible,
  category,
  snapshot,
  isNew,
  onClose,
  onSave,
  onDelete,
}: {
  visible: boolean;
  category: Category | null;
  snapshot: Snapshot;
  isNew?: boolean;
  onClose: () => void;
  onSave: (draft: CategoryDraft) => Promise<void>;
  onDelete?: () => void;
}) {
  const theme = useTheme();
  const seed = category;
  const [name, setName] = useState(seed?.name ?? '');
  const [group, setGroup] = useState(seed?.group ?? 'group.home');
  const [kind, setKind] = useState<'income' | 'expense'>(seed?.kind ?? 'expense');
  const [budgetType, setBudgetType] = useState<BudgetType>(seed?.budgetType ?? 'flexible');
  const [icon, setIcon] = useState(seed?.icon ?? defaultIconForName(seed?.name ?? ''));
  const [essential, setEssential] = useState(seed?.essential ?? false);
  const [hidden, setHidden] = useState(seed?.hidden ?? false);
  const [iconQuery, setIconQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [filledFor, setFilledFor] = useState<string | null>(null);

  const openKey = visible ? (seed?.id ?? (isNew ? 'new' : null)) : null;
  if (openKey !== filledFor) {
    setFilledFor(openKey);
    if (openKey) {
      setName(seed?.name ?? '');
      setGroup(seed?.group ?? 'group.home');
      setKind(seed?.kind ?? 'expense');
      setBudgetType(seed?.budgetType ?? 'flexible');
      setIcon(seed?.icon ?? defaultIconForName(seed?.name ?? ''));
      setEssential(seed?.essential ?? false);
      setHidden(seed?.hidden ?? false);
      setIconQuery('');
      setError(null);
      setBusy(false);
    }
  }

  const hasTx = seed ? categoryHasTransactions(snapshot, seed.id) : false;
  const dirty =
    name !== (seed?.name ?? '') ||
    group !== (seed?.group ?? 'group.home') ||
    kind !== (seed?.kind ?? 'expense') ||
    budgetType !== (seed?.budgetType ?? 'flexible') ||
    icon !== (seed?.icon ?? defaultIconForName(seed?.name ?? '')) ||
    essential !== (seed?.essential ?? false) ||
    hidden !== (seed?.hidden ?? false);

  const groupOptions = GROUP_OPTIONS.map((g) => ({ value: g.value, label: t(g.labelKey) }));
  if (!groupOptions.some((g) => g.value === group)) groupOptions.push({ value: group, label: group });

  const icons = useMemo(() => {
    const q = iconQuery.trim().toLowerCase();
    return q ? CATEGORY_ICONS.filter((i) => i.name.toLowerCase().includes(q)) : CATEGORY_ICONS;
  }, [iconQuery]);

  const valid = name.trim().length > 0 && !duplicateCategoryName(snapshot, name, group, seed?.id);

  const requestClose = () => (dirty ? setConfirmDiscard(true) : onClose());

  const save = async () => {
    if (!valid || busy) return;
    if (duplicateCategoryName(snapshot, name, group, seed?.id)) {
      setError(t('category.duplicateName', { name: name.trim() }));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onSave({
        name: name.trim(),
        group,
        kind: hasTx && seed ? seed.kind : kind,
        budgetType,
        icon,
        essential,
        hidden,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Sheet
        visible={visible}
        title={isNew ? t('category.add') : t('category.edit')}
        onClose={requestClose}
        testID="category-edit-sheet"
        width={480}
        footer={
          <View style={{ gap: sp['spacing-sm'] }}>
            <Footer>
              <Button kind="secondary" label={t('common.cancel')} onPress={requestClose} disabled={busy} />
              <Button
                testID="category-edit-save"
                label={isNew ? t('category.add') : t('category.save')}
                disabled={!valid || busy}
                onPress={() => void save()}
              />
            </Footer>
            {!isNew && onDelete ? (
              <Button testID="category-edit-delete" kind="link" label={t('category.delete')} onPress={onDelete} disabled={busy} />
            ) : null}
          </View>
        }
      >
        <TextInput testID="category-edit-name" label={t('category.name')} value={name} onChangeText={setName} />
        {error ? <InlineError message={error} /> : null}
        {!valid && name.trim() && duplicateCategoryName(snapshot, name, group, seed?.id) ? (
          <InlineError message={t('category.duplicateName', { name: name.trim() })} />
        ) : null}

        <Text variant="caption" tone="textSecondary">
          {t('category.icon')}
        </Text>
        <TextInput testID="category-icon-search" label={t('category.iconSearch')} value={iconQuery} onChangeText={setIconQuery} />
        <View testID="category-icon-grid" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: sp['spacing-sm'] }}>
          {icons.map(({ name: iconName, Icon }) => {
            const selected = icon === iconName;
            return (
              <Pressable
                key={iconName}
                testID={`category-icon-${iconName}`}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={iconName}
                onPress={() => setIcon(iconName)}
                style={{
                  width: 44,
                  height: 44,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: tokens.radius['rounded-md'],
                  borderWidth: 1,
                  borderColor: selected ? theme.primaryFill : theme.border,
                  backgroundColor: selected ? tokens.color['primary-bg-subdued-hover'] : theme.card,
                }}
              >
                <Icon size={20} color={selected ? theme.primaryFill : theme.textSecondary} />
              </Pressable>
            );
          })}
        </View>

        <Select testID="category-edit-group" label={t('category.group')} options={groupOptions} value={group} onChange={setGroup} />

        <SegmentedControl
          testID="category-edit-kind"
          label={t('category.kind')}
          value={kind}
          onChange={(v) => {
            if (hasTx) return;
            setKind(v);
          }}
          options={[
            { value: 'expense', label: t('category.kind.spending') },
            { value: 'income', label: t('category.kind.income') },
          ]}
        />
        {hasTx ? (
          <Text variant="caption" tone="textSecondary">
            {t('category.kindLocked')}
          </Text>
        ) : null}

        {kind === 'expense' ? (
          <>
            <SegmentedControl
              testID="category-edit-type"
              label={t('category.type')}
              value={budgetType}
              onChange={(v) => setBudgetType(v)}
              options={BUDGET_TYPES.map((v) => ({ value: v, label: t(`category.budgetType.${v}`) }))}
            />
            <Switch testID="category-edit-essential" label={t('category.essential')} value={essential} onChange={setEssential} />
          </>
        ) : null}

        <Switch testID="category-edit-hide" label={t('category.hideFromBudget')} value={hidden} onChange={setHidden} />
      </Sheet>
      <Confirm
        visible={confirmDiscard}
        title={t('common.discardTitle')}
        body={t('common.discardBody')}
        confirmLabel={t('common.discardConfirm')}
        onCancel={() => setConfirmDiscard(false)}
        onConfirm={() => {
          setConfirmDiscard(false);
          onClose();
        }}
      />
    </>
  );
}

export function DeleteCategorySheet({
  visible,
  category,
  snapshot,
  month,
  onClose,
  onConfirm,
}: {
  visible: boolean;
  category: Category;
  snapshot: Snapshot;
  month: string;
  onClose: () => void;
  onConfirm: (moveToId: string) => Promise<void>;
}) {
  const others = snapshot.categories.filter((c) => c.id !== category.id && c.kind === category.kind);
  const [moveTo, setMoveTo] = useState(others[0]?.id ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const count = categoryTxnCount(snapshot, category.id);
  const planned = assignedOf(snapshot, category.id, month);
  const needsMove = count > 0 || planned > 0n;
  return (
    <Sheet
      visible={visible}
      title={t('category.deleteTitleNamed', { name: category.name })}
      onClose={onClose}
      testID="category-delete-sheet"
      width={420}
      footer={
        <Footer>
          <Button kind="secondary" label={t('common.cancel')} onPress={onClose} disabled={busy} />
          <Button
            testID="category-delete-confirm"
            label={t('category.deleteConfirmFull')}
            disabled={busy || (needsMove && !moveTo)}
            onPress={() => {
              if (needsMove && !moveTo) return;
              setBusy(true);
              setError(null);
              void onConfirm(moveTo || others[0]?.id || '')
                .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
                .finally(() => setBusy(false));
            }}
          />
        </Footer>
      }
    >
      <Text>
        {t('category.deleteBodyDetail', {
          name: category.name,
          count,
          amount: formatNaira(planned),
        })}
      </Text>
      {error ? <InlineError message={error} /> : null}
      {needsMove ? (
        <Select
          testID="category-delete-move"
          label={t('category.deleteMoveThem')}
          options={others.map((c) => ({ value: c.id, label: c.name }))}
          value={moveTo}
          onChange={setMoveTo}
        />
      ) : null}
    </Sheet>
  );
}
