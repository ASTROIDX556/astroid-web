import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { agentCreationSchema, AgentCreationFormValues } from "../../lib/validations/agent";

interface AgentCreationFormProps {
  onSubmit: (data: AgentCreationFormValues) => void;
}

export const AgentCreationForm: React.FC<AgentCreationFormProps> = ({ onSubmit }) => {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<AgentCreationFormValues>({
    resolver: zodResolver(agentCreationSchema),
    defaultValues: {
      name: "",
      provider: "openai",
      model: "gpt-4",
      apiKey: "",
      endpointUrl: "",
      tokenLimit: 2048,
      spendingThreshold: 50,
    },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 max-w-lg">
      <div>
        <label className="block text-xs font-medium text-foreground">Agent Name</label>
        <input
          {...register("name")}
          className="mt-1 block w-full rounded-sm border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-foreground-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-border-strong"
        />
        {errors.name && <p className="text-2xs text-danger mt-1" role="alert">{errors.name.message}</p>}
      </div>

      <div>
        <label className="block text-xs font-medium text-foreground">Provider</label>
        <select
          {...register("provider")}
          className="mt-1 block w-full rounded-sm border border-border bg-surface px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="openai">OpenAI</option>
          <option value="anthropic">Anthropic</option>
          <option value="custom">Custom</option>
        </select>
        {errors.provider && <p className="text-2xs text-danger mt-1" role="alert">{errors.provider.message}</p>}
      </div>

      <div>
        <label className="block text-xs font-medium text-foreground">Model</label>
        <input
          {...register("model")}
          className="mt-1 block w-full rounded-sm border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-foreground-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        {errors.model && <p className="text-2xs text-danger mt-1" role="alert">{errors.model.message}</p>}
      </div>

      <div>
        <label className="block text-xs font-medium text-foreground">API Key</label>
        <input
          type="password"
          {...register("apiKey")}
          className="mt-1 block w-full rounded-sm border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-foreground-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        {errors.apiKey && <p className="text-2xs text-danger mt-1" role="alert">{errors.apiKey.message}</p>}
      </div>

      <div>
        <label className="block text-xs font-medium text-foreground">Endpoint URL</label>
        <input
          {...register("endpointUrl")}
          className="mt-1 block w-full rounded-sm border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-foreground-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        {errors.endpointUrl && <p className="text-2xs text-danger mt-1" role="alert">{errors.endpointUrl.message}</p>}
      </div>

      <div>
        <label className="block text-xs font-medium text-foreground">Token Limit</label>
        <input
          type="number"
          {...register("tokenLimit")}
          className="mt-1 block w-full rounded-sm border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-foreground-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        {errors.tokenLimit && <p className="text-2xs text-danger mt-1" role="alert">{errors.tokenLimit.message}</p>}
      </div>

      <div>
        <label className="block text-xs font-medium text-foreground">Spending Threshold ($)</label>
        <input
          type="number"
          step="0.01"
          {...register("spendingThreshold")}
          className="mt-1 block w-full rounded-sm border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-foreground-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        {errors.spendingThreshold && <p className="text-2xs text-danger mt-1" role="alert">{errors.spendingThreshold.message}</p>}
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="inline-flex w-full items-center justify-center rounded-button bg-gold px-4 py-2 text-sm font-medium text-accent-foreground shadow-soft-1 transition-all duration-base ease-astroid hover:shadow-gold hover:-translate-y-px disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        {isSubmitting ? "Creating..." : "Create Agent"}
      </button>
    </form>
  );
};
