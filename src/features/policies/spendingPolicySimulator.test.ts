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

const VALID_STELLAR_KEY_1 = 'GA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJVSGZ';
const VALID_STELLAR_KEY_2 = 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H';
const BLOCKED_STELLAR_KEY = 'GCEZWKCA5VLDNRLN3RPRJMRZOX3Z6G5CHCGSNFHEYVXM3XOJMDS674JZ';

describe('Spending policy rule simulator with real-time validation feedback (#551)', () => {
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

    test('rejects zero or negative transaction amounts', () => {
      const zeroAmountPayload = {
        recipient: VALID_STELLAR_KEY_1,
        amount: 0,
        asset: 'USDC',
        agentId: 'agt_atlas',
      };
      const zeroParsed = sandboxTransactionSchema.safeParse(zeroAmountPayload);
      assert.equal(zeroParsed.success, false);
    });
  });

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
    });
  });
});
