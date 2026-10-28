/** A stand-in for expo-router in screen tests: jest.mock('expo-router', () => require('<path>/test/helpers/router')). */
export const router = { push: jest.fn(), replace: jest.fn(), back: jest.fn() };
let currentPath = '/';
export function setPathname(p: string) {
  currentPath = p;
}
export const useRouter = () => router;
export const usePathname = () => currentPath;
export const Redirect = () => null;
