'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import {
  ShieldCheck,
  Key,
  Plus,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Info,
  Users,
  Settings,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Input, FormField } from '@/components/ui/input';
import type { SignerKey, ThresholdConfig } from './types';

const STELLAR_KEY_REGEX = /^G[A-Z2-7]{55}$/;

const signerSchema = z.object({
  publicKey: z
    .string()
    .trim()
    .min(1, 'Public key is required')
    .regex(STELLAR_KEY_REGEX, 'Invalid Stellar public key format (must start with G, 56 characters)'),
  name: z.string().trim().min(2, 'Signer name is required (min 2 characters)').max(50, 'Name too long'),
  weight: z.coerce.number().int('Weight must be a whole number').min(1, 'Weight must be at least 1').max(255, 'Weight cannot exceed 255'),
});

const thresholdSchema = z.object({
  lowThreshold: z.coerce.number().int().min(0).max(255),
  medThreshold: z.coerce.number().int().min(1).max(255),
  highThreshold: z.coerce.number().int().min(1).max(255),
}).refine((data) => data.lowThreshold <= data.medThreshold, {
  message: 'Low threshold must be <= Medium threshold',
  path: ['lowThreshold'],
}).refine((data) => data.medThreshold <= data.highThreshold, {
  message: 'Medium threshold must be <= High threshold',
  path: ['medThreshold'],
});

type SignerFormValues = z.infer<typeof signerSchema>;
type ThresholdFormValues = z.infer<typeof thresholdSchema>;

const INITIAL_SIGNERS: SignerKey[] = [
  { id: 'sig-1', publicKey: 'GABC1234567890ABCDEF1234567890ABCDEF1234567890AB', name: 'Treasury Admin (Alex)', weight: 3, addedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString() },
  { id: 'sig-2', publicKey: 'GDEF1234567890ABCDEF1234567890ABCDEF1234567890CD', name: 'Finance Officer (Elena)', weight: 2, addedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 14).toISOString() },
  { id: 'sig-3', publicKey: 'GGHI1234567890ABCDEF1234567890ABCDEF1234567890EF', name: 'Security Officer (Marcus)', weight: 2, addedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString() },
];

const INITIAL_THRESHOLDS: ThresholdConfig = {
  lowThreshold: 2,
  medThreshold: 3,
  highThreshold: 4,
};

export function SignerThresholdConfig() {
  const [signers, setSigners] = useState<SignerKey[]>(INITIAL_SIGNERS);
  const [thresholds, setThresholds] = useState<ThresholdConfig>(INITIAL_THRESHOLDS);
  const [isAddSignerOpen, setIsAddSignerOpen] = useState(false);

  const signerForm = useForm<SignerFormValues>({
    resolver: zodResolver(signerSchema),
    defaultValues: {
      publicKey: '',
      name: '',
      weight: 1,
    },
  });

  const thresholdForm = useForm<ThresholdFormValues>({
    resolver: zodResolver(thresholdSchema),
    defaultValues: INITIAL_THRESHOLDS,
  });

  const totalWeight = useMemo(() => signers.reduce((sum, s) => sum + s.weight, 0), [signers]);

  const minSignersForHigh = useMemo(() => {
    if (signers.length === 0) return Infinity;
    const sortedWeights = [...signers].sort((a, b) => b.weight - a.weight);
    let accumulated = 0;
    let count = 0;
    for (const signer of sortedWeights) {
      accumulated += signer.weight;
      count++;
      if (accumulated >= thresholds.highThreshold) return count;
    }
    return Infinity;
  }, [signers, thresholds.highThreshold]);

  const quorumStatus = useMemo(() => {
    const reachable = {
      low: totalWeight >= thresholds.lowThreshold,
      med: totalWeight >= thresholds.medThreshold,
      high: totalWeight >= thresholds.highThreshold,
    };

    return { reachable, minSignersForHigh };
  }, [totalWeight, thresholds, minSignersForHigh]);

  const handleAddSigner = useCallback((values: SignerFormValues) => {
    const existingKey = signers.find((s) => s.publicKey === values.publicKey);
    if (existingKey) {
      toast.error('This public key is already registered as a signer');
      return;
    }

    const newSigner: SignerKey = {
      id: `sig-${Date.now()}`,
      publicKey: values.publicKey,
      name: values.name,
      weight: values.weight,
      addedAt: new Date().toISOString(),
    };

    setSigners((prev) => [...prev, newSigner]);
    setIsAddSignerOpen(false);
    signerForm.reset();
    toast.success(`Added signer "${values.name}" with weight ${values.weight}`);
  }, [signers, signerForm]);

  const handleRemoveSigner = useCallback((signerId: string) => {
    const signer = signers.find((s) => s.id === signerId);
    if (!signer) return;

    const newTotalWeight = totalWeight - signer.weight;
    if (newTotalWeight < thresholds.highThreshold) {
      toast.error(`Cannot remove signer: total weight (${newTotalWeight}) would be below high threshold (${thresholds.highThreshold})`);
      return;
    }

    setSigners((prev) => prev.filter((s) => s.id !== signerId));
    toast.success(`Removed signer "${signer.name}"`);
  }, [signers, totalWeight, thresholds.highThreshold]);

  const handleUpdateWeight = useCallback((signerId: string, newWeight: number) => {
    if (newWeight < 1 || newWeight > 255) {
      toast.error('Weight must be between 1 and 255');
      return;
    }

    const signer = signers.find((s) => s.id === signerId);
    if (!signer) return;

    const weightDiff = newWeight - signer.weight;
    const newTotalWeight = totalWeight + weightDiff;

    if (newTotalWeight < thresholds.highThreshold) {
      toast.error(`Cannot update weight: total weight (${newTotalWeight}) would be below high threshold (${thresholds.highThreshold})`);
      return;
    }

    setSigners((prev) =>
      prev.map((s) => (s.id === signerId ? { ...s, weight: newWeight } : s))
    );
    toast.success(`Updated weight for "${signer.name}" to ${newWeight}`);
  }, [signers, totalWeight, thresholds.highThreshold]);

  const handleThresholdSubmit = useCallback((values: ThresholdFormValues) => {
    if (totalWeight < values.highThreshold) {
      toast.error(`Cannot set high threshold above total signer weight (${totalWeight})`);
      return;
    }
    setThresholds(values);
    toast.success('Threshold configuration updated successfully');
  }, [totalWeight]);

  return (
    <div className="space-y-8" role="region" aria-label="Multi-Signature Signer Threshold Configuration">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <h3 className="font-display text-lg font-semibold tracking-tight flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-gold" aria-hidden />
            <span>Multi-Sig Signer Threshold Configuration</span>
          </h3>
          <p className="text-xs text-foreground-secondary">
            Manage authorized keys, weight assignments, and signature approval quotas for treasury operations.
          </p>
        </div>
        <Button
          variant="gold"
          size="sm"
          onClick={() => setIsAddSignerOpen(true)}
          leftIcon={<Plus className="h-4 w-4" aria-hidden />}
        >
          Add Signer
        </Button>
      </div>

      <Card className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="font-semibold text-foreground text-sm flex items-center gap-2">
            <Settings className="h-4 w-4 text-gold" aria-hidden />
            <span>Threshold Configuration</span>
          </h4>
          <Badge variant="neutral" size="sm">
            Total Weight: {totalWeight}
          </Badge>
        </div>

        <form onSubmit={thresholdForm.handleSubmit(handleThresholdSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <FormField
              label="Low Threshold"
              hint="Minimum weight for low-value operations"
              error={thresholdForm.formState.errors.lowThreshold?.message}
              required
            >
              <Input
                type="number"
                min={0}
                max={255}
                {...thresholdForm.register('lowThreshold')}
                invalid={!!thresholdForm.formState.errors.lowThreshold}
                aria-label="Low threshold value"
              />
            </FormField>

            <FormField
              label="Medium Threshold"
              hint="Minimum weight for standard transactions"
              error={thresholdForm.formState.errors.medThreshold?.message}
              required
            >
              <Input
                type="number"
                min={1}
                max={255}
                {...thresholdForm.register('medThreshold')}
                invalid={!!thresholdForm.formState.errors.medThreshold}
                aria-label="Medium threshold value"
              />
            </FormField>

            <FormField
              label="High Threshold"
              hint="Minimum weight for high-value operations"
              error={thresholdForm.formState.errors.highThreshold?.message}
              required
            >
              <Input
                type="number"
                min={1}
                max={255}
                {...thresholdForm.register('highThreshold')}
                invalid={!!thresholdForm.formState.errors.highThreshold}
                aria-label="High threshold value"
              />
            </FormField>
          </div>

          <div className="flex justify-end">
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={!thresholdForm.formState.isDirty}
            >
              Update Thresholds
            </Button>
          </div>
        </form>

        <div className="pt-4 border-t border-border space-y-3">
          <h5 className="text-xs font-semibold text-foreground-secondary uppercase tracking-wider">
            Threshold Status
          </h5>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <ThresholdStatusCard
              label="Low"
              threshold={thresholds.lowThreshold}
              totalWeight={totalWeight}
              reachable={quorumStatus.reachable.low}
            />
            <ThresholdStatusCard
              label="Medium"
              threshold={thresholds.medThreshold}
              totalWeight={totalWeight}
              reachable={quorumStatus.reachable.med}
            />
            <ThresholdStatusCard
              label="High"
              threshold={thresholds.highThreshold}
              totalWeight={totalWeight}
              reachable={quorumStatus.reachable.high}
            />
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden border border-border">
        <div className="p-4 border-b border-border bg-surface-secondary/40 flex items-center justify-between">
          <h4 className="font-semibold text-foreground text-sm flex items-center gap-2">
            <Users className="h-4 w-4 text-gold" aria-hidden />
            <span>Authorized Signers ({signers.length})</span>
          </h4>
        </div>

        {signers.length === 0 ? (
          <div className="p-8 text-center">
            <Key className="h-12 w-12 text-foreground-muted mx-auto mb-3" aria-hidden />
            <p className="text-sm text-foreground-secondary">No signers configured</p>
            <p className="text-xs text-foreground-muted mt-1">Add authorized signers to enable multi-sig protection</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse" role="grid" aria-label="Authorized signers list">
              <thead className="bg-surface-secondary border-b border-border text-foreground-muted uppercase tracking-wider font-semibold">
                <tr>
                  <th className="px-4 py-3">Signer</th>
                  <th className="px-4 py-3">Public Key</th>
                  <th className="px-4 py-3 text-center">Weight</th>
                  <th className="px-4 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {signers.map((signer) => (
                  <SignerRow
                    key={signer.id}
                    signer={signer}
                    onRemove={handleRemoveSigner}
                    onUpdateWeight={handleUpdateWeight}
                    canRemove={totalWeight - signer.weight >= thresholds.highThreshold}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="p-4 border-t border-border bg-surface-secondary/20">
          <div className="flex items-start gap-2">
            <Info className="h-4 w-4 text-info mt-0.5 shrink-0" aria-hidden />
            <p className="text-xs text-foreground-secondary">
              <strong>Security Note:</strong> Removing a signer or reducing weights may prevent reaching required thresholds.
              Ensure the total weight remains above your highest threshold to maintain operational capability.
            </p>
          </div>
        </div>
      </Card>

      <Dialog open={isAddSignerOpen} onClose={() => setIsAddSignerOpen(false)} title="Add New Signer" size="sm">
          <form onSubmit={signerForm.handleSubmit(handleAddSigner)} className="space-y-4 pt-2">
            <FormField
              label="Signer Name"
              hint="Display name for this signer"
              error={signerForm.formState.errors.name?.message}
              required
            >
              <Input
                type="text"
                placeholder="e.g. Treasury Admin (Alex)"
                {...signerForm.register('name')}
                invalid={!!signerForm.formState.errors.name}
                aria-label="Signer name"
              />
            </FormField>

            <FormField
              label="Stellar Public Key"
              hint="Ed25519 public key starting with G (56 characters)"
              error={signerForm.formState.errors.publicKey?.message}
              required
            >
              <Input
                type="text"
                placeholder="GABC1234567890ABCDEF1234567890ABCDEF1234567890AB"
                {...signerForm.register('publicKey')}
                invalid={!!signerForm.formState.errors.publicKey}
                aria-label="Stellar public key"
                className="font-mono"
              />
            </FormField>

            <FormField
              label="Weight"
              hint="Signature weight (1-255)"
              error={signerForm.formState.errors.weight?.message}
              required
            >
              <Input
                type="number"
                min={1}
                max={255}
                {...signerForm.register('weight')}
                invalid={!!signerForm.formState.errors.weight}
                aria-label="Signer weight"
              />
            </FormField>

            <div className="flex justify-end gap-2 pt-3 border-t border-border">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setIsAddSignerOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" variant="gold" size="sm">
                Add Signer
              </Button>
            </div>
          </form>
        </Dialog>
    </div>
  );
}

interface ThresholdStatusCardProps {
  label: string;
  threshold: number;
  totalWeight: number;
  reachable: boolean;
}

function ThresholdStatusCard({ label, threshold, totalWeight, reachable }: ThresholdStatusCardProps) {
  const progress = Math.min((totalWeight / threshold) * 100, 100);

  return (
    <div className="rounded-button border border-border bg-surface p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-foreground">{label}</span>
        {reachable ? (
          <CheckCircle2 className="h-4 w-4 text-success" aria-hidden />
        ) : (
          <AlertTriangle className="h-4 w-4 text-warning" aria-hidden />
        )}
      </div>
      <div className="text-2xs text-foreground-muted">
        Threshold: {threshold} / Total: {totalWeight}
      </div>
      <div className="h-1.5 bg-surface-secondary rounded-full overflow-hidden" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label={`${label} threshold progress`}>
        <div
          className={`h-full transition-all duration-300 ${reachable ? 'bg-success' : 'bg-warning'}`}
          style={{ width: `${progress}%` }}
        />
      </div>
      <p className={`text-2xs ${reachable ? 'text-success' : 'text-warning'}`}>
        {reachable ? 'Quorum reachable' : 'Insufficient weight'}
      </p>
    </div>
  );
}

interface SignerRowProps {
  signer: SignerKey;
  onRemove: (id: string) => void;
  onUpdateWeight: (id: string, weight: number) => void;
  canRemove: boolean;
}

function SignerRow({ signer, onRemove, onUpdateWeight, canRemove }: SignerRowProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [weightInput, setWeightInput] = useState(signer.weight.toString());

  const handleSaveWeight = () => {
    const newWeight = parseInt(weightInput, 10);
    if (isNaN(newWeight)) {
      setWeightInput(signer.weight.toString());
      setIsEditing(false);
      return;
    }
    onUpdateWeight(signer.id, newWeight);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSaveWeight();
    } else if (e.key === 'Escape') {
      setWeightInput(signer.weight.toString());
      setIsEditing(false);
    }
  };

  return (
    <tr className="hover:bg-surface-secondary/50 transition-colors">
      <td className="px-4 py-3 align-middle">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-gold-soft flex items-center justify-center">
            <Key className="h-4 w-4 text-gold" aria-hidden />
          </div>
          <div>
            <p className="font-semibold text-foreground">{signer.name}</p>
            <p className="text-2xs text-foreground-muted font-mono">
              Added {new Date(signer.addedAt).toLocaleDateString()}
            </p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3 align-middle">
        <code className="text-xs font-mono text-foreground-secondary bg-surface-secondary px-2 py-1 rounded-xs">
          {signer.publicKey.slice(0, 8)}...{signer.publicKey.slice(-4)}
        </code>
      </td>
      <td className="px-4 py-3 align-middle text-center">
        {isEditing ? (
          <div className="flex items-center justify-center gap-1">
            <input
              type="number"
              min={1}
              max={255}
              value={weightInput}
              onChange={(e) => setWeightInput(e.target.value)}
              onBlur={handleSaveWeight}
              onKeyDown={handleKeyDown}
              className="w-16 h-8 rounded-xs border border-border bg-surface px-2 text-xs text-center text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              autoFocus
              aria-label={`Update weight for ${signer.name}`}
            />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-xs bg-surface-secondary hover:bg-surface-secondary/80 transition-colors"
            aria-label={`Edit weight for ${signer.name}, current weight: ${signer.weight}`}
          >
            <span className="font-mono font-bold text-foreground">{signer.weight}</span>
          </button>
        )}
      </td>
      <td className="px-4 py-3 align-middle text-center">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => onRemove(signer.id)}
          disabled={!canRemove}
          aria-label={`Remove signer ${signer.name}`}
          className={canRemove ? 'text-danger hover:text-danger' : 'text-foreground-muted cursor-not-allowed'}
        >
          <Trash2 className="h-4 w-4" aria-hidden />
        </Button>
      </td>
    </tr>
  );
}

export default SignerThresholdConfig;
