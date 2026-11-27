import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { agentCreationSchema, type AgentCreationFormData } from "../validations/agent";

export interface AgentCreationFormProps {
  onSubmit: (data: AgentCreationFormData) => void;
}

export const AgentCreationForm: React.FC<AgentCreationFormProps> = ({ onSubmit }) => {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<AgentCreationFormData>({
    resolver: zodResolver(agentCreationSchema),
    defaultValues: {
      name: "",
      provider: "",
      model: "",
      apiKey: "",
      endpointUrl: "",
      tokenLimit: 1000,
      spendingThreshold: 0,
    },
  });

  const handleSubmitEnhanced = (data: AgentCreationFormData) => {
    onSubmit(data);
  };

  const inputClass =
    'mt-1 block w-full rounded-sm border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-foreground-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-border-strong';

  return (
    <form onSubmit={handleSubmit(handleSubmitEnhanced)} className="space-y-4" noValidate>
      <div>
        <label className="block text-xs font-medium text-foreground">Agent Name</label>
        <input {...register("name")} className={inputClass} />
        {errors.name && <p className="text-2xs text-danger mt-1" role="alert">{errors.name.message}</p>}
      </div>

      <div>
        <label className="block text-xs font-medium text-foreground">Provider</label>
        <input {...register("provider")} className={inputClass} />
        {errors.provider && <p className="text-2xs text-danger mt-1" role="alert">{errors.provider.message}</p>}
      </div>

      <div>
        <label className="block text-xs font-medium text-foreground">Model</label>
        <input {...register("model")} className={inputClass} />
        {errors.model && <p className="text-2xs text-danger mt-1" role="alert">{errors.model.message}</p>}
      </div>

      <div>
        <label className="block text-xs font-medium text-foreground">API Key (Optional)</label>
        <input type="password" {...register("apiKey")} className={inputClass} />
        {errors.apiKey && <p className="text-2xs text-danger mt-1" role="alert">{errors.apiKey.message}</p>}
      </div>

      <div>
        <label className="block text-xs font-medium text-foreground">Endpoint URL (Optional)</label>
        <input {...register("endpointUrl")} className={inputClass} />
        {errors.endpointUrl && <p className="text-2xs text-danger mt-1" role="alert">{errors.endpointUrl.message}</p>}
      </div>

      <div>
        <label className="block text-xs font-medium text-foreground">Token Limit</label>
        <input type="number" {...register("tokenLimit", { valueAsNumber: true })} className={inputClass} />
        {errors.tokenLimit && <p className="text-2xs text-danger mt-1" role="alert">{errors.tokenLimit.message}</p>}
      </div>

      <div>
        <label className="block text-xs font-medium text-foreground">Spending Threshold</label>
        <input type="number" {...register("spendingThreshold", { valueAsNumber: true })} className={inputClass} />
        {errors.spendingThreshold && <p className="text-2xs text-danger mt-1" role="alert">{errors.spendingThreshold.message}</p>}
      </div>

      <button
        type="submit"
        className="inline-flex w-full items-center justify-center rounded-button bg-gold px-4 py-2 text-sm font-medium text-accent-foreground shadow-soft-1 transition-all duration-base ease-astroid hover:shadow-gold hover:-translate-y-px disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        Create Agent
      </button>
    </form>
  );
};
