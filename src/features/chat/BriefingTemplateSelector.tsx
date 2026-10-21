'use client';

import { ChevronDown, FileText, Landmark, ScrollText, Zap, type LucideIcon } from 'lucide-react';
import { Dropdown } from '@/components/ui/dropdown';
import { FINANCIAL_BRIEFING_TEMPLATES, type FinancialBriefingTemplate } from './briefingTemplates';

/** Lucide icon registry for template items (iconName comes from the catalogue). */
const TEMPLATE_ICONS: Record<string, LucideIcon> = {
  Zap,
  ScrollText,
  Landmark,
};

export interface BriefingTemplateSelectorProps {
  /** Called with the chosen template. The chat view owns submission; this stays presentational. */
  onSelectTemplate: (template: FinancialBriefingTemplate) => void;
  /** Templates are the issue's catalogue unless a caller overrides it. */
  templates?: readonly FinancialBriefingTemplate[];
  /** Disables menu items while the assistant is streaming a reply. */
  disabled?: boolean;
}

/**
 * Dropdown selector for common financial briefing prompts in the AI assistant
 * chat view. Purely presentational: it renders the template catalogue and
 * reports the selection upward — the chat view auto-populates the composer
 * and triggers the existing message-submission path.
 */
export function BriefingTemplateSelector({
  onSelectTemplate,
  templates = FINANCIAL_BRIEFING_TEMPLATES,
  disabled = false,
}: BriefingTemplateSelectorProps) {
  return (
    <Dropdown
      aria-label="Financial briefing templates"
      align="start"
      className="min-w-[280px]"
      triggerClassName="flex items-center gap-1.5 rounded-button border border-border bg-surface-secondary px-2.5 py-1 text-2xs text-foreground-secondary transition-colors hover:border-gold hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-surface"
      trigger={
        <>
          <FileText className="h-3 w-3 text-gold" aria-hidden />
          <span>Briefing Templates</span>
          <ChevronDown className="h-3 w-3 opacity-60" aria-hidden />
        </>
      }
      items={templates.map((template) => {
        const Icon = TEMPLATE_ICONS[template.iconName] ?? FileText;
        return {
          label: template.label,
          icon: <Icon className="h-3.5 w-3.5" aria-hidden />,
          disabled,
          onSelect: () => onSelectTemplate(template),
        };
      })}
    />
  );
}
