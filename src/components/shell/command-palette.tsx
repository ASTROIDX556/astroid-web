'use client';

/**
 * Backwards-compatible alias for the global command menu. The implementation
 * now lives in `src/components/CommandMenu.tsx` so it can own navigation,
 * agent search and quick actions together.
 */
export { CommandMenu as CommandPalette } from '@/components/CommandMenu';
