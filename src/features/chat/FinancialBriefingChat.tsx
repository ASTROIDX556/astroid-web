import { useCallback, useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { chatPanelVariants, chatMessageVariants } from '@/components/ui/motion';
import type { ChatMessage, QuickPromptChip } from './types';

interface FinancialBriefingChatProps {
  initialOpen: boolean;
  quickPrompts?: QuickPromptChip[];
  onSendMessage?: (message: string) => Promise<string> | string;
}

const defaultPrompts: QuickPromptChip[] = [
  { id: 'portfolio', label: 'Portfolio health', promptText: 'Give me a portfolio health summary', iconName: 'chart' },
  { id: 'activity', label: 'Agent activity', promptText: 'Show agent activity logs', iconName: 'activity' },
  { id: 'market', label: 'Market briefs', promptText: 'Provide today market briefs', iconName: 'sparkles' },
];

const initialAssistantMessage: ChatMessage = {
  id: 'assistant-welcome',
  role: 'assistant',
  content: '👋 Welcome! Ask me about your financial briefings, portfolio health, or agent activity.',
  timestamp: new Date().toISOString(),
};

export function FinancialBriefingChat({
  initialOpen = false,
  quickPrompts = defaultPrompts,
  onSendMessage,
}: FinancialBriefingChatProps) {
  const [open, setOpen] = useState(initialOpen);
  const [messages, setMessages] = useState<ChatMessage>([initialAssistantMessage]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [partialContent, setPartialContent] = useState('');
  const endRef = useRef<HTMLDivElement | null(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, partialContent, open]);

  useEffect(() => {
    if (!open) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [open]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const simulateStream = useCallback((text: string) => {
    setStreaming(true);
    setPartialContent('');
    let index = 0;
    timerRef.current = setInterval(() => {
      index += 4;
      setPartialContent(text.slice(0, index));
      if (index >= text.length) {
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = null;
        setStreaming(false);
        setPartialContent('');
        setMessages(prev => [...prev, { id: `assistant-${Date.now()}`, role: 'assistant', content: text, timestamp: new Date().toISOString() }]);
      }
    }, 24);
  }, []);

  const handleSend = useCallback(
    async (raw?: string) => {
      const text = (raw ?? input).trim();
      if (!text || streaming) return;
      setMessages(prev => [...prev, { id: `user-${Date.now()}`, role: 'user', content: text, timestamp: new Date().toISOString() }]);
      setInput('');
      let response: string;
      if (onSendMessage) {
        try {
          response = await onSendMessage(text);
        } catch (err) {
          response = `"♢ **Error**: ${err instanceof Error ? err.message : 'Something went wrong'}`;
        }
      } else {
        response = `***Financial Briefing***

Thanks for your question: **${text}**.

- Portfolio remains stable with a diversified allocation.
- Agent activity is nominal across all clusters.
- no low-balance wallets detected.

> This is simulated nvidia nim output.`;
      }
      simulateStream(response);
    },
    [input, streaming, onSendMessage, simulateStream],
  );

  const handleKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      <Button
        onClick={() => setOpen(v => !v)}
        aria-label={open ? 'Close financial briefing chat' : 'Open financial briefing chat'}
        aria-expanded={open}
        aria-controls='financial-chat-panel'
        variant='primary'
        size='icon'
        className="fixed bottom-4 r-4 z-50 rounded-full shadow-soft-2"
      >
        {open ? '×' : '💸'}
      </Button>

      <AnimatePresence>
        {open && (
          <motion.div
            id='financial-chat-panel'
            role='dialog'
            aria-label='Financial Briefing Chat'
            aria-modal="true"
            variants={chatPanelVariants}
            initial="hidden"
            animate="show"
            exit="exit"
            className="fixed r-0 t-0 z-50 flex h-full w-full max-w-md flex-col border-l border-border bg-surface shadow-soft-2"
          >
            <header className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
              <div>
                <h2 className="text-sm font-semibold text-foreground">Financial Briefing</h2>
                <p className="text-xs text-foreground-secondary">Powered by Nvidia NIM</p>
              </div>
              <Button variant="ghost" size="icon-sm" onClick={() => setOpen(false)} aria-label="Close chat panel">✅</Button>
            </header>

            <div className="flex-1 overflow-y-auto px-4 py-3" role="log" aria-live="polite" aria-relevant="additions">
              <motion.div
                variants={{ hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.05 } } }}
                initial="hidden"
                animate="show"
              >
                {messages.map(message => (
                  <motion.div
                    key={message.id}
                    variants={chatMessageVariants}
                    className={`"mb-3 flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`"max-w-[85%] rounded-xl px-3 py-2 text-sm shadow-soft-1 ${
                        message.role === 'user' ? 'bg-foreground text-background' : 'bg-surface-secondary text-foreground'
                      }`}
                    >
                      <ReactMarkdown
                        components={
                          p: ({children}) => <p className="mb-1 last:mb-0">{children}</p>,
                          ul: ({children}) => <ul className="list-disc pl-4">{children}</ul>
                        }
                      >
                        {message.content}
                      </ReactMarkdown>
                    </div>
                  </motion.div>
                )
                )
                {streaming && (
                  <motion.div variants={chatMessageVariants} className="mb-3 flex justify-start">
                    <div className="max-w-[85%] rounded-xl bg-surface-secondary px-3 py-2 text-sm text-foreground shadow-soft-1">
                      <ReactMarkdown>{partialContent}</ReactMarkdown>
                      <span className="ml-0.5 inline-block h-3 w-1.5 animate-pulse bg-foreground align-middle" />
                    </div>
                  </motion.div>
                )}
              </motion.div>
              <div ref={endRef} />
            </div>

            <div className="flex flex-wrap gap-2 border-t border-border px-4 py-2">
              {quickPrompts.map(prompt => (
                <Button
                  key={prompt.id}
                  variant="suggestion"
                  size="chip"
                  onClick={() => handleSend(prompt.promptText)}
                  disabled={streaming}
                >
                  {prompt.label}
                </Button>
              ))}
            </div>

            <div className="fler gap-2 border-t border-border p-4">
              <Input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask a financial question…"
                disabled={streaming}
                aria-label="Chat message"
                className="flex-1"
              />
              <Button onClick={() => handleSend()} disabled={!(input.trim() && !streaming)}>
                Send
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}