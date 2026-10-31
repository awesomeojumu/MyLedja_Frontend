import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AccessibilityInfo, useColorScheme } from 'react-native';
import { syncRedesignTheme } from './redesign/theme';
import { darkTheme, lightTheme, type Theme } from './theme';

export type ThemeChoice = 'system' | 'light' | 'dark';

type DesignContext = {
  theme: Theme;
  choice: ThemeChoice;
  setChoice: (c: ThemeChoice) => void;
  privacy: boolean;
  setPrivacy: (on: boolean) => void;
  reduceMotion: boolean;
};

const Ctx = createContext<DesignContext | null>(null);

export function DesignProvider({
  children,
  initialPrivacy = false,
  initialChoice = 'system',
  reduceMotionOverride,
}: {
  children: ReactNode;
  initialPrivacy?: boolean;
  initialChoice?: ThemeChoice;
  reduceMotionOverride?: boolean;
}) {
  const scheme = useColorScheme();
  const [choice, setChoice] = useState<ThemeChoice>(initialChoice);
  const [privacy, setPrivacy] = useState(initialPrivacy);
  const [systemReduceMotion, setSystemReduceMotion] = useState(false);

  useEffect(() => {
    if (reduceMotionOverride !== undefined) return;
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled?.().then((v) => alive && setSystemReduceMotion(v));
    const sub = AccessibilityInfo.addEventListener?.('reduceMotionChanged', setSystemReduceMotion);
    return () => {
      alive = false;
      sub?.remove();
    };
  }, [reduceMotionOverride]);

  const dark = choice === 'dark' || (choice === 'system' && scheme === 'dark');
  syncRedesignTheme(dark ? 'dark' : 'light');

  const value = useMemo<DesignContext>(() => {
    return {
      theme: dark ? darkTheme : lightTheme,
      choice,
      setChoice,
      privacy,
      setPrivacy,
      reduceMotion: reduceMotionOverride ?? systemReduceMotion,
    };
  }, [dark, choice, privacy, reduceMotionOverride, systemReduceMotion]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useDesign(): DesignContext {
  const v = useContext(Ctx);
  if (!v) throw new Error('DesignProvider missing');
  return v;
}

export function useTheme(): Theme {
  return useDesign().theme;
}
