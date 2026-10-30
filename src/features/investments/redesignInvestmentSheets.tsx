import { useMemo, useState } from 'react';
import { View } from 'react-native';

import type { Holding, HoldingType } from '@/data/workspace/model';
import { useWorkspace } from '@/data/workspace/WorkspaceProvider';
import { useToast } from '@/design/components';
import {
  RedesignButton,
  RedesignField,
  RedesignIcon,
  RedesignSheet,
  RedesignSwitch,
  RedesignText,
} from '@/design/redesign';
import { redesignTokens as tokens } from '@/design/redesign/theme';
import { t } from '@/i18n';
import { parseAmount } from '@/money';

import { HOLDING_TYPES } from './helpers';

const sp = tokens.space;

export type AddInvestmentDraft = {
  name: string;
  type: HoldingType;
  valueText: string;
  putInText: string;
  countInBudget: boolean;
};

export const emptyAddInvestmentDraft = (): AddInvestmentDraft => ({
  name: '',
  type: 'fund',
  valueText: '',
  putInText: '',
  countInBudget: false,
});

function typeLabel(type: HoldingType): string {
  return t(`investments.redesign.type.${type}` as 'investments.redesign.type.fund');
}

/** Figma Phone / Investments / Add investment (11:4706). */
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

  const dirty = useMemo(
    () =>
      draft.name.trim().length > 0 ||
      draft.valueText.trim().length > 0 ||
      draft.putInText.trim().length > 0 ||
      draft.type !== 'fund' ||
      draft.countInBudget,
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
                setDraft((d) => ({ ...d, type }));
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
