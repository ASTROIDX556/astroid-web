/**
 * Mock XDR samples for testing the XdrInspector component
 */

export const MOCK_XDR_SAMPLES = {
  // Payment operation XDR (sending XLM from one account to another)
  PAYMENT: 'AAAAAgAAAAD2k5L8a3N+MOCK_STELLAR_PAYMENT_XDR_DATA_STRING_FOR_DEMO==',
  
  // Change Trust operation XDR (trusting a custom asset)
  CHANGE_TRUST: 'AAAAAwAAAAD2k5L8a3N+MOCK_STELLAR_CHANGE_TRUST_XDR_DATA_STRING_FOR_DEMO==',
  
  // Create Account operation XDR (creating a new Stellar account)
  CREATE_ACCOUNT: 'AAAAAQAAAAD2k5L8a3N+MOCK_STELLAR_CREATE_ACCOUNT_XDR_DATA_STRING_FOR_DEMO==',
  
  // Invalid XDR string for error handling testing
  INVALID: 'not-a-valid-xdr-string!!!',
  
  // Empty XDR for edge case testing
  EMPTY: '',
};
