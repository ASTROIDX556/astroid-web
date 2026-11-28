import assert from 'node:assert/strict';
import test from 'node:test';
import {
  BUDGET_ALLOCATION_HEADERS,
  buildBudgetAllocationFilename,
  downloadBudgetAllocations,
  formatColumnHeader,
  serializeBudgetAllocations,
  serializeBudgetAllocationsCsv,
  serializeBudgetAllocationsJson,
  toBudgetAllocationRecords,
  type BudgetAllocationSource,
  type DepartmentBudgetAllocationRecord,
} from './export-utils';

const EXPORT_TIME = new Date('2026-11-23T09:05:07.250Z');

function source(
  overrides: Partial<BudgetAllocationSource> &
    Pick<BudgetAllocationSource, 'id' | 'departmentName'>,
): BudgetAllocationSource {
  return {
    departmentCode: 'ENG',
    managerName: 'Ada Lovelace',
    asset: 'USDC',
    period: 'monthly',
    totalLimit: 1000,
    totalSpent: 750,
    totalRemaining: 250,
    updatedAt: '2026-11-20T12:00:00.000Z',
    agents: [{}, {}],
    ...overrides,
  };
}

function record(
  overrides: Partial<DepartmentBudgetAllocationRecord> = {},
): DepartmentBudgetAllocationRecord {
  return {
    departmentId: 'dep-1',
    departmentName: 'Engineering',
    departmentCode: 'ENG',
    managerName: 'Ada Lovelace',
    asset: 'USDC',
    period: 'monthly',
    allocated: 1000,
    spent: 750,
    remaining: 250,
    utilizationPercent: 75,
    agentCount: 2,
    updatedAt: '2026-11-20T12:00:00.000Z',
    ...overrides,
  };
}

const HEADER =
  'Department ID,Department Name,Department Code,Manager Name,Asset,Period,Allocated,Spent,Remaining,Utilization Percent,Agent Count,Updated At';

test('formatColumnHeader splits camelCase and upper-cases known acronyms', () => {
  assert.equal(formatColumnHeader('departmentId'), 'Department ID');
  assert.equal(formatColumnHeader('utilizationPercent'), 'Utilization Percent');
  assert.equal(formatColumnHeader('total_usd'), 'Total USD');
  assert.equal(formatColumnHeader('asset'), 'Asset');
  assert.equal(formatColumnHeader(''), 'Column');
});

test('BUDGET_ALLOCATION_HEADERS is formatted, ordered and comma-free', () => {
  assert.deepEqual(BUDGET_ALLOCATION_HEADERS, HEADER.split(','));
  assert.equal(BUDGET_ALLOCATION_HEADERS[0], 'Department ID');
});

test('toBudgetAllocationRecords maps amounts, agents and utilization', () => {
  const [row] = toBudgetAllocationRecords([
    source({
      id: 'eng',
      departmentName: 'Engineering',
      totalLimit: 1000,
      totalSpent: 750,
    }),
  ]);
  assert.ok(row);
  assert.equal(row.departmentId, 'eng');
  assert.equal(row.departmentName, 'Engineering');
  assert.equal(row.allocated, 1000);
  assert.equal(row.spent, 750);
  assert.equal(row.remaining, 250);
  assert.equal(row.utilizationPercent, 75);
  assert.equal(row.agentCount, 2);
});

test('toBudgetAllocationRecords is safe for zero allocations and bad numbers', () => {
  const rows = toBudgetAllocationRecords([
    source({
      id: 'none',
      departmentName: 'Unfunded',
      totalLimit: 0,
      totalSpent: 50,
      totalRemaining: 0,
    }),
    source({
      id: 'nan',
      departmentName: 'Broken',
      totalLimit: Number.NaN,
      totalSpent: Number.POSITIVE_INFINITY,
      totalRemaining: undefined,
    }),
  ]);

  assert.equal(rows[0]?.utilizationPercent, 0);
  assert.equal(rows[1]?.allocated, 0);
  assert.equal(rows[1]?.spent, 0);
  assert.equal(rows[1]?.remaining, 0);
  assert.equal(rows[1]?.utilizationPercent, 0);
  assert.equal(rows[1]?.agentCount, 2);
});

test('toBudgetAllocationRecords rounds overspend utilization to two decimals', () => {
  const [row] = toBudgetAllocationRecords([
    source({
      id: 'over',
      departmentName: 'Over',
      totalLimit: 300,
      totalSpent: 1000,
      totalRemaining: -700,
    }),
  ]);
  assert.equal(row?.utilizationPercent, 333.33);
});

test('CSV writes the formatted header then one CRLF row per record', () => {
  const csv = serializeBudgetAllocationsCsv([
    record(),
    record({ departmentId: 'dep-2' }),
  ]);
  const lines = csv.split('\r\n');
  assert.equal(lines[0], HEADER);
  assert.equal(lines.length, 3);
  assert.equal(
    lines[1],
    'dep-1,Engineering,ENG,Ada Lovelace,USDC,monthly,1000,750,250,75,2,2026-11-20T12:00:00.000Z',
  );
});

test('CSV escapes commas, quotes, newlines and formula prefixes in department names', () => {
  const csv = serializeBudgetAllocationsCsv([
    record({ departmentName: 'R&D, "North"' }),
    record({ departmentName: 'Line\nBreak' }),
    record({ departmentName: '=HYPERLINK("https://evil.example")' }),
  ]);
  const lines = csv.split('\r\n');

  assert.ok(lines[1]?.includes('"R&D, ""North"""'));
  assert.ok(csv.includes('"Line\nBreak"'));
  assert.ok(csv.includes('"\'=HYPERLINK(""https://evil.example"")"'));
  // A quoted newline stays inside one record instead of splitting the row.
  assert.equal(lines.length, 4); // header + 3 rows
  assert.equal(lines.filter((line) => line.includes('R&D')).length, 1);
});

test('CSV keeps numeric columns bare and aligned for an empty dataset', () => {
  assert.equal(serializeBudgetAllocationsCsv([]), HEADER);
  const csv = serializeBudgetAllocationsCsv([
    record({ allocated: -5, utilizationPercent: 0 }),
  ]);
  assert.ok(csv.split('\r\n')[1]?.includes(',-5,750,250,0,'));
});

test('JSON wraps records in a self-describing envelope', () => {
  const records = [
    record(),
    record({ departmentId: 'dep-2', departmentName: 'R&D, "North"' }),
  ];
  const envelope = JSON.parse(serializeBudgetAllocationsJson(records, EXPORT_TIME)) as {
    exportedAt: string;
    recordType: string;
    count: number;
    allocations: DepartmentBudgetAllocationRecord[];
  };

  assert.equal(envelope.exportedAt, '2026-11-23T09:05:07.250Z');
  assert.equal(envelope.recordType, 'department-budget-allocations');
  assert.equal(envelope.count, 2);
  assert.deepEqual(envelope.allocations, records);
});

test('JSON handles an empty dataset without inventing records', () => {
  const envelope = JSON.parse(serializeBudgetAllocationsJson([], EXPORT_TIME)) as {
    count: number;
    allocations: unknown[];
  };
  assert.equal(envelope.count, 0);
  assert.deepEqual(envelope.allocations, []);
});

test('serializeBudgetAllocations dispatches on the format', () => {
  const records = [record()];
  assert.equal(
    serializeBudgetAllocations(records, 'csv'),
    serializeBudgetAllocationsCsv(records),
  );
  assert.equal(
    serializeBudgetAllocations(records, 'json', EXPORT_TIME),
    serializeBudgetAllocationsJson(records, EXPORT_TIME),
  );
});

test('buildBudgetAllocationFilename slugifies the scope and stamps the export time', () => {
  assert.equal(
    buildBudgetAllocationFilename('csv', EXPORT_TIME),
    'astroid-department-budget-allocations-2026-11-23T09-05-07-250Z.csv',
  );
  assert.equal(
    buildBudgetAllocationFilename('json', EXPORT_TIME),
    'astroid-department-budget-allocations-2026-11-23T09-05-07-250Z.json',
  );
});

test('downloadBudgetAllocations reports the export and skips empty datasets', () => {
  const result = downloadBudgetAllocations([record()], 'csv', EXPORT_TIME);
  assert.deepEqual(result, {
    rowCount: 1,
    fileName: 'astroid-department-budget-allocations-2026-11-23T09-05-07-250Z.csv',
    format: 'csv',
  });
  assert.equal(downloadBudgetAllocations([], 'json', EXPORT_TIME), null);
});

test('downloads are a no-op outside the browser', () => {
  assert.equal(typeof window, 'undefined');
  assert.doesNotThrow(() => downloadBudgetAllocations([record()], 'json', EXPORT_TIME));
});
