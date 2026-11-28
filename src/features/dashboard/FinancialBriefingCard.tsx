'use client';

import { ArrowRight, Bot, Sparkles, TrendingUp, AlertTriangle } from 'lucide-react';
import { Bar, BarChart, Tooltip as RechartsTooltip, XAxis } from 'recharts';
import {
  ChartTooltipShell,
  axisTick,
  type TooltipPayloadItem,
} from '@/components/charts';
import { ChartFrame } from '@/components/charts/chart-frame';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { AiBriefing } from '@/types/domain';

export interface FinancialBriefingCardProps {
  briefing?: AiBriefing | null;
  loading?: boolean;
  error?: string | null;
  onOpenAssistant: (prompt?: string) => void;
  className?: string;
}

const severityVariant = {
  info: 'info', success: 'success', warning: 'warning', danger: 'danger',
} as const;

interface SeverityCount {
  severity: keyof typeof severityVariant;
  count: number;
}

/** Title-cases a severity for the axis and tooltip, e.g. `danger` → `Danger`. */
const severityLabel = (value: string): string =>
  value.charAt(0).toUpperCase() + value.slice(1);

/** Embeddable summary of the existing Nvidia NIM assistant briefing response. */
export function FinancialBriefingCard({
  briefing, loading = false, error = null, onOpenAssistant, className = '',
}: FinancialBriefingCardProps) {
  const insights = briefing?.insights ?? [];
  const counts = (['info', 'success', 'warning', 'danger'] as const).map((severity) => ({
    severity,
    count: insights.filter((item) => item.severity === severity).length,
  }));
  const hasContent = Boolean(briefing && (briefing.summary || insights.length > 0));
  const chartLabel = `Briefing insights by severity: ${counts
    .filter((item) => item.count > 0)
    .map((item) => `${item.count} ${item.severity}`)
    .join(', ')}`;

  return (
    <Card elevation="soft" className={`relative overflow-hidden ${className}`}>
      <div className="pointer-events-none absolute inset-0 bg-gold-sheen" aria-hidden />
      <CardHeader className="relative flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-gold" aria-hidden />
          Financial briefing
        </CardTitle>
        <Badge variant="gold" size="sm">AI insights</Badge>
      </CardHeader>
      <CardContent className="relative space-y-4" aria-live="polite" aria-busy={loading}>
        {loading ? (
          <div className="space-y-3" role="status" aria-label="Loading financial briefing">
            <div className="skeleton h-4 w-3/4 rounded-sm" />
            <div className="skeleton h-16 w-full rounded-sm" />
            <div className="skeleton h-16 w-full rounded-sm" />
          </div>
        ) : error ? (
          <div role="alert" className="rounded-md border border-danger/30 bg-danger-soft p-4">
            <p className="text-sm font-semibold text-danger">Briefing unavailable</p>
            <p className="mt-1 text-xs text-foreground-secondary">{error}</p>
            <Button className="mt-3" size="sm" variant="secondary" onClick={() => onOpenAssistant('Summarize treasury health and any anomaly alerts.')}>Ask assistant</Button>
          </div>
        ) : !hasContent ? (
          <div className="rounded-md border border-border bg-surface/70 p-4">
            <Bot className="mb-2 h-5 w-5 text-gold" aria-hidden />
            <p className="text-sm font-semibold">No briefing available yet</p>
            <p className="mt-1 text-xs text-foreground-secondary">Open the assistant to generate a treasury summary and spending insights.</p>
            <Button className="mt-3" size="sm" variant="secondary" onClick={() => onOpenAssistant('Generate today\'s financial briefing.')}>Generate briefing</Button>
          </div>
        ) : (
          <>
            <div>
              <p className="font-display text-base font-semibold">{briefing?.greeting || 'Executive summary'}</p>
              <p className="mt-1 whitespace-pre-line text-xs leading-relaxed text-foreground-secondary">{briefing?.summary}</p>
            </div>
            {insights.length > 0 && (
              <>
                <ChartFrame label={chartLabel} height={80}>
                  <BarChart data={counts} margin={{ top: 4, right: 2, left: 2, bottom: 0 }}>
                    <XAxis
                      dataKey="severity"
                      axisLine={false}
                      tickLine={false}
                      tick={{ ...axisTick, fontSize: 10 }}
                      tickFormatter={severityLabel}
                    />
                    <RechartsTooltip
                      cursor={{ fill: 'rgb(var(--surface-secondary) / 0.5)' }}
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const row = (payload as TooltipPayloadItem[])[0]?.payload as
                          | SeverityCount
                          | undefined;
                        if (!row) return null;
                        const share = Math.round((row.count / insights.length) * 100);
                        return (
                          <ChartTooltipShell label={severityLabel(row.severity)}>
                            <span className="tabular font-medium text-foreground">
                              {row.count} {row.count === 1 ? 'insight' : 'insights'}
                            </span>
                            <span className="text-foreground-secondary">
                              {share}% of this briefing
                            </span>
                          </ChartTooltipShell>
                        );
                      }}
                    />
                    <Bar
                      dataKey="count"
                      fill="rgb(var(--gold))"
                      radius={[3, 3, 0, 0]}
                      maxBarSize={32}
                      isAnimationActive={false}
                    />
                  </BarChart>
                </ChartFrame>
                <ul className="space-y-2.5" aria-label="Briefing insights">
                  {insights.slice(0, 3).map((insight) => (
                    <li key={insight.id} className="rounded-sm border border-border bg-surface/60 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-xs font-medium">{insight.title}</p>
                        <Badge variant={severityVariant[insight.severity]} size="sm">{insight.severity}</Badge>
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-foreground-secondary">{insight.detail}</p>
                      {insight.severity === 'danger' || insight.severity === 'warning' ? (
                        <p className="mt-2 inline-flex items-center gap-1 text-xs text-warning"><AlertTriangle className="h-3 w-3" aria-hidden />Review recommended</p>
                      ) : <TrendingUp className="mt-2 h-3 w-3 text-success" aria-hidden />}
                      <button type="button" onClick={() => onOpenAssistant(`Explain this financial insight: ${insight.title}. ${insight.detail}`)}
                        className="mt-2 flex items-center gap-1 text-xs font-semibold text-gold-strong hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                        Discuss insight <ArrowRight className="h-3 w-3" aria-hidden />
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
            <div className="flex flex-wrap gap-2">
              {(briefing?.suggestedActions ?? []).slice(0, 2).map((action) => (
                <Button key={action.prompt} variant="outline" size="sm" onClick={() => onOpenAssistant(action.prompt)}>{action.label}</Button>
              ))}
            </div>
          </>
        )}
        <Button variant="secondary" size="sm" className="w-full" onClick={() => onOpenAssistant('Summarize treasury health, spending anomalies, and recommendations.')}>
          Open full assistant <ArrowRight className="ml-1 h-3 w-3" aria-hidden />
        </Button>
        {briefing?.generatedAt && !loading && <p className="text-center text-xs text-foreground-muted">Generated {new Date(briefing.generatedAt).toLocaleString()}</p>}
      </CardContent>
    </Card>
  );
}
