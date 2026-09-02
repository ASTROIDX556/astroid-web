'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import {
  Bell,
  Webhook,
  Mail,
  BellRing,
  Plus,
  Trash2,
  Check,
  X,
  AlertTriangle,
  Zap,
  Shield,
  FileText,
  Settings,
  Send,
  Loader2,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog } from '@/components/ui/dialog';
import {
  useNotificationStore,
  type AlertCategory,
  type AlertSeverity,
} from '@/stores';

// Alert category definitions
const ALERT_CATEGORIES: { category: AlertCategory; label: string; description: string; icon: React.ReactNode; severity: AlertSeverity }[] = [
  {
    category: 'budget_warning',
    label: 'Budget Warning',
    description: 'Alert when budget usage exceeds threshold',
    icon: <AlertTriangle className="h-4 w-4 text-warning" />,
    severity: 'warning',
  },
  {
    category: 'budget_exhaustion',
    label: 'Budget Exhaustion',
    description: 'Critical alert when budget is nearly depleted',
    icon: <AlertTriangle className="h-4 w-4 text-danger" />,
    severity: 'critical',
  },
  {
    category: 'policy_violation',
    label: 'Policy Violation',
    description: 'Alert when agent violates spending policy',
    icon: <Shield className="h-4 w-4 text-danger" />,
    severity: 'critical',
  },
  {
    category: 'proposal_created',
    label: 'Proposal Created',
    description: 'Notification when new proposal is submitted',
    icon: <FileText className="h-4 w-4 text-info" />,
    severity: 'info',
  },
  {
    category: 'proposal_approved',
    label: 'Proposal Approved',
    description: 'Notification when proposal is approved',
    icon: <Check className="h-4 w-4 text-success" />,
    severity: 'info',
  },
  {
    category: 'proposal_rejected',
    label: 'Proposal Rejected',
    description: 'Notification when proposal is rejected',
    icon: <X className="h-4 w-4 text-warning" />,
    severity: 'warning',
  },
  {
    category: 'agent_error',
    label: 'Agent Error',
    description: 'Alert when agent encounters runtime error',
    icon: <Zap className="h-4 w-4 text-warning" />,
    severity: 'warning',
  },
  {
    category: 'system_alert',
    label: 'System Alert',
    description: 'Critical system-wide alerts and maintenance notices',
    icon: <Settings className="h-4 w-4 text-foreground-muted" />,
    severity: 'info',
  },
];

// Webhook URL validation schema
const webhookSchema = z.object({
  name: z.string().min(1, 'Webhook name is required'),
  url: z.string().url('Please enter a valid URL').refine(
    (url) => url.startsWith('http://') || url.startsWith('https://'),
    'URL must start with http:// or https://'
  ),
});

type WebhookFormValues = z.infer<typeof webhookSchema>;

// Email validation schema
const emailSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
});

type EmailFormValues = z.infer<typeof emailSchema>;

export function NotificationPreferences() {
  const {
    webhookEndpoints,
    alertRules,
    emailDigest,
    inAppNotifications,
    addWebhookEndpoint,
    updateWebhookEndpoint,
    removeWebhookEndpoint,
    testWebhookEndpoint,
    updateAlertRule,
    toggleAlertRule,
    updateEmailDigest,
    updateInAppNotifications,
  } = useNotificationStore();

  const [isAddWebhookOpen, setIsAddWebhookOpen] = useState(false);
  const [isAddEmailOpen, setIsAddEmailOpen] = useState(false);
  const [testingWebhookId, setTestingWebhookId] = useState<string | null>(null);

  const webhookForm = useForm<WebhookFormValues>({
    resolver: zodResolver(webhookSchema),
    defaultValues: {
      name: '',
      url: '',
    },
  });

  const emailForm = useForm<EmailFormValues>({
    resolver: zodResolver(emailSchema),
    defaultValues: {
      email: '',
    },
  });

  // Handle webhook form submission
  const handleWebhookSubmit = (values: WebhookFormValues) => {
    addWebhookEndpoint({
      name: values.name,
      url: values.url,
      isActive: true,
    });
    setIsAddWebhookOpen(false);
    webhookForm.reset();
    toast.success('Webhook endpoint added successfully');
  };

  // Handle email form submission
  const handleEmailSubmit = (values: EmailFormValues) => {
    updateEmailDigest({
      recipients: [...emailDigest.recipients, values.email],
    });
    setIsAddEmailOpen(false);
    emailForm.reset();
    toast.success('Email recipient added successfully');
  };

  // Handle webhook test
  const handleTestWebhook = async (webhookId: string) => {
    setTestingWebhookId(webhookId);
    const result = await testWebhookEndpoint(webhookId);
    setTestingWebhookId(null);
    
    if (result.success) {
      toast.success(result.message);
    } else {
      toast.error(result.message);
    }
  };

  // Handle remove email recipient
  const handleRemoveEmail = (email: string) => {
    updateEmailDigest({
      recipients: emailDigest.recipients.filter((e) => e !== email),
    });
    toast.success('Email recipient removed');
  };

  // Get severity badge variant
  const getSeverityBadge = (severity: AlertSeverity) => {
    switch (severity) {
      case 'critical':
        return 'danger';
      case 'warning':
        return 'warning';
      case 'info':
        return 'info';
      default:
        return 'neutral';
    }
  };

  return (
    <div className="space-y-8">
      {/* Section Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <h3 className="font-display text-lg font-semibold tracking-tight flex items-center gap-2">
            <Bell className="h-5 w-5 text-gold" />
            <span>Notification Preferences & Alert Rules</span>
          </h3>
          <p className="text-xs text-foreground-secondary">
            Configure webhook endpoints, email digests, and threshold alerts for agent budget exhaustion or policy breaches.
          </p>
        </div>
      </div>

      {/* Alert Categories Section */}
      <Card className="overflow-hidden border border-border">
        <div className="p-4 border-b border-border bg-surface-secondary/40 flex items-center justify-between">
          <h4 className="font-semibold text-foreground text-sm flex items-center gap-2">
            <BellRing className="h-4 w-4 text-gold" />
            <span>Alert Categories</span>
          </h4>
          <Badge variant="outline" size="sm">
            {alertRules.filter((r) => r.enabled).length} Active
          </Badge>
        </div>

        <div className="p-4 space-y-4">
          {ALERT_CATEGORIES.map((alertDef) => {
            const rule = alertRules.find((r) => r.category === alertDef.category);
            const isEnabled = rule?.enabled ?? false;
            const threshold = rule?.threshold;

            return (
              <div
                key={alertDef.category}
                className="flex items-center justify-between p-3 rounded-button border border-border hover:bg-surface-secondary/30 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0">{alertDef.icon}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground text-sm">{alertDef.label}</span>
                      <Badge variant={getSeverityBadge(alertDef.severity)} size="sm">
                        {alertDef.severity}
                      </Badge>
                    </div>
                    <p className="text-xs text-foreground-muted mt-0.5">{alertDef.description}</p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  {/* Threshold input for budget-related alerts */}
                  {(alertDef.category === 'budget_warning' || alertDef.category === 'budget_exhaustion') && (
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-foreground-secondary">Threshold:</label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={threshold ?? 75}
                        onChange={(e) => {
                          if (rule) {
                            updateAlertRule(rule.id, {
                              threshold: Math.min(100, Math.max(0, parseInt(e.target.value) || 0)),
                            });
                          }
                        }}
                        className="w-16 rounded-button border border-border bg-surface px-2 py-1 text-xs text-foreground text-center focus:border-gold focus:outline-none"
                        disabled={!isEnabled}
                      />
                      <span className="text-xs text-foreground-muted">%</span>
                    </div>
                  )}

                  {/* Toggle switch */}
                  <button
                    type="button"
                    onClick={() => {
                      if (rule) {
                        toggleAlertRule(rule.id);
                      }
                    }}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      isEnabled ? 'bg-gold' : 'bg-surface-secondary border border-border'
                    }`}
                    aria-label={`Toggle ${alertDef.label}`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        isEnabled ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Webhook Endpoints Section */}
      <Card className="overflow-hidden border border-border">
        <div className="p-4 border-b border-border bg-surface-secondary/40 flex items-center justify-between">
          <h4 className="font-semibold text-foreground text-sm flex items-center gap-2">
            <Webhook className="h-4 w-4 text-gold" />
            <span>Webhook Endpoints</span>
          </h4>
          <button
            type="button"
            onClick={() => setIsAddWebhookOpen(true)}
            className="flex items-center gap-1.5 rounded-button bg-gold px-3 py-1.5 text-xs font-bold text-surface-dark shadow-gold hover:bg-gold-light transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add Webhook</span>
          </button>
        </div>

        <div className="p-4">
          {webhookEndpoints.length === 0 ? (
            <div className="text-center py-8 text-foreground-muted">
              <Webhook className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No webhook endpoints configured</p>
              <p className="text-xs mt-1">Add a webhook to receive real-time notifications</p>
            </div>
          ) : (
            <div className="space-y-3">
              {webhookEndpoints.map((webhook) => (
                <div
                  key={webhook.id}
                  className="flex items-center justify-between p-3 rounded-button border border-border hover:bg-surface-secondary/30 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground text-sm">{webhook.name}</span>
                      <Badge variant={webhook.isActive ? 'success' : 'neutral'} size="sm">
                        {webhook.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                      {webhook.lastTestStatus && (
                        <Badge
                          variant={
                            webhook.lastTestStatus === 'success'
                              ? 'success'
                              : webhook.lastTestStatus === 'failed'
                              ? 'danger'
                              : 'warning'
                          }
                          size="sm"
                        >
                          {webhook.lastTestStatus === 'success' && <CheckCircle className="h-3 w-3" />}
                          {webhook.lastTestStatus === 'failed' && <XCircle className="h-3 w-3" />}
                          {webhook.lastTestStatus === 'pending' && <Loader2 className="h-3 w-3 animate-spin" />}
                          {webhook.lastTestStatus}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs font-mono text-foreground-muted mt-1 truncate">{webhook.url}</p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleTestWebhook(webhook.id)}
                      disabled={testingWebhookId === webhook.id}
                      className="flex items-center gap-1.5 rounded-button border border-border bg-surface px-2.5 py-1.5 text-xs text-foreground-secondary hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {testingWebhookId === webhook.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Send className="h-3.5 w-3.5" />
                      )}
                      <span>{testingWebhookId === webhook.id ? 'Testing...' : 'Test'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => updateWebhookEndpoint(webhook.id, { isActive: !webhook.isActive })}
                      className={`p-1.5 rounded-button transition-colors ${
                        webhook.isActive
                          ? 'text-success hover:bg-success-soft'
                          : 'text-foreground-muted hover:bg-surface-secondary'
                      }`}
                      title={webhook.isActive ? 'Deactivate webhook' : 'Activate webhook'}
                    >
                      <Check className="h-4 w-4" />
                    </button>

                    <button
                      type="button"
                      onClick={() => removeWebhookEndpoint(webhook.id)}
                      className="p-1.5 rounded-button text-foreground-muted hover:text-rose-400 hover:bg-rose-400/10 transition-colors"
                      title="Remove webhook"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

      {/* Email Digest Configuration */}
      <Card className="overflow-hidden border border-border">
        <div className="p-4 border-b border-border bg-surface-secondary/40 flex items-center justify-between">
          <h4 className="font-semibold text-foreground text-sm flex items-center gap-2">
            <Mail className="h-4 w-4 text-gold" />
            <span>Email Digest Configuration</span>
          </h4>
          <button
            type="button"
            onClick={() => setIsAddEmailOpen(true)}
            className="flex items-center gap-1.5 rounded-button bg-gold px-3 py-1.5 text-xs font-bold text-surface-dark shadow-gold hover:bg-gold-light transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add Recipient</span>
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Enable/disable email digest */}
          <div className="flex items-center justify-between">
            <div>
              <span className="font-semibold text-foreground text-sm">Enable Email Digest</span>
              <p className="text-xs text-foreground-muted">Receive summarized notifications via email</p>
            </div>
            <button
              type="button"
              onClick={() => updateEmailDigest({ enabled: !emailDigest.enabled })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                emailDigest.enabled ? 'bg-gold' : 'bg-surface-secondary border border-border'
              }`}
              aria-label="Toggle email digest"
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  emailDigest.enabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Frequency selection */}
          {emailDigest.enabled && (
            <div className="flex items-center gap-4">
              <label className="text-sm text-foreground-secondary">Frequency:</label>
              <select
                value={emailDigest.frequency}
                onChange={(e) =>
                  updateEmailDigest({
                    frequency: e.target.value as 'hourly' | 'daily' | 'weekly',
                  })
                }
                className="rounded-button border border-border bg-surface px-3 py-1.5 text-xs text-foreground focus:border-gold focus:outline-none"
              >
                <option value="hourly">Hourly</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
              </select>
            </div>
          )}

          {/* Email recipients list */}
          {emailDigest.enabled && emailDigest.recipients.length > 0 && (
            <div className="space-y-2">
              <label className="text-xs font-semibold text-foreground-secondary">Recipients:</label>
              <div className="flex flex-wrap gap-2">
                {emailDigest.recipients.map((email) => (
                  <div
                    key={email}
                    className="flex items-center gap-1.5 rounded-button border border-border bg-surface-secondary px-2.5 py-1"
                  >
                    <span className="text-xs text-foreground">{email}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveEmail(email)}
                      className="text-foreground-muted hover:text-rose-400 transition-colors"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Include summary toggle */}
          {emailDigest.enabled && (
            <div className="flex items-center justify-between pt-2 border-t border-border">
              <div>
                <span className="font-semibold text-foreground text-sm">Include Summary</span>
                <p className="text-xs text-foreground-muted">Include a digest summary in each email</p>
              </div>
              <button
                type="button"
                onClick={() => updateEmailDigest({ includeSummary: !emailDigest.includeSummary })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  emailDigest.includeSummary ? 'bg-gold' : 'bg-surface-secondary border border-border'
                }`}
                aria-label="Toggle include summary"
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    emailDigest.includeSummary ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          )}
        </div>
      </Card>

      {/* In-App Notification Settings */}
      <Card className="overflow-hidden border border-border">
        <div className="p-4 border-b border-border bg-surface-secondary/40">
          <h4 className="font-semibold text-foreground text-sm flex items-center gap-2">
            <BellRing className="h-4 w-4 text-gold" />
            <span>In-App Notification Settings</span>
          </h4>
        </div>

        <div className="p-4 space-y-4">
          {/* Enable in-app notifications */}
          <div className="flex items-center justify-between">
            <div>
              <span className="font-semibold text-foreground text-sm">Enable In-App Notifications</span>
              <p className="text-xs text-foreground-muted">Show notifications within the application</p>
            </div>
            <button
              type="button"
              onClick={() => updateInAppNotifications({ enabled: !inAppNotifications.enabled })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                inAppNotifications.enabled ? 'bg-gold' : 'bg-surface-secondary border border-border'
              }`}
              aria-label="Toggle in-app notifications"
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  inAppNotifications.enabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Sound notifications */}
          {inAppNotifications.enabled && (
            <div className="flex items-center justify-between pt-2 border-t border-border">
              <div>
                <span className="font-semibold text-foreground text-sm">Notification Sound</span>
                <p className="text-xs text-foreground-muted">Play a sound when notifications arrive</p>
              </div>
              <button
                type="button"
                onClick={() => updateInAppNotifications({ sound: !inAppNotifications.sound })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  inAppNotifications.sound ? 'bg-gold' : 'bg-surface-secondary border border-border'
                }`}
                aria-label="Toggle notification sound"
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    inAppNotifications.sound ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          )}

          {/* Desktop notifications */}
          {inAppNotifications.enabled && (
            <div className="flex items-center justify-between pt-2 border-t border-border">
              <div>
                <span className="font-semibold text-foreground text-sm">Desktop Notifications</span>
                <p className="text-xs text-foreground-muted">Show browser desktop notifications</p>
              </div>
              <button
                type="button"
                onClick={() => updateInAppNotifications({ desktopNotifications: !inAppNotifications.desktopNotifications })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  inAppNotifications.desktopNotifications ? 'bg-gold' : 'bg-surface-secondary border border-border'
                }`}
                aria-label="Toggle desktop notifications"
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    inAppNotifications.desktopNotifications ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          )}
        </div>
      </Card>

      {/* Add Webhook Modal */}
      {isAddWebhookOpen && (
        <Dialog open={isAddWebhookOpen} onClose={() => setIsAddWebhookOpen(false)} title="Add Webhook Endpoint" size="sm">
          <form onSubmit={webhookForm.handleSubmit(handleWebhookSubmit)} className="space-y-4 pt-2">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground">Webhook Name</label>
              <input
                type="text"
                placeholder="e.g. Production Alerts"
                {...webhookForm.register('name')}
                className="w-full rounded-button border border-border bg-surface px-3 py-2 text-xs text-foreground focus:border-gold focus:outline-none"
              />
              {webhookForm.formState.errors.name && (
                <p className="text-2xs text-rose-400">{webhookForm.formState.errors.name.message}</p>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground">Webhook URL</label>
              <input
                type="url"
                placeholder="https://your-endpoint.com/webhook"
                {...webhookForm.register('url')}
                className="w-full rounded-button border border-border bg-surface px-3 py-2 text-xs font-mono text-foreground focus:border-gold focus:outline-none"
              />
              {webhookForm.formState.errors.url && (
                <p className="text-2xs text-rose-400">{webhookForm.formState.errors.url.message}</p>
              )}
              <p className="text-2xs text-foreground-muted">
                We&apos;ll send a POST request with a test payload to verify the endpoint
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-border">
              <button
                type="button"
                onClick={() => setIsAddWebhookOpen(false)}
                className="rounded-button border border-border bg-surface px-3 py-1.5 text-xs text-foreground-secondary hover:text-foreground"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-button bg-gold px-4 py-1.5 text-xs font-bold text-surface-dark shadow-gold hover:bg-gold-light"
              >
                Add Webhook
              </button>
            </div>
          </form>
        </Dialog>
      )}

      {/* Add Email Recipient Modal */}
      {isAddEmailOpen && (
        <Dialog open={isAddEmailOpen} onClose={() => setIsAddEmailOpen(false)} title="Add Email Recipient" size="sm">
          <form onSubmit={emailForm.handleSubmit(handleEmailSubmit)} className="space-y-4 pt-2">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground">Email Address</label>
              <input
                type="email"
                placeholder="user@example.com"
                {...emailForm.register('email')}
                className="w-full rounded-button border border-border bg-surface px-3 py-2 text-xs font-mono text-foreground focus:border-gold focus:outline-none"
              />
              {emailForm.formState.errors.email && (
                <p className="text-2xs text-rose-400">{emailForm.formState.errors.email.message}</p>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-border">
              <button
                type="button"
                onClick={() => setIsAddEmailOpen(false)}
                className="rounded-button border border-border bg-surface px-3 py-1.5 text-xs text-foreground-secondary hover:text-foreground"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-button bg-gold px-4 py-1.5 text-xs font-bold text-surface-dark shadow-gold hover:bg-gold-light"
              >
                Add Recipient
              </button>
            </div>
          </form>
        </Dialog>
      )}
    </div>
  );
}
