'use client';

import { useCallback, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import type { ColumnDef } from '@tanstack/react-table';
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  KeyRound,
  Pencil,
  Plus,
  RotateCcw,
  Send,
  ShieldCheck,
  Trash2,
  Undo2,
  Users,
  X,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { DataTable } from '@/components/ui/DataTable';
import { Dialog } from '@/components/ui/dialog';
import { FormField, Input, Select } from '@/components/ui/input';
import { useCurrentUser } from '@/hooks/use-queries';
import { formatRelativeTime, truncateHash } from '@/lib/format';
import { signerStatus } from '@/lib/status';
import type {
  OrgSigner,
  SignerKind,
  SignerProposal,
  SignerProposalChange,
  SignerStatus,
  SignerThresholds,
  SignerWeightAdjustment,
} from '@/types/multisig';
import {
  addSignerSchema,
  adjustWeightSchema,
  thresholdSchema,
  type AddSignerFormValues,
  type AdjustWeightFormValues,
  type ThresholdFormValues,
} from './schema';

/** What a table row has staged for the next proposal. */
type RowStage = 'none' | 'added' | 'weight' | 'removal';

interface SignerTableRow {
  id: string;
  publicKey: string;
  label: string;
  /** Effective (possibly staged) weight. */
  weight: number;
  /** Last committed weight — only rendered when a change is staged. */
  previousWeight: number;
  kind: SignerKind;
  status: SignerStatus;
  addedAt: string;
  staged: RowStage;
}

const INITIAL_THRESHOLDS: SignerThresholds = { low: 3, medium: 5, high: 8 };

const INITIAL_SIGNERS: OrgSigner[] = [
  {
    id: 'sgn_master',
    publicKey: 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H',
    label: 'Treasury master key',
    weight: 3,
    kind: 'master',
    status: 'active',
    addedAt: '2026-02-18T08:30:00.000Z',
  },
  {
    id: 'sgn_finance',
    publicKey: 'GCEZWKCA5VLDNRLN3RPRJMRZOX3Z6G5CHCGSNFHEYVXM3XOJMDS674JZ',
    label: 'Finance controller',
    weight: 2,
    kind: 'co-signer',
    status: 'active',
    addedAt: '2026-04-02T11:15:00.000Z',
  },
  {
    id: 'sgn_security',
    publicKey: 'GDQNY3PBOJOKYZSRMK2S7LHHGWZIUISD4QORETLMXEWXBI7KFZZMKTL3',
    label: 'Security officer',
    weight: 2,
    kind: 'co-signer',
    status: 'active',
    addedAt: '2026-05-21T14:05:00.000Z',
  },
  {
    id: 'sgn_ops',
    publicKey: 'GA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJVSGZ',
    label: 'Ops approver',
    weight: 1,
    kind: 'co-signer',
    status: 'active',
    addedAt: '2026-06-30T09:45:00.000Z',
  },
  {
    id: 'sgn_auditor',
    publicKey: 'GAB2CD3EF4G5H6I7JKLMNOPQRST2U3V4W5X6YZABC2D3E4F5G6H7I2J3',
    label: 'External auditor',
    weight: 1,
    kind: 'co-signer',
    status: 'proposed',
    addedAt: '2026-08-14T16:20:00.000Z',
  },
  {
    id: 'sgn_rotation',
    publicKey: 'GZYXWV2UT3S4R5Q6P7ONM2L3K4J5IHG6F7E5D4C3B2A7Z6Y5X4W3V2U7',
    label: 'Rotation slot (pre-auth)',
    weight: 1,
    kind: 'pre-auth',
    status: 'active',
    addedAt: '2026-09-08T12:00:00.000Z',
  },
];

const ADD_SIGNER_DEFAULTS: AddSignerFormValues = {
  label: '',
  publicKey: '',
  weight: 1,
  kind: 'co-signer',
};

const ADJUST_WEIGHT_DEFAULTS: AdjustWeightFormValues = { weight: 1, reason: '' };

/** Small delay so the confirmation modal can show its pending state. */
const wait = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(() => resolve(), ms);
  });

/**
 * Signer management dashboard for an organization multi-signature Stellar
 * account.
 *
 * Administrators review the signer set, stage additions / weight adjustments /
 * removals and threshold edits, then push the whole batch as a single proposal
 * that the co-signers approve.
 */
export function SignerManagement() {
  const currentUser = useCurrentUser();

  const [signers, setSigners] = useState<OrgSigner[]>(INITIAL_SIGNERS);
  const [thresholds, setThresholds] = useState<SignerThresholds>(INITIAL_THRESHOLDS);

  const [stagedAdditions, setStagedAdditions] = useState<OrgSigner[]>([]);
  const [stagedAdjustments, setStagedAdjustments] = useState<SignerWeightAdjustment[]>([]);
  const [stagedRemovals, setStagedRemovals] = useState<string[]>([]);
  const [stagedThresholds, setStagedThresholds] = useState<SignerThresholds | null>(null);

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [adjustTarget, setAdjustTarget] = useState<SignerTableRow | null>(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastProposal, setLastProposal] = useState<SignerProposal | null>(null);

  const addForm = useForm<AddSignerFormValues>({
    resolver: zodResolver(addSignerSchema),
    defaultValues: ADD_SIGNER_DEFAULTS,
  });

  const adjustForm = useForm<AdjustWeightFormValues>({
    resolver: zodResolver(adjustWeightSchema),
    defaultValues: ADJUST_WEIGHT_DEFAULTS,
  });

  const thresholdForm = useForm<ThresholdFormValues>({
    resolver: zodResolver(thresholdSchema),
    defaultValues: INITIAL_THRESHOLDS,
  });

  // -- derived state ---------------------------------------------------------

  const rows = useMemo<SignerTableRow[]>(() => {
    const removalSet = new Set(stagedRemovals);

    const committed: SignerTableRow[] = signers.map((signer): SignerTableRow => {
      const adjustment = stagedAdjustments.find((item) => item.signerId === signer.id);
      if (removalSet.has(signer.id)) {
        return { ...signer, previousWeight: signer.weight, staged: 'removal' };
      }
      if (adjustment) {
        return {
          ...signer,
          weight: adjustment.proposedWeight,
          previousWeight: signer.weight,
          staged: 'weight',
        };
      }
      return { ...signer, previousWeight: signer.weight, staged: 'none' };
    });

    const additions: SignerTableRow[] = stagedAdditions.map(
      (signer): SignerTableRow => ({
        ...signer,
        previousWeight: 0,
        staged: 'added',
      }),
    );

    return [...committed, ...additions];
  }, [signers, stagedAdditions, stagedAdjustments, stagedRemovals]);

  const totalWeight = useMemo(
    () =>
      rows.reduce((sum, row) => (row.staged === 'removal' ? sum : sum + row.weight), 0),
    [rows],
  );

  const effectiveThresholds = stagedThresholds ?? thresholds;

  const thresholdsChanged =
    stagedThresholds !== null &&
    (stagedThresholds.low !== thresholds.low ||
      stagedThresholds.medium !== thresholds.medium ||
      stagedThresholds.high !== thresholds.high);

  const changes = useMemo<SignerProposalChange[]>(() => {
    const list: SignerProposalChange[] = [];

    for (const signer of stagedAdditions) {
      list.push({
        kind: 'add',
        signerId: signer.id,
        label: signer.label,
        publicKey: signer.publicKey,
        weight: signer.weight,
      });
    }

    for (const adjustment of stagedAdjustments) {
      const signer = signers.find((item) => item.id === adjustment.signerId);
      list.push({
        kind: 'adjust',
        signerId: adjustment.signerId,
        label: signer?.label ?? 'Signer',
        currentWeight: adjustment.currentWeight,
        proposedWeight: adjustment.proposedWeight,
        reason: adjustment.reason,
      });
    }

    for (const signerId of stagedRemovals) {
      const signer = signers.find((item) => item.id === signerId);
      if (signer) {
        list.push({
          kind: 'remove',
          signerId: signer.id,
          label: signer.label,
          publicKey: signer.publicKey,
        });
      }
    }

    if (thresholdsChanged && stagedThresholds) {
      list.push({ kind: 'thresholds', previous: thresholds, next: stagedThresholds });
    }

    return list;
  }, [
    signers,
    stagedAdditions,
    stagedAdjustments,
    stagedRemovals,
    stagedThresholds,
    thresholds,
    thresholdsChanged,
  ]);

  const changeCount = changes.length;

  // -- add signer ------------------------------------------------------------

  const openAddDialog = useCallback(() => setIsAddOpen(true), []);

  const closeAddDialog = useCallback(() => setIsAddOpen(false), []);

  const handleAddSigner = useCallback(
    (values: AddSignerFormValues) => {
      const alreadyPresent =
        signers.some((item) => item.publicKey === values.publicKey) ||
        stagedAdditions.some((item) => item.publicKey === values.publicKey);

      if (alreadyPresent) {
        toast.error('That public key already belongs to the signer set');
        return;
      }

      const signer: OrgSigner = {
        id: `sgn_${Date.now().toString(36)}`,
        publicKey: values.publicKey,
        label: values.label,
        weight: values.weight,
        kind: values.kind,
        status: 'proposed',
        addedAt: new Date().toISOString(),
      };

      setStagedAdditions((prev) => [...prev, signer]);
      setIsAddOpen(false);
      addForm.reset(ADD_SIGNER_DEFAULTS);
      toast.success(`Staged "${values.label}" as a proposed signer`);
    },
    [signers, stagedAdditions, addForm],
  );

  // -- weight adjustments ----------------------------------------------------

  const openAdjustDialog = useCallback(
    (row: SignerTableRow) => {
      setAdjustTarget(row);
      adjustForm.reset({ weight: row.weight, reason: '' });
    },
    [adjustForm],
  );

  const closeAdjustDialog = useCallback(() => {
    setAdjustTarget(null);
    adjustForm.reset(ADJUST_WEIGHT_DEFAULTS);
  }, [adjustForm]);

  const handleAdjustWeight = useCallback(
    (values: AdjustWeightFormValues) => {
      if (!adjustTarget) return;

      const committed = signers.find((item) => item.id === adjustTarget.id);
      const nextTotal = totalWeight - adjustTarget.weight + values.weight;
      const highThreshold = (stagedThresholds ?? thresholds).high;

      if (nextTotal < highThreshold) {
        toast.error(
          `Cannot stage this change: total weight would fall to ${nextTotal}, below the high threshold of ${highThreshold}`,
        );
        return;
      }

      const adjustment: SignerWeightAdjustment = {
        signerId: adjustTarget.id,
        currentWeight: committed ? committed.weight : adjustTarget.weight,
        proposedWeight: values.weight,
        reason: values.reason,
      };

      setStagedAdjustments((prev) => [
        ...prev.filter((item) => item.signerId !== adjustment.signerId),
        adjustment,
      ]);
      setAdjustTarget(null);
      adjustForm.reset(ADJUST_WEIGHT_DEFAULTS);
      toast.success(`Staged a weight change for "${adjustTarget.label}"`);
    },
    [adjustTarget, signers, totalWeight, stagedThresholds, thresholds, adjustForm],
  );

  const revertWeight = useCallback((signerId: string) => {
    setStagedAdjustments((prev) => prev.filter((item) => item.signerId !== signerId));
    toast.info('Reverted the staged weight change');
  }, []);

  // -- removals --------------------------------------------------------------

  const toggleRemoval = useCallback(
    (row: SignerTableRow) => {
      if (row.staged === 'removal') {
        setStagedRemovals((prev) => prev.filter((id) => id !== row.id));
        toast.info(`Restored "${row.label}" to the proposal`);
        return;
      }

      if (row.kind === 'master') {
        toast.error('The master key cannot be removed from this dashboard');
        return;
      }

      const projected = totalWeight - row.weight;
      const highThreshold = (stagedThresholds ?? thresholds).high;

      if (projected < highThreshold) {
        toast.error(
          `Cannot stage removal: projected weight ${projected} would fall below the high threshold of ${highThreshold}`,
        );
        return;
      }

      setStagedRemovals((prev) => [...prev, row.id]);
      setStagedAdjustments((prev) => prev.filter((item) => item.signerId !== row.id));
      toast.info(`Staged "${row.label}" for removal`);
    },
    [totalWeight, stagedThresholds, thresholds],
  );

  const discardAddition = useCallback((signerId: string) => {
    setStagedAdditions((prev) => prev.filter((item) => item.id !== signerId));
    toast.info('Discarded the staged signer');
  }, []);

  // -- thresholds ------------------------------------------------------------

  const handleStageThresholds = useCallback(
    (values: ThresholdFormValues) => {
      const unchanged =
        values.low === thresholds.low &&
        values.medium === thresholds.medium &&
        values.high === thresholds.high;

      if (unchanged) {
        setStagedThresholds(null);
        thresholdForm.reset(thresholds);
        toast.info('Thresholds already match the live configuration');
        return;
      }

      if (values.high > totalWeight) {
        toast.error(
          `High threshold (${values.high}) cannot exceed the projected total weight (${totalWeight})`,
        );
        return;
      }

      setStagedThresholds(values);
      toast.success('Threshold changes staged for the next proposal');
    },
    [thresholds, totalWeight, thresholdForm],
  );

  const discardThresholdChanges = useCallback(() => {
    setStagedThresholds(null);
    thresholdForm.reset(thresholds);
    toast.info('Staged threshold changes discarded');
  }, [thresholds, thresholdForm]);

  const discardAll = useCallback(() => {
    setStagedAdditions([]);
    setStagedAdjustments([]);
    setStagedRemovals([]);
    setStagedThresholds(null);
    thresholdForm.reset(thresholds);
    toast.info('All staged changes discarded');
  }, [thresholds, thresholdForm]);

  // -- proposal submission ---------------------------------------------------

  const handleSubmitProposal = useCallback(async () => {
    if (changeCount === 0 || isSubmitting) return;

    setIsSubmitting(true);
    await wait(600);

    const proposal: SignerProposal = {
      id: `sgp_${Date.now().toString(36)}`,
      changes,
      proposedBy: currentUser.data?.name ?? 'Workspace admin',
      createdAt: new Date().toISOString(),
      status: 'pending',
    };

    setSigners((prev) => {
      const removalSet = new Set(stagedRemovals);

      const updated: OrgSigner[] = prev
        .filter((item) => !removalSet.has(item.id))
        .map((item) => {
          const adjustment = stagedAdjustments.find(
            (entry) => entry.signerId === item.id,
          );
          return adjustment ? { ...item, weight: adjustment.proposedWeight } : item;
        });

      const added: OrgSigner[] = stagedAdditions.map(
        (item): OrgSigner => ({ ...item, status: 'active' }),
      );

      return [...updated, ...added];
    });

    if (thresholdsChanged && stagedThresholds) {
      setThresholds(stagedThresholds);
      thresholdForm.reset(stagedThresholds);
    }

    setStagedAdditions([]);
    setStagedAdjustments([]);
    setStagedRemovals([]);
    setStagedThresholds(null);
    setLastProposal(proposal);
    setIsConfirmOpen(false);
    setIsSubmitting(false);
    toast.success(`Proposal ${proposal.id} submitted for co-signature`);
  }, [
    changeCount,
    isSubmitting,
    changes,
    currentUser,
    stagedRemovals,
    stagedAdjustments,
    stagedAdditions,
    stagedThresholds,
    thresholdsChanged,
    thresholdForm,
  ]);

  // -- table -----------------------------------------------------------------

  const columns = useMemo<ColumnDef<SignerTableRow, unknown>[]>(
    () => [
      {
        accessorKey: 'label',
        header: 'Signer',
        cell: ({ row }) => (
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gold-soft">
              <KeyRound className="h-4 w-4 text-gold" aria-hidden />
            </span>
            <span className="min-w-0">
              <span className="block truncate font-medium text-foreground">
                {row.original.label}
              </span>
              <span className="block truncate text-2xs capitalize text-foreground-muted">
                {row.original.kind}
              </span>
            </span>
          </div>
        ),
      },
      {
        accessorKey: 'publicKey',
        header: 'Address',
        cell: ({ row }) => (
          <code className="block max-w-[18rem] break-all font-mono text-2xs text-foreground-secondary">
            {row.original.publicKey}
          </code>
        ),
      },
      {
        accessorKey: 'weight',
        header: 'Weight',
        meta: { className: 'text-right' },
        cell: ({ row }) => {
          const item = row.original;
          const share =
            item.staged === 'removal' || totalWeight === 0
              ? 0
              : Math.round((item.weight / totalWeight) * 100);

          return (
            <span className="flex flex-col items-end gap-1.5">
              <span className="tabular-nums text-foreground">
                {item.staged === 'weight' && (
                  <span className="mr-1.5 text-foreground-muted line-through">
                    {item.previousWeight}
                  </span>
                )}
                {item.weight}
              </span>
              <span className="h-1 w-16 overflow-hidden rounded-full bg-surface-secondary" aria-hidden>
                <span
                  className="block h-full rounded-full bg-gold"
                  style={{ width: `${share}%` }}
                />
              </span>
            </span>
          );
        },
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => {
          const item = row.original;
          const meta = signerStatus(item.status);

          return (
            <span className="inline-flex flex-wrap items-center gap-1.5">
              <Badge variant={meta.variant} size="sm" dot>
                {meta.label}
              </Badge>
              {item.staged === 'weight' && (
                <Badge variant="warning" size="sm">
                  Weight staged
                </Badge>
              )}
            </span>
          );
        },
      },
      {
        accessorKey: 'addedAt',
        header: 'Added',
        meta: { className: 'hidden sm:table-cell' },
        cell: ({ row }) => (
          <span className="text-2xs text-foreground-muted">
            {formatRelativeTime(row.original.addedAt)}
          </span>
        ),
      },
      {
        id: 'actions',
        header: 'Actions',
        enableSorting: false,
        meta: { className: 'text-right' },
        cell: ({ row }) => {
          const item = row.original;

          if (item.staged === 'added') {
            return (
              <div className="flex items-center justify-end gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => discardAddition(item.id)}
                  aria-label={`Discard staged signer ${item.label}`}
                  className="text-foreground-muted hover:text-danger"
                >
                  <X className="h-4 w-4" aria-hidden />
                </Button>
              </div>
            );
          }

          return (
            <div className="flex items-center justify-end gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => openAdjustDialog(item)}
                disabled={item.staged === 'removal'}
                aria-label={`Adjust weight for ${item.label}`}
              >
                <Pencil className="h-4 w-4" aria-hidden />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => toggleRemoval(item)}
                aria-label={
                  item.staged === 'removal'
                    ? `Restore ${item.label}`
                    : `Stage removal of ${item.label}`
                }
                className={
                  item.staged === 'removal'
                    ? 'text-gold'
                    : 'text-foreground-muted hover:text-danger'
                }
              >
                {item.staged === 'removal' ? (
                  <Undo2 className="h-4 w-4" aria-hidden />
                ) : (
                  <Trash2 className="h-4 w-4" aria-hidden />
                )}
              </Button>
              {item.staged === 'weight' && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => revertWeight(item.id)}
                  aria-label={`Revert weight change for ${item.label}`}
                >
                  <RotateCcw className="h-4 w-4" aria-hidden />
                </Button>
              )}
            </div>
          );
        },
      },
    ],
    [totalWeight, discardAddition, openAdjustDialog, toggleRemoval, revertWeight],
  );

  // -- render ----------------------------------------------------------------

  return (
    <div className="space-y-6" role="region" aria-label="Multi-signature signer management">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <ThresholdTile
          label="Total weight"
          value={totalWeight}
          caption={`${rows.length} keys in the set`}
          reachable={totalWeight >= effectiveThresholds.high}
        />
        <ThresholdTile
          label="Low threshold"
          value={effectiveThresholds.low}
          caption="Zero-value operations"
          reachable={totalWeight >= effectiveThresholds.low}
        />
        <ThresholdTile
          label="Medium threshold"
          value={effectiveThresholds.medium}
          caption="Standard payments"
          reachable={totalWeight >= effectiveThresholds.medium}
        />
        <ThresholdTile
          label="High threshold"
          value={effectiveThresholds.high}
          caption="High-value and account operations"
          reachable={totalWeight >= effectiveThresholds.high}
        />
      </div>

      <Card>
        <CardHeader className="flex-row items-start justify-between gap-4">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-gold" aria-hidden />
              Master key thresholds
            </CardTitle>
            <CardDescription>
              Minimum weight required before an operation counts as low, medium or high value.
            </CardDescription>
          </div>
          {stagedThresholds && <Badge variant="gold" size="sm">Changes staged</Badge>}
        </CardHeader>

        <CardContent className="space-y-5">
          <form
            onSubmit={thresholdForm.handleSubmit(handleStageThresholds)}
            className="space-y-4"
          >
            <div className="grid gap-4 sm:grid-cols-3">
              <FormField
                label="Low"
                hint="Zero-value operations"
                error={thresholdForm.formState.errors.low?.message}
                required
              >
                <Input
                  type="number"
                  min={0}
                  max={255}
                  {...thresholdForm.register('low', {
                    required: 'Enter a value for the low threshold',
                  })}
                  invalid={!!thresholdForm.formState.errors.low}
                  aria-label="Low threshold"
                />
              </FormField>

              <FormField
                label="Medium"
                hint="Standard payments"
                error={thresholdForm.formState.errors.medium?.message}
                required
              >
                <Input
                  type="number"
                  min={1}
                  max={255}
                  {...thresholdForm.register('medium', {
                    required: 'Enter a value for the medium threshold',
                  })}
                  invalid={!!thresholdForm.formState.errors.medium}
                  aria-label="Medium threshold"
                />
              </FormField>

              <FormField
                label="High"
                hint="High-value operations"
                error={thresholdForm.formState.errors.high?.message}
                required
              >
                <Input
                  type="number"
                  min={1}
                  max={255}
                  {...thresholdForm.register('high', {
                    required: 'Enter a value for the high threshold',
                  })}
                  invalid={!!thresholdForm.formState.errors.high}
                  aria-label="High threshold"
                />
              </FormField>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
              <p className="text-2xs text-foreground-muted">
                {stagedThresholds
                  ? `Staged: ${stagedThresholds.low} / ${stagedThresholds.medium} / ${stagedThresholds.high} — live: ${thresholds.low} / ${thresholds.medium} / ${thresholds.high}`
                  : 'Stage an edit, then propose it to your co-signers.'}
              </p>
              <div className="flex items-center gap-2">
                {stagedThresholds && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={discardThresholdChanges}
                    leftIcon={<RotateCcw className="h-4 w-4" aria-hidden />}
                  >
                    Discard
                  </Button>
                )}
                <Button
                  type="submit"
                  variant="secondary"
                  size="sm"
                  disabled={
                    !thresholdForm.formState.isDirty && !stagedThresholds
                  }
                >
                  Stage changes
                </Button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>

      <section className="space-y-4" aria-labelledby="signers-heading">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2
              id="signers-heading"
              className="flex items-center gap-2 font-display text-xl font-semibold tracking-tight text-foreground"
            >
              <Users className="h-4 w-4 text-gold" aria-hidden />
              Signers
            </h2>
            <p className="mt-1 text-xs text-foreground-secondary">
              {rows.length} keys · projected weight {totalWeight} · high threshold{' '}
              {effectiveThresholds.high}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={openAddDialog}
              leftIcon={<Plus className="h-4 w-4" aria-hidden />}
            >
              Add signer
            </Button>
            <Button
              type="button"
              variant="gold"
              size="sm"
              onClick={() => setIsConfirmOpen(true)}
              disabled={changeCount === 0}
              leftIcon={<Send className="h-4 w-4" aria-hidden />}
            >
              Propose changes{changeCount > 0 ? ` (${changeCount})` : ''}
            </Button>
          </div>
        </div>

        {changeCount > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-gold/40 bg-gold-soft px-4 py-3">
            <p className="flex items-center gap-2 text-xs text-foreground">
              <Info className="h-4 w-4 shrink-0 text-gold" aria-hidden />
              {changeCount} staged {changeCount === 1 ? 'change' : 'changes'} — review and
              propose them to your co-signers.
            </p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={discardAll}
              leftIcon={<RotateCcw className="h-4 w-4" aria-hidden />}
            >
              Discard all
            </Button>
          </div>
        )}

        {lastProposal && changeCount === 0 && (
          <p className="text-2xs text-foreground-muted">
            Last proposal{' '}
            <span className="font-mono text-foreground-secondary">{lastProposal.id}</span> ·{' '}
            {lastProposal.changes.length} changes · submitted{' '}
            {formatRelativeTime(lastProposal.createdAt)}
          </p>
        )}

        <DataTable
          data={rows}
          columns={columns}
          getRowId={(row) => row.id}
          searchable
          searchPlaceholder="Search label, address, kind or status"
          pageSize={5}
          caption="Organization signers"
          emptyState={
            <div className="rounded-card border border-dashed border-border p-8 text-center text-sm text-foreground-secondary">
              No signers match your search.
            </div>
          }
        />
      </section>

      <Dialog
        open={isAddOpen}
        onClose={closeAddDialog}
        title="Add a co-signer"
        description="The key is staged locally and only joins the account once the proposal is co-signed."
        size="sm"
      >
        <form onSubmit={addForm.handleSubmit(handleAddSigner)} className="space-y-4 pt-2">
          <FormField
            label="Label"
            hint="How this key appears in the signer table"
            error={addForm.formState.errors.label?.message}
            required
          >
            <Input
              type="text"
              placeholder="e.g. Finance controller"
              {...addForm.register('label')}
              invalid={!!addForm.formState.errors.label}
              aria-label="Signer label"
            />
          </FormField>

          <FormField
            label="Stellar public key"
            hint="Ed25519 account ID — a G followed by 55 base32 characters"
            error={addForm.formState.errors.publicKey?.message}
            required
          >
            <Input
              type="text"
              placeholder="GAB2CD3EF4G5H6I7JKLMNOPQRST2U3V4W5X6YZABC2D3E4F5G6H7I2J3"
              {...addForm.register('publicKey')}
              invalid={!!addForm.formState.errors.publicKey}
              aria-label="Stellar public key"
              className="font-mono"
            />
          </FormField>

          <FormField
            label="Weight"
            hint="Whole number between 1 and 255"
            error={addForm.formState.errors.weight?.message}
            required
          >
            <Input
              type="number"
              min={1}
              max={255}
              {...addForm.register('weight')}
              invalid={!!addForm.formState.errors.weight}
              aria-label="Signer weight"
            />
          </FormField>

          <FormField
            label="Kind"
            hint="The master key is provisioned outside this dashboard"
            error={addForm.formState.errors.kind?.message}
            required
          >
            <Select
              {...addForm.register('kind')}
              invalid={!!addForm.formState.errors.kind}
              aria-label="Signer kind"
            >
              <option value="co-signer">Co-signer</option>
              <option value="pre-auth">Pre-authorized</option>
              <option value="hash">Hash signer</option>
            </Select>
          </FormField>

          <div className="flex justify-end gap-2 border-t border-border pt-3">
            <Button type="button" variant="secondary" size="sm" onClick={closeAddDialog}>
              Cancel
            </Button>
            <Button type="submit" variant="gold" size="sm">
              Stage signer
            </Button>
          </div>
        </form>
      </Dialog>

      <Dialog
        open={adjustTarget !== null}
        onClose={closeAdjustDialog}
        title={
          adjustTarget ? `Adjust weight — ${adjustTarget.label}` : 'Adjust weight'
        }
        description="Propose a new signature weight for this key."
        size="sm"
      >
        <form
          onSubmit={adjustForm.handleSubmit(handleAdjustWeight)}
          className="space-y-4 pt-2"
        >
          {adjustTarget && (
            <div className="rounded-sm bg-surface-secondary px-3 py-2 text-2xs text-foreground-secondary">
              <span className="font-medium text-foreground">{adjustTarget.label}</span> ·{' '}
              <span className="font-mono">
                {truncateHash(adjustTarget.publicKey, 6, 6)}
              </span>{' '}
              · current weight {adjustTarget.weight}
            </div>
          )}

          <FormField
            label="Proposed weight"
            hint="Whole number between 1 and 255"
            error={adjustForm.formState.errors.weight?.message}
            required
          >
            <Input
              type="number"
              min={1}
              max={255}
              {...adjustForm.register('weight')}
              invalid={!!adjustForm.formState.errors.weight}
              aria-label="Proposed weight"
            />
          </FormField>

          <FormField
            label="Reason"
            hint="Recorded on the proposal for auditors"
            error={adjustForm.formState.errors.reason?.message}
            required
          >
            <Input
              type="text"
              placeholder="e.g. Rotating the Q4 finance key"
              {...adjustForm.register('reason')}
              invalid={!!adjustForm.formState.errors.reason}
              aria-label="Reason for the weight change"
            />
          </FormField>

          <div className="flex justify-end gap-2 border-t border-border pt-3">
            <Button type="button" variant="secondary" size="sm" onClick={closeAdjustDialog}>
              Cancel
            </Button>
            <Button type="submit" variant="gold" size="sm">
              Stage adjustment
            </Button>
          </div>
        </form>
      </Dialog>

      <Dialog
        open={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        title="Confirm signer proposal"
        description={`${changeCount} ${changeCount === 1 ? 'change' : 'changes'} will be sent to your co-signers for approval.`}
        size="md"
        footer={
          <>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setIsConfirmOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="gold"
              size="sm"
              loading={isSubmitting}
              leftIcon={<Send className="h-4 w-4" aria-hidden />}
              onClick={handleSubmitProposal}
            >
              Submit proposal
            </Button>
          </>
        }
      >
        <ul className="space-y-2">
          {changes.map((change, index) => (
            <li
              key={`${change.kind}-${index}`}
              className="rounded-sm border border-border bg-surface-secondary/50 px-3 py-2 text-xs text-foreground"
            >
              <ProposalChangeRow change={change} />
            </li>
          ))}
        </ul>
        <p className="mt-4 flex items-start gap-2 text-2xs text-foreground-secondary">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold" aria-hidden />
          Nothing is applied on-chain until the proposal collects enough co-signatures.
        </p>
      </Dialog>
    </div>
  );
}

interface ThresholdTileProps {
  label: string;
  value: number;
  caption: string;
  reachable: boolean;
}

function ThresholdTile({ label, value, caption, reachable }: ThresholdTileProps) {
  return (
    <div className="rounded-card border border-border bg-surface p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-2xs font-medium uppercase tracking-[0.14em] text-foreground-secondary">
          {label}
        </p>
        {reachable ? (
          <CheckCircle2 className="h-4 w-4 text-success" aria-hidden />
        ) : (
          <AlertTriangle className="h-4 w-4 text-warning" aria-hidden />
        )}
      </div>
      <p className="mt-2 font-display text-3xl font-semibold tabular-nums tracking-tight text-foreground">
        {value}
      </p>
      <p className="mt-1 text-2xs text-foreground-muted">{caption}</p>
    </div>
  );
}

function ProposalChangeRow({ change }: { change: SignerProposalChange }) {
  if (change.kind === 'add') {
    return (
      <span>
        Add <span className="font-medium">{change.label}</span> · weight {change.weight} ·{' '}
        <code className="font-mono">{truncateHash(change.publicKey, 6, 6)}</code>
      </span>
    );
  }

  if (change.kind === 'adjust') {
    return (
      <span>
        Adjust <span className="font-medium">{change.label}</span> weight{' '}
        {change.currentWeight} →{' '}
        <span className="font-medium">{change.proposedWeight}</span> · {change.reason}
      </span>
    );
  }

  if (change.kind === 'remove') {
    return (
      <span>
        Remove <span className="font-medium">{change.label}</span> ·{' '}
        <code className="font-mono">{truncateHash(change.publicKey, 6, 6)}</code>
      </span>
    );
  }

  return (
    <span>
      Thresholds {change.previous.low}/{change.previous.medium}/{change.previous.high} →{' '}
      <span className="font-medium">
        {change.next.low}/{change.next.medium}/{change.next.high}
      </span>
    </span>
  );
}

export default SignerManagement;
