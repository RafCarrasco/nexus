'use client';
import { useEffect, useState, useRef } from 'react';
import { MessageCircle, X, Settings, Send } from 'lucide-react';

type Msg = { role: 'user' | 'assistant'; content: string };
type Provider = 'anthropic' | 'openai';
const DEFAULT_MODEL: Record<Provider, string> = {
  anthropic: 'claude-sonnet-4-5',
  openai: 'gpt-4o-mini',
};

export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [provider, setProvider] = useState<Provider>('anthropic');
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('');
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Hydrate from localStorage on mount
  useEffect(() => {
    const p = (localStorage.getItem('nexus-chat-provider') as Provider) || 'anthropic';
    const k = localStorage.getItem('nexus-chat-key') || '';
    const m = localStorage.getItem('nexus-chat-model') || '';
    const ms = localStorage.getItem('nexus-chat-messages');
    setProvider(p);
    setApiKey(k);
    setModel(m);
    if (ms) try { setMessages(JSON.parse(ms)); } catch { /* ignore */ }
    if (!k) setShowConfig(true);
  }, []);

  // Persist messages
  useEffect(() => {
    localStorage.setItem('nexus-chat-messages', JSON.stringify(messages));
  }, [messages]);

  // Auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, busy]);

  async function send() {
    if (!input.trim() || !apiKey || busy) return;
    const next: Msg = { role: 'user', content: input.trim() };
    const history = [...messages, next];
    setMessages(history);
    setInput('');
    setBusy(true);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          provider, apiKey,
          model: model || DEFAULT_MODEL[provider],
          messages: history,
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        setMessages([...history, { role: 'assistant', content: `Erro: ${text}` }]);
      } else {
        const { reply } = await res.json() as { reply: string };
        setMessages([...history, { role: 'assistant', content: reply }]);
      }
    } catch (e) {
      setMessages([...history, { role: 'assistant', content: `Erro: ${(e as Error).message}` }]);
    } finally {
      setBusy(false);
    }
  }

  function saveConfig() {
    localStorage.setItem('nexus-chat-provider', provider);
    localStorage.setItem('nexus-chat-key', apiKey);
    localStorage.setItem('nexus-chat-model', model);
    setShowConfig(false);
  }

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 h-12 w-12 rounded-full bg-violet-600 hover:bg-violet-700 text-white shadow-lg flex items-center justify-center z-50"
          aria-label="Abrir assistente"
        >
          <MessageCircle className="h-5 w-5" />
        </button>
      )}
      {open && (
        <div className="fixed bottom-6 right-6 w-96 h-[560px] max-w-[calc(100vw-2rem)] max-h-[calc(100vh-4rem)] rounded-2xl border border-zinc-200 bg-white shadow-2xl flex flex-col overflow-hidden z-50">
          {/* Top bar */}
          <div className="h-12 bg-zinc-50 border-b border-zinc-200 flex items-center justify-between px-4 shrink-0">
            <div className="text-sm font-semibold">Assistente</div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowConfig(!showConfig)}
                className="text-zinc-500 hover:text-zinc-900"
                aria-label="Configurações"
              >
                <Settings className="h-4 w-4" />
              </button>
              <button
                onClick={() => setOpen(false)}
                className="text-zinc-500 hover:text-zinc-900"
                aria-label="Fechar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Config form */}
          {showConfig && (
            <div className="bg-amber-50 border-b border-amber-200 p-3 space-y-2 shrink-0">
              <div className="space-y-1">
                <label className="text-xs font-medium text-amber-900">Provedor</label>
                <select
                  value={provider}
                  onChange={(e) => setProvider(e.target.value as Provider)}
                  className="w-full rounded-md border border-amber-200 bg-white px-2 py-1 text-sm"
                >
                  <option value="anthropic">Anthropic Claude</option>
                  <option value="openai">OpenAI</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-amber-900">Chave de API</label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={provider === 'anthropic' ? 'sk-ant-...' : 'sk-...'}
                  className="w-full rounded-md border border-amber-200 bg-white px-2 py-1 text-sm"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-amber-900">Modelo (opcional)</label>
                <input
                  type="text"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  placeholder={DEFAULT_MODEL[provider]}
                  className="w-full rounded-md border border-amber-200 bg-white px-2 py-1 text-sm"
                />
              </div>
              <button
                onClick={saveConfig}
                className="w-full rounded-md bg-violet-600 hover:bg-violet-700 text-white text-sm py-1.5"
              >
                Salvar
              </button>
              <p className="text-xs text-amber-700">
                Sua chave fica apenas neste navegador (localStorage). Nunca é salva no servidor.
              </p>
            </div>
          )}

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 && !showConfig && (
              <div className="text-sm text-zinc-500 text-center mt-8">
                Olá! Configure sua chave de API e comece a conversar.
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
                <div
                  className={
                    m.role === 'user'
                      ? 'bg-violet-600 text-white rounded-2xl rounded-br-md px-3 py-2 max-w-[80%] text-sm whitespace-pre-wrap'
                      : 'bg-zinc-100 text-zinc-900 rounded-2xl rounded-bl-md px-3 py-2 max-w-[80%] text-sm whitespace-pre-wrap'
                  }
                >
                  {m.content}
                </div>
              </div>
            ))}
            {busy && <div className="text-xs text-zinc-400 italic">Pensando…</div>}
          </div>

          {/* Composer */}
          <div className="border-t border-zinc-200 p-3 flex items-end gap-2 shrink-0">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
              placeholder="Digite sua mensagem…"
              className="flex-1 resize-none rounded-md border border-zinc-200 px-2 py-1.5 text-sm focus:border-violet-500 focus:ring-2 focus:ring-violet-100 focus:outline-none"
              rows={1}
              disabled={busy}
            />
            <button
              onClick={() => void send()}
              disabled={busy || !input.trim() || !apiKey}
              className="h-8 w-8 rounded-md bg-violet-600 hover:bg-violet-700 disabled:bg-zinc-300 text-white flex items-center justify-center"
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
