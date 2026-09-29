import type { MultisigRequest } from '@/features/approvals/components/MultisigProgressCard';

/**
 * Fixture used when `NEXT_PUBLIC_API_URL` is unset (mock mode).
 * A 2-of-3 style account: threshold 3, three keys weighted 2 / 2 / 1.
 */
export const mockMultisigRequest: MultisigRequest = {
  id: 'apr_01HZX9K2M4TQ8V',
  title: 'Vendor payout — 12,500 USDC',
  summary:
    'Agent "Atlas" proposed a payment to the Q3 infrastructure vendor. Two of the three treasury keys must sign before it can be submitted.',
  sourceAccount: 'GA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJVSGZ',
  threshold: 3,
  thresholdLevel: 'medium',
  xdr: 'AAAAAgAAAAB6i0tPnXFdlBqOSAGCcFOFbLZWlUvJHrxJNfmB0kAYRAAAAGQCMYNlAAAAAQAAAAEAAAAAAAAAAAAAAABm1p0nAAAAAAAAAAEAAAAAAAAAAQAAAADXpEeXHkuvVR1yBqz1c8u3jXwSHRJIvhBQNjLPElsHzwAAAAFVU0RDAAAAADuZ0ZI0iUqQ8h4vBBTMEZuHU0DPbLYqL6DE1p9c1LcxAAAAAAdzWUAAAAAAAAAAAA==',
  networkPassphrase: 'Public Global Stellar Network ; September 2015',
  sequenceNumber: '158328829440001',
  feeStroops: 100,
  operationCount: 1,
  memo: 'INV-2031',
  expiresAt: '2026-09-03T17:00:00Z',
  signers: [
    {
      publicKey: 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H',
      weight: 2,
      status: 'signed',
      label: 'Treasury ops',
      respondedAt: '2026-09-01T09:14:00Z',
    },
    {
      publicKey: 'GCEZWKCA5VLDNRLN3RPRJMRZOX3Z6G5CHCGSNFHEYVXM3XOJMDS674JZ',
      weight: 2,
      status: 'pending',
      label: 'Finance controller',
    },
    {
      publicKey: 'GDQNY3PBOJOKYZSRMK2S7LHHGWZIUISD4QORETLMXEWXBI7KFZZMKTL3',
      weight: 1,
      status: 'pending',
      label: 'Security officer',
    },
  ],
};
