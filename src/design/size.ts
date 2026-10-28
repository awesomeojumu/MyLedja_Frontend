import { useWindowDimensions } from 'react-native';
import tokens from './tokens.json';

export type SizeClass = 'phone' | 'tablet' | 'desktop' | 'wide';

export function sizeClassFor(width: number): SizeClass {
  if (width >= tokens.breakpoint.wide) return 'wide';
  if (width >= tokens.breakpoint.desktop) return 'desktop';
  if (width >= tokens.breakpoint.tablet) return 'tablet';
  return 'phone';
}

export function useSizeClass(): SizeClass {
  const { width } = useWindowDimensions();
  return sizeClassFor(width);
}
