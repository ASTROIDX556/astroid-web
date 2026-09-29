export interface OperationSummary {
  type: string;
  source?: string;
  destination?: string;
  amount?: string;
  asset?: string;
}

export interface SignatureSummary {
  publicKey: string;
  hint: string;
}

export interface ParsedEnvelope {
  valid: boolean;
  sourceAccount: string;
  fee: string;
  sequenceNumber: string;
  operationCount: number;
  operations: OperationSummary[];
  signatures: SignatureSummary[];
  networkPassphrase: string;
  message: string;
  warning?: string;
}

function decodeBase64ToUtf8(value: string): {
  valid: boolean;
  text: string;
  message?: string;
} {
  const cleaned = value.trim();

  if (!cleaned) {
    return {
      valid: false,
      text: '',
      message: 'Paste a base64-encoded transaction envelope to inspect it.',
    };
  }

  if (!/^[A-Za-z0-9+/=_\-\s]+$/.test(cleaned)) {
    return {
      valid: false,
      text: '',
      message:
        'This does not look like a valid Stellar XDR payload. Use a base64 string only.',
    };
  }

  try {
    const normalized = cleaned.replace(/\s+/g, '');
    const binary =
      typeof window !== 'undefined' && typeof window.atob === 'function'
        ? window.atob(normalized)
        : Buffer.from(normalized, 'base64').toString('binary');

    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    const text = new TextDecoder('utf-8').decode(bytes);

    if (!text || !text.trim()) {
      return {
        valid: false,
        text: '',
        message: 'The XDR could not be decoded into a readable payload.',
      };
    }

    return { valid: true, text };
  } catch {
    return {
      valid: false,
      text: '',
      message: 'The supplied XDR is not valid base64 and could not be decoded safely.',
    };
  }
}

/** Decodes a (mock) base64 TransactionEnvelope into a human-readable summary. */
export function parseEnvelope(value: string): ParsedEnvelope {
  const { valid: base64Valid, text, message } = decodeBase64ToUtf8(value);

  if (!base64Valid || !text) {
    const fallback = value.trim();
    const looksLikeBase64 = !!fallback && /^[A-Za-z0-9+/=_\-\s]+$/.test(fallback);

    return {
      valid: false,
      sourceAccount: 'Unknown',
      fee: '—',
      sequenceNumber: '—',
      operationCount: 0,
      operations: [],
      signatures: [],
      networkPassphrase: '—',
      message: message ?? 'Invalid XDR payload.',
      warning: looksLikeBase64
        ? 'Base64 structure looks valid, but it does not contain a recognizable Stellar transaction envelope.'
        : 'The value is not valid base64 or is too short to be a transaction envelope.',
    };
  }

  try {
    const parsed = JSON.parse(text) as Record<string, unknown>;
    const transaction =
      typeof parsed.transaction === 'object' && parsed.transaction !== null
        ? (parsed.transaction as Record<string, unknown>)
        : parsed;

    const operations = Array.isArray(transaction.operations)
      ? transaction.operations.map((operation, index) => {
          const item =
            typeof operation === 'object' && operation !== null
              ? (operation as Record<string, unknown>)
              : {};
          return {
            type: typeof item.type === 'string' ? item.type : `Operation ${index + 1}`,
            source: typeof item.source === 'string' ? item.source : undefined,
            destination:
              typeof item.destination === 'string' ? item.destination : undefined,
            amount: typeof item.amount === 'string' ? item.amount : undefined,
            asset: typeof item.asset === 'string' ? item.asset : undefined,
          } satisfies OperationSummary;
        })
      : [];

    const signatures = Array.isArray(transaction.signatures)
      ? transaction.signatures.map((signature) => {
          const item =
            typeof signature === 'object' && signature !== null
              ? (signature as Record<string, unknown>)
              : {};
          return {
            publicKey:
              typeof item.publicKey === 'string' ? item.publicKey : 'Unknown signer',
            hint: typeof item.hint === 'string' ? item.hint : 'ed25519',
          } satisfies SignatureSummary;
        })
      : [];

    const sourceAccount =
      typeof transaction.sourceAccount === 'string'
        ? transaction.sourceAccount
        : typeof transaction.source === 'string'
          ? transaction.source
          : 'Unknown';

    const fee =
      typeof transaction.fee === 'string' || typeof transaction.fee === 'number'
        ? String(transaction.fee)
        : '100';

    const sequenceNumber =
      typeof transaction.sequenceNumber === 'string' ||
      typeof transaction.sequenceNumber === 'number'
        ? String(transaction.sequenceNumber)
        : '0';

    const networkPassphrase =
      typeof transaction.networkPassphrase === 'string'
        ? transaction.networkPassphrase
        : 'Public Global Stellar Network ; September 2015';

    return {
      valid: true,
      sourceAccount,
      fee,
      sequenceNumber,
      operationCount: operations.length || Number(transaction.operationCount ?? 0),
      operations,
      signatures,
      networkPassphrase,
      message: 'XDR envelope decoded successfully.',
    };
  } catch {
    const fallback = value.trim();
    return {
      valid: false,
      sourceAccount: 'Unknown',
      fee: '—',
      sequenceNumber: '—',
      operationCount: 0,
      operations: [],
      signatures: [],
      networkPassphrase: '—',
      message:
        'This payload was base64-decoded, but it is not a recognizable transaction envelope.',
      warning:
        fallback.length > 28
          ? 'The base64 payload is structurally valid but does not match the expected mock transaction schema.'
          : 'Use one of the sample XDR values or paste a valid base64 transaction envelope.',
    };
  }
}
