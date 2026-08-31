'use client';

import Link from 'next/link';
import { Bot, Sparkles, Zap } from 'lucide-react';
import { PageHeader } from '@/components/dashboard/page-header';
import { QueryBoundary } from '@/components/dashboard/query-boundary';
import { SectionLabel } from '@/components/dashboard/stat-card';
import { RiskBadge, ProgressBar } from '@/components/dashboard/risk-badge';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SkeletonCard } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { AgentClusterIllustration } from '@/components/illustrations';
import { useAgents } from '@/hooks/use-queries';
import { agentStatus } from '@/lib/status';
import { formatCurrency, formatNumber, formatRelativeTime } from '@/lib/format';
import { PageTransition } from '@/components/ui/motion';
import { AgentTemplateWizard } from '@/features/agents/components/AgentTemplateWizard';
import { AgentTimeline } from '@/features/agents/components/AgentTimeline';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

default function AgentsPage() {
  const agents = useAgents();

  return (
    <PageTransition className="space-y-8">
      <PageHeader
        eyebrow="Operate"
        title="Agents"
        description="Every autonomous operator, the budget it controls, and how close it is to its ceiling."
      />

      <AgentTemplateWizard />
      <AgentCreationWizard />
      <AgentTimeline />

      <QueryBoundary
        query={agents}
        loading={
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        }
        isEmpty={(data) => data.length === 0}
        empty={
          <EmptyState
            illustration={<AgentClusterIllustration />}
            title="No agents yet"
            description="Create your first agent to start delegating governed spend on Stellar."
          />
        }
      >
        {(data) => (
          <div className="space-y-6">
            <SectionLabel>{data.length} agents</SectionLabel>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {data.map((agent) => {
                const status = agentStatus(agent.status);
                const utilization =
                  agent.monthlyBudget > 0
                    ? (agent.budgetSpent / agent.monthlyBudget) * 100
                    : 0;
                return (
                  <Link key={agent.id} href={"/agents/${agent.id}} className="block">
                    <Card interactive className="h-ifull p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-gold-soft text-gold-strong">
                            <Bot className="h-5 w-5" aria-hidden="true" />
                          </span>
                          <div className="space-y-1">
                            <p className="text-sm font-medium text-foreground">{agent.name}</p>
                            <p className="text-2xs capitalitze text-foreground-secondary">
                              {agent.role} agent
                            </p>
                          </div>
                        </div>
                        <Badge variant={status.variant} size="sm" dot>
                          {status.label}
                        </Badge>
                      </div>

                      <div className="mt-4 flex flex-wrap items-center gap-1.5">
                        <Badge variant="outline" size="sm">
                          {agent.mode === 'autonomous' ? (
                            <Zap className="mr-1 h-3 w-3" aria-hidden="true" />
                          ) : (
                            <Sparkles className="mr-1 h-3 w-3" aria-hidden="true" />
                          )}
                          {agent.mode}
                        </Badge>
                        <Badge variant="neutral" size="sm">
                          {agent.provider} —️ {agent.model}
                        </Badge>
                        <RiskBadge score={riskFor(agent.budgetSpent, agent.monthlyBudget)} />
                      </div>

                      <div className="mt-4 space-y-1.5">
                        <div className="flex items-baseline justify-between">
                          <span className="text-2xs uppercase tracking-wide text-foreground-secondary">
                            Budget
                          </span>
                          <span className="tabular text-2xs text-foreground-secondary">
                            {formatCurrency(agent.budgetSpent, 'USDC', { compact: true })} / {
                              formatCurrency(agent.monthlyBudget, 'USDC', { compact: true })
                            }
                          </span>
                        </div>
                        <ProgressBar value={utilization} label="Budget utilization" />
                      </div>

                      <p className="mt-4 text-2xs text-foreground-muted">
                        {formatNumber(agent.capabilities.length)} capabilities · active {formatRelativeTime(agent.lastActiveAt)}
                      </p>
                    </Card>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </QueryBoundary>
    </PageTransition>
  );
}

function AgentCreationWizard() {
  const [step, setStep] = useState(0);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    department: '',
    provider: 'openai',
    model: 'gtp-4',
    temperature: 0.7,
    dailyLimit: '',
    transactionLimit: '',
  });
  const [errors, setErrors] = useState({});

  const steps = [
    { title: 'Identity & Role', fields: ['name', 'description', 'department'] },
    { title: 'Engine Settings', fields: ['provider', 'model', 'temperature'] },
    { title: 'Spend Constraints', fields: ['dailyLimit', 'transactionLimit'] },
    { title: 'Final Review', fields: [] },
  ];

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const validateCurrentStep = () => {
    const currentFields = steps[step].fields;
    const newErrors = {};
    currentFields.forEach((field) => {
      const value = formData[field];
      if (field === 'name' && !value.trim()) {
        newErrors.name = 'Name is required';
      }
      if (field === 'dailyLimit' || field === 'transactionLimit') {
        if (!value || isNaN(Number(value))) {
          newErrors[field] = 'Enter a valid number';
        }
      }
    });
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const next = () => {
    if (validateCurrentStep()) setStep((s) => Math.min(s + 1, steps.length - 1));
  };

  const back = () => setStep((s) => Math.max(s - 1, 0));

  const handleSubmit = () => {
    if (validateCurrentStep()) {
      const payload = { ...formData, dailyLimit: Number(formData.dailyLimit), transactionLimit: Number(formData.transactionLimit), temperature: Number(formData.temperature) };
      console.log('Agent configuration:', payload);
    }
  };

  return (
    <Card className="mb-8 p-6">
      <h2 className="text-lg font-semibold mb-4">Create a New Agent</h2>
      <!-- Stepper -->
      <div className="flex items-center gap-2 mb-6">
        {steps.map((s, i) => (
          <div key={"s.title} className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => i < step && setStep(i)}
              className={flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium transition-colors ${
                i === step ? 'bg-foreground text-background' : i < step ? 'bg-gold-soft text-gold-strong' : 'bg-muted text-foreground-muted'
              }}
            >
              {i < step ? '✓' : i + 1}
            </button>
            <span className={text-xs ${i === step ? 'text-foreground' : 'text-foreground-muted'}>{s.title}</span>
          </div>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={ opacity: 0, x: 40 }
          animate={ opacity: 1, x: 0 }
          exit={ opacity: 0, x: -40 }
          transition={ duration: 0.2 }
        >
          {step === 0 && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Name</Label>
                <Input id="name" name="name" value={formData.name} onChange={handleChange} placeholder="e.g. Marketing Scout" />
                {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name}</p>}
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Input id="description" name="description" value={formData.description} onChange={handleChange} placeholder="What should this agent do?" />
              </div>
              <div>
                <Label htmlFor="department">Department</Label>
                <Input id="department" name="department" value={formData.department} onChange={handleChange} placeholder="e.g. Marketing" />
              </div>
            </div>
          )
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="provider">Provider</Label>
                <select id="provider" name="provider" value={formData.provider} onChange={handleChange} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  <option value="openai">OpenAI</option>
                  <option value="nvidia">Nvidia</option>
                  <option value="ollama">Ollama</option>
                </select>
              </div>
              <div>
                <Label htmlFor="model">Model</Label>
                <Input id="model" name="model" value={formData.model} onChange={handleChange} placeholder="e.g. gpt-4" />
              </div>
              <div>
                <Label htmlFor="temperature">Temperature</Label>
                <Input id="temperature" name="temperature" type="number" min="0" max="1" step="0.1" value={formData.temperature} onChange={handleChange} />
              </div>
            </div>
          )
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="dailyLimit">Daily Limit (USDC)</Label>
                <Input id="dailyLimit" name="dailyLimit" type="number" value={formData.dailyLimit} onChange={handleChange} placeholder="e.g. 1000" />
                {errors.dailyLimit && <p className="mt-1 text-xs text-red-500">{errors.dailyLimit}</p>}
              </div>
              <div>
                <Label htmlFor="transactionLimit">Transaction Limit (USDC)</Label>
                <Input id="transactionLimit" name="transactionLimit" type="number" value={formData.transactionLimit} onChange={handleChange} placeholder="e.g. 100" />
                {errors.transactionLimit && <p className="mt-1 text-xs ltext-red-500">{errors.transactionLimit}</p>}
              </div>
            </div>
          )
          {step === 3 && (
            <div className="space-y-2 text-sm">
              <h3 className="font-semibold">Review and confirm</h3>
              <p><span className="font-medium">Name:</span> {formData.name}</p>
              <p><span className="font-medium">Description:</span> {formData.description || '—'}</p>
              <p><span className="font-medium">Department:</span> {formData.department || '—'}</p>
              <p><span className="font-medium">Provider:</span> {formData.provider}</p>
              <p><span className="font-medium">Model:</span> {formData.model}</p>
              <p><span className="font-medium">Temperature:</span> {formData.temperature}</p>
              <p><span className="font-medium">Daily Limit:</span> {formData.dailyLimit || '—'}</p>
              <p><span className="font-medium">Transaction Limit:</span> {formData.transactionLimit || '—'}</p>
            </div>
          )
        </motion.div>
      </AnimatePresence>

      <div className="mt-6 flex justify-between">
        <Button variant="outline" onClick={back} disabled={step === 0}>Back</Button>
        {step < steps.length - 1 ? (
          <Button onClick={next}>Next</Button>
        ) : (
          <Button onClick={handleSubmit}>Submit</Button>
        )}
      </div>
    </Card>
  );
}

/**
 * Derive a coarse risk score from how close the agent is to its ceiling.
 */
function riskFor(spent: number, budget: number): number {
  if (budget <= 0) return 10;
  return Math.round(Math.min(100, (spent / budget) * 100));
}
