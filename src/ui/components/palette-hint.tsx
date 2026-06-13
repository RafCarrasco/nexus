'use client';

export function PaletteHint() {
  function open() {
    window.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }),
    );
  }
  return (
    <button
      type="button"
      onClick={open}
      aria-label="Abrir busca rápida (Ctrl K)"
      className="hidden sm:flex items-center gap-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 px-2.5 py-1 text-xs text-zinc-500 dark:text-zinc-400 hover:border-violet-300 dark:hover:border-violet-700 hover:text-violet-600 dark:hover:text-violet-400 transition"
    >
      <span>Buscar</span>
      <kbd className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded px-1 py-0.5 text-[10px] leading-none">
        Ctrl
      </kbd>
      <kbd className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded px-1 py-0.5 text-[10px] leading-none">
        K
      </kbd>
    </button>
  );
}
