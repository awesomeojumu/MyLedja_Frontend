import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import {
  lightColors,
  darkColors,
  type ColorTheme,
  typography,
  spacing,
  radii,
  type ThemeAccent,
  THEME_ACCENTS,
} from './tokens';
import { openKeyValue } from '../data/kv';

export type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeContextType {
  mode: ThemeMode;
  isDark: boolean;
  accent: ThemeAccent;
  colors: ColorTheme;
  typography: typeof typography;
  spacing: typeof spacing;
  radii: typeof radii;
  setThemeMode: (mode: ThemeMode) => void;
  setAccent: (accent: ThemeAccent) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

const THEME_STORAGE_KEY = 'user_theme_mode';
const ACCENT_STORAGE_KEY = 'user_theme_accent';

function getInitialThemeMode(): ThemeMode {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const saved = window.localStorage.getItem(`myledja:${THEME_STORAGE_KEY}`);
      if (saved === 'light' || saved === 'dark' || saved === 'system') {
        return saved;
      }
    } catch {
      // Ignore
    }
  }
  return 'light';
}

function getInitialAccent(): ThemeAccent {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const saved = window.localStorage.getItem(`myledja:${ACCENT_STORAGE_KEY}`);
      if (saved && THEME_ACCENTS.some((a) => a.id === saved)) {
        return saved as ThemeAccent;
      }
    } catch {
      // Ignore
    }
  }
  return 'blue';
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemColorScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>(getInitialThemeMode);
  const [accent, setAccentState] = useState<ThemeAccent>(getInitialAccent);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    async function loadSavedTheme() {
      try {
        const kv = openKeyValue('myledja');
        const savedMode = await kv.get(THEME_STORAGE_KEY);
        if (savedMode === 'light' || savedMode === 'dark' || savedMode === 'system') {
          setModeState(savedMode);
        }
        const savedAccent = await kv.get(ACCENT_STORAGE_KEY);
        if (savedAccent && THEME_ACCENTS.some((a) => a.id === savedAccent)) {
          setAccentState(savedAccent as ThemeAccent);
        }
      } catch {
        // Fallback to light and cobalt blue
      } finally {
        setIsLoaded(true);
      }
    }
    loadSavedTheme();
  }, []);

  const setThemeMode = (newMode: ThemeMode) => {
    setModeState(newMode);
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem(`myledja:${THEME_STORAGE_KEY}`, newMode);
      } catch {
        // Ignore storage errors
      }
    }
    try {
      const kv = openKeyValue('myledja');
      kv.set([[THEME_STORAGE_KEY, newMode]]);
    } catch {
      // Ignore storage errors
    }
  };

  const setAccent = (newAccent: ThemeAccent) => {
    setAccentState(newAccent);
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem(`myledja:${ACCENT_STORAGE_KEY}`, newAccent);
      } catch {
        // Ignore storage errors
      }
    }
    try {
      const kv = openKeyValue('myledja');
      kv.set([[ACCENT_STORAGE_KEY, newAccent]]);
    } catch {
      // Ignore storage errors
    }
  };

  const isDark = useMemo(() => {
    if (mode === 'system') return systemColorScheme === 'dark';
    return mode === 'dark';
  }, [mode, systemColorScheme]);

  const toggleTheme = () => {
    setThemeMode(isDark ? 'light' : 'dark');
  };

  const colors = useMemo(() => {
    const base = isDark ? darkColors : lightColors;
    const accentDef = THEME_ACCENTS.find((a) => a.id === accent) ?? THEME_ACCENTS[0]!;
    const overrides = isDark ? accentDef.dark : accentDef.light;
    return {
      ...base,
      ...overrides,
    };
  }, [isDark, accent]);

  const value = useMemo(
    () => ({
      mode,
      isDark,
      accent,
      colors,
      typography,
      spacing,
      radii,
      setThemeMode,
      setAccent,
      toggleTheme,
    }),
    [mode, isDark, accent, colors]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext);
  if (!context) {
    // Return sensible fallback if used outside provider
    return {
      mode: 'light',
      isDark: false,
      accent: 'blue',
      colors: lightColors,
      typography,
      spacing,
      radii,
      setThemeMode: () => {},
      setAccent: () => {},
      toggleTheme: () => {},
    };
  }
  return context;
}
