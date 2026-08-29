'use client';

import { PageHeader } from '@/components/dashboard/page-header';
import { QueryBoundary } from '@/components/dashboard/query-boundary';
import { KeyValue, SectionLabel } from '@/components/dashboard/stat-card';
import { DataTable, type Column } from '@/components/dashboard/data-table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Avatar } from '@/components/ui/avatar';
import { EmptyState } from '@/components/ui/empty-state';
import { VaultIllustration } from '@/components/illustrations';
import { useCurrentUser, useOrganizations, useTeam } from '@/hooks/use-queries';
import { formatDate, formatRelativeTime } from '@/lib/format';
import type { OrgPlan, User, UserRole } from '@/types/domain';
import { PageTransition } from '@/components/ui/motion';
import { CredentialVault } from '@/features/vault/CredentialVault';
import { RBACManagementView } from '@/features/settings/RBACManagementView';

type BadgeVariant = NonNullable<BadgeProps['variant']>;

const roleVariant: Record<UserRole, BadgeVariant> = {
  owner: 'gold',
  admin: 'info',
  finance: 'success',
  developer: 'neutral',
  auditor: 'warning',
  viewer: 'outline',
};

const userStatusVariant: Record<User['status'], BadgeVariant> = {
  active: 'success',
  invited: 'warning',
  disabled: 'neutral',
};

const planVariant: Record<OrgPlan, BadgeVariant> = {
  starter: 'neutral',
  growth: 'info',
  scale: 'success',
  enterprise: 'gold',
};

const titleCase = (value: string): string =>
  value.charAt(0).toUpperCase() + value.slice(1);

const teamColumns: Column<User>[] = [
  {
    header: 'Member',
    cell: (u) => (
      <div className="flex items-center gap-2.5">
        <Avatar name={u.name} src={u.avatar} size="sm" />
        <span className="font-medium text-foreground">{u.name}</span>
      </div>
    ),
  },
  {
    header: 'Email',
    hideOnMobile: true,
    cell: (u) => <span className="text-foreground-secondary">{u.email}</span>,
  },
  {
    header: 'Role',
    cell: (u) => (
      <Badge variant={roleVariant[u.role]} size="sm">
        {titleCase(u.role)}
      </Badge>
    ),
  },
  {
    header: 'Status',
    cell: (u) => (
      <Badge variant={userStatusVariant[u.status]} size="sm" dot>
        {titleCase(u.status)}
      </Badge>
    ),
  },
  {
    header: 'Last login',
    align: 'right',
    hideOnMobile: true,
    cell: (u) => (
      <span className="text-2xs text-foreground-muted">
        {u.lastLogin ? formatRelativeTime(u.lastLogin) : '—'}
      </span>
    ),
  },
];

export default function SettingsPage() {
  const user = useCurrentUser();
  const organizations = useOrganizations();
  const team = useTeam();

  return (
    <PageTransition className="space-y-8">
      <PageHeader
        eyebrow="Workspace"
        title="Settings"
        description="Your profile, your organization and the people who share your command center."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <QueryBoundary
          query={user}
          loading={<div className="skeleton h-64 w-full rounded-card" />}
        >
          {(data) => (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Profile</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="flex items-center gap-4">
                  <Avatar name={data.name} src={data.avatar} size="lg" />
                  <div className="space-y-1">
                    <p className="text-base font-medium text-foreground">{data.name}</p>
                    <p className="text-xs text-foreground-secondary">{data.email}</p>
                    <div className="flex items-center gap-1.5 pt-1">
                      <Badge variant={roleVariant[data.role]} size="sm">
                        {titleCase(data.role)}
                      </Badge>
                      <Badge variant={userStatusVariant[data.status]} size="sm" dot>
                        {titleCase(data.status)}
                      </Badge>
                    </div>
                  </div>
                </div>
                <dl className="grid gap-x-6 gap-y-5 sm:grid-cols-2">
                  <KeyValue label="Email">{data.email}</KeyValue>
                  <KeyValue label="Role">{titleCase(data.role)}</KeyValue>
                  <KeyValue label="Status">{titleCase(data.status)}</KeyValue>
                  <KeyValue label="Last login">
                    {data.lastLogin ? formatRelativeTime(data.lastLogin) : '—'}
                  </KeyValue>
                  <KeyValue label="Member since">{formatDate(data.createdAt)}</KeyValue>
                </dl>
              </CardContent>
            </Card>
          )}
        </QueryBoundary>

        <QueryBoundary
          query={organizations}
          loading={<div className="skeleton h-64 w-full rounded-card" />}
          isEmpty={(data) => data.length === 0}
          empty={
            <EmptyState
              compact
              illustration={<VaultIllustration />}
              title="No organization"
              description="You're not a member of any organization yet."
            />
          }
        >
          {(data) => {
            const org = data[0];
            if (!org) return null;
            return (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Organization</CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="flex items-center gap-4">
                    <Avatar name={org.name} src={org.logo} size="lg" shape="squircle" />
                    <div className="space-y-1">
                      <p className="text-base font-medium text-foreground">{org.name}</p>
                      <p className="font-mono text-xs text-foreground-muted">{org.slug}</p>
                      <div className="flex items-center gap-1.5 pt-1">
                        <Badge variant={planVariant[org.plan]} size="sm">
                          {titleCase(org.plan)}
                        </Badge>
                        <Badge
                          variant={org.status === 'active' ? 'success' : 'danger'}
                          size="sm"
                          dot
                        >
                          {titleCase(org.status)}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  {org.description && (
                    <p className="text-xs leading-relaxed text-foreground-secondary">
                      {org.description}
                    </p>
                  )}
                  <dl className="grid gap-x-6 gap-y-5 sm:grid-cols-2">
                    <KeyValue label="Plan">{titleCase(org.plan)}</KeyValue>
                    <KeyValue label="Status">{titleCase(org.status)}</KeyValue>
                    <KeyValue label="Slug" mono>
                      {org.slug}
                    </KeyValue>
                    <KeyValue label="Created">{formatDate(org.createdAt)}</KeyValue>
                  </dl>
                </CardContent>
              </Card>
            );
          }}
        </QueryBoundary>
      </div>

      <div className="space-y-4">
        <SectionLabel>Team</SectionLabel>
        <QueryBoundary
          query={team}
          loading={<div className="skeleton h-64 w-full rounded-card" />}
          isEmpty={(data) => data.length === 0}
          empty={
            <EmptyState
              compact
              illustration={<VaultIllustration />}
              title="No team members"
              description="Invite teammates to collaborate on governance and approvals."
            />
          }
        >
          {(data) => (
            <DataTable<User> columns={teamColumns} rows={data} rowKey={(u) => u.id} />
          )}
        </QueryBoundary>
      </div>

      <div className="pt-6 border-t border-border space-y-4">
        <RBACManagementView />
      </div>

      <div className="pt-6 border-t border-border space-y-4">
        <CredentialVault />
      </div>
    </PageTransition>
  );
}
