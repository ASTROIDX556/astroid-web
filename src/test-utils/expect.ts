import assert from 'node:assert/strict';

/**
 * Minimal `expect` compatible with the Jest/Vitest matchers used by the
 * suites that predate the node:test runner. Supports the matchers those
 * files rely on (`toBe`, `toEqual`, `toHaveLength`, `toBeNull`, `toBeTruthy`,
 * `toBeFalsy`, `toBeDefined`, `toBeUndefined`, `toContain`, `toBeCloseTo`,
 * `toBeGreaterThan`, `toBeLessThan`, `toBeInstanceOf`, `toThrow`) plus `.not`
 * negation. Anything else should use `node:assert` directly.
 */

const show = (value: unknown): string => {
  try {
    const json = JSON.stringify(value);
    return json === undefined ? String(value) : json;
  } catch {
    return String(value);
  }
};

interface Matchers {
  toBe(expected: unknown): void;
  toEqual(expected: unknown): void;
  toStrictEqual(expected: unknown): void;
  toBeNull(): void;
  toBeUndefined(): void;
  toBeDefined(): void;
  toBeTruthy(): void;
  toBeFalsy(): void;
  toContain(expected: unknown): void;
  toHaveLength(expected: number): void;
  toBeCloseTo(expected: number, precision?: number): void;
  toBeGreaterThan(expected: number): void;
  toBeLessThan(expected: number): void;
  toBeInstanceOf(expected: abstract new (...args: never[]) => unknown): void;
  toThrow(expected?: string | RegExp): void;
}

function buildMatchers(actual: unknown, negate: boolean): Matchers & { not: Matchers } {
  const check = (pass: boolean, message: string): void => {
    assert.ok(negate ? !pass : pass, message);
  };

  const matchers: Matchers = {
    toBe: (expected) =>
      check(
        Object.is(actual, expected),
        `expected ${show(actual)} to ${negate ? 'not ' : ''}be ${show(expected)}`,
      ),
    toEqual: (expected) => {
      let pass = true;
      try {
        assert.deepStrictEqual(actual, expected);
      } catch {
        pass = false;
      }
      check(pass, `expected ${show(actual)} to ${negate ? 'not ' : ''}deep-equal ${show(expected)}`);
    },
    toStrictEqual: (expected) => {
      let pass = true;
      try {
        assert.deepStrictEqual(actual, expected);
      } catch {
        pass = false;
      }
      check(pass, `expected ${show(actual)} to ${negate ? 'not ' : ''}strict-equal ${show(expected)}`);
    },
    toBeNull: () =>
      check(actual === null, `expected ${show(actual)} to ${negate ? 'not ' : ''}be null`),
    toBeUndefined: () =>
      check(
        actual === undefined,
        `expected ${show(actual)} to ${negate ? 'not ' : ''}be undefined`,
      ),
    toBeDefined: () =>
      check(
        actual !== undefined,
        `expected value to ${negate ? 'not ' : ''}be defined`,
      ),
    toBeTruthy: () =>
      check(Boolean(actual), `expected ${show(actual)} to ${negate ? 'not ' : ''}be truthy`),
    toBeFalsy: () =>
      check(!actual, `expected ${show(actual)} to ${negate ? 'not ' : ''}be falsy`),
    toContain: (expected) => {
      const pass =
        typeof actual === 'string'
          ? actual.includes(String(expected))
          : Array.isArray(actual)
            ? actual.includes(expected)
            : false;
      check(pass, `expected ${show(actual)} to ${negate ? 'not ' : ''}contain ${show(expected)}`);
    },
    toHaveLength: (expected) => {
      const length =
        typeof actual === 'string' || Array.isArray(actual)
          ? (actual as { length: number }).length
          : undefined;
      check(
        length === expected,
        `expected length ${String(length)} to ${negate ? 'not ' : ''}be ${expected}`,
      );
    },
    toBeCloseTo: (expected, precision = 2) => {
      const tolerance = 0.5 * 10 ** -precision;
      const pass =
        typeof actual === 'number' &&
        typeof expected === 'number' &&
        Math.abs(actual - expected) < tolerance;
      check(pass, `expected ${show(actual)} to ${negate ? 'not ' : ''}be close to ${expected}`);
    },
    toBeGreaterThan: (expected) =>
      check(
        typeof actual === 'number' && actual > expected,
        `expected ${show(actual)} to ${negate ? 'not ' : ''}be greater than ${expected}`,
      ),
    toBeLessThan: (expected) =>
      check(
        typeof actual === 'number' && actual < expected,
        `expected ${show(actual)} to ${negate ? 'not ' : ''}be less than ${expected}`,
      ),
    toBeInstanceOf: (expected) =>
      check(
        actual instanceof expected,
        `expected ${show(actual)} to ${negate ? 'not ' : ''}be an instance of ${expected.name}`,
      ),
    toThrow: (expected) => {
      assert.equal(typeof actual, 'function', 'toThrow expects a function');
      let threw = false;
      let message = '';
      try {
        (actual as () => void)();
      } catch (error) {
        threw = true;
        message = error instanceof Error ? error.message : String(error);
      }
      let pass = threw;
      if (threw && expected instanceof RegExp) pass = expected.test(message);
      if (threw && typeof expected === 'string') pass = message.includes(expected);
      check(
        pass,
        `expected function to ${negate ? 'not ' : ''}throw${expected ? ` matching ${show(expected)}` : ''}`,
      );
    },
  };

  return {
    ...matchers,
    get not() {
      return buildMatchers(actual, !negate);
    },
  };
}

/** Jest/Vitest-style assertion entry point backed by `node:assert`. */
export function expect(actual: unknown): Matchers & { not: Matchers } {
  return buildMatchers(actual, false);
}
