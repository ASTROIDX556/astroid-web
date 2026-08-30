'use client';

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Filter,
  Bot,
  ShieldCheck,
  ArrowUpRight,
  Clock,
  Unlock,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Code,
  CheckCircle2,
  AlertCircle,
  Hash,
  Coins,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatRelativeTime } from '@/lib/format';

export type TimelineEventType =
  | 'Decision'
  | 'Evaluation'
  | 'StellarTx'
  | 'ApprovalNeeded'
  | 'PolicyBypass';

export interface AgentTimelineEvent {
  id: string;
  agentId?: string;
  agentName: string;
  type: TimelineEventType;
  title: string;
  timestamp: string;
  status: 'completed' | 'pending' | 'flagged' | 'bypassed';
  summary: string;
  details: {
    rawLog: string;
    blockNumber?: number;
    ledgerSequence?: number;
    feeXlm?: number;
    txHash?: string;
    recipientAddress?: string;
    criteriaEvaluated?: string[];
    riskScore?: number;
  };
}

export interface AgentTimelineProps {
  events?: AgentTimelineEvent[];
  title?: string;
  description?: string;
  className?: string;
}

const MOCK_TIMELINE_EVENTS: AgentTimelineEvent[] = [
  {
    id: 'evt-1',
    agentName: 'Liquidity Rebalancer Alpha',
    type: 'StellarTx',
    title: 'Executed Automated Liquidity Rebalance on Soroban DEX',
    timestamp: '2026-08-29T11:20:00Z',
    status: 'completed',
    summary: 'Swapped 2,500 XLM for USDC to maintain 50/50 delta neutrality across active liquidity pools.',
    details: {
      rawLog: '[DEX_SWAP_EXEC] Route: XLM->USDC; Slippage: 0.04%; Nonce: 104928; Result: SUCCESS',
      ledgerSequence: 54910283,
      feeXlm: 0.00001,
      txHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      recipientAddress: 'GBX4444KKKK5555LLLL6666MMMM7777NNNN8888OOOO9999PPPP0000',
      riskScore: 12,
    },
  },
  {
    id: 'evt-2',
    agentName: 'Treasury Guardian Agent',
    type: 'ApprovalNeeded',
    title: 'High-Value Payment Flagged for Human Multi-Sig Approval',
    timestamp: '2026-08-29T10:45:00Z',
    status: 'pending',
    summary: 'Proposed transfer of $12,500 USDC exceeds autonomous single-transaction limit of $5,000.',
    details: {
      rawLog: '[POLICY_ENFORCE] Rule #4 (SingleTxCeiling) triggered. Requiring 2 human approvals.',
      criteriaEvaluated: [
        'Single Transaction Ceiling <= $5,000 (FAILED: $12,500 proposed)',
        'Daily Organization Budget <= $50,000 (PASSED)',
        'Recipient Address Allow-List (PASSED)',
      ],
      riskScore: 78,
    },
  },
  {
    id: 'evt-3',
    agentName: 'Yield Arbitrage Bot',
    type: 'Decision',
    title: 'Autonomous Opportunity Identification & Route Decision',
    timestamp: '2026-08-29T09:30:00Z',
    status: 'completed',
    summary: 'Calculated 1.84% net spread across Stellar AMM pool vs external orderbook.',
    details: {
      rawLog: '[DECISION_ENGINE] Strategy: AMM_ARBITRAGE; Estimated Profit: +$42.50; Confidence: 96.4%',
      criteriaEvaluated: [
        'Expected Spread >= 0.50% (PASSED: 1.84%)',
        'Gas / Fee Ratio <= 5.00% (PASSED: 0.12%)',
        'Slippage Tolerance <= 0.10% (PASSED)',
      ],
      riskScore: 5,
    },
  },
  {
    id: 'evt-4',
    agentName: 'Compliance Audit Sentinel',
    type: 'Evaluation',
    title: 'Routine Policy & Budget Utilization Verification',
    timestamp: '2026-08-29T08:00:00Z',
    status: 'completed',
    summary: 'Evaluated 14 active policy rules across all operating sub-budgets. All clear.',
    details: {
      rawLog: '[AUDIT_SWEEP] Swept 6 active agent wallets. Overall utilization: 42.8%. Zero breaches.',
      criteriaEvaluated: [
        'Daily Spend Rate Velocity (NORMAL)',
        'Blacklisted Sanctions Address Check (CLEAR)',
        'Signer Weight Integrity (VALIDATED)',
      ],
      riskScore: 2,
    },
  },
  {
    id: 'evt-5',
    agentName: 'Emergency Response Agent',
    type: 'PolicyBypass',
    title: 'Emergency Circuit Breaker Override Triggered',
    timestamp: '2026-08-29T06:15:00Z',
    status: 'bypassed',
    summary: 'Temporarily bypassed standard 15-minute cooldown rule to halt liquidity withdrawal during volatility spike.',
    details: {
      rawLog: '[BYPASS_EVENT] Override Token: SEC_EMERGENCY_KEY_09; Reason: Volatility Spike Protection',
      ledgerSequence: 54904120,
      feeXlm: 0.00005,
      txHash: 'a1b2c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef0',
      riskScore: 85,
    },
  },
];

const EVENT_TYPE_CONFIG: Record<
  TimelineEventType,
  { label: string; icon: React.ComponentType<{ className?: string }>; badgeVariant: any; colorClass: string }
> = {
  Decision: {
    label: 'Decision',
    icon: Bot,
    badgeVariant: 'accent',
    colorClass: 'bg-gold-soft text-gold-strong border-gold/30',
  },
  Evaluation: {
    label: 'Evaluation',
    icon: ShieldCheck,
    badgeVariant: 'success',
    colorClass: 'bg-success-soft/30 text-success border-success/30',
  },
  StellarTx: {
    label: 'Stellar Tx',
    icon: ArrowUpRight,
    badgeVariant: 'info',
    colorClass: 'bg-info-soft/30 text-info border-info/30',
  },
  ApprovalNeeded: {
    label: 'Approval Needed',
    icon: Clock,
    badgeVariant: 'warning',
    colorClass: 'bg-warning-soft/30 text-warning border-warning/30',
  },
  PolicyBypass: {
    label: 'Policy Bypass',
    icon: Unlock,
    badgeVariant: 'danger',
    colorClass: 'bg-danger-soft/30 text-danger border-danger/30',
  },
};

export function AgentTimeline({
  events = MOCK_TIMELINE_EVENTS,
  title = 'Agent Activity & Execution Log Timeline',
  description = 'Chronological sequence of autonomous decisions, policy evaluations, and on-chain Stellar transactions.',
  className = '',
}: AgentTimelineProps) {
  const [selectedType, setSelectedType] = useState<TimelineEventType | 'All'>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandedEventIds, setExpandedEventIds] = useState<Set<string>>(new Set(['evt-1']));

  // Filter events by search query and type
  const filteredEvents = useMemo(() => {
    return events.filter((evt) => {
      const matchesType = selectedType === 'All' || evt.type === selectedType;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        evt.title.toLowerCase().includes(q) ||
        evt.agentName.toLowerCase().includes(q) ||
        evt.summary.toLowerCase().includes(q) ||
        evt.details.rawLog.toLowerCase().includes(q) ||
        (evt.details.txHash && evt.details.txHash.toLowerCase().includes(q));

      return matchesType && matchesSearch;
    });
  }, [events, selectedType, searchQuery]);

  // Toggle item expansion without layout shifting
  const toggleExpand = (id: string) => {
    setExpandedEventIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <Card className={`overflow-hidden ${className}`}>
      <CardHeader className="border-b border-border bg-surface-primary/60 pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-gold" aria-hidden="true" />
              <CardTitle className="text-base font-semibold">{title}</CardTitle>
            </div>
            <CardDescription className="text-xs">{description}</CardDescription>
          </div>

          <Badge variant="outline" size="sm" className="self-start sm:self-auto font-mono">
            {filteredEvents.length} {filteredEvents.length === 1 ? 'Event' : 'Events'}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-6 pt-5">
        {/* Controls: Search Input & Category Filter Pills */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-foreground-muted pointer-events-none" aria-hidden="true" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by agent, message, or Stellar tx hash..."
              className="w-full rounded-md border border-border bg-surface-primary pl-9 pr-3 py-2 text-xs text-foreground placeholder:text-foreground-muted focus:border-gold focus:outline-none focus:ring-1 focus:ring-ring"
              aria-label="Search agent timeline events"
            />
          </div>

          {/* Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5" role="toolbar" aria-label="Event Type Filters">
            <button
              onClick={() => setSelectedType('All')}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                selectedType === 'All'
                  ? 'bg-gold text-gold-foreground'
                  : 'bg-surface-secondary text-foreground-secondary hover:text-foreground'
              }`}
              aria-pressed={selectedType === 'All'}
            >
              All
            </button>
            {(Object.keys(EVENT_TYPE_CONFIG) as TimelineEventType[]).map((type) => {
              const cfg = EVENT_TYPE_CONFIG[type];
              const isSelected = selectedType === type;
              return (
                <button
                  key={type}
                  onClick={() => setSelectedType(type)}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                    isSelected
                      ? 'bg-gold text-gold-foreground'
                      : 'bg-surface-secondary text-foreground-secondary hover:text-foreground'
                  }`}
                  aria-pressed={isSelected}
                >
                  {cfg.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Empty Search State */}
        {filteredEvents.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-12 text-center text-xs">
            <Filter className="h-8 w-8 text-foreground-muted mb-2 opacity-50" />
            <p className="font-semibold text-foreground">No matching timeline events found</p>
            <p className="text-foreground-secondary max-w-sm mt-1">
              Try adjusting your search query or selecting a different event type filter above.
            </p>
          </div>
        ) : (
          /* Interactive Vertical Timeline Nodes */
          <div className="relative pl-6 sm:pl-8 space-y-6 before:absolute before:left-3 sm:before:left-4 before:top-2 before:bottom-2 before:w-0.5 before:bg-border">
            {filteredEvents.map((evt) => {
              const isExpanded = expandedEventIds.has(evt.id);
              const typeCfg = EVENT_TYPE_CONFIG[evt.type];
              const Icon = typeCfg.icon;

              return (
                <div key={evt.id} className="relative group">
                  {/* Timeline Icon Marker Node */}
                  <span
                    className={`absolute -left-6 sm:-left-8 top-0.5 grid h-6 w-6 sm:h-7 sm:w-7 place-items-center rounded-full border shadow-2xs transition-transform group-hover:scale-105 ${typeCfg.colorClass}`}
                    aria-hidden="true"
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                  </span>

                  {/* Card Event Container */}
                  <div className="rounded-lg border border-border bg-surface-primary shadow-2xs hover:border-border-strong transition-all">
                    {/* Event Header Bar */}
                    <button
                      onClick={() => toggleExpand(evt.id)}
                      className="w-full flex items-start justify-between gap-3 p-3.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg"
                      aria-expanded={isExpanded}
                      aria-controls={`timeline-details-${evt.id}`}
                    >
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-2xs font-semibold text-gold uppercase tracking-wider">
                            {evt.agentName}
                          </span>
                          <Badge variant={typeCfg.badgeVariant} size="sm">
                            {typeCfg.label}
                          </Badge>
                          {evt.status === 'completed' && (
                            <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                          )}
                          {evt.status === 'pending' && (
                            <Clock className="h-3.5 w-3.5 text-warning" />
                          )}
                        </div>

                        <p className="text-xs font-semibold text-foreground leading-snug">
                          {evt.title}
                        </p>
                        <p className="text-xs text-foreground-secondary leading-relaxed line-clamp-2">
                          {evt.summary}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-2xs text-foreground-muted tabular">
                          {formatRelativeTime(evt.timestamp)}
                        </span>
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4 text-foreground-secondary" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-foreground-muted" />
                        )}
                      </div>
                    </button>

                    {/* Expandable Details Panel with Framer Motion */}
                    <AnimatePresence initial={false}>
                      {isExpanded && (
                        <motion.div
                          id={`timeline-details-${evt.id}`}
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.25, ease: 'easeInOut' }}
                          className="overflow-hidden border-t border-border/60 bg-surface-secondary/30"
                        >
                          <div className="p-4 space-y-4 text-xs">
                            {/* Metadata Summary Chips */}
                            <div className="flex flex-wrap items-center gap-3 text-2xs">
                              {evt.details.ledgerSequence && (
                                <span className="inline-flex items-center gap-1 font-mono text-foreground-secondary bg-surface-primary px-2 py-1 rounded border border-border/60">
                                  <Hash className="h-3 w-3 text-foreground-muted" />
                                  Ledger #{evt.details.ledgerSequence}
                                </span>
                              )}
                              {evt.details.feeXlm !== undefined && (
                                <span className="inline-flex items-center gap-1 font-mono text-foreground-secondary bg-surface-primary px-2 py-1 rounded border border-border/60">
                                  <Coins className="h-3 w-3 text-gold" />
                                  Fee: {evt.details.feeXlm} XLM
                                </span>
                              )}
                              {evt.details.riskScore !== undefined && (
                                <span className="inline-flex items-center gap-1 font-mono text-foreground-secondary bg-surface-primary px-2 py-1 rounded border border-border/60">
                                  Risk Score: {evt.details.riskScore}/100
                                </span>
                              )}
                              {evt.details.txHash && (
                                <a
                                  href={`https://stellar.expert/explorer/public/tx/${evt.details.txHash}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 font-mono text-gold hover:underline bg-gold-soft/50 px-2 py-1 rounded border border-gold/30"
                                >
                                  <span>Tx: {evt.details.txHash.slice(0, 8)}...{evt.details.txHash.slice(-8)}</span>
                                  <ExternalLink className="h-3 w-3" />
                                </a>
                              )}
                            </div>

                            {/* Criteria Evaluated Rules */}
                            {evt.details.criteriaEvaluated && evt.details.criteriaEvaluated.length > 0 && (
                              <div className="space-y-1.5">
                                <span className="text-2xs font-semibold text-foreground uppercase tracking-wider">
                                  Governance Criteria Evaluated
                                </span>
                                <div className="space-y-1">
                                  {evt.details.criteriaEvaluated.map((crit, i) => (
                                    <div key={i} className="flex items-center gap-1.5 text-2xs text-foreground-secondary">
                                      {crit.includes('PASSED') ? (
                                        <CheckCircle2 className="h-3 w-3 text-success shrink-0" />
                                      ) : (
                                        <AlertCircle className="h-3 w-3 text-danger shrink-0" />
                                      )}
                                      <span>{crit}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Raw Log Output Box */}
                            <div className="space-y-1.5">
                              <span className="text-2xs font-semibold text-foreground uppercase tracking-wider flex items-center gap-1">
                                <Code className="h-3 w-3 text-foreground-muted" />
                                Raw Agent Log Telemetry
                              </span>
                              <pre className="font-mono text-2xs bg-surface-primary p-3 rounded-md border border-border text-foreground-secondary overflow-x-auto whitespace-pre-wrap">
                                {evt.details.rawLog}
                              </pre>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default AgentTimeline;

