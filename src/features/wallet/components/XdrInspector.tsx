'use client';

import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  CreditCard,
  FileCode2,
  KeyRound,
  ShieldCheck,
  Wallet2,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FormField } from '@/components/ui/input';
import { cn } from '@/lib/cn';
import { parseEnvelope } from '../utils/xdrEnvelope';
export type {
  OperationSummary,
  SignatureSummary,
  ParsedEnvelope,
} from '../utils/xdrEnvelope';

const SAMPLE_XDRS = [
  {
    id: 'payment',
    label: 'Payment transfer',
    xdr: buildSampleEnvelope({
      sourceAccount: 'GCFQ4I7ZTW5W3K7CSW2USSQK6AZW5KTQH7QA2S5JS5EIUJF2EZRD3E6E',
      fee: '100',
      sequenceNumber: '2147483649',
      operationCount: 2,
      operations: [
        {
          type: 'Payment',
          source: 'GCFQ4I7ZTW5W3K7CSW2USSQK6AZW5KTQH7QA2S5JS5EIUJF2EZRD3E6E',
          destination: 'GB3JQK3ZXB5UYT4GSLFG2ICG7Q5F2KZ3RD5VJN4TQ6Q5Q2SS7EJQADYQ',
          amount: '125.50',
          asset: 'USDC',
        },
        {
          type: 'ManageData',
          source: 'GCFQ4I7ZTW5W3K7CSW2USSQK6AZW5KTQH7QA2S5JS5EIUJF2EZRD3E6E',
          destination: undefined,
          amount: undefined,
          asset: 'memo',
        },
      ],
      signatures: [
        {
          publicKey: 'GD2E5MGVZ4XGIVLNCF4YBZV3JR5M2U3A2P6Q4Y4M7P6KOCZQ7W6I3Q4',
          hint: 'ed25519',
        },
        {
          publicKey: 'GBR4SQR6S5XRK6A4EYJ4JP5XXCGQH2NHSXG6B6HMSN7YGBV2E5P2F3S',
          hint: 'ed25519',
        },
      ],
      networkPassphrase: 'Public Global Stellar Network ; September 2015',
    }),
  },
  {
    id: 'swap',
    label: 'Liquidity swap',
    xdr: buildSampleEnvelope({
      sourceAccount: 'GBY2VQKQEVUXJN4YFOMKE5S6P3D2D3NKW7O4WCL6KUQY2O2D6P5R7QYQ',
      fee: '200',
      sequenceNumber: '314159265',
      operationCount: 3,
      operations: [
        {
          type: 'PathPaymentStrictReceive',
          source: 'GBY2VQKQEVUXJN4YFOMKE5S6P3D2D3NKW7O4WCL6KUQY2O2D6P5R7QYQ',
          destination: 'GD7S2XPI5TUFJSNJH4LMJ4T3K6NQJ5J4JYJ6',
          amount: '250.00',
          asset: 'XLM',
        },
        {
          type: 'ManageData',
          source: 'GBY2VQKQEVUXJN4YFOMKE5S6P3D2D3NKW7O4WCL6KUQY2O2D6P5R7QYQ',
          asset: 'route_id',
        },
        {
          type: 'SetOptions',
          source: 'GBY2VQKQEVUXJN4YFOMKE5S6P3D2D3NKW7O4WCL6KUQY2O2D6P5R7QYQ',
        },
      ],
      signatures: [
        {
          publicKey: 'GABK7V4KJ7V3S2PQJ3S7EWQ7T5Y7N7ZW6Z4N2V7V7K2DU5Y4B4A5IQ',
          hint: 'ed25519',
        },
      ],
      networkPassphrase: 'Test SDF Network ; September 2015',
    }),
  },
];

function stringToBase64(value: string): string {
  const bytes = new TextEncoder().encode(value);
  const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join('');

  if (typeof globalThis.btoa === 'function') {
    return globalThis.btoa(binary);
  }

  return Buffer.from(value, 'utf8').toString('base64');
}

function buildSampleEnvelope(data: Record<string, unknown>): string {
  return stringToBase64(JSON.stringify({ type: 'TransactionEnvelope', ...data }));
}

function visibleKey(value: string): string {
  if (!value || value.length <= 12) return value;
  return `${value.slice(0, 6)}...${value.slice(-6)}`;
}

function getOperationIcon(type: string) {
  const normalized = type.toLowerCase();

  if (normalized.includes('payment')) return CreditCard;
  if (normalized.includes('manage') || normalized.includes('data')) return KeyRound;
  if (normalized.includes('set')) return ShieldCheck;
  return FileCode2;
}

export function XdrInspector() {
  const initialXdr = SAMPLE_XDRS[0]?.xdr ?? '';
  const [xdr, setXdr] = useState<string>(initialXdr);

  const parsed = useMemo(() => parseEnvelope(xdr), [xdr]);

  const selectedSample =
    SAMPLE_XDRS.find((sample) => sample.xdr === xdr)?.label ?? 'Custom XDR';

  return (
    <Card
      className="overflow-hidden border border-border bg-surface/80"
      role="region"
      aria-label="Stellar XDR inspector"
    >
      <CardHeader className="border-b border-border bg-surface-secondary/60">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <FileCode2 className="h-5 w-5 text-gold" aria-hidden />
              <CardTitle className="text-base text-foreground">XDR inspector</CardTitle>
            </div>
            <p className="text-xs text-foreground-secondary">
              Inspect transaction source, fee, sequence, operations, and signatures
              before signing.
            </p>
          </div>
          <Badge
            variant={parsed.valid ? 'success' : 'warning'}
            size="md"
            className="self-start"
            aria-live="polite"
          >
            {parsed.valid ? 'Envelope valid' : 'Needs review'}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-5 pt-5">
        <FormField
          label="TransactionEnvelope XDR"
          htmlFor="xdr-inspector-input"
          hint="Paste a raw TransactionEnvelope base64 string or load a sample payload."
          error={parsed.valid ? undefined : parsed.message}
        >
          <textarea
            id="xdr-inspector-input"
            value={xdr}
            onChange={(event) => setXdr(event.target.value)}
            spellCheck={false}
            className={cn(
              'py-2.5 min-h-[136px] w-full rounded-sm border border-border bg-surface px-3 font-mono text-[11px] leading-relaxed text-foreground transition-colors duration-fast placeholder:text-foreground-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              !parsed.valid && 'border-danger/60',
            )}
            aria-invalid={!parsed.valid}
            aria-describedby="xdr-inspector-status"
            placeholder="Paste a Stellar TransactionEnvelope XDR here"
          />
        </FormField>

        <div className="flex flex-wrap items-center gap-2">
          {SAMPLE_XDRS.map((sample) => (
            <Button
              key={sample.id}
              type="button"
              variant={xdr === sample.xdr ? 'gold' : 'secondary'}
              size="sm"
              onClick={() => setXdr(sample.xdr)}
              className="focus-visible:ring-2 focus-visible:ring-ring"
            >
              {sample.label}
            </Button>
          ))}
        </div>

        <div
          id="xdr-inspector-status"
          className={cn(
            'rounded-md border p-3 text-xs',
            parsed.valid
              ? 'border-success/40 bg-success-soft/25 text-success'
              : 'border-warning/50 bg-warning-soft/30 text-warning',
          )}
          role={parsed.valid ? 'status' : 'alert'}
        >
          <div className="flex items-start gap-2">
            {parsed.valid ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            ) : (
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            )}
            <div>
              <p className="font-medium">
                {parsed.valid ? 'Structured envelope preview' : 'Validation warning'}
              </p>
              <p className="mt-0.5 text-[11px] opacity-90">
                {parsed.valid ? parsed.message : (parsed.warning ?? parsed.message)}
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-md border border-border bg-surface-primary p-3">
            <div className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.12em] text-foreground-secondary">
              <Wallet2 className="h-3.5 w-3.5" aria-hidden />
              Transaction details
            </div>

            <dl className="space-y-3" aria-live="polite">
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
              <div className="flex items-start justify-between gap-3 border-b border-border pb-2">
                <dt className="text-2xs uppercase tracking-wide text-foreground-secondary">
                  Sequence number
                </dt>
                <dd className="font-mono text-[11px] text-foreground">
                  {parsed.sequenceNumber}
                </dd>
              </div>
              <div className="flex items-start justify-between gap-3 border-b border-border pb-2">
                <dt className="text-2xs uppercase tracking-wide text-foreground-secondary">
                  Operations
                </dt>
                <dd className="font-mono text-[11px] text-foreground">
                  {parsed.operationCount}
                </dd>
              </div>
              <div className="flex items-start justify-between gap-3 border-b border-border pb-2">
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
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
              Signatures
            </div>

            {parsed.signatures.length > 0 ? (
              <ul className="space-y-2" aria-label="Transaction signatures">
                {parsed.signatures.map((signature, index) => (
                  <li
                    key={`${signature.publicKey}-${index}`}
                    className="rounded-sm border border-border bg-surface-secondary px-2 py-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] uppercase tracking-wide text-foreground-secondary">
                        Signature {index + 1}
                      </span>
                      <Badge variant="success" size="sm">
                        {signature.hint}
                      </Badge>
                    </div>
                    <p className="mt-1 break-all font-mono text-[11px] text-foreground">
                      {visibleKey(signature.publicKey)}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-foreground-secondary">
                No signatures were decoded from the payload.
              </p>
            )}
          </div>
        </div>

        <div className="rounded-md border border-border bg-surface-primary p-3">
          <div className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.12em] text-foreground-secondary">
            <ChevronRight className="h-3.5 w-3.5" aria-hidden />
            Operation tree
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
                      {operation.source && <p>Source: {operation.source}</p>}
                      {operation.destination && (
                        <p>Destination: {operation.destination}</p>
                      )}
                      {operation.amount && <p>Amount: {operation.amount}</p>}
                      {operation.asset && <p>Asset: {operation.asset}</p>}
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

        <div className="rounded-md border border-border bg-surface-secondary/50 px-3 py-2 text-[11px] text-foreground-secondary">
          Loaded sample:{' '}
          <span className="font-medium text-foreground">{selectedSample}</span>
        </div>
      </CardContent>
    </Card>
  );
}

export default XdrInspector;
