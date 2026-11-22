import React from "react";
import { createRoot } from "react-dom/client";
import { BatchActionToolbar } from "../components/BatchActionToolbar";

describe("BatchActionToolbar", () => {
  it("renders selected count and triggers action callbacks", () => {
    const onClearSelection = jest.fn();
    const onBatchApprove = jest.fn();
    const onBatchReject = jest.fn();

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    root.render(
      <BatchActionToolbar
        selectedCount={3}
        onClearSelection={onClearSelection}
        onBatchApprove={onBatchApprove}
        onBatchReject={onBatchReject}
      />
    );

    expect(container.textContent).toContain("3 proposals selected");

    const buttons = container.querySelectorAll("button");
    const approveBtn = Array.from(buttons).find(b => b.textContent?.includes("Approve Selected"));
    const rejectBtn = Array.from(buttons).find(b => b.textContent?.includes("Reject Selected"));
    const clearBtn = Array.from(buttons).find(b => b.textContent?.includes("Clear"));

    expect(approveBtn).toBeDefined();
    expect(rejectBtn).toBeDefined();
    expect(clearBtn).toBeDefined();

    approveBtn?.click();
    expect(onBatchApprove).toHaveBeenCalledTimes(1);

    rejectBtn?.click();
    expect(onBatchReject).toHaveBeenCalledTimes(1);

    clearBtn?.click();
    expect(onClearSelection).toHaveBeenCalledTimes(1);

    root.unmount();
    container.remove();
  });
});
