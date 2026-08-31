import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type CircuitBreakerStatus = 'operational' | 'frozen';

interface CircuitBreakerState {
  /** Global circuit breaker status across all agent operations. */
  status: CircuitBreakerStatus;
  /** Timestamp when the breaker was last tripped (epoch ms). */
  trippedAt: number | null;
  /** User who tripped the breaker. */
  trippedBy: string | null;
  /** User-supplied reason for the trip. */
  tripReason: string | null;

  /** Freeze all agent transactions. */
  trip: (operator: string, reason: string) => void;
  /** Restore normal operations. */
  reset: (operator: string) => void;
  /** Acknowledge and clear the trip banner (does not reset). */
  acknowledge: () => void;
}

export const useCircuitBreakerStore = create<CircuitBreakerState>()(
  persist(
    (set) => ({
      status: 'operational',
      trippedAt: null,
      trippedBy: null,
      tripReason: null,

      trip: (operator, reason) =>
        set({
          status: 'frozen',
          trippedAt: Date.now(),
          trippedBy: operator,
          tripReason: reason,
        }),

      reset: (operator) =>
        set({
          status: 'operational',
          trippedAt: null,
          trippedBy: null,
          tripReason: null,
          _lastResetBy: operator,
        } as Partial<CircuitBreakerState> & { _lastResetBy: string }),

      acknowledge: () =>
        set({
          _acknowledged: true,
        } as Partial<CircuitBreakerState> & { _acknowledged: boolean }),
    }),
    { name: 'astroid-circuit-breaker' },
  ),
);
