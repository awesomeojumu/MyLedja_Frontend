import { useState } from 'react';
import { Platform, Pressable, View } from 'react-native';
import { ArrowDown, ArrowUp, GripVertical } from 'lucide-react-native';

import { Button, Confirm, Footer, Sheet, Switch, Text } from '@/design/components';
import tokens from '@/design/tokens.json';
import { useTheme } from '@/design/ThemeProvider';
import { useSizeClass } from '@/design/size';
import { t } from '@/i18n';

import {
  DEFAULT_DASHBOARD_LAYOUT,
  dashboardCardLabel,
  moveCard,
  reorderCard,
  toggleCardHidden,
  type DashboardCardId,
  type DashboardLayout,
} from './layout';

const sp = tokens.spacing;

type Props = {
  visible: boolean;
  layout: DashboardLayout;
  onClose: () => void;
  onSave: (layout: DashboardLayout) => Promise<void> | void;
};

function sameLayout(a: DashboardLayout, b: DashboardLayout): boolean {
  return a.order.join() === b.order.join() && a.hidden.join() === b.hidden.join();
}

export function CustomizeDashboardSheet({ visible, layout, onClose, onSave }: Props) {
  const theme = useTheme();
  const phone = useSizeClass() === 'phone';
  const [draft, setDraft] = useState(layout);
  const [busy, setBusy] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [dragId, setDragId] = useState<DashboardCardId | null>(null);
  const [filledFor, setFilledFor] = useState(false);

  // Reset draft when the sheet opens (same pattern as EditAmountSheet).
  if (visible && !filledFor) {
    setFilledFor(true);
    setDraft(layout);
    setBusy(false);
  }
  if (!visible && filledFor) setFilledFor(false);

  const dirty = !sameLayout(draft, layout);
  const hidden = new Set(draft.hidden);

  const requestClose = () => (dirty ? setConfirmDiscard(true) : onClose());

  const save = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await onSave(draft);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Sheet
        visible={visible}
        title={t('dashboard.customizeTitle')}
        onClose={requestClose}
        testID="dashboard-customize-sheet"
        width={480}
        footer={
          <Footer>
            <Button testID="dashboard-customize-cancel" kind="secondary" label={t('common.cancel')} onPress={requestClose} disabled={busy} />
            <Button testID="dashboard-customize-save" label={t('dashboard.customizeSave')} onPress={() => void save()} disabled={busy || !dirty} />
          </Footer>
        }
      >
        {draft.order.map((id) => {
          const webDrag =
            Platform.OS === 'web'
              ? ({
                  draggable: true,
                  onDragStart: () => setDragId(id),
                  onDragOver: (e: { preventDefault: () => void }) => e.preventDefault(),
                  onDrop: () => {
                    if (dragId) {
                      setDraft((d) => ({ ...d, order: reorderCard(d.order, dragId, id) }));
                      setDragId(null);
                    }
                  },
                } as Record<string, unknown>)
              : {};
          return (
            <View
              key={id}
              testID={`dashboard-customize-row-${id}`}
              {...webDrag}
              style={{ flexDirection: 'row', alignItems: 'center', gap: sp['spacing-sm'], minHeight: 44 }}
            >
              {phone ? (
                <View style={{ flexDirection: 'row', gap: 2 }}>
                  <Pressable
                    testID={`dashboard-customize-up-${id}`}
                    accessibilityRole="button"
                    accessibilityLabel={t('dashboard.customizeMoveUp')}
                    onPress={() => setDraft((d) => ({ ...d, order: moveCard(d.order, id, 'up') }))}
                    style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}
                  >
                    <ArrowUp size={18} color={theme.textSecondary} />
                  </Pressable>
                  <Pressable
                    testID={`dashboard-customize-down-${id}`}
                    accessibilityRole="button"
                    accessibilityLabel={t('dashboard.customizeMoveDown')}
                    onPress={() => setDraft((d) => ({ ...d, order: moveCard(d.order, id, 'down') }))}
                    style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}
                  >
                    <ArrowDown size={18} color={theme.textSecondary} />
                  </Pressable>
                </View>
              ) : (
                <View testID={`dashboard-customize-drag-${id}`} accessibilityLabel={t('dashboard.customizeDrag')}>
                  <GripVertical size={18} color={theme.textSecondary} />
                </View>
              )}
              <Text style={{ flex: 1 }}>{t(dashboardCardLabel(id))}</Text>
              <Switch
                testID={`dashboard-customize-visible-${id}`}
                label={t(dashboardCardLabel(id))}
                value={!hidden.has(id)}
                onChange={(on) =>
                  setDraft((d) => ({
                    order: d.order,
                    hidden: toggleCardHidden(d.hidden, id, on),
                  }))
                }
              />
            </View>
          );
        })}
        <Button
          testID="dashboard-customize-reset"
          kind="link"
          label={t('dashboard.customizeReset')}
          onPress={() => setDraft(DEFAULT_DASHBOARD_LAYOUT)}
        />
        {!phone ? (
          <Text variant="caption" tone="textSecondary">
            {t('dashboard.customizeDragHint')}
          </Text>
        ) : null}
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
