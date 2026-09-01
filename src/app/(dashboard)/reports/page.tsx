'use client';

import { PageHeader } from '@/components/dashboard/page-header';
import { PageTransition } from '@/components/ui/motion';
import { FinancialReportExporter } from '@/features/reports';

export default function ReportsPage() {
  return (
    <PageTransition className="space-y-8">
      <PageHeader
        eyebrow="Govern"
        title="Financial Reports"
        description="Automated export generator for agent transactions and budget allocations — client-side, fully private."
      />
      <FinancialReportExporter />
    </PageTransition>
  );
}
