'use client';

import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  type ColumnDef,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  flexRender,
} from '@tanstack/react-table';
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Copy,
  Key,
  Plus,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { FormField, Input } from '@/components/ui/input';
import { formatDate, truncateHash } from '@/lib/format';
import { cn } from '@/lib/cn';
import type {
  AccountThresholds,
  MultisigSignerItem,
  ProposalType,
  SignerProposalItem,
} from '@/types/multisig';

import {
  INITIAL_ACCOUNT_ADDRESS,
  INITIAL_PROPOSALS,
  INITIAL_SIGNERS,
  INITIAL_THRESHOLDS,
} from './fixtures/signers';

/* -------------------------------------------------------------------------- */
/* Validation Schemas                                                         */
/* -------------------------------------------------------------------------- */

const STELLAR_PUBLIC_KEY_REGEX = /^G[A-Z2-7]{55}$/;

export const addSignerSchema = z.object({
  publicKey: z
    .string()
    .trim()
    .toUpperCase()
    .regex(
      STELLAR_PUBLIC_KEY_REGEX,
      'Invalid Stellar public key. Must start with "G" followed by 55 base32 characters.',
    ),
  weight: z.coerce
    .number({ invalid_type_error: 'Weight must be a number' })
    .int('Weight must be an integer')
    .min(1, 'Signing weight must be at least 1')
    .max(255, 'Signing weight cannot exceed 255'),
  label: z
    .string()
    .trim()
    .min(2, 'Label must be at least 2 characters')
    .max(60, 'Label cannot exceed 60 characters'),
  description: z
    .string()
    .trim()
    .max(200, 'Proposal description cannot exceed 200 characters')
    .optional(),
});

export type AddSignerFormValues = z.infer<typeof addSignerSchema>;

export const editWeightSchema = z.object({
  weight: z.coerce
    .number({ invalid_type_error: 'Weight must be a number' })
    .int('Weight must be an integer')
    .min(1, 'Weight must be at least 1')
    .max(255, 'Weight cannot exceed 255'),
  description: z
    .string()
    .trim()
    .max(200, 'Proposal description cannot exceed 200 characters')
    .optional(),
});

export type EditWeightFormValues = z.infer<typeof editWeightSchema>;

export const thresholdsSchema = z
  .object({
    lowThreshold: z.coerce
      .number({ invalid_type_error: 'Low threshold must be a number' })
      .int()
      .min(0, 'Min 0')
      .max(255, 'Max 255'),
    medThreshold: z.coerce
      .number({ invalid_type_error: 'Medium threshold must be a number' })
      .int()
      .min(0, 'Min 0')
      .max(255, 'Max 255'),
    highThreshold: z.coerce
      .number({ invalid_type_error: 'High threshold must be a number' })
      .int()
      .min(0, 'Min 0')
      .max(255, 'Max 255'),
    masterWeight: z.coerce
      .number({ invalid_type_error: 'Master weight must be a number' })
      .int()
      .min(0, 'Min 0')
      .max(255, 'Max 255'),
  })
  .refine((data) => data.lowThreshold <= data.medThreshold, {
    message: 'Low threshold cannot exceed Medium threshold',
    path: ['lowThreshold'],
  })
  .refine((data) => data.medThreshold <= data.highThreshold, {
    message: 'Medium threshold cannot exceed High threshold',
    path: ['medThreshold'],
  });

export type ThresholdsFormValues = z.infer<typeof thresholdsSchema>;

/* -------------------------------------------------------------------------- */
/* Pending Proposal Action Payload                                            */
/* -------------------------------------------------------------------------- */

export interface PendingActionState {
  type: ProposalType;
  title: string;
  summary: string;
  targetPublicKey?: string;
  targetLabel?: string;
  newWeight?: number;
  currentWeight?: number;
  newThresholds?: AccountThresholds;
  currentThresholds?: AccountThresholds;
  description: string;
}

/* -------------------------------------------------------------------------- */
/* Main Component                                                             */
/* -------------------------------------------------------------------------- */

export function SignerManagement() {
  const [accountAddress] = useState<string>(INITIAL_ACCOUNT_ADDRESS);
  const [thresholds, setThresholds] = useState<AccountThresholds>(INITIAL_THRESHOLDS);
  const [signers, setSigners] = useState<MultisigSignerItem[]>(INITIAL_SIGNERS);
  const [proposals, setProposals] = useState<SignerProposalItem[]>(INITIAL_PROPOSALS);

  // Table filtering & pagination state
  const [globalFilter, setGlobalFilter] = useState('');

  // Modals visibility state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isThresholdsModalOpen, setIsThresholdsModalOpen] = useState(false);
  const [editingSigner, setEditingSigner] = useState<MultisigSignerItem | null>(null);
  const [removingSigner, setRemovingSigner] = useState<MultisigSignerItem | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingActionState | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Forms
  const addForm = useForm<AddSignerFormValues>({
    resolver: zodResolver(addSignerSchema),
    defaultValues: {
      publicKey: '',
      weight: 1,
      label: '',
      description: '',
    },
  });

  const editWeightForm = useForm<EditWeightFormValues>({
    resolver: zodResolver(editWeightSchema),
    defaultValues: {
      weight: 1,
      description: '',
    },
  });

  const thresholdsForm = useForm<ThresholdsFormValues>({
    resolver: zodResolver(thresholdsSchema),
    defaultValues: {
      lowThreshold: thresholds.lowThreshold,
      medThreshold: thresholds.medThreshold,
      highThreshold: thresholds.highThreshold,
      masterWeight: thresholds.masterWeight,
    },
  });

  // Calculate total signed weight
  const totalWeight = useMemo(() => {
    return signers
      .filter((s) => s.status === 'active')
      .reduce((sum, s) => sum + s.weight, 0);
  }, [signers]);

  const activeSignerCount = useMemo(() => {
    return signers.filter((s) => s.status === 'active').length;
  }, [signers]);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(text);
    toast.success(`${label} copied to clipboard`);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  /* ------------------------------------------------------------------------ */
  /* Form Handlers (Stage for confirmation modal)                             */
  /* ------------------------------------------------------------------------ */

  const handleStageAddSigner = (values: AddSignerFormValues) => {
    // Check if key already exists
    const exists = signers.some(
      (s) => s.publicKey.toLowerCase() === values.publicKey.toLowerCase(),
    );
    if (exists) {
      addForm.setError('publicKey', {
        type: 'manual',
        message: 'This public key is already registered as a signer on this account.',
      });
      return;
    }

    setPendingAction({
      type: 'add_signer',
      title: 'Propose Add New Co-Signer',
      summary: `Add ${values.label} (${truncateHash(values.publicKey)}) with weight ${values.weight}`,
      targetPublicKey: values.publicKey,
      targetLabel: values.label,
      newWeight: values.weight,
      description:
        values.description ||
        `Propose adding co-signer ${values.label} with weight ${values.weight}.`,
    });
    setIsAddModalOpen(false);
  };

  const handleStageEditWeight = (values: EditWeightFormValues) => {
    if (!editingSigner) return;
    setPendingAction({
      type: 'update_weight',
      title: 'Propose Weight Adjustment',
      summary: `Update weight of ${editingSigner.label} from ${editingSigner.weight} to ${values.weight}`,
      targetPublicKey: editingSigner.publicKey,
      targetLabel: editingSigner.label,
      currentWeight: editingSigner.weight,
      newWeight: values.weight,
      description:
        values.description ||
        `Propose changing weight for ${editingSigner.label} from ${editingSigner.weight} to ${values.weight}.`,
    });
    setEditingSigner(null);
  };

  const handleStageRemoveSigner = (signer: MultisigSignerItem) => {
    setRemovingSigner(null);
    setPendingAction({
      type: 'remove_signer',
      title: 'Propose Signer Removal',
      summary: `Remove ${signer.label} (${truncateHash(signer.publicKey)}) by revoking signing weight`,
      targetPublicKey: signer.publicKey,
      targetLabel: signer.label,
      currentWeight: signer.weight,
      newWeight: 0,
      description: `Propose removing co-signer ${signer.label} and revoking its weight of ${signer.weight}.`,
    });
  };

  const handleStageThresholds = (values: ThresholdsFormValues) => {
    setPendingAction({
      type: 'update_thresholds',
      title: 'Propose Threshold Adjustment',
      summary: `Update account thresholds to Low:${values.lowThreshold}, Med:${values.medThreshold}, High:${values.highThreshold}`,
      newThresholds: values,
      currentThresholds: thresholds,
      description: `Propose updating master thresholds: Low=${values.lowThreshold}, Medium=${values.medThreshold}, High=${values.highThreshold}.`,
    });
    setIsThresholdsModalOpen(false);
  };

  /* ------------------------------------------------------------------------ */
  /* Execute Confirmation Action Flow                                         */
  /* ------------------------------------------------------------------------ */

  const handleConfirmProposal = () => {
    if (!pendingAction) return;

    const newProposal: SignerProposalItem = {
      id: `prop-${Date.now().toString().slice(-4)}`,
      accountAddress,
      type: pendingAction.type,
      targetPublicKey: pendingAction.targetPublicKey,
      targetLabel: pendingAction.targetLabel,
      newWeight: pendingAction.newWeight,
      currentWeight: pendingAction.currentWeight,
      newThresholds: pendingAction.newThresholds,
      currentThresholds: pendingAction.currentThresholds,
      status: 'proposed',
      createdAt: new Date().toISOString(),
      description: pendingAction.description,
      proposedBy: 'Admin (Current User)',
    };

    setProposals((prev) => [newProposal, ...prev]);

    // Perform optimistic status updates on signers if applicable
    if (pendingAction.type === 'add_signer' && pendingAction.targetPublicKey) {
      const newSigner: MultisigSignerItem = {
        id: `sgn-${Date.now().toString().slice(-4)}`,
        publicKey: pendingAction.targetPublicKey,
        weight: pendingAction.newWeight || 1,
        label: pendingAction.targetLabel || 'Co-Signer',
        type: 'co-signer',
        status: 'pending_addition',
        addedAt: new Date().toISOString(),
      };
      setSigners((prev) => [...prev, newSigner]);
    } else if (
      pendingAction.type === 'remove_signer' &&
      pendingAction.targetPublicKey
    ) {
      setSigners((prev) =>
        prev.map((s) =>
          s.publicKey === pendingAction.targetPublicKey
            ? { ...s, status: 'pending_removal' }
            : s,
        ),
      );
    } else if (
      pendingAction.type === 'update_thresholds' &&
      pendingAction.newThresholds
    ) {
      // Optimistically update threshold display or keep proposal staged
      setThresholds((prev) => ({
        ...prev,
        masterWeight: pendingAction.newThresholds?.masterWeight ?? prev.masterWeight,
      }));
    }

    toast.success('Multi-signature proposal successfully created!', {
      description: `Proposal ${newProposal.id} requires ${thresholds.highThreshold} signature weight before execution.`,
    });

    setPendingAction(null);
    addForm.reset();
  };

  /* ------------------------------------------------------------------------ */
  /* TanStack Table Definition                                                */
  /* ------------------------------------------------------------------------ */

  const columns = useMemo<ColumnDef<MultisigSignerItem>[]>(
    () => [
      {
        accessorKey: 'label',
        header: 'Signer Label',
        cell: ({ row }) => {
          const signer = row.original;
          return (
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="font-medium text-foreground">{signer.label}</span>
                {signer.type === 'master' ? (
                  <Badge variant="gold" size="sm">
                    Master Key
                  </Badge>
                ) : (
                  <Badge variant="neutral" size="sm">
                    Co-Signer
                  </Badge>
                )}
              </div>
              <span className="text-2xs text-foreground-secondary font-mono">
                ID: {signer.id}
              </span>
            </div>
          );
        },
      },
      {
        accessorKey: 'publicKey',
        header: 'Stellar Public Key',
        cell: ({ row }) => {
          const key = row.original.publicKey;
          const isCopied = copiedKey === key;
          return (
            <div className="flex items-center gap-2 font-mono text-xs text-foreground">
              <span title={key}>{truncateHash(key, 8, 8)}</span>
              <button
                type="button"
                onClick={() => copyToClipboard(key, 'Public Key')}
                className="inline-flex items-center p-1 text-foreground-muted transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded-xs"
                aria-label="Copy public key"
              >
                <Copy className={cn('h-3.5 w-3.5', isCopied && 'text-success')} />
              </button>
            </div>
          );
        },
      },
      {
        accessorKey: 'weight',
        header: 'Signing Weight',
        cell: ({ row }) => {
          const weight = row.original.weight;
          const percentage = totalWeight > 0 ? Math.round((weight / totalWeight) * 100) : 0;
          return (
            <div className="flex items-center gap-3">
              <span className="font-mono text-sm font-semibold tabular-nums text-foreground">
                {weight}
              </span>
              <div className="hidden w-20 sm:block">
                <div className="h-1.5 w-full rounded-full bg-surface-secondary overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gold transition-all duration-300"
                    style={{ width: `${Math.min(100, percentage)}%` }}
                  />
                </div>
                <span className="text-[10px] text-foreground-secondary tabular-nums">
                  {percentage}% of total
                </span>
              </div>
            </div>
          );
        },
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => {
          const status = row.original.status;
          if (status === 'active') {
            return (
              <Badge variant="success" size="sm" dot>
                Active
              </Badge>
            );
          }
          if (status === 'pending_addition') {
            return (
              <Badge variant="warning" size="sm">
                Pending Add
              </Badge>
            );
          }
          return (
            <Badge variant="danger" size="sm">
              Pending Remove
            </Badge>
          );
        },
      },
      {
        accessorKey: 'addedAt',
        header: 'Added On',
        cell: ({ row }) => (
          <span className="text-xs text-foreground-secondary">
            {formatDate(row.original.addedAt)}
          </span>
        ),
      },
      {
        id: 'actions',
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => {
          const signer = row.original;
          const isMaster = signer.type === 'master';
          const isPending = signer.status !== 'active';

          return (
            <div className="flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={isPending}
                onClick={() => {
                  editWeightForm.setValue('weight', signer.weight);
                  editWeightForm.setValue('description', '');
                  setEditingSigner(signer);
                }}
                leftIcon={<Sliders className="h-3.5 w-3.5" />}
              >
                Adjust Weight
              </Button>

              {!isMaster && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isPending}
                  onClick={() => setRemovingSigner(signer)}
                  className="text-danger hover:border-danger hover:bg-danger/10"
                  leftIcon={<Trash2 className="h-3.5 w-3.5" />}
                >
                  Remove
                </Button>
              )}
            </div>
          );
        },
      },
    ],
    [copiedKey, totalWeight, editWeightForm],
  );

  const table = useReactTable({
    data: signers,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    state: {
      globalFilter,
    },
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: (row, _columnId, filterValue) => {
      const search = (filterValue ?? '').toString().toLowerCase().trim();
      if (!search) return true;
      const { label, publicKey, type, status } = row.original;
      return (
        label.toLowerCase().includes(search) ||
        publicKey.toLowerCase().includes(search) ||
        type.toLowerCase().includes(search) ||
        status.toLowerCase().includes(search)
      );
    },
    initialState: {
      pagination: {
        pageSize: 10,
      },
    },
  });

  return (
    <div className="space-y-8">
      {/* ------------------------------------------------------------------ */}
      {/* Header & Account Summary                                           */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Shield className="h-6 w-6 text-gold" />
            <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
              Organization Multi-Sig Signer Dashboard
            </h1>
          </div>
          <p className="mt-1 text-sm text-foreground-secondary">
            Manage co-signers, signing weight allocations, and master threshold policies for organization accounts.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="secondary"
            size="md"
            leftIcon={<Sliders className="h-4 w-4" />}
            onClick={() => {
              thresholdsForm.reset({
                lowThreshold: thresholds.lowThreshold,
                medThreshold: thresholds.medThreshold,
                highThreshold: thresholds.highThreshold,
                masterWeight: thresholds.masterWeight,
              });
              setIsThresholdsModalOpen(true);
            }}
          >
            Configure Thresholds
          </Button>

          <Button
            type="button"
            variant="gold"
            size="md"
            leftIcon={<UserPlus className="h-4 w-4" />}
            onClick={() => {
              addForm.reset();
              setIsAddModalOpen(true);
            }}
          >
            Add Co-Signer
          </Button>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Overview Stat Cards                                                */}
      {/* ------------------------------------------------------------------ */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Account Info Card */}
        <Card className="bg-surface">
          <CardHeader className="pb-2">
            <CardDescription className="text-2xs uppercase tracking-wider text-foreground-secondary">
              Multisig Account
            </CardDescription>
            <CardTitle className="font-mono text-sm font-semibold truncate text-foreground" title={accountAddress}>
              {truncateHash(accountAddress, 8, 8)}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex items-center gap-2 text-2xs text-foreground-muted">
              <span>Stellar Testnet / Public</span>
              <button
                type="button"
                onClick={() => copyToClipboard(accountAddress, 'Account Address')}
                className="inline-flex items-center gap-1 text-gold hover:underline"
              >
                Copy Address
              </button>
            </div>
          </CardContent>
        </Card>

        {/* Total Active Signers */}
        <Card className="bg-surface">
          <CardHeader className="pb-2">
            <CardDescription className="text-2xs uppercase tracking-wider text-foreground-secondary">
              Active Co-Signers
            </CardDescription>
            <CardTitle className="font-display text-2xl font-bold tabular-nums text-foreground">
              {activeSignerCount}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <span className="text-2xs text-foreground-secondary">
              {signers.filter((s) => s.type === 'master').length} Master Key · {signers.filter((s) => s.type === 'co-signer').length} Co-Signers
            </span>
          </CardContent>
        </Card>

        {/* Total Weight Collected */}
        <Card className="bg-surface">
          <CardHeader className="pb-2">
            <CardDescription className="text-2xs uppercase tracking-wider text-foreground-secondary">
              Total Account Weight
            </CardDescription>
            <CardTitle className="font-display text-2xl font-bold tabular-nums text-gold">
              {totalWeight}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <span className="text-2xs text-foreground-secondary">
              Max High Threshold: {thresholds.highThreshold} weight
            </span>
          </CardContent>
        </Card>

        {/* Threshold Status */}
        <Card className="bg-surface">
          <CardHeader className="pb-2">
            <CardDescription className="text-2xs uppercase tracking-wider text-foreground-secondary">
              Security Margin
            </CardDescription>
            <CardTitle className="flex items-center gap-2 font-display text-xl font-bold text-success">
              <ShieldCheck className="h-5 w-5" />
              {totalWeight >= thresholds.highThreshold ? 'Fully Secured' : 'Sub-Optimal'}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <span className="text-2xs text-foreground-secondary">
              Low:{thresholds.lowThreshold} · Med:{thresholds.medThreshold} · High:{thresholds.highThreshold}
            </span>
          </CardContent>
        </Card>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Threshold Progress Bar Breakdown                                   */}
      {/* ------------------------------------------------------------------ */}
      <Card className="bg-surface border-border">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Key className="h-4 w-4 text-gold" />
              <CardTitle className="text-sm font-semibold">Account Threshold Allocation</CardTitle>
            </div>
            <span className="text-2xs text-foreground-secondary">
              Current Weight: <span className="font-bold text-foreground">{totalWeight}</span>
            </span>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative h-3 w-full rounded-full bg-surface-secondary overflow-hidden ring-1 ring-border">
            {/* Active Weight fill */}
            <div
              className={cn(
                'h-full rounded-full transition-all duration-500',
                totalWeight >= thresholds.highThreshold ? 'bg-success' : 'bg-gold',
              )}
              style={{
                width: `${Math.min(100, (totalWeight / Math.max(totalWeight, thresholds.highThreshold + 2)) * 100)}%`,
              }}
            />
          </div>

          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="rounded-card border border-border p-2 bg-surface-secondary/20">
              <span className="block text-2xs uppercase tracking-wider text-foreground-muted">Low Threshold</span>
              <span className="font-mono font-semibold text-foreground">{thresholds.lowThreshold} Weight</span>
              <span className="block text-[10px] text-foreground-secondary">Allow trust, 0-fee ops</span>
            </div>
            <div className="rounded-card border border-border p-2 bg-surface-secondary/20">
              <span className="block text-2xs uppercase tracking-wider text-foreground-muted">Medium Threshold</span>
              <span className="font-mono font-semibold text-foreground">{thresholds.medThreshold} Weight</span>
              <span className="block text-[10px] text-foreground-secondary">Payment & transfer ops</span>
            </div>
            <div className="rounded-card border border-border p-2 bg-surface-secondary/20">
              <span className="block text-2xs uppercase tracking-wider text-foreground-muted">High Threshold</span>
              <span className="font-mono font-semibold text-foreground">{thresholds.highThreshold} Weight</span>
              <span className="block text-[10px] text-foreground-secondary">Signer & threshold updates</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ------------------------------------------------------------------ */}
      {/* Signers TanStack Table                                            */}
      {/* ------------------------------------------------------------------ */}
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-gold" />
            <h2 className="font-display text-lg font-semibold text-foreground">Registered Co-Signers</h2>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-foreground-muted" />
            <Input
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              placeholder="Search signers by label, key..."
              className="pl-9 h-9 text-xs"
            />
          </div>
        </div>

        <div className="overflow-hidden rounded-card border border-border bg-surface shadow-soft-1">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                {table.getHeaderGroups().map((headerGroup) => (
                  <tr key={headerGroup.id} className="border-b border-border bg-surface-secondary/40">
                    {headerGroup.headers.map((header) => {
                      const canSort = header.column.getCanSort();
                      return (
                        <th
                          key={header.id}
                          className="px-4 py-3 text-2xs font-semibold uppercase tracking-wider text-foreground-secondary"
                        >
                          {header.isPlaceholder ? null : (
                            <button
                              type="button"
                              onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                              className={cn(
                                'inline-flex items-center gap-1 font-semibold text-foreground-secondary hover:text-foreground',
                                !canSort && 'cursor-default',
                              )}
                            >
                              {flexRender(header.column.columnDef.header, header.getContext())}
                              {canSort && (
                                <span className="text-foreground-muted">
                                  {header.column.getIsSorted() === 'asc' ? (
                                    <ArrowUp className="h-3 w-3" />
                                  ) : header.column.getIsSorted() === 'desc' ? (
                                    <ArrowDown className="h-3 w-3" />
                                  ) : null}
                                </span>
                              )}
                            </button>
                          )}
                        </th>
                      );
                    })}
                  </tr>
                ))}
              </thead>
              <tbody className="divide-y divide-border">
                {table.getRowModel().rows.length === 0 ? (
                  <tr>
                    <td colSpan={columns.length} className="p-8 text-center text-sm text-foreground-secondary">
                      No co-signers found matching search criteria.
                    </td>
                  </tr>
                ) : (
                  table.getRowModel().rows.map((row) => (
                    <tr
                      key={row.id}
                      className="transition-colors hover:bg-surface-secondary/30"
                    >
                      {row.getVisibleCells().map((cell) => (
                        <td key={cell.id} className="px-4 py-3 align-middle">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Table Pagination Controls */}
          {table.getPageCount() > 1 && (
            <div className="flex items-center justify-between border-t border-border px-4 py-3 text-xs text-foreground-secondary bg-surface-secondary/20">
              <span>
                Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => table.previousPage()}
                  disabled={!table.getCanPreviousPage()}
                  leftIcon={<ChevronLeft className="h-3.5 w-3.5" />}
                >
                  Previous
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => table.nextPage()}
                  disabled={!table.getCanNextPage()}
                  rightIcon={<ChevronRight className="h-3.5 w-3.5" />}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Active Proposals Log                                               */}
      {/* ------------------------------------------------------------------ */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold text-foreground flex items-center gap-2">
            <UserCheck className="h-5 w-5 text-gold" />
            Multi-Sig Change Proposals
          </h2>
          <Badge variant="gold" size="sm">
            {proposals.filter((p) => p.status === 'proposed').length} Proposed
          </Badge>
        </div>

        <div className="grid gap-3">
          {proposals.map((proposal) => (
            <Card key={proposal.id} className="bg-surface border-border">
              <CardContent className="p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-semibold text-gold">{proposal.id}</span>
                    <Badge
                      variant={
                        proposal.type === 'add_signer'
                          ? 'success'
                          : proposal.type === 'remove_signer'
                            ? 'danger'
                            : 'info'
                      }
                      size="sm"
                    >
                      {proposal.type.replace('_', ' ').toUpperCase()}
                    </Badge>
                    <span className="text-2xs text-foreground-secondary">
                      {formatDate(proposal.createdAt)}
                    </span>
                  </div>
                  <p className="text-xs text-foreground font-medium">{proposal.description}</p>
                  <p className="text-2xs text-foreground-muted">Proposed by: {proposal.proposedBy}</p>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <Badge variant="warning" size="sm">
                    Awaiting {thresholds.highThreshold} Weight Signatures
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Dialog 1: Add Co-Signer Modal                                      */}
      {/* ------------------------------------------------------------------ */}
      <Dialog
        open={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add New Co-Signer"
        description="Propose adding a new Stellar public key to this organization multi-signature account."
        size="md"
      >
        <form onSubmit={addForm.handleSubmit(handleStageAddSigner)} className="space-y-4 pt-2">
          <FormField
            label="Stellar Public Key"
            required
            error={addForm.formState.errors.publicKey?.message}
            hint="56-character base32 address starting with G (e.g., GABC...)"
          >
            <Input
              {...addForm.register('publicKey')}
              placeholder="GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
              className="font-mono text-xs uppercase"
              invalid={!!addForm.formState.errors.publicKey}
            />
          </FormField>

          <FormField
            label="Signing Weight"
            required
            error={addForm.formState.errors.weight?.message}
            hint="Weight assigned to this key (1 to 255)."
          >
            <Input
              type="number"
              {...addForm.register('weight')}
              min={1}
              max={255}
              placeholder="1"
              invalid={!!addForm.formState.errors.weight}
            />
          </FormField>

          <FormField
            label="Key Holder / Role Label"
            required
            error={addForm.formState.errors.label?.message}
            hint="Human-readable name or role for identification."
          >
            <Input
              {...addForm.register('label')}
              placeholder="e.g., Lead Auditor, Secondary Security Officer"
              invalid={!!addForm.formState.errors.label}
            />
          </FormField>

          <FormField
            label="Proposal Description (Optional)"
            error={addForm.formState.errors.description?.message}
            hint="Context for other organization admins before co-signing."
          >
            <Input
              {...addForm.register('description')}
              placeholder="e.g., Adding key for Q4 audit compliance"
              invalid={!!addForm.formState.errors.description}
            />
          </FormField>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsAddModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="gold" leftIcon={<Plus className="h-4 w-4" />}>
              Propose Co-Signer
            </Button>
          </div>
        </form>
      </Dialog>

      {/* ------------------------------------------------------------------ */}
      {/* Dialog 2: Adjust Signer Weight Modal                               */}
      {/* ------------------------------------------------------------------ */}
      <Dialog
        open={!!editingSigner}
        onClose={() => setEditingSigner(null)}
        title="Adjust Signing Weight"
        description={`Modify signing weight for ${editingSigner?.label || 'co-signer'}.`}
        size="sm"
      >
        <form onSubmit={editWeightForm.handleSubmit(handleStageEditWeight)} className="space-y-4 pt-2">
          {editingSigner && (
            <div className="rounded-card border border-border p-3 bg-surface-secondary/30 space-y-1">
              <p className="text-xs font-semibold text-foreground">{editingSigner.label}</p>
              <p className="font-mono text-2xs text-foreground-secondary truncate">{editingSigner.publicKey}</p>
              <p className="text-2xs text-gold">Current Weight: {editingSigner.weight}</p>
            </div>
          )}

          <FormField
            label="New Signing Weight"
            required
            error={editWeightForm.formState.errors.weight?.message}
            hint="Set new weight between 1 and 255."
          >
            <Input
              type="number"
              {...editWeightForm.register('weight')}
              min={1}
              max={255}
              invalid={!!editWeightForm.formState.errors.weight}
            />
          </FormField>

          <FormField
            label="Reason / Description (Optional)"
            error={editWeightForm.formState.errors.description?.message}
          >
            <Input
              {...editWeightForm.register('description')}
              placeholder="e.g., Increasing weight for higher approval authority"
              invalid={!!editWeightForm.formState.errors.description}
            />
          </FormField>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setEditingSigner(null)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="gold">
              Propose Weight Change
            </Button>
          </div>
        </form>
      </Dialog>

      {/* ------------------------------------------------------------------ */}
      {/* Dialog 3: Remove Signer Modal                                      */}
      {/* ------------------------------------------------------------------ */}
      <Dialog
        open={!!removingSigner}
        onClose={() => setRemovingSigner(null)}
        title="Propose Co-Signer Removal"
        description="This operation will set the signer weight to 0, revoking all authorization rights."
        size="sm"
      >
        {removingSigner && (
          <div className="space-y-4 pt-2">
            <div className="rounded-card border border-danger/30 p-3 bg-danger/5 space-y-1">
              <div className="flex items-center gap-2 text-danger font-semibold text-xs">
                <ShieldAlert className="h-4 w-4" />
                Revoke Key Privileges
              </div>
              <p className="text-xs font-medium text-foreground">{removingSigner.label}</p>
              <p className="font-mono text-2xs text-foreground-secondary truncate">{removingSigner.publicKey}</p>
            </div>

            <p className="text-xs text-foreground-secondary">
              Removing a co-signer requires a High Threshold multi-sig transaction approval ({thresholds.highThreshold} weight).
            </p>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setRemovingSigner(null)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="danger"
                onClick={() => handleStageRemoveSigner(removingSigner)}
                leftIcon={<Trash2 className="h-4 w-4" />}
              >
                Confirm Removal Proposal
              </Button>
            </div>
          </div>
        )}
      </Dialog>

      {/* ------------------------------------------------------------------ */}
      {/* Dialog 4: Configure Account Thresholds Modal                        */}
      {/* ------------------------------------------------------------------ */}
      <Dialog
        open={isThresholdsModalOpen}
        onClose={() => setIsThresholdsModalOpen(false)}
        title="Configure Master Account Thresholds"
        description="Adjust Low, Medium, and High operation thresholds for the organization Stellar account."
        size="md"
      >
        <form onSubmit={thresholdsForm.handleSubmit(handleStageThresholds)} className="space-y-4 pt-2">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <FormField
              label="Low Threshold"
              required
              error={thresholdsForm.formState.errors.lowThreshold?.message}
              hint="Allowtrust & 0-fee ops."
            >
              <Input
                type="number"
                {...thresholdsForm.register('lowThreshold')}
                min={0}
                max={255}
                invalid={!!thresholdsForm.formState.errors.lowThreshold}
              />
            </FormField>

            <FormField
              label="Medium Threshold"
              required
              error={thresholdsForm.formState.errors.medThreshold?.message}
              hint="Payments & transfers."
            >
              <Input
                type="number"
                {...thresholdsForm.register('medThreshold')}
                min={0}
                max={255}
                invalid={!!thresholdsForm.formState.errors.medThreshold}
              />
            </FormField>

            <FormField
              label="High Threshold"
              required
              error={thresholdsForm.formState.errors.highThreshold?.message}
              hint="Signers & thresholds."
            >
              <Input
                type="number"
                {...thresholdsForm.register('highThreshold')}
                min={0}
                max={255}
                invalid={!!thresholdsForm.formState.errors.highThreshold}
              />
            </FormField>
          </div>

          <FormField
            label="Master Key Weight"
            required
            error={thresholdsForm.formState.errors.masterWeight?.message}
            hint="Weight assigned to the primary organization account master key."
          >
            <Input
              type="number"
              {...thresholdsForm.register('masterWeight')}
              min={0}
              max={255}
              invalid={!!thresholdsForm.formState.errors.masterWeight}
            />
          </FormField>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsThresholdsModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="gold">
              Propose Threshold Changes
            </Button>
          </div>
        </form>
      </Dialog>

      {/* ------------------------------------------------------------------ */}
      {/* Dialog 5: Confirmation Modal Action Flow                           */}
      {/* ------------------------------------------------------------------ */}
      <Dialog
        open={!!pendingAction}
        onClose={() => setPendingAction(null)}
        title={pendingAction?.title || 'Confirm Multi-Sig Proposal'}
        description="Review details of the proposed multi-signature change before creating the official proposal."
        size="md"
      >
        {pendingAction && (
          <div className="space-y-4 pt-2">
            <div className="rounded-card border border-gold/30 p-4 bg-gold/5 space-y-3">
              <div className="flex items-center gap-2 text-gold font-semibold text-sm">
                <CheckCircle2 className="h-5 w-5" />
                {pendingAction.summary}
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs border-t border-gold/20 pt-2 text-foreground-secondary">
                <div>
                  <span className="text-2xs text-foreground-muted block">Target Account</span>
                  <span className="font-mono text-foreground font-medium">{truncateHash(accountAddress, 8, 8)}</span>
                </div>
                <div>
                  <span className="text-2xs text-foreground-muted block">Required Threshold</span>
                  <span className="font-semibold text-foreground">High Threshold ({thresholds.highThreshold} Weight)</span>
                </div>
              </div>

              <div className="text-xs text-foreground">
                <span className="text-2xs text-foreground-muted block">Proposal Description</span>
                <p className="mt-0.5">{pendingAction.description}</p>
              </div>
            </div>

            <p className="text-2xs text-foreground-secondary">
              Upon confirmation, this proposal will be recorded in the organization multi-sig pipeline and sent to active co-signers for execution.
            </p>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setPendingAction(null)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="gold"
                onClick={handleConfirmProposal}
                leftIcon={<ShieldCheck className="h-4 w-4" />}
              >
                Submit Proposal
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}

export default SignerManagement;
