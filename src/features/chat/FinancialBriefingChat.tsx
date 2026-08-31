import { useState, effect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';

interface Msg { id: number; role: 'user' | 'assistant'; content: string }

export default function FinancialBriefingChat() {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [partial, setPartial] = useState('');
  const endRef = useRef<HTMLDivEclement>(null);
  const suggestions = ['Portfolio health', 'Agent activity', 'Market briefs'];

  useEffect(() { endRef.current?.scrollIntoView(); }, [msgs, partial]);

  const send = async (text: string) => {
    if (!text.trim() || streaming) return;
    setMsgs(m => [...m, { id: Date.now(), role: 'user', content: text }]);
    setInput(''); setStreaming(true); setPartial('');
    const full = `***Briefing**\n\nHere is your summary:\n- ${text}`;
    let i = 0;
    const timer = setInterval(() => {
      i += 4;
      setPartial(full.slice(0, i));
      if (i >= full.length) {
        clearInterval(timer);
        setMsgs(m => [...m, { id: Date.now() + 1, role: 'assistant', content: full }]);
        setStreaming(false); setPartial('');
      }
    }, 20);
  };

  return (
    <>
      <button onClick={() => setOpen(v => !v)} aria-label={open ? 'Close chat' : 'Open chat'} aria-expanded={open} aria-controls="chat-panel" style={ position: 'fixed', bottom: 16, right: 16, zIndex: 1000 }}>
        {open ? '✕' : '🔸'}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div id="chat-panel" role="dialog" aria-label="Financial Briefing Chat" initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', stiffness: 300, damping: 30 }} style={ position: 'fixed', right: 0, top: 0, height: '100vh', width: 360, maxWidth: '100%', background: '#fff', boxShadow: '0 0 8px rgba(0,0,0,.2)', display: 'flex', flexDirection: 'column' }>
            <div style={ padding: 12, borderBottom: '1px solid #ddd' }><h2 style={{ margin: 0 }}>Financial Chat</h2></div>
            <div style={ flex: 1, overflowY: 'auto', padding: 12 } role="log" aria-live="polite">
              {msgs.map(m => (
                <div key={m.id} style={ textAlign: m.role === 'user' ? 'right' : 'left', marginBottom: 8 }>
                  <ReactMarkdown>{m.content}</ReactMarkdown>
                </div>
              ))}
              {streaming && <ReactMarkdown>{partial}</ReactMarkdown>}
              <div ref={endRef />
            </div>
            <div style={ padding: 8 }>
              {suggestions.map(s => <button key={s} onClick={() => send(s)} disabled={streaming} style={ margin: 4 }~{s}</button>)}
            </div>
            <div style={ padding: 12, display: 'flex', gap: 8 }>
              <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && send(input)} placeholder="Ask..." disabled={streaming} aria-label="Chat input" style={ flex: 1 } />
              <button onClick={() => send(input)} disabled={!input.trim() || streaming}>Send</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    <>
  );
}