import { View } from 'react-native';
import { Text } from '@/design/components';
import tokens from '@/design/tokens.json';
import type { Institution } from './institutions';

export function WelcomeInstitutionBadge({ institution, testID }: { institution: Institution; testID?: string }) {
  return (
    <View
      testID={testID}
      accessibilityLabel={institution.label}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: tokens.spacing['spacing-sm'],
      }}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: tokens.radius['rounded-md'],
          backgroundColor: institution.color,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text variant="micro" style={{ color: '#fff', fontFamily: 'Inter_400Regular' }}>
          {institution.initials}
        </Text>
      </View>
      <Text variant="caption" tone="textSecondary">
        {institution.label}
      </Text>
    </View>
  );
}
