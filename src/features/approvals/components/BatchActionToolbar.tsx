import React from 'react';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';

interface BatchActionToolbarProps {
  selectedCount: number;
  totalCount: number;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onBatchApprove: () => void;
  onBatchReject: () => void;
  isSubmitting?: boolean;
}

export const BatchActionToolbar: React.FC<BatchActionToolbarProps> = ({
  selectedCount,
  totalCount,
  onSelectAll,
  onClearSelection,
  onBatchApprove,
  onBatchReject,
  isSubmitting = false,
}) => {
  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50 bg-surface border border-border text-foreground px-6 py-3.5 rounded-xl shadow-2xl flex items-center gap-6 animate-in fade-in slide-in-from-bottom-4">
      <div className="flex items-center gap-3 text-sm">
        <span className="bg-gold text-accent-foreground font-semibold px-2.5 py-0.5 rounded-full text-xs">
          {selectedCount}
        </span>
        <span className="text-foreground-secondary font-medium">
          proposals selected
        </span>
        {selectedCount < totalCount ? (
          <button
            onClick={onSelectAll}
            className="text-gold hover:text-gold-strong underline text-xs ml-2"
          >
            Select all {totalCount}
          </button>
        ) : (
          <button
            onClick={onClearSelection}
            className="text-foreground-muted hover:text-foreground-secondary underline text-xs ml-2"
          >
            Clear selection
          </button>
        )}
      </div>

      <div className="h-4 w-px bg-border" />

      <div className="flex items-center gap-3">
        <button
          onClick={onBatchReject}
          disabled={isSubmitting}
          className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-danger/10 hover:bg-danger/20 text-danger text-xs font-medium rounded-lg border border-danger/30 transition-colors disabled:opacity-50"
        >
          {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5 text-danger" />}
          Reject Selected
        </button>
        <button
          onClick={onBatchApprove}
          disabled={isSubmitting}
          className="inline-flex items-center gap-2 px-4 py-1.5 bg-success hover:brightness-105 text-foreground-primary text-xs font-medium rounded-lg shadow-sm transition-colors disabled:opacity-50"
        >
          {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
          Approve Selected
        </button>
      </div>
    </div>
  );
};
