import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { lightColors, darkColors, type ColorTheme, typography, spacing, radii } from './tokens';
import { openKeyValue } from '../data/kv';

export type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeContextType {
  mode: ThemeMode;
  isDark: boolean;
  colors: ColorTheme;
  typography: typeof typography;
  spacing: typeof spacing;
  radii: typeof radii;
  setThemeMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

const THEME_STORAGE_KEY = 'user_theme_mode';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemColorScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('light'); // default Light theme
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    async function loadSavedTheme() {
      try {
        const kv = openKeyValue('myledja');
        const saved = await kv.get(THEME_STORAGE_KEY);
        if (saved === 'light' || saved === 'dark' || saved === 'system') {
          setModeState(saved);
        }
      } catch {
        // Fallback to light
      } finally {
        setIsLoaded(true);
      }
    }
    loadSavedTheme();
  }, []);

  const setThemeMode = (newMode: ThemeMode) => {
    setModeState(newMode);
    try {
      const kv = openKeyValue('myledja');
      kv.set([[THEME_STORAGE_KEY, newMode]]);
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
    return isDark ? darkColors : lightColors;
  }, [isDark]);

  const value = useMemo(
    () => ({
      mode,
      isDark,
      colors,
      typography,
      spacing,
      radii,
      setThemeMode,
      toggleTheme,
    }),
    [mode, isDark, colors]
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
      colors: lightColors,
      typography,
      spacing,
      radii,
      setThemeMode: () => {},
      toggleTheme: () => {},
    };
  }
  return context;
}
