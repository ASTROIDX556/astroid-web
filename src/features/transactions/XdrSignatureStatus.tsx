'use client';

import React, { useState, useMemo, useCallback } from 'react';
import {
  CheckCircle,
  Clock,
  AlertTriangle,
  Copy,
  Check,
  ShieldCheck,
  Loader2,
  Wallet,
  FileCode,
  AlertCircle,
  Key,
} from 'lucide-react';
import { useXdrSigner } from './useXdrSigner';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ProgressBar } from '@/components/dashboard/risk-badge';

export type SignerStatus = 'signed' | 'pending' | 'optional';

export interface SignerInfo {
  publicKey: string;
  name?: string;
  role?: string;
  weight: number;
  status: SignerStatus;
  signedAt?: string;
}

export interface XdrSignatureStatusProps {
  xdr?: string;
  signers?: SignerInfo[];
  requiredThreshold?: number;
  transactionTitle?: string;
  onSignatureSuccess?: (newXdr: string) => void;
  className?: string;
}

const DEFAULT_MOCK_SIGNERS: SignerInfo[] = [
  {
    publicKey: 'GAAK7465JHY677NBN345598777HHH1234567890AAABBBCCC111222',
    name: 'Treasury Admin (Primary)',
    role: 'Human Safeguard 1',
    weight: 1,
    status: 'signed',
    signedAt: '2026-08-29T10:15:00Z',
  },
  {
    publicKey: 'GBCC8888KJKJ9999NNNN222233334444555566667777888899990000',
    name: 'Compliance Lead',
    role: 'Human Safeguard 2',
    weight: 1,
    status: 'pending',
  },
  {
    publicKey: 'GDDD9999AAAA1111BBBB2222CCCC3333DDDD4444EEEE5555FFFF6666',
    name: 'Emergency Backup Key',
    role: 'Cold Storage Recovery',
    weight: 1,
    status: 'optional',
  },
];

const DEFAULT_MOCK_XDR =
  'AAAAAgAAAAD2k5L8a3N+...MOCK_STELLAR_TRANSACTION_ENVELOPE_XDR_DATA_STRING_FOR_DEMO...==';

export function isValidXdrString(input?: string): boolean {
  if (!input || typeof input !== 'string') return false;
  const trimmed = input.trim();
  if (trimmed.length < 10) return false;
  const base64Regex = /^[A-Za-z0-9+/=_\-\s]+$/;
  return base64Regex.test(trimmed);
}

export function truncateKey(key: string): string {
  if (!key) return '';
  if (key.length <= 12) return key;
  return `${key.slice(0, 6)}...${key.slice(-6)}`;
}

export function XdrSignatureStatus({
  xdr = DEFAULT_MOCK_XDR,
  signers = DEFAULT_MOCK_SIGNERS,
  requiredThreshold = 2,
  transactionTitle = 'Multi-Sign Transaction Envelope',
  onSignatureSuccess,
  className = '',
}: XdrSignatureStatusProps) {
  const [currentXdr, setCurrentXdr] = useState<string>(xdr);
  const [signerList, setSignerList] = useState<SignerInfo[]>(signers);
  const [copied, setCopied] = useState<boolean>(false);

  const {
    activeKey,
    isConnected,
    isPending: isSigning,
    error: walletError,
    connectWallet,
    signXdr,
    setActiveKey,
  } = useXdrSigner();

  const isValidXdr = useMemo(() => isValidXdrString(currentXdr), [currentXdr]);

  const { acquiredWeight, totalWeight, isThresholdMet, percentComplete } = useMemo(() => {
    const acquired = signerList
      .filter((s) => s.status === 'signed')
      .reduce((sum, s) => sum + s.weight, 0);
    const total = signerList.reduce((sum, s) => sum + s.weight, 0);
    const met = acquired >= requiredThreshold;
    const pct = Math.min(100, Math.round((acquired / requiredThreshold) * 100));
    return {
      acquiredWeight: acquired,
      totalWeight: total,
      isThresholdMet: met,
      percentComplete: pct,
    };
  }, [signerList, requiredThreshold]);

  const userPendingSigner = useMemo(() => {
    if (!activeKey) return null;
    return (
      signerList.find(
        (s) =>
          s.status === 'pending' &&
          (s.publicKey.toLowerCase() === activeKey.toLowerCase() ||
            truncateKey(s.publicKey).toLowerCase() === truncateKey(activeKey).toLowerCase())
      ) || null
    );
  }, [activeKey, signerList]);

  const handleSignTransaction = useCallback(async () => {
    let key = activeKey;
    if (!key) {
      key = await connectWallet();
    }
    if (!key) return;

    const signedXdrResult = await signXdr(currentXdr);
    const newXdr = signedXdrResult || `${currentXdr}_SIGNED_BY_${key.slice(0, 8)}`;

    setSignerList((prev) =>
      prev.map((s) => {
        if (
          s.publicKey.toLowerCase() === key.toLowerCase() ||
          truncateKey(s.publicKey).toLowerCase() === truncateKey(key).toLowerCase() ||
          s.status === 'pending'
        ) {
          return {
            ...s,
            status: 'signed',
            signedAt: new Date().toISOString(),
          };
        }
        return s;
      })
    );

    setCurrentXdr(newXdr);
    if (onSignatureSuccess) {
      onSignatureSuccess(newXdr);
    }
  }, [activeKey, connectWallet, signXdr, currentXdr, onSignatureSuccess]);

  const handleCopyXdr = useCallback(() => {
    if (!isValidXdr) return;
    navigator.clipboard.writeText(currentXdr);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [currentXdr, isValidXdr]);

  const handleSelectSimulatedKey = (key: string) => {
    setActiveKey(key);
  };

  return (
    <Card className={`overflow-hidden ${className}`} role="region" aria-label="XDR Multi-Signature Status Visualizer">
      <CardHeader className="border-b border-border bg-surface-primary/60 pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <FileCode className="h-5 w-5 text-gold" aria-hidden="true" />
              <CardTitle className="text-base font-semibold">{transactionTitle}</CardTitle>
            </div>
            <CardDescription className="text-xs">
              Autonomous multi-signature workflow verification and threshold tracking.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              variant={isThresholdMet ? 'success' : 'warning'}
              size="md"
              className="font-medium"
              aria-label={`Status: ${isThresholdMet ? 'Ready to Submit' : 'Pending Signatures'}`}
            >
              {isThresholdMet ? 'Threshold Met' : 'Signatures Pending'}
            </Badge>
            <button
              onClick={handleCopyXdr}
              disabled={!isValidXdr}
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-surface-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors disabled:opacity-50"
              aria-label="Copy XDR to clipboard"
              title="Copy XDR string to clipboard"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-success" aria-hidden="true" />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5 text-foreground-secondary" aria-hidden="true" />
                  <span>Copy XDR</span>
                </>
              )}
            </button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6 pt-5">
        {!isValidXdr ? (
          <div
            className="flex items-center gap-3 rounded-md border border-danger/30 bg-danger-soft/40 p-4 text-xs text-danger"
            role="alert"
          >
            <AlertCircle className="h-5 w-5 shrink-0" />
            <div>
              <p className="font-semibold">Invalid Transaction XDR Format</p>
              <p className="text-foreground-secondary">
                The provided string cannot be parsed as a valid Stellar Transaction Envelope XDR structure.
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="space-y-2 rounded-lg border border-border bg-surface-secondary/40 p-4">
              <div className="flex items-baseline justify-between text-xs">
                <span className="font-medium text-foreground-secondary">
                  Signature Progress Threshold
                </span>
                <span className="tabular font-semibold text-foreground" aria-live="polite">
                  {acquiredWeight} of {requiredThreshold} required signatures ({acquiredWeight}/{totalWeight} weight)
                </span>
              </div>
              <ProgressBar
                value={percentComplete}
                label="Multi-sig completion percentage"
                className="h-2.5"
              />
              <p className="text-2xs text-foreground-muted">
                {isThresholdMet
                  ? 'All required signing thresholds satisfied. Ready for network submission.'
                  : `Requires ${requiredThreshold - acquiredWeight} more signature weight to reach network authorization.`}
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border/80 bg-surface-primary p-3 text-xs">
              <div className="flex items-center gap-2">
                <Wallet className="h-4 w-4 text-foreground-secondary" aria-hidden="true" />
                <span className="text-foreground-secondary">Active Wallet Key:</span>
                {activeKey ? (
                  <span className="font-mono font-medium text-foreground bg-gold-soft/50 px-2 py-0.5 rounded text-2xs">
                    {truncateKey(activeKey)}
                  </span>
                ) : (
                  <span className="text-foreground-muted italic">Not Connected</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {!isConnected ? (
                  <button
                    onClick={connectWallet}
                    disabled={isSigning}
                    className="inline-flex items-center gap-1.5 rounded-md bg-gold px-3 py-1.5 text-xs font-medium text-gold-foreground hover:bg-gold-strong transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {isSigning && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    Connect Freighter
                  </button>
                ) : (
                  <Badge variant="outline" size="sm">
                    Freighter Connected
                  </Badge>
                )}
              </div>
            </div>

            {walletError && (
              <p className="text-2xs text-danger" role="alert">
                {walletError}
              </p>
            )}

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">
                  Signing Authorities ({signerList.length})
                </h4>
                <span className="text-2xs text-foreground-muted">
                  Click a pending authority to test signature
                </span>
              </div>

              <div className="space-y-2.5" role="list" aria-label="Signers Authorities List">
                {signerList.map((signer, index) => {
                  const isUserKey =
                    activeKey &&
                    (signer.publicKey.toLowerCase() === activeKey.toLowerCase() ||
                      truncateKey(signer.publicKey).toLowerCase() === truncateKey(activeKey).toLowerCase());

                  return (
                    <div
                      key={signer.publicKey + index}
                      role="listitem"
                      onClick={() => handleSelectSimulatedKey(signer.publicKey)}
                      className={`group relative flex items-start justify-between gap-3 rounded-lg border p-3.5 transition-all cursor-pointer ${
                        signer.status === 'signed'
                          ? 'border-success/40 bg-success-soft/20 hover:border-success/60'
                          : signer.status === 'pending'
                          ? isUserKey
                            ? 'border-gold bg-gold-soft/30 shadow-sm'
                            : 'border-warning/40 bg-warning-soft/20 hover:border-warning/60'
                          : 'border-border bg-surface-primary hover:border-border-strong'
                      }`}
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="mt-0.5 shrink-0">
                          {signer.status === 'signed' && (
                            <span className="grid h-7 w-7 place-items-center rounded-full bg-success/10 text-success">
                              <CheckCircle className="h-4 w-4" aria-hidden="true" />
                            </span>
                          )}
                          {signer.status === 'pending' && (
                            <span className="grid h-7 w-7 place-items-center rounded-full bg-warning/10 text-warning">
                              <Clock className="h-4 w-4 animate-pulse" aria-hidden="true" />
                            </span>
                          )}
                          {signer.status === 'optional' && (
                            <span className="grid h-7 w-7 place-items-center rounded-full bg-surface-secondary text-foreground-muted">
                              <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                            </span>
                          )}
                        </div>

                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-xs font-semibold text-foreground truncate">
                              {signer.name || 'Signing Authority'}
                            </p>
                            {isUserKey && (
                              <Badge variant="gold" size="sm">
                                Your Active Key
                              </Badge>
                            )}
                          </div>
                          <p className="font-mono text-2xs text-foreground-secondary truncate">
                            {truncateKey(signer.publicKey)}
                          </p>
                          {signer.role && (
                            <p className="text-2xs text-foreground-muted">{signer.role}</p>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        {signer.status === 'signed' && (
                          <Badge variant="success" size="sm" dot aria-label="Status: Signed">
                            Signed
                          </Badge>
                        )}
                        {signer.status === 'pending' && (
                          <Badge variant="warning" size="sm" aria-label="Status: Pending Signature">
                            Pending
                          </Badge>
                        )}
                        {signer.status === 'optional' && (
                          <Badge variant="outline" size="sm" aria-label="Status: Optional Backup Key">
                            Optional (w={signer.weight})
                          </Badge>
                        )}

                        <span className="text-2xs font-medium text-foreground-muted">
                          Weight: {signer.weight}
                        </span>
                        {signer.signedAt && (
                          <span className="text-2xs text-foreground-muted">
                            {new Date(signer.signedAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
              <div className="text-2xs text-foreground-secondary">
                {userPendingSigner ? (
                  <span className="text-gold font-medium">
                    Your key is required for this transaction authorization.
                  </span>
                ) : (
                  <span>Select any pending key authority above to simulate signing.</span>
                )}
              </div>

              <button
                onClick={handleSignTransaction}
                disabled={isSigning || isThresholdMet}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-md bg-gold px-4 py-2.5 text-xs font-semibold text-gold-foreground shadow-sm hover:bg-gold-strong active:scale-98 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-all"
                aria-label="Sign Transaction with Freighter"
              >
                {isSigning ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    <span>Signing Transaction...</span>
                  </>
                ) : isThresholdMet ? (
                  <>
                    <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                    <span>Threshold Fully Satisfied</span>
                  </>
                ) : (
                  <>
                    <Key className="h-4 w-4" aria-hidden="true" />
                    <span>Sign Transaction</span>
                  </>
                )}
              </button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default XdrSignatureStatus;

