import type {
  ActivityPoint,
  AiBriefing,
  AnalyticsOverview,
  ApiKey,
  ChatMessage,
  Webhook,
} from '@/types/domain';

const cashflow = [
  { date: '2026-07-01', inflow: 120_000, outflow: 42_000, net: 78_000 },
  { date: '2026-07-05', inflow: 0, outflow: 61_500, net: -61_500 },
  { date: '2026-07-09', inflow: 250_000, outflow: 38_200, net: 211_800 },
  { date: '2026-07-13', inflow: 0, outflow: 54_900, net: -54_900 },
  { date: '2026-07-17', inflow: 80_000, outflow: 47_300, net: 32_700 },
  { date: '2026-07-21', inflow: 0, outflow: 66_100, net: -66_100 },
  { date: '2026-07-25', inflow: 140_000, outflow: 51_800, net: 88_200 },
  { date: '2026-07-29', inflow: 500_000, outflow: 72_040, net: 427_960 },
  { date: '2026-07-31', inflow: 0, outflow: 27_740, net: -27_740 },
];

export const analyticsOverview: AnalyticsOverview = {
  totalBalance: 12_375_715.81,
  monthlySpend: 294_990,
  monthlySpendDelta: 12.4,
  activeAgents: 4,
  pendingApprovals: 3,
  budgetUtilization: 59,
  cashflow,
  spendingByCategory: [
    { category: 'Compute & cloud', amount: 142_800 },
    { category: 'Model APIs', amount: 68_400 },
    { category: 'Datasets', amount: 41_050 },
    { category: 'Software licenses', amount: 24_200 },
    { category: 'Data labeling', amount: 18_540 },
  ],
  agentSpend: [
    { agentId: 'agt_orion', agentName: 'Orion', role: 'operations', spent: 72_340, transactions: 48 },
    { agentId: 'agt_atlas', agentName: 'Atlas', role: 'finance', spent: 168_420, transactions: 96 },
    { agentId: 'agt_kepler', agentName: 'Kepler', role: 'research', spent: 41_120, transactions: 61 },
    { agentId: 'agt_vega', agentName: 'Vega', role: 'procurement', spent: 12_900, transactions: 14 },
    { agentId: 'agt_lyra', agentName: 'Lyra', role: 'custom', spent: 210, transactions: 3 },
  ],
  riskDistribution: [
    { level: 'low', count: 214 },
    { level: 'medium', count: 63 },
    { level: 'high', count: 18 },
    { level: 'critical', count: 4 },
  ],
  budgetWaterfall: [
    { label: 'Allocated', value: 500_000, kind: 'total' },
    { label: 'Engineering', value: -138_600, kind: 'spend' },
    { label: 'Operations', value: -142_800, kind: 'spend' },
    { label: 'Research', value: -96_050, kind: 'spend' },
    { label: 'Marketing', value: -18_540, kind: 'spend' },
    { label: 'Remaining', value: 104_010, kind: 'remaining' },
  ],
};

export const aiBriefing: AiBriefing = {
  greeting: 'Good morning, Ada',
  summary:
    'Treasury is healthy at $12.38M with 59% of this month’s budget consumed. Three items need your attention before end of day.',
  generatedAt: '2026-07-31T08:10:00.000Z',
  insights: [
    {
      id: 'ins_1',
      title: 'Operations budget will exhaust in ~1 day',
      detail:
        'Operations & cloud has 7,200 USDC left and resets Aug 1. Orion’s reserved-instance renewal (9,240 USDC) is due tomorrow and would overshoot. I can prepare a 15,000 USDC reallocation from Marketing, which is only 37% used.',
      severity: 'warning',
      action: { label: 'Review reallocation', href: '/budgets' },
    },
    {
      id: 'ins_2',
      title: '3 approvals pending — 1 is time-sensitive',
      detail:
        'Scale AI (22,000 USDC) has one of two approvals and expires in ~24h. Linear renewal (6,800 USDC) and a rejected critical-risk item also await review.',
      severity: 'info',
      action: { label: 'Open approvals', href: '/approvals' },
    },
    {
      id: 'ins_3',
      title: 'Critical-risk transfer blocked',
      detail:
        'Orion attempted 41,000 USDC to an unverified wallet (risk 91). Policy correctly blocked it. I recommend adding the recipient to the blocklist until KYC completes.',
      severity: 'danger',
      action: { label: 'Investigate', href: '/analytics' },
    },
    {
      id: 'ins_4',
      title: 'Spend is trending up 12.4% MoM',
      detail:
        'Compute is the largest driver (48% of spend). At the current rate you will finish the month ~6% under the company budget.',
      severity: 'success',
      action: { label: 'See analytics', href: '/analytics' },
    },
  ],
  suggestedActions: [
    { label: 'Prepare month-end treasury report', prompt: 'Prepare a month-end treasury report' },
    { label: 'Reallocate Marketing → Operations', prompt: 'Move 15,000 USDC from Marketing to Operations' },
    { label: 'Summarize agent spend this week', prompt: 'Summarize agent spend this week' },
  ],
};

export const assistantSeed: ChatMessage[] = [
  {
    id: 'msg_1',
    role: 'assistant',
    content:
      'I’m your financial chief of staff. Ask me about balances, agent spend, budgets, policies or pending approvals — or ask me to prepare a report.',
    createdAt: '2026-07-31T08:10:00.000Z',
  },
];

export const apiKeys: ApiKey[] = [
  {
    id: 'key_live',
    name: 'Production server',
    prefix: 'ak_live_7Fq2',
    permissions: ['wallet.read', 'wallet.transfer', 'proposal.create'],
    lastUsed: '2026-07-31T07:55:00.000Z',
    createdAt: '2025-11-11T09:00:00.000Z',
  },
  {
    id: 'key_ci',
    name: 'CI sandbox',
    prefix: 'ak_test_9Lp4',
    permissions: ['wallet.read', 'analytics.read'],
    lastUsed: '2026-07-30T22:40:00.000Z',
    createdAt: '2026-02-02T09:00:00.000Z',
    expiresAt: '2026-12-31T00:00:00.000Z',
  },
];

export const webhooks: Webhook[] = [
  {
    id: 'wh_slack',
    url: 'https://hooks.novalabs.ai/astroid/slack',
    events: ['proposal.approved', 'budget.exceeded', 'policy.violated'],
    enabled: true,
    createdAt: '2025-12-15T09:00:00.000Z',
  },
  {
    id: 'wh_ledger',
    url: 'https://ledger.novalabs.ai/ingest',
    events: ['transaction.completed', 'transaction.failed'],
    enabled: true,
    createdAt: '2026-01-20T09:00:00.000Z',
  },
];

// ---------------------------------------------------------------------------
// Activity timeseries — deterministic (seeded) so SSR and client hydration
// render identical curves, covering 60 days of hourly observations so every
// interval (24h / 7d / 30d) has a full preceding period for trend comparison.
// ---------------------------------------------------------------------------

/** mulberry32 — small seeded PRNG so mock generation is reproducible. */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const HOUR_MS = 3_600_000;
const ACTIVITY_DAYS = 60;

/** Business-hours and weekend multipliers shape a believable agent workload. */
function activityShape(timestamp: number): number {
  const d = new Date(timestamp);
  const hour = d.getUTCHours();
  const day = d.getUTCDay();
  const weekend = day === 0 || day === 6 ? 0.3 : 1;
  const business = hour >= 8 && hour <= 19 ? 1 : 0.22;
  return weekend * business;
}

function generateActivity(): ActivityPoint[] {
  const rng = mulberry32(0x51a7c0de);
  const end = Date.UTC(2026, 6, 31, 23, 0, 0); // 2026-07-31T23:00:00Z
  const points: ActivityPoint[] = [];

  for (let i = ACTIVITY_DAYS * 24 - 1; i >= 0; i--) {
    const timestamp = end - i * HOUR_MS;
    const shape = activityShape(timestamp);
    // Occasional spikes (large settlement runs) keep the curve interesting.
    const spike = rng() > 0.94 ? 2 + rng() * 1.5 : 1;
    const count = Math.max(0, Math.round(9 * shape * (0.4 + rng()) * spike));
    const avgTicket = 280 + rng() * 820;
    points.push({
      timestamp: new Date(timestamp).toISOString(),
      count,
      spend: Math.round(count * avgTicket * 100) / 100,
    });
  }
  return points;
}

export const activityData: ActivityPoint[] = generateActivity();
