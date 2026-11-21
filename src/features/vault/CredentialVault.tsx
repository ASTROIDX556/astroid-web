'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Eye, EyeOff, Plus, RefreshCw, Trash2, Lock, Bot } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog } from '@/components/ui/dialog';
import { formatRelativeTime } from '@/lib/format';
import { MOCK_CREDENTIALS } from './mock-data';
import {
  credentialFormSchema,
  rotateCredentialSchema,
  type CredentialFormValues,
  type RotateCredentialValues,
} from './schema';
import type { AgentCredential, CredentialType } from './types';

const CREDENTIAL_TYPE_BADGES: Record<
  CredentialType,
  'gold' | 'info' | 'success' | 'neutral'
> = {
  api_key: 'gold',
  secret_key: 'info',
  bearer_token: 'success',
  webhook_secret: 'neutral',
};

export function CredentialVault() {
  const [credentials, setCredentials] = useState<AgentCredential[]>(MOCK_CREDENTIALS);
  const [visibleSecrets, setVisibleSecrets] = useState<Record<string, boolean>>({});
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [rotateTarget, setRotateTarget] = useState<AgentCredential | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<AgentCredential | null>(null);

  // Form setup for adding credentials
  const addForm = useForm<CredentialFormValues>({
    resolver: zodResolver(credentialFormSchema),
    defaultValues: {
      name: '',
      type: 'api_key',
      service: '',
      assignedAgentId: 'agt-soroban-relayer',
      secretValue: '',
    },
  });

  // Form setup for rotating credentials
  const rotateForm = useForm<RotateCredentialValues>({
    resolver: zodResolver(rotateCredentialSchema),
    defaultValues: {
      newSecretValue: '',
      confirmRotation: undefined,
    },
  });

  // Toggle secret mask
  const toggleVisibility = (id: string) => {
    setVisibleSecrets((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Add Credential submit
  const handleAddSubmit = (values: CredentialFormValues) => {
    const masked = `${values.secretValue.slice(0, 7)}_••••••••••••${values.secretValue.slice(-4)}`;
    const newCred: AgentCredential = {
      id: `cred-${Date.now()}`,
      name: values.name,
      type: values.type,
      service: values.service,
      assignedAgentId: values.assignedAgentId,
      assignedAgentName:
        values.assignedAgentId === 'agt-soroban-relayer'
          ? 'Soroban Relayer Sentinel'
          : 'Nvidia NIM Analyst Agent',
      maskedValue: masked,
      rawSecret: values.secretValue,
      createdAt: new Date().toISOString(),
      lastAccessedAt: new Date().toISOString(),
      lastRotatedAt: new Date().toISOString(),
      status: 'active',
    };

    setCredentials((prev) => [newCred, ...prev]);
    setIsAddOpen(false);
    addForm.reset();
    toast.success('Agent credential encrypted and stored securely');
  };

  // Rotate Credential submit
  const handleRotateSubmit = (values: RotateCredentialValues) => {
    if (!rotateTarget) return;

    const newSecret = values.newSecretValue;
    const masked = `${newSecret.slice(0, 7)}_••••••••••••${newSecret.slice(-4)}`;

    setCredentials((prev) =>
      prev.map((c) =>
        c.id === rotateTarget.id
          ? {
              ...c,
              maskedValue: masked,
              rawSecret: newSecret,
              lastRotatedAt: new Date().toISOString(),
              status: 'rotated',
            }
          : c,
      ),
    );

    setRotateTarget(null);
    rotateForm.reset();
    toast.success(`Credential "${rotateTarget.name}" rotated successfully`);
  };

  // Revoke Credential
  const handleConfirmRevoke = () => {
    if (!revokeTarget) return;

    setCredentials((prev) =>
      prev.map((c) => (c.id === revokeTarget.id ? { ...c, status: 'revoked' } : c)),
    );

    setRevokeTarget(null);
    toast.error(`Credential "${revokeTarget.name}" has been revoked`);
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <h3 className="flex items-center gap-2 font-display text-lg font-semibold tracking-tight">
            <Lock className="h-5 w-5 text-gold" />
            <span>Encrypted Agent Credential Vault</span>
          </h3>
          <p className="text-xs text-foreground-secondary">
            Manage, rotate, and audit encrypted API keys and secrets for autonomous AI
            agents.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsAddOpen(true)}
          className="gap-1.5 px-3.5 text-surface-dark hover:bg-gold-light flex items-center rounded-button bg-gold py-2 text-xs font-bold shadow-gold transition-colors"
        >
          <Plus className="h-4 w-4" />
          <span>Add Credential</span>
        </button>
      </div>

      {/* Credential List */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {credentials.map((cred) => {
          const isVisible = visibleSecrets[cred.id];
          const isRevoked = cred.status === 'revoked';

          return (
            <Card
              key={cred.id}
              className={`space-y-4 p-4 transition-all ${
                isRevoked
                  ? 'border-dashed bg-surface-secondary/40 opacity-60'
                  : 'hover:border-border-strong'
              }`}
            >
              {/* Card Header */}
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1">
                  <Badge
                    variant={CREDENTIAL_TYPE_BADGES[cred.type]}
                    size="sm"
                    className="font-mono uppercase"
                  >
                    {cred.type.replace('_', ' ')}
                  </Badge>
                  <h4 className="text-sm font-semibold leading-snug text-foreground">
                    {cred.name}
                  </h4>
                  <p className="text-2xs text-foreground-muted">{cred.service}</p>
                </div>
                {isRevoked ? (
                  <Badge variant="danger" size="sm">
                    Revoked
                  </Badge>
                ) : (
                  <Badge variant="success" size="sm" dot>
                    Active
                  </Badge>
                )}
              </div>

              {/* Secret Value & Masking */}
              <div className="space-y-1">
                <label className="text-2xs font-bold uppercase tracking-wider text-foreground-muted">
                  Secret Key Payload
                </label>
                <div className="bg-surface-dark flex items-center justify-between gap-2 rounded-button border border-border px-3 py-2 font-mono text-xs text-emerald-400">
                  <span className="truncate">
                    {isVisible && cred.rawSecret ? cred.rawSecret : cred.maskedValue}
                  </span>
                  {!isRevoked && (
                    <button
                      type="button"
                      onClick={() => toggleVisibility(cred.id)}
                      className="shrink-0 text-foreground-muted transition-colors hover:text-foreground"
                      title={isVisible ? 'Mask secret' : 'Show secret'}
                    >
                      {isVisible ? (
                        <EyeOff className="h-3.5 w-3.5" />
                      ) : (
                        <Eye className="h-3.5 w-3.5" />
                      )}
                    </button>
                  )}
                </div>
              </div>

              {/* Agent & Audit Info */}
              <div className="space-y-1 border-t border-border/50 pt-2 text-2xs text-foreground-muted">
                <div className="gap-1.5 flex items-center">
                  <Bot className="h-3.5 w-3.5 shrink-0 text-gold" />
                  <span className="truncate">
                    Agent:{' '}
                    <strong className="text-foreground">
                      {cred.assignedAgentName}
                    </strong>
                  </span>
                </div>
                <div className="pt-0.5 flex justify-between">
                  <span>Last used: {formatRelativeTime(cred.lastAccessedAt)}</span>
                  <span>Rotated: {formatRelativeTime(cred.lastRotatedAt)}</span>
                </div>
              </div>

              {/* Actions */}
              {!isRevoked && (
                <div className="flex items-center justify-end gap-2 border-t border-border/50 pt-2">
                  <button
                    type="button"
                    onClick={() => setRotateTarget(cred)}
                    className="flex items-center gap-1 text-2xs font-semibold text-foreground-secondary transition-colors hover:text-gold"
                  >
                    <RefreshCw className="h-3 w-3" />
                    <span>Rotate</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setRevokeTarget(cred)}
                    className="flex items-center gap-1 text-2xs font-semibold text-rose-400 hover:underline"
                  >
                    <Trash2 className="h-3 w-3" />
                    <span>Revoke</span>
                  </button>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {/* Modal: Add New Credential */}
      {isAddOpen && (
        <Dialog
          open={isAddOpen}
          onClose={() => setIsAddOpen(false)}
          title="Add Encrypted Agent Credential"
          size="sm"
        >
          <form
            onSubmit={addForm.handleSubmit(handleAddSubmit)}
            className="space-y-4 pt-2"
          >
            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground">
                Credential Name
              </label>
              <input
                type="text"
                placeholder="e.g. Horizon Production API Token"
                {...addForm.register('name')}
                className="w-full rounded-button border border-border bg-surface px-3 py-2 text-xs text-foreground focus:border-gold focus:outline-none"
              />
              {addForm.formState.errors.name && (
                <p className="text-2xs text-rose-400">
                  {addForm.formState.errors.name.message}
                </p>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">Type</label>
                <select
                  {...addForm.register('type')}
                  className="w-full rounded-button border border-border bg-surface px-3 py-2 text-xs text-foreground focus:border-gold focus:outline-none"
                >
                  <option value="api_key">API Key</option>
                  <option value="secret_key">Secret Key</option>
                  <option value="bearer_token">Bearer Token</option>
                  <option value="webhook_secret">Webhook Secret</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">
                  Service Provider
                </label>
                <input
                  type="text"
                  placeholder="e.g. Stellar Horizon RPC"
                  {...addForm.register('service')}
                  className="w-full rounded-button border border-border bg-surface px-3 py-2 text-xs text-foreground focus:border-gold focus:outline-none"
                />
                {addForm.formState.errors.service && (
                  <p className="text-2xs text-rose-400">
                    {addForm.formState.errors.service.message}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground">
                Assigned Agent
              </label>
              <select
                {...addForm.register('assignedAgentId')}
                className="w-full rounded-button border border-border bg-surface px-3 py-2 text-xs text-foreground focus:border-gold focus:outline-none"
              >
                <option value="agt-soroban-relayer">
                  Soroban Relayer Sentinel (agt-soroban-relayer)
                </option>
                <option value="agt-nim-briefing">
                  Nvidia NIM Analyst Agent (agt-nim-briefing)
                </option>
                <option value="agt-amm-arb">
                  Soroban DEX Arbitrageur (agt-amm-arb)
                </option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground">
                Secret Payload / Key
              </label>
              <input
                type="password"
                placeholder="Paste sensitive secret payload here..."
                {...addForm.register('secretValue')}
                className="w-full rounded-button border border-border bg-surface px-3 py-2 font-mono text-xs text-foreground focus:border-gold focus:outline-none"
              />
              {addForm.formState.errors.secretValue && (
                <p className="text-2xs text-rose-400">
                  {addForm.formState.errors.secretValue.message}
                </p>
              )}
            </div>

            <div className="flex justify-end gap-2 border-t border-border pt-2">
              <button
                type="button"
                onClick={() => setIsAddOpen(false)}
                className="py-1.5 rounded-button border border-border bg-surface px-3 text-xs text-foreground-secondary hover:text-foreground"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="py-1.5 text-surface-dark hover:bg-gold-light rounded-button bg-gold px-4 text-xs font-bold shadow-gold"
              >
                Encrypt & Save Key
              </button>
            </div>
          </form>
        </Dialog>
      )}

      {/* Modal: Rotate Credential */}
      {rotateTarget && (
        <Dialog
          open={Boolean(rotateTarget)}
          onClose={() => setRotateTarget(null)}
          title={`Rotate Credential — ${rotateTarget.name}`}
          size="sm"
        >
          <form
            onSubmit={rotateForm.handleSubmit(handleRotateSubmit)}
            className="space-y-4 pt-2"
          >
            <p className="text-xs text-foreground-secondary">
              Rotating this key will generate a new encrypted secret entry and
              invalidate previous sessions for{' '}
              <strong className="text-foreground">
                {rotateTarget.assignedAgentName}
              </strong>
              .
            </p>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground">
                New Secret Payload
              </label>
              <input
                type="password"
                placeholder="Enter new secret key payload..."
                {...rotateForm.register('newSecretValue')}
                className="w-full rounded-button border border-border bg-surface px-3 py-2 font-mono text-xs text-foreground focus:border-gold focus:outline-none"
              />
              {rotateForm.formState.errors.newSecretValue && (
                <p className="text-2xs text-rose-400">
                  {rotateForm.formState.errors.newSecretValue.message}
                </p>
              )}
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="confirmRotateCheck"
                {...rotateForm.register('confirmRotation')}
                className="h-4 w-4 rounded border-border text-gold focus:ring-gold"
              />
              <label
                htmlFor="confirmRotateCheck"
                className="text-xs font-medium text-foreground"
              >
                I confirm credential rotation for agent {rotateTarget.assignedAgentName}
              </label>
            </div>
            {rotateForm.formState.errors.confirmRotation && (
              <p className="text-2xs text-rose-400">
                {rotateForm.formState.errors.confirmRotation.message}
              </p>
            )}

            <div className="flex justify-end gap-2 border-t border-border pt-3">
              <button
                type="button"
                onClick={() => setRotateTarget(null)}
                className="py-1.5 rounded-button border border-border bg-surface px-3 text-xs text-foreground-secondary hover:text-foreground"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="py-1.5 text-surface-dark hover:bg-gold-light rounded-button bg-gold px-4 text-xs font-bold shadow-gold"
              >
                Rotate Key
              </button>
            </div>
          </form>
        </Dialog>
      )}

      {/* Modal: Confirm Revoke */}
      {revokeTarget && (
        <Dialog
          open={Boolean(revokeTarget)}
          onClose={() => setRevokeTarget(null)}
          title="Revoke Credential Confirmation"
          size="sm"
        >
          <div className="space-y-4 pt-2 text-xs">
            <p className="text-foreground-secondary">
              Are you sure you want to revoke{' '}
              <strong className="text-foreground">{revokeTarget.name}</strong>? This
              action is immediate and will prevent{' '}
              <strong className="text-foreground">
                {revokeTarget.assignedAgentName}
              </strong>{' '}
              from calling service {revokeTarget.service}.
            </p>

            <div className="flex justify-end gap-2 border-t border-border pt-3">
              <button
                type="button"
                onClick={() => setRevokeTarget(null)}
                className="py-1.5 rounded-button border border-border bg-surface px-3 text-xs text-foreground-secondary hover:text-foreground"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRevoke}
                className="py-1.5 rounded-button bg-rose-500 px-4 text-xs font-bold text-white shadow-sm hover:bg-rose-600"
              >
                Revoke Immediately
              </button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
}
