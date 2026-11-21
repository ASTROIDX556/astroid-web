import React from "react";
import { Button } from "@/components/ui/button";

interface BatchActionToolbarProps {
  selectedCount: number;
  onClearSelection: () => void;
  onBatchApprove: () => void;
  onBatchReject: () => void;
}

export const BatchActionToolbar: React.FC<BatchActionToolbarProps> = ({
  selectedCount,
  onClearSelection,
  onBatchApprove,
  onBatchReject,
}) => {
  return (
    <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50 bg-slate-900 border border-slate-700 text-white px-6 py-3 rounded-xl shadow-2xl flex items-center gap-4">
      <span className="text-sm font-medium">
        {selectedCount} proposal{selectedCount === 1 ? "" : "s"} selected
      </span>
      <div className="h-4 w-px bg-slate-700" />
      <div className="flex items-center gap-2">
        <Button size="sm" variant="secondary" onClick={onBatchApprove}>
          Approve Selected
        </Button>
        <Button size="sm" variant="danger" onClick={onBatchReject}>
          Reject Selected
        </Button>
        <Button size="sm" variant="ghost" onClick={onClearSelection}>
          Clear
        </Button>
      </div>
    </div>
  );
};
