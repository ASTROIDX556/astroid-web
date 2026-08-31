export * from './api';
export * from './domain';
export * from './governance';

import React from 'react';

// Exported components to resolve global JSX bindings for un-scoped dashboard views
export const Badge: React.FC<{ children?: React.ReactNode; className?: string; variant?: string }> = ({
  children,
  className = '',
}) => React.createElement('span', { className }, children);

export const RiskBadge: React.FC<{ risk?: string; className?: string }> = ({
  risk,
  className = '',
}) => React.createElement('span', { className }, risk || 'Unknown');