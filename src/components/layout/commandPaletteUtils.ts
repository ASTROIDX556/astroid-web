/**
 * Minimal keyboard event interface required for command palette shortcut evaluation.
 */
export interface CommandShortcutEvent {
  metaKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  key: string;
  code?: string;
  isComposing?: boolean;
  repeat?: boolean;
}

/**
 * Checks whether a keyboard event matches the global Command Palette shortcut (⌘K / Ctrl+K).
 * Ignores unwanted modifiers (Shift, Alt), IME composition, and repeat events.
 */
export function isCommandShortcut(event: CommandShortcutEvent): boolean {
  if (!(event.metaKey || event.ctrlKey) || event.altKey || event.shiftKey) return false;
  if (event.isComposing || event.repeat) return false;

  const keyLower = event.key ? event.key.toLowerCase() : '';
  return keyLower === 'k' || event.code === 'KeyK';
}

/**
 * Safely restores focus to a previously active element if it is still connected to the DOM.
 */
export function restoreFocusToElement(element: HTMLElement | null): boolean {
  if (element && element.isConnected && typeof element.focus === 'function') {
    try {
      element.focus();
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

/** The searchable part of a command-palette entry. */
export interface CommandFilterItem {
  label: string;
  description?: string;
  keywords?: string[];
}

/** Lower-cased, whitespace-collapsed search text for a command entry. */
export function commandSearchText(item: CommandFilterItem): string {
  return [item.label, item.description ?? '', ...(item.keywords ?? [])]
    .join(' ')
    .toLowerCase();
}

/**
 * Token-prefix filter used for the palette's nested static command groups.
 *
 * Every whitespace-separated query token must appear somewhere in the entry's
 * label, description, or keywords, so "toggle dark" matches "Switch to dark
 * theme". An empty (or whitespace-only) query matches everything.
 */
export function filterCommandItems<T extends CommandFilterItem>(
  items: readonly T[],
  query: string,
): T[] {
  const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return [...items];

  return items.filter((item) => {
    const haystack = commandSearchText(item);
    return tokens.every((token) => haystack.includes(token));
  });
}
