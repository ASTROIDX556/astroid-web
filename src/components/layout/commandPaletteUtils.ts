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
