import type { PolicySimulationInputValues } from './spendingPolicySchema';
import type { PolicyRuleEvaluationLog, PolicySimulationModalResult } from './types';

/**
 * Step/phase state machine, evaluation and screen-reader announcements for the
 * multi-step `PolicySimulationModal` (#525).
 *
 * The modal is a two-step workflow:
 *   1. `parameters` — the operator fills in the proposed transaction.
 *   2. `results`    — the simulation runs (`running`) and settles into
 *                     `passed`, `blocked` (a policy rule rejected the
 *                     transaction) or `error` (the simulation itself failed).
 *
 * Everything here is framework-free so the transitions, the stale-run guard
 * and the announcement text can be unit-tested under `node --test`.
 */

export type PolicySimulationStep = 'parameters' | 'results';
export type PolicySimulationPhase = 'idle' | 'running' | 'passed' | 'blocked' | 'error';

export interface PolicySimulationFlowState {
  step: PolicySimulationStep;
  phase: PolicySimulationPhase;
  /** Increments for every run so late results from an abandoned run are ignored. */
  runId: number;
  result: PolicySimulationModalResult | null;
  error: string | null;
}

export type PolicySimulationFlowAction =
  | { type: 'start' }
  | { type: 'resolve'; runId: number; result: PolicySimulationModalResult }
  | { type: 'reject'; runId: number; message: string }
  | { type: 'edit' }
  | { type: 'reset' };

export const POLICY_SIMULATION_STEPS: readonly { id: PolicySimulationStep; label: string }[] = [
  { id: 'parameters', label: 'Transaction parameters' },
  { id: 'results', label: 'Simulation results' },
];

export const initialPolicySimulationFlowState: PolicySimulationFlowState = {
  step: 'parameters',
  phase: 'idle',
  runId: 0,
  result: null,
  error: null,
};

export function policySimulationFlowReducer(
  state: PolicySimulationFlowState,
  action: PolicySimulationFlowAction,
): PolicySimulationFlowState {
  switch (action.type) {
    case 'start':
      if (state.phase === 'running') return state;
      return {
        step: 'results',
        phase: 'running',
        runId: state.runId + 1,
        result: null,
        error: null,
      };
    case 'resolve':
      if (action.runId !== state.runId || state.phase !== 'running') return state;
      return {
        ...state,
        phase: action.result.success ? 'passed' : 'blocked',
        result: action.result,
      };
    case 'reject':
      if (action.runId !== state.runId || state.phase !== 'running') return state;
      return { ...state, phase: 'error', error: action.message };
    case 'edit':
      // Going back abandons an in-flight run: bump runId so it cannot land.
      return {
        ...state,
        step: 'parameters',
        phase: 'idle',
        runId: state.phase === 'running' ? state.runId + 1 : state.runId,
      };
    case 'reset':
      // Closing/reopening the modal starts over, and also abandons any run.
      return { ...initialPolicySimulationFlowState, runId: state.runId + 1 };
    default:
      return state;
  }
}

export interface PolicySimulationAnnouncement {
  /**
   * `polite` for progress and passes; `assertive` for blocks and errors, which
   * the operator must not miss before committing a policy.
   */
  politeness: 'polite' | 'assertive';
  message: string;
}

/**
 * What the modal's live regions should say for a given state. Returns `null`
 * when there is nothing new to announce (editing parameters), so returning to
 * a step never re-reads an old result.
 */
export function describePolicySimulationAnnouncement(
  state: Pick<PolicySimulationFlowState, 'phase' | 'result' | 'error'>,
): PolicySimulationAnnouncement | null {
  switch (state.phase) {
    case 'running':
      return { politeness: 'polite', message: 'Simulation in progress. Evaluating policy rules…' };
    case 'passed': {
      const total = state.result?.logs.length ?? 0;
      return {
        politeness: 'polite',
        message: `Simulation passed. All ${total} policy ${total === 1 ? 'rule' : 'rules'} passed.`,
      };
    }
    case 'blocked': {
      const blocked = state.result?.logs.filter((log) => log.status === 'block') ?? [];
      const names = blocked.map((log) => log.ruleName).join(', ');
      return {
        politeness: 'assertive',
        message: `Simulation failed. ${blocked.length} policy ${
          blocked.length === 1 ? 'rule' : 'rules'
        } blocked this transaction${names ? `: ${names}` : ''}.`,
      };
    }
    case 'error':
      return {
        politeness: 'assertive',
        message: `Simulation could not be completed. ${state.error ?? 'Please try again.'}`,
      };
    default:
      return null;
  }
}

/** Single-transaction ceiling applied by the preview's spend rule. */
export const POLICY_SIMULATION_SPEND_CEILING = 5000;

/** Evaluates the preview's rules for a set of validated inputs. */
export function evaluatePolicySimulation(
  data: PolicySimulationInputValues,
  now: Date = new Date(),
): PolicySimulationModalResult {
  const timestamp = now.toISOString();
  const withinCeiling = data.amount <= POLICY_SIMULATION_SPEND_CEILING;
  const ceiling = POLICY_SIMULATION_SPEND_CEILING.toLocaleString('en-US');

  const logs: PolicyRuleEvaluationLog[] = [
    {
      ruleId: 'rule-01',
      ruleName: 'Agent Identity Authorization',
      status: 'pass',
      message: `Agent ID "${data.agentId}" is verified and authorized to initiate transactions.`,
      timestamp,
    },
    {
      ruleId: 'rule-02',
      ruleName: 'Asset Whitelist Check',
      status: 'pass',
      message: `Asset type "${data.assetType}" is included in approved portfolio assets.`,
      timestamp,
    },
    {
      ruleId: 'rule-03',
      ruleName: 'Single Transaction Spend Ceiling',
      status: withinCeiling ? 'pass' : 'block',
      message: withinCeiling
        ? `Transaction amount (${data.amount} ${data.assetType}) is within the single transaction limit of ${ceiling}.`
        : `Transaction amount (${data.amount} ${data.assetType}) exceeds single transaction limit of ${ceiling}.`,
      timestamp,
    },
  ];

  return {
    success: withinCeiling,
    summary: withinCeiling
      ? 'Simulation PASSED: Transaction complies with all active spending guardrails.'
      : 'Simulation FAILED: Transaction violates active spending policies.',
    logs,
  };
}

/**
 * Where keyboard focus belongs after a step transition, so it never stays on
 * a control that the transition removed from the DOM.
 */
export function focusTargetForTransition(
  previous: PolicySimulationStep,
  next: PolicySimulationStep,
): 'results-heading' | 'first-field' | null {
  if (previous === next) return null;
  return next === 'results' ? 'results-heading' : 'first-field';
}
