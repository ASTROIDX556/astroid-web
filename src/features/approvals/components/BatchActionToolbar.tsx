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
    <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50 bg-slate-900 border border-slate-700 text-white px-6 py-3.5 rounded-xl shadow-2xl flex items-center gap-6 animate-in fade-in slide-in-from-bottom-4">
      <div className="flex items-center gap-3 text-sm">
        <span className="bg-indigo-600 font-semibold px-2.5 py-0.5 rounded-full text-xs">
          {selectedCount}
        </span>
        <span className="text-slate-300 font-medium">
          proposals selected
        </span>
        {selectedCount < totalCount ? (
          <button
            onClick={onSelectAll}
            className="text-indigo-400 hover:text-indigo-300 underline text-xs ml-2"
          >
            Select all {totalCount}
          </button>
        ) : (
          <button
            onClick={onClearSelection}
            className="text-slate-400 hover:text-slate-300 underline text-xs ml-2"
          >
            Clear selection
          </button>
        )}
      </div>

      <div className="h-4 w-px bg-slate-700" />

      <div className="flex items-center gap-3">
        <button
          onClick={onBatchReject}
          disabled={isSubmitting}
          className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 text-xs font-medium rounded-lg border border-rose-500/30 transition-colors disabled:opacity-50"
        >
          {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5 text-rose-400" />}
          Reject Selected
        </button>
        <button
          onClick={onBatchApprove}
          disabled={isSubmitting}
          className="inline-flex items-center gap-2 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium rounded-lg shadow-sm transition-colors disabled:opacity-50"
        >
          {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
          Approve Selected
        </button>
      </div>
    </div>
  );
};
