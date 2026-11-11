import React, { createContext, useContext, useMemo } from 'react';
import { ThemeMode, getTheme, Theme } from './theme';

interface ThemeContextType {
  mode: ThemeMode;
  theme: Theme;
  isDark: boolean;
  setMode?: (mode: ThemeMode) => void;
}

const defaultTheme = getTheme('dark');

const ThemeContext = createContext<ThemeContextType>({
  mode: 'dark',
  theme: defaultTheme,
  isDark: true,
});

export const ThemeProvider: React.FC<{
  mode?: ThemeMode;
  onModeChange?: (mode: ThemeMode) => void;
  children: React.ReactNode;
}> = ({ mode = 'dark', onModeChange, children }) => {
  const value = useMemo(() => {
    const safeMode: ThemeMode = mode === 'light' ? 'light' : 'dark';
    const themeObj = getTheme(safeMode);
    return {
      mode: safeMode,
      theme: themeObj,
      isDark: themeObj.mode === 'dark',
      setMode: onModeChange,
    };
  }, [mode, onModeChange]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => useContext(ThemeContext);
