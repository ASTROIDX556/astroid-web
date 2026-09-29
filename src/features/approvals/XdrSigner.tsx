'use client';

import { useState } from 'react';
import { AlertTriangle, CheckCircle2, ShieldCheck, Wallet2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useStellarWallet } from '@/hooks/useStellarWallet';

export interface XdrSignerProps {
  xdr: string;
  label?: string;
}

export function XdrSigner({ xdr, label = 'Review pending XDR' }: XdrSignerProps) {
  const { isAvailable, isConnected, publicKey, isLoading, error, connect, signTransaction } =
    useStellarWallet();
  const [signedTx, setSignedTx] = useState<string | null>(null);

  const handleSign = async () => {
    if (!xdr) return;
    const result = await signTransaction(xdr);
    setSignedTx(result ?? null);
  };

  if (!isAvailable) {
    return (
      <Card className="border-dashed border-warning/40 bg-warning-soft/10">
        <CardHeader className="gap-2">
          <div className="inline-flex items-center gap-2 text-warning">
            <AlertTriangle className="h-4 w-4" aria-hidden />
            <CardTitle className="text-base">Freighter not detected</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 pt-0 text-sm text-foreground-secondary">
          <p>Install the official Stellar Freighter wallet extension to inspect and sign pending transaction payloads.</p>
          <ol className="list-decimal space-y-1 pl-5">
            <li>Install Freighter in your browser.</li>
            <li>Create or unlock your account.</li>
            <li>Refresh this view and connect again.</li>
          </ol>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex-row items-center justify-between gap-3">
        <div>
          <p className="text-2xs font-semibold uppercase tracking-[0.2em] text-foreground-muted">
            Multi-party approval
          </p>
          <CardTitle className="mt-1 text-xl">{label}</CardTitle>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full border border-success/30 bg-success-soft px-2 py-1 text-2xs font-medium text-success">
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
          Secure sign
        </div>
      </CardHeader>

      <CardContent className="space-y-4 pt-0">
        <div className="rounded-card border border-border bg-surface-secondary/40 p-3 text-xs text-foreground-secondary">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5">
              <Wallet2 className="h-3.5 w-3.5" aria-hidden />
              Wallet status
            </span>
            <span className={isConnected ? 'text-success' : 'text-warning'}>
              {isConnected ? 'Connected' : 'Not connected'}
            </span>
          </div>
          {publicKey && <p className="font-mono text-[10px] break-all text-foreground">{publicKey}</p>}
        </div>

        {!isConnected ? (
          <Button type="button" variant="gold" onClick={() => void connect()} loading={isLoading}>
            Connect Freighter wallet
          </Button>
        ) : (
          <Button type="button" variant="gold" onClick={handleSign} loading={isLoading}>
            Sign payload with Freighter
          </Button>
        )}

        {signedTx && (
          <div className="rounded-card border border-success/30 bg-success-soft/10 p-3 text-xs text-success">
            <div className="inline-flex items-center gap-1.5 font-medium">
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
              Signature generated successfully
            </div>
            <p className="mt-2 break-all font-mono text-[10px]">{signedTx}</p>
          </div>
        )}

        {error && <p className="text-xs text-danger">{error}</p>}
      </CardContent>
    </Card>
  );
}

export default XdrSigner;
