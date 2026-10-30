import { config } from '@/config';

/**
 * Figma overhaul kill-switch. Default off — old UI remains until Awesome approves a slice.
 * Backed by optional EXPO_PUBLIC_REDESIGN (read only via src/config).
 */
export function isRedesignEnabled(): boolean {
  return config.redesign;
}
