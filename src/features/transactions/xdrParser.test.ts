import assert from 'node:assert/strict';
import test from 'node:test';

import {
  describeOperation,
  inspectTransactionXdr,
  stroopsToXlm,
  type InspectedXdrOperation,
} from './xdrParser';

/** Real Stellar V1 payment envelope from the mock transaction fixtures. */
const REAL_PAYMENT_XDR =
  'AAAAAgAAAAB6i0tPnXFdlBqOSAGCcFOFbLZWlUvJHrxJNfmB0kAYRAAAAGQCMYNlAAAAAQAAAAEAAAAAAAAAAAAAAABm1p0nAAAAAAAAAAEAAAAAAAAAAQAAAADXpEeXHkuvVR1yBqz1c8u3jXwSHRJIvhBQNjLPElsHzwAAAAFVU0RDAAAAADuZ0ZI0iUqQ8h4vBBTMEZuHU0DPbLYqL6DE1p9c1LcxAAAAAAdzWUAAAAAAAAAAAA==';

const JSON_ENVELOPE_XDR = Buffer.from(
  JSON.stringify({
    type: 'TransactionEnvelope',
    sourceAccount: 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H',
    fee: '200',
    sequenceNumber: '2147483649',
    operationCount: 1,
    networkPassphrase: 'Test SDF Network ; September 2015',
    memo: 'Invoice #42, rent',
    operations: [
      {
        type: 'Payment',
        destination: 'GA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJVSGZ',
        amount: '125.50',
        asset: 'USDC',
      },
    ],
    signatures: [],
  }),
).toString('base64');

function uint32(value: number): Buffer {
  const buffer = Buffer.alloc(4);
  buffer.writeUInt32BE(value, 0);
  return buffer;
}

function int64(value: bigint): Buffer {
  const buffer = Buffer.alloc(8);
  buffer.writeBigInt64BE(value, 0);
  return buffer;
}

function opaqueString(value: string): Buffer {
  const bytes = Buffer.from(value, 'utf8');
  const padding = (4 - (bytes.length % 4)) % 4;
  return Buffer.concat([uint32(bytes.length), bytes, Buffer.alloc(padding)]);
}

function accountId(seed: number): Buffer {
  const raw = Buffer.alloc(32, seed);
  return Buffer.concat([uint32(0), raw]);
}

/** Minimal V1 envelope used to exercise memo decoding without time bounds. */
function binaryEnvelopeWithTextMemo(memo: string): string {
  return Buffer.concat([
    uint32(2), // ENVELOPE_TYPE_TX
    accountId(7),
    uint32(100), // fee
    int64(4242n), // sequence
    uint32(0), // no time bounds
    uint32(1), // MEMO_TEXT
    opaqueString(memo),
    uint32(0), // no operations
    uint32(0), // transaction extension
    uint32(0), // no signatures
  ]).toString('base64');
}

test('inspects a real binary Stellar payment envelope', () => {
  const result = inspectTransactionXdr(REAL_PAYMENT_XDR);

  assert.equal(result.valid, true);
  assert.equal(result.parseSource, 'binary');
  assert.equal(result.fee, '100');
  assert.equal(result.feeXlm, '0.00001');
  assert.equal(result.sequenceNumber.length > 0, true);
  assert.equal(result.operationCount, 1);
  assert.equal(result.operations.length, 1);
  assert.equal(result.operations[0]?.type, 'Payment');
  assert.equal(result.operations[0]?.amount, '12.5');
  assert.equal(result.operations[0]?.asset, 'USDC');
  assert.match(result.operations[0]?.destination ?? '', /^G[A-Z2-7]{55}$/);
  assert.match(result.sourceAccount, /^G[A-Z2-7]{55}$/);
  assert.equal(result.memo, null);
  assert.equal(result.memoType, null);
  assert.equal(result.signatures.length, 0);
  assert.equal(result.networkLabel, 'Mainnet');
  assert.match(result.operationSummaries[0] ?? '', /Payment · to G.* · 12\.5 USDC/);
});

test('decodes a text memo from a binary envelope', () => {
  const result = inspectTransactionXdr(binaryEnvelopeWithTextMemo('Invoice 42'));

  assert.equal(result.valid, true);
  assert.equal(result.parseSource, 'binary');
  assert.equal(result.memo, 'Invoice 42');
  assert.equal(result.memoType, 'Text');
  assert.equal(result.operationCount, 0);
  assert.deepEqual(result.operationSummaries, []);
});

test('preserves memo contents from the canonical JSON parser', () => {
  const result = inspectTransactionXdr(JSON_ENVELOPE_XDR);

  assert.equal(result.valid, true);
  assert.equal(result.parseSource, 'json');
  assert.equal(result.networkLabel, 'Testnet');
  assert.equal(result.memo, 'Invoice #42, rent');
  assert.equal(result.operations[0]?.amount, '125.50');
  assert.deepEqual(result.sourceAccounts, [
    'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H',
  ]);
});

test('malformed, truncated and non-string inputs never throw', () => {
  const inputs = [
    '',
    '   ',
    '!!!not-base64!!!',
    Buffer.from('just plain text').toString('base64'),
    REAL_PAYMENT_XDR.slice(0, 40),
    null as unknown as string,
    undefined as unknown as string,
    { unexpected: true } as unknown as string,
  ];

  for (const input of inputs) {
    let result;
    assert.doesNotThrow(() => {
      result = inspectTransactionXdr(input);
    });
    assert.equal(result?.valid, false);
    assert.equal(result?.parseSource, 'fallback');
    assert.equal(result?.operations.length, 0);
    assert.ok((result?.message ?? '').length > 0);
  }
});

test('truncated binary payloads explain why the envelope was rejected', () => {
  const result = inspectTransactionXdr(REAL_PAYMENT_XDR.slice(0, 60));
  assert.equal(result.valid, false);
  assert.match(result.warning ?? '', /ended before|could not read/i);
});

test('stroopsToXlm keeps full precision and handles negative amounts', () => {
  assert.equal(stroopsToXlm(0n), '0.0');
  assert.equal(stroopsToXlm(100n), '0.00001');
  assert.equal(stroopsToXlm(12_500_000n), '1.25');
  assert.equal(stroopsToXlm(-25_000_000n), '-2.5');
});

test('describeOperation surfaces source, destination, issuer and scalar details', () => {
  const operation: InspectedXdrOperation = {
    type: 'Change Trust',
    source: 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H',
    destination: 'GA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJVSGZ',
    asset: 'USDC',
    assetIssuer: 'GDESTINATIONBETA123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ234567',
    detail: 'limit 1000',
  };

  const summary = describeOperation(operation);
  assert.match(summary, /^Change Trust · source GBRPYH…OX2H · to GA7QYN…VSGZ/);
  assert.match(summary, /USDC · issuer GDESTI…4567 · limit 1000/);
});
