'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useFreighterStore } from '@/stores/freighter-store';

export type StellarWalletStatus = 'idle' | 'checking' | 'connected' | 'missing' | 'error';

/**
 * Classification of Freighter connection failures so UI surfaces (banners,
 * dialogs, toasts) can react with the right recovery step instead of a raw
 * extension message.
 */
export type FreighterErrorKind =
  | 'missing'
  | 'rejected'
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

const MAX_AUTOMATIC_RETRIES = 2;

const MISSING_EXTENSION_MESSAGE =
  'Freighter is not installed. Please install the wallet extension and try again.';

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
      hint: 'Click "Connect" again and approve the prompt in the extension.',
      retryable: false,
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
 * Hook that provides a simplified interface to the Freighter wallet store.
 * This hook is a thin wrapper around the Zustand store, providing additional
 * retry logic and type-safe error handling for components.
 */
export function useStellarWallet() {
  const {
    status: storeStatus,
    isInstalled,
    publicKey,
    network,
    error: storeError,
    checkExtension,
    connect: storeConnect,
    disconnect,
    requestSignature,
    hydrate,
  } = useFreighterStore();

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

  const claimRun = useCallback((): number => {
    activeRun.current += 1;
    return activeRun.current;
  }, []);

  /**
   * Convert store status to hook status type for backward compatibility
   */
  const status: StellarWalletStatus = storeStatus === 'connecting' ? 'checking' : storeStatus === 'disconnected' ? 'idle' : storeStatus;

  /**
   * Convert store error to normalized FreighterWalletError
   */
  const walletError = storeError
    ? normalizeFreighterError(storeError, 'Freighter connection failed.')
    : null;

  /**
   * Update ref whenever walletError changes
   */
  useEffect(() => {
    walletErrorRef.current = walletError;
  }, [walletError]);

  /**
   * Refresh connection with retry logic
   */
  const refreshConnection = useCallback(async (): Promise<boolean> => {
    const runId = claimRun();
    setIsLoading(true);
    setRetryState({ attempt: 0, maxAttempts: MAX_AUTOMATIC_RETRIES, isRetrying: false, canRetry: false });

    try {
      await checkExtension();
      await hydrate();
      setRetryState((prev) => ({ ...prev, attempt: 0, isRetrying: false, canRetry: false }));
      return isInstalled;
    } catch (err) {
      const normalized = normalizeFreighterError(err, 'Could not connect to the Freighter wallet.');
      walletErrorRef.current = normalized;
      setRetryState((prev) => ({
        ...prev,
        isRetrying: false,
        canRetry: normalized.retryable,
      }));
      return false;
    } finally {
      if (activeRun.current === runId) setIsLoading(false);
    }
  }, [checkExtension, hydrate, isInstalled, claimRun]);

  /**
   * Initialize connection on mount
   */
  useEffect(() => {
    const runId = claimRun();
    void refreshConnection();
    return () => {
      if (activeRun.current === runId) activeRun.current += 1;
    };
  }, [claimRun, refreshConnection]);

  /**
   * Connect with retry logic
   */
  const connect = useCallback(async (): Promise<string | null> => {
    const runId = claimRun();
    setIsLoading(true);
    setRetryState({ attempt: 0, maxAttempts: MAX_AUTOMATIC_RETRIES, isRetrying: false, canRetry: false });

    try {
      const key = await storeConnect();
      setRetryState({ attempt: 0, maxAttempts: MAX_AUTOMATIC_RETRIES, isRetrying: false, canRetry: false });
      return key;
    } catch (err) {
      const normalized = normalizeFreighterError(err, 'Freighter connection failed.');
      walletErrorRef.current = normalized;
      setRetryState((prev) => ({
        ...prev,
        isRetrying: false,
        canRetry: normalized.retryable,
      }));
      return null;
    } finally {
      if (activeRun.current === runId) setIsLoading(false);
    }
  }, [storeConnect, claimRun]);

  /**
   * Manual retry
   */
  const retry = useCallback(async (): Promise<string | null> => {
    setRetryState((prev) => ({ ...prev, attempt: 0, isRetrying: true }));
    return connect();
  }, [connect]);

  /**
   * Sign transaction with error handling
   */
  const signTransaction = useCallback(async (xdr: string): Promise<string | null> => {
    const runId = claimRun();
    setIsLoading(true);

    try {
      const signature = await requestSignature(xdr);
      return signature;
    } catch (err) {
      const normalized = normalizeFreighterError(err, 'Transaction signing failed.');
      walletErrorRef.current = normalized;
      setRetryState((prev) => ({
        ...prev,
        isRetrying: false,
        canRetry: normalized.retryable,
      }));
      return null;
    } finally {
      if (activeRun.current === runId) setIsLoading(false);
    }
  }, [requestSignature, claimRun]);

  return {
    status,
    publicKey,
    network,
    /** Typed, user-friendly description of the last Freighter failure. */
    walletError,
    /** Ref mirror of `walletError`, readable in the same tick `connect()` resolves. */
    walletErrorRef,
    /** Back-compatible plain message; prefer `walletError` for new code. */
    error: walletError?.message ?? null,
    isLoading,
    isRetrying: retryState.isRetrying,
    retryState,
    isAvailable: isInstalled,
    isConnected: status === 'connected',
    refreshConnection,
    connect,
    /** Manual retry entry point for connection banners / toast actions. */
    retry,
    signTransaction,
    disconnect,
  };
}

export default useStellarWallet;
