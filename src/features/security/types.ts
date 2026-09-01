export interface CircuitBreakerControlProps {
  /** Current user display name for audit trail. */
  currentUser?: string;
  /** Optional placement: 'topbar' (compact indicator) or 'settings' (full control). */
  variant?: 'topbar' | 'settings';
}

export interface CircuitBreakerConfirmModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  /** 'trip' = freezing operations, 'reset' = restoring them. */
  mode: 'trip' | 'reset';
  currentUser?: string;
}

export interface CircuitBreakerStatusIndicatorProps {
  status: 'operational' | 'frozen';
  /** Show a compact icon-only indicator or a labeled pill. */
  compact?: boolean;
}
