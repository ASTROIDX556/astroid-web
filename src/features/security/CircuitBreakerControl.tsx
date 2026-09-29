'use client';

import { useState, useCallback } from 'react';
import {

  ShieldCheck,
  ShieldOff,
  Zap,
  Clock,
  User,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/cn';
import { useCircuitBreakerStore } from '@/stores/circuit-breaker-store';
import { CircuitBreakerConfirmModal } from './CircuitBreakerConfirmModal';
import type { CircuitBreakerControlProps } from './types';

function formatTimestamp(ts: number | null): string {
  if (!ts) return '—';
  const d = new Date(ts);
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/**
 * Topbar compact indicator — a pulsing icon that opens the settings panel
 * when the breaker is tripped, or shows a subtle green shield when operational.
 */
function TopbarIndicator({ currentUser }: { currentUser: string }) {
  const status = useCircuitBreakerStore((s) => s.status);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'trip' | 'reset'>('trip');
  const trip = useCircuitBreakerStore((s) => s.trip);
  const reset = useCircuitBreakerStore((s) => s.reset);

  const handleToggle = useCallback(() => {
    if (status === 'operational') {
      setModalMode('trip');
      setModalOpen(true);
    } else {
      setModalMode('reset');
      setModalOpen(true);
    }
  }, [status]);

  const handleConfirm = useCallback(() => {
    if (modalMode === 'trip') {
      trip(currentUser, 'Emergency stop triggered from topbar');
    } else {
      reset(currentUser);
    }
    setModalOpen(false);
  }, [modalMode, trip, reset, currentUser]);

  return (
    <>
      <button
        type="button"
        onClick={handleToggle}
        className={cn(
          'relative grid h-9 w-9 place-items-center rounded-button transition-all duration-fast',
          status === 'frozen'
            ? 'bg-danger/10 text-danger animate-pulse hover:bg-danger/20'
            : 'text-foreground-secondary hover:bg-surface-secondary hover:text-foreground',
        )}
        aria-label={
          status === 'frozen'
            ? 'Circuit breaker is active — click to restore'
            : 'Circuit breaker is operational — click to freeze all agents'
        }
      >
        {status === 'frozen' ? (
          <ShieldOff className="h-[18px] w-[18px]" aria-hidden />
        ) : (
          <ShieldCheck className="h-[18px] w-[18px]" aria-hidden />
        )}
      </button>

      <CircuitBreakerConfirmModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onConfirm={handleConfirm}
        mode={modalMode}
        currentUser={currentUser}
      />
    </>
  );
}

/**
 * Full settings panel — comprehensive control with status display, trip history,
 * and enable/disable toggle.
 */
function SettingsPanel({ currentUser }: { currentUser: string }) {
  const status = useCircuitBreakerStore((s) => s.status);
  const trippedAt = useCircuitBreakerStore((s) => s.trippedAt);
  const trippedBy = useCircuitBreakerStore((s) => s.trippedBy);
  const tripReason = useCircuitBreakerStore((s) => s.tripReason);
  const trip = useCircuitBreakerStore((s) => s.trip);
  const reset = useCircuitBreakerStore((s) => s.reset);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'trip' | 'reset'>('trip');

  const handleToggle = useCallback(() => {
    if (status === 'operational') {
      setModalMode('trip');
    } else {
      setModalMode('reset');
    }
    setModalOpen(true);
  }, [status]);

  const handleConfirm = useCallback(() => {
    if (modalMode === 'trip') {
      trip(currentUser, 'Emergency stop triggered from settings');
    } else {
      reset(currentUser);
    }
    setModalOpen(false);
  }, [modalMode, trip, reset, currentUser]);

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Zap className="h-4 w-4 text-gold" />
            Emergency Circuit Breaker
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Status banner */}
          <div
            className={cn(
              'flex items-center gap-3 rounded-button border p-4',
              status === 'frozen'
                ? 'border-danger/30 bg-danger/5'
                : 'border-success/30 bg-success/5',
            )}
          >
            {status === 'frozen' ? (
              <div className="grid h-10 w-10 place-items-center rounded-button bg-danger/10">
                <ShieldOff className="h-5 w-5 text-danger" aria-hidden />
              </div>
            ) : (
              <div className="grid h-10 w-10 place-items-center rounded-button bg-success/10">
                <ShieldCheck className="h-5 w-5 text-success" aria-hidden />
              </div>
            )}
            <div className="flex-1">
              <p className="text-sm font-semibold text-foreground">
                {status === 'frozen' ? 'Circuit Breaker Active' : 'All Systems Operational'}
              </p>
              <p className="text-xs text-foreground-secondary">
                {status === 'frozen'
                  ? 'All autonomous agent transactions are currently halted.'
                  : 'Agent transactions are proceeding normally.'}
              </p>
            </div>
            <Badge
              variant={status === 'frozen' ? 'danger' : 'success'}
              size="sm"
              dot
            >
              {status === 'frozen' ? 'FROZEN' : 'OPERATIONAL'}
            </Badge>
          </div>

          {/* Trip details (when frozen) */}
          {status === 'frozen' && (
            <div className="space-y-2 rounded-button border border-border bg-surface p-4">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground-secondary">
                Trip Details
              </h4>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                <dt className="text-foreground-muted">Tripped at</dt>
                <dd className="flex items-center gap-1.5 font-medium text-foreground">
                  <Clock className="h-3 w-3 text-foreground-muted" />
                  {formatTimestamp(trippedAt)}
                </dd>
                <dt className="text-foreground-muted">Initiated by</dt>
                <dd className="flex items-center gap-1.5 font-medium text-foreground">
                  <User className="h-3 w-3 text-foreground-muted" />
                  {trippedBy ?? '—'}
                </dd>
                {tripReason && (
                  <>
                    <dt className="text-foreground-muted">Reason</dt>
                    <dd className="font-medium text-foreground">{tripReason}</dd>
                  </>
                )}
              </dl>
            </div>
          )}

          {/* Action button */}
          <div className="flex items-center gap-3">
            <Button
              variant={status === 'frozen' ? 'primary' : 'danger'}
              onClick={handleToggle}
            >
              {status === 'frozen' ? (
                <>
                  <ShieldCheck className="h-4 w-4" /> Restore Operations
                </>
              ) : (
                <>
                  <ShieldOff className="h-4 w-4" /> Freeze All Agents
                </>
              )}
            </Button>
            {status === 'frozen' && (
              <div className="flex items-center gap-1.5 text-2xs text-danger">
                <AlertTriangle className="h-3 w-3" />
                Active — all agents halted
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <CircuitBreakerConfirmModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onConfirm={handleConfirm}
        mode={modalMode}
        currentUser={currentUser}
      />
    </>
  );
}

/**
 * Main exported component — renders Topbar indicator or Settings panel
 * based on the `variant` prop.
 */
export function CircuitBreakerControl({
  currentUser = 'operator',
  variant = 'topbar',
}: CircuitBreakerControlProps) {
  if (variant === 'settings') {
    return <SettingsPanel currentUser={currentUser} />;
  }
  return <TopbarIndicator currentUser={currentUser} />;
}
