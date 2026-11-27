/**
 * Tab / Shift+Tab decision used by `useFocusTrap` (#525).
 *
 * Kept framework- and DOM-free (the caller supplies the focusable list and a
 * `contains` check) so the wrap-around rules can be unit-tested under
 * `node --test`, which has no DOM.
 *
 * Returns the element that should receive focus, or `null` when the browser's
 * default Tab behaviour already keeps focus inside the container and should be
 * left alone.
 */
export interface FocusCycleInput<T> {
  /** Keyboard-focusable elements inside the container, in tab order. */
  focusables: readonly T[];
  /** The element that currently has focus (may be outside the container). */
  active: T | null;
  /** The trap container itself (focused when it has no focusable children). */
  container: T;
  /** Whether `active` is the container or one of its descendants. */
  containsActive: boolean;
  /** True for Shift+Tab. */
  shiftKey: boolean;
  /**
   * True when `a` comes before `b` in document order. Needed only when focus
   * sits on an element inside the container that is not in the tab order
   * (e.g. a heading focused programmatically with `tabIndex={-1}`).
   */
  precedes?: (a: T, b: T) => boolean;
}

export function resolveFocusCycleTarget<T>({
  focusables,
  active,
  container,
  containsActive,
  shiftKey,
  precedes,
}: FocusCycleInput<T>): T | null {
  const first = focusables[0];
  const last = focusables[focusables.length - 1];

  // Nothing focusable inside: pin focus to the panel so Tab cannot escape.
  if (first === undefined || last === undefined) return container;

  // Focus drifted to the background (e.g. after clicking static text): pull
  // it back to the edge the user is moving towards.
  if (!containsActive) return shiftKey ? last : first;

  if (shiftKey && (active === first || active === container)) return last;
  if (!shiftKey && active === last) return first;

  // Focus is on something inside the panel that is not itself tabbable (a
  // heading focused with tabIndex=-1, say). The browser moves to the next
  // tabbable element in document order, which escapes the panel when there
  // is none on that side — wrap instead.
  if (active !== null && active !== container && !focusables.includes(active) && precedes) {
    if (shiftKey && !focusables.some((element) => precedes(element, active))) return last;
    if (!shiftKey && !focusables.some((element) => precedes(active, element))) return first;
  }
  return null;
}
