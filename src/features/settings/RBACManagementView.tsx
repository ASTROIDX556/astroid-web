'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import {
  ShieldCheck,
  UserPlus,
  Users,
  Trash2,
  Lock,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog } from '@/components/ui/dialog';
import { Avatar } from '@/components/ui/avatar';
import type { OrgMember, UserRole, PermissionKey, RolePermissionMatrix, PermissionDefinition } from './types';

const PERMISSION_DEFINITIONS: PermissionDefinition[] = [
  { key: 'policy_edit', label: 'Edit Policy Rules', description: 'Create and update automated spending policies and thresholds.' },
  { key: 'budget_allocate', label: 'Department Budgeting', description: 'Allocate and cap budget envelopes across departments & agents.' },
  { key: 'tx_sign', label: 'Multi-Sig Execution', description: 'Approve and co-sign high-value Stellar on-chain transactions.' },
  { key: 'agent_configure', label: 'Manage AI Agents', description: 'Provision, configure, and rotate API keys for autonomous agents.' },
  { key: 'audit_view', label: 'View Audit Logs', description: 'Access immutable audit trail and historical decision logs.' },
  { key: 'member_manage', label: 'Manage Team & RBAC', description: 'Invite new organization members and edit role permissions.' },
];

const INITIAL_MATRIX: RolePermissionMatrix = {
  admin: {
    policy_edit: true,
    budget_allocate: true,
    tx_sign: true,
    agent_configure: true,
    audit_view: true,
    member_manage: true,
  },
  approver: {
    policy_edit: false,
    budget_allocate: true,
    tx_sign: true,
    agent_configure: false,
    audit_view: true,
    member_manage: false,
  },
  operator: {
    policy_edit: true,
    budget_allocate: false,
    tx_sign: false,
    agent_configure: true,
    audit_view: true,
    member_manage: false,
  },
  viewer: {
    policy_edit: false,
    budget_allocate: false,
    tx_sign: false,
    agent_configure: false,
    audit_view: true,
    member_manage: false,
  },
};

const INITIAL_MEMBERS: OrgMember[] = [
  { id: 'm-1', name: 'Alex Rivera', email: 'alex@astroid.fi', role: 'admin', status: 'active', lastActiveAt: new Date().toISOString() },
  { id: 'm-2', name: 'Elena Rostova', email: 'elena@astroid.fi', role: 'approver', status: 'active', lastActiveAt: new Date(Date.now() - 1000 * 60 * 30).toISOString() },
  { id: 'm-3', name: 'Marcus Vance', email: 'marcus@astroid.fi', role: 'operator', status: 'active', lastActiveAt: new Date(Date.now() - 1000 * 60 * 120).toISOString() },
  { id: 'm-4', name: 'Sarah Chen', email: 'sarah@astroid.fi', role: 'viewer', status: 'invited', lastActiveAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString() },
];

const inviteSchema = z.object({
  name: z.string().trim().min(2, 'Name is required'),
  email: z.string().trim().email('Valid email is required'),
  role: z.enum(['admin', 'approver', 'operator', 'viewer']),
});

type InviteFormValues = z.infer<typeof inviteSchema>;

export function RBACManagementView() {
  const [members, setMembers] = useState<OrgMember[]>(INITIAL_MEMBERS);
  const [matrix, setMatrix] = useState<RolePermissionMatrix>(INITIAL_MATRIX);
  const [isInviteOpen, setIsInviteOpen] = useState(false);

  const inviteForm = useForm<InviteFormValues>({
    resolver: zodResolver(inviteSchema),
    defaultValues: {
      name: '',
      email: '',
      role: 'operator',
    },
  });

  // Toggle permission matrix checkbox
  const togglePermission = (role: UserRole, perm: PermissionKey) => {
    // Admin permissions remain locked for security
    if (role === 'admin' && perm === 'member_manage') {
      toast.warning('Admin role must retain member management permissions');
      return;
    }

    setMatrix((prev) => ({
      ...prev,
      [role]: {
        ...prev[role],
        [perm]: !prev[role][perm],
      },
    }));
    toast.success(`Updated permission matrix for role "${role.toUpperCase()}"`);
  };

  // Change member role with Last Admin Guard Rule
  const handleRoleChange = (memberId: string, newRole: UserRole) => {
    const member = members.find((m) => m.id === memberId);
    if (!member) return;

    // Check last admin guard rule
    if (member.role === 'admin' && newRole !== 'admin') {
      const adminCount = members.filter((m) => m.role === 'admin' && m.status === 'active').length;
      if (adminCount <= 1) {
        toast.error('Operation rejected: Cannot demote the last remaining Organization Admin');
        return;
      }
    }

    setMembers((prev) =>
      prev.map((m) => (m.id === memberId ? { ...m, role: newRole } : m))
    );
    toast.success(`Updated ${member.name}'s role to ${newRole.toUpperCase()}`);
  };

  // Remove member with Last Admin Guard Rule
  const handleRemoveMember = (memberId: string) => {
    const member = members.find((m) => m.id === memberId);
    if (!member) return;

    if (member.role === 'admin') {
      const adminCount = members.filter((m) => m.role === 'admin' && m.status === 'active').length;
      if (adminCount <= 1) {
        toast.error('Operation rejected: Cannot remove the last remaining Organization Admin');
        return;
      }
    }

    setMembers((prev) => prev.filter((m) => m.id !== memberId));
    toast.error(`Removed ${member.name} from organization`);
  };

  // Invite form submit
  const handleInviteSubmit = (values: InviteFormValues) => {
    const newMember: OrgMember = {
      id: `m-${Date.now()}`,
      name: values.name,
      email: values.email,
      role: values.role,
      status: 'invited',
      lastActiveAt: new Date().toISOString(),
    };

    setMembers((prev) => [...prev, newMember]);
    setIsInviteOpen(false);
    inviteForm.reset();
    toast.success(`Invitation sent to ${values.email}`);
  };

  return (
    <div className="space-y-8">
      {/* Section Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <h3 className="font-display text-lg font-semibold tracking-tight flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-gold" />
            <span>Role-Based Access Control & Member Management</span>
          </h3>
          <p className="text-xs text-foreground-secondary">
            Configure permission matrices across roles and manage organization team members.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsInviteOpen(true)}
          className="flex items-center gap-1.5 rounded-button bg-gold px-3.5 py-2 text-xs font-bold text-surface-dark shadow-gold hover:bg-gold-light transition-colors"
        >
          <UserPlus className="h-4 w-4" />
          <span>Invite Member</span>
        </button>
      </div>

      {/* Member Management Table */}
      <Card className="overflow-hidden border border-border">
        <div className="p-4 border-b border-border bg-surface-secondary/40 flex items-center justify-between">
          <h4 className="font-semibold text-foreground text-sm flex items-center gap-2">
            <Users className="h-4 w-4 text-gold" />
            <span>Organization Members ({members.length})</span>
          </h4>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-surface-secondary border-b border-border text-foreground-muted uppercase tracking-wider font-semibold">
              <tr>
                <th className="px-4 py-3">Member</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Role Assignment</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {members.map((member) => (
                <tr key={member.id} className="hover:bg-surface-secondary/50 transition-colors">
                  <td className="px-4 py-3.5 align-middle">
                    <div className="flex items-center gap-2.5">
                      <Avatar name={member.name} size="sm" />
                      <span className="font-semibold text-foreground">{member.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 align-middle font-mono text-foreground-secondary">
                    {member.email}
                  </td>
                  <td className="px-4 py-3.5 align-middle">
                    <Badge
                      variant={member.status === 'active' ? 'success' : 'warning'}
                      size="sm"
                      dot
                      className="capitalize"
                    >
                      {member.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3.5 align-middle">
                    <select
                      value={member.role}
                      onChange={(e) => handleRoleChange(member.id, e.target.value as UserRole)}
                      className="rounded-button border border-border bg-surface px-2.5 py-1 text-xs text-foreground font-semibold focus:border-gold focus:outline-none"
                    >
                      <option value="admin">Admin</option>
                      <option value="approver">Approver</option>
                      <option value="operator">Operator</option>
                      <option value="viewer">Viewer</option>
                    </select>
                  </td>
                  <td className="px-4 py-3.5 align-middle text-right">
                    <button
                      type="button"
                      onClick={() => handleRemoveMember(member.id)}
                      className="text-foreground-muted hover:text-rose-400 transition-colors p-1"
                      title="Remove member"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Editable Permission Matrix Grid */}
      <Card className="overflow-hidden border border-border p-5 space-y-4">
        <div>
          <h4 className="font-semibold text-foreground text-sm flex items-center gap-2">
            <Lock className="h-4 w-4 text-gold" />
            <span>Role Permission Matrix</span>
          </h4>
          <p className="text-2xs text-foreground-muted">
            Toggle specific capability permissions assigned to each user role.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-surface-secondary border-b border-border text-foreground-muted uppercase tracking-wider font-semibold">
              <tr>
                <th className="px-4 py-3 w-1/3">Permission Capability</th>
                <th className="px-4 py-3 text-center">Admin</th>
                <th className="px-4 py-3 text-center">Approver</th>
                <th className="px-4 py-3 text-center">Operator</th>
                <th className="px-4 py-3 text-center">Viewer</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {PERMISSION_DEFINITIONS.map((perm) => (
                <tr key={perm.key} className="hover:bg-surface-secondary/40 transition-colors">
                  <td className="px-4 py-3 align-middle space-y-0.5">
                    <p className="font-semibold text-foreground">{perm.label}</p>
                    <p className="text-2xs text-foreground-muted">{perm.description}</p>
                  </td>
                  {(['admin', 'approver', 'operator', 'viewer'] as UserRole[]).map((role) => {
                    const isChecked = matrix[role][perm.key];

                    return (
                      <td key={`${role}-${perm.key}`} className="px-4 py-3 align-middle text-center">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => togglePermission(role, perm.key)}
                          className="h-4 w-4 rounded border-border text-gold focus:ring-gold cursor-pointer"
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Modal: Invite Member */}
      {isInviteOpen && (
        <Dialog open={isInviteOpen} onClose={() => setIsInviteOpen(false)} title="Invite Team Member" size="sm">
          <form onSubmit={inviteForm.handleSubmit(handleInviteSubmit)} className="space-y-4 pt-2">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground">Full Name</label>
              <input
                type="text"
                placeholder="e.g. Dr. Sarah Chen"
                {...inviteForm.register('name')}
                className="w-full rounded-button border border-border bg-surface px-3 py-2 text-xs text-foreground focus:border-gold focus:outline-none"
              />
              {inviteForm.formState.errors.name && (
                <p className="text-2xs text-rose-400">{inviteForm.formState.errors.name.message}</p>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground">Email Address</label>
              <input
                type="email"
                placeholder="sarah@astroid.fi"
                {...inviteForm.register('email')}
                className="w-full rounded-button border border-border bg-surface px-3 py-2 text-xs font-mono text-foreground focus:border-gold focus:outline-none"
              />
              {inviteForm.formState.errors.email && (
                <p className="text-2xs text-rose-400">{inviteForm.formState.errors.email.message}</p>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground">Initial Role</label>
              <select
                {...inviteForm.register('role')}
                className="w-full rounded-button border border-border bg-surface px-3 py-2 text-xs text-foreground focus:border-gold focus:outline-none font-medium"
              >
                <option value="operator">Operator (Agent & Policy Manager)</option>
                <option value="approver">Approver (Multi-Sig Co-Signer)</option>
                <option value="admin">Admin (Full Control)</option>
                <option value="viewer">Viewer (Read-Only Audit)</option>
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-border">
              <button
                type="button"
                onClick={() => setIsInviteOpen(false)}
                className="rounded-button border border-border bg-surface px-3 py-1.5 text-xs text-foreground-secondary hover:text-foreground"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-button bg-gold px-4 py-1.5 text-xs font-bold text-surface-dark shadow-gold hover:bg-gold-light"
              >
                Send Invitation
              </button>
            </div>
          </form>
        </Dialog>
      )}
    </div>
  );
}
