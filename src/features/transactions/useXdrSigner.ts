'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import * as freighter from '@stellar/freighter-api';
import { toast } from 'sonner';

export type XdrSigningState = 'idle' | 'connecting' | 'signing' | 'success' | 'error';
export type XdrSigningErrorCode =
  | 'extension_unavailable' | 'rejected' | 'timeout' | 'not_connected'
  | 'invalid_xdr' | 'wallet_error' | 'unknown';

export interface XdrSigningError {
  code: XdrSigningErrorCode;
  message: string;
  retryable: boolean;
}

export type XdrSigningResponse =
  | { ok: true; signedXdr: string }
  | { ok: false; error: XdrSigningError };

export interface UseXdrSignerResult {
  activeKey: string | null;
  isConnected: boolean;
  isPending: boolean;
  error: string | null;
  signingError: XdrSigningError | null;
  status: XdrSigningState;
  isFreighterAvailable: boolean;
  connectWallet: () => Promise<string | null>;
  signXdr: (xdr: string, networkPassphrase?: string) => Promise<string | null>;
  signXdrDetailed: (xdr: string, networkPassphrase?: string) => Promise<XdrSigningResponse>;
  disconnectWallet: () => void;
  setActiveKey: (key: string | null) => void;
  reset: () => void;
}

const DEFAULT_PASSPHRASE = 'Test SDF Network ; September 2015';
const TIMEOUT_MS = 20000;

function classifySigningError(error: unknown): XdrSigningError {
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : 'Unknown wallet error';
  if (/rejected|denied|cancelled|canceled|declined|dismissed|user declined/i.test(message)) {
    return { code: 'rejected', message: 'Signing request cancelled in Freighter.', retryable: false };
  }
  if (/timeout|timed out/i.test(message)) {
    return { code: 'timeout', message: 'Freighter did not respond in time. Unlock the extension and try again.', retryable: true };
  }
  if (/not installed|unavailable|not detected|extension/i.test(message)) {
    return { code: 'extension_unavailable', message: 'Freighter is unavailable. Install or enable the extension.', retryable: false };
  }
  if (/not connected|not authorized|unauthorized/i.test(message)) {
    return { code: 'not_connected', message: 'Connect and unlock Freighter before signing.', retryable: true };
  }
  if (/invalid xdr|invalid transaction|malformed/i.test(message)) {
    return { code: 'invalid_xdr', message: 'The transaction XDR is invalid.', retryable: false };
  }
  return { code: 'wallet_error', message: message || 'Freighter could not complete signing.', retryable: true };
}

function withTimeout<T>(operation: Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Freighter request timed out')), TIMEOUT_MS);
    operation.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (error: unknown) => { clearTimeout(timer); reject(error); },
    );
  });
}

export function useXdrSigner(): UseXdrSignerResult {
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [status, setStatus] = useState<XdrSigningState>('idle');
  const [signingError, setSigningError] = useState<XdrSigningError | null>(null);
  const [isFreighterAvailable, setIsFreighterAvailable] = useState(false);
  const pending = useRef(false);
  const generation = useRef(0);
  const mounted = useRef(true);

  const fail = useCallback((raw: unknown, notify = true) => {
    const error = classifySigningError(raw);
    if (mounted.current) {
      setSigningError(error);
      setStatus('error');
    }
    if (notify && mounted.current) {
      if (error.code === 'rejected') toast.info(error.message);
      else toast.error('Wallet request failed', { description: error.message });
    }
    return error;
  }, []);

  useEffect(() => {
    mounted.current = true;
    const run = generation.current;
    const check = async () => {
      try {
        if (typeof freighter.isConnected !== 'function') return;
        const response = await withTimeout(freighter.isConnected());
        if (!mounted.current || run !== generation.current) return;
        const connected = typeof response === 'boolean' ? response : Boolean(response?.isConnected);
        setIsFreighterAvailable(connected);
        if (!connected || typeof freighter.getAddress !== 'function') return;
        const info = await withTimeout(freighter.getAddress());
        if (mounted.current && run === generation.current && info?.address) setActiveKey(info.address);
      } catch {
        if (mounted.current && run === generation.current) setIsFreighterAvailable(false);
      }
    };
    void check();
    return () => { mounted.current = false; generation.current += 1; };
  }, []);

  const begin = useCallback((next: 'connecting' | 'signing') => {
    if (pending.current) return false;
    pending.current = true;
    setSigningError(null);
    setStatus(next);
    return true;
  }, []);

  const connectWallet = useCallback(async (): Promise<string | null> => {
    if (!begin('connecting')) return null;
    const run = ++generation.current;
    try {
      if (typeof freighter.requestAccess !== 'function') throw new Error('Freighter extension unavailable');
      const access = await withTimeout(freighter.requestAccess());
      if (run !== generation.current) return null;
      const key = typeof access === 'string' ? access : access?.address;
      if (!key) {
        if (access && typeof access === 'object' && 'error' in access && access.error) {
          throw new Error(String(access.error));
        }
        throw new Error('Freighter connection was rejected');
      }
      if (mounted.current) {
        setActiveKey(key);
        setIsFreighterAvailable(true);
        setStatus('idle');
      }
      return key;
    } catch (error) {
      if (run === generation.current) fail(error);
      return null;
    } finally {
      pending.current = false;
    }
  }, [begin, fail]);

  const signXdrDetailed = useCallback(async (
    xdr: string,
    networkPassphrase = DEFAULT_PASSPHRASE,
  ): Promise<XdrSigningResponse> => {
    if (!begin('signing')) {
      return { ok: false, error: { code: 'wallet_error', message: 'A wallet request is already pending.', retryable: true } };
    }
    const run = ++generation.current;
    try {
      if (!xdr.trim()) throw new Error('Invalid XDR: a transaction is required');
      if (typeof freighter.signTransaction !== 'function') throw new Error('Freighter extension unavailable');
      const response = await withTimeout(freighter.signTransaction(xdr, { networkPassphrase }));
      if (run !== generation.current) {
        return { ok: false, error: { code: 'unknown', message: 'Signing request was superseded.', retryable: true } };
      }
      const signedXdr = typeof response === 'string' ? response : response?.signedTxXdr;
      if (!signedXdr || typeof signedXdr !== 'string') {
        const raw = response && typeof response === 'object' && 'error' in response ? response.error : null;
        throw new Error(raw ? String(raw) : 'Freighter did not return a signed transaction.');
      }
      if (mounted.current) {
        setStatus('success');
        toast.success('Transaction signed', { description: 'The signed XDR is ready for submission.' });
      }
      return { ok: true, signedXdr };
    } catch (error) {
      return { ok: false, error: run === generation.current ? fail(error) : classifySigningError(error) };
    } finally {
      pending.current = false;
    }
  }, [begin, fail]);

  const signXdr = useCallback(async (xdr: string, networkPassphrase?: string) => {
    const response = await signXdrDetailed(xdr, networkPassphrase);
    return response.ok ? response.signedXdr : null;
  }, [signXdrDetailed]);

  const reset = useCallback(() => {
    generation.current += 1;
    pending.current = false;
    setSigningError(null);
    setStatus('idle');
  }, []);

  const disconnectWallet = useCallback(() => {
    reset();
    setActiveKey(null);
    setIsFreighterAvailable(false);
  }, [reset]);

  return {
    activeKey, isConnected: Boolean(activeKey), isPending: status === 'connecting' || status === 'signing',
    error: signingError?.message ?? null, signingError, status, isFreighterAvailable,
    connectWallet, signXdr, signXdrDetailed, disconnectWallet, setActiveKey, reset,
  };
}
