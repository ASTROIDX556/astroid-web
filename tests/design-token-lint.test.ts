import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { Linter } from 'eslint';

/**
 * Exercises the real `no-restricted-syntax` design-token rule from
 * `.eslintrc.json` (not a copy of its regex), so the config and these
 * expectations can never drift apart.
 */
const eslintrc = JSON.parse(fs.readFileSync(path.resolve('.eslintrc.json'), 'utf8')) as {
  rules: Record<string, unknown>;
};

const linter = new Linter();

function lint(code: string): string[] {
  const messages = linter.verify(code, {
    parserOptions: { ecmaVersion: 2022, sourceType: 'module', ecmaFeatures: { jsx: true } },
    rules: { 'no-restricted-syntax': eslintrc.rules['no-restricted-syntax'] as Linter.RuleEntry },
  });
  return messages.map((message) => message.message);
}

const flagged = (className: string) => lint(`const el = <div className="${className}" />;`).length > 0;

test('raw Tailwind palette colors are rejected', () => {
  for (const className of [
    'bg-blue-500',
    'text-red-600',
    'p-4 border-gray-200 flex',
    'hover:bg-rose-600',
    'dark:text-gray-100',
    'focus:ring-indigo-500',
    'bg-emerald-500/10',
    'from-indigo-500/5',
    'divide-gray-700',
    'border-t-slate-300',
    '!text-amber-400',
  ]) {
    assert.equal(flagged(className), true, `${className} should be flagged`);
  }
});

test('white/black and arbitrary color values are rejected', () => {
  for (const className of ['text-white', 'bg-black/50', 'bg-[#F6F2EA]', 'text-[rgb(10,10,10)]', 'from-[hsl(240,50%,50%)]']) {
    assert.equal(flagged(className), true, `${className} should be flagged`);
  }
});

test('design tokens and layout utilities are allowed', () => {
  for (const className of [
    'flex p-4 grid gap-2 rounded-card',
    'bg-surface text-foreground-secondary border-border',
    'bg-danger-soft text-danger border-danger/30',
    'bg-gold text-accent-foreground hover:bg-gold-strong',
    'bg-accent-gradient text-background-secondary',
    'focus-visible:ring-2 focus-visible:ring-ring',
    'text-2xs text-xl shadow-soft-2 w-[400px] max-h-[calc(100vh-120px)]',
    'bg-[url(/grid.svg)]',
  ]) {
    assert.equal(flagged(className), false, `${className} should be allowed`);
  }
});

test('class strings in template literals and plain constants are checked too', () => {
  assert.equal(lint('const cls = `flex ${active ? "x" : "y"} text-red-500`;').length, 1);
  assert.equal(lint("const STYLES = { warning: 'text-amber-400' };").length, 1);
  assert.equal(lint('const cls = `flex ${active ? "x" : "y"} text-danger`;').length, 0);
});

test('the lint message points contributors at the token file', () => {
  const [message] = lint('const el = <div className="bg-blue-500" />;');
  assert.match(message ?? '', /src\/styles\/tokens\.css/);
});
