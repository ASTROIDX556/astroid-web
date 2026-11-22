import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test, { describe } from 'node:test';

/**
 * Issue #557: dashboard navigation primitives must expose semantic ARIA state,
 * keyboard dismissal, focus restoration and token-based visible focus rings.
 *
 * This repo has no DOM/test-library dependency, so component markup is checked
 * through source contracts (the same approach as
 * `src/features/approvals/approval-a11y.test.ts`). Behavioural focus-trap
 * stacking is covered separately in `src/hooks/focusTrapStack.test.ts`.
 */
const source = (relativePath: string) =>
  readFileSync(path.join(process.cwd(), relativePath), 'utf8');

describe('Dashboard navigation accessibility (#557)', () => {
  describe('Semantic navigation state', () => {
    test('desktop sidebar marks only the active destination with aria-current', () => {
      const sidebar = source('src/components/shell/desktop-sidebar.tsx');

      assert.match(sidebar, /<nav aria-label="Primary"/);
      assert.match(sidebar, /aria-current=\{active \? 'page' : undefined\}/);
      // Inactive destinations must not carry aria-current at all.
      assert.doesNotMatch(sidebar, /aria-current="(page|true)"/);
    });

    test('command dock marks the active destination and exposes overlay state', () => {
      const dock = source('src/components/shell/command-dock.tsx');

      assert.match(dock, /aria-current=\{active \? 'page' : undefined\}/);
      assert.match(dock, /aria-expanded=\{expanded\}/);
      assert.match(dock, /aria-controls=\{controls\}/);
      assert.match(dock, /expanded=\{assistantOpen\}/);
      assert.match(dock, /controls="ai-assistant-drawer"/);
      assert.match(dock, /controls="command-palette"/);
    });

    test('mobile navigation drawer is a labelled modal dialog', () => {
      const mobileNav = source('src/components/shell/mobile-nav.tsx');

      assert.match(mobileNav, /id="mobile-nav-drawer"/);
      assert.match(mobileNav, /role="dialog"/);
      assert.match(mobileNav, /aria-modal="true"/);
      assert.match(mobileNav, /aria-label="Navigation"/);
      assert.match(mobileNav, /<nav\s+aria-label="Primary"/);
      assert.match(mobileNav, /aria-current=\{active \? 'page' : undefined\}/);
    });

    test('topbar triggers describe the overlay they open and whether it is expanded', () => {
      const topbar = source('src/components/shell/topbar.tsx');

      assert.match(topbar, /aria-expanded=\{navOpen\}/);
      assert.match(topbar, /aria-controls="mobile-nav-drawer"/);
      assert.match(topbar, /aria-expanded=\{assistantOpen\}/);
      assert.match(topbar, /aria-controls="ai-assistant-drawer"/);
      assert.match(topbar, /aria-expanded=\{commandOpen\}/);
      assert.match(topbar, /aria-controls="command-palette"/);
    });

    test('assistant drawer is a labelled region targeted by its triggers', () => {
      const drawer = source('src/components/shell/assistant-drawer.tsx');

      assert.match(drawer, /const headingId = 'assistant-drawer-title'/);
      assert.match(drawer, /id="ai-assistant-drawer"/);
      assert.match(drawer, /aria-labelledby=\{headingId\}/);
      assert.match(drawer, /<h3 id=\{headingId\}/);
    });
  });

  describe('Keyboard navigation, Escape and focus restoration', () => {
    test('mobile drawer traps focus, closes on Escape and restores the trigger', () => {
      const mobileNav = source('src/components/shell/mobile-nav.tsx');

      assert.match(mobileNav, /useFocusTrap\(\{/);
      assert.match(mobileNav, /onEscape: onClose/);
      assert.match(mobileNav, /initialFocusRef: closeButtonRef/);
    });

    test('assistant Escape only fires while open and never steals a stacked modal', () => {
      const drawer = source('src/components/shell/assistant-drawer.tsx');

      assert.match(drawer, /event\.key !== 'Escape'/);
      assert.match(drawer, /event\.defaultPrevented/);
      assert.match(drawer, /focusTrapStack\.size\(\) > 0/);
      assert.match(drawer, /setOpen\(false\)/);
    });

    test('assistant returns focus to the element that opened it', () => {
      const drawer = source('src/components/shell/assistant-drawer.tsx');

      assert.match(drawer, /returnFocusRef/);
      assert.match(drawer, /target\.focus\(\{ preventScroll: true \}\)/);
    });
  });

  describe('Visible focus indicators', () => {
    test('navigation primitives use the shared token-backed focus ring', () => {
      for (const relativePath of [
        'src/components/shell/desktop-sidebar.tsx',
        'src/components/shell/command-dock.tsx',
        'src/components/shell/mobile-nav.tsx',
        'src/components/shell/topbar.tsx',
        'src/components/shell/assistant-drawer.tsx',
      ]) {
        assert.match(source(relativePath), /focus-visible:ring-ring/, relativePath);
      }
    });
  });

  describe('ARIA relationship integrity', () => {
    test('every aria-controls reference resolves to a rendered panel id', () => {
      const referenced = new Set<string>();
      for (const relativePath of [
        'src/components/shell/topbar.tsx',
        'src/components/shell/desktop-sidebar.tsx',
        'src/components/shell/command-dock.tsx',
      ]) {
        for (const match of source(relativePath).matchAll(/aria-controls="([^"]+)"/g)) {
          referenced.add(match[1]!);
        }
        for (const match of source(relativePath).matchAll(/controls="([^"]+)"/g)) {
          referenced.add(match[1]!);
        }
      }

      const renderedIds = new Set<string>();
      for (const relativePath of [
        'src/components/shell/assistant-drawer.tsx',
        'src/components/shell/mobile-nav.tsx',
        'src/components/layout/CommandPalette.tsx',
      ]) {
        for (const match of source(relativePath).matchAll(/id="([^"]+)"/g)) {
          renderedIds.add(match[1]!);
        }
      }

      assert.ok(referenced.size >= 3);
      for (const id of referenced) {
        assert.ok(renderedIds.has(id), `aria-controls target #${id} is not rendered`);
      }
    });
  });
});
