'use client';

import { Plus, Webhook as WebhookIcon } from 'lucide-react';
import { PageHeader } from '@/components/dashboard/page-header';
import { QueryBoundary } from '@/components/dashboard/query-boundary';
import { SectionLabel } from '@/components/dashboard/stat-card';
import { DataTable, type Column } from '@/components/dashboard/data-table';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ChartIllustration } from '@/components/illustrations';
import { useApiKeys, useWebhooks } from '@/hooks/use-queries';
import { formatDate, formatNumber, formatRelativeTime } from '@/lib/format';
import type { ApiKey } from '@/types/domain';
import { PageTransition } from '@/components/ui/motion';

const keyColumns: Column<ApiKey>[] = [
  {
    header: 'Name',
    cell: (k) => <span className="font-medium text-foreground">{k.name}</span>,
  },
  {
    // Only the public prefix is ever shown — the secret itself is never returned
    // by the API and must never be rendered.
    header: 'Key',
    cell: (k) => (
      <span className="font-mono text-xs text-foreground-secondary">
        {k.prefix}
        <span className="text-foreground-muted">••••••••••••</span>
      </span>
    ),
  },
  {
    header: 'Permissions',
    hideOnMobile: true,
    cell: (k) => (
      <Badge variant="neutral" size="sm">
        {formatNumber(k.permissions.length)} scopes
      </Badge>
    ),
  },
  {
    header: 'Last used',
    hideOnMobile: true,
    cell: (k) => (
      <span className="text-2xs text-foreground-muted">
        {k.lastUsed ? formatRelativeTime(k.lastUsed) : '—'}
      </span>
    ),
  },
  {
    header: 'Created',
    align: 'right',
    hideOnMobile: true,
    cell: (k) => (
      <span className="text-2xs text-foreground-muted">{formatDate(k.createdAt)}</span>
    ),
  },
  {
    header: 'Expires',
    align: 'right',
    hideOnMobile: true,
    cell: (k) => (
      <span className="text-2xs text-foreground-muted">
        {k.expiresAt ? formatDate(k.expiresAt) : 'Never'}
      </span>
    ),
  },
];

export default function DevelopersPage() {
  const apiKeys = useApiKeys();
  const webhooks = useWebhooks();

  return (
    <PageTransition className="space-y-8">
      <PageHeader
        eyebrow="Workspace"
        title="Developers"
        description="API keys and webhooks for programmatic access. Secrets are shown once at creation and never again."
        actions={
          <Button variant="gold" leftIcon={<Plus className="h-4 w-4" />}>
            New API key
          </Button>
        }
      />

      <div className="space-y-4">
        <SectionLabel>API keys</SectionLabel>
        <QueryBoundary
          query={apiKeys}
          loading={<div className="skeleton h-64 w-full rounded-card" />}
          isEmpty={(data) => data.length === 0}
          empty={
            <EmptyState
              compact
              illustration={<ChartIllustration />}
              title="No API keys"
              description="Create a key to start calling the Astroid API from your own services."
            />
          }
        >
          {(data) => (
            <DataTable<ApiKey> columns={keyColumns} rows={data} rowKey={(k) => k.id} />
          )}
        </QueryBoundary>
      </div>

      <div className="space-y-4">
        <SectionLabel>Webhooks</SectionLabel>
        <QueryBoundary
          query={webhooks}
          loading={<div className="skeleton h-40 w-full rounded-card" />}
          isEmpty={(data) => data.length === 0}
          empty={
            <EmptyState
              compact
              illustration={<ChartIllustration />}
              title="No webhooks"
              description="Register an endpoint to receive real-time events as your agents act."
            />
          }
        >
          {(data) => (
            <div className="space-y-4">
              {data.map((hook) => (
                <Card key={hook.id}>
                  <CardContent className="pt-5">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-surface-secondary text-foreground-secondary">
                            <WebhookIcon className="h-4 w-4" aria-hidden />
                          </span>
                          <p className="truncate font-mono text-xs text-foreground">
                            {hook.url}
                          </p>
                        </div>
                        <div className="gap-1.5 flex flex-wrap">
                          {hook.events.map((event) => (
                            <Badge key={event} variant="outline" size="sm">
                              {event}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <Badge
                          variant={hook.enabled ? 'success' : 'neutral'}
                          size="sm"
                          dot
                        >
                          {hook.enabled ? 'Enabled' : 'Disabled'}
                        </Badge>
                        <span className="text-2xs text-foreground-muted">
                          {formatDate(hook.createdAt)}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </QueryBoundary>
      </div>
    </PageTransition>
  );
}
