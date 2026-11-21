/**
 * Inspector-facing XDR parser (issue #577).
 *
 * `@/lib/xdr` already provides a defensive JSON-envelope parser. This module
 * keeps that behaviour for fixtures and adds a small, dependency-free decoder
 * for real base64-encoded Stellar transaction envelopes. Nothing here throws:
 * unsupported operations, truncated payloads and malformed base64 all resolve
 * to a fallback result the modal can render (and the React `ErrorBoundary`
 * around the modal is the last line of defence).
 */

import {
  parseTransactionXdr,
  type ParsedXdrTransaction,
  type XdrOperation,
  type XdrSignature,
} from '@/lib/xdr';

const STROOPS_PER_XLM = 10_000_000n;
const DEFAULT_NETWORK_PASSPHRASE = 'Public Global Stellar Network ; September 2015';
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/** A decoded operation with the extra context the inspector displays. */
export interface InspectedXdrOperation extends XdrOperation {
  /** Issuer of a non-native asset, when decoded. */
  assetIssuer?: string;
  /** Flags, data values, limits and other scalar details. */
  detail?: string;
}

export interface XdrTimeBounds {
  min: string;
  max: string;
}

export type XdrParseSource = 'binary' | 'json' | 'fallback';

/** View model consumed by `XdrInspectorModal`. */
export interface XdrInspection
  extends Omit<ParsedXdrTransaction, 'memo' | 'operations'> {
  /** Memo text/id/hash, normalised to `null` for an absent memo. */
  memo: string | null;
  /** Human-readable memo type (`Text`, `ID`, `Hash`, `Return`). */
  memoType: string | null;
  /** Fee converted from stroops to XLM with full precision. */
  feeXlm: string;
  /** Short network label derived from the passphrase. */
  networkLabel: string;
  /** Transaction source plus every operation-level source override. */
  sourceAccounts: string[];
  /** One-line explanations used by the operations list and unit tests. */
  operationSummaries: string[];
  /** Which decoder produced the result, useful for diagnostics. */
  parseSource: XdrParseSource;
  operations: InspectedXdrOperation[];
  timeBounds?: XdrTimeBounds;
}

type DecodedEnvelope = Omit<ParsedXdrTransaction, 'operations'> & {
  operations: InspectedXdrOperation[];
  memoType?: string;
  timeBounds?: XdrTimeBounds;
};

interface DecodedAsset {
  code: string;
  issuer?: string;
}

interface DecodedMemo {
  memo?: string;
  memoType?: string;
}

class XdrDecodeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'XdrDecodeError';
  }
}

/** Minimum XDR reader: big-endian primitives with bounds checks. */
class XdrReader {
  private offset = 0;
  private readonly view: DataView;

  constructor(private readonly bytes: Uint8Array) {
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  }

  get remaining(): number {
    return this.bytes.length - this.offset;
  }

  private ensure(length: number): void {
    if (length < 0 || this.offset + length > this.bytes.length) {
      throw new XdrDecodeError(
        'The XDR payload ended before the envelope was complete.',
      );
    }
  }

  readUint32(): number {
    this.ensure(4);
    const value = this.view.getUint32(this.offset, false);
    this.offset += 4;
    return value;
  }

  readInt32(): number {
    this.ensure(4);
    const value = this.view.getInt32(this.offset, false);
    this.offset += 4;
    return value;
  }

  readInt64(): bigint {
    this.ensure(8);
    const value = this.view.getBigInt64(this.offset, false);
    this.offset += 8;
    return value;
  }

  readUint64(): bigint {
    this.ensure(8);
    const value = this.view.getBigUint64(this.offset, false);
    this.offset += 8;
    return value;
  }

  readFixed(length: number): Uint8Array {
    this.ensure(length);
    const slice = this.bytes.slice(this.offset, this.offset + length);
    this.offset += length;
    return slice;
  }

  skip(length: number): void {
    this.ensure(length);
    this.offset += length;
  }

  /** XDR variable-length opaque: 4-byte length, bytes, then zero padding. */
  readOpaque(maxLength: number): Uint8Array {
    const length = this.readUint32();
    if (length > maxLength) {
      throw new XdrDecodeError('An XDR field exceeded the maximum allowed length.');
    }
    const value = this.readFixed(length);
    this.skip((4 - (length % 4)) % 4);
    return value;
  }

  readString(maxLength: number): string {
    return new TextDecoder('utf-8').decode(this.readOpaque(maxLength));
  }
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** RFC 4648 base32 without padding, the alphabet used by Stellar StrKey. */
function base32Encode(bytes: Uint8Array): string {
  let result = '';
  let buffer = 0;
  let bits = 0;

  for (const byte of bytes) {
    buffer = (buffer << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      result += BASE32_ALPHABET[(buffer >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) result += BASE32_ALPHABET[(buffer << (5 - bits)) & 31];
  return result;
}

/** CRC-16/XMODEM, stored little-endian in a StrKey checksum. */
function crc16XModem(bytes: Uint8Array): number {
  let crc = 0;
  for (const byte of bytes) {
    crc ^= byte << 8;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc & 0xffff;
}

/** Encode a 32-byte ed25519 public key as a StrKey `G...` address. */
function encodePublicKey(raw: Uint8Array): string {
  if (raw.length !== 32) return 'Unknown';
  const payload = new Uint8Array(33);
  payload[0] = 6 << 3; // ed25519 public key version byte
  payload.set(raw, 1);

  const checksum = crc16XModem(payload);
  const withChecksum = new Uint8Array(35);
  withChecksum.set(payload, 0);
  withChecksum[33] = checksum & 0xff;
  withChecksum[34] = (checksum >> 8) & 0xff;
  return base32Encode(withChecksum);
}

function decodeBase64(value: string): Uint8Array | null {
  const cleaned = value
    .trim()
    .replace(/\s+/g, '')
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  if (!cleaned || !/^[A-Za-z0-9+/]+={0,2}$/.test(cleaned)) return null;

  try {
    const padded = cleaned.padEnd(Math.ceil(cleaned.length / 4) * 4, '=');
    const binary =
      typeof globalThis.atob === 'function'
        ? globalThis.atob(padded)
        : Buffer.from(padded, 'base64').toString('binary');
    return Uint8Array.from(binary, (char) => char.charCodeAt(0));
  } catch {
    return null;
  }
}

function readAccountId(reader: XdrReader): string {
  const keyType = reader.readUint32();
  const raw = reader.readFixed(32);
  if (keyType !== 0) return `Unknown account (key type ${keyType})`;
  return encodePublicKey(raw);
}

function readOptionalAccountId(reader: XdrReader): string | undefined {
  const present = reader.readUint32();
  if (present === 0) return undefined;
  if (present !== 1)
    throw new XdrDecodeError('Invalid optional account marker in XDR.');
  return readAccountId(reader);
}

function readAsset(reader: XdrReader): DecodedAsset {
  const type = reader.readUint32();
  if (type === 0) return { code: 'XLM' };
  if (type === 1 || type === 2) {
    // Asset codes are fixed-size opaque values, not XDR strings.
    const codeBytes = reader.readFixed(type === 1 ? 4 : 12);
    const code = new TextDecoder('utf-8').decode(codeBytes).replace(/\0+$/, '').trim();
    const issuer = readAccountId(reader);
    return { code, issuer };
  }
  throw new XdrDecodeError(`Asset type ${type} is not supported by the inspector.`);
}

function readMemo(reader: XdrReader): DecodedMemo {
  const type = reader.readUint32();
  switch (type) {
    case 0:
      return {};
    case 1:
      return { memo: reader.readString(28), memoType: 'Text' };
    case 2:
      return { memo: reader.readUint64().toString(), memoType: 'ID' };
    case 3:
      return { memo: bytesToHex(reader.readFixed(32)), memoType: 'Hash' };
    case 4:
      return { memo: bytesToHex(reader.readFixed(32)), memoType: 'Return' };
    default:
      throw new XdrDecodeError(`Memo type ${type} is not supported by the inspector.`);
  }
}

function readSignatures(reader: XdrReader): XdrSignature[] {
  const count = reader.readUint32();
  if (count > 20) throw new XdrDecodeError('Too many signatures in XDR envelope.');

  const signatures: XdrSignature[] = [];
  for (let index = 0; index < count; index += 1) {
    const hint = bytesToHex(reader.readFixed(4));
    reader.readOpaque(64); // signature bytes; the hint is enough for the UI
    signatures.push({ publicKey: 'Unresolved signer', hint });
  }
  return signatures;
}

/** Convert stroops to a trimmed XLM decimal string without losing precision. */
export function stroopsToXlm(stroops: bigint): string {
  const negative = stroops < 0n;
  const absolute = negative ? -stroops : stroops;
  const whole = absolute / STROOPS_PER_XLM;
  const fraction = (absolute % STROOPS_PER_XLM).toString().padStart(7, '0');
  const trimmed = fraction.replace(/0+$/, '');
  return `${negative ? '-' : ''}${whole}.${trimmed || '0'}`;
}

function readOperation(reader: XdrReader): InspectedXdrOperation {
  const source = readOptionalAccountId(reader);
  const type = reader.readUint32();
  const operation: InspectedXdrOperation = {
    type: `Operation ${type}`,
    source,
  };

  switch (type) {
    case 0: {
      operation.type = 'Create Account';
      operation.destination = readAccountId(reader);
      operation.asset = 'XLM';
      operation.amount = stroopsToXlm(reader.readInt64());
      break;
    }
    case 1: {
      operation.type = 'Payment';
      operation.destination = readAccountId(reader);
      const asset = readAsset(reader);
      operation.asset = asset.code;
      operation.assetIssuer = asset.issuer;
      operation.amount = stroopsToXlm(reader.readInt64());
      break;
    }
    case 2: {
      operation.type = 'Path Payment Strict Receive';
      readAsset(reader);
      reader.readInt64(); // sendMax
      operation.destination = readAccountId(reader);
      const asset = readAsset(reader);
      operation.asset = asset.code;
      operation.assetIssuer = asset.issuer;
      operation.amount = stroopsToXlm(reader.readInt64());
      const pathLength = reader.readUint32();
      for (let pathIndex = 0; pathIndex < pathLength; pathIndex += 1) readAsset(reader);
      break;
    }
    case 3:
    case 4: {
      operation.type = type === 3 ? 'Manage Sell Offer' : 'Manage Buy Offer';
      const asset = readAsset(reader);
      readAsset(reader); // buying asset
      operation.asset = asset.code;
      operation.assetIssuer = asset.issuer;
      operation.amount = stroopsToXlm(reader.readInt64());
      const numerator = reader.readInt32();
      const denominator = reader.readInt32();
      reader.readInt64(); // offer id
      operation.detail = `price ${numerator}/${denominator}`;
      break;
    }
    case 5:
    case 6: {
      operation.type = type === 5 ? 'Set Flags' : 'Clear Flags';
      operation.detail = `flags ${reader.readUint32()}`;
      break;
    }
    case 7: {
      operation.type = 'Set Master Key Weight';
      operation.detail = `weight ${reader.readUint32()}`;
      break;
    }
    case 8: {
      operation.type = 'Change Trust';
      const asset = readAsset(reader);
      operation.asset = asset.code;
      operation.assetIssuer = asset.issuer;
      operation.detail = `limit ${stroopsToXlm(reader.readInt64())}`;
      break;
    }
    case 9: {
      operation.type = 'Allow Trust';
      operation.asset = new TextDecoder('utf-8')
        .decode(reader.readFixed(4))
        .replace(/\0+$/, '')
        .trim();
      operation.detail = `authorize ${reader.readUint32()}`;
      break;
    }
    case 10: {
      operation.type = 'Account Merge';
      operation.destination = readAccountId(reader);
      break;
    }
    case 11: {
      operation.type = 'Inflation';
      break;
    }
    case 12: {
      operation.type = 'Manage Data';
      const name = reader.readString(64);
      const hasValue = reader.readUint32();
      const value = hasValue === 1 ? reader.readString(64) : undefined;
      operation.detail = value === undefined ? name : `${name}=${value}`;
      break;
    }
    case 13: {
      operation.type = 'Bump Sequence';
      operation.detail = `to ${reader.readInt64()}`;
      break;
    }
    default:
      throw new XdrDecodeError(
        `Operation type ${type} is not supported by the lightweight inspector.`,
      );
  }

  return operation;
}

function readOperations(reader: XdrReader): InspectedXdrOperation[] {
  const count = reader.readUint32();
  if (count > 100) throw new XdrDecodeError('Too many operations in XDR envelope.');

  const operations: InspectedXdrOperation[] = [];
  for (let index = 0; index < count; index += 1) {
    operations.push(readOperation(reader));
  }
  return operations;
}

function readTimeBounds(reader: XdrReader): XdrTimeBounds {
  return {
    min: reader.readInt64().toString(),
    max: reader.readInt64().toString(),
  };
}

function readV1Envelope(reader: XdrReader): DecodedEnvelope {
  const sourceAccount = readAccountId(reader);
  const fee = reader.readUint32().toString();
  const sequenceNumber = reader.readInt64().toString();

  const condition = reader.readUint32();
  let timeBounds: XdrTimeBounds | undefined;
  if (condition === 1) {
    timeBounds = readTimeBounds(reader);
  } else if (condition !== 0) {
    throw new XdrDecodeError(
      `Transaction condition ${condition} is not supported by the inspector.`,
    );
  }

  const memoInfo = readMemo(reader);
  const operations = readOperations(reader);
  reader.readUint32(); // transaction extension point
  const signatures = readSignatures(reader);

  return {
    valid: true,
    sourceAccount,
    fee,
    sequenceNumber,
    operationCount: operations.length,
    operations,
    signatures,
    networkPassphrase: DEFAULT_NETWORK_PASSPHRASE,
    memo: memoInfo.memo,
    memoType: memoInfo.memoType,
    timeBounds,
    message: 'XDR envelope decoded successfully.',
  };
}

function readV0Envelope(reader: XdrReader): DecodedEnvelope {
  const sourceAccount = readAccountId(reader);
  const fee = reader.readUint32().toString();
  const sequenceNumber = reader.readInt64().toString();

  const hasTimeBounds = reader.readUint32();
  if (hasTimeBounds > 1) throw new XdrDecodeError('Invalid time-bounds marker in XDR.');
  const timeBounds = hasTimeBounds === 1 ? readTimeBounds(reader) : undefined;

  const memoInfo = readMemo(reader);
  const operations = readOperations(reader);
  reader.readUint32(); // transaction extension point
  const signatures = readSignatures(reader);

  return {
    valid: true,
    sourceAccount,
    fee,
    sequenceNumber,
    operationCount: operations.length,
    operations,
    signatures,
    networkPassphrase: DEFAULT_NETWORK_PASSPHRASE,
    memo: memoInfo.memo,
    memoType: memoInfo.memoType,
    timeBounds,
    message: 'XDR envelope decoded successfully.',
  };
}

function readFeeBumpEnvelope(reader: XdrReader): DecodedEnvelope {
  const feeSource = readAccountId(reader);
  const outerFee = reader.readInt64();
  const inner = readEnvelope(reader);
  reader.readUint32(); // fee-bump extension point
  const outerSignatures = readSignatures(reader);

  const warning = `Fee-bump wrapper by ${shortenAccount(feeSource)} (${stroopsToXlm(
    outerFee,
  )} XLM). Details below are from the inner transaction.`;

  return {
    ...inner,
    signatures: [...outerSignatures, ...inner.signatures],
    warning: inner.warning ? `${inner.warning} ${warning}` : warning,
  };
}

function readEnvelope(reader: XdrReader): DecodedEnvelope {
  const type = reader.readUint32();
  switch (type) {
    case 0:
      return readV0Envelope(reader);
    case 2:
      return readV1Envelope(reader);
    case 5:
      return readFeeBumpEnvelope(reader);
    default:
      throw new XdrDecodeError(
        `Envelope type ${type} is not supported by the inspector.`,
      );
  }
}

/** Decode a real Stellar envelope. Returns `null` when the input is not base64. */
function decodeBinaryEnvelope(value: string): DecodedEnvelope | null {
  const bytes = decodeBase64(value);
  if (bytes === null) return null;

  const reader = new XdrReader(bytes);
  const decoded = readEnvelope(reader);
  if (reader.remaining > 0) {
    decoded.warning = decoded.warning
      ? `${decoded.warning} Trailing bytes were ignored.`
      : 'Trailing bytes were ignored after the decoded envelope.';
  }
  return decoded;
}

/** Shorten a `G...` address for dense table cells without hiding its tail. */
export function shortenAccount(value?: string | null): string {
  if (!value) return '';
  return value.length > 16 ? `${value.slice(0, 6)}…${value.slice(-4)}` : value;
}

/** Human-readable one-liner for an operation, used in tests and the modal. */
export function describeOperation(operation: InspectedXdrOperation): string {
  const parts = [operation.type];
  if (operation.source) parts.push(`source ${shortenAccount(operation.source)}`);
  if (operation.destination) parts.push(`to ${shortenAccount(operation.destination)}`);
  if (operation.amount !== undefined) {
    parts.push(
      `${operation.amount}${operation.asset ? ` ${operation.asset}` : ''}`.trim(),
    );
  } else if (operation.asset) {
    parts.push(operation.asset);
  }
  if (operation.assetIssuer)
    parts.push(`issuer ${shortenAccount(operation.assetIssuer)}`);
  if (operation.detail) parts.push(operation.detail);
  return parts.join(' · ');
}

function networkLabel(passphrase: string): string {
  if (passphrase.includes('Test SDF')) return 'Testnet';
  if (passphrase.includes('Futurenet')) return 'Futurenet';
  if (passphrase.includes('Public Global')) return 'Mainnet';
  return passphrase;
}

function safeFeeXlm(fee: string): string {
  try {
    return stroopsToXlm(BigInt(fee));
  } catch {
    return 'Unavailable';
  }
}

function decorate(
  decoded: DecodedEnvelope,
  parseSource: XdrParseSource,
): XdrInspection {
  const sources = new Set<string>([decoded.sourceAccount]);
  for (const operation of decoded.operations) {
    if (operation.source) sources.add(operation.source);
  }

  return {
    ...decoded,
    memo: decoded.memo ?? null,
    memoType: decoded.memoType ?? null,
    feeXlm: safeFeeXlm(decoded.fee),
    networkLabel: networkLabel(decoded.networkPassphrase),
    sourceAccounts: Array.from(sources),
    operationSummaries: decoded.operations.map(describeOperation),
    parseSource,
  };
}

function fallbackInspection(error: unknown): XdrInspection {
  const message =
    error instanceof Error && error.message
      ? error.message
      : 'The inspector could not read this envelope.';

  return decorate(
    {
      valid: false,
      sourceAccount: 'Unknown',
      fee: '100',
      sequenceNumber: '0',
      operationCount: 0,
      operations: [],
      signatures: [],
      networkPassphrase: DEFAULT_NETWORK_PASSPHRASE,
      message: 'The XDR inspector could not read this envelope.',
      warning: message,
    },
    'fallback',
  );
}

/**
 * Parse any XDR string the approval queue can supply. Never throws.
 *
 * The canonical JSON parser runs first (it powers existing fixtures); real
 * binary envelopes fall through to the lightweight decoder above. Any failure
 * becomes a renderable fallback result rather than an exception.
 */
export function inspectTransactionXdr(value: string | null | undefined): XdrInspection {
  try {
    const input = typeof value === 'string' ? value : '';
    const canonical = parseTransactionXdr(input);
    if (canonical.valid) {
      return decorate({ ...canonical, operations: canonical.operations }, 'json');
    }

    try {
      const binary = decodeBinaryEnvelope(input);
      if (binary) return decorate(binary, 'binary');
    } catch (error) {
      const inspection = decorate(
        {
          ...canonical,
          operations: canonical.operations,
        },
        'fallback',
      );
      inspection.warning =
        error instanceof Error && error.message
          ? `Binary XDR decode failed: ${error.message}`
          : 'The binary XDR decoder could not read this envelope.';
      return inspection;
    }

    return decorate({ ...canonical, operations: canonical.operations }, 'fallback');
  } catch (error) {
    return fallbackInspection(error);
  }
}
