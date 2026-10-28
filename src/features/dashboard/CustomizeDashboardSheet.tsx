import { Pressable, View } from 'react-native';
import { ArrowDown, ArrowUp, GripVertical } from 'lucide-react-native';

import { Button, Sheet, Switch, Text } from '@/design/components';
import tokens from '@/design/tokens.json';
import { useTheme } from '@/design/ThemeProvider';
import { useSizeClass } from '@/design/size';
import { t } from '@/i18n';

import {
  DEFAULT_DASHBOARD_LAYOUT,
  dashboardCardLabel,
  moveCard,
  toggleCardHidden,
  type DashboardLayout,
} from './layout';

const sp = tokens.spacing;

type Props = {
  visible: boolean;
  layout: DashboardLayout;
  onClose: () => void;
  onSave: (layout: DashboardLayout) => void;
};

export function CustomizeDashboardSheet({ visible, layout, onClose, onSave }: Props) {
  const theme = useTheme();
  const phone = useSizeClass() === 'phone';
  const hidden = new Set(layout.hidden);

  const patch = (next: DashboardLayout) => onSave(next);

  return (
    <Sheet
      visible={visible}
      title={t('dashboard.customizeTitle')}
      onClose={onClose}
      testID="dashboard-customize-sheet"
      footer={
        <Button
          testID="dashboard-customize-reset"
          kind="secondary"
          label={t('dashboard.customizeReset')}
          onPress={() => patch(DEFAULT_DASHBOARD_LAYOUT)}
        />
      }
    >
      {layout.order.map((id) => (
        <View
          key={id}
          testID={`dashboard-customize-row-${id}`}
          style={{ flexDirection: 'row', alignItems: 'center', gap: sp['spacing-sm'], minHeight: 44 }}
        >
          {phone ? (
            <View style={{ flexDirection: 'row', gap: 2 }}>
              <Pressable
                testID={`dashboard-customize-up-${id}`}
                accessibilityRole="button"
                accessibilityLabel={t('dashboard.customizeMoveUp')}
                onPress={() => patch({ ...layout, order: moveCard(layout.order, id, 'up') })}
                style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}
              >
                <ArrowUp size={18} color={theme.textSecondary} />
              </Pressable>
              <Pressable
                testID={`dashboard-customize-down-${id}`}
                accessibilityRole="button"
                accessibilityLabel={t('dashboard.customizeMoveDown')}
                onPress={() => patch({ ...layout, order: moveCard(layout.order, id, 'down') })}
                style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}
              >
                <ArrowDown size={18} color={theme.textSecondary} />
              </Pressable>
            </View>
          ) : (
            <GripVertical size={18} color={theme.textSecondary} accessibilityLabel={t('dashboard.customizeDrag')} />
          )}
          <Text style={{ flex: 1 }}>{t(dashboardCardLabel(id))}</Text>
          <Switch
            testID={`dashboard-customize-visible-${id}`}
            label={t(dashboardCardLabel(id))}
            value={!hidden.has(id)}
            onChange={(on) =>
              patch({
                order: layout.order,
                hidden: toggleCardHidden(layout.hidden, id, on),
              })
            }
          />
        </View>
      ))}
      {!phone ? (
        <Text variant="caption" tone="textSecondary">
          {t('dashboard.customizeDragHint')}
        </Text>
      ) : null}
    </Sheet>
  );
}
