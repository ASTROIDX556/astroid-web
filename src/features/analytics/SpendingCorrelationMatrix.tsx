'use client';

import React, { useState } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/cn';
import type { AgentCorrelationPoint } from '@/services/mock/analytics';

export interface SpendingCorrelationMatrixProps {
  data?: AgentCorrelationPoint[];
  title?: string;
  description?: string;
  className?: string;
}

export function SpendingCorrelationMatrix({
  data = [],
  title = 'Multi-Agent Spending Correlation Matrix',
  description = 'Cross-agent expenditure correlation coefficients and transaction pattern dependencies across Stellar.',
  className,
}: SpendingCorrelationMatrixProps) {
  const [selectedCell, setSelectedCell] = useState<{
    rowAgent: string;
    colAgent: string;
    value: number;
  } | null>(null);

  if (!data || data.length === 0) {
    return (
      <Card className={cn('border-border bg-surface-primary', className)}>
        <CardHeader>
          <CardTitle className="text-foreground-primary">{title}</CardTitle>
          <CardDescription className="text-foreground-muted">
            {description}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-foreground-muted" role="status">
            No correlation data available.
          </p>
        </CardContent>
      </Card>
    );
  }

  const agents = data.map((d) => ({
    agentId: d.agentId,
    agentName: d.agentName,
    role: d.role,
  }));

  function getCorrelationColor(val: number): string {
    if (val === 1.0) return 'bg-gold text-surface-primary font-semibold';
    if (val >= 0.7) return 'bg-success-soft text-success font-medium';
    if (val >= 0.4) return 'bg-warning-soft text-warning font-medium';
    if (val >= 0.2) return 'bg-surface-secondary text-foreground-primary';
    return 'bg-surface-primary text-foreground-muted';
  }

  return (
    <Card className={cn('border-border bg-surface-primary', className)}>
      <CardHeader>
        <div className="flex flex-col gap-space-8 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-foreground-primary">{title}</CardTitle>
            <CardDescription className="text-foreground-muted">
              {description}
            </CardDescription>
          </div>
          {selectedCell && (
            <Badge
              variant="outline"
              className="self-start border-border-strong text-foreground-primary sm:self-auto"
            >
              {selectedCell.rowAgent} ↔ {selectedCell.colAgent}:{' '}
              {selectedCell.value.toFixed(2)}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table
            className="w-full border-collapse text-left text-sm"
            role="grid"
            aria-label="Multi-Agent Spending Correlation Matrix"
          >
            <thead>
              <tr>
                <th
                  scope="col"
                  className="border-b border-border p-space-12 font-mono text-xs font-medium text-foreground-muted"
                >
                  Agent / Peer
                </th>
                {agents.map((colAgent) => (
                  <th
                    key={colAgent.agentId}
                    scope="col"
                    className="border-b border-border p-space-12 text-center font-mono text-xs font-medium text-foreground-muted"
                  >
                    <span
                      className="block max-w-[100px] truncate"
                      title={colAgent.agentName}
                    >
                      {colAgent.agentName}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((row) => (
                <tr
                  key={row.agentId}
                  className="border-b border-border/50 transition-colors hover:bg-surface-secondary/40"
                >
                  <th
                    scope="row"
                    className="whitespace-nowrap border-r border-border p-space-12 text-xs font-medium text-foreground-primary"
                  >
                    <div className="flex flex-col">
                      <span>{row.agentName}</span>
                      <span className="text-[10px] uppercase tracking-wider text-foreground-muted">
                        {row.role}
                      </span>
                    </div>
                  </th>
                  {agents.map((colAgent) => {
                    const val = row.correlations[colAgent.agentId] ?? 0;
                    const isSelected =
                      selectedCell?.rowAgent === row.agentName &&
                      selectedCell?.colAgent === colAgent.agentName;

                    return (
                      <td
                        key={colAgent.agentId}
                        className="p-space-8 text-center"
                        role="gridcell"
                        aria-label={`Correlation between ${row.agentName} and ${colAgent.agentName} is ${val.toFixed(2)}`}
                      >
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedCell({
                              rowAgent: row.agentName,
                              colAgent: colAgent.agentName,
                              value: val,
                            })
                          }
                          className={cn(
                            'w-full rounded-md px-3 py-2 font-mono text-xs transition-all focus:outline-none focus:ring-2 focus:ring-gold',
                            getCorrelationColor(val),
                            isSelected && 'shadow-sm ring-2 ring-gold',
                          )}
                        >
                          {val.toFixed(2)}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-space-16 flex flex-wrap items-center justify-between gap-space-12 text-xs text-foreground-muted">
          <div className="flex items-center gap-space-12">
            <span className="flex items-center gap-space-4">
              <span className="inline-block h-3 w-3 rounded bg-gold" /> Self (1.0)
            </span>
            <span className="flex items-center gap-space-4">
              <span className="inline-block h-3 w-3 rounded border border-success/30 bg-success-soft" />{' '}
              High (&gt;=0.7)
            </span>
            <span className="flex items-center gap-space-4">
              <span className="inline-block h-3 w-3 rounded border border-warning/30 bg-warning-soft" />{' '}
              Moderate (&gt;=0.4)
            </span>
            <span className="flex items-center gap-space-4">
              <span className="inline-block h-3 w-3 rounded border border-border bg-surface-secondary" />{' '}
              Low
            </span>
          </div>
          <span className="font-mono italic">
            Coefficients derived from rolling window spend activity
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
