import assert from 'node:assert/strict';
import test from 'node:test';
import {
  POLICY_SIMULATION_SPEND_CEILING,
  describePolicySimulationAnnouncement,
  evaluatePolicySimulation,
  focusTargetForTransition,
  initialPolicySimulationFlowState,
  policySimulationFlowReducer,
  type PolicySimulationFlowAction,
  type PolicySimulationFlowState,
} from './policySimulationFlow';
import type { PolicySimulationInputValues } from './spendingPolicySchema';

const input: PolicySimulationInputValues = {
  amount: 100,
  recipientAddress: 'GBC2XZ743X7Z5X423Z5X423Z5X423Z5X423Z5X423Z5X423Z5X423Z5X',
  assetType: 'USDC',
  agentId: 'agent-treasury-01',
};
const now = new Date('2026-11-20T10:00:00.000Z');
const passing = evaluatePolicySimulation(input, now);
const blocking = evaluatePolicySimulation({ ...input, amount: 9000 }, now);

function run(...actions: PolicySimulationFlowAction[]): PolicySimulationFlowState {
  return actions.reduce(policySimulationFlowReducer, initialPolicySimulationFlowState);
}

test('starts on the parameters step with nothing to announce', () => {
  assert.equal(initialPolicySimulationFlowState.step, 'parameters');
  assert.equal(describePolicySimulationAnnouncement(initialPolicySimulationFlowState), null);
});

test('submitting moves to the results step and announces progress politely', () => {
  const state = run({ type: 'start' });
  assert.equal(state.step, 'results');
  assert.equal(state.phase, 'running');
  assert.deepEqual(describePolicySimulationAnnouncement(state), {
    politeness: 'polite',
    message: 'Simulation in progress. Evaluating policy rules…',
  });
});

test('a passing result is announced politely with the rule count', () => {
  const state = run({ type: 'start' }, { type: 'resolve', runId: 1, result: passing });
  assert.equal(state.phase, 'passed');
  assert.deepEqual(describePolicySimulationAnnouncement(state), {
    politeness: 'polite',
    message: 'Simulation passed. All 3 policy rules passed.',
  });
});

test('a blocked result is announced assertively and names the blocking rule', () => {
  const state = run({ type: 'start' }, { type: 'resolve', runId: 1, result: blocking });
  assert.equal(state.phase, 'blocked');
  assert.deepEqual(describePolicySimulationAnnouncement(state), {
    politeness: 'assertive',
    message:
      'Simulation failed. 1 policy rule blocked this transaction: Single Transaction Spend Ceiling.',
  });
});

test('a simulation error is announced assertively', () => {
  const state = run({ type: 'start' }, { type: 'reject', runId: 1, message: 'Horizon timed out.' });
  assert.equal(state.phase, 'error');
  assert.deepEqual(describePolicySimulationAnnouncement(state), {
    politeness: 'assertive',
    message: 'Simulation could not be completed. Horizon timed out.',
  });
});

test('a second run clears the previous result so a repeat outcome is announced again', () => {
  const first = run({ type: 'start' }, { type: 'resolve', runId: 1, result: blocking });
  const rerun = policySimulationFlowReducer(
    policySimulationFlowReducer(first, { type: 'edit' }),
    { type: 'start' },
  );
  assert.equal(rerun.result, null);
  assert.equal(describePolicySimulationAnnouncement(rerun)?.politeness, 'polite');
  const second = policySimulationFlowReducer(rerun, {
    type: 'resolve',
    runId: rerun.runId,
    result: blocking,
  });
  assert.equal(describePolicySimulationAnnouncement(second)?.politeness, 'assertive');
});

test('returning to the parameters step does not re-announce the old result', () => {
  const state = run(
    { type: 'start' },
    { type: 'resolve', runId: 1, result: passing },
    { type: 'edit' },
  );
  assert.equal(state.step, 'parameters');
  assert.equal(describePolicySimulationAnnouncement(state), null);
});

test('results from a run abandoned by editing or closing are ignored', () => {
  const edited = run({ type: 'start' }, { type: 'edit' }, { type: 'resolve', runId: 1, result: passing });
  assert.equal(edited.step, 'parameters');
  assert.equal(edited.result, null);

  const closed = run({ type: 'start' }, { type: 'reset' }, { type: 'reject', runId: 1, message: 'x' });
  assert.equal(closed.phase, 'idle');
  assert.equal(closed.error, null);
});

test('a double submit while running does not start a second run', () => {
  const once = run({ type: 'start' });
  assert.equal(policySimulationFlowReducer(once, { type: 'start' }), once);
});

test('reset returns to step one from any state', () => {
  const state = run({ type: 'start' }, { type: 'resolve', runId: 1, result: blocking }, { type: 'reset' });
  assert.equal(state.step, 'parameters');
  assert.equal(state.phase, 'idle');
  assert.equal(state.result, null);
});

test('step transitions move focus to an element that exists on the new step', () => {
  assert.equal(focusTargetForTransition('parameters', 'results'), 'results-heading');
  assert.equal(focusTargetForTransition('results', 'parameters'), 'first-field');
  assert.equal(focusTargetForTransition('results', 'results'), null);
  assert.equal(focusTargetForTransition('parameters', 'parameters'), null);
});

test('evaluation blocks amounts above the single-transaction ceiling and passes at it', () => {
  assert.equal(passing.success, true);
  assert.ok(passing.logs.every((log) => log.status === 'pass'));
  assert.equal(evaluatePolicySimulation({ ...input, amount: POLICY_SIMULATION_SPEND_CEILING }, now).success, true);
  assert.equal(blocking.success, false);
  assert.deepEqual(
    blocking.logs.filter((log) => log.status === 'block').map((log) => log.ruleId),
    ['rule-03'],
  );
  assert.match(blocking.logs[2]!.message, /exceeds single transaction limit of 5,000/);
  assert.ok(blocking.logs.every((log) => log.timestamp === now.toISOString()));
});
