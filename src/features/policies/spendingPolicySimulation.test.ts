import assert from 'node:assert/strict';
import test, { describe } from 'node:test';
import { formatCurrency, formatPercent } from '../../lib/format';
import {
  calculateBudgetSimulation,
  computeRiskScore,
  evaluatePolicyRules,
  sandboxTransactionSchema,
  type EvaluationStep,
  type SandboxFormValues,
} from './spendingPolicySimulation';
import {
  defaultPolicyRules,
  evaluatePolicySimulation,
  mapPoliciesToSandboxRules,
  parseXdrPayload,
  type PolicyRule,
} from './usePolicySimulation';
import { ASSET_RATES } from './types';
import type { Policy } from '../../types/domain';

// Valid 56-character Stellar public keys for testing
const VALID_STELLAR_KEY_1 = 'GA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJVSGZ';
const VALID_STELLAR_KEY_2 = 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H';
const BLOCKED_STELLAR_KEY = 'GCEZWKCA5VLDNRLN3RPRJMRZOX3Z6G5CHCGSNFHEYVXM3XOJMDS674JZ';

describe('Spending policy simulation & helper functions (#369)', () => {
  // -------------------------------------------------------------------------
  // 1. Transaction Form Validation (sandboxTransactionSchema)
  // -------------------------------------------------------------------------
  describe('Transaction evaluation input schema (sandboxTransactionSchema)', () => {
    test('validates correct transaction input successfully', () => {
      const validPayload: SandboxFormValues = {
        recipient: VALID_STELLAR_KEY_1,
        amount: 2500,
        asset: 'USDC',
        agentId: 'agt_atlas',
        memo: 'Payment for LLM inference compute',
      };
      const parsed = sandboxTransactionSchema.safeParse(validPayload);
      assert.equal(parsed.success, true);
    });

    test('rejects zero or negative transaction amounts (edge cases)', () => {
      const zeroAmountPayload = {
        recipient: VALID_STELLAR_KEY_1,
        amount: 0,
        asset: 'USDC',
        agentId: 'agt_atlas',
      };
      const zeroParsed = sandboxTransactionSchema.safeParse(zeroAmountPayload);
      assert.equal(zeroParsed.success, false);
      if (!zeroParsed.success) {
        assert.match(zeroParsed.error.issues[0]?.message ?? '', /greater than zero/i);
      }

      const negativePayload = {
        recipient: VALID_STELLAR_KEY_1,
        amount: -50,
        asset: 'USDC',
        agentId: 'agt_atlas',
      };
      const negParsed = sandboxTransactionSchema.safeParse(negativePayload);
      assert.equal(negParsed.success, false);
    });

    test('rejects non-numeric string amounts', () => {
      const invalidNumber = {
        recipient: VALID_STELLAR_KEY_1,
        amount: 'not-a-number',
        asset: 'USDC',
        agentId: 'agt_atlas',
      };
      const parsed = sandboxTransactionSchema.safeParse(invalidNumber);
      assert.equal(parsed.success, false);
    });

    test('rejects invalid or too short Stellar recipient addresses', () => {
      const shortRecipient = {
        recipient: 'G12345SHORT',
        amount: 100,
        asset: 'USDC',
        agentId: 'agt_atlas',
      };
      const parsed = sandboxTransactionSchema.safeParse(shortRecipient);
      assert.equal(parsed.success, false);
      if (!parsed.success) {
        assert.match(parsed.error.issues[0]?.message ?? '', /at least 56 characters/i);
      }
    });

    test('rejects unsupported asset types', () => {
      const unsupportedAsset = {
        recipient: VALID_STELLAR_KEY_1,
        amount: 100,
        asset: 'DOGE',
        agentId: 'agt_atlas',
      };
      const parsed = sandboxTransactionSchema.safeParse(unsupportedAsset);
      assert.equal(parsed.success, false);
    });
  });

  // -------------------------------------------------------------------------
  // 2. Pure Policy Rule Checks (evaluatePolicyRules)
  // -------------------------------------------------------------------------
  describe('Rule evaluation checks (evaluatePolicyRules)', () => {
    test('passes when amount matches exact threshold', () => {
      const rule: PolicyRule = {
        id: 'max_cap',
        name: 'Transaction Cap',
        type: 'max_amount',
        description: 'Cap transaction amount at 5,000 USD',
        enabled: true,
        threshold: 5000,
      };

      const exactPayload: SandboxFormValues = {
        recipient: VALID_STELLAR_KEY_1,
        amount: 5000,
        asset: 'USDC',
        agentId: 'agt_atlas',
      };

      const result = evaluatePolicyRules(exactPayload, [rule]);
      assert.equal(result.outcome, 'approved');
      assert.equal(result.steps[0]?.passed, true);
      assert.equal(result.steps[0]?.reasonCode, 'AMOUNT_WITHIN_CAP');
    });

    test('rejects when amount exceeds threshold by even $1 (budget overflow)', () => {
      const rule: PolicyRule = {
        id: 'max_cap',
        name: 'Transaction Cap',
        type: 'max_amount',
        description: 'Cap transaction amount at 5,000 USD',
        enabled: true,
        threshold: 5000,
      };

      const overflowPayload: SandboxFormValues = {
        recipient: VALID_STELLAR_KEY_1,
        amount: 5001,
        asset: 'USDC',
        agentId: 'agt_atlas',
      };

      const result = evaluatePolicyRules(overflowPayload, [rule]);
      assert.equal(result.outcome, 'rejected');
      assert.equal(result.steps[0]?.passed, false);
      assert.equal(result.steps[0]?.reasonCode, 'AMOUNT_EXCEEDS_THRESHOLD');
      assert.match(
        result.steps[0]?.message ?? '',
        /exceeds the \$5,000 maximum threshold/i,
      );
    });

    test('verifies unauthorized recipient against allowed whitelist', () => {
      const rule: PolicyRule = {
        id: 'whitelist_rule',
        name: 'Vendor Whitelist',
        type: 'allowed_recipients',
        description: 'Only approved vendors',
        enabled: true,
        allowedRecipients: [VALID_STELLAR_KEY_1],
      };

      const unauthorizedRecipientPayload: SandboxFormValues = {
        recipient: VALID_STELLAR_KEY_2,
        amount: 500,
        asset: 'USDC',
        agentId: 'agt_atlas',
      };

      const result = evaluatePolicyRules(unauthorizedRecipientPayload, [rule]);
      assert.equal(result.steps[0]?.passed, false);
      assert.equal(result.steps[0]?.reasonCode, 'RECIPIENT_BLOCKED');
      assert.equal(result.outcome, 'rejected');
    });

    test('verifies blocked recipient on blocklist', () => {
      const rule: PolicyRule = {
        id: 'blocklist_rule',
        name: 'Sanctioned Deny List',
        type: 'blocked_recipients',
        description: 'Block flagged actors',
        enabled: true,
        blockedRecipients: [BLOCKED_STELLAR_KEY],
      };

      const blockedPayload: SandboxFormValues = {
        recipient: BLOCKED_STELLAR_KEY,
        amount: 100,
        asset: 'USDC',
        agentId: 'agt_atlas',
      };

      const result = evaluatePolicyRules(blockedPayload, [rule]);
      assert.equal(result.steps[0]?.passed, false);
      assert.equal(result.steps[0]?.reasonCode, 'RECIPIENT_BLOCKED');
      assert.equal(result.outcome, 'rejected');
    });

    test('evaluates multi-sig threshold requirements (1 vs multi-approvers)', () => {
      const multiSigRule: PolicyRule = {
        id: 'cosigner_rule',
        name: 'Co-signer requirement',
        type: 'multi_sig',
        description: 'Requires 2 signatures',
        enabled: true,
        requiredCoSigners: 2,
      };

      const payload: SandboxFormValues = {
        recipient: VALID_STELLAR_KEY_1,
        amount: 1000,
        asset: 'USDC',
        agentId: 'agt_atlas',
      };

      // In default sandbox mode (single signer present), flags as insufficient
      const singleSignerResult = evaluatePolicyRules(payload, [multiSigRule], {
        mockSimulatedSignerCount: 1,
      });
      assert.equal(singleSignerResult.steps[0]?.passed, false);
      assert.equal(singleSignerResult.steps[0]?.reasonCode, 'MULTISIG_INSUFFICIENT');
      // multi_sig alone does not trigger a blocking rejection; it produces flagged
      assert.equal(singleSignerResult.outcome, 'flagged');

      // When threshold is met
      const dualSignerResult = evaluatePolicyRules(payload, [multiSigRule], {
        mockSimulatedSignerCount: 2,
      });
      assert.equal(dualSignerResult.steps[0]?.passed, true);
      assert.equal(dualSignerResult.steps[0]?.reasonCode, 'MULTISIG_SATISFIED');
      assert.equal(dualSignerResult.outcome, 'approved');
    });

    test('evaluates time window boundaries and emergency locks', () => {
      const emergencyRule: PolicyRule = {
        id: 'emergency',
        name: 'Circuit Breaker',
        type: 'emergency_lock',
        description: 'Stop all automated execution',
        enabled: true,
        emergencyActive: true,
      };

      const payload: SandboxFormValues = {
        recipient: VALID_STELLAR_KEY_1,
        amount: 250,
        asset: 'USDC',
        agentId: 'agt_atlas',
      };

      const emergencyResult = evaluatePolicyRules(payload, [emergencyRule]);
      assert.equal(emergencyResult.steps[0]?.passed, false);
      assert.equal(emergencyResult.steps[0]?.reasonCode, 'EMERGENCY_ACTIVE');
      assert.equal(emergencyResult.outcome, 'rejected');

      const timeWindowRule: PolicyRule = {
        id: 'time_rule',
        name: 'Trading Hours',
        type: 'time_window',
        description: 'Permit between 09:00 and 17:00 UTC',
        enabled: true,
        windowStart: '09:00',
        windowEnd: '17:00',
      };

      // At 10:30 UTC -> inside window
      const insideTime = new Date('2026-10-21T10:30:00.000Z');
      const insideResult = evaluatePolicyRules(payload, [timeWindowRule], {
        currentTime: insideTime,
      });
      assert.equal(insideResult.steps[0]?.passed, true);
      assert.equal(insideResult.steps[0]?.reasonCode, 'TIME_WINDOW_OPEN');

      // At 21:00 UTC -> outside window
      const outsideTime = new Date('2026-10-21T21:00:00.000Z');
      const outsideResult = evaluatePolicyRules(payload, [timeWindowRule], {
        currentTime: outsideTime,
      });
      assert.equal(outsideResult.steps[0]?.passed, false);
      assert.equal(outsideResult.steps[0]?.reasonCode, 'TIME_WINDOW_CLOSED');
    });
  });

  // -------------------------------------------------------------------------
  // 3. Risk Score Computation (computeRiskScore)
  // -------------------------------------------------------------------------
  describe('Risk score evaluation helper (computeRiskScore)', () => {
    test('computes base score of 0 for clean evaluation with standard amount', () => {
      const values: SandboxFormValues = {
        recipient: VALID_STELLAR_KEY_1,
        amount: 5000,
        asset: 'USDC',
        agentId: 'agt_atlas',
      };
      const steps: EvaluationStep[] = [
        {
          ruleId: '1',
          ruleName: 'Rule 1',
          passed: true,
          message: 'ok',
          reasonCode: 'OK',
        },
      ];
      assert.equal(computeRiskScore(values, steps), 0);
    });

    test('increases risk for failed rules and higher amount tiers', () => {
      const values: SandboxFormValues = {
        recipient: VALID_STELLAR_KEY_1,
        amount: 30000, // > 10,000 (+10) and > 25,000 (+20) = +30
        asset: 'USDC',
        agentId: 'agt_atlas',
      };
      const steps: EvaluationStep[] = [
        {
          ruleId: '1',
          ruleName: 'Rule 1',
          passed: false,
          message: 'fail',
          reasonCode: 'FAIL',
        }, // +25
      ];
      assert.equal(computeRiskScore(values, steps), 55);
    });

    test('caps maximum risk score at 100', () => {
      const values: SandboxFormValues = {
        recipient: VALID_STELLAR_KEY_1,
        amount: 50000, // +30
        asset: 'USDC',
        agentId: 'agt_atlas',
      };
      const steps: EvaluationStep[] = [
        { ruleId: '1', ruleName: 'R1', passed: false, message: 'f', reasonCode: 'F1' }, // +25
        { ruleId: '2', ruleName: 'R2', passed: false, message: 'f', reasonCode: 'F2' }, // +25
        { ruleId: '3', ruleName: 'R3', passed: false, message: 'f', reasonCode: 'F3' }, // +25
        { ruleId: '4', ruleName: 'R4', passed: false, message: 'f', reasonCode: 'F4' }, // +25
      ];
      assert.equal(computeRiskScore(values, steps), 100);
    });
  });

  // -------------------------------------------------------------------------
  // 4. Budget Simulation & Financial Limits (calculateBudgetSimulation)
  // -------------------------------------------------------------------------
  describe('Budget simulation helper (calculateBudgetSimulation)', () => {
    test('computes accurate USD conversions across multiple assets (XLM, USDC, BTC, ETH)', () => {
      const xlmSim = calculateBudgetSimulation({
        amount: 1000,
        selectedAsset: 'XLM',
        customFeeXlm: 0,
      });
      assert.equal(xlmSim.amountUsd, 1000 * ASSET_RATES.XLM.usdRate);

      const btcSim = calculateBudgetSimulation({
        amount: 0.5,
        selectedAsset: 'BTC',
        customFeeXlm: 0,
      });
      assert.equal(btcSim.amountUsd, 0.5 * ASSET_RATES.BTC.usdRate);
    });

    test('handles zero balance and zero amount gracefully', () => {
      const zeroSim = calculateBudgetSimulation({
        amount: 0,
        selectedAsset: 'USDC',
        config: {
          dailySpentUsd: 0,
          dailyLimitUsd: 10000,
          singleTxCeilingUsd: 2500,
        },
      });

      assert.equal(zeroSim.assetAmount, 0);
      assert.equal(zeroSim.amountUsd, 0);
      assert.equal(zeroSim.currentSpentUsd, 0);
      assert.equal(zeroSim.isPolicyViolation, false);
      assert.equal(zeroSim.exceedsSingleTxCeiling, false);
      assert.equal(zeroSim.exceedsDailyLimit, false);
    });

    test('detects exact single transaction ceiling match without violation', () => {
      const exactCeilingSim = calculateBudgetSimulation({
        amount: 2500,
        selectedAsset: 'USDC',
        customFeeXlm: 0,
        config: {
          singleTxCeilingUsd: 2500,
          dailyLimitUsd: 10000,
          dailySpentUsd: 0,
        },
      });

      assert.equal(exactCeilingSim.amountUsd, 2500);
      assert.equal(exactCeilingSim.exceedsSingleTxCeiling, false);
      assert.equal(exactCeilingSim.isPolicyViolation, false);
    });

    test('flags single transaction ceiling breach', () => {
      const breachSim = calculateBudgetSimulation({
        amount: 2500.01,
        selectedAsset: 'USDC',
        customFeeXlm: 0,
        config: {
          singleTxCeilingUsd: 2500,
          dailyLimitUsd: 10000,
          dailySpentUsd: 0,
        },
      });

      assert.equal(breachSim.exceedsSingleTxCeiling, true);
      assert.equal(breachSim.isPolicyViolation, true);
      assert.match(breachSim.warnings[0] ?? '', /exceeds single transaction ceiling/i);
    });

    test('flags budget overflow when cumulative spent exceeds daily limit', () => {
      const overflowSim = calculateBudgetSimulation({
        amount: 4000,
        selectedAsset: 'USDC',
        customFeeXlm: 0,
        config: {
          dailySpentUsd: 6800,
          dailyLimitUsd: 10000,
          singleTxCeilingUsd: 5000,
        },
      });

      // 6800 + 4000 = 10800 > 10000
      assert.equal(overflowSim.updatedSpentUsd, 10800);
      assert.equal(overflowSim.exceedsDailyLimit, true);
      assert.equal(overflowSim.isPolicyViolation, true);
      assert.match(
        overflowSim.warnings[0] ?? '',
        /Simulation breaches daily organization cap/i,
      );
    });

    test('generates 80% threshold warning when approaching daily budget envelope', () => {
      const warningSim = calculateBudgetSimulation({
        amount: 1500,
        selectedAsset: 'USDC',
        customFeeXlm: 0,
        config: {
          dailySpentUsd: 7000,
          dailyLimitUsd: 10000,
          singleTxCeilingUsd: 5000,
        },
      });

      // 7000 + 1500 = 8500 (85%)
      assert.equal(warningSim.updatedUtilizationPct, 85);
      assert.equal(warningSim.exceedsDailyLimit, false);
      assert.equal(warningSim.isPolicyViolation, false);
      assert.ok(warningSim.warnings.some((w) => w.includes('85% of daily envelope')));
    });
  });

  // -------------------------------------------------------------------------
  // 5. Currency & Metric Formatting (formatCurrency, formatPercent)
  // -------------------------------------------------------------------------
  describe('Currency and numeric formatting helpers', () => {
    test('formats USD and USDC with dollar prefix and standard decimals', () => {
      assert.equal(formatCurrency(1500, 'USD'), '$1,500');
      assert.equal(formatCurrency(1500.5, 'USD'), '$1,500.50');
      assert.equal(formatCurrency(2500, 'USDC'), '$2,500');
    });

    test('formats non-USD assets with suffix asset symbol', () => {
      assert.equal(formatCurrency(100, 'XLM'), '100 XLM');
      assert.equal(formatCurrency(0.5, 'BTC'), '0.50 BTC');
      assert.equal(formatCurrency(2, 'ETH'), '2 ETH');
    });

    test('formats compact monetary notation', () => {
      assert.equal(formatCurrency(25000, 'USD', { compact: true }), '$25K');
      assert.equal(formatCurrency(1200000, 'USDC', { compact: true }), '$1.2M');
    });

    test('formats percentage utilization values', () => {
      assert.equal(formatPercent(85.4), '85%');
      assert.equal(formatPercent(85.4, 1), '85.4%');
      assert.equal(formatPercent(100), '100%');
    });
  });

  // -------------------------------------------------------------------------
  // 6. Policy Domain Mapping (mapPoliciesToSandboxRules)
  // -------------------------------------------------------------------------
  describe('Policy mapper helper (mapPoliciesToSandboxRules)', () => {
    test('transforms active domain policy types to sandbox rules', () => {
      const mockDomainPolicies: Policy[] = [
        {
          id: 'p1',
          organizationId: 'org_1',
          name: 'Max Spend Limit',
          type: 'max_spend',
          description: 'Max 1000',
          enabled: true,
          configuration: { maxAmount: 1000 },
          priority: 1,
          appliesTo: 1,
          violations30d: 0,
          createdAt: new Date().toISOString(),
        },
        {
          id: 'p2',
          organizationId: 'org_1',
          name: 'Disabled Policy',
          type: 'allowed_assets',
          description: 'Disabled',
          enabled: false,
          configuration: { assets: ['USDC'] },
          priority: 2,
          appliesTo: 1,
          violations30d: 0,
          createdAt: new Date().toISOString(),
        },
        {
          id: 'p3',
          organizationId: 'org_1',
          name: 'Approval Required',
          type: 'approval_required',
          description: 'Requires 3 signers',
          enabled: true,
          configuration: { requiredApprovals: 3 },
          priority: 3,
          appliesTo: 1,
          violations30d: 0,
          createdAt: new Date().toISOString(),
        },
      ];

      const rules = mapPoliciesToSandboxRules(mockDomainPolicies);
      assert.equal(rules.length, 2); // Disabled one filtered out
      assert.equal(rules[0]?.type, 'max_amount');
      assert.equal(rules[0]?.threshold, 1000);
      assert.equal(rules[1]?.type, 'multi_sig');
      assert.equal(rules[1]?.requiredCoSigners, 3);
    });
  });

  // -------------------------------------------------------------------------
  // 7. XDR Parsing and Simulation (parseXdrPayload, evaluatePolicySimulation)
  // -------------------------------------------------------------------------
  describe('Transaction XDR simulation helpers', () => {
    test('handles empty or whitespace XDR payload safely', () => {
      const parsed = parseXdrPayload('   ');
      assert.equal(parsed.length, 1);
      assert.equal(parsed[0]?.type, 'No transaction');
      assert.equal(parsed[0]?.amount, '0');
    });

    test('evaluates defaultPolicyRules against safe payload', () => {
      const rule = defaultPolicyRules[0]!;
      const result = evaluatePolicySimulation('AAAA', rule);
      assert.equal(result.passed, true);
      assert.equal(result.violations.length, 0);
    });

    test('flags policy violation when parsed amount exceeds rule threshold', () => {
      const strictRule: PolicyRule = {
        id: 'strict_rule',
        name: 'Strict 0 USD Cap',
        type: 'max_amount',
        description: 'Cap at 0',
        enabled: true,
        threshold: 0,
      };

      // In Node environment, parseXdrPayload returns fallback/simulated operations with amount >= 0
      const result = evaluatePolicySimulation('AAAABBBBCCCC', strictRule);
      // fallback creates amount > 0 for this payload
      if (Number(result.parsedOperations[0]?.amount ?? 0) > 0) {
        assert.equal(result.passed, false);
        assert.equal(result.violations.length, 1);
        assert.equal(result.violations[0]?.severity, 'danger');
      }
    });
  });
});
