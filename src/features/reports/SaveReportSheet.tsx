import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme, BottomSheet, TextInput, Button } from '../../design';

import { t as i18nT } from '../../i18n';
interface SaveReportSheetProps {
  visible: boolean;
  onClose: () => void;
  onSave: (title: string) => void;
}

export function SaveReportSheet({
  visible,
  onClose,
  onSave,
}: SaveReportSheetProps) {
  const { spacing } = useTheme();
  const [title, setTitle] = useState('');
  const [error, setError] = useState('');

  const handleSave = () => {
    if (!title.trim()) {
      setError('Report title is required');
      return;
    }
    onSave(title.trim());
    setTitle('');
    setError('');
    onClose();
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title={i18nT('ui.saveReportSheet.saveCustomReport')}>
      <View style={styles.container}>
        <View style={{ marginBottom: spacing.lg }}>
          <TextInput
            label={i18nT('ui.saveReportSheet.reportTitle')}
            placeholder={i18nT('ui.saveReportSheet.eGQ4BusinessTravel')}
            value={title}
            onChangeText={(t) => {
              setTitle(t);
              if (error) setError('');
            }}
            error={error}
            autoFocus
          />
        </View>

        <Button
          label={i18nT('ui.saveReportSheet.saveReport')}
          onPress={handleSave}
          variant="primary"
          size="lg"
        />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: 20,
  },
});
