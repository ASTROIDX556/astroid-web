'use client';

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  AlertTriangle,
  CreditCard,
  FileCode2,
  KeyRound,
  ShieldCheck,
  Wallet2,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { useStellarWallet } from '@/hooks/useStellarWallet';
import { parseEnvelope } from '../utils/xdrEnvelope';

export interface TransactionSigningModalProps {
  open: boolean;
  onClose: () => void;
  xdr: string;
  title?: string;
  /** Network passphrase the app expects this transaction to be signed on. */
  expectedNetworkPassphrase?: string;
  onSigned?: (signedXdr: string) => void;
}

function getOperationIcon(type: string) {
  const normalized = type.toLowerCase();
  if (normalized.includes('payment')) return CreditCard;
  if (normalized.includes('manage') || normalized.includes('data')) return KeyRound;
  return FileCode2;
}

async function loadFreighter() {
  if (typeof window === 'undefined') return null;
  try {
    return await import('@stellar/freighter-api');
  } catch {
    return null;
  }
}

export function TransactionSigningModal({
  open,
  onClose,
  xdr,
  title = 'Review and sign transaction',
  expectedNetworkPassphrase,
  onSigned,
}: TransactionSigningModalProps) {
  const {
    isAvailable,
    isConnected,
    publicKey,
    connect,
    signTransaction,
    error: walletError,
  } = useStellarWallet();
  const [isSigning, setIsSigning] = useState(false);
  const [networkMismatch, setNetworkMismatch] = useState(false);

  const parsed = useMemo(() => parseEnvelope(xdr), [xdr]);

  const handleClose = () => {
    if (isSigning) return;
    setNetworkMismatch(false);
    onClose();
  };

  const handleSign = async () => {
    if (!xdr) return;
    setIsSigning(true);
    setNetworkMismatch(false);

    try {
      const api = await loadFreighter();
      if (!api) {
        toast.error('Freighter is not installed', {
          description:
            'Install the Freighter browser extension to sign this transaction.',
        });
        return;
      }

      if (expectedNetworkPassphrase) {
        const details = await api.getNetworkDetails().catch(() => null);
        const activePassphrase =
          details && typeof details === 'object' && 'networkPassphrase' in details
            ? (details as { networkPassphrase?: string }).networkPassphrase
            : undefined;

        if (activePassphrase && activePassphrase !== expectedNetworkPassphrase) {
          setNetworkMismatch(true);
          toast.error('Wrong network selected in Freighter', {
            description: `Switch Freighter to the expected network before signing.`,
          });
          return;
        }
      }

      if (!isConnected) {
        const key = await connect();
        if (!key) {
          toast.error('Freighter connection failed', {
            description:
              walletError ?? 'Unlock Freighter and approve the connection request.',
          });
          return;
        }
      }

      const signed = await signTransaction(xdr);
      if (!signed) {
        toast.error('Signing failed', {
          description: walletError ?? 'Freighter did not return a signed transaction.',
        });
        return;
      }

      toast.success('Transaction signed', {
        description: 'The signed payload is ready to submit.',
      });
      onSigned?.(signed);
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Signing was rejected.';
      toast.error('Signing failed', { description: message });
    } finally {
      setIsSigning(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title={title}
      description="Confirm the decoded transaction details below before approving with Freighter."
      size="lg"
      footer={
        !isAvailable ? (
          <Button variant="ghost" onClick={handleClose}>
            Close
          </Button>
        ) : (
          <>
            <Button variant="ghost" onClick={handleClose} disabled={isSigning}>
              Cancel
            </Button>
            <Button
              variant="gold"
              onClick={() => void handleSign()}
              loading={isSigning}
              disabled={!parsed.valid}
            >
              {isConnected ? 'Sign with Freighter' : 'Connect and sign'}
            </Button>
          </>
        )
      }
    >
      {!isAvailable ? (
        <div className="space-y-3 rounded-card border border-dashed border-warning/40 bg-warning-soft/10 p-4 text-sm text-foreground-secondary">
          <div className="inline-flex items-center gap-2 text-warning">
            <AlertTriangle className="h-4 w-4" aria-hidden />
            <p className="font-medium text-foreground">Freighter not detected</p>
          </div>
          <p>
            Install the official Stellar Freighter wallet extension, or unlock it if
            it&apos;s already installed, then reopen this dialog.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-card border border-border bg-surface-secondary/40 p-3 text-xs text-foreground-secondary">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="gap-1.5 inline-flex items-center">
                <Wallet2 className="h-3.5 w-3.5" aria-hidden />
                Wallet status
              </span>
              <span className={isConnected ? 'text-success' : 'text-warning'}>
                {isConnected ? 'Connected' : 'Not connected'}
              </span>
            </div>
            {publicKey && (
              <p className="break-all font-mono text-[10px] text-foreground">
                {publicKey}
              </p>
            )}
          </div>

          {networkMismatch && (
            <div
              className="rounded-card border border-danger/40 bg-danger-soft/20 p-3 text-xs text-danger"
              role="alert"
            >
              Freighter is set to a different Stellar network than this transaction
              expects. Switch networks in the extension and try again.
            </div>
          )}

          {!parsed.valid && (
            <div
              className="rounded-card border border-warning/40 bg-warning-soft/20 p-3 text-xs text-warning"
              role="alert"
            >
              {parsed.warning ?? parsed.message}
            </div>
          )}

          <div className="rounded-md border border-border bg-surface-primary p-3">
            <div className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.12em] text-foreground-secondary">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
              Transaction summary
            </div>
            <dl className="space-y-2.5">
              <div className="flex items-start justify-between gap-3 border-b border-border pb-2">
                <dt className="text-2xs uppercase tracking-wide text-foreground-secondary">
                  Source account
                </dt>
                <dd className="max-w-[60%] truncate font-mono text-[11px] text-foreground">
                  {parsed.sourceAccount}
                </dd>
              </div>
              <div className="flex items-start justify-between gap-3 border-b border-border pb-2">
                <dt className="text-2xs uppercase tracking-wide text-foreground-secondary">
                  Fee
                </dt>
                <dd className="font-mono text-[11px] text-foreground">{parsed.fee}</dd>
              </div>
              <div className="flex items-start justify-between gap-3">
                <dt className="text-2xs uppercase tracking-wide text-foreground-secondary">
                  Network
                </dt>
                <dd className="max-w-[60%] text-right font-mono text-[11px] text-foreground">
                  {parsed.networkPassphrase}
                </dd>
              </div>
            </dl>
          </div>

          <div className="rounded-md border border-border bg-surface-primary p-3">
            <div className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.12em] text-foreground-secondary">
              Operations
              <Badge variant="outline" size="sm">
                {parsed.operationCount}
              </Badge>
            </div>
            {parsed.operations.length > 0 ? (
              <ul className="space-y-2" aria-label="Decoded transaction operations">
                {parsed.operations.map((operation, index) => {
                  const Icon = getOperationIcon(operation.type);
                  return (
                    <li
                      key={`${operation.type}-${index}`}
                      className="rounded-sm border border-border bg-surface-secondary px-3 py-2"
                    >
                      <div className="flex items-center gap-2">
                        <Icon className="h-3.5 w-3.5 text-gold" aria-hidden />
                        <span className="text-xs font-medium text-foreground">
                          {operation.type}
                        </span>
                      </div>
                      <div className="mt-2 space-y-1 text-[11px] text-foreground-secondary">
                        {operation.destination && (
                          <p>Destination: {operation.destination}</p>
                        )}
                        {operation.amount && (
                          <p>
                            Amount: {operation.amount} {operation.asset ?? ''}
                          </p>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-xs text-foreground-secondary">
                No operation metadata was decoded from this XDR.
              </p>
            )}
          </div>
        </div>
      )}
    </Dialog>
  );
}

export default TransactionSigningModal;
