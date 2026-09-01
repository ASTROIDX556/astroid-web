export interface Signer {
  id: string;
  address: string;
  weight: number;
  label?: string;
}

export interface ThresholdConfig {
  low: number;
  medium: number;
  high: number;
}

export interface GovernanceSettings {
  masterWeight: number;
  thresholds: ThresholdConfig;
  signers: Signer[];
}