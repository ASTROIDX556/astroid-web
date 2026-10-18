'use client';

import { useState, useEffect, useCallback } from 'react';

export type CongestionState = 'low' | 'medium' | 'high';

export interface FeeEstimate {
  baseFeeStroops: number;
  baseFeeXlm: string;
  suggestedFeeStroops: number;
  suggestedFeeXlm: string;
  congestion: CongestionState;
  estimatedInclusionSec: number;
  inclusionLabel: string;
  loading: boolean;
  error: string | null;
  lastUpdated: number;
  refetch: () => Promise<void>;
}

export interface UseStellarFeeEstimateOptions {
  pollIntervalMs?: number;
  enabled?: boolean;
}

const DEFAULT_BASE_FEE_STROOPS = 100;
const DEFAULT_INCLUSION_SEC = 5;

function stroopsToXlm(stroops: number): string {
  return (stroops / 10_000_000).toFixed(7);
}

export function useStellarFeeEstimate(options: UseStellarFeeEstimateOptions = {}): FeeEstimate {
  const { pollIntervalMs, enabled = true } = options;
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [baseFeeStroops, setBaseFeeStroops] = useState<number>(DEFAULT_BASE_FEE_STROOPS);
  const [suggestedFeeStroops, setSuggestedFeeStroops] = useState<number>(DEFAULT_BASE_FEE_STROOPS);
  const [congestion, setCongestion] = useState<CongestionState>('low');
  const [estimatedInclusionSec, setEstimatedInclusionSec] = useState<number>(DEFAULT_INCLUSION_SEC);
  const [inclusionLabel, setInclusionLabel] = useState<string>('3–5 sec');
  const [lastUpdated, setLastUpdated] = useState<number>(Date.now());

  const fetchFeeEstimate = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setError(null);

    try {
      // Attempt fetch from Horizon / RPC endpoint or fallback gracefully
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      let feeRate = DEFAULT_BASE_FEE_STROOPS;
      let congState: CongestionState = 'low';

      try {
        const res = await fetch('https://horizon.stellar.org/fee_stats', {
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        if (res.ok) {
          const data = await res.json();
          const acceptedFee = data?.ledger_capacity_usage;
          const modeFee = data?.fee_charged?.mode;
          if (typeof modeFee === 'number' && modeFee > 0) {
            feeRate = modeFee;
          } else if (typeof acceptedFee === 'string') {
            const usage = parseFloat(acceptedFee);
            if (usage > 0.8) {
              congState = 'high';
              feeRate = DEFAULT_BASE_FEE_STROOPS * 2.5;
            } else if (usage > 0.4) {
              congState = 'medium';
              feeRate = DEFAULT_BASE_FEE_STROOPS * 1.5;
            }
          }
        }
      } catch {
        // Fallback on network error or timeout
      }

      setBaseFeeStroops(DEFAULT_BASE_FEE_STROOPS);
      setSuggestedFeeStroops(Math.round(feeRate));
      setCongestion(congState);
      
      const incSec = congState === 'high' ? 15 : congState === 'medium' ? 8 : 5;
      setEstimatedInclusionSec(incSec);
      setInclusionLabel(congState === 'high' ? '10–30 sec' : congState === 'medium' ? '5–10 sec' : '3–5 sec');
      setLastUpdated(Date.now());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch fee estimate');
      // Graceful fallback values
      setBaseFeeStroops(DEFAULT_BASE_FEE_STROOPS);
      setSuggestedFeeStroops(DEFAULT_BASE_FEE_STROOPS);
      setCongestion('low');
      setEstimatedInclusionSec(DEFAULT_INCLUSION_SEC);
      setInclusionLabel('3–5 sec');
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    fetchFeeEstimate();

    if (pollIntervalMs && pollIntervalMs > 0) {
      const interval = setInterval(fetchFeeEstimate, pollIntervalMs);
      return () => clearInterval(interval);
    }
  }, [enabled, pollIntervalMs, fetchFeeEstimate]);

  return {
    baseFeeStroops,
    baseFeeXlm: stroopsToXlm(baseFeeStroops),
    suggestedFeeStroops,
    suggestedFeeXlm: stroopsToXlm(suggestedFeeStroops),
    congestion,
    estimatedInclusionSec,
    inclusionLabel,
    loading,
    error,
    lastUpdated,
    refetch: fetchFeeEstimate,
  };
}
