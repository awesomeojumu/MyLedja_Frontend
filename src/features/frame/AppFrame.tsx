import type { ReactNode } from 'react';
import { View } from 'react-native';
import { useSizeClass } from '@/design/size';
import { RedesignAppFrame } from '@/design/redesign';
import { DesktopFrame } from './DesktopFrame';

export function AppFrame({
  title,
  children,
  trailing,
  offlineMessage,
}: {
  title: string;
  children: ReactNode;
  /** Redesign phone only — overrides default top-bar trailing. */
  trailing?: ReactNode;
  /** Redesign phone only — overrides offline strip copy. */
  offlineMessage?: string;
}) {
  const size = useSizeClass();
  const phone = size === 'phone';

  if (phone) {
    return (
      <RedesignAppFrame title={title} trailing={trailing} offlineMessage={offlineMessage}>
        {children}
      </RedesignAppFrame>
    );
  }

  return (
    <DesktopFrame>
      <View nativeID="main" style={{ flex: 1 }}>
        {children}
      </View>
    </DesktopFrame>
  );
}
