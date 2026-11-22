import assert from 'node:assert/strict';
import test, { describe } from 'node:test';

import {
  bindCommandPaletteShortcut,
  isCommandShortcut,
  isEditableTarget,
  isShortcutBlockedByInput,
  type CommandShortcutEvent,
  type ShortcutEventSource,
} from './layout/commandPaletteUtils';

function shortcutEvent(overrides: Partial<CommandShortcutEvent> = {}): CommandShortcutEvent {
  return {
    metaKey: false,
    ctrlKey: false,
    altKey: false,
    shiftKey: false,
    key: 'k',
    ...overrides,
  };
}

/** Minimal fake of a keydown event as received by the listener. */
interface FakeKeydown {
  key: string;
  code?: string;
  metaKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  target?: unknown;
  defaultPrevented: boolean;
  propagationStopped: boolean;
  preventDefault: () => void;
  stopPropagation: () => void;
}

function keydown(overrides: Partial<FakeKeydown> = {}): FakeKeydown {
  const event: FakeKeydown = {
    key: 'k',
    ctrlKey: true,
    metaKey: false,
    altKey: false,
    shiftKey: false,
    target: { tagName: 'BODY' },
    defaultPrevented: false,
    propagationStopped: false,
    preventDefault: () => {
      event.defaultPrevented = true;
    },
    stopPropagation: () => {
      event.propagationStopped = true;
    },
    ...overrides,
  };
  return event;
}

/**
 * Fake document-ish source: tracks registered keydown listeners and delivers
 * events only to the ones still registered, so listener leaks are observable.
 */
function fakeSource() {
  const listeners: Array<(event: KeyboardEvent) => void> = [];
  const source: ShortcutEventSource = {
    addEventListener: (type, listener) => {
      assert.equal(type, 'keydown');
      listeners.push(listener);
    },
    removeEventListener: (type, listener) => {
      assert.equal(type, 'keydown');
      const index = listeners.indexOf(listener);
      if (index >= 0) listeners.splice(index, 1);
    },
  };
  const dispatch = (event: FakeKeydown) => {
    for (const listener of [...listeners]) {
      listener(event as unknown as KeyboardEvent);
    }
  };
  return { source, listeners, dispatch };
}

describe('Command palette global shortcut (#588)', () => {
  describe('editable-field guard', () => {
    test('treats inputs, textareas, selects and contenteditable as editable', () => {
      assert.equal(isEditableTarget({ tagName: 'INPUT' }), true);
      assert.equal(isEditableTarget({ tagName: 'textarea' }), true);
      assert.equal(isEditableTarget({ tagName: 'SELECT' }), true);
      assert.equal(isEditableTarget({ isContentEditable: true }), true);
      assert.equal(isEditableTarget({ closest: () => ({}) }), true);
    });

    test('treats regular elements and empty targets as non-editable', () => {
      assert.equal(isEditableTarget({ tagName: 'DIV' }), false);
      assert.equal(isEditableTarget({ tagName: 'BODY', closest: () => null }), false);
      assert.equal(isEditableTarget(null), false);
      assert.equal(isEditableTarget(undefined), false);
    });
  });

  describe('isCommandShortcut', () => {
    test('opens from a non-editable target with ⌘K or Ctrl+K', () => {
      assert.equal(isCommandShortcut(shortcutEvent({ metaKey: true })), true);
      assert.equal(isCommandShortcut(shortcutEvent({ ctrlKey: true })), true);
      assert.equal(
        isCommandShortcut(shortcutEvent({ ctrlKey: true, target: { tagName: 'BODY' } })),
        true,
      );
    });

    test('never fires while typing in an input or textarea', () => {
      assert.equal(
        isCommandShortcut(shortcutEvent({ ctrlKey: true, target: { tagName: 'INPUT' } })),
        false,
      );
      assert.equal(
        isCommandShortcut(shortcutEvent({ ctrlKey: true, target: { tagName: 'TEXTAREA' } })),
        false,
      );
      assert.equal(
        isCommandShortcut(shortcutEvent({ ctrlKey: true, target: { isContentEditable: true } })),
        false,
      );
      assert.equal(
        isCommandShortcut(shortcutEvent({ targetTagName: 'INPUT', ctrlKey: true })),
        false,
      );
    });

    test('reports blocked-by-input for editable events', () => {
      assert.equal(isShortcutBlockedByInput(shortcutEvent({ target: { tagName: 'INPUT' } })), true);
      assert.equal(isShortcutBlockedByInput(shortcutEvent({ target: { tagName: 'DIV' } })), false);
    });
  });

  describe('listener lifecycle', () => {
    test('registers exactly one listener and removes it on cleanup', () => {
      const { source, listeners } = fakeSource();
      const cleanup = bindCommandPaletteShortcut(source, () => {});

      assert.equal(listeners.length, 1);
      cleanup();
      assert.equal(listeners.length, 0);
    });

    test('cleanup is idempotent (no duplicate removal side effects)', () => {
      const { source, listeners } = fakeSource();
      const cleanup = bindCommandPaletteShortcut(source, () => {});
      cleanup();
      cleanup();
      assert.equal(listeners.length, 0);
    });

    test('triggers once per matching keypress and prevents the browser default', () => {
      const { source, dispatch } = fakeSource();
      let calls = 0;
      const cleanup = bindCommandPaletteShortcut(source, () => {
        calls += 1;
      });

      const openEvent = keydown();
      dispatch(openEvent);

      assert.equal(calls, 1);
      assert.equal(openEvent.defaultPrevented, true);
      assert.equal(openEvent.propagationStopped, true);

      cleanup();
    });

    test('ignores typing inside inputs and unrelated keys', () => {
      const { source, dispatch } = fakeSource();
      let calls = 0;
      const cleanup = bindCommandPaletteShortcut(source, () => {
        calls += 1;
      });

      dispatch(keydown({ target: { tagName: 'INPUT' } }));
      dispatch(keydown({ target: { tagName: 'TEXTAREA' } }));
      dispatch(keydown({ target: { isContentEditable: true } }));
      dispatch(keydown({ key: 'j' }));
      assert.equal(calls, 0);

      // the real shortcut still works afterwards
      dispatch(keydown());
      assert.equal(calls, 1);

      cleanup();
    });

    test('a removed listener no longer fires', () => {
      const { source, dispatch } = fakeSource();
      let calls = 0;
      const cleanup = bindCommandPaletteShortcut(source, () => {
        calls += 1;
      });

      dispatch(keydown());
      assert.equal(calls, 1);

      cleanup();
      dispatch(keydown());
      assert.equal(calls, 1, 'no further triggers after unmount cleanup');
    });
  });
});
