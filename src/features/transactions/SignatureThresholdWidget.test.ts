import assert from 'node:assert/strict';
import test from 'node:test';
import React, { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { SignatureThresholdWidget } from './SignatureThresholdWidget';
import {
  computeSignatureProgress,
  formatSignatureProgress,
  getSignatureSignerStatusLabel,
  type SignatureSigner,
} from './signatureProgress';

// `tsx` transpiles the shared UI primitives with the classic JSX runtime, which
// resolves the `React` identifier from the global scope during server rendering.
(globalThis as typeof globalThis & { React: typeof React }).React = React;

const SIGNERS: SignatureSigner[] = [
  {
    id: 'signer-treasury',
    publicKey: 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H',
    label: 'Treasury ops',
    role: 'Treasury steward',
    status: 'signed',
  },
  {
    id: 'signer-finance',
    publicKey: 'GCEZWKCA5VLDNRLN3RPRJMRZOX3Z6G5CHCGSNFHEYVXM3XOJMDS674JZ',
    label: 'Finance controller',
    role: 'Finance',
    status: 'signed',
  },
  {
    id: 'signer-security',
    publicKey: 'GDQNY3PBOJOKYZSRMK2S7LHHGWZIUISD4QORETLMXEWXBI7KFZZMKTL3',
    label: 'Security officer',
    role: 'Security',
    status: 'pending',
  },
];

test('computes partial signature progress and the remaining threshold', () => {
  const progress = computeSignatureProgress(SIGNERS, 3);

  assert.equal(progress.requiredSignatures, 3);
  assert.equal(progress.signedCount, 2);
  assert.equal(progress.pendingCount, 1);
  assert.equal(progress.rejectedCount, 0);
  assert.equal(progress.timedOutCount, 0);
  assert.equal(progress.remainingSignatures, 1);
  assert.equal(progress.percentComplete, 67);
  assert.equal(progress.thresholdMet, false);
  assert.equal(progress.state, 'collecting');
  assert.equal(formatSignatureProgress(progress), '2 / 3 signed');
});

test('marks a fully signed payload ready for broadcast', () => {
  const signers: SignatureSigner[] = SIGNERS.map((signer) => ({ ...signer, status: 'signed' }));
  const progress = computeSignatureProgress(signers, 2);

  assert.equal(progress.signedCount, 3);
  assert.equal(progress.percentComplete, 100);
  assert.equal(progress.thresholdMet, true);
  assert.equal(progress.state, 'ready');
});

test('marks a request blocked when rejections make the threshold unreachable', () => {
  const signers: SignatureSigner[] = [
    { ...SIGNERS[0]!, status: 'signed' },
    { ...SIGNERS[1]!, status: 'rejected' },
    { ...SIGNERS[2]!, status: 'rejected' },
  ];
  const progress = computeSignatureProgress(signers, 3);

  assert.equal(progress.rejectedCount, 2);
  assert.equal(progress.remainingSignatures, 2);
  assert.equal(progress.thresholdMet, false);
  assert.equal(progress.state, 'blocked');
});

test('marks a request timed out when every outstanding signer expires', () => {
  const signers: SignatureSigner[] = [
    { ...SIGNERS[0]!, status: 'signed' },
    { ...SIGNERS[1]!, status: 'timed-out' },
    { ...SIGNERS[2]!, status: 'timed-out' },
  ];
  const progress = computeSignatureProgress(signers, 3);

  assert.equal(progress.timedOutCount, 2);
  assert.equal(progress.pendingCount, 0);
  assert.equal(progress.state, 'timed-out');
});

test('sanitizes invalid thresholds and treats a zero threshold as ready', () => {
  assert.equal(computeSignatureProgress([], 0).state, 'ready');
  assert.equal(computeSignatureProgress([], 0).percentComplete, 100);
  assert.equal(computeSignatureProgress([], -2).requiredSignatures, 0);
  assert.equal(computeSignatureProgress([], Number.NaN).requiredSignatures, 0);
});

test('provides a distinct human label for every signer status', () => {
  assert.equal(getSignatureSignerStatusLabel('signed'), 'Signed');
  assert.equal(getSignatureSignerStatusLabel('pending'), 'Pending');
  assert.equal(getSignatureSignerStatusLabel('rejected'), 'Rejected');
  assert.equal(getSignatureSignerStatusLabel('timed-out'), 'Timed out');
});

test('renders progress, signer roles, and status badges for a partial payload', () => {
  const html = renderToStaticMarkup(
    createElement(SignatureThresholdWidget, {
      signers: SIGNERS,
      requiredSignatures: 3,
    }),
  );

  assert.match(html, /2 \/ 3 signed/);
  assert.match(html, /Collecting signatures/);
  assert.match(html, /Treasury ops/);
  assert.match(html, /Treasury steward/);
  assert.match(html, /Security officer/);
  assert.match(html, /Signed/);
  assert.match(html, /Pending/);
  assert.match(html, /1 more signature needed/);
});

test('renders the broadcast-ready state once the threshold is met', () => {
  const html = renderToStaticMarkup(
    createElement(SignatureThresholdWidget, {
      signers: SIGNERS.map((signer) => ({ ...signer, status: 'signed' })),
      requiredSignatures: 3,
    }),
  );

  assert.match(html, /3 \/ 3 signed/);
  assert.match(html, /Ready to broadcast/);
  assert.match(html, /fully authorized and ready for broadcast/);
});
