'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
          <CardDescription className="text-foreground-muted">{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-foreground-muted" role="status">
            No correlation data available.
          </p>
        </CardContent>
      </Card>
    );
  }

  const agents = data.map((d) => ({ agentId: d.agentId, agentName: d.agentName, role: d.role }));

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
            <CardDescription className="text-foreground-muted">{description}</CardDescription>
          </div>
          {selectedCell && (
            <Badge variant="outline" className="self-start sm:self-auto border-border-strong text-foreground-primary">
              {selectedCell.rowAgent} ↔ {selectedCell.colAgent}: {selectedCell.value.toFixed(2)}
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
                  className="p-space-12 text-xs font-mono font-medium text-foreground-muted border-b border-border"
                >
                  Agent / Peer
                </th>
                {agents.map((colAgent) => (
                  <th
                    key={colAgent.agentId}
                    scope="col"
                    className="p-space-12 text-center text-xs font-mono font-medium text-foreground-muted border-b border-border"
                  >
                    <span className="block truncate max-w-[100px]" title={colAgent.agentName}>
                      {colAgent.agentName}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((row) => (
                <tr key={row.agentId} className="border-b border-border/50 hover:bg-surface-secondary/40 transition-colors">
                  <th
                    scope="row"
                    className="p-space-12 font-medium text-foreground-primary text-xs whitespace-nowrap border-r border-border"
                  >
                    <div className="flex flex-col">
                      <span>{row.agentName}</span>
                      <span className="text-[10px] text-foreground-muted uppercase tracking-wider">{row.role}</span>
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
                            'w-full py-2 px-3 rounded-md text-xs font-mono transition-all focus:outline-none focus:ring-2 focus:ring-gold',
                            getCorrelationColor(val),
                            isSelected && 'ring-2 ring-gold shadow-sm'
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
              <span className="inline-block w-3 h-3 rounded bg-gold" /> Self (1.0)
            </span>
            <span className="flex items-center gap-space-4">
              <span className="inline-block w-3 h-3 rounded bg-success-soft border border-success/30" /> High (&gt;=0.7)
            </span>
            <span className="flex items-center gap-space-4">
              <span className="inline-block w-3 h-3 rounded bg-warning-soft border border-warning/30" /> Moderate (&gt;=0.4)
            </span>
            <span className="flex items-center gap-space-4">
              <span className="inline-block w-3 h-3 rounded bg-surface-secondary border border-border" /> Low
            </span>
          </div>
          <span className="italic font-mono">Coefficients derived from rolling window spend activity</span>
        </div>
      </CardContent>
    </Card>
  );
}
