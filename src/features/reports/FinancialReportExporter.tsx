'use client';

import { useState, useMemo } from 'react';
import { useTransactions, useBudgets } from '@/hooks/use-queries';
import {
  filterByDateRange,
  toCSV,
  toJSON,
  triggerDownload,
  type ColumnDefinition,
} from '@/utils/reportExport';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { ChartIllustration } from '@/components/illustrations';
import {
  FileSpreadsheet,
  FileCode,
  Download,
  Calendar,
  CheckSquare,
  Square,
  RefreshCw,
  Filter,
  CheckCircle2,
  Table,
} from 'lucide-react';
import { toast } from 'sonner';
import type { Transaction, Budget } from '@/types/domain';

export type ReportDataSet = 'transactions' | 'budgets';
export type ExportFormat = 'csv' | 'json';

const TRANSACTION_COLUMNS: ColumnDefinition<Transaction>[] = [
  { key: 'id', label: 'Transaction ID' },
  { key: 'createdAt', label: 'Created Date' },
  { key: 'agentName', label: 'Agent Name' },
  { key: 'direction', label: 'Direction' },
  { key: 'counterparty', label: 'Counterparty' },
  { key: 'counterpartyAddress', label: 'Counterparty Address' },
  { key: 'amount', label: 'Amount' },
  { key: 'asset', label: 'Asset' },
  { key: 'usdValue', label: 'USD Value' },
  { key: 'status', label: 'Status' },
  { key: 'riskScore', label: 'Risk Score' },
  { key: 'purpose', label: 'Purpose' },
  { key: 'memo', label: 'Memo' },
  { key: 'stellarHash', label: 'Stellar Hash' },
  { key: 'walletId', label: 'Wallet ID' },
  { key: 'agentId', label: 'Agent ID' },
  { key: 'organizationId', label: 'Organization ID' },
  { key: 'proposalId', label: 'Proposal ID' },
  { key: 'policyId', label: 'Policy ID' },
];

const DEFAULT_TRANSACTION_COLS = [
  'id', 'createdAt', 'agentName', 'direction', 'counterparty',
  'amount', 'asset', 'usdValue', 'status', 'riskScore', 'purpose',
];

const BUDGET_COLUMNS: ColumnDefinition<Budget>[] = [
  { key: 'id', label: 'Budget ID' },
  { key: 'name', label: 'Budget Name' },
  { key: 'scope', label: 'Scope' },
  { key: 'limit', label: 'Limit' },
  { key: 'spent', label: 'Spent' },
  { key: 'remaining', label: 'Remaining' },
  { key: 'currency', label: 'Currency' },
  { key: 'period', label: 'Period' },
  { key: 'resetsAt', label: 'Resets At' },
  { key: 'createdAt', label: 'Created At' },
  { key: 'organizationId', label: 'Organization ID' },
  { key: 'parentBudgetId', label: 'Parent Budget ID' },
];

const DEFAULT_BUDGET_COLS = [
  'id', 'name', 'scope', 'limit', 'spent', 'remaining', 'currency', 'period', 'createdAt',
];

export interface FinancialReportExporterProps {
  initialDataSet?: ReportDataSet;
  className?: string;
}

export function FinancialReportExporter({
  initialDataSet = 'transactions',
  className = '',
}: FinancialReportExporterProps) {
  const transactionsQuery = useTransactions();
  const budgetsQuery = useBudgets();

  const [dataSet, setDataSet] = useState<ReportDataSet>(initialDataSet);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [format, setFormat] = useState<ExportFormat>('csv');
  const [selectedColumns, setSelectedColumns] = useState<string[]>(
    initialDataSet === 'transactions' ? DEFAULT_TRANSACTION_COLS : DEFAULT_BUDGET_COLS
  );
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportStage, setExportStage] = useState('');

  const availableColumns = (
    dataSet === 'transactions' ? TRANSACTION_COLUMNS : BUDGET_COLUMNS
  ) as unknown as ColumnDefinition[];

  const isLoading =
    dataSet === 'transactions' ? transactionsQuery.isLoading : budgetsQuery.isLoading;

  const filteredData = useMemo(() => {
    const raw = (
      dataSet === 'transactions'
        ? (transactionsQuery.data ?? [])
        : (budgetsQuery.data ?? [])
    ) as any[];
    return filterByDateRange(raw, startDate || null, endDate || null, 'createdAt');
  }, [transactionsQuery.data, budgetsQuery.data, startDate, endDate, dataSet]);

  const handleDataSetChange = (next: ReportDataSet) => {
    setDataSet(next);
    setSelectedColumns(next === 'transactions' ? DEFAULT_TRANSACTION_COLS : DEFAULT_BUDGET_COLS);
  };

  const toggleColumn = (key: string) =>
    setSelectedColumns((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );

  const applyPreset = (preset: 'all' | 'last7' | 'last30' | 'thisMonth' | 'ytd') => {
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    if (preset === 'all') { setStartDate(''); setEndDate(''); return; }
    const d = new Date(now);
    if (preset === 'last7') d.setDate(d.getDate() - 7);
    else if (preset === 'last30') d.setDate(d.getDate() - 30);
    else if (preset === 'thisMonth') { d.setDate(1); }
    else if (preset === 'ytd') { d.setMonth(0); d.setDate(1); }
    setStartDate(d.toISOString().slice(0, 10));
    setEndDate(today);
  };

  const handleExport = async () => {
    if (filteredData.length === 0) {
      toast.error('No records match your date range to export.');
      return;
    }
    if (selectedColumns.length === 0) {
      toast.error('Please select at least one column for the report.');
      return;
    }

    setIsExporting(true);
    setExportProgress(10);
    setExportStage('Filtering records by date criteria…');
    await delay(250);

    setExportProgress(40);
    setExportStage(`Compiling ${filteredData.length} records & ${selectedColumns.length} fields…`);
    await delay(350);

    setExportProgress(80);
    setExportStage(`Formatting output to ${format.toUpperCase()}…`);
    await delay(250);

    setExportProgress(100);
    setExportStage('Initiating browser download…');

    const activeCols = availableColumns.filter((c) => selectedColumns.includes(c.key));
    const date = new Date().toISOString().slice(0, 10);
    const filename = `astroid-financial-report-${dataSet}-${date}.${format}`;

    if (format === 'csv') {
      triggerDownload(toCSV(filteredData, activeCols), filename, 'text/csv;charset=utf-8;');
    } else {
      triggerDownload(toJSON(filteredData, activeCols), filename, 'application/json');
    }

    toast.success(`Exported ${filteredData.length} records → ${filename}`);
    await delay(300);
    setIsExporting(false);
    setExportProgress(0);
    setExportStage('');
  };

  return (
    <Card className={`overflow-hidden border border-border bg-surface ${className}`}>
      {/* ── Header ── */}
      <CardHeader className="border-b border-border bg-surface/50">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <CardTitle className="text-xl font-semibold tracking-tight">
                Financial Report Exporter
              </CardTitle>
              <span className="rounded-full border border-gold/20 bg-gold/10 px-2.5 py-0.5 text-2xs font-semibold text-gold">
                Issue #78
              </span>
            </div>
            <CardDescription className="mt-1">
              Generate and download client-side financial activity reports — no server calls, fully private.
            </CardDescription>
          </div>

          {/* Dataset Toggle */}
          <div className="flex items-center rounded-button border border-border bg-surface-secondary p-1">
            {(['transactions', 'budgets'] as const).map((ds) => (
              <button
                key={ds}
                type="button"
                onClick={() => handleDataSetChange(ds)}
                className={`flex items-center gap-1.5 rounded-sm px-3 py-1 text-xs font-medium transition-all ${
                  dataSet === ds
                    ? 'bg-surface text-foreground shadow-soft-1'
                    : 'text-foreground-secondary hover:text-foreground'
                }`}
              >
                {ds === 'transactions' ? (
                  <Table className="h-3.5 w-3.5" />
                ) : (
                  <Filter className="h-3.5 w-3.5" />
                )}
                {ds.charAt(0).toUpperCase() + ds.slice(1)} (
                {ds === 'transactions'
                  ? (transactionsQuery.data?.length ?? 0)
                  : (budgetsQuery.data?.length ?? 0)}
                )
              </button>
            ))}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6 p-6">
        {/* ── Date Range ── */}
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
              <Calendar className="h-4 w-4 text-gold" />
              Date Range Filter
            </label>
            <div className="flex flex-wrap gap-1">
              {(['all', 'last7', 'last30', 'thisMonth', 'ytd'] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => applyPreset(p)}
                  className={`rounded px-2 py-0.5 text-2xs font-medium transition-colors ${
                    p === 'all' && !startDate && !endDate
                      ? 'border border-gold/30 bg-gold/20 text-gold-strong'
                      : 'text-foreground-secondary hover:bg-surface-secondary hover:text-foreground'
                  }`}
                >
                  {{ all: 'All Time', last7: 'Last 7d', last30: 'Last 30d', thisMonth: 'This Month', ytd: 'YTD' }[p]}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {(['start', 'end'] as const).map((which) => (
              <div key={which} className="space-y-1">
                <span className="text-2xs font-medium text-foreground-secondary capitalize">{which} Date</span>
                <input
                  type="date"
                  value={which === 'start' ? startDate : endDate}
                  onChange={(e) =>
                    which === 'start' ? setStartDate(e.target.value) : setEndDate(e.target.value)
                  }
                  className="w-full rounded-button border border-border bg-surface px-3 py-2 text-xs text-foreground focus:border-gold focus:outline-none"
                />
              </div>
            ))}
          </div>
        </div>

        {/* ── Format Toggle ── */}
        <div className="space-y-3 pt-2">
          <label className="text-xs font-semibold text-foreground">Export Format</label>
          <div className="grid max-w-md grid-cols-2 gap-3">
            {([
              { id: 'csv', Icon: FileSpreadsheet, label: 'CSV Spreadsheet (.csv)' },
              { id: 'json', Icon: FileCode, label: 'JSON Payload (.json)' },
            ] as const).map(({ id, Icon, label }) => (
              <button
                key={id}
                type="button"
                onClick={() => setFormat(id)}
                className={`flex items-center justify-center gap-2 rounded-card border p-3 text-xs font-medium transition-all ${
                  format === id
                    ? 'border-gold bg-gold/10 text-foreground ring-1 ring-gold/40'
                    : 'border-border bg-surface text-foreground-secondary hover:border-border-strong hover:text-foreground'
                }`}
              >
                <Icon className={`h-4 w-4 ${format === id ? 'text-gold' : 'text-foreground-muted'}`} />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Column Checkboxes ── */}
        <div className="space-y-3 pt-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
              <CheckSquare className="h-4 w-4 text-gold" />
              Fields ({selectedColumns.length}/{availableColumns.length})
            </label>
            <div className="flex items-center gap-3 text-2xs">
              <button type="button" onClick={() => setSelectedColumns(availableColumns.map((c) => c.key))} className="font-medium text-gold hover:underline">All</button>
              <span className="text-border">|</span>
              <button type="button" onClick={() => setSelectedColumns([])} className="font-medium text-foreground-secondary hover:underline">None</button>
              <span className="text-border">|</span>
              <button
                type="button"
                onClick={() => setSelectedColumns(dataSet === 'transactions' ? DEFAULT_TRANSACTION_COLS : DEFAULT_BUDGET_COLS)}
                className="font-medium text-foreground-secondary hover:underline"
              >
                Defaults
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 rounded-card border border-border bg-surface-secondary/40 p-4 sm:grid-cols-3 md:grid-cols-4">
            {availableColumns.map((col) => {
              const checked = selectedColumns.includes(col.key);
              return (
                <label
                  key={col.key}
                  className={`flex cursor-pointer items-center gap-2.5 rounded-button border p-2 text-xs transition-colors ${
                    checked
                      ? 'border-gold/30 bg-gold/5 font-medium text-foreground'
                      : 'border-transparent text-foreground-secondary hover:bg-surface-secondary'
                  }`}
                >
                  <input type="checkbox" checked={checked} onChange={() => toggleColumn(col.key)} className="sr-only" />
                  {checked
                    ? <CheckSquare className="h-4 w-4 shrink-0 text-gold" />
                    : <Square className="h-4 w-4 shrink-0 text-foreground-muted" />
                  }
                  <span className="truncate">{col.label}</span>
                </label>
              );
            })}
          </div>
        </div>

        {/* ── Record Summary / Empty State ── */}
        <div className="pt-2">
          {isLoading ? (
            <div className="skeleton h-20 w-full rounded-card" />
          ) : filteredData.length === 0 ? (
            <EmptyState
              compact
              illustration={<ChartIllustration />}
              title="No matching records"
              description={`No ${dataSet} fall within${startDate || endDate ? ` ${startDate || '…'} → ${endDate || '…'}` : ' the selected range'}. Expand the date range or select "All Time".`}
            />
          ) : (
            <div className="flex items-center justify-between rounded-card border border-border bg-surface-secondary/60 p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-foreground">Ready to compile</p>
                  <p className="text-2xs text-foreground-secondary">
                    {filteredData.length} {dataSet} record{filteredData.length === 1 ? '' : 's'} × {selectedColumns.length} field{selectedColumns.length === 1 ? '' : 's'}
                  </p>
                </div>
              </div>
              <span className="rounded-full border border-border bg-surface px-3 py-1 font-mono text-xs font-medium text-gold">
                ~{(filteredData.length * (format === 'csv' ? 0.2 : 0.4)).toFixed(1)} KB
              </span>
            </div>
          )}
        </div>

        {/* ── Progress Bar ── */}
        {isExporting && (
          <div className="animate-in fade-in space-y-2 rounded-card border border-gold/30 bg-gold/5 p-4 duration-200">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-2 font-medium text-foreground">
                <RefreshCw className="h-3.5 w-3.5 animate-spin text-gold" />
                {exportStage}
              </span>
              <span className="font-mono text-xs font-semibold text-gold">{exportProgress}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-surface-secondary">
              <div
                className="h-full bg-gold transition-all duration-300 ease-out"
                style={{ width: `${exportProgress}%` }}
              />
            </div>
          </div>
        )}
      </CardContent>

      {/* ── Footer / Export Button ── */}
      <CardFooter className="flex items-center justify-between border-t border-border bg-surface/50 p-6">
        <p className="text-2xs text-foreground-muted">
          Client-side only — zero network calls, fully private.
        </p>
        <Button
          variant="gold"
          size="md"
          loading={isExporting}
          disabled={filteredData.length === 0 || selectedColumns.length === 0 || isExporting}
          onClick={handleExport}
          leftIcon={<Download className="h-4 w-4" />}
        >
          {isExporting ? 'Compiling…' : `Export ${format.toUpperCase()}`}
        </Button>
      </CardFooter>
    </Card>
  );
}

function delay(ms: number) {
  return new Promise<void>((res) => setTimeout(res, ms));
}
