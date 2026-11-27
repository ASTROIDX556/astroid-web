import assert from 'node:assert/strict';
import test, { describe } from 'node:test';
import { createElement, type ErrorInfo, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import {
  ChartErrorBoundary,
  chartErrorRetryState,
  type ChartErrorState,
} from './chart-error-boundary';

describe('ChartErrorBoundary (#574)', () => {
  test('derives error state from a thrown chart error', () => {
    const error = new Error('Malformed metric payload');
    const state = ChartErrorBoundary.getDerivedStateFromError(error);

    assert.equal(state.error, error);
  });

  test('retry transition clears the error and remounts the chart subtree', () => {
    const failed: ChartErrorState = {
      error: new Error('Recharts failed'),
      retryToken: 3,
    };

    const recovered = chartErrorRetryState(failed);

    assert.equal(recovered.error, null);
    assert.equal(recovered.retryToken, 4);
    // The input state is not mutated.
    assert.ok(failed.error instanceof Error);
    assert.equal(failed.retryToken, 3);
  });

  test('reports the caught error to diagnostics without changing the fallback', () => {
    const reported: Error[] = [];
    const boundary = new ChartErrorBoundary({
      children: null,
      onError: (error) => reported.push(error),
    });
    const error = new Error('Series data is not an array');
    const info: ErrorInfo = { componentStack: 'at BudgetChart' };

    const originalError = console.error;
    console.error = () => undefined;
    try {
      boundary.componentDidCatch(error, info);
    } finally {
      console.error = originalError;
    }

    assert.deepEqual(reported, [error]);
  });

  test('fallback renders a diagnostic message and a retry control', () => {
    const boundary = new ChartErrorBoundary({ children: null });
    boundary.state = {
      error: new Error('Cannot read properties of undefined (reading map)'),
      retryToken: 1,
    };

    const html = renderToStaticMarkup(boundary.render() as ReactElement);

    assert.match(html, /role="alert"/);
    assert.match(html, /Chart unavailable/);
    assert.match(html, /could not be rendered/i);
    assert.match(html, /reading map/);
    assert.match(html, /Retry chart/);
  });

  test('renders children while healthy', () => {
    const boundary = new ChartErrorBoundary({
      children: createElement('span', null, 'chart body'),
    });

    const html = renderToStaticMarkup(boundary.render() as ReactElement);

    assert.match(html, /chart body/);
    assert.doesNotMatch(html, /Chart unavailable/);
  });
});
