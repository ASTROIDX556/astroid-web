import assert from 'node:assert/strict';
import test from 'node:test';
import React, { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Transaction } from '@/types/domain';
import { TransactionExportToolbar } from './TransactionExportToolbar';

// tsx compiles JSX with the classic runtime, which expects a global React.
(globalThis as { React?: typeof React }).React = React;

function transaction(id: string, createdAt: string): Transaction {
  return {
    id,
    organizationId: 'org-1',
    walletId: 'wallet-1',
    direction: 'outbound',
    counterparty: 'Acme',
    counterpartyAddress: 'GDEST',
    asset: 'USDC',
    amount: 10,
    usdValue: 10,
    purpose: 'Payment',
    status: 'completed',
    riskScore: 1,
    createdAt,
  };
}

const records = [
  transaction('before', '2026-07-09T12:00:00.000Z'),
  transaction('in-range', '2026-07-11T12:00:00.000Z'),
  transaction('after', '2026-07-13T12:00:00.000Z'),
];

function render(dateFrom: string, dateTo: string, transactions = records): string {
  return renderToStaticMarkup(
    createElement(TransactionExportToolbar, {
      transactions,
      dateFrom,
      dateTo,
      onDateRangeChange: () => undefined,
    }),
  );
}

test('renders the export control with a date range and an in-range count', () => {
  const html = render('2026-07-10', '2026-07-12');

  assert.match(html, /Export CSV/);
  assert.equal(html.match(/type="date"/g)?.length, 2);
  assert.match(html, /value="2026-07-10"/);
  assert.match(html, /value="2026-07-12"/);
  assert.match(html, /1 transaction in range/);
  assert.doesNotMatch(html, /<button[^>]*\sdisabled=""/);
});

test('disables the export button when the range has no transactions', () => {
  const html = render('2030-01-01', '2030-01-31');

  assert.match(html, /0 transactions in range/);
  assert.match(html, /<button[^>]*\sdisabled=""[^>]*>[\s\S]*Export CSV<\/button>/);
});
