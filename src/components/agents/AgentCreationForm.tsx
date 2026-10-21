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
        <label className="block text-sm font-medium">Agent Name</label>
        <input {...register("name")} className="mt-1 block w-full rounded-md border p-2" />
        {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name.message}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium">Provider</label>
        <select {...register("provider")} className="mt-1 block w-full rounded-md border p-2">
          <option value="openai">OpenAI</option>
          <option value="anthropic">Anthropic</option>
          <option value="custom">Custom</option>
        </select>
        {errors.provider && <p className="text-red-500 text-sm mt-1">{errors.provider.message}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium">Model</label>
        <input {...register("model")} className="mt-1 block w-full rounded-md border p-2" />
        {errors.model && <p className="text-red-500 text-sm mt-1">{errors.model.message}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium">API Key</label>
        <input type="password" {...register("apiKey")} className="mt-1 block w-full rounded-md border p-2" />
        {errors.apiKey && <p className="text-red-500 text-sm mt-1">{errors.apiKey.message}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium">Endpoint URL</label>
        <input {...register("endpointUrl")} className="mt-1 block w-full rounded-md border p-2" />
        {errors.endpointUrl && <p className="text-red-500 text-sm mt-1">{errors.endpointUrl.message}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium">Token Limit</label>
        <input type="number" {...register("tokenLimit")} className="mt-1 block w-full rounded-md border p-2" />
        {errors.tokenLimit && <p className="text-red-500 text-sm mt-1">{errors.tokenLimit.message}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium">Spending Threshold ($)</label>
        <input type="number" step="0.01" {...register("spendingThreshold")} className="mt-1 block w-full rounded-md border p-2" />
        {errors.spendingThreshold && <p className="text-red-500 text-sm mt-1">{errors.spendingThreshold.message}</p>}
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full bg-blue-600 text-white p-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
      >
        {isSubmitting ? "Creating..." : "Create Agent"}
      </button>
    </form>
  );
};
