'use client';

import { useEffect, useMemo, useState } from 'react';
import { BellRing, Gauge, ShieldCheck, AlertTriangle, AlertOctagon, CheckCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export interface BudgetWarning {
  id: string;
  department: string;
  used: number;
  limit: number;
  severity: 'warning' | 'critical';
}

export interface BudgetAlertSettingsProps {
  defaultWarning?: number;
  defaultCritical?: number;
  currentUtilization?: number;
  warnings?: BudgetWarning[];
  onChange?: (warning: number, critical: number) => void;
}

export function BudgetAlertSettings({
  defaultWarning = 80,
  defaultCritical = 95,
  currentUtilization = 65,
  warnings = [],
  onChange,
}: BudgetAlertSettingsProps) {
  const [warning, setWarning] = useState(defaultWarning);
  const [critical, setCritical] = useState(defaultCritical);
  const [utilization, setUtilization] = useState(currentUtilization);

  useEffect(() => {
    setWarning(defaultWarning);
    setCritical(defaultCritical);
    setUtilization(currentUtilization);
  }, [defaultWarning, defaultCritical, currentUtilization]);

  const isInvalid = warning >= critical;

  const handleWarningChange = (value: number) => {
    const clamped = Math.min(100, Math.max(0, value));
    setWarning(clamped);
    if (clamped < critical) {
      onChange?.(clamped, critical);
    }
  };

  const handleCriticalChange = (value: number) => {
    const clamped = Math.min(100, Math.max(0, value));
    setCritical(clamped);
    if (clamped > warning) {
      onChange?.(warning, clamped);
    }
  };

  const gaugeColor = useMemo(() => {
    if (utilization >= critical) return 'text-destructive';
    if (utilization >= warning) return 'text-warning';
    return 'text-success';
  }, [utilization, warning, critical]);

  const gaugeBackground = useMemo(() => {
    if (utilization >= critical) return 'bg-destructive';
    if (utilization >= warning) return 'bg-warning';
    return 'bg-success';
  }, [utilization, warning, critical]);

  const barWidth = Math.min(100, Math.max(0, utilization));

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex-row items-center justify-between gap-3">
        <div>
          <p className="text-2xs font-semibold uppercase tracking-[0.2em] text-foreground-muted">
            Alert thresholds
          </p>
          <CardTitle className="mt-1 text-xl">Usage notifications</CardTitle>
        </div>
        <Badge variant="outline" size="sm" className="gap-1.5">
          <BellRing className="h-3.5 w-3.5" aria-hidden />
          Live
        </Badge>
      </CardHeader>

      <CardContent className="space-y-4 pt-0">
        <div className="space-y-3">
          <div className="rounded-card border border-border p-3">
            <div className="flex items-center justify-between gap-3">
              <span className="inline-flex items-center gap-2 text-sm font-medium text-foreground">
                <Gauge className="h-4 w-4 text-warning" aria-hidden />
                Warning threshold
              </span>
              <span className="text-xs font-semibold text-foreground">{warning}</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={warning}
              onChange={(e) => handleWarningChange(Number(e.target.value))}
              className="mt-3 h-2 w-full accent-warning"
              aria-label="Warning threshold"
            />
          </div>

          <div className="rounded-card border border-border p-3">
            <div className="flex items-center justify-between gap-3">
              <span className="inline-flex items-center gap-2 text-sm font-medium text-foreground">
                <Gauge className="h-4 w-4 text-destructive" aria-hidden />
                Critical threshold
              </span>
              <span className="text-xs font-semibold text-foreground">{critical}</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={critical}
              onChange={(e) => handleCriticalChange(Number(e.target.value))}
              className="mt-3 h-2 w-full accent-destructive"
              aria-label="Critical threshold"
            />
          </div>
        </div>

        {isInvalid && (
          <p className="rounded-card bg-destructive/10 border-destructive/20 border p-2 text-xs text-destructive" role="alert">
            Warning threshold must be less than critical threshold.
          </p>
        )}

        <div className="rounded-card border border-border bg-surface-secondary/50 p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">Budget preview</span>
            <span className={`text-sm font-semibold ${gaugeColor}`}>{utilization}</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative h-3 flex-1 overflow-hidden rounded-full bg-muted">
              <div
                className={`h-full rounded-full ${gaugeBackground}`}
                style={{ width: `${barWidth}%` }}
              />
            </div>
            <Gauge className={`h-5 w-5 ${gaugeColor}`} aria-hidden />
          </div>
          <div className="mt-3 flex items-center gap-2">
            <span className="text-xs text-foreground-muted">Simulate usage:</span>
            <input
              type="range"
              min={0}
              max={120}
              step={1}
              value={utilization}
              onChange={(e) => setUtilization(Number(e.target.value))}
              className="h-1.5 flex-1 accent-primary"
              aria-label="Simulate current utilization"
            />
            <span className="w-10 text-right text-xs font-semibold text-foreground">{utilization}</span>
          </div>
        </div>

        <div className="rounded-card border border-border p-3">
          <div className="mb-2 flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-success" aria-hidden />
            <span className="text-sm font-medium text-foreground">Active warnings</span>
            <Badge variant="outline" size="sm" className="ml-auto">
              {warnings.length}
            </Badge>
          </div>
          {warnings.length === 0 ? (
            <p className="flex items-center gap-2 text-xs text-foreground-secondary">
              <CheckCircle2 className="h-3.5 w-3.5 text-success" aria-hidden />
              All budgets within healthy range.
            </p>
          ) : (
            <ul className="space-y-2">
              {warnings.map((warningItem) => (
                <li
                  key={warningItem.id}
                  className={`flex items-center justify-between gap-2 rounded-card border p-2 ${warningItem.severity === 'critical' ? 'border-destructive/30 bg-destructive/10' : 'border-warning/30 bg-warning/10'}`}
                >
                  <div className="flex items-center gap-2">
                    {warningItem.severity === 'critical' ? (
                      <AlertOctagon className="h-3.5 w-3.5 text-destructive" aria-hidden />
                    ) : (
                      <AlertTriangle className="h-3.5 w-3.5 text-warning" aria-hidden />
                    )}
                    <span className="text-xs font-medium text-foreground">{warningItem.department}</span>
                  </div>
                  <span className={`text-xs font-semibold ${warningItem.severity === 'critical' ? 'text-destructive' : 'text-warning'}`}>
                    {warningItem.used}% used
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex items-center justify-between rounded-card border border-border bg-surface-secondary/50 p-3 text-xs text-foreground-secondary">
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-success" aria-hidden />
            Alert workflow enabled
          </span>
          <span>
            Warning {warning}% / Critical {critical}%
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

export default BudgetAlertSettings;
