import React, { createContext, useContext, useState, useEffect } from 'react';
import { Theme, ThemeColors, lightTheme, darkTheme } from '../components/landing/types';

interface ThemeContextType {
  theme: Theme;
  c: ThemeColors;
  isDark: boolean;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem('lp_theme') as Theme) || 'light');

  useEffect(() => {
    localStorage.setItem('lp_theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme(prev => prev === 'light' ? 'dark' : 'light');
  
  const isDark = theme === 'dark';
  const c = isDark ? darkTheme : lightTheme;

  return (
    <ThemeContext.Provider value={{ theme, c, isDark, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
