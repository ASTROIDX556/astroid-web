import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { navSections } from '../../lib/nav';

/**
 * Source-level audit for the WCAG AA navigation contract (#478): the desktop
 * dock, mobile drawer, and sidebar must keep token-based focus rings and
 * ARIA route state. These assertions guard against regressions — the markup
 * itself is covered by manual keyboard testing.
 */
const shellDir = __dirname;
const read = (file: string) => readFileSync(join(shellDir, file), 'utf8');

test('every primary navigation surface exposes an accessible name', () => {
  for (const file of ['command-dock.tsx', 'desktop-sidebar.tsx']) {
    const source = read(file);
    assert.match(source, /<nav[^>]*aria-label=/, `${file} nav landmark needs aria-label`);
  }
  // The mobile drawer is a dialog labelled on the panel itself.
  assert.match(read('mobile-nav.tsx'), /aria-label="Navigation"/);
});

test('every navigation link marks the active route with aria-current', () => {
  for (const file of ['command-dock.tsx', 'mobile-nav.tsx', 'desktop-sidebar.tsx']) {
    const source = read(file);
    assert.match(source, /aria-current=\{active \? 'page' : undefined\}/, `${file} must set aria-current`);
  }
});

test('interactive navigation controls use token-based visible focus rings', () => {
  for (const file of ['command-dock.tsx', 'mobile-nav.tsx', 'desktop-sidebar.tsx', 'topbar.tsx']) {
    const source = read(file);
    assert.match(source, /focus-visible:ring-2 focus-visible:ring-ring/, `${file} focus ring must use the ring token`);
    assert.match(source, /focus-visible:outline-none/, `${file} must suppress the default outline`);
  }
});

test('the mobile drawer traps focus and exposes dialog semantics', () => {
  const source = read('mobile-nav.tsx');
  assert.match(source, /role="dialog"/);
  assert.match(source, /aria-modal="true"/);
  assert.match(source, /useFocusTrap\(/);
  assert.match(source, /onEscape: onClose/);
});

test('navigation destinations are unique and icon-labelled', () => {
  const hrefs = navSections.flatMap((section) => section.items.map((item) => item.href));
  assert.equal(new Set(hrefs).size, hrefs.length, 'duplicate nav hrefs');
  for (const section of navSections) {
    for (const item of section.items) {
      assert.ok(item.label.trim().length > 0, `empty label for ${item.href}`);
      assert.ok(item.icon, `missing icon for ${item.label}`);
    }
  }
});
