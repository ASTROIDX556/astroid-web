import { describe, expect, it } from 'vitest';

import {
  STELLAR_PUBLIC_KEY_LENGTH,
  STELLAR_PUBLIC_KEY_PATTERN,
  formatStellarAddress,
  isValidStellarPublicKey,
  normalizeStellarPublicKey,
  validateStellarPublicKey,
} from '@/lib/stellar';

/**
 * Real Stellar mainnet / documentation account ids. Each carries a genuine
 * CRC-16 checksum, so these also assert the StrKey decoder itself — a wrong
 * polynomial or byte order would reject every one of them.
 */
const VALID_KEYS = [
  'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN', // Circle USDC issuer
  'GDHU6WRG4IEQXM5NZ4BMPKOXHW76MZM4Y2IEMFDVXBSDP6SJY4ITNPP2', // Circle EURC issuer
  'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H',
  'GCEZWKCA5VLDNRLN3RPRJMRZOX3Z6G5CHCGSNFHEYVXM3XOJMDS674JZ',
  'GDQNY3PBOJOKYZSRMK2S7LHHGWZIUISD4QORETLMXEWXBI7KFZZMKTL3',
  'GA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJVSGZ',
] as const;

const VALID_KEY = VALID_KEYS[0];

/** Every input a form, URL param, or API payload can realistically hand us. */
const HOSTILE_INPUTS: readonly unknown[] = [
  null,
  undefined,
  '',
  '   ',
  '\n\t',
  0,
  1,
  NaN,
  Infinity,
  true,
  false,
  {},
  [],
  [VALID_KEY],
  () => VALID_KEY,
  Symbol('G'),
  123n,
  new Date(),
];

describe('STELLAR_PUBLIC_KEY_PATTERN', () => {
  it('matches a 56-character G-prefixed base32 string', () => {
    for (const key of VALID_KEYS) {
      expect(STELLAR_PUBLIC_KEY_PATTERN.test(key)).toBe(true);
    }
  });

  it('rejects the characters excluded from the base32 alphabet', () => {
    // 0, 1, 8, and 9 are not in RFC 4648 base32.
    for (const digit of ['0', '1', '8', '9']) {
      expect(STELLAR_PUBLIC_KEY_PATTERN.test(`G${digit.repeat(55)}`)).toBe(false);
    }
  });

  it('rejects lowercase, padding, and the wrong length', () => {
    expect(STELLAR_PUBLIC_KEY_PATTERN.test(VALID_KEY.toLowerCase())).toBe(false);
    expect(STELLAR_PUBLIC_KEY_PATTERN.test(`${VALID_KEY.slice(0, 54)}==`)).toBe(false);
    expect(STELLAR_PUBLIC_KEY_PATTERN.test(VALID_KEY.slice(0, 55))).toBe(false);
    expect(STELLAR_PUBLIC_KEY_PATTERN.test(`${VALID_KEY}A`)).toBe(false);
  });

  it('is anchored at both ends', () => {
    expect(STELLAR_PUBLIC_KEY_PATTERN.test(` ${VALID_KEY}`)).toBe(false);
    expect(STELLAR_PUBLIC_KEY_PATTERN.test(`${VALID_KEY} `)).toBe(false);
    expect(STELLAR_PUBLIC_KEY_PATTERN.test(`prefix${VALID_KEY}suffix`)).toBe(false);
  });

  it('is stateless across calls (no global flag)', () => {
    expect(STELLAR_PUBLIC_KEY_PATTERN.test(VALID_KEY)).toBe(true);
    expect(STELLAR_PUBLIC_KEY_PATTERN.test(VALID_KEY)).toBe(true);
  });
});

describe('normalizeStellarPublicKey', () => {
  it('trims surrounding whitespace and upper-cases', () => {
    expect(normalizeStellarPublicKey(`  ${VALID_KEY.toLowerCase()}\n`)).toBe(VALID_KEY);
  });

  it('returns null for every non-string and blank input', () => {
    for (const input of [null, undefined, '', '   ', 42, {}, []]) {
      expect(normalizeStellarPublicKey(input)).toBeNull();
    }
  });
});

describe('validateStellarPublicKey', () => {
  it('accepts real account ids and returns the normalized address', () => {
    for (const key of VALID_KEYS) {
      const result = validateStellarPublicKey(key);
      expect(result.valid).toBe(true);
      if (result.valid) expect(result.address).toBe(key);
    }
  });

  it('accepts a pasted address with whitespace and mixed case', () => {
    const result = validateStellarPublicKey(`  ${VALID_KEY.toLowerCase()}  `);
    expect(result.valid).toBe(true);
    if (result.valid) expect(result.address).toBe(VALID_KEY);
  });

  it('never throws, whatever it is handed', () => {
    for (const input of HOSTILE_INPUTS) {
      expect(() => validateStellarPublicKey(input)).not.toThrow();
      expect(validateStellarPublicKey(input).valid).toBe(false);
    }
  });

  it('reports a code and a message on every rejection', () => {
    for (const input of HOSTILE_INPUTS) {
      const result = validateStellarPublicKey(input);
      if (result.valid) throw new Error('expected rejection');
      expect(result.code).toBeTruthy();
      expect(result.message.length).toBeGreaterThan(0);
    }
  });

  it('distinguishes non-strings from blank strings', () => {
    const notAString = validateStellarPublicKey(null);
    const blank = validateStellarPublicKey('   ');
    expect(notAString.valid === false && notAString.code).toBe('not-a-string');
    expect(blank.valid === false && blank.code).toBe('empty');
  });

  it('flags the wrong length, both short and long', () => {
    const short = validateStellarPublicKey(VALID_KEY.slice(0, 55));
    const long = validateStellarPublicKey(`${VALID_KEY}A`);
    expect(short.valid === false && short.code).toBe('invalid-length');
    expect(long.valid === false && long.code).toBe('invalid-length');
    if (!short.valid)
      expect(short.message).toContain(String(STELLAR_PUBLIC_KEY_LENGTH));
  });

  it('flags a non-G prefix at the right length', () => {
    const secretLike = `S${VALID_KEY.slice(1)}`;
    expect(secretLike).toHaveLength(STELLAR_PUBLIC_KEY_LENGTH);
    const result = validateStellarPublicKey(secretLike);
    expect(result.valid === false && result.code).toBe('invalid-prefix');
  });

  it('flags characters outside the base32 alphabet', () => {
    const withZero = `G0${VALID_KEY.slice(2)}`;
    expect(withZero).toHaveLength(STELLAR_PUBLIC_KEY_LENGTH);
    const result = validateStellarPublicKey(withZero);
    expect(result.valid === false && result.code).toBe('invalid-characters');
  });

  it('flags a well-formed address whose checksum does not match', () => {
    // Swap a payload character for another legal base32 character: the shape
    // and alphabet still pass, so only the CRC-16 can catch this.
    const tampered = `${VALID_KEY.slice(0, 10)}${VALID_KEY[10] === 'A' ? 'B' : 'A'}${VALID_KEY.slice(11)}`;
    expect(tampered).toHaveLength(STELLAR_PUBLIC_KEY_LENGTH);
    expect(STELLAR_PUBLIC_KEY_PATTERN.test(tampered)).toBe(true);
    const result = validateStellarPublicKey(tampered);
    expect(result.valid === false && result.code).toBe('invalid-checksum');
  });

  it('rejects a G-prefixed string that is not an ed25519 account id', () => {
    // 'GZ…' decodes to a version byte other than 6 << 3.
    const wrongVersion = `GZ${VALID_KEY.slice(2)}`;
    const result = validateStellarPublicKey(wrongVersion);
    expect(result.valid).toBe(false);
  });
});

describe('isValidStellarPublicKey', () => {
  it('narrows valid account ids to string', () => {
    const candidate: unknown = VALID_KEY;
    expect(isValidStellarPublicKey(candidate)).toBe(true);
    if (isValidStellarPublicKey(candidate)) {
      // Type-level assertion: `candidate` is a string inside this branch.
      expect(candidate.startsWith('G')).toBe(true);
    }
  });

  it('rejects malformed and non-string input without throwing', () => {
    for (const input of HOSTILE_INPUTS) {
      expect(isValidStellarPublicKey(input)).toBe(false);
    }
  });
});

describe('formatStellarAddress', () => {
  it('truncates to GABC…WXYZ by default', () => {
    expect(formatStellarAddress(VALID_KEY)).toBe('GA5Z…KZVN');
  });

  it('honours custom lead, tail, and separator', () => {
    expect(
      formatStellarAddress(VALID_KEY, { lead: 4, tail: 4, separator: '...' }),
    ).toBe('GA5Z...KZVN');
    expect(formatStellarAddress(VALID_KEY, { lead: 6, tail: 6 })).toBe('GA5ZSE…K4KZVN');
    expect(formatStellarAddress(VALID_KEY, { lead: 8, tail: 0 })).toBe('GA5ZSEJY…');
  });

  it('keeps the full value when truncating would not shorten it', () => {
    expect(formatStellarAddress('GABCD')).toBe('GABCD');
    expect(formatStellarAddress('GA', { lead: 4, tail: 4 })).toBe('GA');
  });

  it('falls back instead of throwing for missing or non-string input', () => {
    for (const input of HOSTILE_INPUTS.filter((v) => typeof v !== 'string')) {
      expect(() => formatStellarAddress(input)).not.toThrow();
      expect(formatStellarAddress(input)).toBe('—');
    }
    expect(formatStellarAddress(null)).toBe('—');
    expect(formatStellarAddress(undefined)).toBe('—');
    expect(formatStellarAddress('')).toBe('—');
    expect(formatStellarAddress('    ')).toBe('—');
  });

  it('accepts a custom fallback', () => {
    expect(formatStellarAddress(null, { fallback: 'Not set' })).toBe('Not set');
  });

  it('truncates malformed strings by default but not in strict mode', () => {
    const malformed = 'GNOTAREALSTELLARADDRESS';
    expect(formatStellarAddress(malformed)).toBe('GNOT…RESS');
    expect(formatStellarAddress(malformed, { strict: true })).toBe('—');
    expect(formatStellarAddress(VALID_KEY, { strict: true })).toBe('GA5Z…KZVN');
  });

  it('clamps nonsensical lead and tail values', () => {
    expect(() => formatStellarAddress(VALID_KEY, { lead: -5, tail: -5 })).not.toThrow();
    expect(formatStellarAddress(VALID_KEY, { lead: -5, tail: -5 })).toBe('…');
    expect(formatStellarAddress(VALID_KEY, { lead: NaN, tail: NaN })).toBe('…');
    expect(formatStellarAddress(VALID_KEY, { lead: 4.9, tail: 4.9 })).toBe('GA5Z…KZVN');
  });
});
