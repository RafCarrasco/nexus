'use client';
import { Sun, Moon, Monitor } from 'lucide-react';
import { useTheme } from './theme-provider';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  return (
    <div className="flex items-center gap-0.5 rounded-full border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 p-0.5">
      {(['light', 'dark', 'system'] as const).map((t) => {
        const Icon = t === 'light' ? Sun : t === 'dark' ? Moon : Monitor;
        const active = theme === t;
        return (
          <button
            key={t}
            onClick={() => setTheme(t)}
            className={`h-6 w-6 rounded-full flex items-center justify-center transition ${active ? 'bg-white dark:bg-zinc-700 shadow-sm' : 'hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}
            title={t === 'light' ? 'Modo claro' : t === 'dark' ? 'Modo escuro' : 'Sistema'}
          >
            <Icon className={`h-3.5 w-3.5 ${active ? 'text-violet-600 dark:text-violet-400' : 'text-zinc-500 dark:text-zinc-400'}`} />
          </button>
        );
      })}
    </div>
  );
}
