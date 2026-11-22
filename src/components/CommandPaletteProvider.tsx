'use client';

import { useEffect } from 'react';
import { CommandPalette } from '@/components/layout/CommandPalette';
import { bindCommandPaletteShortcut } from '@/components/layout/commandPaletteUtils';
import { useCommandStore } from '@/stores/ui-store';

/**
 * Global command palette provider (#588).
 *
 * Registers one document-level keydown listener for ⌘K / Ctrl+K — with proper
 * cleanup on unmount so no listener leaks — and mounts the cmdk palette dialog.
 * The listener stands down whenever focus is inside an editable field (input,
 * textarea, select or contenteditable), so the shortcut never interferes with
 * active form inputs or textareas.
 */
export function CommandPaletteProvider({ children }: { children: React.ReactNode }) {
  const toggle = useCommandStore((state) => state.toggle);

  useEffect(() => bindCommandPaletteShortcut(document, toggle), [toggle]);

  return (
    <>
      {children}
      <CommandPalette />
    </>
  );
}

export default CommandPaletteProvider;
