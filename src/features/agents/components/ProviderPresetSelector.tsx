'use client';

import { Bot, CheckCircle2, Cpu, Link2, Orbit, Sparkles, Terminal } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';
import { AGENT_PROVIDER_PRESETS, type AgentProviderPreset } from '../providerPresets';
import type { AgentProviderId } from '../schema';

const PROVIDER_ICONS: Record<AgentProviderId, LucideIcon> = {
  Nvidia: Cpu,
  OpenAI: Sparkles,
  Anthropic: Bot,
  Gemini: Orbit,
  Ollama: Terminal,
  Custom: Link2,
};

export interface ProviderPresetSelectorProps {
  /** Currently selected provider id (controlled by the wizard's form state). */
  value: AgentProviderId;
  /** Called when a preset card is chosen. Applying values to the form is the caller's job. */
  onSelect: (preset: AgentProviderPreset) => void;
  className?: string;
}

/**
 * Visual preset selector with a card per supported AI provider. Picking a
 * card hands the chosen preset to the caller so the wizard can pre-fill the
 * provider, default model, API endpoint, and context window fields.
 */
export function ProviderPresetSelector({ value, onSelect, className }: ProviderPresetSelectorProps) {
  return (
    <div className={cn('space-y-3', className)}>
      <p className="text-xs text-foreground-secondary">
        Choose an inference provider to pre-fill its recommended endpoint, default model, and
        context window. You can customize every value below.
      </p>

      <div
        className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
        role="radiogroup"
        aria-label="Provider presets"
      >
        {AGENT_PROVIDER_PRESETS.map((preset) => (
          <ProviderPresetCard
            key={preset.id}
            preset={preset}
            selected={value === preset.id}
            onSelect={onSelect}
          />
        ))}
      </div>
    </div>
  );
}

function ProviderPresetCard({
  preset,
  selected,
  onSelect,
}: {
  preset: AgentProviderPreset;
  selected: boolean;
  onSelect: (preset: AgentProviderPreset) => void;
}) {
  const Icon = PROVIDER_ICONS[preset.id];

  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={() => onSelect(preset)}
      className={cn(
        'group flex min-w-0 flex-col items-start gap-2 rounded-card border p-4 text-left transition-all duration-fast',
        selected
          ? 'border-gold bg-gold-soft/50 shadow-gold'
          : 'border-border bg-surface hover:border-border-strong hover:bg-surface-secondary',
      )}
    >
      <div className="flex w-full min-w-0 items-center gap-2.5">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-button bg-gold-soft text-gold-strong">
          <Icon className="h-4 w-4" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">{preset.label}</p>
          <p className="text-2xs text-foreground-secondary">{preset.tagline}</p>
        </div>
      </div>

      <dl className="flex w-full min-w-0 flex-col gap-1 text-2xs text-foreground-muted">
        <div className="flex min-w-0 items-baseline gap-2">
          <dt className="shrink-0 uppercase tracking-wide text-foreground-secondary">Model</dt>
          <dd className={cn('min-w-0 truncate font-mono', !preset.defaultModel && 'italic')}>
            {preset.defaultModel || 'your own'}
          </dd>
        </div>
        <div className="flex min-w-0 items-baseline gap-2">
          <dt className="shrink-0 uppercase tracking-wide text-foreground-secondary">Endpoint</dt>
          <dd className={cn('min-w-0 truncate font-mono', !preset.endpointUrl && 'italic')}>
            {preset.endpointUrl || 'you provide it'}
          </dd>
        </div>
        <div className="flex items-baseline gap-2">
          <dt className="shrink-0 uppercase tracking-wide text-foreground-secondary">Context</dt>
          <dd className="tabular">{preset.contextWindowTokens.toLocaleString()} tokens</dd>
        </div>
      </dl>

      {selected && (
        <div className="flex items-center gap-1 text-2xs font-medium text-gold-strong">
          <CheckCircle2 className="h-3 w-3" aria-hidden />
          Selected
        </div>
      )}
    </button>
  );
}

export default ProviderPresetSelector;
