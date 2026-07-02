import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'appTheme';

export type Theme = 'light' | 'dark';

export interface ThemeColors {
  // Backgrounds
  background: string;
  surface: string;
  surfaceSecondary: string;
  modalBackground: string;
  searchBar: string;
  // Borders
  border: string;
  borderSubtle: string;
  // Text
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textDisabled: string;
  // Accent
  accent: string;
  // Bonus banner
  bonusBg: string;
  bonusBorder: string;
  // Card type badge base
  badgeDefault: string;
  // Misc
  iconMuted: string;
  disclaimerText: string;
}

const lightColors: ThemeColors = {
  background: '#F5F5F5',
  surface: '#FFFFFF',
  surfaceSecondary: '#F0F0F0',
  modalBackground: '#FAFAFA',
  searchBar: '#EBEBEB',
  border: '#E0E0E0',
  borderSubtle: '#ECECEC',
  textPrimary: '#111111',
  textSecondary: '#444444',
  textMuted: '#888888',
  textDisabled: '#BBBBBB',
  accent: '#B8892A',
  bonusBg: '#FFF8E7',
  bonusBorder: '#E8CC7A',
  badgeDefault: '#E8E8E8',
  iconMuted: '#888888',
  disclaimerText: '#AAAAAA',
};

const darkColors: ThemeColors = {
  background: '#0D0D0D',
  surface: '#1A1A1A',
  surfaceSecondary: '#141414',
  modalBackground: '#141414',
  searchBar: '#1E1E1E',
  border: '#252525',
  borderSubtle: '#222222',
  textPrimary: '#FFFFFF',
  textSecondary: '#CCCCCC',
  textMuted: '#FFFFFF',
  textDisabled: '#888888',
  accent: '#D4A843',
  bonusBg: '#1E1600',
  bonusBorder: '#3A2D00',
  badgeDefault: '#2A2A2A',
  iconMuted: '#AAAAAA',
  disclaimerText: '#444444',
};

export const getColors = (theme: Theme): ThemeColors =>
  theme === 'dark' ? darkColors : lightColors;

interface ThemeContextValue {
  theme: Theme;
  colors: ThemeColors;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'light',
  colors: lightColors,
  toggleTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('light');

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (stored === 'dark' || stored === 'light') {
        setTheme(stored);
      }
    });
  }, []);

  const toggleTheme = () => {
    setTheme((prev) => {
      const next: Theme = prev === 'light' ? 'dark' : 'light';
      AsyncStorage.setItem(STORAGE_KEY, next);
      return next;
    });
  };

  return (
    <ThemeContext.Provider value={{ theme, colors: getColors(theme), toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
