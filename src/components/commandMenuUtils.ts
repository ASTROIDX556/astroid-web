/** Pure helpers for the global ⌘K command menu. */

export interface ShortcutEventLike {
  key: string;
  metaKey?: boolean;
  ctrlKey?: boolean;
  altKey?: boolean;
}

/**
 * ⌘K on macOS, Ctrl+K on Windows/Linux. Alt-modified combos are ignored so
 * browser/OS shortcuts are never swallowed.
 */
export function isCommandMenuShortcut(event: ShortcutEventLike): boolean {
  if (event.altKey) return false;
  return (
    (event.metaKey === true || event.ctrlKey === true) &&
    event.key.toLowerCase() === 'k'
  );
}

/** Stable, searchable cmdk value for an agent result. */
export function agentCommandValue(agent: {
  id: string;
  name: string;
  role: string;
}): string {
  return `agent ${agent.name} ${agent.role} ${agent.id}`;
}
