import { Platform, useWindowDimensions } from 'react-native';
import { sizeClassFor } from '@/design/size';

/** DESIGN pages 1–3: hero from ~900 on web; tablet portrait is card-only; landscape matches web. */
export function useShowAuthHero(): boolean {
  const { width, height } = useWindowDimensions();
  const size = sizeClassFor(width);
  if (size === 'phone') return false;
  if (size === 'desktop' || size === 'wide') return true;
  if (size === 'tablet') {
    if (Platform.OS === 'web' && width >= 900) return true;
    return width > height;
  }
  return false;
}

export const authHeroMinWidth = 900;
