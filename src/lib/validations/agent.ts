import { z } from "zod";

export const agentCreationSchema = z.object({
  name: z.string().min(2, "Agent name must be at least 2 characters").max(50, "Agent name must not exceed 50 characters"),
  provider: z.enum(["openai", "anthropic", "custom"], {
    required_error: "Please select a valid provider",
  }),
  model: z.string().min(1, "Model is required"),
  apiKey: z.string().optional(),
  endpointUrl: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  tokenLimit: z.coerce.number().int().positive("Token limit must be a positive integer"),
  spendingThreshold: z.coerce.number().nonnegative("Spending threshold must be a non-negative number"),
});

export type AgentCreationFormValues = z.infer<typeof agentCreationSchema>;

export const agentConfigSchema = agentCreationSchema.extend({
  id: z.string().uuid("Invalid agent ID"),
  isActive: z.boolean(),
});

export type AgentConfigFormValues = z.infer<typeof agentConfigSchema>;
