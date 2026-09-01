'use client';

import { Check, ChevronDown, Clock, Copy, ShieldCheck, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useStellarWallet } from '@/hooks/useStellarWallet';
import { cn } from '@/lib/cn';
import { truncateHash } from '@/lib/format';

/* -------------------------------------------------------------------------- */
/* Types                                                                       */
/* -------------------------------------------------------------------------- */

export type MultisigSignerStatus = 'signed' | 'pending' | 'rejected';

export type StellarThresholdLevel = 'low' | 'medium' | 'high';

export interface MultisigSigner {
  /** Stellar public key (G...), 56 characters. */
  publicKey: string;
  /** Signing weight of this key on the source account. */
  weight: number;
  status: MultisigSignerStatus;
  /** Human name for the key holder, e.g. "Treasury ops". */
  label?: string;
  /** ISO timestamp of the signature or rejection. */
  respondedAt?: string;
}

export interface MultisigRequest {
  id: string;
  title: string;
  /** One-line description of what the transaction does. */
  summary?: string;
  /** Account whose signers must approve, i.e. the transaction source. */
  sourceAccount: string;
  /** Weight that must be collected before the transaction is valid. */
  threshold: number;
  thresholdLevel?: StellarThresholdLevel;
  signers: MultisigSigner[];
  /** Base64 transaction envelope. */
  xdr: string;
  networkPassphrase?: string;
  sequenceNumber?: string;
  /** Fee in stroops (1 XLM = 10,000,000 stroops). */
  feeStroops?: number;
  operationCount?: number;
  memo?: string;
  /** ISO timestamp after which the transaction time bounds expire. */
  expiresAt?: string;
}

export interface SignRequestContext {
  request: MultisigRequest;
  signerPublicKey: string;
}

export interface SignedRequestContext extends SignRequestContext {
  signedTxXdr: string;
}

export interface MultisigProgressCardProps {
  request: MultisigRequest;
  /**
   * Overrides the Freighter signing path. Resolve with the signed XDR to
   * advance the progress ring, or `null` if the signer cancelled. Supply this
   * in mock mode, in stories, and in tests; leave it out in the app so the
   * connected wallet is used.
   */
  onSign?: (context: SignRequestContext) => Promise<string | null>;
  /** Fired after a successful signature so the parent can persist it. */
  onSigned?: (context: SignedRequestContext) => void | Promise<void>;
  /** Fired when the collected weight meets the threshold and the user submits. */
  onSubmit?: (request: MultisigRequest) => void;
  className?: string;
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

/** Converts stroops to an XLM string without trailing zeroes. */
function formatStroops(stroops: number): string {
  const xlm = (stroops / 10_000_000).toFixed(7).replace(/\.?0+$/, '');
  return `${xlm === '' ? '0' : xlm} XLM`;
}

const STATUS_META: Record<
  MultisigSignerStatus,
  { label: string; Icon: LucideIcon; chip: string; icon: string }
> = {
  signed: {
    label: 'Signed',
    Icon: Check,
    chip: 'bg-success-soft ring-1 ring-success/40',
    icon: 'text-success',
  },
  pending: {
    label: 'Pending',
    Icon: Clock,
    chip: 'bg-surface-secondary ring-1 ring-border-strong',
    icon: 'text-foreground-secondary',
  },
  rejected: {
    label: 'Rejected',
    Icon: X,
    chip: 'bg-danger-soft ring-1 ring-danger/40',
    icon: 'text-danger',
  },
};

const RING_BOX = 120;
const RING_STROKE = 10;
const RING_RADIUS = (RING_BOX - RING_STROKE) / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background';

/* -------------------------------------------------------------------------- */
/* Component                                                                   */
/* -------------------------------------------------------------------------- */

export function MultisigProgressCard({
  request,
  onSign,
  onSigned,
  onSubmit,
  className,
}: MultisigProgressCardProps) {
  const headingId = useId();
  const signersHeadingId = useId();
  const ctaHintId = useId();

  const {
    isAvailable,
    isConnected,
    publicKey,
    isLoading,
    error: walletError,
    connect,
    signTransaction,
  } = useStellarWallet();

  const [localStatus, setLocalStatus] = useState<Record<string, MultisigSignerStatus>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [signError, setSignError] = useState<string | null>(null);

  const mountedRef = useRef(true);
  const copyTimerRef = useRef<number | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (copyTimerRef.current !== null) window.clearTimeout(copyTimerRef.current);
    };
  }, []);

  // Server truth wins whenever the request itself changes.
  useEffect(() => {
    setLocalStatus({});
    setSignError(null);
  }, [request.id]);

  const signers = useMemo(
    () =>
      request.signers.map((signer) => ({
        ...signer,
        // An optimistic status only ever upgrades a key the server still calls pending.
        status:
          signer.status === 'pending'
            ? (localStatus[signer.publicKey] ?? 'pending')
            : signer.status,
      })),
    [request.signers, localStatus],
  );

  const totalWeight = signers.reduce((sum, signer) => sum + signer.weight, 0);
  const signedWeight = signers
    .filter((signer) => signer.status === 'signed')
    .reduce((sum, signer) => sum + signer.weight, 0);
  const pendingWeight = signers
    .filter((signer) => signer.status === 'pending')
    .reduce((sum, signer) => sum + signer.weight, 0);
  const signedCount = signers.filter((signer) => signer.status === 'signed').length;

  const threshold = Math.max(0, request.threshold);
  const reachableWeight = signedWeight + pendingWeight;
  const thresholdMet = signedWeight >= threshold;
  const blocked = !thresholdMet && reachableWeight < threshold;
  const remainingWeight = Math.max(0, threshold - signedWeight);

  const ratio = threshold === 0 ? 1 : Math.min(1, signedWeight / threshold);
  const dashOffset = RING_CIRCUMFERENCE * (1 - ratio);

  const connectedSigner = publicKey
    ? signers.find((signer) => signer.publicKey === publicKey)
    : undefined;

  const canSign =
    !isLoading && !thresholdMet && !blocked && connectedSigner?.status === 'pending';

  const ctaHint = thresholdMet
    ? 'Threshold reached. This transaction is ready to submit to the network.'
    : blocked
      ? 'Too much weight has been rejected. This request can no longer reach its threshold.'
      : !isConnected
        ? 'Connect the wallet holding one of these keys to sign.'
        : !connectedSigner
          ? 'The connected wallet is not a signer on this account.'
          : connectedSigner.status === 'signed'
            ? 'You have already signed this request.'
            : connectedSigner.status === 'rejected'
              ? 'You rejected this request.'
              : `Signing adds ${connectedSigner.weight} ${
                  connectedSigner.weight === 1 ? 'unit' : 'units'
                } of weight toward the threshold.`;

  const liveMessage = thresholdMet
    ? `Threshold met. ${signedWeight} of ${threshold} weight signed. Ready to submit.`
    : blocked
      ? `Blocked. Only ${reachableWeight} of ${threshold} weight can still be collected.`
      : `${signedWeight} of ${threshold} weight signed. ${remainingWeight} more needed.`;

  const copyValue = useCallback(async (value: string, id: string) => {
    if (typeof navigator === 'undefined' || !navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(value);
      if (!mountedRef.current) return;
      setCopiedId(id);
      if (copyTimerRef.current !== null) window.clearTimeout(copyTimerRef.current);
      copyTimerRef.current = window.setTimeout(() => {
        if (mountedRef.current) setCopiedId(null);
      }, 1600);
    } catch {
      if (mountedRef.current) setCopiedId(null);
    }
  }, []);

  const handleSign = useCallback(async () => {
    if (!canSign || !publicKey) return;
    setSignError(null);

    try {
      const context: SignRequestContext = { request, signerPublicKey: publicKey };
      const signedTxXdr = onSign
        ? await onSign(context)
        : await signTransaction(request.xdr);

      if (!mountedRef.current) return;
      if (!signedTxXdr) {
        // The hook already surfaces its own error; nothing to add.
        return;
      }

      setLocalStatus((previous) => ({ ...previous, [publicKey]: 'signed' }));
      await onSigned?.({ ...context, signedTxXdr });
    } catch (cause) {
      if (!mountedRef.current) return;
      setSignError(
        cause instanceof Error && cause.message
          ? cause.message
          : 'The signature could not be recorded. Try again.',
      );
    }
  }, [canSign, publicKey, request, onSign, onSigned, signTransaction]);

  const ringColor = thresholdMet
    ? 'stroke-success'
    : blocked
      ? 'stroke-danger'
      : 'stroke-gold';

  const visibleError = signError ?? walletError;

  return (
    <Card className={cn('overflow-hidden', className)} aria-labelledby={headingId}>
      <p aria-live="polite" className="sr-only">
        {liveMessage}
      </p>
      <p aria-live="polite" className="sr-only">
        {copiedId ? 'Copied to clipboard.' : ''}
      </p>

      <CardHeader className="flex-row items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-2xs font-semibold uppercase tracking-[0.2em] text-foreground-muted">
            Multi-signature approval
          </p>
          <CardTitle id={headingId} className="mt-1 text-xl">
            {request.title}
          </CardTitle>
          {request.summary ? (
            <p className="mt-1 max-w-prose text-xs text-foreground-secondary">
              {request.summary}
            </p>
          ) : null}
          <p className="mt-2 text-2xs text-foreground-secondary">
            Source account{' '}
            <span className="font-mono text-foreground" title={request.sourceAccount}>
              {truncateHash(request.sourceAccount)}
            </span>
          </p>
        </div>

        <span
          className={cn(
            'inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-1 text-2xs font-medium text-foreground ring-1',
            thresholdMet
              ? 'bg-success-soft ring-success/40'
              : blocked
                ? 'bg-danger-soft ring-danger/40'
                : 'bg-surface-secondary ring-border-strong',
          )}
        >
          <ShieldCheck
            className={cn(
              'h-3.5 w-3.5',
              thresholdMet ? 'text-success' : blocked ? 'text-danger' : 'text-foreground-secondary',
            )}
            aria-hidden
          />
          {thresholdMet ? 'Ready to submit' : blocked ? 'Cannot reach threshold' : 'Awaiting signatures'}
        </span>
      </CardHeader>

      <CardContent className="space-y-5 pt-0">
        {/* Progress ------------------------------------------------------- */}
        <div className="flex flex-wrap items-center gap-5">
          <div
            role="progressbar"
            aria-label="Signature weight collected"
            aria-valuemin={0}
            aria-valuemax={threshold}
            aria-valuenow={Math.min(signedWeight, threshold)}
            aria-valuetext={`${signedWeight} of ${threshold} required weight signed`}
            className="relative h-11 w-11 shrink-0"
          >
            <svg
              viewBox={`0 0 ${RING_BOX} ${RING_BOX}`}
              className="h-full w-full -rotate-90"
              aria-hidden
            >
              <circle
                cx={RING_BOX / 2}
                cy={RING_BOX / 2}
                r={RING_RADIUS}
                fill="none"
                strokeWidth={RING_STROKE}
                className="stroke-border"
              />
              <circle
                cx={RING_BOX / 2}
                cy={RING_BOX / 2}
                r={RING_RADIUS}
                fill="none"
                strokeWidth={RING_STROKE}
                strokeLinecap="round"
                strokeDasharray={RING_CIRCUMFERENCE}
                strokeDashoffset={dashOffset}
                className={cn(
                  ringColor,
                  'transition-[stroke-dashoffset] duration-slow ease-astroid motion-reduce:transition-none',
                )}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center" aria-hidden>
              <span className="font-display text-2xl leading-none tabular-nums text-foreground">
                {signedWeight}
              </span>
              <span className="mt-1 text-2xs tabular-nums text-foreground-secondary">
                of {threshold}
              </span>
            </div>
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-sm text-foreground">
              {thresholdMet
                ? 'Signing threshold met.'
                : blocked
                  ? `Only ${reachableWeight} of ${threshold} weight remains available.`
                  : `${remainingWeight} more ${
                      remainingWeight === 1 ? 'unit' : 'units'
                    } of weight needed.`}
            </p>
            <p className="mt-1 text-xs text-foreground-secondary">
              {signedCount} of {signers.length} keys signed ·{' '}
              {request.thresholdLevel ?? 'medium'} threshold
            </p>

            {/* Weight across all keys, with a marker at the threshold. */}
            <div
              className="relative mt-3 h-2 w-full overflow-hidden rounded-full bg-surface-secondary ring-1 ring-border"
              aria-hidden
            >
              <div
                className={cn(
                  'h-full rounded-full transition-[width] duration-slow ease-astroid motion-reduce:transition-none',
                  thresholdMet ? 'bg-success' : blocked ? 'bg-danger' : 'bg-gold',
                )}
                style={{
                  width: `${totalWeight === 0 ? 0 : (signedWeight / totalWeight) * 100}%`,
                }}
              />
              {totalWeight > 0 && threshold <= totalWeight ? (
                <span
                  className="absolute inset-y-0 w-px bg-foreground"
                  style={{ left: `${(threshold / totalWeight) * 100}%` }}
                />
              ) : null}
            </div>
            <p className="mt-1 text-2xs text-foreground-secondary" aria-hidden>
              Marker shows the threshold across {totalWeight} total weight.
            </p>
          </div>
        </div>

        {/* Signers -------------------------------------------------------- */}
        <div>
          <h3 id={signersHeadingId} className="text-sm font-medium text-foreground">
            Signers
          </h3>
          <ul aria-labelledby={signersHeadingId} className="mt-3 grid gap-2">
            {signers.map((signer) => {
              const meta = STATUS_META[signer.status];
              const isYou = signer.publicKey === publicKey;
              const copyId = `key-${signer.publicKey}`;
              return (
                <li
                  key={signer.publicKey}
                  className={cn(
                    'grid grid-cols-1 items-center gap-2 rounded-card border px-3 py-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]',
                    isYou ? 'border-gold bg-gold/5' : 'border-border bg-surface-secondary/40',
                  )}
                >
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-foreground">
                      {signer.label ?? 'Signer'}
                      {isYou ? (
                        <span className="ml-2 rounded-xs bg-gold/15 px-2 py-px text-2xs font-normal text-foreground">
                          Your wallet
                        </span>
                      ) : null}
                    </p>
                    <button
                      type="button"
                      onClick={() => void copyValue(signer.publicKey, copyId)}
                      aria-label={`Copy full public key for ${signer.label ?? truncateHash(signer.publicKey)}`}
                      title={signer.publicKey}
                      className={cn(
                        'mt-1 inline-flex items-center gap-1 rounded-xs font-mono text-2xs text-foreground-secondary hover:text-foreground',
                        FOCUS_RING,
                      )}
                    >
                      {truncateHash(signer.publicKey)}
                      <Copy
                        className={cn('h-3 w-3', copiedId === copyId && 'text-success')}
                        aria-hidden
                      />
                    </button>
                  </div>

                  <span className="text-2xs tabular-nums text-foreground-secondary sm:text-right">
                    Weight <span className="font-medium text-foreground">{signer.weight}</span>
                  </span>

                  <span
                    className={cn(
                      'inline-flex w-fit items-center gap-1 rounded-full px-2 py-1 text-2xs font-medium text-foreground',
                      meta.chip,
                    )}
                  >
                    <meta.Icon className={cn('h-3 w-3', meta.icon)} aria-hidden />
                    {meta.label}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Actions -------------------------------------------------------- */}
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            {!isAvailable ? (
              <p className="text-xs text-warning">
                Freighter was not detected. Install or unlock the extension to sign.
              </p>
            ) : !isConnected ? (
              <Button
                type="button"
                variant="gold"
                size="sm"
                loading={isLoading}
                onClick={() => void connect()}
              >
                Connect Freighter wallet
              </Button>
            ) : (
              <Button
                type="button"
                variant="gold"
                size="sm"
                loading={isLoading}
                aria-disabled={!canSign}
                aria-describedby={ctaHintId}
                onClick={() => void handleSign()}
                className={cn(!canSign && 'pointer-events-none opacity-50')}
              >
                Sign transaction
              </Button>
            )}

            {thresholdMet && onSubmit ? (
              <Button type="button" variant="primary" size="sm" onClick={() => onSubmit(request)}>
                Submit to network
              </Button>
            ) : null}
          </div>

          <p id={ctaHintId} className="text-2xs text-foreground-secondary">
            {ctaHint}
          </p>

          {visibleError ? (
            <p role="alert" className="text-xs text-danger">
              {visibleError}
            </p>
          ) : null}
        </div>

        {/* Raw execution properties --------------------------------------- */}
        <details className="group rounded-card border border-border bg-surface-secondary/40">
          <summary
            className={cn(
              'flex cursor-pointer list-none items-center justify-between px-3 py-2 text-xs font-medium text-foreground',
              '[&::-webkit-details-marker]:hidden',
              FOCUS_RING,
            )}
          >
            Raw transaction properties
            <ChevronDown
              className="h-4 w-4 text-foreground-secondary transition-transform duration-base ease-astroid group-open:rotate-180 motion-reduce:transition-none"
              aria-hidden
            />
          </summary>

          <dl className="grid gap-3 border-t border-border px-3 py-3 sm:grid-cols-2">
            <div>
              <dt className="text-2xs text-foreground-secondary">Request id</dt>
              <dd className="font-mono text-2xs text-foreground">{request.id}</dd>
            </div>
            <div>
              <dt className="text-2xs text-foreground-secondary">Source account</dt>
              <dd className="font-mono text-2xs text-foreground" title={request.sourceAccount}>
                {truncateHash(request.sourceAccount, 6, 6)}
              </dd>
            </div>
            {request.sequenceNumber ? (
              <div>
                <dt className="text-2xs text-foreground-secondary">Sequence</dt>
                <dd className="font-mono text-2xs tabular-nums text-foreground">
                  {request.sequenceNumber}
                </dd>
              </div>
            ) : null}
            {typeof request.feeStroops === 'number' ? (
              <div>
                <dt className="text-2xs text-foreground-secondary">Fee</dt>
                <dd className="font-mono text-2xs tabular-nums text-foreground">
                  {formatStroops(request.feeStroops)} ({request.feeStroops} stroops)
                </dd>
              </div>
            ) : null}
            {typeof request.operationCount === 'number' ? (
              <div>
                <dt className="text-2xs text-foreground-secondary">Operations</dt>
                <dd className="font-mono text-2xs tabular-nums text-foreground">
                  {request.operationCount}
                </dd>
              </div>
            ) : null}
            <div>
              <dt className="text-2xs text-foreground-secondary">Threshold</dt>
              <dd className="font-mono text-2xs tabular-nums text-foreground">
                {threshold} ({request.thresholdLevel ?? 'medium'})
              </dd>
            </div>
            {request.memo ? (
              <div>
                <dt className="text-2xs text-foreground-secondary">Memo</dt>
                <dd className="font-mono text-2xs text-foreground">{request.memo}</dd>
              </div>
            ) : null}
            {request.networkPassphrase ? (
              <div className="sm:col-span-2">
                <dt className="text-2xs text-foreground-secondary">Network</dt>
                <dd className="font-mono text-2xs text-foreground">{request.networkPassphrase}</dd>
              </div>
            ) : null}
            {request.expiresAt ? (
              <div className="sm:col-span-2">
                <dt className="text-2xs text-foreground-secondary">Valid until</dt>
                <dd className="font-mono text-2xs text-foreground">{request.expiresAt}</dd>
              </div>
            ) : null}
            <div className="sm:col-span-2">
              <dt className="flex items-center justify-between text-2xs text-foreground-secondary">
                Transaction envelope (XDR)
                <button
                  type="button"
                  onClick={() => void copyValue(request.xdr, 'xdr')}
                  className={cn(
                    'inline-flex items-center gap-1 rounded-xs px-2 py-1 text-2xs text-foreground-secondary hover:text-foreground',
                    FOCUS_RING,
                  )}
                >
                  <Copy className="h-3 w-3" aria-hidden />
                  {copiedId === 'xdr' ? 'Copied' : 'Copy'}
                </button>
              </dt>
              <dd>
                <pre className="mt-1 max-h-11 overflow-auto whitespace-pre-wrap break-all rounded-xs bg-background px-3 py-2 font-mono text-[10px] text-foreground">
                  {request.xdr}
                </pre>
              </dd>
            </div>
          </dl>
        </details>
      </CardContent>
    </Card>
  );
}

export default MultisigProgressCard;
