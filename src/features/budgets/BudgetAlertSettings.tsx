'use client';

import { useEffect, useMemo, useState } from 'react';
import { BellRing, Gauge, ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export interface BudgetAlertSettingsProps {
  defaultThresholds?: number[];
  onChange?: (thresholds: number[]) => void;
}

export function BudgetAlertSettings({
  defaultThresholds = [70, 90, 100],
  onChange,
}: BudgetAlertSettingsProps) {
  const [thresholds, setThresholds] = useState<number[]>(defaultThresholds);

  useEffect(() => {
    setThresholds(defaultThresholds);
  }, [defaultThresholds]);

  const settings = useMemo(
    () => [
      { value: 70, label: 'Monitor', tone: 'text-amber-300', accent: 'bg-amber-500/10 border-amber-500/30' },
      { value: 90, label: 'Escalate', tone: 'text-orange-300', accent: 'bg-orange-500/10 border-orange-500/30' },
      { value: 100, label: 'Critical', tone: 'text-rose-300', accent: 'bg-rose-500/10 border-rose-500/30' },
    ],
    [],
  );

  const updateThreshold = (value: number, nextValue: number) => {
    const next = thresholds.map((current) => (current === value ? nextValue : current));
    setThresholds(next);
    onChange?.(next);
  };

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
        {settings.map((setting) => {
          const currentValue = thresholds.includes(setting.value) ? setting.value : 0;

          return (
            <div
              key={setting.value}
              className={`rounded-card border p-3 ${setting.accent}`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Gauge className={`h-4 w-4 ${setting.tone}`} aria-hidden />
                  <span className="text-sm font-medium text-foreground">{setting.label}</span>
                </div>
                <span className={`text-xs font-semibold ${setting.tone}`}>
                  {currentValue}%
                </span>
              </div>

              <div className="mt-3 flex items-center gap-2">
                <input
                  type="range"
                  min={50}
                  max={110}
                  step={5}
                  value={currentValue}
                  onChange={(event) => updateThreshold(setting.value, Number(event.target.value))}
                  className="h-2 w-full accent-current"
                  aria-label={`${setting.label} threshold`}
                />
                <Button type="button" variant="ghost" size="sm" className="shrink-0 px-2 text-2xs">
                  {currentValue > 0 ? 'Active' : 'Off'}
                </Button>
              </div>
            </div>
          );
        })}

        <div className="flex items-center justify-between rounded-card border border-border bg-surface-secondary/50 p-3 text-xs text-foreground-secondary">
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-success" aria-hidden />
            Alert workflow enabled
          </span>
          <span>{thresholds.join('% / ')}%</span>
        </div>
      </CardContent>
    </Card>
  );
}

export default BudgetAlertSettings;
