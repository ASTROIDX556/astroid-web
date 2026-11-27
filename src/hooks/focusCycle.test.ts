import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveFocusCycleTarget } from './focusCycle';

/**
 * A modal laid out as: [panel] heading(tabIndex=-1) · close · amount · submit · footnote(tabIndex=-1).
 * `order` gives each node's document position so `precedes` mirrors the DOM.
 */
const order = ['outside', 'panel', 'heading', 'close', 'amount', 'submit', 'footnote'] as const;
type Node = (typeof order)[number];
const precedes = (a: Node, b: Node) => order.indexOf(a) < order.indexOf(b);
const focusables: Node[] = ['close', 'amount', 'submit'];

function press(active: Node | null, shiftKey = false, items: Node[] = focusables) {
  return resolveFocusCycleTarget<Node>({
    focusables: items,
    active,
    container: 'panel',
    containsActive: active !== null && active !== 'outside',
    shiftKey,
    precedes,
  });
}

/** Simulates a run of Tab presses, applying the browser default when the trap returns null. */
function walk(start: Node, presses: number, shiftKey = false): Node[] {
  const visited: Node[] = [];
  let current: Node = start;
  for (let index = 0; index < presses; index += 1) {
    const forced = press(current, shiftKey);
    if (forced) {
      current = forced;
    } else {
      const position = focusables.indexOf(current);
      current = focusables[position + (shiftKey ? -1 : 1)]!;
    }
    visited.push(current);
  }
  return visited;
}

test('Tab on the last control wraps to the first', () => {
  assert.equal(press('submit'), 'close');
});

test('Shift+Tab on the first control wraps to the last', () => {
  assert.equal(press('close', true), 'submit');
});

test('Shift+Tab while the panel itself is focused (just opened) goes to the last control', () => {
  assert.equal(press('panel', true), 'submit');
});

test('Tab between middle controls is left to the browser', () => {
  assert.equal(press('close'), null);
  assert.equal(press('amount'), null);
  assert.equal(press('amount', true), null);
});

test('focus that drifted outside is pulled back to the edge being moved towards', () => {
  assert.equal(press('outside'), 'close');
  assert.equal(press('outside', true), 'submit');
  assert.equal(press(null), 'close');
});

test('an empty panel keeps focus on itself', () => {
  assert.equal(press('panel', false, []), 'panel');
  assert.equal(press('outside', true, []), 'panel');
});

test('a programmatically focused element after the last control wraps forward', () => {
  assert.equal(press('footnote'), 'close');
  assert.equal(press('footnote', true), null, 'Shift+Tab reaches submit natively');
});

test('a programmatically focused heading before the first control wraps backward', () => {
  assert.equal(press('heading', true), 'submit');
  assert.equal(press('heading'), null, 'Tab reaches close natively');
});

test('repeated Tab and Shift+Tab never leave the modal', () => {
  assert.deepEqual(walk('panel', 7), ['close', 'amount', 'submit', 'close', 'amount', 'submit', 'close']);
  assert.deepEqual(walk('close', 5, true), ['submit', 'amount', 'close', 'submit', 'amount']);
});
