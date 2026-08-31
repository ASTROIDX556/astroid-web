'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleDollarSign,
  FileWarning,
  ShieldAlert,
  ShieldCheck,
  Wallet,
  XCircle,
  type LucideIcon,
} from 'lucide-react';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export type SimulationStepStatus = 'success' | 'failed' | 'warning';

export interface SimulationDiagnostic {
  code: string;
  message: string;
  remediation: string;
  payload?: Record<string, unknown>;
}

export interface SimulationStep {
  id: string;
  label: string;
  description: string;
  status: SimulationStepStatus;
  diagnostics?: SimulationDiagnostic[];
}

export interface SimulationFeeEstimate {
  network: number;
  resource: number;
  refundable: number;
  total: number;
  asset: string;
}

export interface TransactionSimulation {
  transactionId: string;
  proposedBy: string;
  status: 'approved' | 'rejected';
  steps: SimulationStep[];
  fee: SimulationFeeEstimate;
}

export interface SimulationTimelineProps {
  simulation: TransactionSimulation;
  className?: string;
}

const STATUS_CONFIG: Record<
  SimulationStepStatus,
  { icon: LucideIcon; label: string; className: string; badge: 'success' | 'warning' | 'danger' }
> = {
  success: {
    icon: CheckCircle2,
    label: 'Passed',
    className: 'border-success/40 bg-success-soft/30 text-success',
    badge: 'success',
  },
  warning: {
    icon: AlertTriangle,
    label: 'Warning',
    className: 'border-warning/40 bg-warning-soft/30 text-warning',
    badge: 'warning',
  },
  failed: {
    icon: XCircle,
    label: 'Failed',
    className: 'border-danger/40 bg-danger-soft/30 text-danger',
    badge: 'danger',
  },
};

export const MOCK_SUCCESS_SIMULATION: TransactionSimulation = {
  transactionId: 'sim_01HXT5J9ZB8Y3GXQ',
  proposedBy: 'Treasury Rebalancer',
  status: 'approved',
  fee: { network: 100, resource: 4200, refundable: 1200, total: 5500, asset: 'stroops' },
  steps: [
    { id: 'decode', label: 'Decode proposed transaction', description: 'Parsed one payment operation and verified the transaction envelope.', status: 'success' },
    { id: 'policy', label: 'Evaluate policy rules', description: 'Amount, recipient allow-list, and signing thresholds all passed.', status: 'success' },
    { id: 'balance', label: 'Verify source balance', description: 'Available XLM covers the transfer amount and maximum simulated fee.', status: 'success' },
    { id: 'simulate', label: 'Simulate Soroban execution', description: 'Simulation completed without host errors or authorization changes.', status: 'success' },
  ],
};

export const MOCK_POLICY_REJECTION_SIMULATION: TransactionSimulation = {
  transactionId: 'sim_01HXT5KJFMQ8QR2P',
  proposedBy: 'Treasury Rebalancer',
  status: 'rejected',
  fee: { network: 100, resource: 6800, refundable: 2100, total: 9000, asset: 'stroops' },
  steps: [
    { id: 'decode', label: 'Decode proposed transaction', description: 'Parsed one payment operation to an external recipient.', status: 'success' },
    {
      id: 'policy',
      label: 'Evaluate policy rules',
      description: 'The proposed transfer exceeds the autonomous spending policy.',
      status: 'failed',
      diagnostics: [{
        code: 'POLICY_MAX_TRANSACTION_VALUE',
        message: 'Payment of 12,500 USDC exceeds the 5,000 USDC autonomous transaction limit.',
        remediation: 'Reduce the amount to 5,000 USDC or request the required human approval.',
        payload: { policyId: 'single-tx-ceiling', proposedAmount: '12500', allowedAmount: '5000', asset: 'USDC' },
      }],
    },
    {
      id: 'balance',
      label: 'Verify source balance',
      description: 'The source account cannot reserve the maximum simulated fee.',
      status: 'warning',
      diagnostics: [{
        code: 'INSUFFICIENT_XLM_FOR_FEE',
        message: 'Available balance is 7,500 stroops; the maximum fee estimate is 9,000 stroops.',
        remediation: 'Fund the source account with at least 1,500 additional stroops before submitting.',
        payload: { availableStroops: '7500', requiredStroops: '9000', shortfallStroops: '1500' },
      }],
    },
    { id: 'simulate', label: 'Simulate Soroban execution', description: 'Skipped because pre-submission checks reported blocking failures.', status: 'warning' },
  ],
};

function feeChartData(fee: SimulationFeeEstimate) {
  return [
    { name: 'Network', value: fee.network },
    { name: 'Resource', value: fee.resource },
    { name: 'Refundable', value: fee.refundable },
  ];
}

export function SimulationTimeline({ simulation, className = '' }: SimulationTimelineProps) {
  const [expandedStep, setExpandedStep] = useState<string | null>(null);
  const chartData = feeChartData(simulation.fee);
  const hasFailure = simulation.steps.some((step) => step.status === 'failed');

  return (
    <Card className={`overflow-hidden ${className}`}>
      <CardHeader className="border-b border-border bg-surface-primary/60">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-gold" aria-hidden="true" />
              <CardTitle className="text-base">Transaction simulation inspector</CardTitle>
              <Badge variant={simulation.status === 'approved' ? 'success' : 'danger'} size="sm">
                {simulation.status === 'approved' ? 'Ready to submit' : 'Submission blocked'}
              </Badge>
            </div>
            <CardDescription className="text-xs">
              {simulation.proposedBy} · <span className="font-mono">{simulation.transactionId}</span>
            </CardDescription>
          </div>
          {hasFailure && (
            <div className="flex items-start gap-2 rounded-button border border-danger/30 bg-danger-soft/30 px-3 py-2 text-xs text-danger sm:max-w-xs">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              Review the failed checks and remediation before asking the wallet to sign.
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="grid gap-6 pt-5 lg:grid-cols-[minmax(0,1fr)_17rem]">
        <section aria-label="Simulation steps">
          <ol className="relative space-y-4 pl-8 before:absolute before:bottom-3 before:left-3 before:top-3 before:w-px before:bg-border">
            {simulation.steps.map((step, index) => {
              const config = STATUS_CONFIG[step.status];
              const Icon = config.icon;
              const isExpanded = expandedStep === step.id;
              const diagnostics = step.diagnostics ?? [];
              return (
                <li key={step.id} className="relative">
                  <span className={`absolute -left-8 top-3 grid h-6 w-6 place-items-center rounded-full border ${config.className}`} aria-hidden="true">
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, delay: index * 0.05 }}
                    className="rounded-card border border-border bg-surface-primary"
                  >
                    <div className="flex items-start justify-between gap-3 p-3.5">
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-semibold text-foreground">{step.label}</span>
                          <Badge variant={config.badge} size="sm">{config.label}</Badge>
                        </div>
                        <p className="text-xs leading-relaxed text-foreground-secondary">{step.description}</p>
                      </div>
                      {diagnostics.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setExpandedStep(isExpanded ? null : step.id)}
                          aria-expanded={isExpanded}
                          aria-controls={`simulation-diagnostics-${step.id}`}
                          className="inline-flex shrink-0 items-center gap-1 rounded-button px-2 py-1 text-xs font-semibold text-gold hover:bg-gold-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <FileWarning className="h-3.5 w-3.5" aria-hidden="true" />
                          Diagnostics
                          {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                        </button>
                      )}
                    </div>
                    <AnimatePresence initial={false}>
                      {isExpanded && (
                        <motion.div
                          id={`simulation-diagnostics-${step.id}`}
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden border-t border-border bg-surface-secondary/40"
                        >
                          <div className="space-y-3 p-3.5">
                            {diagnostics.map((diagnostic) => (
                              <div key={diagnostic.code} className="space-y-2 rounded-button border border-border bg-surface-primary p-3 text-xs">
                                <div className="flex flex-wrap items-center gap-2">
                                  <Badge variant="danger" size="sm" className="font-mono">{diagnostic.code}</Badge>
                                </div>
                                <p className="text-foreground-secondary">{diagnostic.message}</p>
                                <p className="rounded-button border border-gold/20 bg-gold-soft/40 px-2.5 py-2 text-foreground-secondary">
                                  <span className="font-semibold text-gold">Remediation: </span>{diagnostic.remediation}
                                </p>
                                {diagnostic.payload && (
                                  <details className="group">
                                    <summary className="cursor-pointer text-xs font-semibold text-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">View error payload</summary>
                                    <pre className="mt-2 max-h-48 overflow-auto rounded-button border border-border bg-surface-dark p-3 font-mono text-2xs text-foreground-secondary">
                                      {JSON.stringify(diagnostic.payload, null, 2)}
                                    </pre>
                                  </details>
                                )}
                              </div>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                </li>
              );
            })}
          </ol>
        </section>

        <aside className="space-y-3 rounded-card border border-border bg-surface-secondary/30 p-4" aria-label="Simulation fee estimate">
          <div className="flex items-center gap-2">
            <CircleDollarSign className="h-4 w-4 text-gold" aria-hidden="true" />
            <h3 className="text-xs font-semibold text-foreground">Maximum fee estimate</h3>
          </div>
          <div>
            <p className="font-mono text-xl font-bold text-foreground">{simulation.fee.total.toLocaleString()}</p>
            <p className="text-2xs text-foreground-muted">{simulation.fee.asset} reserved for submission</p>
          </div>
          <div className="h-32" aria-label="Fee estimate breakdown chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 4, right: 0, bottom: 0, left: -20 }}>
                <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: 'currentColor' }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: 'currentColor' }} />
                <Tooltip formatter={(value) => `${Number(value).toLocaleString()} stroops`} cursor={{ fill: 'transparent' }} />
                <Bar dataKey="value" fill="currentColor" className="fill-gold" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <dl className="space-y-2 border-t border-border pt-3 text-2xs">
            {chartData.map((item) => (
              <div key={item.name} className="flex items-center justify-between gap-3 text-foreground-secondary">
                <dt>{item.name} fee</dt><dd className="font-mono text-foreground">{item.value.toLocaleString()}</dd>
              </div>
            ))}
          </dl>
          <div className="flex gap-2 rounded-button bg-surface-primary p-2 text-2xs text-foreground-muted">
            <Wallet className="h-3.5 w-3.5 shrink-0 text-gold" aria-hidden="true" /> Fee estimates can change when the transaction is submitted.
          </div>
        </aside>
      </CardContent>
    </Card>
  );
}

export default SimulationTimeline;