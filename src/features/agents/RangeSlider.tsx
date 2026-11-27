'use client';

import { useState, useEffect } from 'react';
import { cn } from '@/lib/cn';

/**
 * A generic range slider that mirrors the visual style of AllocationSlider
 * but accepts arbitrary min/max/step values so it can be used for temperature
 * (0–2), token limits, or any other bounded numeric input.
 *
 * The thumb, track, and fill are styled through Tailwind classes referencing
 * design tokens from `src/styles/tokens.css`, and the native input provides
 * full keyboard accessibility (arrows, PageUp/Down, Home/End).
 */
interface RangeSliderProps {
  /** Unique identifier for the input and aria associations. */
  id: string;
  /** Label displayed next to the slider. */
  label: string;
  /** Current value. */
  value: number;
  /** Step increment for arrow keys and input changes. */
  step: number;
  /** Minimum allowed value. */
  min: number;
  /** Maximum allowed value. */
  max: number;
  /** Called when the user changes the value via thumb or keyboard. */
  onChange: (value: number) => void;
  /** Optional label for additional descriptive text. */
  describedBy?: string;
  /** When `true`, the slider and input are disabled. */
  disabled?: boolean;
}

/**
 * Clamp a value to the [min, max] range.
 */
function clampValue(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * A generic range slider component.
 */
export function RangeSlider({
  id,
  label,
  value,
  step,
  min,
  max,
  onChange,
  describedBy,
  disabled = false,
}: RangeSliderProps) {
  const [focused, setFocused] = useState(false);
  const [raw, setRaw] = useState(clampValue(value, min, max));

  useEffect(() => {
    setRaw(clampValue(value, min, max));
  }, [value, min, max]);

  const rangeSpan = max - min;
  const percentage = rangeSpan > 0 ? ((raw - min) / rangeSpan) * 100 : 0;

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = Number(event.target.value);
    const clamped = clampValue(rawValue, min, max);
    setRaw(clamped);
    onChange(clamped);
  };

  return (
    <div className="relative h-[44px] w-full px-3">
      <div className="relative h-full w-full">
        {/* Track */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-1/2 h-2 -translate-y-1/2 rounded-full bg-surface-secondary"
        />
        {/* Fill – proportion of the full range */}
        <span
          aria-hidden
          className="pointer-events-none absolute left-0 top-1/2 h-2 -translate-y-1/2 rounded-full bg-foreground/15"
          style={{ width: `${percentage}%` }}
        />
        {/* Thumb */}
        <input
          id={id}
          type="range"
          min={min}
          max={max}
          step={step}
          value={raw}
          disabled={disabled}
          aria-label={`${label} control, from ${min} to ${max}`}
          aria-valuenow={raw}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-describedby={describedBy}
          className="absolute inset-0 h-full w-full cursor-pointer appearance-none bg-transparent"
          onChange={(event) => handleChange(event)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
        {/* Focus ring overlay */}
        {focused && (
          <span
            aria-hidden
            className="pointer-events-none absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 ring-ring ring-offset-2 ring-offset-surface"
            style={{ left: `${percentage}%` }}
          />
        )}
      </div>
    </div>
  );
}

/**
 * Inline numerical value placed beside the slider thumb.
 * Shows the current value rounded to step granularity.
 */
export function RangeSliderValue({
  value,
  min,
  step,
  className,
}: {
  value: number;
  min: number;
  step: number;
  className?: string;
}) {
  const raw = Math.round((value - min) / step) * step + min;
  return (
    <span
      className={cn(
        'absolute left-1/2 -translate-x-1/2 mt-2 text-2xs font-medium text-foreground',
        className,
      )}
    >
      {Number(raw.toFixed(10)).toString()}
    </span>
  );
}