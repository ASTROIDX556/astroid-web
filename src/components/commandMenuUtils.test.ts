import assert from 'node:assert/strict';
import test from 'node:test';

import { agentCommandValue, isCommandMenuShortcut } from './commandMenuUtils';

test('⌘K and Ctrl+K open the command menu', () => {
  assert.equal(isCommandMenuShortcut({ key: 'k', metaKey: true }), true);
  assert.equal(isCommandMenuShortcut({ key: 'K', metaKey: true }), true);
  assert.equal(isCommandMenuShortcut({ key: 'k', ctrlKey: true }), true);
});

test('plain keys, alt-modified combos and other shortcuts are ignored', () => {
  assert.equal(isCommandMenuShortcut({ key: 'k' }), false);
  assert.equal(isCommandMenuShortcut({ key: 'j', metaKey: true }), false);
  assert.equal(isCommandMenuShortcut({ key: 'k', metaKey: true, altKey: true }), false);
});

test('agent command values include searchable identity fields', () => {
  const value = agentCommandValue({
    id: 'agt_atlas',
    name: 'Atlas',
    role: 'finance',
  });

  assert.match(value, /Atlas/);
  assert.match(value, /finance/);
  assert.match(value, /agt_atlas/);
});
