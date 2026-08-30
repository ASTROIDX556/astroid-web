'use client';

import { AlertTriangle, CheckCircle2, UploadCloud } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FormField } from '@/components/ui/input';
import { usePolicySimulation } from '@/features/policies/usePolicySimulation';

export function TransactionSimulator() {
  const { rules, activeRuleId, setActiveRuleId, xdr, setXdr, result, parsedOperations } =
    usePolicySimulation();

  const onUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : '';
      setXdr(text || xdr);
    };
    reader.readAsText(file);
  };

  return (
    <Card className="overflow-hidden border border-border bg-surface/70">
      <CardHeader className="border-b border-border bg-surface/60">
        <CardTitle className="flex items-center gap-2 text-sm text-foreground">
          <CheckCircle2 className="h-4 w-4 text-gold" aria-hidden />
          Stellar transaction simulator
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5 pt-5">
        <div className="grid gap-4 md:grid-cols-[220px_1fr]">
          <FormField label="Active policy" htmlFor="policy-rule" className="gap-2">
            <select
              id="policy-rule"
              value={activeRuleId}
              onChange={(event) => setActiveRuleId(event.target.value)}
              className="h-10 w-full rounded-sm border border-border bg-surface px-3 text-sm text-foreground outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Select an active policy rule"
            >
              {rules.map((rule) => (
                <option key={rule.id} value={rule.id}>
                  {rule.name}
                </option>
              ))}
            </select>
          </FormField>

          <FormField label="XDR payload" htmlFor="xdr-payload" className="gap-2">
            <textarea
              id="xdr-payload"
              value={xdr}
              onChange={(event) => setXdr(event.target.value)}
              aria-label="Transaction XDR payload"
              className="min-h-[120px] w-full rounded-sm border border-border bg-surface px-3 py-2.5 text-xs text-foreground outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="Paste a Stellar XDR payload here"
            />
          </FormField>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button variant="gold" type="button" onClick={() => setXdr(xdr)}>
            Evaluate policy
          </Button>

          <label className="inline-flex cursor-pointer items-center gap-2 rounded-sm border border-border bg-surface px-3 py-2 text-xs font-medium text-foreground-secondary transition-colors hover:bg-surface-secondary">
            <UploadCloud className="h-3.5 w-3.5" aria-hidden />
            Upload XDR
            <input type="file" accept=".xdr,.txt,.base64" className="sr-only" onChange={onUpload} />
          </label>
        </div>

        <div className="rounded-card border border-border bg-surface p-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={result.passed ? 'success' : 'danger'} dot>
              {result.passed ? 'Compliant' : 'Violates policy'}
            </Badge>
            <span className="text-xs text-foreground-secondary">{result.summary}</span>
          </div>

          <div className="mt-4 space-y-3">
            {result.violations.length > 0 ? (
              result.violations.map((violation) => (
                <div
                  key={`${violation.ruleId}-${violation.message}`}
                  className="flex items-start gap-2 rounded-sm border border-border bg-surface-secondary px-3 py-2"
                >
                  <AlertTriangle
                    className={`mt-0.5 h-4 w-4 ${
                      violation.severity === 'danger' ? 'text-danger' : 'text-warning'
                    }`}
                    aria-hidden
                  />
                  <div>
                    <p className="text-xs font-medium text-foreground">{violation.name}</p>
                    <p className="text-2xs text-foreground-secondary">{violation.message}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="flex items-center gap-2 rounded-sm border border-dashed border-border bg-surface-secondary px-3 py-2 text-xs text-foreground-secondary">
                <CheckCircle2 className="h-4 w-4 text-success" aria-hidden />
                No policy violations detected for the active rule.
              </div>
            )}
          </div>

          <div className="mt-5">
            <p className="mb-2 text-2xs font-medium uppercase tracking-wide text-foreground-secondary">
              Parsed operation blocks
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {parsedOperations.map((operation, index) => (
                <div
                  key={`${operation.type}-${index}`}
                  className="rounded-sm border border-border bg-surface-secondary p-3"
                >
                  <p className="text-xs font-medium text-foreground">{operation.type}</p>
                  <p className="mt-1 text-2xs text-foreground-secondary">
                    {operation.asset} · {operation.amount}
                  </p>
                  <p className="mt-1 text-[10px] text-foreground-muted">{operation.source}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
