'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/cn';
import type { SpendingCorrelationDataset, CorrelationCell } from './types';

export interface SpendingCorrelationMatrixProps {
  data?: SpendingCorrelationDataset;
  title?: string;
  description?: string;
  className?: string;
}

function getCoefficientColor(coefficient: number): string {
  if (coefficient === 1.0) {
    return 'bg-surface-secondary text-foreground-primary font-semibold border border-border-strong';
  }
  if (coefficient >= 0.75) {
    return 'bg-gold/30 text-gold-strong font-medium';
  }
  if (coefficient >= 0.5) {
    return 'bg-gold/15 text-foreground-primary';
  }
  if (coefficient >= 0.25) {
    return 'bg-surface-secondary text-foreground-secondary';
  }
  if (coefficient > 0) {
    return 'bg-surface-primary text-foreground-muted';
  }
  if (coefficient === 0) {
    return 'bg-surface-primary text-foreground-muted opacity-50';
  }
  return 'bg-danger/20 text-danger font-medium';
}

export function SpendingCorrelationMatrix({
  data,
  title = 'Multi-Agent Spending Correlation Matrix',
  description = 'Cross-agent expenditure patterns and operational dependencies on Stellar over selected time periods.',
  className,
}: SpendingCorrelationMatrixProps) {
  const dataset = data;
  const [activeCell, setActiveCell] = useState<CorrelationCell | null>(null);

  if (!dataset) {
    return (
      <Card className={cn('w-full', className)}>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="py-space-24 text-center text-foreground-muted">
            No correlation data available.
          </div>
        </CardContent>
      </Card>
    );
  }

  const lookupCell = (idA: string, idB: string): CorrelationCell | undefined => {
    return dataset.matrix.find((c) => c.agentIdA === idA && c.agentIdB === idB);
  };

  return (
    <Card className={cn('w-full', className)}>
      <CardHeader className="flex flex-row items-center justify-between pb-space-16">
        <div>
          <CardTitle className="text-lg font-semibold text-foreground-primary">{title}</CardTitle>
          <CardDescription className="text-sm text-foreground-muted mt-space-4">{description}</CardDescription>
        </div>
        <Badge variant="outline" className="font-mono text-xs">
          Timeframe: {dataset.timeframe.toUpperCase()}
        </Badge>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table
            className="w-full border-collapse text-left"
            role="grid"
            aria-label="Multi-agent spending correlation matrix"
          >
            <thead>
              <tr>
                <th className="p-space-8 text-xs font-medium text-foreground-muted border-b border-border w-40">
                  Agent / Agent
                </th>
                {dataset.agents.map((agent) => (
                  <th
                    key={agent.id}
                    className="p-space-8 text-xs font-medium text-foreground-primary border-b border-border text-center min-w-[100px]"
                    scope="col"
                  >
                    <div className="truncate" title={agent.name}>
                      {agent.name}
                    </div>
                    <div className="text-[10px] text-foreground-muted font-normal">
                      {agent.category}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dataset.agents.map((rowAgent) => (
                <tr key={rowAgent.id} className="border-b border-border/50 hover:">
                  <th
                    className="p-space-8 text-xs font-medium text-foreground-primary text-left border-r border-border"
                    scope="row"
                  >
                    <div className="truncate" title={rowAgent.name}>
                      {rowAgent.name}
                    </div>
                  </th>
                  {dataset.agents.map((colAgent) => {
                    const cell = lookupCell(rowAgent.id, colAgent.id);
                    const coeff = cell ? cell.coefficient : 0;
                    return (
                      <td
                        key={colAgent.id}
                        className="p-2 text-center"
                        role="gridcell"
                        tabIndex={0}
                        aria-label={`Correlation between ${rowAgent.name} and ${colAgent.name}: ${coeff.toFixed(2)}`}
                        onMouseEnter={() => cell && setActiveCell(cell)}
                        onFocus={() => cell && setActiveCell(cell)}
                      >
                        <div
                          className={cn(
                            'flex h-12 w-full items-center justify-center rounded-md font-mono text-xs transition-colors',
                            getCoefficientColor(coeff)
                          )}
                        >
                          {coeff.toFixed(2)}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {activeCell && (
          <div
            className="mt-space-16 flex flex-wrap items-center justify-between rounded-md bg-surface-secondary p-space-12 text-xs text-foreground-secondary border border-border"
            aria-live="polite"
          >
            <div>
              <span className="font-medium text-foreground-primary">
                Selected Pair Analysis:
              </span>{' />'}
              {dataset.agents.find((a) => a.id === activeCell.agentIdA)?.name} &harr;{' '}
              {dataset.agents.find((a) => a.id === activeCell.agentIdB)?.name}
            </div>
            <div className="flex gap-space-16 font-mono">
              <span>Coefficient: <strong className="text-gold">{activeCell.coefficient.toFixed(2)}</strong></span>
              <span>Shared Txs: <strong>{activeCell.commonTransactionsCount}</strong></span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
