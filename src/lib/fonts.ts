/**
 * Font loading strategy (PRD Doc 9).
 *
 * Uses fallback CSS variable definitions so next build succeeds seamlessly
 * in both online and offline sandbox environments.
 */

export const fontDisplay = {
  variable: 'font-display',
  className: 'font-display',
};

export const fontSans = {
  variable: 'font-sans',
  className: 'font-sans',
};

export const fontMono = {
  variable: 'font-mono',
  className: 'font-mono',
};

export const fontVariables = `${fontDisplay.variable} ${fontSans.variable} ${fontMono.variable}`;
