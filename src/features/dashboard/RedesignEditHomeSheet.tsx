import { useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, View } from 'react-native';
import {
  RedesignButton,
  RedesignDialog,
  RedesignIcon,
  RedesignText,
} from '@/design/redesign';
import { redesignLight as theme, redesignTokens as tokens } from '@/design/redesign/theme';
import { t } from '@/i18n';

import {
  DEFAULT_REDESIGN_LAYOUT,
  moveRedesignCard,
  redesignCardLabel,
  reorderRedesignCard,
  toggleRedesignHidden,
  type RedesignCardId,
  type RedesignDashboardLayout,
} from './redesignLayout';

const sp = tokens.space;
const shape = tokens.shape;

type Props = {
  visible: boolean;
  layout: RedesignDashboardLayout;
  onClose: () => void;
  onSave: (layout: RedesignDashboardLayout) => Promise<void> | void;
};

function same(a: RedesignDashboardLayout, b: RedesignDashboardLayout): boolean {
  return a.order.join() === b.order.join() && a.hidden.join() === b.hidden.join();
}

/** Figma Phone / Edit Home 17:1663 and Web / Edit Home 10:591. */
export function RedesignEditHomeSheet({ visible, layout, onClose, onSave }: Props) {
  const [draft, setDraft] = useState(layout);
  const [busy, setBusy] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [dragId, setDragId] = useState<RedesignCardId | null>(null);
  const [filledFor, setFilledFor] = useState(false);

  if (visible && !filledFor) {
    setFilledFor(true);
    setDraft(layout);
    setBusy(false);
  }
  if (!visible && filledFor) setFilledFor(false);

  const dirty = !same(draft, layout);
  const hidden = new Set(draft.hidden);
  const onHome = draft.order.filter((id) => !hidden.has(id));
  const offHome = draft.order.filter((id) => hidden.has(id));

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

  const row = (id: RedesignCardId, shown: boolean) => {
    const webDrag =
      Platform.OS === 'web' && shown
        ? ({
            draggable: true,
            onDragStart: () => setDragId(id),
            onDragOver: (e: { preventDefault: () => void }) => e.preventDefault(),
            onDrop: () => {
              if (dragId) {
                setDraft((d) => ({ ...d, order: reorderRedesignCard(d.order, dragId, id) }));
                setDragId(null);
              }
            },
          } as Record<string, unknown>)
        : {};

    return (
      <View
        key={id}
        testID={`redesign-edit-row-${id}`}
        {...webDrag}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          minHeight: 56,
          paddingHorizontal: sp.lg,
          gap: sp.md,
          borderBottomWidth: 1,
          borderColor: theme.border,
          backgroundColor: theme.surface,
        }}
      >
        {shown ? (
          <View style={{ flexDirection: 'row', gap: 2 }}>
            <Pressable
              testID={`redesign-edit-up-${id}`}
              accessibilityRole="button"
              accessibilityLabel={t('dashboard.customizeMoveUp')}
              onPress={() => setDraft((d) => ({ ...d, order: moveRedesignCard(d.order, id, 'up') }))}
              style={{ width: 32, height: 48, alignItems: 'center', justifyContent: 'center' }}
            >
              <RedesignIcon name="menu" size={20} color={theme.textSecondary} />
            </Pressable>
          </View>
        ) : (
          <View style={{ width: 32 }} />
        )}
        <RedesignText variant="body-medium" style={{ flex: 1 }}>
          {t(redesignCardLabel(id))}
        </RedesignText>
        <Pressable
          testID={`redesign-edit-toggle-${id}`}
          accessibilityRole="switch"
          accessibilityState={{ checked: shown }}
          onPress={() => setDraft((d) => ({ ...d, hidden: toggleRedesignHidden(d.hidden, id, !shown) }))}
          style={{
            width: 52,
            height: 32,
            borderRadius: shape['radius-pill'],
            backgroundColor: shown ? theme.primary : theme.progressTrack,
            justifyContent: 'center',
            paddingHorizontal: 4,
          }}
        >
          <View
            style={{
              width: 24,
              height: 24,
              borderRadius: 12,
              backgroundColor: theme.surface,
              alignSelf: shown ? 'flex-end' : 'flex-start',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {shown ? <RedesignIcon name="check" size={14} color={theme.primary} /> : null}
          </View>
        </Pressable>
      </View>
    );
  };

  return (
    <>
      <Modal visible={visible} animationType="slide" onRequestClose={requestClose}>
        <View testID="redesign-edit-home" style={{ flex: 1, backgroundColor: theme.page }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              minHeight: 64,
              paddingHorizontal: sp.sm,
              borderBottomWidth: 1,
              borderColor: theme.border,
              backgroundColor: theme.surface,
              gap: sp.sm,
            }}
          >
            <Pressable
              testID="redesign-edit-close"
              accessibilityRole="button"
              accessibilityLabel={t('common.close')}
              onPress={requestClose}
              style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}
            >
              <RedesignIcon name="x" size={24} color={theme.text} />
            </Pressable>
            <RedesignText variant="headline" style={{ flex: 1, textAlign: 'center' }}>
              {t('dashboard.redesign.editTitle')}
            </RedesignText>
            <RedesignButton
              testID="redesign-edit-done"
              label={t('dashboard.redesign.done')}
              onPress={() => void save()}
              disabled={busy}
            />
          </View>
          <ScrollView contentContainerStyle={{ paddingBottom: sp.xxl }}>
            <RedesignText tone="textSecondary" style={{ padding: sp.lg }}>
              {Platform.OS === 'web' ? t('dashboard.redesign.editHintWeb') : t('dashboard.redesign.editHint')}
            </RedesignText>
            <RedesignText variant="caption" tone="textSecondary" style={{ paddingHorizontal: sp.lg, paddingBottom: sp.sm }}>
              {t('dashboard.redesign.onHome')}
            </RedesignText>
            <View style={{ backgroundColor: theme.surface, borderTopWidth: 1, borderBottomWidth: 1, borderColor: theme.border }}>
              {onHome.map((id) => row(id, true))}
            </View>
            {offHome.length > 0 ? (
              <>
                <RedesignText
                  variant="caption"
                  tone="textSecondary"
                  style={{ paddingHorizontal: sp.lg, paddingTop: sp.xl, paddingBottom: sp.sm }}
                >
                  {t('dashboard.redesign.hidden')}
                </RedesignText>
                <View style={{ backgroundColor: theme.surface, borderTopWidth: 1, borderBottomWidth: 1, borderColor: theme.border }}>
                  {offHome.map((id) => row(id, false))}
                </View>
              </>
            ) : null}
            <View style={{ padding: sp.lg }}>
              <RedesignButton
                testID="redesign-edit-reset"
                kind="link"
                label={t('dashboard.redesign.reset')}
                onPress={() => setDraft({ order: [...DEFAULT_REDESIGN_LAYOUT.order], hidden: [...DEFAULT_REDESIGN_LAYOUT.hidden] })}
              />
            </View>
          </ScrollView>
        </View>
      </Modal>
      <RedesignDialog
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
