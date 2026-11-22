'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Search, Wallet } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/cn';
import { formatNumber } from '@/lib/format';
import { formatStellarAddress } from '@/lib/stellar';

/**
 * A single selectable asset row. `id` must be unique per issuer — two
 * trustlines can share a symbol (e.g. USDC issued by different anchors).
 */
export interface SelectableAsset {
  /** Stable unique key, e.g. `USDC:GABC…` or `XLM` for the native asset. */
  id: string;
  /** Asset code / symbol, e.g. 'USDC'. */
  symbol: string;
  /** Stellar issuer public key; omit/null for the native asset. */
  issuer?: string | null;
  /** Optional human-readable asset name shown under the symbol. */
  name?: string;
  /** Current balance; `<= 0` renders an informative "Zero balance" badge. */
  balance?: number;
  /** Optional icon URL; rendered as an image when provided. */
  iconUrl?: string;
  /**
   * Whether the account holds a trustline for this asset. `false` renders a
   * "No trustline" badge; omit for assets where the concept does not apply.
   */
  hasTrustline?: boolean;
}

export interface AssetSelectorProps {
  assets: readonly SelectableAsset[];
  /** Selected asset id, or `null` for "All assets". */
  value: string | null;
  onChange: (assetId: string | null) => void;
  /** Visible label for the control group. */
  label?: string;
  /** Placeholder text inside the search field. */
  searchPlaceholder?: string;
  className?: string;
}

const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background';

/** Case-insensitive match against symbol, name, and issuer address. */
function assetMatches(asset: SelectableAsset, query: string): boolean {
  if (!query) return true;
  const haystack = [asset.symbol, asset.name ?? '', asset.issuer ?? '']
    .join(' ')
    .toLowerCase();
  return haystack.includes(query);
}

interface SelectorOption {
  key: string;
  asset: SelectableAsset | null; // null → the "All assets" reset option
}

/**
 * Searchable multi-currency asset selector for wallet dashboards. Implements
 * the ARIA combobox pattern: the search input keeps focus while
 * ArrowUp/ArrowDown move the active option, Enter selects, Escape closes,
 * and Home/End jump to the ends of the list. Zero-balance holdings and
 * assets without an established trustline are surfaced with badges instead
 * of being hidden.
 */
export function AssetSelector({
  assets,
  value,
  onChange,
  label = 'Filter by asset',
  searchPlaceholder = 'Filter by symbol or issuer…',
  className,
}: AssetSelectorProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const listId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = assets.find((asset) => asset.id === value) ?? null;

  const options = useMemo<SelectorOption[]>(() => {
    const normalized = query.trim().toLowerCase();
    const matches = assets.filter((asset) => assetMatches(asset, normalized));
    return [
      { key: '__all__', asset: null },
      ...matches.map((asset) => ({ key: asset.id, asset })),
    ];
  }, [assets, query]);

  // Keep the active option in range as the filtered list shrinks.
  useEffect(() => {
    setActiveIndex((index) => Math.min(index, Math.max(0, options.length - 1)));
  }, [options.length]);

  // Outside-click dismissal.
  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  const openPanel = () => {
    setQuery('');
    setActiveIndex(0);
    setOpen(true);
    // Focus the search field once the panel has mounted.
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const closePanel = (returnFocus = false) => {
    setOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  };

  const choose = (option: SelectorOption) => {
    onChange(option.asset?.id ?? null);
    closePanel(true);
  };

  const onSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        setActiveIndex((index) => (index + 1) % options.length);
        break;
      case 'ArrowUp':
        event.preventDefault();
        setActiveIndex(
          (index) => (index - 1 + options.length) % options.length,
        );
        break;
      case 'Home':
        event.preventDefault();
        setActiveIndex(0);
        break;
      case 'End':
        event.preventDefault();
        setActiveIndex(options.length - 1);
        break;
      case 'Enter':
        event.preventDefault();
        {
          const option = options[activeIndex];
          if (option) choose(option);
        }
        break;
      case 'Escape':
        event.preventDefault();
        closePanel(true);
        break;
      default:
        break;
    }
  };

  const activeDescendant =
    open && options[activeIndex]
      ? `${listId}-option-${options[activeIndex].key}`
      : undefined;

  return (
    <div ref={containerRef} className={cn('relative inline-flex', className)}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => (open ? closePanel() : openPanel())}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`${label}: ${selected ? `${selected.symbol} selected` : 'all assets selected'}`}
        className={cn(
          'gap-2 px-3 py-2 inline-flex min-w-[180px] items-center justify-between rounded-button border border-border bg-surface text-sm text-foreground shadow-sm transition-colors hover:border-border-strong',
          FOCUS_RING,
        )}
      >
        <span className="gap-2 flex min-w-0 items-center">
          {selected?.iconUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={selected.iconUrl}
              alt=""
              className="h-4 w-4 shrink-0 rounded-full object-cover"
            />
          ) : (
            <Wallet className="h-4 w-4 shrink-0 text-gold" aria-hidden />
          )}
          <span className="truncate font-medium">
            {selected ? selected.symbol : 'All assets'}
          </span>
          {selected && typeof selected.balance === 'number' && (
            <span className="tabular shrink-0 text-2xs text-foreground-muted">
              {formatNumber(selected.balance)}
            </span>
          )}
        </span>
        <ChevronDown
          className={cn(
            'h-4 w-4 shrink-0 text-foreground-muted transition-transform duration-fast',
            open && 'rotate-180',
          )}
          aria-hidden
        />
      </button>

      {open && (
        <div className="glass absolute left-0 top-full z-50 mt-2 w-[min(22rem,calc(100vw-3rem))] animate-fade-in overflow-hidden rounded-card border border-border bg-surface shadow-soft-3">
          <div className="border-b border-border p-2">
            <div className="gap-2 flex items-center rounded-button border border-border bg-surface-secondary px-2.5 py-1.5">
              <Search
                className="h-3.5 w-3.5 shrink-0 text-foreground-muted"
                aria-hidden
              />
              <input
                ref={inputRef}
                type="text"
                role="combobox"
                aria-expanded="true"
                aria-controls={listId}
                aria-activedescendant={activeDescendant}
                aria-autocomplete="list"
                aria-label={searchPlaceholder}
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setActiveIndex(0);
                }}
                onKeyDown={onSearchKeyDown}
                placeholder={searchPlaceholder}
                className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-foreground-muted"
              />
            </div>
          </div>

          <ul
            id={listId}
            role="listbox"
            aria-label={`${label} options`}
            className="max-h-72 overflow-y-auto p-1.5"
          >
            {options.length === 1 && (
              <li className="px-3 py-6 text-center text-2xs text-foreground-muted">
                No assets match your search.
              </li>
            )}
            {options.map((option, index) => {
              const asset = option.asset;
              const isActive = index === activeIndex;
              const isSelected = asset ? asset.id === value : value === null;
              const optionId = `${listId}-option-${option.key}`;

              return (
                <li
                  key={option.key}
                  id={optionId}
                  role="option"
                  aria-selected={isSelected}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => choose(option)}
                  className={cn(
                    'gap-2.5 px-2.5 py-2 flex cursor-pointer items-center rounded-button text-left transition-colors duration-fast',
                    isActive ? 'bg-surface-secondary' : 'hover:bg-surface-secondary/60',
                  )}
                >
                  <span className="min-w-0 flex-1">
                    <span className="gap-1.5 flex items-center">
                      <span className="truncate text-sm font-medium text-foreground">
                        {asset ? asset.symbol : 'All assets'}
                      </span>
                      {asset && typeof asset.balance === 'number' && (
                        <span className="tabular shrink-0 text-2xs text-foreground-muted">
                          {formatNumber(asset.balance)}
                        </span>
                      )}
                    </span>
                    {asset && (
                      <span className="block truncate text-2xs text-foreground-muted">
                        {asset.issuer
                          ? formatStellarAddress(asset.issuer, { lead: 4, tail: 4 })
                          : asset.name ?? 'Native asset'}
                      </span>
                    )}
                  </span>

                  {asset?.balance !== undefined && asset.balance <= 0 && (
                    <Badge variant="warning" size="sm">
                      Zero balance
                    </Badge>
                  )}
                  {asset?.hasTrustline === false && (
                    <Badge variant="outline" size="sm">
                      No trustline
                    </Badge>
                  )}
                  {isSelected && (
                    <Check className="h-4 w-4 shrink-0 text-gold" aria-hidden />
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

export default AssetSelector;
