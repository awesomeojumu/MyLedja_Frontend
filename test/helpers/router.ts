import { useSyncExternalStore } from 'react';

/** A stand-in for expo-router in screen tests: jest.mock('expo-router', () => require('<path>/test/helpers/router')). */
let params: Record<string, string | undefined> = {};
const listeners = new Set<() => void>();

export function setParams(next: Record<string, string | undefined>) {
  params = { ...params, ...next };
  for (const key of Object.keys(params)) if (params[key] === undefined) delete params[key];
  for (const l of listeners) l();
}

export function resetParams() {
  params = {};
  for (const l of listeners) l();
}

export const router = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), setParams: jest.fn(setParams) };
let currentPath = '/';
export function setPathname(p: string) {
  currentPath = p;
}
export const useRouter = () => router;
export const useNavigation = () => ({
  addListener: (_event: string, _cb: unknown) => () => {},
  dispatch: jest.fn(),
  goBack: jest.fn(),
  canGoBack: () => false,
});
export const usePathname = () => currentPath;
export const useGlobalSearchParams = () =>
  useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => params,
  );
export const useLocalSearchParams = useGlobalSearchParams;
export const Redirect = () => null;
