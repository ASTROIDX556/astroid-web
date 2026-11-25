import assert from 'node:assert/strict';
import test, { describe } from 'node:test';
import {
  isCommandShortcut,
  restoreFocusToElement,
  type CommandShortcutEvent,
} from './commandPaletteUtils';
import { useCommandStore } from '../../stores/ui-store';

describe('CommandPalette keyboard navigation & accessibility (#362)', () => {
  // -------------------------------------------------------------------------
  // 1. Shortcut predicate (isCommandShortcut)
  // -------------------------------------------------------------------------
  describe('Global shortcut predicate (isCommandShortcut)', () => {
    test('accepts Meta+k and Meta+K (macOS Cmd+K)', () => {
      const macLower: CommandShortcutEvent = {
        metaKey: true,
        ctrlKey: false,
        altKey: false,
        shiftKey: false,
        key: 'k',
      };
      const macUpper: CommandShortcutEvent = {
        metaKey: true,
        ctrlKey: false,
        altKey: false,
        shiftKey: false,
        key: 'K',
      };
      assert.equal(isCommandShortcut(macLower), true);
      assert.equal(isCommandShortcut(macUpper), true);
    });

    test('accepts Ctrl+k and Ctrl+K (Windows/Linux Ctrl+K)', () => {
      const winLower: CommandShortcutEvent = {
        metaKey: false,
        ctrlKey: true,
        altKey: false,
        shiftKey: false,
        key: 'k',
      };
      const winUpper: CommandShortcutEvent = {
        metaKey: false,
        ctrlKey: true,
        altKey: false,
        shiftKey: false,
        key: 'K',
      };
      assert.equal(isCommandShortcut(winLower), true);
      assert.equal(isCommandShortcut(winUpper), true);
    });

    test('supports event.code === "KeyK" fallback when key is not mapped', () => {
      const fallbackEvent: CommandShortcutEvent = {
        metaKey: true,
        ctrlKey: false,
        altKey: false,
        shiftKey: false,
        key: 'Unidentified',
        code: 'KeyK',
      };
      assert.equal(isCommandShortcut(fallbackEvent), true);
    });

    test('rejects shortcuts with Shift or Alt modifiers', () => {
      const shiftShortcut: CommandShortcutEvent = {
        metaKey: true,
        ctrlKey: false,
        altKey: false,
        shiftKey: true,
        key: 'k',
      };
      const altShortcut: CommandShortcutEvent = {
        metaKey: false,
        ctrlKey: true,
        altKey: true,
        shiftKey: false,
        key: 'k',
      };
      assert.equal(isCommandShortcut(shiftShortcut), false);
      assert.equal(isCommandShortcut(altShortcut), false);
    });

    test('rejects normal typing without Meta or Ctrl', () => {
      const plainKey: CommandShortcutEvent = {
        metaKey: false,
        ctrlKey: false,
        altKey: false,
        shiftKey: false,
        key: 'k',
      };
      assert.equal(isCommandShortcut(plainKey), false);
    });

    test('rejects IME composition and key repeat events', () => {
      const composing: CommandShortcutEvent = {
        metaKey: true,
        ctrlKey: false,
        altKey: false,
        shiftKey: false,
        key: 'k',
        isComposing: true,
      };
      const repeat: CommandShortcutEvent = {
        metaKey: true,
        ctrlKey: false,
        altKey: false,
        shiftKey: false,
        key: 'k',
        repeat: true,
      };
      assert.equal(isCommandShortcut(composing), false);
      assert.equal(isCommandShortcut(repeat), false);
    });

    test('rejects other unrelated key combinations', () => {
      const cmdS: CommandShortcutEvent = {
        metaKey: true,
        ctrlKey: false,
        altKey: false,
        shiftKey: false,
        key: 's',
      };
      const cmdJ: CommandShortcutEvent = {
        metaKey: true,
        ctrlKey: false,
        altKey: false,
        shiftKey: false,
        key: 'j',
      };
      assert.equal(isCommandShortcut(cmdS), false);
      assert.equal(isCommandShortcut(cmdJ), false);
    });
  });

  // -------------------------------------------------------------------------
  // 2. Command palette store state (useCommandStore)
  // -------------------------------------------------------------------------
  describe('Command palette UI store (useCommandStore)', () => {
    test('updates open state via setOpen and toggle', () => {
      useCommandStore.getState().setOpen(false);
      assert.equal(useCommandStore.getState().open, false);

      useCommandStore.getState().setOpen(true);
      assert.equal(useCommandStore.getState().open, true);

      useCommandStore.getState().toggle();
      assert.equal(useCommandStore.getState().open, false);

      useCommandStore.getState().toggle();
      assert.equal(useCommandStore.getState().open, true);

      // Clean up store state
      useCommandStore.getState().setOpen(false);
    });
  });

  // -------------------------------------------------------------------------
  // 3. Focus restoration helper (restoreFocusToElement)
  // -------------------------------------------------------------------------
  describe('Focus restoration helper (restoreFocusToElement)', () => {
    test('returns false for null element', () => {
      assert.equal(restoreFocusToElement(null), false);
    });

    test('returns false if element is disconnected from DOM', () => {
      const disconnectedElement = {
        isConnected: false,
        focus: () => {},
      } as unknown as HTMLElement;

      assert.equal(restoreFocusToElement(disconnectedElement), false);
    });

    test('returns true and invokes focus when element is connected', () => {
      let focused = false;
      const connectedElement = {
        isConnected: true,
        focus: () => {
          focused = true;
        },
      } as unknown as HTMLElement;

      assert.equal(restoreFocusToElement(connectedElement), true);
      assert.equal(focused, true);
    });

    test('catches focus errors gracefully and returns false', () => {
      const throwingElement = {
        isConnected: true,
        focus: () => {
          throw new Error('Focus blocked by browser policy');
        },
      } as unknown as HTMLElement;

      assert.equal(restoreFocusToElement(throwingElement), false);
    });
  });
});
