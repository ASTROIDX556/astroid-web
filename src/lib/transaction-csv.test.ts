import assert from 'node:assert/strict';
import test from 'node:test';
import type { Transaction } from '@/types/domain';
import {
  downloadTransactionCsv,
  filterTransactionsByDateRange,
  serializeTransactionCsv,
} from './transaction-csv';

function transaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 'txn-1',
    organizationId: 'org-1',
    walletId: 'wallet-sender',
    agentId: 'agent-1',
    agentName: 'Atlas',
    direction: 'outbound',
    counterparty: 'Acme, Inc.',
    counterpartyAddress: 'GRECIPIENT',
    asset: 'USDC',
    amount: 12.5,
    usdValue: 12.5,
    memo: 'Invoice "Q3", renewal',
    purpose: 'Vendor payment',
    status: 'completed',
    riskScore: 4,
    stellarHash: 'hash-1',
    createdAt: '2026-07-10T12:00:00.000Z',
    ...overrides,
  };
}

/** Minimal RFC 4180 reader, so tests assert decoded values, not just raw text. */
function parseCsvRow(row: string): string[] {
  const fields: string[] = [];
  let field = '';
  let quoted = false;

  for (let index = 0; index < row.length; index += 1) {
    const character = row[index];
    if (character === '"') {
      if (quoted && row[index + 1] === '"') {
        field += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === ',' && !quoted) {
      fields.push(field);
      field = '';
    } else {
      field += character;
    }
  }
  fields.push(field);
  return fields;
}

test('serializes the required transaction columns in order', () => {
  const csv = serializeTransactionCsv([transaction()]);
  const [header, row] = csv.split('\r\n');

  assert.equal(
    header,
    '"Timestamp","Hash","Sender","Recipient","Amount","Asset","Status","Memo"',
  );
  assert.deepEqual(parseCsvRow(row ?? ''), [
    '2026-07-10T12:00:00.000Z',
    'hash-1',
    'wallet-sender',
    'GRECIPIENT',
    '-12.5',
    'USDC',
    'completed',
    'Invoice "Q3", renewal',
  ]);
});

test('uses incoming addresses as the sender for inbound transactions', () => {
  const csv = serializeTransactionCsv([
    transaction({ direction: 'inbound', amount: 30, status: 'confirmed' }),
  ]);
  const fields = parseCsvRow(csv.split('\r\n')[1] ?? '');

  assert.equal(fields[2], 'GRECIPIENT');
  assert.equal(fields[3], 'wallet-sender');
  assert.equal(fields[4], '30');
  assert.equal(fields[6], 'confirmed');
});

test('escapes commas, quotes and newlines in memos and asset codes', () => {
  const memo = 'Invoice "Q3", renewal\nref: A-1';
  const asset = 'USDC,REWARD';
  const csv = serializeTransactionCsv([
    transaction({ memo, asset, counterpartyAddress: 'GDEST, "primary"' }),
  ]);
  const records = csv.split('\r\n');

  // The embedded line feed belongs to the quoted memo, not a second record.
  assert.equal(records.length, 2);
  const fields = parseCsvRow(records[1] ?? '');
  assert.equal(fields.length, 8);
  assert.equal(fields[5], asset);
  assert.equal(fields[7], memo);
  assert.equal(fields[3], 'GDEST, "primary"');
});

test('neutralizes spreadsheet formulas in memo and asset text', () => {
  const csv = serializeTransactionCsv([
    transaction({ memo: '=HYPERLINK("example")', asset: '@CMD,USDC' }),
  ]);
  const fields = parseCsvRow(csv.split('\r\n')[1] ?? '');

  assert.equal(fields[5], "'@CMD,USDC");
  assert.equal(fields[7], '\'=HYPERLINK("example")');
});

test('emits only the header row when there is nothing to export', () => {
  assert.equal(
    serializeTransactionCsv([]),
    '"Timestamp","Hash","Sender","Recipient","Amount","Asset","Status","Memo"',
  );
});

test('filters exported records using inclusive date boundaries', () => {
  const records = [
    transaction({ id: 'before', createdAt: '2026-07-09T23:59:59' }),
    transaction({ id: 'start', createdAt: '2026-07-10T00:00:00' }),
    transaction({ id: 'middle', createdAt: '2026-07-11T12:00:00' }),
    transaction({ id: 'end', createdAt: '2026-07-12T23:59:59.999' }),
    transaction({ id: 'after', createdAt: '2026-07-13T00:00:00' }),
  ];

  const filtered = filterTransactionsByDateRange(records, {
    from: '2026-07-10',
    to: '2026-07-12',
  });

  assert.deepEqual(
    filtered.map((record) => record.id),
    ['start', 'middle', 'end'],
  );
  const csv = serializeTransactionCsv(filtered);
  assert.equal(csv.split('\r\n').length, 4);
  assert.doesNotMatch(csv, /before|after/);
});

test('leaves the range unbounded when either date is empty', () => {
  const records = [
    transaction({ id: 'old', createdAt: '2020-01-01T12:00:00' }),
    transaction({ id: 'recent', createdAt: '2030-01-01T12:00:00' }),
  ];

  assert.deepEqual(
    filterTransactionsByDateRange(records, { from: '', to: '' }).map(
      (record) => record.id,
    ),
    ['old', 'recent'],
  );
  assert.deepEqual(
    filterTransactionsByDateRange(records, { from: '2025-01-01', to: '' }).map(
      (record) => record.id,
    ),
    ['recent'],
  );
});

interface DownloadCapture {
  type: string;
  text: string;
  href: string;
  filename: string;
  clicked: boolean;
  revoked: string | null;
}

/** Installs just enough browser globals to observe the generated download. */
function withBrowserDownload(run: (capture: DownloadCapture) => void): void {
  const globals = globalThis as Record<string, unknown>;
  const previousWindow = globals.window;
  const previousDocument = globals.document;
  const previousBlob = globals.Blob;
  const previousCreate = URL.createObjectURL;
  const previousRevoke = URL.revokeObjectURL;
  const capture: DownloadCapture = {
    type: '',
    text: '',
    href: '',
    filename: '',
    clicked: false,
    revoked: null,
  };

  class CapturingBlob {
    constructor(parts: string[], options: { type?: string }) {
      capture.text = parts.join('');
      capture.type = options.type ?? '';
    }
  }

  const anchor = {
    href: '',
    download: '',
    hidden: false,
    click: () => {
      capture.filename = anchor.download;
      capture.clicked = true;
    },
    remove: () => undefined,
  };

  globals.Blob = CapturingBlob;
  globals.window = {
    setTimeout: (callback: () => void) => {
      callback();
      return 1;
    },
  };
  globals.document = {
    body: { appendChild: () => undefined },
    createElement: (tag: string) => {
      assert.equal(tag, 'a');
      return anchor;
    },
  };
  URL.createObjectURL = () => {
    capture.href = 'blob:transaction-export';
    return capture.href;
  };
  URL.revokeObjectURL = (url: string | URL) => {
    capture.revoked = String(url);
  };

  try {
    run(capture);
  } finally {
    if (previousWindow === undefined) delete globals.window;
    else globals.window = previousWindow;
    if (previousDocument === undefined) delete globals.document;
    else globals.document = previousDocument;
    if (previousBlob === undefined) delete globals.Blob;
    else globals.Blob = previousBlob;
    URL.createObjectURL = previousCreate;
    URL.revokeObjectURL = previousRevoke;
  }
}

test('downloads a .csv file with the text/csv MIME type', () => {
  withBrowserDownload((capture) => {
    downloadTransactionCsv([transaction()], 'transactions-2026-07-10.csv');

    assert.match(capture.type, /^text\/csv/);
    assert.equal(capture.filename, 'transactions-2026-07-10.csv');
    assert.equal(capture.clicked, true);
    assert.equal(capture.href, 'blob:transaction-export');
    assert.equal(capture.revoked, 'blob:transaction-export');
    assert.match(capture.text, /^"Timestamp","Hash"/);
  });
});
