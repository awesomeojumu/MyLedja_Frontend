import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';

import type { Snapshot } from '@/data/workspace/repository';
import { RedesignButton, RedesignChip, RedesignIcon, RedesignSheet, RedesignText } from '@/design/redesign';
import { redesignLight as theme, redesignTokens as tokens } from '@/design/redesign/theme';
import { t, type TextKey } from '@/i18n';

import {
  RULEBOOK_TEMPLATES,
  buildRulebookRule,
  resolveBucketCategories,
  type RulebookTemplate,
} from './rulebooks';

const sp = tokens.space;
const shape = tokens.shape;
const size = tokens.size;

export function RulebookSheet({
  visible,
  snapshot,
  onClose,
  onAdopt,
}: {
  visible: boolean;
  snapshot: Snapshot;
  onClose: () => void;
  onAdopt: (ruleDraft: ReturnType<typeof buildRulebookRule>) => Promise<void>;
}) {
  const [selectedTemplateId, setSelectedTemplateId] = useState<RulebookTemplate['id']>('nigerian_balanced');
  const [triggerMode, setTriggerMode] = useState<'any' | 'salary'>('any');
  const [salaryPayee] = useState('');
  const [busy, setBusy] = useState(false);

  const template = useMemo(
    () => RULEBOOK_TEMPLATES.find((t) => t.id === selectedTemplateId) ?? RULEBOOK_TEMPLATES[0]!,
    [selectedTemplateId],
  );

  const buckets = useMemo(
    () => resolveBucketCategories(template.splits, snapshot.categories),
    [template, snapshot.categories],
  );

  const handleAdopt = async () => {
    setBusy(true);
    try {
      const draft = buildRulebookRule(template, snapshot, {
        incomePayeeName: triggerMode === 'salary' ? salaryPayee || 'Salary' : undefined,
      });
      await onAdopt(draft);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <RedesignSheet
      visible={visible}
      title={t('rules.rulebook.title')}
      onClose={onClose}
      testID="redesign-rulebook-sheet"
    >
      <ScrollView contentContainerStyle={{ gap: sp.md, paddingBottom: sp.lg }}>
        {/* Co-pilot positive reinforcement card */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: theme.primarySoft,
            borderRadius: shape['radius-lg'],
            padding: sp.md,
            gap: sp.sm,
          }}
        >
          <RedesignIcon name="zap" size={size['icon-md']} color={theme.text} />
          <RedesignText variant="caption" style={{ flex: 1 }}>
            {t('rules.rulebook.copilotNote')}
          </RedesignText>
        </View>

        {/* Framework Selector Chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: sp.xs }}>
          {RULEBOOK_TEMPLATES.map((tmpl) => (
            <RedesignChip
              key={tmpl.id}
              testID={`rulebook-template-${tmpl.id}`}
              label={t(tmpl.nameKey as TextKey)}
              selected={selectedTemplateId === tmpl.id}
              onPress={() => setSelectedTemplateId(tmpl.id)}
            />
          ))}
        </ScrollView>

        <RedesignText variant="caption" tone="textSecondary">
          {t(template.descKey as TextKey)}
        </RedesignText>

        {/* Earmark Breakdown */}
        <View style={{ gap: sp.xs }}>
          <RedesignText variant="label">{t('rules.rulebook.bucketsTitle')}</RedesignText>
          <View
            style={{
              backgroundColor: theme.surfaceMuted,
              borderRadius: shape['radius-md'],
              padding: sp.md,
              gap: sp.sm,
            }}
          >
            {buckets.map((b) => (
              <View
                key={b.bucketKey}
                testID={`rulebook-bucket-${b.bucketKey}`}
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: sp.xs }}>
                  <View
                    style={{
                      width: 38,
                      height: 24,
                      borderRadius: 4,
                      backgroundColor: theme.primary,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <RedesignText variant="helper" style={{ color: theme.surface }}>
                      {b.pct}%
                    </RedesignText>
                  </View>
                  <RedesignText variant="label" style={{ textTransform: 'capitalize' }}>
                    {b.bucketKey}
                  </RedesignText>
                </View>
                <RedesignText variant="caption" tone="textSecondary">
                  {b.categoryName}
                </RedesignText>
              </View>
            ))}
          </View>
        </View>

        {/* Trigger Mode */}
        <View style={{ gap: sp.xs }}>
          <RedesignText variant="label">{t('rules.rulebook.selectIncome')}</RedesignText>
          <View style={{ flexDirection: 'row', gap: sp.xs }}>
            <RedesignChip
              testID="rulebook-trigger-any"
              label={t('rules.rulebook.anyIncome')}
              selected={triggerMode === 'any'}
              onPress={() => setTriggerMode('any')}
            />
            <RedesignChip
              testID="rulebook-trigger-salary"
              label={t('rules.rulebook.salaryEmployer')}
              selected={triggerMode === 'salary'}
              onPress={() => setTriggerMode('salary')}
            />
          </View>
        </View>

        {/* Adopt Button */}
        <RedesignButton
          testID="rulebook-adopt-btn"
          label={t('rules.rulebook.adopt')}
          onPress={() => void handleAdopt()}
          disabled={busy}
          fullWidth
        />
      </ScrollView>
    </RedesignSheet>
  );
}
