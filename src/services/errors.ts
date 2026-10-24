/**
 * API error primitives shared by the live client and the mock provider.
 *
 * Extracted from `client.ts` so the mock handler registry can throw the same
 * typed error the UI already understands without a circular import back into
 * the client module.
 */

/** Thrown for any non-2xx API response with the machine-readable code. */
export class AstroidApiError extends Error {
  readonly code: string;
  readonly requestId?: string;

  constructor(code: string, message: string, requestId?: string) {
    super(message);
    this.name = 'AstroidApiError';
    this.code = code;
    this.requestId = requestId;
  }
}
