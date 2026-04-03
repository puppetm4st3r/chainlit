import { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'dark' | 'light' | 'system';

type ThemeProviderProps = {
  children: React.ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
};

type ThemeProviderState = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
};

const initialState: ThemeProviderState = {
  theme: 'system',
  setTheme: () => null
};

const ThemeProviderContext = createContext<ThemeProviderState>(initialState);

function isTheme(value: unknown): value is Theme {
  return value === 'light' || value === 'dark' || value === 'system';
}

function parseThemeControlMessage(data: unknown): { type: string; theme?: Theme } | null {
  if (typeof data === 'string') {
    const trimmed = data.trim();
    if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) return null;
    try {
      return parseThemeControlMessage(JSON.parse(trimmed));
    } catch {
      return null;
    }
  }

  if (!data || typeof data !== 'object') return null;

  const candidate = data as { type?: unknown; theme?: unknown };
  if (typeof candidate.type !== 'string') return null;
  if (candidate.theme !== undefined && !isTheme(candidate.theme)) return null;

  return {
    type: candidate.type,
    theme: candidate.theme
  };
}

function postThemeMessage(message: Record<string, unknown>) {
  if (typeof window === 'undefined' || window.parent === window) return;
  window.parent.postMessage(JSON.stringify(message), '*');
}

function applyThemeVariables(variant: 'dark' | 'light') {
  if (!window.theme) return;

  const variables = window.theme[variant];
  if (!variables) return;

  const root = window.document.documentElement;

  // Apply new theme variables
  Object.entries(variables).forEach(([key, value]) => {
    root.style.setProperty(key, value);
  });
}

export function ThemeProvider({
  children,
  defaultTheme = 'system',
  storageKey = 'vite-ui-theme',
  ...props
}: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem(storageKey) as Theme) || defaultTheme
  );
  useEffect(() => {
    const root = window.document.documentElement;

    root.classList.remove('light', 'dark');

    if (theme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)')
        .matches
        ? 'dark'
        : 'light';

      root.classList.add(systemTheme);
      applyThemeVariables(systemTheme);
      return;
    } else {
      applyThemeVariables(theme);
    }

    root.classList.add(theme);
  }, [theme]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = parseThemeControlMessage(event.data);
      if (!message || message.type !== 'host:set_theme' || !message.theme) return;
      localStorage.setItem(storageKey, message.theme);
      setTheme(message.theme);
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [storageKey]);

  useEffect(() => {
    postThemeMessage({ type: 'chainlit:theme_sync_request' });
  }, []);

  useEffect(() => {
    const effectiveTheme =
      theme === 'system'
        ? window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light'
        : theme;

    postThemeMessage({
      type: 'chainlit:theme_changed',
      theme,
      effectiveTheme
    });
  }, [theme]);

  const value = {
    theme,
    setTheme: (theme: Theme) => {
      localStorage.setItem(storageKey, theme);
      setTheme(theme);
    }
  };

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  );
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext);

  if (context === undefined)
    throw new Error('useTheme must be used within a ThemeProvider');

  const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';

  const variant = context.theme === 'system' ? systemTheme : context.theme;

  return { ...context, variant };
};
