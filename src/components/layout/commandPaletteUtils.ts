/**
 * Minimal keyboard event interface required for command palette shortcut evaluation.
 *
 * `target` may be the DOM element that currently has focus; when it is an
 * editable field (input, textarea, select, or contenteditable) the shortcut is
 * suppressed so it never interferes with normal typing.
 */
export interface CommandShortcutTarget {
  tagName?: string;
  isContentEditable?: boolean;
  closest?: (selector: string) => unknown;
}

export interface CommandShortcutEvent {
  metaKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  key: string;
  code?: string;
  isComposing?: boolean;
  repeat?: boolean;
  target?: CommandShortcutTarget | string | null;
  targetTagName?: string;
  targetIsContentEditable?: boolean;
  isEditable?: boolean;
  isFormField?: boolean;
  isTextInput?: boolean;
}

const EDITABLE_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT', 'OPTION']);

/**
 * Returns true when the event originated from an editable field (input,
 * textarea, select, or contenteditable element), so shortcuts can stand down
 * and never interfere with normal typing.
 */
export function isEditableTarget(target: unknown): boolean {
  if (target == null) return false;
  if (typeof target === 'string') {
    const upper = target.toUpperCase();
    return EDITABLE_TAGS.has(upper) || upper === 'CONTENTEDITABLE';
  }
  if (typeof target !== 'object') return false;
  const obj = target as Record<string, unknown>;
  if (obj.isEditable === true || obj.isFormField === true || obj.isTextInput === true) {
    return true;
  }
  if (obj.isContentEditable === true) return true;
  const tag = (obj.targetTagName ?? obj.tagName);
  if (typeof tag === 'string' && EDITABLE_TAGS.has(tag.toUpperCase())) return true;
  if (obj.targetIsContentEditable === true) return true;
  if (typeof obj.closest === 'function') {
    try {
      const found = (obj.closest as (s: string) => unknown)(
        'input, textarea, select, [contenteditable=""], [contenteditable="true"]',
      );
      if (found) return true;
    } catch {
      // ignore
    }
  }
  return false;
}

/** Alias kept for callers/tests that prefer a form-field framing. */
export const isFormField = isEditableTarget;
export const isFormFieldTarget = isEditableTarget;
export const isTextInput = isEditableTarget;
export const isTextInputTarget = isEditableTarget;
export const isContentEditableTarget = isEditableTarget;

/**
 * Returns true when a shortcut event should be suppressed because it
 * originated from an editable field.
 */
export function isShortcutBlockedByInput(event: CommandShortcutEvent): boolean {
  if (event.isEditable === true || event.isFormField === true || event.isTextInput === true) {
    return true;
  }
  if (event.targetIsContentEditable === true) return true;
  if (typeof event.targetTagName === 'string' && EDITABLE_TAGS.has(event.targetTagName.toUpperCase())) {
    return true;
  }
  return isEditableTarget(event.target);
}

/**
 * Checks whether a keyboard event matches the global Command Palette shortcut (⌘K / Ctrl+K).
 * Ignores unwanted modifiers (Shift, Alt), IME composition, repeat events, and
 * events originating from editable fields so shortcuts never interfere with
 * active form inputs or textareas.
 */
export function isCommandShortcut(event: CommandShortcutEvent): boolean {
  if (!(event.metaKey || event.ctrlKey) || event.altKey || event.shiftKey) return false;
  if (event.isComposing || event.repeat) return false;
  if (isShortcutBlockedByInput(event)) return false;

  const keyLower = event.key ? event.key.toLowerCase() : '';
  return keyLower === 'k' || event.code === 'KeyK';
}

/**
 * Minimal event-source surface needed to observe keydown events. `document`
 * satisfies it, and tests can supply a lightweight fake.
 */
export interface ShortcutEventSource {
  addEventListener(
    type: 'keydown',
    listener: (event: KeyboardEvent) => void,
    options?: { capture?: boolean },
  ): void;
  removeEventListener(
    type: 'keydown',
    listener: (event: KeyboardEvent) => void,
    options?: { capture?: boolean },
  ): void;
}

/**
 * Registers the global command-palette keydown listener on `source` (capture
 * phase so it beats page handlers) and returns a cleanup function that removes
 * exactly the registered listener — mounting/unmounting the provider therefore
 * never leaks listeners.
 */
export function bindCommandPaletteShortcut(
  source: ShortcutEventSource,
  onTrigger: () => void,
): () => void {
  const listener = (event: KeyboardEvent) => {
    if (!isCommandShortcut(event as unknown as CommandShortcutEvent)) return;
    event.preventDefault();
    event.stopPropagation();
    onTrigger();
  };

  const options = { capture: true };
  source.addEventListener('keydown', listener, options);
  return () => source.removeEventListener('keydown', listener, options);
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
