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

  return (
    <form onSubmit={handleSubmit(handleSubmitEnhanced)} className="space-y-4" noValidate>
      <div>
        <label className="block text-sm font-medium">Agent Name</label>
        <input {...register("name")} className="mt-1 block w-full border rounded p-2" />
        {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name.message}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium">Provider</label>
        <input {...register("provider")} className="mt-1 block w-full border rounded p-2" />
        {errors.provider && <p className="text-red-500 text-sm mt-1">{errors.provider.message}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium">Model</label>
        <input {...register("model")} className="mt-1 block w-full border rounded p-2" />
        {errors.model && <p className="text-red-500 text-sm mt-1">{errors.model.message}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium">API Key (Optional)</label>
        <input type="password" {...register("apiKey")} className="mt-1 block w-full border rounded p-2" />
        {errors.apiKey && <p className="text-red-500 text-sm mt-1">{errors.apiKey.message}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium">Endpoint URL (Optional)</label>
        <input {...register("endpointUrl")} className="mt-1 block w-full border rounded p-2" />
        {errors.endpointUrl && <p className="text-red-500 text-sm mt-1">{errors.endpointUrl.message}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium">Token Limit</label>
        <input type="number" {...register("tokenLimit", { valueAsNumber: true })} className="mt-1 block w-full border rounded p-2" />
        {errors.tokenLimit && <p className="text-red-500 text-sm mt-1">{errors.tokenLimit.message}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium">Spending Threshold</label>
        <input type="number" {...register("spendingThreshold", { valueAsNumber: true })} className="mt-1 block w-full border rounded p-2" />
        {errors.spendingThreshold && <p className="text-red-500 text-sm mt-1">{errors.spendingThreshold.message}</p>}
      </div>

      <button type="submit" className="w-full bg-primary text-primary-foreground py-2 px-4 rounded hover:bg-primary/95">
        Create Agent
      </button>
    </form>
  );
};
