import { z } from 'zod';

export const ChatMessageSchema = z.object({
  id: z.string(),
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string().min(1),
  timestamp: z.number(),
  status: z.enum(['sending', 'streaming', 'done', 'error']).optional(),
  metadata: z
    .object({
      confidence: z.number().optional(),
      tokensUsed: z.number().optional(),
      model: z.string().optional(),
      suggestedActions: z.array(z.string()).optional(),
    })
    .optional(),
});

export type ChatMessage = z.infer<typeof ChatMessageSchema>;

export const SendMessagePayloadSchema = z.object({
  message: z.string().min(1, 'Message cannot be empty'),
  context: z
    .object({
      activeAgentId: z.string().optional(),
      timeframe: z.enum(['24h', '7d', '30d', 'all']).default('24h'),
    })
    .optional(),
});

export type SendMessagePayload = z.infer<typeof SendMessagePayloadSchema>;