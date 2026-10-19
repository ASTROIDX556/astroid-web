import { z } from "zod";

export const agentCreationSchema = z.object({
  name: z.string().min(1, "Agent name is required").max(50, "Agent name must be at most 50 characters"),
  provider: z.string().min(1, "Provider selection is required"),
  model: z.string().min(1, "Model selection is required"),
  apiKey: z.string().optional(),
  endpointUrl: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  tokenLimit: z.number().positive("Token limit must be positive"),
  spendingThreshold: z.number().min(0, "Spending threshold cannot be negative"),
});

export const agentSettingsSchema = agentCreationSchema.partial().extend({
  id: z.string().min(1, "Agent ID is required"),
});

export type AgentCreationFormData = z.infer<typeof agentCreationSchema>;
export type AgentSettingsFormData = z.infer<typeof agentSettingsSchema>;
export const agentSettingsValidationSchema = agentSettingsSchema;
