import type { StellarAccountBalance, StellarAccountSnapshot } from '@/types/stellar';

/**
 * Deterministic Stellar account fixtures.
 *
 * When the app runs without `NEXT_PUBLIC_API_URL` every screen is served mock
 * data; the polling hook must stay exerciseable there too. Snapshots are derived
 * from the account key (same key → same holdings) with a slow, time-bucketed
 * drift so successive polls visibly change amounts instead of returning a frozen
 * object. Pure and free of network access so it can be unit-tested directly.
 */

/** Amounts drift once per poll window (30s) rather than on every render. */
const DRIFT_BUCKET_MS = 30_000;

/** Fixed epoch keeps the simulated activity counters stable across reloads. */
const MOCK_EPOCH_MS = Date.UTC(2026, 0, 1);

/** Baseline holdings for a mock account. Issuers are the canonical mainnet ones. */
const MOCK_HOLDINGS: ReadonlyArray<StellarAccountBalance> = [
  { asset: 'XLM', issuer: null, balance: 12_480.5 },
  {
    asset: 'USDC',
    issuer: 'GA5ZSEJYB37JTH5UA4GHHQTUWQZ3XMY4Y2S3VHLW7A7I73ZMIFR67LMZ',
    balance: 8_642.18,
  },
  {
    asset: 'AQUA',
    issuer: 'GBNZILSTVQZ4R7IKQDGHYGY2QXL5QOFJYQMXPKWRRM5PAV7Y4M67AQUA',
    balance: 51_200,
  },
  {
    asset: 'yUSDF',
    issuer: 'GDDY7HZ4V3FQ2J6XQ4UZ5W2R7N3K6M5P4T2B7C3L6A5D4E3F2G7H8J9K',
    balance: 2_400,
  },
];

/** FNV-1a — tiny, stable string hash used to seed the per-account generator. */
function hashPublicKey(publicKey: string): number {
  let hash = 2166136261;
  for (let i = 0; i < publicKey.length; i += 1) {
    hash ^= publicKey.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** Mulberry32 PRNG: deterministic, dependency-free, good enough for fixtures. */
function createRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Round to Stellar's 7-decimal precision so amounts look ledger-real. */
function roundStroops(value: number): number {
  return Number(value.toFixed(7));
}

/**
 * Build a stable snapshot for `publicKey` at `now`.
 *
 * @param publicKey Account key the snapshot belongs to.
 * @param now       Epoch milliseconds; exposed for deterministic tests.
 */
export function buildMockStellarAccountSnapshot(
  publicKey: string,
  now: number = Date.now(),
): StellarAccountSnapshot {
  const seed = hashPublicKey(publicKey);
  const bucket = Math.floor(now / DRIFT_BUCKET_MS);
  const random = createRandom(seed ^ bucket);

  // Accounts vary in size (0.6×–2.0×) but keep that size for a given key.
  const scale = 0.6 + (seed % 1000) / 700;

  const balances = MOCK_HOLDINGS.map((holding) => {
    // ±0.5% drift per bucket keeps polling visible without looking erratic.
    const drift = 0.995 + random() * 0.01;
    return {
      ...holding,
      balance: roundStroops(holding.balance * scale * drift),
    };
  });

  const baseTransactionCount = 420 + (seed % 900);
  // Activity ticks once per poll window and wraps every eight hours, keeping the
  // simulated counter plausible while still moving between refetches.
  const pollWindowsSinceEpoch = Math.max(0, Math.floor((now - MOCK_EPOCH_MS) / DRIFT_BUCKET_MS));

  return {
    publicKey,
    balances,
    sequence: String(52_000_000_000_000 + bucket),
    transactionCount: baseTransactionCount + (pollWindowsSinceEpoch % 480),
    transactionCountIsLowerBound: false,
    source: 'mock',
    fetchedAt: new Date(now).toISOString(),
  };
}
