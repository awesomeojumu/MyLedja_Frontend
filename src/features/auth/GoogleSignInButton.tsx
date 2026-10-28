import { Button } from '@/design/components';
import { t } from '@/i18n';

export function GoogleSignInButton({
  onPress,
  disabled,
  testID = 'google-sign-in',
}: {
  onPress: () => void;
  disabled?: boolean;
  testID?: string;
}) {
  return <Button testID={testID} kind="secondary" label={t('auth.google')} fullWidth disabled={disabled} onPress={onPress} />;
}
