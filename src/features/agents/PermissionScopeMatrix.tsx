'use client';

import type { FieldErrors, UseFormRegister, UseFormWatch } from 'react-hook-form';
import {
  AGENT_ASSET_CODES,
  type AgentAssetCode,
  type CreateAgentInput,
} from './schema';

const ASSET_LABELS: Record<AgentAssetCode, string> = {
  USDC: 'USD Coin',
  XLM: 'Stellar Lumens',
  EURC: 'Euro Coin',
  ASTRO: 'Astroid',
};

interface PermissionScopeMatrixProps {
  register: UseFormRegister<CreateAgentInput>;
  watch: UseFormWatch<CreateAgentInput>;
  errors: FieldErrors<CreateAgentInput>;
}

export function PermissionScopeMatrix({
  register,
  watch,
  errors,
}: PermissionScopeMatrixProps) {
  return (
    <fieldset className="space-y-3 rounded-card border border-border bg-surface-secondary p-4">
      <legend className="px-1 text-2xs font-semibold uppercase tracking-wide text-foreground-secondary">
        Asset permissions
      </legend>
      <p className="text-xs text-foreground-secondary">
        Allow specific Stellar assets and set a maximum spend for each enabled asset.
      </p>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[32rem] text-left text-xs">
          <thead>
            <tr className="border-b border-border text-foreground-secondary">
              <th scope="col" className="py-2 pr-3 font-medium">
                Asset
              </th>
              <th scope="col" className="py-2 pr-3 font-medium">
                Permission
              </th>
              <th scope="col" className="py-2 font-medium">
                Maximum spend
              </th>
            </tr>
          </thead>
          <tbody>
            {AGENT_ASSET_CODES.map((asset) => {
              const allowed = watch(`assetPermissions.${asset}.allowed`);
              const limitError = errors.assetPermissions?.[asset]?.maxSpend?.message;
              const limitId = `agent-asset-${asset.toLowerCase()}-limit`;
              const errorId = `${limitId}-error`;

              return (
                <tr key={asset} className="border-b border-border/60 last:border-0">
                  <th scope="row" className="py-3 pr-3 font-medium text-foreground">
                    <span className="block">{asset}</span>
                    <span className="text-2xs font-normal text-foreground-muted">
                      {ASSET_LABELS[asset]}
                    </span>
                  </th>
                  <td className="py-3 pr-3">
                    <label className="inline-flex items-center gap-2 text-foreground-secondary">
                      <input
                        type="checkbox"
                        aria-label={`Allow ${asset}`}
                        className="h-4 w-4 accent-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        {...register(`assetPermissions.${asset}.allowed`)}
                      />
                      Allow
                    </label>
                  </td>
                  <td className="py-3">
                    <label className="sr-only" htmlFor={limitId}>
                      Maximum spend for {asset}
                    </label>
                    <input
                      id={limitId}
                      type="number"
                      min="0.01"
                      max="1000000"
                      step="0.01"
                      inputMode="decimal"
                      placeholder="Set a limit"
                      disabled={!allowed}
                      aria-invalid={Boolean(limitError)}
                      aria-describedby={limitError ? errorId : undefined}
                      className="w-40 rounded-button border border-border bg-surface px-3 py-2 text-xs text-foreground placeholder:text-foreground-muted focus:border-gold focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                      {...register(`assetPermissions.${asset}.maxSpend`, {
                        setValueAs: (value: string) =>
                          value === '' ? null : Number(value),
                      })}
                    />
                    {limitError && (
                      <span id={errorId} className="mt-1 block text-2xs text-danger">
                        {limitError}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </fieldset>
  );
}

export default PermissionScopeMatrix;
