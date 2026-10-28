import { AppFrame } from '@/features/frame/AppFrame';
import { t } from '@/i18n';

/** The Dashboard's cards arrive in Phase 1 (F1.8); Phase 0 lands here after sign-in and setup. */
export function DashboardScreen() {
  return <AppFrame title={t('dashboard.title')}>{null}</AppFrame>;
}
