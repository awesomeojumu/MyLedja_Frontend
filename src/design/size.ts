import { useWindowDimensions } from 'react-native';

export const breakpoints = {
  tablet: 768,
  desktop: 1024,
  wide: 1280,
} as const;

export const maxContainerWidths = {
  content: 1140,
  formModal: 520,
  sheetMax: 600,
} as const;

export function useResponsive() {
  const { width, height } = useWindowDimensions();

  const isPhone = width < breakpoints.tablet;
  const isTablet = width >= breakpoints.tablet && width < breakpoints.desktop;
  const isDesktop = width >= breakpoints.desktop;
  const isWide = width >= breakpoints.wide;

  return {
    width,
    height,
    isPhone,
    isTablet,
    isDesktop,
    isWide,
  };
}
