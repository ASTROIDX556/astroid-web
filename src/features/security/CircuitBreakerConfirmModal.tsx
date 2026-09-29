'use client';

import { useState, useCallback } from 'react';
import { AlertTriangle, ShieldOff, ShieldCheck, Lock, Unlock } from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { CircuitBreakerConfirmModalProps } from './types';

const CONFIRM_PHRASE_TRIP = 'FREEZE ALL';
const CONFIRM_PHRASE_RESET = 'RESTORE';

/**
 * Multi-step confirmation modal for tripping or resetting the circuit breaker.
 * Requires the operator to type a confirmation phrase before the action executes.
 */
export function CircuitBreakerConfirmModal({
  open,
  onClose,
  onConfirm,
  mode,
  currentUser = 'operator',
}: CircuitBreakerConfirmModalProps) {
  const [step, setStep] = useState<'warning' | 'confirm'>('warning');
  const [typedPhrase, setTypedPhrase] = useState('');
  const [reason, setReason] = useState('');

  const isTrip = mode === 'trip';
  const requiredPhrase = isTrip ? CONFIRM_PHRASE_TRIP : CONFIRM_PHRASE_RESET;
  const phraseValid = typedPhrase.trim().toUpperCase() === requiredPhrase;
  const reasonValid = isTrip ? reason.trim().length >= 10 : true;

  const handleProceed = useCallback(() => {
    if (step === 'warning') {
      setStep('confirm');
    }
  }, [step]);

  const handleConfirm = useCallback(() => {
    if (!phraseValid || !reasonValid) return;
    onConfirm();
    // Reset internal state
    setStep('warning');
    setTypedPhrase('');
    setReason('');
  }, [phraseValid, reasonValid, onConfirm]);

  const handleClose = useCallback(() => {
    setStep('warning');
    setTypedPhrase('');
    setReason('');
    onClose();
  }, [onClose]);

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      size="md"
      title={isTrip ? 'Emergency Circuit Breaker' : 'Restore Operations'}
      description={
        isTrip
          ? 'This will halt ALL autonomous agent transactions across the organization.'
          : 'This will resume normal agent operations.'
      }
      footer={
        step === 'warning' ? (
          <>
            <Button variant="ghost" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              variant={isTrip ? 'danger' : 'primary'}
              onClick={handleProceed}
            >
              {isTrip ? (
                <>
                  <Lock className="h-4 w-4" /> I Understand, Proceed
                </>
              ) : (
                <>
                  <Unlock className="h-4 w-4" /> Proceed to Confirm
                </>
              )}
            </Button>
          </>
        ) : (
          <>
            <Button variant="ghost" onClick={() => setStep('warning')}>
              Back
            </Button>
            <Button
              variant={isTrip ? 'danger' : 'primary'}
              disabled={!phraseValid || !reasonValid}
              onClick={handleConfirm}
            >
              {isTrip ? (
                <>
                  <ShieldOff className="h-4 w-4" /> Freeze All Agents
                </>
              ) : (
                <>
                  <ShieldCheck className="h-4 w-4" /> Restore Operations
                </>
              )}
            </Button>
          </>
        )
      }
    >
      {step === 'warning' && isTrip ? (
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-button border border-danger/30 bg-danger/5 p-4">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-danger" />
            <div className="space-y-1.5">
              <p className="text-sm font-semibold text-danger">
                Critical Action Required
              </p>
              <ul className="space-y-1 text-xs text-foreground-secondary">
                <li>• All active agent transactions will be halted immediately</li>
                <li>• Pending approvals will be queued until the breaker is reset</li>
                <li>• This action is logged in the audit trail with your identity</li>
                <li>• Only an authorized operator can reset the breaker</li>
              </ul>
            </div>
          </div>
          <p className="text-xs text-foreground-muted">
            Initiator: <span className="font-medium text-foreground">{currentUser}</span>
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {isTrip && (
            <div className="rounded-button border border-danger/20 bg-danger/5 p-3">
              <p className="text-xs font-medium text-danger">
                ⚠️ You are about to freeze all autonomous agent operations.
              </p>
            </div>
          )}

          {/* Reason input (required for trip) */}
          {isTrip && (
            <div className="space-y-2">
              <label className="text-xs font-medium text-foreground">
                Reason for emergency stop <span className="text-danger">*</span>
              </label>
              <Input
                placeholder="Describe the incident or anomaly… (min 10 characters)"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="border-border"
              />
              {reason.length > 0 && reason.length < 10 && (
                <p className="text-2xs text-danger">
                  Reason must be at least 10 characters.
                </p>
              )}
            </div>
          )}

          {/* Confirmation phrase */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-foreground">
              Type <code className="rounded-xs bg-surface-secondary px-1.5 py-0.5 font-mono text-2xs font-bold text-foreground">
                {requiredPhrase}
              </code> to confirm
            </label>
            <Input
              placeholder={requiredPhrase}
              value={typedPhrase}
              onChange={(e) => setTypedPhrase(e.target.value)}
              className="font-mono"
              autoFocus
            />
            {typedPhrase.length > 0 && !phraseValid && (
              <p className="text-2xs text-danger">
                Phrase does not match. You must type exactly &ldquo;{requiredPhrase}&rdquo;.
              </p>
            )}
          </div>
        </div>
      )}
    </Dialog>
  );
}
