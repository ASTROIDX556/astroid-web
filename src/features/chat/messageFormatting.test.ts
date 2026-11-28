import assert from 'node:assert/strict';
import test from 'node:test';
import { splitMessageSegments } from './messageFormatting';

test('splits fenced snippets while preserving surrounding assistant text', () => {
  assert.deepEqual(
    splitMessageSegments('Run this:\n```ts\nconst total = 2;\n```\nDone.'),
    [
      { kind: 'text', value: 'Run this:\n' },
      { kind: 'code', language: 'ts', value: 'const total = 2;' },
      { kind: 'text', value: '\nDone.' },
    ],
  );
});

test('keeps an incomplete code fence as text while a response is streaming', () => {
  assert.deepEqual(splitMessageSegments('```ts\nconst total = 2;'), [
    { kind: 'text', value: '```ts\nconst total = 2;' },
  ]);
});
