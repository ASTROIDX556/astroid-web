'use client';

import Link from 'next/link';
import {
  AlertTriangle,
  ArrowUpRight,
  Ban,
  BellRing,
  CheckCircle2,
  PiggyBank,
  ShieldAlert,
  Wallet as WalletIcon,
  XCircle,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { PageHeader } from '@/components/dashboard/page-header';
import { QueryBoundary } from '@/components/dashboard/query-boundary';
import { SectionLabel } from '@/components/dashboard/stat-card';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SkeletonCard } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { BellIllustration } from '@/components/illustrations';
import { useNotifications } from '@/hooks/use-queries';
import { formatRelativeTime } from '@/lib/format';
import { cn } from '@/lib/cn';
import type { NotificationType } from '@/types/domain';
import { PageTransition } from '@/components/ui/motion';

const typeStyle: Record<NotificationType, { icon: LucideIcon; ring: string }> = {
  budget_exceeded: { icon: PiggyBank, ring: 'bg-danger-soft text-danger' },
  proposal_created: { icon: BellRing, ring: 'bg-info-soft text-info' },
  proposal_approved: { icon: CheckCircle2, ring: 'bg-success-soft text-success' },
  proposal_rejected: { icon: XCircle, ring: 'bg-danger-soft text-danger' },
  wallet_funded: { icon: WalletIcon, ring: 'bg-success-soft text-success' },
  payment_failed: { icon: Ban, ring: 'bg-danger-soft text-danger' },
  policy_violation: { icon: ShieldAlert, ring: 'bg-warning-soft text-warning' },
  risk_alert: { icon: AlertTriangle, ring: 'bg-warning-soft text-warning' },
};

export default function NotificationsPage() {
  const notifications = useNotifications();

  return (
    <PageTransition className="space-y-8">
      <PageHeader
        eyebrow="Workspace"
        title="Notifications"
        description="Budget alerts, approval requests and risk events — routed to every channel you've connected."
      />

      <QueryBoundary
        query={notifications}
        loading={
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        }
        isEmpty={(data) => data.length === 0}
        empty={
          <EmptyState
            illustration={<BellIllustration />}
            title="No notifications"
            description="You're all caught up. Alerts about budgets, approvals and risk will surface here."
          />
        }
      >
        {(data) => {
          const unread = data.filter((n) => !n.read).length;
          return (
            <div className="space-y-6">
              <SectionLabel>
                {unread > 0 ? `${unread} unread` : 'All caught up'} · {data.length}{' '}
                total
              </SectionLabel>
              <Card className="divide-y divide-border p-0">
                {data.map((n) => {
                  const style = typeStyle[n.type];
                  const Icon = style.icon;
                  const row = (
                    <div
                      className={cn(
                        'flex items-start gap-3 px-5 py-4 transition-colors',
                        n.href && 'hover:bg-surface-secondary/50',
                        !n.read && 'bg-gold-soft/20',
                      )}
                    >
                      <span
                        className={cn(
                          'grid h-9 w-9 shrink-0 place-items-center rounded-md',
                          style.ring,
                        )}
                      >
                        <Icon className="h-4 w-4" aria-hidden />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-medium text-foreground">
                            {n.title}
                          </p>
                          {!n.read && (
                            <Badge variant="gold" size="sm">
                              New
                            </Badge>
                          )}
                          <Badge variant="outline" size="sm" className="capitalize">
                            {n.channel}
                          </Badge>
                        </div>
                        <p className="mt-0.5 text-xs leading-relaxed text-foreground-secondary">
                          {n.body}
                        </p>
                        <p className="mt-1 text-2xs text-foreground-muted">
                          {formatRelativeTime(n.createdAt)}
                        </p>
                      </div>
                      {n.href && (
                        <ArrowUpRight
                          className="mt-1 h-4 w-4 shrink-0 text-foreground-muted"
                          aria-hidden
                        />
                      )}
                    </div>
                  );
                  return n.href ? (
                    <Link key={n.id} href={n.href} className="block">
                      {row}
                    </Link>
                  ) : (
                    <div key={n.id}>{row}</div>
                  );
                })}
              </Card>
            </div>
          );
        }}
      </QueryBoundary>
    </PageTransition>
  );
}
