'use client';

import { useCallback, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Check, Copy, Plus, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Tooltip } from '@/components/ui/tooltip';
import { useFreighterStore } from '@/stores/freighter-store';
import { truncateHash } from '@/lib/format';
import { copyToClipboard } from '../utils/assetUtils';
import { presetAssets } from '../mock-data';
import type { StellarAsset } from '../types';
import { AddAssetDialog } from './AddAssetDialog';

interface AssetDirectoryProps {
  walletId: string;
  /** Assets already held by this wallet (used to mark trustline status). */
  existingBalances: string[];
}

/**
 * Searchable Stellar asset directory with trustline creation.
 * Displays a filtered table of preset + custom assets with copy-to-clipboard
 * issuer addresses and a "Create Trustline" action per asset.
 */
export function AssetDirectory({
  walletId: _walletId,
  existingBalances,
}: AssetDirectoryProps) {
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [localAssets, setLocalAssets] = useState<StellarAsset[]>([]);
  const [signingAsset, setSigningAsset] = useState<string | null>(null);
  const [copiedIssuer, setCopiedIssuer] = useState<string | null>(null);

  const freighter = useFreighterStore();

  const allAssets = useMemo(() => {
    const balanceSet = new Set(
      existingBalances.map((a) => a.toUpperCase()),
    );

    const merged = [...presetAssets];
    for (const asset of localAssets) {
      if (!merged.some((a) => a.issuer === asset.issuer)) {
        merged.push(asset);
      }
    }

    return merged.map((asset) => ({
      ...asset,
      trustline: balanceSet.has(asset.code.toUpperCase())
        ? ('trusted' as const)
        : asset.trustline,
    }));
  }, [existingBalances, localAssets]);

  const filteredAssets = useMemo(() => {
    if (!search.trim()) return allAssets;
    const q = search.trim().toLowerCase();
    return allAssets.filter(
      (a) =>
        a.code.toLowerCase().includes(q) ||
        a.name.toLowerCase().includes(q) ||
        a.issuer.toLowerCase().includes(q),
    );
  }, [allAssets, search]);

  const handleCopyIssuer = useCallback(async (issuer: string) => {
    const ok = await copyToClipboard(issuer);
    if (ok) {
      setCopiedIssuer(issuer);
      toast.success('Issuer address copied to clipboard.');
      setTimeout(() => setCopiedIssuer(null), 2000);
    } else {
      toast.error('Failed to copy address.');
    }
  }, []);

  const handleCreateTrustline = useCallback(
    async (asset: StellarAsset) => {
      // Check if Freighter is installed
      const installed = await freighter.checkExtension();
      if (!installed) {
        toast.error(
          'Freighter wallet is not installed. Install the browser extension to create trustlines.',
        );
        return;
      }

      // Check if wallet is connected
      if (freighter.status !== 'connected') {
        toast.info(
          'Connecting to Freighter wallet. Approve the connection in your browser extension.',
        );
        const connected = await freighter.connect();
        if (!connected) {
          toast.error('Wallet connection was rejected.');
          return;
        }
      }

      setSigningAsset(asset.code);

      try {
        // Simulate trustline creation XDR for now.
        // In production this would build a real `changeTrust` operation XDR.
        const simulatedXdr = `AAAAAG${btoa(JSON.stringify({ asset: asset.code, issuer: asset.issuer })).slice(0, 40)}==`;

        await freighter.requestSignature(simulatedXdr);

        // Mark as trusted locally
        setLocalAssets((prev) => {
          const existing = prev.find((a) => a.issuer === asset.issuer);
          if (existing) {
            return prev.map((a) =>
              a.issuer === asset.issuer
                ? { ...a, trustline: 'trusted' as const }
                : a,
            );
          }
          return [...prev, { ...asset, trustline: 'trusted' as const }];
        });

        toast.success(`Trustline created for ${asset.code}.`, {
          icon: '✓',
        });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Trustline creation failed.';
        toast.error(message);
      } finally {
        setSigningAsset(null);
      }
    },
    [freighter],
  );

  const handleAddCustom = useCallback(
    (code: string, issuer: string) => {
      // Check for duplicates by issuer
      const exists = allAssets.some((a) => a.issuer === issuer);
      if (exists) {
        toast.warning('This asset already exists in the directory.');
        return;
      }

      setLocalAssets((prev) => [
        ...prev,
        {
          code: code.toUpperCase(),
          issuer,
          name: `${code.toUpperCase()} (Custom)`,
          verification: 'unverified' as const,
          trustline: 'untrusted' as const,
        },
      ]);

      toast.success(`${code.toUpperCase()} added to the directory.`);
    },
    [allAssets],
  );

  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Input
          placeholder="Search assets by code, name, or issuer…"
          leftIcon={<Search className="h-4 w-4" aria-hidden />}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search Stellar assets"
          className="sm:max-w-sm"
        />
        <Button
          variant="gold"
          size="sm"
          leftIcon={<Plus className="h-4 w-4" aria-hidden />}
          onClick={() => setDialogOpen(true)}
        >
          Add Custom Asset
        </Button>
      </div>

      {/* Asset table */}
      {filteredAssets.length === 0 ? (
        <Card className="flex flex-col items-center justify-center p-10 text-center">
          <p className="text-sm text-foreground-secondary">
            No assets match your search.
          </p>
          <p className="mt-1 text-2xs text-foreground-muted">
            Try a different code or issuer address.
          </p>
        </Card>
      ) : (
        <div className="overflow-hidden rounded-card border border-border bg-surface">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-secondary/40">
                  <th
                    scope="col"
                    className="px-5 py-3 text-left text-2xs font-medium uppercase tracking-wide text-foreground-secondary"
                  >
                    Asset
                  </th>
                  <th
                    scope="col"
                    className="px-5 py-3 text-left text-2xs font-medium uppercase tracking-wide text-foreground-secondary"
                  >
                    Issuer
                  </th>
                  <th
                    scope="col"
                    className="px-5 py-3 text-left text-2xs font-medium uppercase tracking-wide text-foreground-secondary hidden sm:table-cell"
                  >
                    Status
                  </th>
                  <th
                    scope="col"
                    className="px-5 py-3 text-right text-2xs font-medium uppercase tracking-wide text-foreground-secondary"
                  >
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredAssets.map((asset) => (
                  <tr
                    key={asset.issuer}
                    className="transition-colors duration-fast hover:bg-surface-secondary/30"
                  >
                    {/* Asset code + name */}
                    <td className="px-5 py-4">
                      <div className="flex flex-col gap-0.5">
                        <span className="font-medium text-foreground">
                          {asset.code}
                        </span>
                        <span className="text-2xs text-foreground-muted">
                          {asset.name}
                        </span>
                      </div>
                    </td>

                    {/* Issuer with truncated address + copy */}
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-foreground-secondary">
                          {truncateHash(asset.issuer, 6, 4)}
                        </span>
                        <Tooltip
                          content={
                            copiedIssuer === asset.issuer
                              ? 'Copied!'
                              : 'Copy issuer address'
                          }
                        >
                          <button
                            type="button"
                            onClick={() => handleCopyIssuer(asset.issuer)}
                            className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-sm text-foreground-muted transition-colors hover:bg-surface-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            aria-label={`Copy issuer address for ${asset.code}`}
                          >
                            {copiedIssuer === asset.issuer ? (
                              <Check className="h-3.5 w-3.5 text-success" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </Tooltip>
                      </div>
                    </td>

                    {/* Verification + trustline status */}
                    <td className="px-5 py-4 hidden sm:table-cell">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge
                          variant={
                            asset.verification === 'verified'
                              ? 'success'
                              : 'neutral'
                          }
                          size="sm"
                        >
                          {asset.verification === 'verified'
                            ? 'Verified'
                            : 'Unverified'}
                        </Badge>
                        {asset.trustline === 'trusted' && (
                          <Badge variant="gold" size="sm" dot>
                            Trusted
                          </Badge>
                        )}
                      </div>
                    </td>

                    {/* Trustline action */}
                    <td className="px-5 py-4 text-right">
                      {asset.trustline === 'trusted' ? (
                        <span className="inline-flex items-center gap-1 text-2xs font-medium text-success">
                          <Check className="h-3.5 w-3.5" aria-hidden />
                          Trusted
                        </span>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          loading={signingAsset === asset.code}
                          onClick={() => handleCreateTrustline(asset)}
                          aria-label={`Create trustline for ${asset.code}`}
                        >
                          Create Trustline
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Custom Asset dialog */}
      <AddAssetDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onAdd={handleAddCustom}
      />
    </div>
  );
}
