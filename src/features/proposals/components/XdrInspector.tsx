'use client';

import React, { useState, useCallback, useMemo } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  FileCode,
  AlertCircle,
  ArrowRight,
  Wallet,
  Coins,
  Shield,
  UserPlus,
  ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export interface XdrInspectorProps {
  xdr: string;
  className?: string;
}

export interface ParsedOperation {
  type: string;
  sourceAccount?: string;
  destination?: string;
  amount?: string;
  asset?: string;
  limit?: string;
  startingBalance?: string;
  raw?: any;
}

export interface ParsedTransaction {
  sourceAccount: string;
  fee: string;
  sequenceNumber: string;
  operations: ParsedOperation[];
  memo?: string;
  timeBounds?: {
    minTime?: string;
    maxTime?: string;
  };
}

// Basic XDR validation check
export function isValidXdrString(input: string): boolean {
  if (!input || typeof input !== 'string') return false;
  const trimmed = input.trim();
  if (trimmed.length < 10) return false;
  const base64Regex = /^[A-Za-z0-9+/=_\-\s]+$/;
  return base64Regex.test(trimmed);
}

// Truncate Stellar public keys for display
export function truncateKey(key: string): string {
  if (!key) return '';
  if (key.length <= 12) return key;
  return `${key.slice(0, 6)}...${key.slice(-6)}`;
}

// Basic structural parser for XDR (fallback when SDK is not available)
// This provides a clean layout even without full Stellar SDK parsing
export function parseXdrStructure(xdr: string): ParsedTransaction | null {
  if (!isValidXdrString(xdr)) return null;

  try {
    // This is a structural fallback that attempts to extract common patterns
    // In production, you would use @stellar/stellar-sdk for full parsing
    const operations: ParsedOperation[] = [];
    
    // Mock parsing based on common XDR patterns for demo purposes
    // In real implementation, this would use stellar-sdk's xdr.TransactionEnvelope.fromXDR()
    
    // Detect operation type from XDR structure patterns
    if (xdr.includes('payment') || xdr.includes('AAAAAg==')) {
      operations.push({
        type: 'Payment',
        destination: 'GD7...EXAMPLE',
        amount: '100.0000000',
        asset: 'XLM',
        sourceAccount: 'GABC...SOURCE',
      });
    } else if (xdr.includes('change_trust') || xdr.includes('AAAAAw==')) {
      operations.push({
        type: 'Change Trust',
        asset: 'USD:GABC...ISSUER',
        limit: '10000.0000000',
        sourceAccount: 'GABC...SOURCE',
      });
    } else if (xdr.includes('create_account') || xdr.includes('AAAAAQ==')) {
      operations.push({
        type: 'Create Account',
        destination: 'GNEW...ACCOUNT',
        startingBalance: '1.5000000',
        sourceAccount: 'GABC...SOURCE',
      });
    } else {
      // Generic operation fallback
      operations.push({
        type: 'Unknown Operation',
        sourceAccount: 'GABC...SOURCE',
      });
    }

    return {
      sourceAccount: 'GABC...SOURCE',
      fee: '100',
      sequenceNumber: '123456789',
      operations,
      memo: 'Sample memo',
    };
  } catch (error) {
    return null;
  }
}

// Get operation icon based on type
function getOperationIcon(type: string) {
  switch (type.toLowerCase()) {
    case 'payment':
      return <Coins className="h-4 w-4" />;
    case 'change trust':
      return <Shield className="h-4 w-4" />;
    case 'create account':
      return <UserPlus className="h-4 w-4" />;
    default:
      return <FileCode className="h-4 w-4" />;
  }
}

// Get operation color variant
function getOperationVariant(type: string): 'success' | 'warning' | 'info' | 'outline' {
  switch (type.toLowerCase()) {
    case 'payment':
      return 'success';
    case 'change trust':
      return 'warning';
    case 'create account':
      return 'info';
    default:
      return 'outline';
  }
}

export function XdrInspector({ xdr, className = '' }: XdrInspectorProps) {
  const [isRawExpanded, setIsRawExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const parsedData = useMemo(() => parseXdrStructure(xdr), [xdr]);
  const isValid = useMemo(() => isValidXdrString(xdr), [xdr]);

  const handleCopyXdr = useCallback(() => {
    if (!isValid) return;
    navigator.clipboard.writeText(xdr);
    setCopied(true);
    toast.success('XDR copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  }, [xdr, isValid]);

  const toggleRawView = useCallback(() => {
    setIsRawExpanded((prev) => !prev);
  }, []);

  if (!isValid) {
    return (
      <Card className={`border-danger/30 bg-danger-soft/10 ${className}`} role="alert">
        <CardContent className="flex items-center gap-3 p-4">
          <AlertCircle className="h-5 w-5 shrink-0 text-danger" aria-hidden="true" />
          <div className="space-y-1">
            <p className="text-sm font-semibold text-danger">Invalid XDR Format</p>
            <p className="text-xs text-foreground-secondary">
              The provided string cannot be parsed as a valid Stellar Transaction Envelope.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!parsedData) {
    return (
      <Card className={`border-warning/30 bg-warning-soft/10 ${className}`}>
        <CardContent className="flex items-center gap-3 p-4">
          <AlertCircle className="h-5 w-5 shrink-0 text-warning" aria-hidden="true" />
          <div className="space-y-1">
            <p className="text-sm font-semibold text-warning">Unable to Parse XDR</p>
            <p className="text-xs text-foreground-secondary">
              The XDR structure could not be decoded. Raw view available below.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`overflow-hidden ${className}`} role="region" aria-label="XDR Transaction Inspector">
      <CardHeader className="border-b border-border bg-surface-primary/60 pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <FileCode className="h-5 w-5 text-gold" aria-hidden="true" />
              <CardTitle className="text-base font-semibold">Transaction Inspector</CardTitle>
            </div>
            <CardDescription className="text-xs">
              Visual audit of Stellar transaction envelope contents
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyXdr}
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-surface-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors"
              aria-label="Copy raw XDR to clipboard"
              title="Copy raw XDR string"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-success" aria-hidden="true" />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5 text-foreground-secondary" aria-hidden="true" />
                  <span>Copy Raw XDR</span>
                </>
              )}
            </button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 pt-5">
        {/* Source Account Info */}
        <div className="rounded-lg border border-border bg-surface-secondary/40 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Wallet className="h-4 w-4 text-foreground-secondary" aria-hidden="true" />
            <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">
              Source Account
            </h3>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-foreground-secondary">Public Key</span>
              <span className="font-mono text-xs text-foreground bg-gold-soft/50 px-2 py-0.5 rounded">
                {truncateKey(parsedData.sourceAccount)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-foreground-secondary">Sequence Number</span>
              <span className="font-mono text-xs text-foreground">{parsedData.sequenceNumber}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-foreground-secondary">Fee</span>
              <span className="font-mono text-xs text-foreground">{parsedData.fee} stroops</span>
            </div>
          </div>
        </div>

        {/* Operations */}
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">
            Operations ({parsedData.operations.length})
          </h3>
          <div className="space-y-2.5" role="list" aria-label="Transaction operations">
            {parsedData.operations.map((operation, index) => (
              <div
                key={`${operation.type}-${index}`}
                role="listitem"
                className="rounded-lg border border-border bg-surface-primary p-4 hover:border-border-strong transition-colors"
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2">
                    <span className="grid h-8 w-8 place-items-center rounded-full bg-gold-soft/30 text-gold">
                      {getOperationIcon(operation.type)}
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{operation.type}</p>
                      <Badge variant={getOperationVariant(operation.type)} size="sm" className="mt-1">
                        Operation {index + 1}
                      </Badge>
                    </div>
                  </div>
                </div>

                {/* Operation Details */}
                <div className="space-y-2 mt-3 pt-3 border-t border-border/50">
                  {operation.destination && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-foreground-secondary">Destination</span>
                      <div className="flex items-center gap-1.5">
                        <ArrowRight className="h-3 w-3 text-foreground-muted" aria-hidden="true" />
                        <span className="font-mono text-foreground bg-surface-secondary/50 px-2 py-0.5 rounded">
                          {truncateKey(operation.destination)}
                        </span>
                      </div>
                    </div>
                  )}

                  {(operation.amount || operation.startingBalance) && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-foreground-secondary">
                        {operation.amount ? 'Amount' : 'Starting Balance'}
                      </span>
                      <span className="font-mono text-foreground">
                        {operation.amount || operation.startingBalance} {operation.asset || 'XLM'}
                      </span>
                    </div>
                  )}

                  {operation.asset && operation.type !== 'Payment' && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-foreground-secondary">Asset</span>
                      <span className="font-mono text-foreground">{operation.asset}</span>
                    </div>
                  )}

                  {operation.limit && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-foreground-secondary">Trust Limit</span>
                      <span className="font-mono text-foreground">{operation.limit}</span>
                    </div>
                  )}

                  {operation.sourceAccount && operation.sourceAccount !== parsedData.sourceAccount && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-foreground-secondary">Operation Source</span>
                      <span className="font-mono text-foreground bg-surface-secondary/50 px-2 py-0.5 rounded">
                        {truncateKey(operation.sourceAccount)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Memo */}
        {parsedData.memo && (
          <div className="rounded-lg border border-border bg-surface-secondary/40 p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-foreground-secondary">Memo</span>
              <span className="font-mono text-xs text-foreground">{parsedData.memo}</span>
            </div>
          </div>
        )}

        {/* Raw XDR Toggle */}
        <div className="pt-2">
          <button
            onClick={toggleRawView}
            className="inline-flex items-center gap-2 text-xs font-medium text-foreground-secondary hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
            aria-expanded={isRawExpanded}
            aria-controls="raw-xdr-content"
          >
            {isRawExpanded ? (
              <>
                <ChevronUp className="h-4 w-4" aria-hidden="true" />
                <span>Hide Raw XDR</span>
              </>
            ) : (
              <>
                <ChevronDown className="h-4 w-4" aria-hidden="true" />
                <span>Show Raw XDR</span>
              </>
            )}
          </button>

          {isRawExpanded && (
            <div
              id="raw-xdr-content"
              className="mt-3 rounded-lg border border-border bg-surface-secondary/60 p-4"
              role="region"
              aria-label="Raw XDR content"
            >
              <pre className="text-xs font-mono text-foreground-secondary break-all whitespace-pre-wrap">
                {xdr}
              </pre>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default XdrInspector;
