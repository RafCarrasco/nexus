'use client';
import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { MessageCircle, X, Send } from 'lucide-react';

type Msg = { role: 'user' | 'assistant'; content: string };
type AiStatus = { configured: boolean; provider?: string; model?: string };

const PROVIDER_LABEL: Record<string, string> = {
  anthropic: 'Claude',
  openai: 'OpenAI',
  gemini: 'Gemini',
};

export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<AiStatus | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Hydrate message history from localStorage on mount.
  useEffect(() => {
    const ms = localStorage.getItem('nexus-chat-messages');
    if (ms) try { setMessages(JSON.parse(ms)); } catch { /* ignore */ }
  }, []);

  // Fetch AI config status (provider/model only — never the key) when first opened.
  useEffect(() => {
    if (!open || status) return;
    fetch('/api/ai-config')
      .then((r) => (r.ok ? r.json() : { configured: false }))
      .then((s: AiStatus) => setStatus(s))
      .catch(() => setStatus({ configured: false }));
  }, [open, status]);

  // Persist messages.
  useEffect(() => {
    localStorage.setItem('nexus-chat-messages', JSON.stringify(messages));
  }, [messages]);

  // Auto-scroll.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, busy]);

  const configured = status?.configured === true;

  async function send() {
    if (!input.trim() || busy || !configured) return;
    const next: Msg = { role: 'user', content: input.trim() };
    const history = [...messages, next];
    setMessages(history);
    setInput('');
    setBusy(true);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ messages: history }),
      });
      if (!res.ok) {
        const text = await res.text();
        setMessages([...history, { role: 'assistant', content: `Erro: ${text}` }]);
      } else {
        const { reply } = (await res.json()) as { reply: string };
        setMessages([...history, { role: 'assistant', content: reply }]);
      }
    } catch (e) {
      setMessages([...history, { role: 'assistant', content: `Erro: ${(e as Error).message}` }]);
    } finally {
      setBusy(false);
    }
  }

  const providerName = status?.provider ? (PROVIDER_LABEL[status.provider] ?? status.provider) : null;

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-violet-600 text-white shadow-lg hover:bg-violet-700"
          aria-label="Abrir assistente"
        >
          <MessageCircle className="h-5 w-5" />
        </button>
      )}
      {open && (
        <div className="fixed bottom-6 right-6 z-50 flex h-[560px] max-h-[calc(100vh-4rem)] w-96 max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-900">
          {/* Top bar */}
          <div className="flex h-12 shrink-0 items-center justify-between border-b border-zinc-200 bg-zinc-50 px-4 dark:border-zinc-700 dark:bg-zinc-800">
            <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Assistente{providerName ? <span className="ml-1 font-normal text-zinc-400">· {providerName}</span> : null}
            </div>
            <button
              onClick={() => setOpen(false)}
              className="text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
              aria-label="Fechar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Not-configured banner */}
          {status && !configured && (
            <div className="shrink-0 border-b border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
              IA ainda não configurada. Um admin pode definir o provedor e a chave em{' '}
              <Link href={'/settings/ai' as never} className="font-medium underline">
                Configurações → IA
              </Link>
              .
            </div>
          )}

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
            {messages.length === 0 && (
              <div className="mt-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
                {configured ? 'Olá! Pergunte o que quiser sobre os apps e incidentes.' : 'Configure a IA para começar.'}
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
                <div
                  className={
                    m.role === 'user'
                      ? 'max-w-[80%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-violet-600 px-3 py-2 text-sm text-white'
                      : 'max-w-[80%] whitespace-pre-wrap rounded-2xl rounded-bl-md bg-zinc-100 px-3 py-2 text-sm text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100'
                  }
                >
                  {m.content}
                </div>
              </div>
            ))}
            {busy && <div className="text-xs italic text-zinc-400">Pensando…</div>}
          </div>

          {/* Composer */}
          <div className="flex shrink-0 items-end gap-2 border-t border-zinc-200 p-3 dark:border-zinc-700">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
              placeholder={configured ? 'Digite sua mensagem…' : 'IA não configurada'}
              className="flex-1 resize-none rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-sm text-zinc-900 placeholder-zinc-400 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-100 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500 dark:focus:ring-violet-900"
              rows={1}
              disabled={busy || !configured}
            />
            <button
              onClick={() => void send()}
              disabled={busy || !input.trim() || !configured}
              className="flex h-8 w-8 items-center justify-center rounded-md bg-violet-600 text-white hover:bg-violet-700 disabled:bg-zinc-300"
              aria-label="Enviar"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
