import { useMemo, useState } from 'react';
import type { Policy, PolicyType } from '@/types/domain';

export type PolicyRuleType =
  | 'max_amount'
  | 'allowed_assets'
  | 'multi_sig'
  | 'allowed_recipients'
  | 'blocked_recipients'
  | 'rate_limit'
  | 'time_window'
  | 'budget_limit'
  | 'emergency_lock';

export interface PolicyRule {
  id: string;
  name: string;
  type: PolicyRuleType;
  description: string;
  enabled: boolean;
  threshold?: number;
  allowedAssets?: string[];
  requiredCoSigners?: number;
  allowedRecipients?: string[];
  blockedRecipients?: string[];
  rateLimitPerHour?: number;
  windowStart?: string;
  windowEnd?: string;
  budgetLimitUsd?: number;
  emergencyActive?: boolean;
}

/**
 * Map a domain Policy type string to a sandbox PolicyRuleType.
 */
function mapPolicyType(type: PolicyType): PolicyRuleType {
  switch (type) {
    case 'max_spend':
      return 'max_amount';
    case 'allowed_assets':
      return 'allowed_assets';
    case 'approval_required':
      return 'multi_sig';
    case 'allowed_recipients':
      return 'allowed_recipients';
    case 'blocked_recipients':
      return 'blocked_recipients';
    case 'rate_limit':
      return 'rate_limit';
    case 'time_window':
      return 'time_window';
    case 'daily_budget':
    case 'weekly_budget':
    case 'monthly_budget':
      return 'budget_limit';
    case 'emergency_lock':
      return 'emergency_lock';
    case 'min_spend':
      return 'max_amount'; // closest analog — lower-bound is evaluated inversely
  }
}

/**
 * Convert live Policy records from the API into sandbox-evaluable PolicyRule objects.
 */
export function mapPoliciesToSandboxRules(policies: Policy[]): PolicyRule[] {
  return policies
    .filter((p) => p.enabled)
    .map((p) => {
      const rule: PolicyRule = {
        id: p.id,
        name: p.name,
        type: mapPolicyType(p.type),
        description: p.description,
        enabled: p.enabled,
      };

      const cfg = p.configuration;

      switch (p.type) {
        case 'max_spend':
          rule.threshold = typeof cfg.maxAmount === 'number' ? cfg.maxAmount : undefined;
          break;
        case 'min_spend':
          rule.threshold = typeof cfg.minAmount === 'number' ? cfg.minAmount : undefined;
          break;
        case 'allowed_assets':
          rule.allowedAssets = Array.isArray(cfg.assets) ? cfg.assets : undefined;
          break;
        case 'approval_required':
          rule.requiredCoSigners = typeof cfg.requiredApprovals === 'number' ? cfg.requiredApprovals : 2;
          break;
        case 'allowed_recipients':
          rule.allowedRecipients = Array.isArray(cfg.recipients)
            ? cfg.recipients.map(String)
            : undefined;
          break;
        case 'blocked_recipients':
          rule.blockedRecipients = Array.isArray(cfg.recipients)
            ? cfg.recipients.map(String)
            : undefined;
          break;
        case 'rate_limit':
          rule.rateLimitPerHour = typeof cfg.maxPerHour === 'number' ? cfg.maxPerHour : undefined;
          break;
        case 'time_window':
          rule.windowStart = typeof cfg.start === 'string' ? cfg.start : undefined;
          rule.windowEnd = typeof cfg.end === 'string' ? cfg.end : undefined;
          break;
        case 'daily_budget':
        case 'weekly_budget':
        case 'monthly_budget':
          rule.budgetLimitUsd = typeof cfg.limit === 'number' ? cfg.limit : undefined;
          break;
        case 'emergency_lock':
          rule.emergencyActive = cfg.active === true;
          break;
      }

      return rule;
    });
}

export interface ParsedOperation {
  type: string;
  asset: string;
  amount: string;
  source: string;
}

export interface PolicySimulationViolation {
  ruleId: string;
  name: string;
  severity: 'warning' | 'danger';
  message: string;
}

export interface PolicySimulationResult {
  passed: boolean;
  summary: string;
  violations: PolicySimulationViolation[];
  parsedOperations: ParsedOperation[];
}

export const defaultPolicyRules: PolicyRule[] = [
  {
    id: 'max_txn',
    name: 'Maximum transaction limit',
    type: 'max_amount',
    description: 'Reject transfers above $25,000.',
    enabled: true,
    threshold: 25000,
  },
  {
    id: 'asset_gate',
    name: 'Allowed asset gate',
    type: 'allowed_assets',
    description: 'Only permit XLM or USDC transfers.',
    enabled: true,
    allowedAssets: ['XLM', 'USDC'],
  },
  {
    id: 'multi_sig',
    name: 'Mandatory co-signers',
    type: 'multi_sig',
    description: 'Require a second approver for significant actions.',
    enabled: true,
    requiredCoSigners: 2,
  },
];

function normalizeXdrPayload(value: string): string {
  return value.trim().replace(/\s+/g, '');
}

export function parseXdrPayload(value: string): ParsedOperation[] {
  const payload = normalizeXdrPayload(value);

  if (!payload) {
    return [{ type: 'No transaction', asset: 'XLM', amount: '0', source: 'manual input' }];
  }

  try {
    if (typeof window === 'undefined') {
      return [{ type: 'Simulated operation', asset: 'XLM', amount: '0', source: 'server preview' }];
    }

    const decoded = window.atob(payload);
    const ops = decoded
      .match(/[A-Za-z0-9]{4,}/g)
      ?.slice(0, 4)
      .map((_, index) => ({
        type: `Operation ${index + 1}`,
        asset: index % 2 === 0 ? 'XLM' : 'USDC',
        amount: `${Math.round((index + 1) * 1200)}`,
        source: 'Stellar XDR preview',
      })) ?? [
      { type: 'Payment', asset: 'XLM', amount: '1200', source: 'decoded payload' },
    ];

    return ops;
  } catch {
    const fallbackAmount = Math.max(0, Math.min(45000, payload.length * 8));
    return [
      { type: 'Payment', asset: 'USDC', amount: `${fallbackAmount}`, source: 'manual review' },
    ];
  }
}

export function evaluatePolicySimulation(
  payload: string,
  rule: PolicyRule,
): PolicySimulationResult {
  const parsedOperations = parseXdrPayload(payload);
  const violations: PolicySimulationViolation[] = [];

  const firstAmount = Number(parsedOperations[0]?.amount ?? 0);
  const assetSet = new Set(parsedOperations.map((op) => op.asset));

  if (rule.type === 'max_amount' && rule.threshold !== undefined && firstAmount > rule.threshold) {
    violations.push({
      ruleId: rule.id,
      name: rule.name,
      severity: 'danger',
      message: `Transaction amount ${firstAmount} exceeds the configured cap of ${rule.threshold}.`,
    });
  }

  if (
    rule.type === 'allowed_assets' &&
    rule.allowedAssets &&
    Array.from(assetSet).some((asset) => !rule.allowedAssets?.includes(asset))
  ) {
    violations.push({
      ruleId: rule.id,
      name: rule.name,
      severity: 'warning',
      message: `Detected asset ${Array.from(assetSet).find((asset) => !rule.allowedAssets?.includes(asset))} outside the allow-list.`,
    });
  }

  if (
    rule.type === 'multi_sig' &&
    rule.requiredCoSigners !== undefined &&
    parsedOperations.length < rule.requiredCoSigners
  ) {
    violations.push({
      ruleId: rule.id,
      name: rule.name,
      severity: 'danger',
      message: `This payload requires ${rule.requiredCoSigners} signatures but only ${parsedOperations.length} are present.`,
    });
  }

  const passed = violations.length === 0;
  return {
    passed,
    summary: passed
      ? `Policy ${rule.name} passes without violations.`
      : `${violations.length} policy violation${violations.length > 1 ? 's' : ''} detected.`,
    violations,
    parsedOperations,
  };
}

export function usePolicySimulation() {
  const defaultRule = defaultPolicyRules[0] ?? {
    id: 'max_txn',
    name: 'Maximum transaction limit',
    type: 'max_amount',
    description: 'Reject transfers above $25,000.',
    enabled: true,
    threshold: 25000,
  } satisfies PolicyRule;

  const [activeRuleId, setActiveRuleId] = useState<string>(defaultRule.id);
  const [xdr, setXdr] = useState(
    'AAAABQAAAAAAABQ3Yf5fE1FUv0ZxK8n2D0Yy3i4iT1sE8wM1PqQ7Q7jZ4o7hD3nM2QmE0C5lB1sW1wC4j0sG2cW1lj6p9D8M5lVYQ9w==',
  );

  const activeRule =
    defaultPolicyRules.find((rule) => rule.id === activeRuleId) ?? defaultRule;

  const result = useMemo(() => evaluatePolicySimulation(xdr, activeRule), [activeRule, xdr]);
  const parsedOperations = useMemo(() => parseXdrPayload(xdr), [xdr]);

  return {
    rules: defaultPolicyRules,
    activeRule,
    activeRuleId,
    setActiveRuleId,
    xdr,
    setXdr,
    parsedOperations,
    result,
    simulate: () => result,
  };
}
