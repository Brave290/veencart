'use client';

import { Moon, Sun } from 'lucide-react';
import { createContext, useContext, useMemo, useSyncExternalStore, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

type Theme = 'light' | 'dark';
type ThemeContextValue = { theme: Theme; toggleTheme: () => void };
const ThemeContext = createContext<ThemeContextValue | null>(null);
const listeners = new Set<() => void>();
const subscribeTheme = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
const getTheme = (): Theme => document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
const getServerTheme = (): Theme => 'light';

export function ThemeProvider({ children }: { children: ReactNode }) {
  const theme = useSyncExternalStore(subscribeTheme, getTheme, getServerTheme);

  const value = useMemo(() => ({
    theme,
    toggleTheme: () => {
      const next = theme === 'dark' ? 'light' : 'dark';
      document.documentElement.dataset.theme = next;
      window.localStorage.setItem('veencart-theme', next);
      listeners.forEach((listener) => listener());
    },
  }), [theme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function ThemeToggle({ className, inverse = false }: { className?: string; inverse?: boolean }) {
  const context = useContext(ThemeContext);
  if (!context) return null;
  const isDark = context.theme === 'dark';
  return (
    <button
      type="button"
      onClick={context.toggleTheme}
      aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      title={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      className={cn(
        'grid size-10 place-items-center rounded-full border transition-colors duration-fast',
        inverse
          ? 'border-white/20 text-white hover:bg-white/10'
          : 'border-line-strong text-content-muted hover:border-primary hover:text-primary',
        className,
      )}
    >
      {isDark ? <Sun aria-hidden="true" className="size-4" /> : <Moon aria-hidden="true" className="size-4" />}
      <span className="sr-only">{isDark ? 'Light theme' : 'Dark theme'}</span>
    </button>
  );
}
