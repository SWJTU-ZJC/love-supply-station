import { createContext, useContext, useState, useLayoutEffect, useCallback, type ReactNode } from 'react';

export type Theme = 'default' | 'latte' | 'lavender' | 'olive';
export type UIMode = 'default' | 'apple';

export const themeLabels: Record<Theme, string> = {
  default: '恋爱粉',
  latte: '焦糖拿铁',
  lavender: '雾紫灰调',
  olive: '橄榄暖灰',
};

export const uiModeLabels: Record<UIMode, string> = {
  default: '经典',
  apple: '苹果风',
};

export const themeColors: Record<Theme, { primary: string; accent: string; blue: string; green: string }> = {
  default: { primary: '#FFB3B3', accent: '#FFC3A0', blue: '#A0C4FF', green: '#A8E6CE' },
  latte:   { primary: '#C4A484', accent: '#D4A574', blue: '#8BA4B5', green: '#A3B89E' },
  lavender:{ primary: '#B8A4C4', accent: '#C4A494', blue: '#94A8B8', green: '#A4B8A8' },
  olive:   { primary: '#B0A890', accent: '#C8B8A0', blue: '#98A8B4', green: '#A0B8A4' },
};

interface ThemeContextType {
  theme: Theme;
  setTheme: (t: Theme) => void;
  uiMode: UIMode;
  setUIMode: (m: UIMode) => void;
}

const ThemeContext = createContext<ThemeContextType>({ theme: 'default', setTheme: () => {}, uiMode: 'default', setUIMode: () => {} });

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    try {
      const stored = localStorage.getItem('love-theme');
      if (stored && ['default', 'latte', 'lavender', 'olive'].includes(stored)) {
        return stored as Theme;
      }
    } catch {}
    return 'default';
  });

  const [uiMode, setUIModeState] = useState<UIMode>(() => {
    try {
      const stored = localStorage.getItem('love-ui');
      if (stored && ['default', 'apple'].includes(stored)) {
        return stored as UIMode;
      }
    } catch {}
    return 'default';
  });

  useLayoutEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('love-theme', theme);
  }, [theme]);

  useLayoutEffect(() => {
    document.documentElement.setAttribute('data-ui', uiMode);
    localStorage.setItem('love-ui', uiMode);
  }, [uiMode]);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
  }, []);

  const setUIMode = useCallback((m: UIMode) => {
    setUIModeState(m);
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, uiMode, setUIMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
