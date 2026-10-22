import { z } from 'zod';
import { formatCurrency } from '@/lib/format';
import { type PolicyRule } from './usePolicySimulation';
import {
  ASSET_RATES,
  DEFAULT_CONFIG,
  type AssetSymbol,
  type BudgetLimitConfig,
  type SimulationResult as BudgetSimulationResult,
} from './types';

// ---------------------------------------------------------------------------
// Zod schema for sandbox transaction input
// ---------------------------------------------------------------------------

export const sandboxTransactionSchema = z.object({
  recipient: z
    .string()
    .trim()
    .min(1, 'Recipient address is required.')
    .min(56, 'Stellar address must be at least 56 characters.')
    .max(64, 'Stellar address must be at most 64 characters.'),
  amount: z.coerce
    .number({ message: 'Amount must be a number.' })
    .positive('Amount must be greater than zero.'),
  asset: z.enum(['XLM', 'USDC', 'BTC', 'ETH', 'EURC'], {
    message: 'Asset must be one of XLM, USDC, BTC, ETH, or EURC.',
  }),
  agentId: z.string().trim().min(1, 'Agent ID is required.'),
  memo: z.string().max(140, 'Memo must be 140 characters or fewer.').optional(),
});

export type SandboxFormValues = z.infer<typeof sandboxTransactionSchema>;

// ---------------------------------------------------------------------------
// Evaluation types
// ---------------------------------------------------------------------------

export interface EvaluationStep {
  ruleId: string;
  ruleName: string;
  passed: boolean;
  message: string;
  reasonCode: string;
}

export interface SandboxEvaluationResult {
  outcome: 'approved' | 'flagged' | 'rejected';
  steps: EvaluationStep[];
  riskScore: number;
}

// ---------------------------------------------------------------------------
// Default form values
// ---------------------------------------------------------------------------

export const defaultFormValues: SandboxFormValues = {
  recipient: 'GAOPENAI7VENDORQK9M2WL4PC8RD3YHF6JN1STELLARWALLETXZ',
  amount: 5000,
  asset: 'USDC',
  agentId: 'agt_atlas',
  memo: 'Policy sandbox test — hypothetical transfer',
};

// ---------------------------------------------------------------------------
// Risk scoring helper
// ---------------------------------------------------------------------------

export function computeRiskScore(
  values: SandboxFormValues,
  steps: EvaluationStep[],
): number {
  let score = 0;
  const failed = steps.filter((s) => !s.passed);
  score += failed.length * 25;
  if (values.amount > 25000) score += 20;
  if (values.amount > 10000) score += 10;
  return Math.min(100, score);
}

// ---------------------------------------------------------------------------
// Pure evaluation helpers
// ---------------------------------------------------------------------------

export interface EvaluatePolicyRulesOptions {
  currentTime?: Date;
  mockSimulatedSignerCount?: number;
}

/**
 * Pure evaluation of a transaction candidate against a list of policy rules.
 */
export function evaluatePolicyRules(
  validated: SandboxFormValues,
  activeRules: PolicyRule[],
  options: EvaluatePolicyRulesOptions = {},
): {
  steps: EvaluationStep[];
  outcome: 'approved' | 'flagged' | 'rejected';
  riskScore: number;
} {
  const steps: EvaluationStep[] = [];
  const now = options.currentTime ?? new Date();
  const currentMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  const simulatedSigners = options.mockSimulatedSignerCount ?? 1;

  for (const rule of activeRules) {
    if (!rule.enabled) continue;

    let passed = true;
    let message = '';
    let reasonCode = '';

    switch (rule.type) {
      case 'max_amount': {
        if (rule.threshold !== undefined) {
          passed = validated.amount <= rule.threshold;
          message = passed
            ? `Amount $${validated.amount.toLocaleString()} is within the $${rule.threshold.toLocaleString()} cap.`
            : `Amount $${validated.amount.toLocaleString()} exceeds the $${rule.threshold.toLocaleString()} maximum threshold.`;
          reasonCode = passed ? 'AMOUNT_WITHIN_CAP' : 'AMOUNT_EXCEEDS_THRESHOLD';
        }
        break;
      }

      case 'allowed_assets': {
        const allowed = rule.allowedAssets ?? [];
        passed = allowed.includes(validated.asset);
        message = passed
          ? `Asset ${validated.asset} is on the allow-list.`
          : `Asset ${validated.asset} is not on the allowed assets list (${allowed.join(', ')}).`;
        reasonCode = passed ? 'ASSET_ALLOWED' : 'ASSET_BLOCKED';
        break;
      }

      case 'multi_sig': {
        const required = rule.requiredCoSigners ?? 2;
        passed = required <= simulatedSigners;
        message = passed
          ? 'Sufficient signatures present.'
          : `This transaction requires ${required} co-signers but only ${simulatedSigners} is present in sandbox mode.`;
        reasonCode = passed ? 'MULTISIG_SATISFIED' : 'MULTISIG_INSUFFICIENT';
        break;
      }

      case 'allowed_recipients': {
        const allowed = rule.allowedRecipients ?? [];
        passed =
          allowed.length === 0 || allowed.some((r) => validated.recipient.includes(r));
        message = passed
          ? `Recipient is on the approved vendor list.`
          : `Recipient is not on the approved vendor list (${allowed.join(', ')}).`;
        reasonCode = passed ? 'RECIPIENT_ALLOWED' : 'RECIPIENT_BLOCKED';
        break;
      }

      case 'blocked_recipients': {
        const blocked = rule.blockedRecipients ?? [];
        passed = !blocked.some((r) => validated.recipient.includes(r));
        message = passed
          ? `Recipient is not on the blocklist.`
          : `Recipient matches a blocked address on the deny list.`;
        reasonCode = passed ? 'RECIPIENT_CLEAR' : 'RECIPIENT_BLOCKED';
        break;
      }

      case 'rate_limit': {
        passed = true;
        message = rule.rateLimitPerHour
          ? `Rate limit of ${rule.rateLimitPerHour} txns/hr applies — verified at execution time.`
          : 'Rate limit rule present — evaluated at execution time.';
        reasonCode = 'RATE_LIMIT_NOTE';
        break;
      }

      case 'time_window': {
        if (rule.windowStart && rule.windowEnd) {
          const [startH, startM] = rule.windowStart.split(':').map(Number);
          const [endH, endM] = rule.windowEnd.split(':').map(Number);
          const startMinutes = (startH ?? 0) * 60 + (startM ?? 0);
          const endMinutes = (endH ?? 0) * 60 + (endM ?? 0);
          passed = currentMinutes >= startMinutes && currentMinutes <= endMinutes;
        }
        message = passed
          ? `Current time is within the allowed execution window (${rule.windowStart ?? '?'}–${rule.windowEnd ?? '?'}).`
          : `Current time is outside the allowed execution window (${rule.windowStart ?? '?'}–${rule.windowEnd ?? '?'}).`;
        reasonCode = passed ? 'TIME_WINDOW_OPEN' : 'TIME_WINDOW_CLOSED';
        break;
      }

      case 'budget_limit': {
        if (rule.budgetLimitUsd !== undefined) {
          passed = validated.amount <= rule.budgetLimitUsd;
          message = passed
            ? `Amount $${validated.amount.toLocaleString()} is within the budget cap of $${rule.budgetLimitUsd.toLocaleString()}.`
            : `Amount $${validated.amount.toLocaleString()} exceeds the budget cap of $${rule.budgetLimitUsd.toLocaleString()}.`;
          reasonCode = passed ? 'BUDGET_WITHIN_CAP' : 'BUDGET_EXCEEDED';
        }
        break;
      }

      case 'emergency_lock': {
        passed = !rule.emergencyActive;
        message = rule.emergencyActive
          ? 'Emergency stop is active — all transactions are halted.'
          : 'Emergency stop is inactive — transactions may proceed.';
        reasonCode = passed ? 'EMERGENCY_INACTIVE' : 'EMERGENCY_ACTIVE';
        break;
      }
    }

    steps.push({
      ruleId: rule.id,
      ruleName: rule.name,
      passed,
      message,
      reasonCode,
    });
  }

  const failedSteps = steps.filter((s) => !s.passed);
  let outcome: SandboxEvaluationResult['outcome'] = 'approved';
  if (failedSteps.length > 0) {
    const hasBlocking = failedSteps.some(
      (s) =>
        s.reasonCode === 'AMOUNT_EXCEEDS_THRESHOLD' ||
        s.reasonCode === 'ASSET_BLOCKED' ||
        s.reasonCode === 'RECIPIENT_BLOCKED' ||
        s.reasonCode === 'EMERGENCY_ACTIVE' ||
        s.reasonCode === 'BUDGET_EXCEEDED',
    );
    outcome = hasBlocking ? 'rejected' : 'flagged';
  }

  const riskScore = computeRiskScore(validated, steps);

  return { steps, outcome, riskScore };
}

/**
 * Pure calculation of budget impact and policy limit simulation.
 */
export function calculateBudgetSimulation(params: {
  amount: number | string;
  selectedAsset: AssetSymbol;
  customFeeXlm?: number | string;
  config?: Partial<BudgetLimitConfig>;
}): BudgetSimulationResult {
  const mergedConfig: BudgetLimitConfig = { ...DEFAULT_CONFIG, ...params.config };
  const rawAmount =
    typeof params.amount === 'string' ? parseFloat(params.amount) : params.amount;
  const validAmount = isNaN(rawAmount) || rawAmount < 0 ? 0 : rawAmount;
  const rate = ASSET_RATES[params.selectedAsset] || ASSET_RATES.USDC;

  const amountUsd = validAmount * rate.usdRate;
  const rawFee =
    typeof params.customFeeXlm === 'string'
      ? parseFloat(params.customFeeXlm)
      : params.customFeeXlm;
  const feeXlm =
    rawFee !== undefined && !isNaN(rawFee) && rawFee >= 0
      ? rawFee
      : mergedConfig.networkBaseFeeXlm;
  const networkFeeUsd = feeXlm * ASSET_RATES.XLM.usdRate;
  const totalCostUsd = amountUsd + networkFeeUsd;

  const currentSpentUsd = mergedConfig.dailySpentUsd;
  const updatedSpentUsd = currentSpentUsd + totalCostUsd;
  const dailyLimitUsd = mergedConfig.dailyLimitUsd > 0 ? mergedConfig.dailyLimitUsd : 1;

  const currentUtilizationPct = Math.min(100, (currentSpentUsd / dailyLimitUsd) * 100);
  const updatedUtilizationPct = Math.min(100, (updatedSpentUsd / dailyLimitUsd) * 100);

  const exceedsSingleTxCeiling =
    mergedConfig.singleTxCeilingUsd > 0 && amountUsd > mergedConfig.singleTxCeilingUsd;
  const exceedsDailyLimit = updatedSpentUsd > dailyLimitUsd;

  const warnings: string[] = [];
  if (exceedsSingleTxCeiling) {
    warnings.push(
      `Transaction value (${formatCurrency(amountUsd, 'USD')}) exceeds single transaction ceiling of ${formatCurrency(mergedConfig.singleTxCeilingUsd, 'USD')}.`,
    );
  }
  if (exceedsDailyLimit) {
    const over = updatedSpentUsd - dailyLimitUsd;
    warnings.push(
      `Simulation breaches daily organization cap by ${formatCurrency(over, 'USD')}.`,
    );
  }
  if (updatedUtilizationPct >= 80 && !exceedsDailyLimit) {
    warnings.push(
      `Simulated budget utilization will reach ${Math.round(updatedUtilizationPct)}% of daily envelope.`,
    );
  }

  return {
    assetAmount: validAmount,
    assetSymbol: params.selectedAsset,
    amountUsd,
    networkFeeXlm: feeXlm,
    networkFeeUsd,
    totalCostUsd,
    currentSpentUsd,
    updatedSpentUsd,
    dailyLimitUsd,
    currentUtilizationPct,
    updatedUtilizationPct,
    exceedsSingleTxCeiling,
    exceedsDailyLimit,
    isPolicyViolation: exceedsSingleTxCeiling || exceedsDailyLimit,
    warnings,
  };
}
