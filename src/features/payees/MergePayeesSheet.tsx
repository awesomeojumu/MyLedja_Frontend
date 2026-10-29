import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { Button, Footer, Sheet, Text } from '@/design/components';
import tokens from '@/design/tokens.json';
import { useTheme } from '@/design/ThemeProvider';
import type { Payee } from '@/data/workspace/model';
import type { Snapshot } from '@/data/workspace/repository';
import { t } from '@/i18n';

import { mergeTransactionCount, payeeRows, yearOf } from './helpers';

const sp = tokens.spacing;

export type MergeKeepChoices = {
  nameId: string;
  logoId: string;
  categoryId: string;
};

export function MergePayeesSheet({
  snapshot,
  payees,
  onClose,
  onMerge,
}: {
  snapshot: Snapshot;
  payees: Payee[];
  onClose: () => void;
  onMerge: (
    keepId: string,
    mergeIds: string[],
    keep: MergeKeepChoices,
  ) => Promise<void>;
}) {
  const theme = useTheme();
  const year = yearOf(new Date().toISOString().slice(0, 10));
  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of payeeRows(snapshot, year)) map.set(row.payee.id, row.txCount);
    return map;
  }, [snapshot, year]);

  const [nameId, setNameId] = useState(payees[0]?.id ?? '');
  const [logoId, setLogoId] = useState(payees[0]?.id ?? '');
  const [categoryId, setCategoryId] = useState(payees[0]?.id ?? '');

  const keepId = nameId;
  const mergeIds = useMemo(() => payees.map((p) => p.id).filter((id) => id !== keepId), [payees, keepId]);
  const moveCount = mergeTransactionCount(snapshot, mergeIds);
  const keepName = payees.find((p) => p.id === keepId)?.name ?? '';

  const Radio = ({
    testID,
    label,
    value,
    selected,
    onSelect,
  }: {
    testID: string;
    label: string;
    value: string;
    selected: string;
    onSelect: (v: string) => void;
  }) => (
    <Pressable
      testID={testID}
      accessibilityRole="radio"
      accessibilityState={{ selected: selected === value }}
      accessibilityLabel={label}
      onPress={() => onSelect(value)}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: sp['spacing-sm'],
        minHeight: 44,
        paddingVertical: sp['spacing-xs'],
      }}
    >
      <View
        style={{
          width: 20,
          height: 20,
          borderRadius: 10,
          borderWidth: 2,
          borderColor: selected === value ? theme.primaryFill : theme.inputBorder,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {selected === value ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: theme.primaryFill }} /> : null}
      </View>
      <Text>{label}</Text>
    </Pressable>
  );

  return (
    <Sheet
      visible
      title={t('payees.mergeTitle')}
      onClose={onClose}
      testID="payees-merge-sheet"
      width={480}
      footer={
        <Footer>
          <Button kind="secondary" label={t('common.cancel')} onPress={onClose} />
          <Button
            testID="payees-merge-save"
            label={t('payees.mergeConfirm')}
            disabled={!keepId || mergeIds.length === 0}
            onPress={() => void onMerge(keepId, mergeIds, { nameId, logoId, categoryId })}
          />
        </Footer>
      }
    >
      <Text tone="textSecondary">{t('payees.mergeBody')}</Text>
      <View style={{ gap: sp['spacing-sm'] }}>
        {payees.map((p) => (
          <View key={p.id} testID={`payees-merge-row-${p.id}`} style={{ gap: sp['spacing-xs'] }}>
            <Text variant="heading-sm">
              {p.name} · {t('payees.txCount', { count: counts.get(p.id) ?? 0 })}
            </Text>
          </View>
        ))}
      </View>

      <Text variant="heading-sm">{t('payees.mergeKeepName')}</Text>
      {payees.map((p) => (
        <Radio key={`name-${p.id}`} testID={`payees-merge-keep-name-${p.id}`} label={p.name} value={p.id} selected={nameId} onSelect={setNameId} />
      ))}

      <Text variant="heading-sm">{t('payees.mergeKeepLogo')}</Text>
      {payees.map((p) => (
        <Radio key={`logo-${p.id}`} testID={`payees-merge-keep-logo-${p.id}`} label={p.name} value={p.id} selected={logoId} onSelect={setLogoId} />
      ))}

      <Text variant="heading-sm">{t('payees.mergeKeepCategory')}</Text>
      {payees.map((p) => (
        <Radio
          key={`cat-${p.id}`}
          testID={`payees-merge-keep-category-${p.id}`}
          label={p.name}
          value={p.id}
          selected={categoryId}
          onSelect={setCategoryId}
        />
      ))}

      {mergeIds.length ? (
        <Text testID="payees-merge-move-line" tone="textSecondary">
          {t('payees.mergeMoveTo', { count: moveCount, name: keepName })}
        </Text>
      ) : null}
    </Sheet>
  );
}
