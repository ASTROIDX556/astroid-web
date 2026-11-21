'use client';

import { useId, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { AlertTriangle, CheckCircle2, Code2, Copy, ShieldCheck, X } from 'lucide-react';
import { toast } from 'sonner';

import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { useHydrated } from '@/hooks/use-hydrated';
import { cn } from '@/lib/cn';
import {
  inspectTransactionXdr,
  shortenAccount,
  type XdrInspection,
  type InspectedXdrOperation,
} from './xdrParser';

export interface XdrInspectorModalProps {
  open: boolean;
  onClose: () => void;
  /** Raw base64 transaction envelope attached to the proposal. */
  xdr?: string | null;
  /** Proposal title shown in the dialog heading. */
  title?: string;
  className?: string;
}

async function copyRawXdr(value: string | null | undefined): Promise<void> {
  if (!value || typeof navigator === 'undefined' || !navigator.clipboard) return;
  try {
    await navigator.clipboard.writeText(value);
    toast.success('Raw XDR copied to clipboard');
  } catch {
    toast.error('Could not copy the raw XDR. Select it manually instead.');
  }
}

interface SummaryFieldProps {
  label: string;
  value: string;
  hint?: string;
  mono?: boolean;
}

function SummaryField({ label, value, hint, mono = false }: SummaryFieldProps) {
  return (
    <div className="min-w-0 rounded-card border border-border bg-surface-secondary/40 p-3">
      <dt className="text-2xs font-semibold uppercase tracking-wide text-foreground-muted">
        {label}
      </dt>
      <dd
        title={value}
        className={cn(
          'mt-1 text-xs font-medium text-foreground',
          mono ? 'break-all font-mono' : 'truncate',
        )}
      >
        {value}
      </dd>
      {hint && <p className="mt-0.5 text-2xs text-foreground-muted">{hint}</p>}
    </div>
  );
}

function OperationCard({
  operation,
  index,
}: {
  operation: InspectedXdrOperation;
  index: number;
}) {
  const hasFields =
    operation.destination ||
    operation.amount ||
    operation.asset ||
    operation.assetIssuer ||
    operation.detail;

  return (
    <li className="rounded-card border border-border bg-surface p-3 shadow-soft-1">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold text-foreground">
          {index + 1}. {operation.type}
        </p>
        {operation.source && (
          <Badge variant="outline" size="sm" className="font-mono">
            source {shortenAccount(operation.source)}
          </Badge>
        )}
      </div>
      <div className="mt-2 grid gap-2 text-2xs sm:grid-cols-2">
        {operation.destination && (
          <SummaryField label="Destination" value={operation.destination} mono />
        )}
        {operation.amount !== undefined && (
          <SummaryField
            label="Amount"
            value={`${operation.amount}${operation.asset ? ` ${operation.asset}` : ''}`.trim()}
          />
        )}
        {!operation.amount && operation.asset && (
          <SummaryField label="Asset" value={operation.asset} />
        )}
        {operation.assetIssuer && (
          <SummaryField label="Asset issuer" value={operation.assetIssuer} mono />
        )}
        {operation.detail && <SummaryField label="Details" value={operation.detail} />}
        {!hasFields && (
          <p className="text-2xs text-foreground-muted">
            No additional fields decoded.
          </p>
        )}
      </div>
    </li>
  );
}

function InspectorBody({
  inspection,
  rawXdr,
}: {
  inspection: XdrInspection;
  rawXdr?: string | null;
}) {
  const operationsId = useId();
  const signaturesId = useId();
  const timeBounds = inspection.timeBounds;

  return (
    <div className="space-y-5">
      <div
        role="status"
        className={cn(
          'flex items-start gap-3 rounded-card border p-3',
          inspection.valid
            ? 'border-success/30 bg-success-soft/30'
            : 'border-danger/30 bg-danger-soft/30',
        )}
      >
        {inspection.valid ? (
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden />
        ) : (
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-danger" aria-hidden />
        )}
        <div className="min-w-0">
          <p className="text-xs font-medium text-foreground">{inspection.message}</p>
          {inspection.warning && (
            <p className="mt-1 text-2xs leading-relaxed text-foreground-secondary">
              {inspection.warning}
            </p>
          )}
        </div>
      </div>

      <section aria-label="Envelope summary">
        <dl className="grid gap-3 sm:grid-cols-2">
          <SummaryField label="Source account" value={inspection.sourceAccount} mono />
          <SummaryField
            label="Base fee"
            value={`${inspection.fee} stroops`}
            hint={`${inspection.feeXlm} XLM per operation`}
          />
          <SummaryField
            label="Sequence number"
            value={inspection.sequenceNumber}
            mono
          />
          <SummaryField label="Network" value={inspection.networkLabel} />
          <SummaryField
            label="Memo"
            value={inspection.memo ?? 'No memo attached'}
            hint={inspection.memoType ?? undefined}
            mono={Boolean(inspection.memo)}
          />
          <SummaryField
            label="Signatures"
            value={`${inspection.signatures.length} collected`}
            hint="Signer hints are shown below"
          />
          {timeBounds && (
            <div className="sm:col-span-2">
              <SummaryField
                label="Time bounds"
                value={`${timeBounds.min} → ${timeBounds.max}`}
                hint="Unix timestamps (0 means unbounded)"
              />
            </div>
          )}
        </dl>
      </section>

      <section aria-labelledby={operationsId}>
        <div className="mb-2 flex items-center justify-between gap-3">
          <h3
            id={operationsId}
            className="font-display text-sm font-semibold text-foreground"
          >
            Operations
          </h3>
          <Badge variant="neutral" size="sm">
            {inspection.operationCount}
          </Badge>
        </div>
        {inspection.operations.length > 0 ? (
          <ol className="space-y-2">
            {inspection.operations.map((operation, index) => (
              <OperationCard
                key={`${operation.type}-${index}`}
                operation={operation}
                index={index}
              />
            ))}
          </ol>
        ) : (
          <p className="rounded-card border border-dashed border-border bg-surface-secondary/40 p-4 text-center text-xs text-foreground-secondary">
            This envelope contains no operations.
          </p>
        )}
      </section>

      {inspection.signatures.length > 0 && (
        <section aria-labelledby={signaturesId}>
          <h3
            id={signaturesId}
            className="mb-2 font-display text-sm font-semibold text-foreground"
          >
            Signature hints
          </h3>
          <div className="flex flex-wrap gap-2">
            {inspection.signatures.map((signature, index) => (
              <Badge
                key={`${signature.hint}-${index}`}
                variant="gold"
                size="sm"
                className="font-mono"
              >
                {signature.hint || `hint ${index + 1}`}
              </Badge>
            ))}
          </div>
        </section>
      )}

      <details className="rounded-card border border-border bg-surface-secondary/40">
        <summary className="cursor-pointer px-4 py-3 text-xs font-medium text-foreground-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          View raw XDR
        </summary>
        <pre className="max-h-40 overflow-auto break-all border-t border-border px-4 py-3 font-mono text-2xs leading-relaxed text-foreground-secondary">
          {rawXdr || 'No XDR attached to this proposal.'}
        </pre>
      </details>
    </div>
  );
}

function InspectorFallback({
  retry,
  rawXdr,
}: {
  error: Error;
  retry: () => void;
  rawXdr?: string | null;
}) {
  return (
    <div
      role="alert"
      className="space-y-3 rounded-card border border-dashed border-danger/40 bg-danger-soft/30 p-4"
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-danger" aria-hidden />
        <div>
          <p className="text-xs font-medium text-foreground">
            The decoded view could not be rendered.
          </p>
          <p className="mt-1 text-2xs text-foreground-secondary">
            The raw envelope is still available below. Nothing was signed or submitted.
          </p>
        </div>
      </div>
      <Button variant="secondary" size="sm" onClick={retry}>
        Try again
      </Button>
      {rawXdr && (
        <pre className="max-h-32 overflow-auto break-all rounded-button border border-border bg-surface p-3 font-mono text-2xs text-foreground-secondary">
          {rawXdr}
        </pre>
      )}
    </div>
  );
}

/**
 * Framer Motion powered inspector for raw transaction envelopes.
 *
 * The modal is portalled, focus-trapped and keyboard-dismissable like the
 * shared `Dialog`, but owns its AnimatePresence lifecycle so exit transitions
 * play before the panel leaves the DOM. A React `ErrorBoundary` wraps the
 * decoded view: even an unexpected renderer error leaves the raw XDR readable.
 */
export function XdrInspectorModal({
  open,
  onClose,
  xdr,
  title,
  className,
}: XdrInspectorModalProps) {
  const hydrated = useHydrated();
  const shouldReduceMotion = useReducedMotion();
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const headingId = useId();
  const descriptionId = useId();

  const inspection = useMemo(() => inspectTransactionXdr(xdr), [xdr]);

  useFocusTrap({
    active: open && hydrated,
    containerRef: panelRef,
    onEscape: onClose,
    initialFocusRef: closeRef,
  });

  if (!hydrated) return null;

  const duration = shouldReduceMotion ? 0 : 0.2;

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-3 sm:p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration }}
            className="absolute inset-0 bg-foreground/40 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden="true"
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={headingId}
            aria-describedby={descriptionId}
            tabIndex={-1}
            initial={{
              opacity: 0,
              y: shouldReduceMotion ? 0 : 12,
              scale: shouldReduceMotion ? 1 : 0.98,
            }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{
              opacity: 0,
              y: shouldReduceMotion ? 0 : 8,
              scale: shouldReduceMotion ? 1 : 0.98,
            }}
            transition={{ duration, ease: [0.22, 1, 0.36, 1] }}
            className={cn(
              'relative z-10 flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-dialog border border-border bg-surface shadow-soft-3 focus:outline-none',
              className,
            )}
          >
            <header className="flex items-start justify-between gap-4 border-b border-border p-5">
              <div className="flex min-w-0 items-start gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-button bg-gold-soft text-gold-strong">
                  <Code2 className="h-4 w-4" aria-hidden />
                </span>
                <div className="min-w-0">
                  <h2
                    id={headingId}
                    className="font-display text-lg font-semibold tracking-tight"
                  >
                    XDR inspector
                  </h2>
                  <p
                    id={descriptionId}
                    className="mt-0.5 truncate text-xs text-foreground-secondary"
                  >
                    {title
                      ? `${title} · ${inspection.valid ? 'decoded locally' : 'needs attention'}`
                      : 'Human-readable transaction breakdown'}
                  </p>
                </div>
              </div>
              <Button
                ref={closeRef}
                variant="ghost"
                size="icon-sm"
                onClick={onClose}
                aria-label="Close XDR inspector"
              >
                <X className="h-4 w-4" aria-hidden />
              </Button>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto p-5">
              <ErrorBoundary
                section="XDR inspector"
                resetKey={xdr ?? ''}
                fallback={(error, retry) => (
                  <InspectorFallback error={error} retry={retry} rawXdr={xdr} />
                )}
              >
                <InspectorBody inspection={inspection} rawXdr={xdr} />
              </ErrorBoundary>
            </div>

            <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-3">
              <p className="gap-1.5 inline-flex items-center text-2xs text-foreground-muted">
                <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
                Decoded locally · nothing is signed or submitted here
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  leftIcon={<Copy className="h-3.5 w-3.5" aria-hidden />}
                  disabled={!xdr}
                  onClick={() => void copyRawXdr(xdr)}
                >
                  Copy raw XDR
                </Button>
                <Button variant="gold" size="sm" onClick={onClose}>
                  Done
                </Button>
              </div>
            </footer>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

export default XdrInspectorModal;
