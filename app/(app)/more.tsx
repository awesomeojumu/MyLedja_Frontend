import { Redirect } from 'expo-router';
import { isRedesignEnabled, RedesignMoreScreen } from '@/design/redesign';

/** More hub — only for redesign phone chrome. Old UI has no /more; redirect home. */
export default function MoreRoute() {
  if (!isRedesignEnabled()) return <Redirect href="/" />;
  return <RedesignMoreScreen />;
}
