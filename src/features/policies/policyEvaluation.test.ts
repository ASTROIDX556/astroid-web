import assert from 'node:assert/strict';
import test, { describe } from 'node:test';
import {
  configFromPolicies,
  evaluateProposedTransaction,
  proposedTransactionSchema,
  type PolicySimulationConfig,
  type ProposedTransaction,
} from './policyEvaluation';
import type { Policy } from '@/types/domain';

// Valid 56-character Stellar public keys for testing
const VALID_RECIPIENT_1 = 'GA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJVSGZ';
const VALID_RECIPIENT_2 = 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H';
const UNKNOWN_RECIPIENT = 'GCDNVLVRXPFDNO5V3UKZJ35D2A6EWFRGSK57L5T5T4VMS724772LQJ5D';

describe('Spending policy evaluation & helper functions (#423)', () => {
  // -------------------------------------------------------------------------
  // 1. Proposed Transaction Input Validation
  // -------------------------------------------------------------------------
  describe('proposedTransactionSchema', () => {
    test('validates correct transaction input successfully', () => {
      const validTx: ProposedTransaction = {
        amount: 1500,
        recipient: VALID_RECIPIENT_1,
        department: 'Engineering',
        asset: 'USDC',
      };
      const result = proposedTransactionSchema.safeParse(validTx);
      assert.equal(result.success, true);
    });

    test('rejects non-positive amounts (zero and negative)', () => {
      const zeroTx = {
        amount: 0,
        recipient: VALID_RECIPIENT_1,
        department: 'Operations',
        asset: 'USDC',
      };
      assert.equal(proposedTransactionSchema.safeParse(zeroTx).success, false);

      const negativeTx = {
        amount: -100,
        recipient: VALID_RECIPIENT_1,
        department: 'Operations',
        asset: 'USDC',
      };
      assert.equal(proposedTransactionSchema.safeParse(negativeTx).success, false);
    });

    test('rejects non-finite amounts (NaN, Infinity)', () => {
      const nanTx = {
        amount: NaN,
        recipient: VALID_RECIPIENT_1,
        department: 'Operations',
        asset: 'USDC',
      };
      assert.equal(proposedTransactionSchema.safeParse(nanTx).success, false);

      const infTx = {
        amount: Infinity,
        recipient: VALID_RECIPIENT_1,
        department: 'Operations',
        asset: 'USDC',
      };
      assert.equal(proposedTransactionSchema.safeParse(infTx).success, false);
    });

    test('rejects malformed or invalid Stellar recipient addresses', () => {
      // Not starting with G
      const nonGTx = {
        amount: 100,
        recipient: 'SA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJVSGZ',
        department: 'Finance',
        asset: 'XLM',
      };
      assert.equal(proposedTransactionSchema.safeParse(nonGTx).success, false);

      // Wrong length (too short)
      const shortTx = {
        amount: 100,
        recipient: 'GA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJ',
        department: 'Finance',
        asset: 'XLM',
      };
      assert.equal(proposedTransactionSchema.safeParse(shortTx).success, false);
    });

    test('validates supported assets and rejects unsupported assets', () => {
      for (const asset of ['XLM', 'USDC', 'EURC'] as const) {
        const tx = {
          amount: 50,
          recipient: VALID_RECIPIENT_1,
          department: 'Marketing',
          asset,
        };
        assert.equal(proposedTransactionSchema.safeParse(tx).success, true);
      }

      const badAssetTx = {
        amount: 50,
        recipient: VALID_RECIPIENT_1,
        department: 'Marketing',
        asset: 'BTC',
      };
      assert.equal(proposedTransactionSchema.safeParse(badAssetTx).success, false);
    });
  });

  // -------------------------------------------------------------------------
  // 2. Policy Configuration Extraction (configFromPolicies)
  // -------------------------------------------------------------------------
  describe('configFromPolicies', () => {
    test('extracts active policies correctly', () => {
      const mockPolicies: Policy[] = [
        {
          id: 'p1',
          organizationId: 'org1',
          name: 'Max Spend 5000',
          type: 'max_spend',
          description: 'Single tx cap',
          enabled: true,
          configuration: { maxAmount: 5000 },
          priority: 1,
          appliesTo: 1,
          violations30d: 0,
          createdAt: new Date().toISOString(),
        },
        {
          id: 'p2',
          organizationId: 'org1',
          name: 'Daily Budget 20000',
          type: 'daily_budget',
          description: 'Daily cap',
          enabled: true,
          configuration: { limit: 20000, spent: 4500 },
          priority: 2,
          appliesTo: 1,
          violations30d: 0,
          createdAt: new Date().toISOString(),
        },
        {
          id: 'p3',
          organizationId: 'org1',
          name: 'Department Cap',
          type: 'monthly_budget',
          description: 'Department budget',
          enabled: true,
          configuration: { limit: 50000, spent: 12000 },
          priority: 3,
          appliesTo: 1,
          violations30d: 0,
          createdAt: new Date().toISOString(),
        },
        {
          id: 'p4',
          organizationId: 'org1',
          name: 'Allowed Vendors',
          type: 'allowed_recipients',
          description: 'Approved vendors whitelist',
          enabled: true,
          configuration: { recipients: [VALID_RECIPIENT_1, VALID_RECIPIENT_2] },
          priority: 4,
          appliesTo: 1,
          violations30d: 0,
          createdAt: new Date().toISOString(),
        },
      ];

      const config = configFromPolicies(mockPolicies);
      assert.equal(config.maxTransactionAmount, 5000);
      assert.equal(config.dailyLimit, 20000);
      assert.equal(config.dailySpent, 4500);
      assert.equal(config.departmentBudget, 50000);
      assert.equal(config.departmentSpent, 12000);
      assert.deepEqual(config.allowedRecipients, [VALID_RECIPIENT_1, VALID_RECIPIENT_2]);
    });

    test('ignores disabled policies and filters out invalid recipient types', () => {
      const mockPolicies: Policy[] = [
        {
          id: 'p-disabled',
          organizationId: 'org1',
          name: 'Disabled Cap',
          type: 'max_spend',
          description: 'Disabled',
          enabled: false,
          configuration: { maxAmount: 100 },
          priority: 1,
          appliesTo: 1,
          violations30d: 0,
          createdAt: new Date().toISOString(),
        },
        {
          id: 'p-recipients',
          organizationId: 'org1',
          name: 'Mixed Recipient List',
          type: 'allowed_recipients',
          description: 'Mixed',
          enabled: true,
          configuration: { recipients: [VALID_RECIPIENT_1, 12345, null, VALID_RECIPIENT_2] },
          priority: 2,
          appliesTo: 1,
          violations30d: 0,
          createdAt: new Date().toISOString(),
        },
      ];

      const config = configFromPolicies(mockPolicies);
      assert.equal(config.maxTransactionAmount, undefined);
      assert.deepEqual(config.allowedRecipients, [VALID_RECIPIENT_1, VALID_RECIPIENT_2]);
    });
  });

  // -------------------------------------------------------------------------
  // 3. Proposed Transaction Evaluation (evaluateProposedTransaction)
  // -------------------------------------------------------------------------
  describe('evaluateProposedTransaction', () => {
    const baseTx: ProposedTransaction = {
      amount: 1000,
      recipient: VALID_RECIPIENT_1,
      department: 'Infrastructure',
      asset: 'USDC',
    };

    test('fails closed when no policies are configured', () => {
      const emptyConfig: PolicySimulationConfig = {};
      const result = evaluateProposedTransaction(baseTx, emptyConfig);
      assert.equal(result.passed, false);
      assert.equal(result.rules.length, 1);
      assert.equal(result.rules[0]?.id, 'no-policies');
      assert.equal(result.simulated, true);
    });

    test('passes when transaction amount is at exact max ceiling', () => {
      const config: PolicySimulationConfig = {
        maxTransactionAmount: 1000,
      };
      const result = evaluateProposedTransaction(baseTx, config);
      assert.equal(result.passed, true);
      const rule = result.rules.find((r) => r.id === 'max-transaction');
      assert.equal(rule?.passed, true);
    });

    test('fails when transaction amount exceeds max ceiling by even 1 unit', () => {
      const config: PolicySimulationConfig = {
        maxTransactionAmount: 999,
      };
      const result = evaluateProposedTransaction(baseTx, config);
      assert.equal(result.passed, false);
      const rule = result.rules.find((r) => r.id === 'max-transaction');
      assert.equal(rule?.passed, false);
      assert.equal(rule?.actual, '1000');
      assert.equal(rule?.expected, '999');
    });

    test('evaluates daily velocity limits accurately including prior spend', () => {
      // 5000 limit, 3500 spent + 1000 tx = 4500 (passes)
      const passingConfig: PolicySimulationConfig = {
        dailyLimit: 5000,
        dailySpent: 3500,
      };
      const passResult = evaluateProposedTransaction(baseTx, passingConfig);
      assert.equal(passResult.passed, true);

      // 5000 limit, 4200 spent + 1000 tx = 5200 (fails)
      const failingConfig: PolicySimulationConfig = {
        dailyLimit: 5000,
        dailySpent: 4200,
      };
      const failResult = evaluateProposedTransaction(baseTx, failingConfig);
      assert.equal(failResult.passed, false);
      const rule = failResult.rules.find((r) => r.id === 'daily-limit');
      assert.equal(rule?.passed, false);
      assert.equal(rule?.actual, '5200');
      assert.equal(rule?.expected, '5000');
    });

    test('evaluates department budget room vs overflow', () => {
      const config: PolicySimulationConfig = {
        departmentBudget: 15000,
        departmentSpent: 14500, // 14500 + 1000 = 15500 > 15000 (fails)
      };
      const result = evaluateProposedTransaction(baseTx, config);
      assert.equal(result.passed, false);
      const rule = result.rules.find((r) => r.id === 'department-budget');
      assert.equal(rule?.passed, false);
      assert.match(rule?.label ?? '', /Infrastructure/);
    });

    test('verifies recipient whitelist matching and unlisted rejection', () => {
      const whitelistConfig: PolicySimulationConfig = {
        allowedRecipients: [VALID_RECIPIENT_1, VALID_RECIPIENT_2],
      };
      // Approved recipient
      const approvedResult = evaluateProposedTransaction(baseTx, whitelistConfig);
      assert.equal(approvedResult.passed, true);

      // Unknown recipient
      const unlistedTx: ProposedTransaction = {
        ...baseTx,
        recipient: UNKNOWN_RECIPIENT,
      };
      const rejectedResult = evaluateProposedTransaction(unlistedTx, whitelistConfig);
      assert.equal(rejectedResult.passed, false);
      const rule = rejectedResult.rules.find((r) => r.id === 'recipient-whitelist');
      assert.equal(rule?.passed, false);
    });

    test('evaluates compound policies where multiple constraints must all pass', () => {
      const compoundConfig: PolicySimulationConfig = {
        maxTransactionAmount: 2000,
        dailyLimit: 10000,
        dailySpent: 2000,
        departmentBudget: 50000,
        departmentSpent: 10000,
        allowedRecipients: [VALID_RECIPIENT_1],
      };

      const result = evaluateProposedTransaction(baseTx, compoundConfig);
      assert.equal(result.passed, true);
      assert.equal(result.rules.length, 4);
      assert.equal(result.rules.every((r) => r.passed), true);
    });
  });
});
