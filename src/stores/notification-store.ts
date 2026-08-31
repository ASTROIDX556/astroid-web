import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Alert category types
export type AlertCategory = 
  | 'budget_warning'
  | 'budget_exhaustion'
  | 'policy_violation'
  | 'proposal_created'
  | 'proposal_approved'
  | 'proposal_rejected'
  | 'agent_error'
  | 'system_alert';

// Delivery channel types
export type DeliveryChannel = 'email' | 'webhook' | 'in_app' | 'sms';

// Alert severity levels
export type AlertSeverity = 'info' | 'warning' | 'critical';

// Webhook endpoint interface
export interface WebhookEndpoint {
  id: string;
  name: string;
  url: string;
  isActive: boolean;
  lastTestedAt?: string;
  lastTestStatus?: 'success' | 'failed' | 'pending';
  createdAt: string;
}

// Alert rule configuration
export interface AlertRule {
  id: string;
  category: AlertCategory;
  severity: AlertSeverity;
  enabled: boolean;
  threshold?: number; // For budget-related alerts (percentage)
  deliveryChannels: DeliveryChannel[];
  webhookIds: string[]; // For webhook delivery
  emailRecipients: string[]; // For email delivery
  createdAt: string;
  updatedAt: string;
}

// Email digest configuration
export interface EmailDigestConfig {
  enabled: boolean;
  frequency: 'hourly' | 'daily' | 'weekly';
  recipients: string[];
  includeSummary: boolean;
}

// Notification preferences state
interface NotificationPreferencesState {
  // Webhook endpoints
  webhookEndpoints: WebhookEndpoint[];
  
  // Alert rules
  alertRules: AlertRule[];
  
  // Email digest configuration
  emailDigest: EmailDigestConfig;
  
  // In-app notification settings
  inAppNotifications: {
    enabled: boolean;
    sound: boolean;
    desktopNotifications: boolean;
  };
  
  // Actions
  addWebhookEndpoint: (endpoint: Omit<WebhookEndpoint, 'id' | 'createdAt'>) => void;
  updateWebhookEndpoint: (id: string, updates: Partial<WebhookEndpoint>) => void;
  removeWebhookEndpoint: (id: string) => void;
  testWebhookEndpoint: (id: string) => Promise<{ success: boolean; message: string }>;
  
  addAlertRule: (rule: Omit<AlertRule, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateAlertRule: (id: string, updates: Partial<AlertRule>) => void;
  removeAlertRule: (id: string) => void;
  toggleAlertRule: (id: string) => void;
  
  updateEmailDigest: (config: Partial<EmailDigestConfig>) => void;
  updateInAppNotifications: (config: Partial<NotificationPreferencesState['inAppNotifications']>) => void;
  
  // Getters
  getAlertRuleByCategory: (category: AlertCategory) => AlertRule | undefined;
  getActiveWebhooks: () => WebhookEndpoint[];
  getAlertsBySeverity: (severity: AlertSeverity) => AlertRule[];
}

// Default alert rules
const defaultAlertRules: AlertRule[] = [
  {
    id: 'rule-1',
    category: 'budget_warning',
    severity: 'warning',
    enabled: true,
    threshold: 75,
    deliveryChannels: ['email', 'in_app'],
    webhookIds: [],
    emailRecipients: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'rule-2',
    category: 'budget_exhaustion',
    severity: 'critical',
    enabled: true,
    threshold: 95,
    deliveryChannels: ['email', 'webhook', 'in_app'],
    webhookIds: [],
    emailRecipients: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'rule-3',
    category: 'policy_violation',
    severity: 'critical',
    enabled: true,
    deliveryChannels: ['email', 'webhook', 'in_app'],
    webhookIds: [],
    emailRecipients: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'rule-4',
    category: 'proposal_created',
    severity: 'info',
    enabled: true,
    deliveryChannels: ['in_app'],
    webhookIds: [],
    emailRecipients: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'rule-5',
    category: 'agent_error',
    severity: 'warning',
    enabled: true,
    deliveryChannels: ['email', 'in_app'],
    webhookIds: [],
    emailRecipients: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export const useNotificationStore = create<NotificationPreferencesState>()(
  persist(
    (set, get) => ({
      // Initial state
      webhookEndpoints: [],
      alertRules: defaultAlertRules,
      emailDigest: {
        enabled: true,
        frequency: 'daily',
        recipients: [],
        includeSummary: true,
      },
      inAppNotifications: {
        enabled: true,
        sound: true,
        desktopNotifications: false,
      },
      
      // Webhook endpoint actions
      addWebhookEndpoint: (endpoint) => {
        const newEndpoint: WebhookEndpoint = {
          ...endpoint,
          id: `wh-${Date.now()}`,
          createdAt: new Date().toISOString(),
        };
        set((state) => ({
          webhookEndpoints: [...state.webhookEndpoints, newEndpoint],
        }));
      },
      
      updateWebhookEndpoint: (id, updates) => {
        set((state) => ({
          webhookEndpoints: state.webhookEndpoints.map((endpoint) =>
            endpoint.id === id ? { ...endpoint, ...updates } : endpoint
          ),
        }));
      },
      
      removeWebhookEndpoint: (id) => {
        set((state) => ({
          webhookEndpoints: state.webhookEndpoints.filter((endpoint) => endpoint.id !== id),
        }));
      },
      
      testWebhookEndpoint: async (id) => {
        const endpoint = get().webhookEndpoints.find((wh) => wh.id === id);
        if (!endpoint) {
          return { success: false, message: 'Webhook not found' };
        }
        
        // Update status to pending
        set((state) => ({
          webhookEndpoints: state.webhookEndpoints.map((wh) =>
            wh.id === id ? { ...wh, lastTestStatus: 'pending' as const } : wh
          ),
        }));
        
        // Simulate webhook test with delay
        await new Promise((resolve) => setTimeout(resolve, 1500));
        
        // Simulate success/failure (90% success rate for demo)
        const success = Math.random() > 0.1;
        const status = success ? 'success' as const : 'failed' as const;
        
        set((state) => ({
          webhookEndpoints: state.webhookEndpoints.map((wh) =>
            wh.id === id
              ? {
                  ...wh,
                  lastTestedAt: new Date().toISOString(),
                  lastTestStatus: status,
                }
              : wh
          ),
        }));
        
        return {
          success,
          message: success
            ? `Webhook test successful! Ping sent to ${endpoint.url}`
            : `Webhook test failed. Could not reach ${endpoint.url}`,
        };
      },
      
      // Alert rule actions
      addAlertRule: (rule) => {
        const newRule: AlertRule = {
          ...rule,
          id: `rule-${Date.now()}`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        set((state) => ({
          alertRules: [...state.alertRules, newRule],
        }));
      },
      
      updateAlertRule: (id, updates) => {
        set((state) => ({
          alertRules: state.alertRules.map((rule) =>
            rule.id === id
              ? { ...rule, ...updates, updatedAt: new Date().toISOString() }
              : rule
          ),
        }));
      },
      
      removeAlertRule: (id) => {
        set((state) => ({
          alertRules: state.alertRules.filter((rule) => rule.id !== id),
        }));
      },
      
      toggleAlertRule: (id) => {
        set((state) => ({
          alertRules: state.alertRules.map((rule) =>
            rule.id === id
              ? { ...rule, enabled: !rule.enabled, updatedAt: new Date().toISOString() }
              : rule
          ),
        }));
      },
      
      // Email digest actions
      updateEmailDigest: (config) => {
        set((state) => ({
          emailDigest: { ...state.emailDigest, ...config },
        }));
      },
      
      // In-app notification actions
      updateInAppNotifications: (config) => {
        set((state) => ({
          inAppNotifications: { ...state.inAppNotifications, ...config },
        }));
      },
      
      // Getters
      getAlertRuleByCategory: (category) => {
        return get().alertRules.find((rule) => rule.category === category);
      },
      
      getActiveWebhooks: () => {
        return get().webhookEndpoints.filter((wh) => wh.isActive);
      },
      
      getAlertsBySeverity: (severity) => {
        return get().alertRules.filter((rule) => rule.severity === severity);
      },
    }),
    {
      name: 'astroid-notification-preferences',
    }
  )
);
