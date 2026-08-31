import { create } from 'zustand';
import { AgentWizardValues, providerOptions } from './schema';

interface AgentWizardState {
  currentStep: number;
  values: AgentWizardValues;
  setCurrentStep: (step: number) => void;
  setValues: (values: Partial<AgentWizardValues>) => void;
  nextStep: () => void;
  prevStep: () => void;
  reset: () => void;
}

const initialValues: AgentWizardValues = {
  name: '',
  description: '',
  ownerDepartment: '',
  provider: providerOptions[0],
  model: '',
  apiKey: '',
  temperature: 0.7,
  budget: 0,
  singleTransactionCap: 0,
};

export const useAgentWizardStore = create<AgentWizardState)((set) => ({
  currentStep: 0,
  values: initialValues,
  setCurrentStep: (step) => set({ currentStep: step }),
  setValues: (values) => set((state) => ({ values: { ...state.values, ...values } })),
  nextStep: () => set((state) => ({ currentStep: Math.min(state.currentStep + 1, 3) })),
  prevStep: () => set((state) => ({ currentStep: Math.max(state.currentStep - 1, 0) })),
  reset: () => set({ currentStep: 0, values: initialValues }),
}));