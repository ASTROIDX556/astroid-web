import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getFocusIndexAfterRemoval,
  getNextSliderValue,
  isActivationKey,
} from './policyRuleKeyboard';

const bounds = { min: 0, max: 10000, step: 1, largeStep: 100 };

test('arrow keys move the slider by one step', () => {
  assert.equal(getNextSliderValue('ArrowRight', false, 500, bounds), 501);
  assert.equal(getNextSliderValue('ArrowUp', false, 500, bounds), 501);
  assert.equal(getNextSliderValue('ArrowLeft', false, 500, bounds), 499);
  assert.equal(getNextSliderValue('ArrowDown', false, 500, bounds), 499);
});

test('Shift+Arrow and PageUp/PageDown move by the large step', () => {
  assert.equal(getNextSliderValue('ArrowRight', true, 500, bounds), 600);
  assert.equal(getNextSliderValue('ArrowLeft', true, 500, bounds), 400);
  assert.equal(getNextSliderValue('PageUp', false, 500, bounds), 600);
  assert.equal(getNextSliderValue('PageDown', false, 500, bounds), 400);
});

test('Home and End jump to the bounds', () => {
  assert.equal(getNextSliderValue('Home', false, 500, bounds), 0);
  assert.equal(getNextSliderValue('End', false, 500, bounds), 10000);
});

test('slider values are clamped to the bounds', () => {
  assert.equal(getNextSliderValue('PageUp', false, 9950, bounds), 10000);
  assert.equal(getNextSliderValue('ArrowLeft', true, 20, bounds), 0);
  assert.equal(getNextSliderValue('ArrowRight', false, Number.NaN, bounds), 1);
});

test('large step defaults to ten times the step', () => {
  assert.equal(
    getNextSliderValue('PageUp', false, 0, { min: 0, max: 100, step: 5 }),
    50,
  );
});

test('non-slider keys are left to the browser', () => {
  for (const key of ['Tab', 'Enter', ' ', 'a', 'Escape']) {
    assert.equal(getNextSliderValue(key, false, 500, bounds), null, key);
  }
});

test('Enter and Space activate toggles', () => {
  assert.equal(isActivationKey('Enter'), true);
  assert.equal(isActivationKey(' '), true);
  assert.equal(isActivationKey('Spacebar'), true);
  assert.equal(isActivationKey('Tab'), false);
});

test('focus moves to the next remaining item after a removal', () => {
  assert.equal(getFocusIndexAfterRemoval(0, 3), 0);
  assert.equal(getFocusIndexAfterRemoval(1, 3), 1);
  assert.equal(getFocusIndexAfterRemoval(2, 3), 1);
  assert.equal(getFocusIndexAfterRemoval(0, 1), null);
});
