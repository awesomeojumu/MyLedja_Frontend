import { useFonts } from 'expo-font';

/** Self-hosted Figtree (Google Fonts OFL) — used only when EXPO_PUBLIC_REDESIGN is on. */
export const FIGTREE = {
  light: 'Figtree-Light',
  regular: 'Figtree-Regular',
  medium: 'Figtree-Medium',
  semiBold: 'Figtree-SemiBold',
  bold: 'Figtree-Bold',
} as const;

export type FigtreeWeight = '300' | '400' | '500' | '600' | '700';

export function figtreeFamily(weight: FigtreeWeight = '400'): string {
  switch (weight) {
    case '300':
      return FIGTREE.light;
    case '500':
      return FIGTREE.medium;
    case '600':
      return FIGTREE.semiBold;
    case '700':
      return FIGTREE.bold;
    default:
      return FIGTREE.regular;
  }
}

export function useFigtreeFonts(): boolean {
  const [loaded] = useFonts({
    [FIGTREE.light]: require('../../../assets/fonts/figtree/Figtree-Light.ttf'),
    [FIGTREE.regular]: require('../../../assets/fonts/figtree/Figtree-Regular.ttf'),
    [FIGTREE.medium]: require('../../../assets/fonts/figtree/Figtree-Medium.ttf'),
    [FIGTREE.semiBold]: require('../../../assets/fonts/figtree/Figtree-SemiBold.ttf'),
    [FIGTREE.bold]: require('../../../assets/fonts/figtree/Figtree-Bold.ttf'),
  });
  return loaded;
}
