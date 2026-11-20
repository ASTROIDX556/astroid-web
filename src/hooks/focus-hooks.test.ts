import assert from 'node:assert/strict';
import test, { describe } from 'node:test';
import { resolveTabTarget } from './useFocusTrap';
import { isOutsidePress, shouldReturnFocus } from './usePopoverFocus';

// Plain objects stand in for DOM elements: the rules under test only compare
// identities, so no browser is needed.
const first = { id: 'first' };
const middle = { id: 'middle' };
const last = { id: 'last' };
const focusables = [first, middle, last];

const base = {
  focusables,
  active: middle as typeof first | null,
  activeInsideContainer: true,
  activeIsContainer: false,
  shiftKey: false,
};

describe('resolveTabTarget (modal focus trap)', () => {
  test('Tab on the last focusable wraps to the first', () => {
    assert.deepEqual(resolveTabTarget({ ...base, active: last }), { kind: 'element', element: first });
  });

  test('Shift+Tab on the first focusable wraps to the last', () => {
    assert.deepEqual(
      resolveTabTarget({ ...base, active: first, shiftKey: true }),
      { kind: 'element', element: last },
    );
  });

  test('Shift+Tab on the dialog panel itself wraps to the last focusable', () => {
    assert.deepEqual(
      resolveTabTarget({ ...base, active: null, activeIsContainer: true, shiftKey: true }),
      { kind: 'element', element: last },
    );
  });

  test('Tab and Shift+Tab in the middle are left to the browser', () => {
    assert.equal(resolveTabTarget({ ...base, active: middle }), null);
    assert.equal(resolveTabTarget({ ...base, active: middle, shiftKey: true }), null);
    assert.equal(resolveTabTarget({ ...base, active: first }), null);
    assert.equal(resolveTabTarget({ ...base, active: last, shiftKey: true }), null);
  });

  test('focus that drifted outside the dialog is pulled back in', () => {
    const outside = { ...base, active: { id: 'page' }, activeInsideContainer: false };

    assert.deepEqual(resolveTabTarget(outside), { kind: 'element', element: first });
    assert.deepEqual(resolveTabTarget({ ...outside, shiftKey: true }), { kind: 'element', element: last });
  });

  test('a dialog with nothing focusable pins focus to the panel', () => {
    assert.deepEqual(resolveTabTarget({ ...base, focusables: [], active: null }), { kind: 'container' });
    assert.deepEqual(
      resolveTabTarget({ ...base, focusables: [], active: null, shiftKey: true }),
      { kind: 'container' },
    );
  });

  test('a single focusable keeps focus on itself in both directions', () => {
    const only = { id: 'only' };
    const single = { ...base, focusables: [only], active: only };

    assert.deepEqual(resolveTabTarget(single), { kind: 'element', element: only });
    assert.deepEqual(resolveTabTarget({ ...single, shiftKey: true }), { kind: 'element', element: only });
  });
});

describe('isOutsidePress (popover dismissal)', () => {
  const inside = new Set(['panel-child']);
  const panel = { contains: (node: string) => inside.has(node) };
  const trigger = { contains: (node: string) => node === 'trigger-icon' };

  test('a press inside the panel or on the trigger is not outside', () => {
    assert.equal(isOutsidePress('panel-child', [panel, trigger]), false);
    assert.equal(isOutsidePress('trigger-icon', [panel, trigger]), false);
  });

  test('a press elsewhere is outside', () => {
    assert.equal(isOutsidePress('page-body', [panel, trigger]), true);
  });

  test('missing regions are skipped and a missing target counts as outside', () => {
    assert.equal(isOutsidePress('panel-child', [panel, null, undefined]), false);
    assert.equal(isOutsidePress('page-body', [null, undefined]), true);
    assert.equal(isOutsidePress<string>(null, [panel]), true);
  });
});

describe('shouldReturnFocus (focus restoration on close)', () => {
  const body = { id: 'body' };

  test('returns focus when it fell back to the page body', () => {
    assert.equal(shouldReturnFocus({ activeElement: body, body, containerContainsActive: false }), true);
    assert.equal(shouldReturnFocus({ activeElement: null, body, containerContainsActive: false }), true);
  });

  test('returns focus when it was still inside the closing panel', () => {
    assert.equal(
      shouldReturnFocus({ activeElement: { id: 'inner' }, body, containerContainsActive: true }),
      true,
    );
  });

  test('leaves focus alone when the user already moved it elsewhere', () => {
    assert.equal(
      shouldReturnFocus({ activeElement: { id: 'search box' }, body, containerContainsActive: false }),
      false,
    );
  });
});
