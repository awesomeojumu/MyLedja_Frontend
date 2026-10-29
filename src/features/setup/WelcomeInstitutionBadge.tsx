import { Image, View } from 'react-native';
import { Text } from '@/design/components';
import tokens from '@/design/tokens.json';
import type { Institution } from './institutions';

/** DESIGN 2.5: logo when the API has one; otherwise initials on a navy-tint tile. */
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
      {institution.logoUrl ? (
        <Image
          source={{ uri: institution.logoUrl }}
          accessibilityIgnoresInvertColors
          style={{
            width: 36,
            height: 36,
            borderRadius: tokens.radius['rounded-md'],
            backgroundColor: tokens.color['primary-bg-subdued-hover'],
          }}
        />
      ) : (
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: tokens.radius['rounded-md'],
            backgroundColor: tokens.color['primary-bg-subdued-hover'],
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text variant="micro" style={{ color: tokens.color['primary-deep'], fontFamily: 'Inter_400Regular' }}>
            {institution.initials}
          </Text>
        </View>
      )}
      <Text variant="caption" tone="textSecondary">
        {institution.label}
      </Text>
    </View>
  );
}
