'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export type StellarWalletStatus =
  | 'idle'
  | 'checking'
  | 'connected'
  | 'disconnected'
  | 'locked'
  | 'missing'
  | 'error';

/**
 * Classification of Freighter connection failures so UI surfaces (banners,
 * dialogs, toasts) can react with the right recovery step instead of a raw
 * extension message.
 */
export type FreighterErrorKind =
  | 'missing'
  | 'rejected'
  | 'locked'
  | 'timeout'
  | 'transport'
  | 'unknown';

export interface FreighterWalletError {
  kind: FreighterErrorKind;
  /** Short, human-readable headline that is safe to render in the UI. */
  message: string;
  /** Suggested next step, for toast descriptions or banner footers. */
  hint: string;
  /** True when retrying the same operation has a chance of succeeding. */
  retryable: boolean;
  /** Original error object, kept for console/debug use only. */
  cause?: unknown;
}

export interface StellarWalletRetryState {
  /** Number of retry attempts used by the most recent connection action. */
  attempt: number;
  /** Ceiling for automatic retries of transient failures. */
  maxAttempts: number;
  /** True while a retry backoff is in flight. */
  isRetrying: boolean;
  /** True when a manual retry makes sense (transient failure, not a rejection). */
  canRetry: boolean;
}

type FreighterModule = typeof import('@stellar/freighter-api');

const FREIGHTER_TIMEOUT_MS = 15000;
const MAX_AUTOMATIC_RETRIES = 2;
const RETRY_BASE_DELAY_MS = 400;

const MISSING_EXTENSION_MESSAGE =
  'Freighter is not installed. Please install the wallet extension and try again.';

const wait = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

const withTimeout = async <T>(promise: Promise<T>, ms = FREIGHTER_TIMEOUT_MS): Promise<T> => {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('Freighter timed out. Install the extension or unlock it before continuing.'));
    }, ms);

    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
};

async function loadFreighter(): Promise<FreighterModule | null> {
  if (typeof window === 'undefined') return null;

  try {
    const api = await import('@stellar/freighter-api');
    return api;
  } catch {
    return null;
  }
}

/**
 * Map any raw Freighter / extension error to a typed, user-friendly error.
 * Freighter surfaces failures as plain `Error`s with inconsistent wording
 * (and sometimes non-Error values), so classification is pattern-based.
 */
export function normalizeFreighterError(err: unknown, fallbackMessage = 'Freighter connection failed.'): FreighterWalletError {
  const raw =
    err instanceof Error
      ? err.message
      : typeof err === 'string'
        ? err
        : (() => {
            try {
              return JSON.stringify(err) ?? '';
            } catch {
              return '';
            }
          })();
  const text = raw.toLowerCase();

  if (/not installed|no freighter|not detected|window\.freighter/.test(text)) {
    return {
      kind: 'missing',
      message: MISSING_EXTENSION_MESSAGE,
      hint: 'Add Freighter from your browser extension store, unlock it, then reconnect.',
      retryable: false,
      cause: err,
    };
  }

  if (/timed? out|timeout/.test(text)) {
    return {
      kind: 'timeout',
      message: 'Freighter took too long to respond.',
      hint: 'Unlock the extension and approve the pending prompt, then retry.',
      retryable: true,
      cause: err,
    };
  }

  if (/reject|denied|cancel|dismiss|declined/.test(text)) {
    return {
      kind: 'rejected',
      message: 'You rejected the connection request in Freighter.',
      hint: 'Click “Connect” again and approve the prompt in the extension.',
      retryable: false,
      cause: err,
    };
  }

  // Checked after `rejected`/`timeout` because Freighter's own timeout copy
  // mentions unlocking; word boundaries keep "unlock" out of this match.
  if (/\block(ed)?\b|password|passphrase/i.test(text)) {
    return {
      kind: 'locked',
      message: 'Freighter is locked.',
      hint: 'Unlock the extension with your password, then retry.',
      retryable: true,
      cause: err,
    };
  }

  if (/extension not connected|reconnect|transport|port|chrome-extension|moz-extension|network/.test(text)) {
    return {
      kind: 'transport',
      message: 'Could not reach the Freighter extension.',
      hint: 'This is usually transient — reload the page or retry in a moment.',
      retryable: true,
      cause: err,
    };
  }

  return {
    kind: 'unknown',
    message: err instanceof Error && err.message ? err.message : fallbackMessage,
    hint: 'Open Freighter to make sure it is unlocked, then try again.',
    retryable: true,
    cause: err,
  };
}

/**
 * Distinguish a locked extension from a plain disconnected one. Freighter has
 * no `isLocked()` API, so we probe `getAddress()` non-interactively: an error
 * mentioning the lock/password means the user just needs to unlock, anything
 * else means the wallet is simply not connected to this site.
 */
async function probeWalletLock(api: FreighterModule): Promise<'locked' | 'disconnected'> {
  try {
    const response = await withTimeout(api.getAddress(), 4000);
    const message =
      typeof response === 'string'
        ? ''
        : String((response as { error?: string; message?: string } | null)?.error ?? '') +
          String((response as { message?: string } | null)?.message ?? '');
    if (/lock(ed)?|password|passphrase/i.test(message) && !/reject|denied|cancel/i.test(message)) {
      return 'locked';
    }
    return 'disconnected';
  } catch (err) {
    return normalizeFreighterError(err).kind === 'locked' ? 'locked' : 'disconnected';
  }
}

export function useStellarWallet() {
  const [status, setStatus] = useState<StellarWalletStatus>('checking');
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [walletError, setWalletError] = useState<FreighterWalletError | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [retryState, setRetryState] = useState<StellarWalletRetryState>({
    attempt: 0,
    maxAttempts: MAX_AUTOMATIC_RETRIES,
    isRetrying: false,
    canRetry: false,
  });

  /**
   * Monotonic run token: every user-initiated action (refresh/connect/retry)
   * claims the latest id, so slow async work from an earlier attempt cannot
   * clobber the state of a newer one.
   */
  const activeRun = useRef(0);

  /**
   * Synchronous mirror of `walletError`. `await connect()` resolves before
   * React commits the state update, so callers that want to toast about the
   * failure right away must read the ref, not the state.
   */
  const walletErrorRef = useRef<FreighterWalletError | null>(null);

  const setFailure = useCallback((normalized: FreighterWalletError | null) => {
    walletErrorRef.current = normalized;
    setWalletError(normalized);
  }, []);

  /**
   * Run an action with bounded exponential-backoff retries for transient
   * Freighter failures. Rejections and missing-extension states fail fast —
   * retrying those cannot succeed.
   */
  const withRetry = useCallback(
    async <T>(
      action: (attempt: number) => Promise<T>,
      onRetry: (error: FreighterWalletError, nextAttempt: number) => void,
      runId: number,
    ): Promise<T> => {
      let lastError: FreighterWalletError | null = null;

      for (let attempt = 0; attempt <= MAX_AUTOMATIC_RETRIES; attempt += 1) {
        if (activeRun.current !== runId) {
          throw new Error('Freighter attempt superseded by a newer connection request.');
        }

        try {
          const result = await action(attempt);
          setRetryState((prev) => ({ ...prev, isRetrying: false }));
          return result;
        } catch (err) {
          lastError = normalizeFreighterError(err);
          const isLastAttempt = attempt >= MAX_AUTOMATIC_RETRIES;

          if (!lastError.retryable || isLastAttempt) {
            break;
          }

          setRetryState({
            attempt: attempt + 1,
            maxAttempts: MAX_AUTOMATIC_RETRIES,
            isRetrying: true,
            canRetry: true,
          });
          onRetry(lastError, attempt + 1);
          await wait(RETRY_BASE_DELAY_MS * 2 ** attempt);
        }
      }

      throw lastError ?? new Error('Freighter request failed.');
    },
    [],
  );

  const claimRun = useCallback((): number => {
    activeRun.current += 1;
    return activeRun.current;
  }, []);

  const refreshConnection = useCallback(async (): Promise<boolean> => {
    const runId = activeRun.current;
    const api = await loadFreighter();
    if (activeRun.current !== runId) return false;

    if (!api) {
      setStatus('missing');
      setPublicKey(null);
      setFailure({
        kind: 'missing',
        message: MISSING_EXTENSION_MESSAGE,
        hint: 'Add Freighter from your browser extension store, unlock it, then reconnect.',
        retryable: false,
      });
      setRetryState((prev) => ({ ...prev, isRetrying: false, canRetry: false }));
      return false;
    }

    try {
      const connected = await withRetry(() => withTimeout(api.isConnected()), () => {}, runId);
      if (activeRun.current !== runId) return Boolean(connected);

      if (connected) {
        setStatus('connected');
        const address = await withRetry(() => withTimeout(api.getAddress()), () => {}, runId);
        if (activeRun.current !== runId) return Boolean(connected);
        const nextKey = typeof address === 'string' ? address : address?.address ?? null;
        setPublicKey(nextKey);
        setFailure(null);
      } else {
        // Explicit, user-actionable distinction between "locked" and
        // "not connected" instead of a single vague idle state.
        if (activeRun.current !== runId) return false;
        const lockState = await probeWalletLock(api);
        if (activeRun.current !== runId) return false;
        setStatus(lockState);
        setPublicKey(null);
        if (lockState === 'locked') {
          setFailure({
            kind: 'locked',
            message: 'Freighter is locked.',
            hint: 'Unlock the extension with your password, then retry.',
            retryable: true,
          });
        } else {
          setFailure(null);
        }
      }
      setRetryState((prev) => ({ ...prev, attempt: 0, isRetrying: false, canRetry: false }));
      return Boolean(connected);
    } catch (err) {
      if (activeRun.current !== runId) return false;
      const normalized = normalizeFreighterError(err, 'Could not connect to the Freighter wallet.');
      setStatus('error');
      setFailure(normalized);
      setRetryState((prev) => ({
        ...prev,
        isRetrying: false,
        canRetry: normalized.retryable,
      }));
      return false;
    }
  }, [setFailure, withRetry]);

  useEffect(() => {
    const runId = claimRun();
    void refreshConnection();
    return () => {
      // Invalidate in-flight checks if this effect is torn down early.
      if (activeRun.current === runId) activeRun.current += 1;
    };
  }, [claimRun, refreshConnection]);

  const connect = useCallback(async (): Promise<string | null> => {
    const runId = claimRun();
    const api = await loadFreighter();

    if (!api) {
      setStatus('missing');
      setFailure({
        kind: 'missing',
        message: MISSING_EXTENSION_MESSAGE,
        hint: 'Add Freighter from your browser extension store, unlock it, then reconnect.',
        retryable: false,
      });
      setRetryState((prev) => ({ ...prev, isRetrying: false, canRetry: false }));
      return null;
    }

    setIsLoading(true);
    setFailure(null);
    setRetryState({ attempt: 0, maxAttempts: MAX_AUTOMATIC_RETRIES, isRetrying: false, canRetry: false });

    try {
      const allowed = await withRetry(
        () => withTimeout(api.setAllowed()),
        () => {},
        runId,
      );
      const isAllowed =
        typeof allowed === 'boolean'
          ? allowed
          : (allowed as { isAllowed?: boolean } | null)?.isAllowed ?? false;

      if (!isAllowed) {
        throw new Error('Freighter approval was rejected. Please approve the connection in the browser extension.');
      }

      const address = await withRetry(
        () => withTimeout(api.getAddress()),
        () => {},
        runId,
      );
      if (activeRun.current !== runId) return null;
      const nextKey = typeof address === 'string' ? address : address?.address ?? null;

      setPublicKey(nextKey);
      setStatus(nextKey ? 'connected' : 'disconnected');
      setFailure(null);
      setRetryState({ attempt: 0, maxAttempts: MAX_AUTOMATIC_RETRIES, isRetrying: false, canRetry: false });
      return nextKey;
    } catch (err) {
      if (activeRun.current !== runId) return null;
      const normalized = normalizeFreighterError(err, 'Freighter connection failed.');
      setStatus('error');
      setFailure(normalized);
      setRetryState((prev) => ({
        ...prev,
        isRetrying: false,
        canRetry: normalized.retryable,
      }));
      return null;
    } finally {
      if (activeRun.current === runId) setIsLoading(false);
    }
  }, [claimRun, setFailure, withRetry]);

  const retry = useCallback(async (): Promise<string | null> => {
    setRetryState((prev) => ({ ...prev, attempt: 0, isRetrying: true }));
    return connect();
  }, [connect]);

  const signTransaction = useCallback(async (xdr: string): Promise<string | null> => {
    const runId = claimRun();
    const api = await loadFreighter();

    if (!api) {
      setStatus('missing');
      setFailure({
        kind: 'missing',
        message: MISSING_EXTENSION_MESSAGE,
        hint: 'Add Freighter from your browser extension store, unlock it, then reconnect.',
        retryable: false,
      });
      setRetryState((prev) => ({ ...prev, isRetrying: false, canRetry: false }));
      return null;
    }

    setIsLoading(true);
    setFailure(null);

    try {
      const response = await withRetry(
        () => withTimeout(api.signTransaction(xdr)),
        () => {},
        runId,
      );
      if (activeRun.current !== runId) return null;
      const signature =
        typeof response === 'string'
          ? response
          : (response as { signedTxXdr?: string } | null)?.signedTxXdr ?? null;

      setStatus(signature ? 'connected' : 'idle');
      setFailure(null);
      return signature;
    } catch (err) {
      if (activeRun.current !== runId) return null;
      const normalized = normalizeFreighterError(err, 'Transaction signing failed.');
      setStatus('error');
      setFailure(normalized);
      setRetryState((prev) => ({
        ...prev,
        isRetrying: false,
        canRetry: normalized.retryable,
      }));
      return null;
    } finally {
      if (activeRun.current === runId) setIsLoading(false);
    }
  }, [claimRun, setFailure, withRetry]);

  return {
    status,
    publicKey,
    /** Typed, user-friendly description of the last Freighter failure. */
    walletError,
    /** Ref mirror of `walletError`, readable in the same tick `connect()` resolves. */
    walletErrorRef,
    /** Back-compatible plain message; prefer `walletError` for new code. */
    error: walletError?.message ?? null,
    isLoading,
    isRetrying: retryState.isRetrying,
    retryState,
    isAvailable: status !== 'missing' && status !== 'error',
    isConnected: status === 'connected',
    /** Explicit "extension installed but not connected to this site" state. */
    isDisconnected: status === 'disconnected',
    /** Explicit "extension installed but locked" state (unlock to continue). */
    isLocked: status === 'locked',
    refreshConnection,
    connect,
    /** Manual retry entry point for connection banners / toast actions. */
    retry,
    signTransaction,
  };
}

export default useStellarWallet;
