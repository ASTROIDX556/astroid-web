/** Core domain models mirroring the Astroid API entities (PRD Doc 5 / Doc 6). */

export type Asset = 'XLM' | 'USDC' | string;

export type StellarNetwork = 'testnet' | 'public';

// ---------------------------------------------------------------------------
// Organization & User
// ---------------------------------------------------------------------------
export type OrgPlan = 'starter' | 'growth' | 'scale' | 'enterprise';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  logo?: string;
  description?: string;
  plan: OrgPlan;
  status: 'active' | 'suspended';
  createdAt: string;
}

export type UserRole =
  | 'owner'
  | 'admin'
  | 'finance'
  | 'developer'
  | 'auditor'
  | 'viewer';

export interface User {
  id: string;
  organizationId: string;
  name: string;
  email: string;
  avatar?: string;
  role: UserRole;
  status: 'active' | 'invited' | 'disabled';
  lastLogin?: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Agent
// ---------------------------------------------------------------------------
export type AgentStatus = 'active' | 'paused' | 'suspended' | 'archived';

export type AgentRole =
  | 'finance'
  | 'research'
  | 'operations'
  | 'procurement'
  | 'custom';

export type AgentMode = 'assisted' | 'autonomous';

export type AgentCapability =
  | 'wallet.read'
  | 'wallet.transfer'
  | 'proposal.create'
  | 'proposal.approve'
  | 'budget.create'
  | 'analytics.read'
  | 'policy.manage'
  | 'apikey.access';

export interface Agent {
  id: string;
  organizationId: string;
  walletId?: string;
  name: string;
  description: string;
  role: AgentRole;
  status: AgentStatus;
  mode: AgentMode;
  provider: 'OpenAI' | 'Anthropic' | 'Gemini' | 'Ollama' | 'OpenRouter' | 'Nvidia' | 'Custom';
  model: string;
  capabilities: AgentCapability[];
  monthlyBudget: number;
  budgetSpent: number;
  policyIds: string[];
  memoryId?: string;
  lastActiveAt: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Wallet
// ---------------------------------------------------------------------------
export type WalletType = 'agent' | 'treasury' | 'escrow' | 'shared' | 'personal';

export type WalletStatus = 'active' | 'frozen' | 'paused' | 'archived';

export interface AssetBalance {
  asset: Asset;
  balance: number;
  usdValue: number;
}

export interface Wallet {
  id: string;
  organizationId: string;
  agentId?: string;
  name: string;
  stellarAddress: string;
  walletType: WalletType;
  network: StellarNetwork;
  status: WalletStatus;
  balances: AssetBalance[];
  totalUsdValue: number;
  riskScore: number;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Policy
// ---------------------------------------------------------------------------
export type PolicyType =
  | 'max_spend'
  | 'min_spend'
  | 'daily_budget'
  | 'weekly_budget'
  | 'monthly_budget'
  | 'allowed_assets'
  | 'blocked_recipients'
  | 'allowed_recipients'
  | 'time_window'
  | 'approval_required'
  | 'rate_limit'
  | 'emergency_lock';

export interface Policy {
  id: string;
  organizationId: string;
  name: string;
  description: string;
  type: PolicyType;
  configuration: Record<string, string | number | boolean | string[]>;
  priority: number;
  enabled: boolean;
  appliesTo: number; // agent count
  violations30d: number;
  createdAt: string;
}

export interface PolicySimulationResult {
  passed: boolean;
  triggeredPolicies: { policyId: string; name: string; passed: boolean }[];
  requiredApprovals: number;
  estimatedRisk: number;
  budgetImpact: { budgetId: string; name: string; remainingAfter: number };
  predictedOutcome: 'auto_execute' | 'requires_approval' | 'blocked';
}

// ---------------------------------------------------------------------------
// Budget
// ---------------------------------------------------------------------------
export type BudgetPeriod = 'monthly' | 'weekly' | 'quarterly' | 'annual';

export interface Budget {
  id: string;
  organizationId: string;
  parentBudgetId?: string;
  name: string;
  scope: 'organization' | 'department' | 'project' | 'agent';
  limit: number;
  currency: Asset;
  spent: number;
  remaining: number;
  period: BudgetPeriod;
  resetsAt: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Transaction / Proposal / Approval
// ---------------------------------------------------------------------------
export type TransactionStatus =
  | 'draft'
  | 'pending'
  | 'approved'
  | 'submitting'
  | 'confirmed'
  | 'completed'
  | 'rejected'
  | 'expired'
  | 'cancelled'
  | 'failed';

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface Transaction {
  id: string;
  organizationId: string;
  walletId: string;
  agentId?: string;
  agentName?: string;
  proposalId?: string;
  policyId?: string;
  direction: 'outbound' | 'inbound';
  counterparty: string;
  counterpartyAddress: string;
  asset: Asset;
  amount: number;
  usdValue: number;
  memo?: string;
  purpose: string;
  status: TransactionStatus;
  riskScore: number;
  stellarHash?: string;
  createdAt: string;
}

export type ProposalStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'expired'
  | 'executed';

export type ApprovalKind = 'single' | 'dual' | 'multisig' | 'role' | 'committee';

export interface ApprovalDecision {
  id: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  decision: 'approved' | 'rejected' | 'delegated' | 'pending';
  comment?: string;
  createdAt?: string;
}

export interface Proposal {
  id: string;
  organizationId: string;
  transactionId: string;
  title: string;
  description: string;
  status: ProposalStatus;
  kind: ApprovalKind;
  agentName: string;
  amount: number;
  asset: Asset;
  counterparty: string;
  riskScore: number;
  requiredApprovals: number;
  approvals: ApprovalDecision[];
  expiresAt: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Financial Memory
// ---------------------------------------------------------------------------
export type MemoryStepKind =
  | 'conversation'
  | 'decision'
  | 'policy'
  | 'approval'
  | 'blockchain';

export interface MemoryStep {
  kind: MemoryStepKind;
  title: string;
  detail: string;
  actor: string;
  timestamp: string;
  meta?: Record<string, string>;
}

export interface MemoryRecord {
  id: string;
  agentId: string;
  agentName: string;
  transactionId: string;
  reason: string;
  task: string;
  project: string;
  conversationId: string;
  amount: number;
  asset: Asset;
  policyUsed: string;
  approvedBy: string[];
  riskScore: number;
  stellarHash?: string;
  summary: string;
  steps: MemoryStep[];
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------
export type NotificationType =
  | 'budget_exceeded'
  | 'proposal_created'
  | 'proposal_approved'
  | 'proposal_rejected'
  | 'wallet_funded'
  | 'payment_failed'
  | 'policy_violation'
  | 'risk_alert';

export interface AppNotification {
  id: string;
  userId: string;
  title: string;
  body: string;
  type: NotificationType;
  channel: 'dashboard' | 'email' | 'slack' | 'discord' | 'webhook';
  read: boolean;
  href?: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Developer
// ---------------------------------------------------------------------------
export interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  permissions: string[];
  lastUsed?: string;
  createdAt: string;
  expiresAt?: string;
}

export interface Webhook {
  id: string;
  url: string;
  events: string[];
  enabled: boolean;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Analytics
// ---------------------------------------------------------------------------
export interface TimeseriesPoint {
  date: string;
  inflow: number;
  outflow: number;
  net: number;
}

export interface SpendingByCategory {
  category: string;
  amount: number;
}

export interface AgentSpend {
  agentId: string;
  agentName: string;
  role: AgentRole;
  spent: number;
  transactions: number;
}

export interface RiskDistribution {
  level: RiskLevel;
  count: number;
}

export interface BudgetWaterfallStep {
  label: string;
  value: number;
  kind: 'total' | 'spend' | 'remaining';
}

export interface AnalyticsOverview {
  totalBalance: number;
  monthlySpend: number;
  monthlySpendDelta: number;
  activeAgents: number;
  pendingApprovals: number;
  budgetUtilization: number;
  cashflow: TimeseriesPoint[];
  spendingByCategory: SpendingByCategory[];
  agentSpend: AgentSpend[];
  riskDistribution: RiskDistribution[];
  budgetWaterfall: BudgetWaterfallStep[];
}

// ---------------------------------------------------------------------------
// AI Assistant
// ---------------------------------------------------------------------------
export type AiInsightSeverity = 'info' | 'success' | 'warning' | 'danger';

export interface AiInsight {
  id: string;
  title: string;
  detail: string;
  severity: AiInsightSeverity;
  action?: { label: string; href: string };
}

export interface AiBriefing {
  greeting: string;
  summary: string;
  generatedAt: string;
  insights: AiInsight[];
  suggestedActions: { label: string; prompt: string }[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Asset Rates & Conversion
// ---------------------------------------------------------------------------
export interface AssetRate {
  asset: Asset;
  /** Price in USD (e.g. 0.12 for XLM) */
  priceUsd: number;
  /** 24-hour percentage change */
  change24h: number;
  /** ISO 8601 timestamp of the last update */
  updatedAt: string;
  /** Source feed identifier */
  source: string;
}
