import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { Trash2 } from 'lucide-react-native';
import { useTheme, BottomSheet, TextInput, Button } from '../../design';

import { t as i18nT } from '../../i18n';
interface EditCategorySheetProps {
  visible: boolean;
  onClose: () => void;
  category: {
    id: string;
    name: string;
    group: string;
  };
  onSave: (updated: { name: string; group: string }) => void;
  onDeleteRequest?: () => void;
}

export function EditCategorySheet({
  visible,
  onClose,
  category,
  onSave,
  onDeleteRequest,
}: EditCategorySheetProps) {
  const { colors, typography, spacing, radii } = useTheme();

  const [name, setName] = useState(category.name);
  const [group, setGroup] = useState(category.group);
  const [error, setError] = useState('');

  const handleSave = () => {
    if (!name.trim()) {
      setError('Category name cannot be empty');
      return;
    }
    onSave({
      name: name.trim(),
      group: group.trim() || 'General',
    });
    onClose();
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title={i18nT('ui.editCategorySheet.editEnvelope')}>
      <View style={styles.container}>
        <View style={{ marginBottom: spacing.md }}>
          <TextInput
            label={i18nT('ui.editCategorySheet.categoryName')}
            value={name}
            onChangeText={(t) => {
              setName(t);
              if (error) setError('');
            }}
            error={error}
          />
        </View>

        <View style={{ marginBottom: spacing.lg }}>
          <TextInput
            label={i18nT('ui.editCategorySheet.categoryGroup')}
            value={group}
            onChangeText={setGroup}
            placeholder={i18nT('ui.editCategorySheet.eGDailyHomeFamily')}
          />
        </View>

        <Button
          label={i18nT('ui.editCategorySheet.saveEnvelope')}
          onPress={handleSave}
          variant="primary"
          size="lg"
        />

        {onDeleteRequest && (
          <TouchableOpacity
            onPress={() => {
              onDeleteRequest();
              onClose();
            }}
            style={[
              styles.deleteBtn,
              {
                marginTop: spacing.md,
                padding: spacing.sm,
                borderRadius: radii.md,
              },
            ]}
          >
            <Trash2 size={16} color={colors.statusDanger} />
            <Text
              style={{
                color: colors.statusDanger,
                fontFamily: typography.fonts.medium,
                fontSize: typography.sizes.sm,
                marginLeft: spacing.xs,
              }}
            >
              {i18nT('ui.editCategorySheet.deleteCategoryEnvelope')}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: 20,
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
