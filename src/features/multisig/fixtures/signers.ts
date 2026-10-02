import type { AccountThresholds, MultisigSignerItem, SignerProposalItem } from '@/types/multisig';

export const INITIAL_THRESHOLDS: AccountThresholds = {
  lowThreshold: 1,
  medThreshold: 3,
  highThreshold: 5,
  masterWeight: 2,
};

export const INITIAL_ACCOUNT_ADDRESS = 'GA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJVSGZ';

export const INITIAL_SIGNERS: MultisigSignerItem[] = [
  {
    id: 'sgn-1',
    publicKey: 'GA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJVSGZ',
    weight: 2,
    label: 'Master Key (Org Treasury)',
    type: 'master',
    status: 'active',
    addedAt: '2026-01-15T08:00:00Z',
  },
  {
    id: 'sgn-2',
    publicKey: 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H',
    weight: 2,
    label: 'Treasury Operations',
    type: 'co-signer',
    status: 'active',
    addedAt: '2026-02-01T10:30:00Z',
  },
  {
    id: 'sgn-3',
    publicKey: 'GCEZWKCA5VLDNRLN3RPRJMRZOX3Z6G5CHCGSNFHEYVXM3XOJMDS674JZ',
    weight: 2,
    label: 'Finance Controller',
    type: 'co-signer',
    status: 'active',
    addedAt: '2026-03-12T14:20:00Z',
  },
  {
    id: 'sgn-4',
    publicKey: 'GDQNY3PBOJOKYZSRMK2S7LHHGWZIUISD4QORETLMXEWXBI7KFZZMKTL3',
    weight: 1,
    label: 'Security Officer',
    type: 'co-signer',
    status: 'active',
    addedAt: '2026-04-05T11:15:00Z',
  },
];

export const INITIAL_PROPOSALS: SignerProposalItem[] = [
  {
    id: 'prop-101',
    accountAddress: INITIAL_ACCOUNT_ADDRESS,
    type: 'add_signer',
    targetPublicKey: 'GCJ7KXL8VPM9QRX4KZT2WBN8YCH5FGL3MPA6DS7VEXQ8K9R0TYU12345',
    targetLabel: 'Compliance Auditor',
    newWeight: 1,
    status: 'proposed',
    createdAt: '2026-09-20T16:45:00Z',
    description: 'Add new Compliance Auditor key with weight 1 to meet Q4 regulatory audit policies.',
    proposedBy: 'Alice Vance (Admin)',
  },
  {
    id: 'prop-102',
    accountAddress: INITIAL_ACCOUNT_ADDRESS,
    type: 'update_thresholds',
    newThresholds: { medThreshold: 4, highThreshold: 6 },
    currentThresholds: { medThreshold: 3, highThreshold: 5 },
    status: 'proposed',
    createdAt: '2026-09-22T09:30:00Z',
    description: 'Increase Medium threshold to 4 and High threshold to 6 for higher security margin.',
    proposedBy: 'Bob Chen (Treasury Lead)',
  },
];
