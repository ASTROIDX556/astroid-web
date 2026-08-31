import type { Proposal, Transaction } from '@/types/domain';

export type TransactionFilterStatus = 'Pending' | 'Approved' | 'Rejected';

export interface TransactionQuery {
  search?: string;
  asset?: string;
  status?: TransactionFilterStatus;
  department?: string;
  agentId?: string;
  page?: number;
  pageSize?: number;
}

export interface TransactionPage {
  items: Transaction[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

const DEPARTMENT_BY_WALLET: Record<string, string> = {
  wal_finance: 'Finance',
  wal_ops: 'Operations',
  wal_treasury: 'Treasury',
  wal_research: 'Research',
  wal_procure: 'Procurement',
};

export const transactions: Transaction[] = [
  {
    id: 'txn_9f21',
    organizationId: 'org_nova',
    walletId: 'wal_finance',
    agentId: 'agt_atlas',
    agentName: 'Atlas',
    proposalId: 'prop_1',
    policyId: 'pol_max_txn',
    direction: 'outbound',
    counterparty: 'OpenAI',
    counterpartyAddress: 'GAOPENAI7VENDORQK9M2WL4PC8RD3YHF6JN1STELLARWALLETXZ',
    asset: 'USDC',
    amount: 18_500,
    usdValue: 18_500,
    memo: 'API credits — Q3 inference',
    purpose: 'Purchase additional inference credits for research pipeline',
    status: 'completed',
    riskScore: 24,
    stellarHash: 'a3f9c1e7b2d84f60a1c5e9d3b7f20a48c6e1d9f3b5a70c28e4d1f6b9a3c5e70d2',
    createdAt: '2026-07-31T07:42:00.000Z',
  },
  {
    id: 'txn_8c04',
    organizationId: 'org_nova',
    walletId: 'wal_ops',
    agentId: 'agt_orion',
    agentName: 'Orion',
    policyId: 'pol_time_window',
    direction: 'outbound',
    counterparty: 'AWS',
    counterpartyAddress: 'GAAWSCLOUDVENDOR2QK7WL8PC3RD6YHF0JN5M4V9STELLARADDR',
    asset: 'USDC',
    amount: 9_240.5,
    usdValue: 9_240.5,
    memo: 'Compute — July reserved instances',
    purpose: 'Monthly reserved compute for model serving',
    status: 'confirmed',
    riskScore: 31,
    stellarHash: 'b7e2d1f9a3c5e70d84f60a1c5e9d3b7f20a48c6e1d9f3b5a70c28e4d1f6b9a3c5',
    createdAt: '2026-07-31T05:11:00.000Z',
  },
  {
    id: 'txn_7b55',
    organizationId: 'org_nova',
    walletId: 'wal_treasury',
    direction: 'inbound',
    counterparty: 'Circle',
    counterpartyAddress: 'GACIRCLEONRAMP9M4V2QK7WL8PC3RD6YHF0JN5STELLARWXZ21',
    asset: 'USDC',
    amount: 500_000,
    usdValue: 500_000,
    memo: 'Treasury top-up',
    purpose: 'Scheduled treasury funding from operating account',
    status: 'completed',
    riskScore: 4,
    stellarHash: 'c5e70d2a3f9c1e7b2d84f60a1c5e9d3b7f20a48c6e1d9f3b5a70c28e4d1f6b9a3',
    createdAt: '2026-07-30T22:05:00.000Z',
  },
  {
    id: 'txn_6a12',
    organizationId: 'org_nova',
    walletId: 'wal_research',
    agentId: 'agt_kepler',
    agentName: 'Kepler',
    policyId: 'pol_vendor_allow',
    direction: 'outbound',
    counterparty: 'Hugging Face',
    counterpartyAddress: 'GAHUGGINGFACE4M9V2QK7WL8PC3RD6YHF0JN5STELLARADDRX21',
    asset: 'USDC',
    amount: 3_120,
    usdValue: 3_120,
    memo: 'Dataset — multilingual corpus',
    purpose: 'License multilingual dataset for translation research',
    status: 'completed',
    riskScore: 18,
    stellarHash: 'd1f6b9a3c5e70d2a3f9c1e7b2d84f60a1c5e9d3b7f20a48c6e1d9f3b5a70c28e4',
    createdAt: '2026-07-30T16:48:00.000Z',
  },
  {
    id: 'txn_5f88',
    organizationId: 'org_nova',
    walletId: 'wal_finance',
    agentId: 'agt_atlas',
    agentName: 'Atlas',
    proposalId: 'prop_2',
    policyId: 'pol_approval_5k',
    direction: 'outbound',
    counterparty: 'Scale AI',
    counterpartyAddress: 'GASCALEAIVENDOR7WL8PC3RD6YHF0JN5M4V9QK2STELLARADDR1',
    asset: 'USDC',
    amount: 22_000,
    usdValue: 22_000,
    memo: 'Data labeling — safety eval set',
    purpose: 'Human labeling for red-team evaluation dataset',
    status: 'pending',
    riskScore: 58,
    createdAt: '2026-07-31T08:00:00.000Z',
  },
  {
    id: 'txn_4d33',
    organizationId: 'org_nova',
    walletId: 'wal_ops',
    agentId: 'agt_orion',
    agentName: 'Orion',
    direction: 'outbound',
    counterparty: 'Unknown wallet',
    counterpartyAddress: 'GAUNKNOWN9F2X7QK4M9V3WL8PC6RD5YHF1JN0STELLARDEST88Z',
    asset: 'USDC',
    amount: 41_000,
    usdValue: 41_000,
    memo: 'Vendor onboarding',
    purpose: 'First payment to unverified infrastructure vendor',
    status: 'failed',
    riskScore: 91,
    createdAt: '2026-07-29T23:14:00.000Z',
  },
  {
    id: 'txn_3e77',
    organizationId: 'org_nova',
    walletId: 'wal_research',
    agentId: 'agt_kepler',
    agentName: 'Kepler',
    policyId: 'pol_vendor_allow',
    direction: 'outbound',
    counterparty: 'Modal',
    counterpartyAddress: 'GAMODALCOMPUTE2QK7WL8PC3RD6YHF0JN5M4V9STELLARADDRX9',
    asset: 'USDC',
    amount: 1_480,
    usdValue: 1_480,
    memo: 'Serverless GPU — batch job',
    purpose: 'Overnight fine-tuning batch on serverless GPUs',
    status: 'completed',
    riskScore: 12,
    stellarHash: 'e4d1f6b9a3c5e70d2a3f9c1e7b2d84f60a1c5e9d3b7f20a48c6e1d9f3b5a70c28',
    createdAt: '2026-07-29T02:30:00.000Z',
  },
  {
    id: 'txn_2c19',
    organizationId: 'org_nova',
    walletId: 'wal_procure',
    agentId: 'agt_vega',
    agentName: 'Vega',
    proposalId: 'prop_3',
    direction: 'outbound',
    counterparty: 'Linear',
    counterpartyAddress: 'GALINEARSAAS7WL8PC3RD6YHF0JN5M4V9QK2STELLARADDRX21',
    asset: 'USDC',
    amount: 6_800,
    usdValue: 6_800,
    memo: 'Annual license renewal',
    purpose: 'Renew team project-management license',
    status: 'draft',
    riskScore: 27,
    createdAt: '2026-07-28T14:02:00.000Z',
  },
];

export const proposals: Proposal[] = [
  {
    id: 'prop_2',
    organizationId: 'org_nova',
    transactionId: 'txn_5f88',
    title: 'Scale AI — safety eval labeling',
    description:
      'Atlas proposes 22,000 USDC to Scale AI for human labeling of the red-team evaluation dataset. Exceeds the 5,000 dual-approval threshold.',
    status: 'pending',
    kind: 'dual',
    agentName: 'Atlas',
    amount: 22_000,
    asset: 'USDC',
    counterparty: 'Scale AI',
    riskScore: 58,
    requiredApprovals: 2,
    approvals: [
      {
        id: 'apr_1',
        userId: 'usr_marco',
        userName: 'Marco Vitale',
        decision: 'approved',
        comment: 'Aligned with Q3 safety plan. Approved.',
        createdAt: '2026-07-31T08:06:00.000Z',
      },
      {
        id: 'apr_2',
        userId: 'usr_ada',
        userName: 'Ada Okonkwo',
        decision: 'pending',
      },
    ],
    expiresAt: '2026-08-01T08:00:00.000Z',
    createdAt: '2026-07-31T08:00:00.000Z',
  },
  {
    id: 'prop_3',
    organizationId: 'org_nova',
    transactionId: 'txn_2c19',
    title: 'Linear — annual license renewal',
    description:
      'Vega proposes 6,800 USDC to renew the annual Linear license. Requires dual approval; vendor is allow-listed.',
    status: 'pending',
    kind: 'dual',
    agentName: 'Vega',
    amount: 6_800,
    asset: 'USDC',
    counterparty: 'Linear',
    riskScore: 27,
    requiredApprovals: 2,
    approvals: [
      {
        id: 'apr_3',
        userId: 'usr_lin',
        userName: 'Lin Zhao',
        decision: 'pending',
      },
      {
        id: 'apr_4',
        userId: 'usr_marco',
        userName: 'Marco Vitale',
        decision: 'pending',
      },
    ],
    expiresAt: '2026-08-02T14:00:00.000Z',
    createdAt: '2026-07-28T14:02:00.000Z',
  },
  {
    id: 'prop_4',
    organizationId: 'org_nova',
    transactionId: 'txn_high',
    title: 'Vendor onboarding — unverified recipient',
    description:
      'Orion attempted 41,000 USDC to an unverified wallet. Risk engine flagged critical (91). Committee approval required before any retry.',
    status: 'pending',
    kind: 'committee',
    agentName: 'Orion',
    amount: 41_000,
    asset: 'USDC',
    counterparty: 'Unknown wallet',
    riskScore: 91,
    requiredApprovals: 3,
    approvals: [
      { id: 'apr_5', userId: 'usr_ada', userName: 'Ada Okonkwo', decision: 'pending' },
      { id: 'apr_6', userId: 'usr_lin', userName: 'Lin Zhao', decision: 'pending' },
      {
        id: 'apr_7',
        userId: 'usr_marco',
        userName: 'Marco Vitale',
        decision: 'rejected',
        comment: 'Unverified recipient. Do not proceed without KYC.',
        createdAt: '2026-07-30T00:10:00.000Z',
      },
    ],
    expiresAt: '2026-07-31T23:14:00.000Z',
    createdAt: '2026-07-29T23:14:00.000Z',
  },
  {
    id: 'prop_1',
    organizationId: 'org_nova',
    transactionId: 'txn_9f21',
    title: 'OpenAI — Q3 inference credits',
    description: 'Atlas purchased 18,500 USDC of inference credits. Executed.',
    status: 'executed',
    kind: 'single',
    agentName: 'Atlas',
    amount: 18_500,
    asset: 'USDC',
    counterparty: 'OpenAI',
    riskScore: 24,
    requiredApprovals: 1,
    approvals: [
      {
        id: 'apr_0',
        userId: 'usr_marco',
        userName: 'Marco Vitale',
        decision: 'approved',
        comment: 'Within budget.',
        createdAt: '2026-07-31T07:40:00.000Z',
      },
    ],
    expiresAt: '2026-08-01T07:00:00.000Z',
    createdAt: '2026-07-31T07:30:00.000Z',
  },
];

export function getTransactionDepartment(transaction: Transaction): string {
  return transaction.walletId ? DEPARTMENT_BY_WALLET[transaction.walletId] ?? 'Other' : 'Other';
}

export const transactionDepartments = Array.from(
  new Set(transactions.map(getTransactionDepartment)),
).sort();

export const transactionAssets = Array.from(
  new Set(transactions.map((transaction) => transaction.asset)),
).sort();

const transactionSearchIndex = new Map<string, string>(
  transactions.map((transaction): [string, string] => [
    transaction.id,
    [
      transaction.asset,
      transaction.counterpartyAddress,
      transaction.counterparty,
      transaction.agentName,
      transaction.memo,
      transaction.purpose,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase(),
  ]),
);

export function getTransactionFilterStatus(transaction: Transaction): TransactionFilterStatus {
  switch (transaction.status) {
    case 'completed':
    case 'confirmed':
    case 'approved':
      return 'Approved';
    case 'failed':
    case 'rejected':
      return 'Rejected';
    case 'pending':
    case 'draft':
      return 'Pending';
    default:
      return 'Pending';
  }
}

function matchesTransactionQuery(transaction: Transaction, query: TransactionQuery): boolean {
  const search = query.search?.trim().toLowerCase();
  if (search) {
    const haystack = transactionSearchIndex.get(transaction.id) ?? '';

    if (!haystack.includes(search)) {
      return false;
    }
  }

  if (query.asset && transaction.asset.toLowerCase() !== query.asset.toLowerCase()) {
    return false;
  }

  if (query.status && getTransactionFilterStatus(transaction) !== query.status) {
    return false;
  }

  if (query.department && getTransactionDepartment(transaction) !== query.department) {
    return false;
  }

  if (query.agentId && transaction.agentId !== query.agentId) {
    return false;
  }

  return true;
}

export function queryTransactions(query: TransactionQuery = {}): TransactionPage {
  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.max(1, query.pageSize ?? 10);
  const filtered = transactions.filter((transaction) => matchesTransactionQuery(transaction, query));
  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const normalizedPage = Math.min(page, totalPages);
  const start = (normalizedPage - 1) * pageSize;

  return {
    items: filtered.slice(start, start + pageSize),
    total,
    page: normalizedPage,
    pageSize,
    totalPages,
  };
}

const MAX_TRANSACTION_QUERY_CACHE_SIZE = 100;

const transactionQueryCache = new Map<string, TransactionPage>();
const transactionFilterCache = new Map<string, Transaction[]>();

export function clearTransactionQueryCache(): void {
  transactionQueryCache.clear();
  transactionFilterCache.clear();
}

export function queryTransactionsCached(query: TransactionQuery = {}): TransactionPage {
  const queryKey = JSON.stringify(query);
  const cachedPage = transactionQueryCache.get(queryKey);
  if (cachedPage) {
    return cachedPage;
  }

  const { page, pageSize, ...filterQuery } = query;
  const filterKey = JSON.stringify(filterQuery);
  let filtered = transactionFilterCache.get(filterKey);
  if (!filtered) {
    filtered = transactions.filter((transaction) => matchesTransactionQuery(transaction, filterQuery));
    if (transactionFilterCache.size >= MAX_TRANSACTION_QUERY_CACHE_SIZE) {
      transactionFilterCache.clear();
    }
    transactionFilterCache.set(filterKey, filtered);
  }

  const normalizedPage = Math.max(1, page ?? 1);
  const normalizedPageSize = Math.max(1, pageSize ?? 10);
  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / normalizedPageSize));
  const safePage = Math.min(normalizedPage, totalPages);
  const start = (safePage - 1) * normalizedPageSize;

  const result: TransactionPage = {
    items: filtered.slice(start, start + normalizedPageSize),
    total,
    page: safePage,
    pageSize: normalizedPageSize,
    totalPages,
  };

  if (transactionQueryCache.size >= MAX_TRANSACTION_QUERY_CACHE_SIZE) {
    transactionQueryCache.clear();
  }
  transactionQueryCache.set(queryKey, result);

  return result;
}
uery = {}): TransactionPage {
  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.max(1, query.pageSize ?? 10);
  const cacheKey = JSON.stringify({ ...query, page, pageSize });
  const cached = transactionQueryCache.get(cacheKey);

  if (cached) {
    return cached;
  }

  const filterKey = JSON.stringify({
    search: query.search,
    asset: query.asset,
    status: query.status,
    department: query.department,
    agentId: query.agentId,
  });
  let filtered = transactionFilterCache.get(filterKey);

  if (!filtered) {
    filtered = queryTransactions({ ...query, page: 1, pageSize: Number.MAX_SAFE_INTEGER }).items;
    transactionFilterCache.set(filterKey, filtered);

    if (transactionFilterCache.size > MAX_TRANSACTION_QUERY_CACHE_SIZE) {
      const oldestKey = transactionFilterCache.keys().next().value;
      if (oldestKey !== undefined) {
        transactionFilterCache.delete(oldestKey);
      }
    }
  }

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const normalizedPage = Math.min(page, totalPages);
  const start = (normalizedPage - 1) * pageSize;

  const result: TransactionPage = {
    items: filtered.slice(start, start + pageSize),
    total,
    page: normalizedPage,
    pageSize,
    totalPages,
  };
  transactionQueryCache.set(cacheKey, result);

  if (transactionQueryCache.size > MAX_TRANSACTION_QUERY_CACHE_SIZE) {
    const oldestKey = transactionQueryCache.keys().next().value;
    if (oldestKey !== undefined) {
      transactionQueryCache.delete(oldestKey);
    }
  }

  return result;
}
