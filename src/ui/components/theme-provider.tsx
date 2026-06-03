'use client';
import { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark' | 'system';
type Resolved = 'light' | 'dark';

const Ctx = createContext<{ theme: Theme; resolved: Resolved; setTheme: (t: Theme) => void } | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('system');
  const [resolved, setResolved] = useState<Resolved>('light');

  // Initial mount — read localStorage
  useEffect(() => {
    const saved = (localStorage.getItem('nexus-theme') as Theme | null) ?? 'system';
    setThemeState(saved);
  }, []);

  // Resolve & apply class to <html>
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    function compute(): Resolved {
      if (theme === 'system') return mq.matches ? 'dark' : 'light';
      return theme;
    }
    function apply() {
      const r = compute();
      setResolved(r);
      document.documentElement.classList.toggle('dark', r === 'dark');
    }
    apply();
    const handler = () => { if (theme === 'system') apply(); };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [theme]);

  function setTheme(t: Theme) {
    localStorage.setItem('nexus-theme', t);
    setThemeState(t);
  }

  return <Ctx.Provider value={{ theme, resolved, setTheme }}>{children}</Ctx.Provider>;
}

export function useTheme() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useTheme outside ThemeProvider');
  return ctx;
}
