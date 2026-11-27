import assert from 'node:assert/strict';
import test from 'node:test';
import * as React from 'react';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  NimBriefingSummaryCard,
  type NimBriefingSummaryCardProps,
} from './NimBriefingSummaryCard';

// tsx compiles the component's JSX with the classic runtime; keep React in scope.
(globalThis as { React?: typeof React }).React = React;

function render(props: NimBriefingSummaryCardProps = {}): string {
  return renderToStaticMarkup(createElement(NimBriefingSummaryCard, props));
}

test('renders markdown headings, bullet lists, emphasis and inline code as elements', () => {
  const html = render({
    content: [
      '## Treasury health',
      '',
      '- Cash runway is **healthy**',
      '- Watch `daily_spend_limit`',
      '',
      '### Next steps',
      '',
      '1. Pause the noisy agent',
      '2. Review the policy',
    ].join('\n'),
  });

  assert.match(html, /<h3[^>]*>Treasury health<\/h3>/);
  assert.match(html, /<h4[^>]*>Next steps<\/h4>/);
  assert.match(html, /<ul[^>]*>/);
  assert.equal((html.match(/<li/g) ?? []).length, 4);
  assert.match(html, /<strong[^>]*>healthy<\/strong>/);
  assert.match(html, /<code[^>]*>daily_spend_limit<\/code>/);
  assert.match(html, /<ol[^>]*>/);
  assert.match(html, /aria-live="polite"/);
});

test('markdown is emitted as inert React text, never executable markup', () => {
  const html = render({
    content: [
      '<img src=x onerror="alert(1)">',
      '',
      '[unsafe](javascript:alert(1))',
      '[safe](https://stellar.expert)',
      '',
      '```js',
      'alert(1)',
      '```',
    ].join('\n'),
  });

  assert.doesNotMatch(html, /<img/);
  assert.match(html, /&lt;img/);
  assert.doesNotMatch(html, /href="javascript:/);
  assert.match(html, /href="https:\/\/stellar\.expert"/);
  assert.match(html, /<pre[^>]*aria-label="js code"[^>]*><code>alert\(1\)<\/code><\/pre>/);
  assert.doesNotMatch(html, /dangerouslySetInnerHTML/);
});

test('card colors come from semantic token utilities, not hard-coded Tailwind colors', () => {
  const html = render({ content: '## Safe\n\nAll clear.' });

  assert.match(html, /border-gold\/35/);
  assert.match(html, /bg-surface/);
  assert.match(html, /bg-gold-soft/);
  assert.match(html, /text-foreground-secondary/);
  assert.doesNotMatch(html, /text-(?:amber|red|blue|green|yellow)-\d{3}/);
});

test('loading shows an accessible skeleton and withholds the briefing content', () => {
  const html = render({ loading: true, content: '## Should be hidden' });

  assert.match(html, /aria-busy="true"/);
  assert.match(html, /role="status"/);
  assert.match(html, /Loading Nvidia NIM financial briefing/);
  assert.match(html, /class="[^"]*skeleton/);
  assert.doesNotMatch(html, /Should be hidden/);
  assert.doesNotMatch(html, /<h3/);
});

test('empty and whitespace-only responses show the empty state with an optional action', () => {
  for (const content of [null, undefined, '', '   \n\t  ']) {
    const html = render({ content });

    assert.match(html, /No briefing available yet/);
    assert.match(html, /empty response/);
    assert.doesNotMatch(html, /<ul|<h3|<code/);
  }

  const withAction = render({ content: '', onGenerate: () => undefined });
  assert.match(withAction, /Generate briefing/);
  assert.match(withAction, /<button/);
});

test('error responses are announced and take precedence over empty content', () => {
  const html = render({ error: 'NIM endpoint timed out', content: '' });

  assert.match(html, /role="alert"/);
  assert.match(html, /Briefing unavailable/);
  assert.match(html, /NIM endpoint timed out/);
  assert.doesNotMatch(html, /No briefing available yet/);
});
