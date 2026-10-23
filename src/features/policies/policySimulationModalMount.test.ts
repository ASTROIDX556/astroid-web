import assert from 'node:assert/strict';
import test, { describe } from 'node:test';
import {
  initialPolicySimulationModalMountState,
  policySimulationModalMountReducer,
  type PolicySimulationModalMountAction,
  type PolicySimulationModalMountState,
} from './policySimulationModalMount';
import type { PolicySimulationModalResult } from './types';

const passedResult: PolicySimulationModalResult = {
  success: true,
  summary: 'Simulation PASSED: Transaction complies with all active spending guardrails.',
  logs: [
    {
      ruleId: 'rule-01',
      ruleName: 'Agent Identity Authorization',
      status: 'pass',
      message: 'Agent is verified.',
      timestamp: '2026-10-22T10:00:00.000Z',
    },
  ],
};

const blockedResult: PolicySimulationModalResult = {
  success: false,
  summary: 'Simulation FAILED: Transaction violates active spending policies.',
  logs: [
    {
      ruleId: 'rule-03',
      ruleName: 'Single Transaction Spend Ceiling',
      status: 'block',
      message: 'Amount exceeds the ceiling.',
      timestamp: '2026-10-22T10:05:00.000Z',
    },
  ],
};

describe('Policy simulation preview modal mount lifecycle (#182)', () => {
  test('modal starts closed so the editor never renders it unprompted', () => {
    assert.equal(initialPolicySimulationModalMountState.isOpen, false);
    assert.equal(initialPolicySimulationModalMountState.lastResult, null);
  });

  test('open action reveals the modal from the editor trigger', () => {
    const next = policySimulationModalMountReducer(
      initialPolicySimulationModalMountState,
      { type: 'open' },
    );
    assert.equal(next.isOpen, true);
  });

  test('close action dismisses the modal and keeps the recorded result', () => {
    const open = policySimulationModalMountReducer(
      initialPolicySimulationModalMountState,
      { type: 'open' },
    );
    const withResult = policySimulationModalMountReducer(open, {
      type: 'simulation-complete',
      result: passedResult,
    });
    const closed = policySimulationModalMountReducer(withResult, { type: 'close' });

    assert.equal(closed.isOpen, false);
    assert.deepEqual(closed.lastResult, passedResult);
  });

  test('simulation-complete records the result but leaves the modal open for review', () => {
    const open = policySimulationModalMountReducer(
      initialPolicySimulationModalMountState,
      { type: 'open' },
    );
    const next = policySimulationModalMountReducer(open, {
      type: 'simulation-complete',
      result: blockedResult,
    });

    assert.equal(next.isOpen, true, 'modal must remain visible so logs can be read');
    assert.deepEqual(next.lastResult, blockedResult);
    assert.equal(next.lastResult?.success, false);
    assert.equal(next.lastResult?.logs.length, 1);
  });

  test('a full open → simulate → close → re-open cycle keeps the latest result', () => {
    let state: PolicySimulationModalMountState = initialPolicySimulationModalMountState;
    state = policySimulationModalMountReducer(state, { type: 'open' });
    state = policySimulationModalMountReducer(state, { type: 'simulation-complete', result: passedResult });
    state = policySimulationModalMountReducer(state, { type: 'close' });
    state = policySimulationModalMountReducer(state, { type: 'open' });

    assert.equal(state.isOpen, true);
    assert.deepEqual(state.lastResult, passedResult);

    const rerun = policySimulationModalMountReducer(state, {
      type: 'simulation-complete',
      result: blockedResult,
    });
    assert.deepEqual(rerun.lastResult, blockedResult, 'latest run overwrites the previous result');
  });

  test('unknown action is a no-op returning the same state', () => {
    const open = policySimulationModalMountReducer(
      initialPolicySimulationModalMountState,
      { type: 'open' },
    );
    const untouched = policySimulationModalMountReducer(open, {
      type: 'resize',
    } as unknown as PolicySimulationModalMountAction);

    assert.equal(untouched, open);
  });
});
