import type { PolicySimulationModalResult } from './types';

/**
 * Mount contract for the policy simulation preview modal (#182).
 *
 * `PolicySimulationModal` is fully self-contained: it renders only while
 * `isOpen` is true, reports every finished run through
 * `onSimulationComplete`, and dismisses through `onClose`. The policy editor
 * page keeps that lifecycle in this reducer so the open/close transitions and
 * result capture are testable without a DOM harness (this repo runs its unit
 * tests under `node --test` and has no jsdom).
 */
export interface PolicySimulationModalMountState {
  isOpen: boolean;
  lastResult: PolicySimulationModalResult | null;
}

export type PolicySimulationModalMountAction =
  | { type: 'open' }
  | { type: 'close' }
  | { type: 'simulation-complete'; result: PolicySimulationModalResult };

export const initialPolicySimulationModalMountState: PolicySimulationModalMountState = {
  isOpen: false,
  lastResult: null,
};

export function policySimulationModalMountReducer(
  state: PolicySimulationModalMountState,
  action: PolicySimulationModalMountAction,
): PolicySimulationModalMountState {
  switch (action.type) {
    case 'open':
      return { ...state, isOpen: true };
    case 'close':
      return { ...state, isOpen: false };
    case 'simulation-complete':
      // The modal stays open so the operator can read the evaluation logs;
      // we only record the result for the surrounding page.
      return { ...state, lastResult: action.result };
    default:
      return state;
  }
}
