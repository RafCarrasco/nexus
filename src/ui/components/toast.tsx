'use client';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { X, CheckCircle2, AlertTriangle, Info } from 'lucide-react';

type Kind = 'success' | 'error' | 'info';

type Toast = {
  id: number;
  message: string;
  kind: Kind;
};

type ToastCtx = {
  toast: (message: string, kind?: Kind) => void;
};

const ToastContext = createContext<ToastCtx | null>(null);

let counter = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((message: string, kind: Kind = 'success') => {
    const id = ++counter;
    setToasts((prev) => [...prev, { id, message, kind }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  function dismiss(id: number) {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <Toaster toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

const KIND_STYLES: Record<Kind, string> = {
  success: 'bg-emerald-50 border-emerald-200 text-emerald-900',
  error:   'bg-red-50 border-red-200 text-red-900',
  info:    'bg-violet-50 border-violet-200 text-violet-900',
};

const KIND_ICONS: Record<Kind, typeof CheckCircle2> = {
  success: CheckCircle2,
  error:   AlertTriangle,
  info:    Info,
};

const ICON_COLORS: Record<Kind, string> = {
  success: 'text-emerald-500',
  error:   'text-red-500',
  info:    'text-violet-500',
};

function Toaster({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }) {
  if (toasts.length === 0) return null;
  return (
    <div
      aria-live="polite"
      className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 items-end"
    >
      {toasts.map((t) => {
        const Icon = KIND_ICONS[t.kind];
        return (
          <div
            key={t.id}
            className={`flex items-start gap-3 rounded-xl border px-4 py-3 shadow-lg max-w-sm animate-in fade-in slide-in-from-bottom-2 duration-200 ${KIND_STYLES[t.kind]}`}
          >
            <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${ICON_COLORS[t.kind]}`} />
            <span className="text-sm flex-1">{t.message}</span>
            <button
              onClick={() => onDismiss(t.id)}
              className="shrink-0 text-current opacity-50 hover:opacity-80 transition-opacity"
              title="Fechar"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
