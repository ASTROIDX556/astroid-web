'use client';

import { useState } from 'react';
import { Send, Signature, Wallet2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useStellarWallet } from '@/hooks/useStellarWallet';
import { cn } from '@/lib/cn';

export type SigningQueueStatus = 'pending' | 'signed' | 'failed' | 'broadcasted';
export interface SigningQueueItem {
  id: string; title: string; xdr: string; status: SigningQueueStatus;
  description?: string; sourceAccount?: string; amount?: string; network?: string;
}
export interface SigningQueueProps {
  items: SigningQueueItem[];
  onBroadcast?: (item: SigningQueueItem, signedXdr: string) => Promise<void>;
  className?: string;
}

const meta = {
  pending: ['Pending', 'warning'], signed: ['Signed', 'info'],
  failed: ['Failed', 'danger'], broadcasted: ['Broadcasted', 'success'],
} as const;

/** A Freighter transaction queue. Signed XDR stays local until broadcast succeeds. */
export function SigningQueue({ items, onBroadcast, className }: SigningQueueProps) {
  const wallet = useStellarWallet();
  const [queue, setQueue] = useState(items);
  const [signed, setSigned] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [active, setActive] = useState<string | null>(null);
  const update = (id: string, status: SigningQueueStatus) =>
    setQueue((all) => all.map((item) => item.id === id ? { ...item, status } : item));
  const sign = async (item: SigningQueueItem) => {
    setActive(item.id); setErrors((all) => ({ ...all, [item.id]: '' }));
    try {
      const xdr = await wallet.signTransaction(item.xdr);
      if (!xdr) throw new Error(wallet.error ?? 'Freighter did not return a signed transaction.');
      setSigned((all) => ({ ...all, [item.id]: xdr })); update(item.id, 'signed');
    } catch (error) {
      update(item.id, 'failed');
      setErrors((all) => ({ ...all, [item.id]: error instanceof Error ? error.message : 'Unable to sign transaction.' }));
    } finally { setActive(null); }
  };
  const broadcast = async (item: SigningQueueItem) => {
    const xdr = signed[item.id]; if (!xdr) return;
    setActive(item.id); setErrors((all) => ({ ...all, [item.id]: '' }));
    try { await onBroadcast?.(item, xdr); update(item.id, 'broadcasted'); }
    catch (error) {
      update(item.id, 'failed');
      setErrors((all) => ({ ...all, [item.id]: error instanceof Error ? error.message : 'Broadcast failed.' }));
    } finally { setActive(null); }
  };
  const visible = queue;

  return <Card className={cn('overflow-hidden', className)} role="region" aria-label="Transaction signing queue">
    <CardHeader className="border-b border-border bg-surface-secondary/40">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div><div className="flex items-center gap-2"><Signature className="h-5 w-5 text-gold" aria-hidden /><CardTitle className="text-base">Signing queue</CardTitle></div><p className="mt-1 text-xs text-foreground-secondary">Review agent requests, sign in Freighter, then submit the signed transaction.</p></div>
        <Badge variant={wallet.isConnected ? 'success' : 'outline'} size="md"><Wallet2 className="h-3.5 w-3.5" aria-hidden />{wallet.isConnected ? 'Freighter connected' : 'Freighter not connected'}</Badge>
      </div>
    </CardHeader>
    <CardContent className="space-y-3 pt-5">
      {!wallet.isConnected && <div className="flex items-center justify-between gap-3 rounded-md border border-warning/40 bg-warning-soft/15 p-3"><p className="text-xs text-foreground-secondary">Connect and unlock Freighter before signing.</p><Button type="button" variant="gold" size="sm" loading={wallet.isLoading && active === 'connect'} onClick={() => { setActive('connect'); void wallet.connect().finally(() => setActive(null)); }}>Connect Freighter</Button></div>}
      {visible.length === 0 ? <p className="p-6 text-center text-sm text-foreground-secondary">No transactions are waiting for a signature.</p> : <ul className="space-y-3" aria-live="polite">{visible.map((item) => {
        const [label, variant] = meta[item.status]; const isActive = active === item.id;
        return <li key={item.id} className="rounded-md border border-border bg-surface-primary p-4"><div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="font-medium text-foreground">{item.title}</p><Badge variant={variant} size="sm">{label}</Badge>{item.network && <Badge variant="outline" size="sm">{item.network}</Badge>}</div>{item.description && <p className="mt-2 text-xs text-foreground-secondary">{item.description}</p>}<p className="mt-2 font-mono text-[11px] text-foreground-secondary">{item.amount} {item.sourceAccount && `Ã‚- ${item.sourceAccount.slice(0, 8)}Ã¢â‚¬Â¦${item.sourceAccount.slice(-8)}`}</p></div><div className="flex shrink-0 gap-2">{wallet.isConnected && (item.status === 'pending' || item.status === 'failed') && <Button type="button" variant="gold" size="sm" loading={wallet.isLoading && isActive} onClick={() => void sign(item)}>Sign in Freighter</Button>}{item.status === 'signed' && <Button type="button" variant="primary" size="sm" loading={isActive} leftIcon={<Send className="h-3.5 w-3.5" aria-hidden />} onClick={() => void broadcast(item)}>Broadcast</Button>}</div></div>{errors[item.id] && <p className="mt-3 text-xs text-danger" role="alert">{errors[item.id]}</p>}</li>;
      })}</ul>}
      {wallet.error && <p className="text-xs text-danger" role="alert">{wallet.error}</p>}
    </CardContent>
  </Card>;
}
export default SigningQueue;
