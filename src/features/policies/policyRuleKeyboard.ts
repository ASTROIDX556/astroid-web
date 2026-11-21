/**
 * Keyboard helpers for the policy rule configuration UI.
 *
 * Kept free of React/DOM so the behaviour can be unit tested and reused by any custom
 * slider-like control in the policy engine.
 */

export interface SliderBounds {
  min: number;
  max: number;
  /** Increment for a plain arrow key press. */
  step: number;
  /** Increment for Shift+Arrow and PageUp/PageDown. Defaults to 10× `step`. */
  largeStep?: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Returns the next slider value for a key press, or `null` when the key is not a slider
 * key (so the caller lets the browser handle it, e.g. Tab).
 *
 * - ArrowRight / ArrowUp: +step (Shift: +largeStep)
 * - ArrowLeft / ArrowDown: −step (Shift: −largeStep)
 * - PageUp / PageDown: ±largeStep
 * - Home / End: min / max
 */
export function getNextSliderValue(
  key: string,
  shiftKey: boolean,
  current: number,
  bounds: SliderBounds,
): number | null {
  const { min, max, step } = bounds;
  const largeStep = bounds.largeStep ?? step * 10;
  const safeCurrent = Number.isFinite(current) ? clamp(current, min, max) : min;

  switch (key) {
    case 'ArrowRight':
    case 'ArrowUp':
      return clamp(safeCurrent + (shiftKey ? largeStep : step), min, max);
    case 'ArrowLeft':
    case 'ArrowDown':
      return clamp(safeCurrent - (shiftKey ? largeStep : step), min, max);
    case 'PageUp':
      return clamp(safeCurrent + largeStep, min, max);
    case 'PageDown':
      return clamp(safeCurrent - largeStep, min, max);
    case 'Home':
      return min;
    case 'End':
      return max;
    default:
      return null;
  }
}

/** True for the keys that activate a toggle/switch control (Enter and Space). */
export function isActivationKey(key: string): boolean {
  return key === 'Enter' || key === ' ' || key === 'Spacebar';
}

/**
 * After removing the item at `removedIndex` from a list that had `previousLength` items,
 * returns the index that should receive focus in the shortened list, or `null` when the
 * list is now empty (focus should move to a fallback control instead).
 */
export function getFocusIndexAfterRemoval(
  removedIndex: number,
  previousLength: number,
): number | null {
  const nextLength = previousLength - 1;
  if (nextLength <= 0) return null;
  return Math.min(Math.max(removedIndex, 0), nextLength - 1);
}
