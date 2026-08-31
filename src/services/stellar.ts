import {
  getNetwork,
  getPublicKey,
  signTransaction,
} from '@stellar/freighter-api';
import {
  Account,
  Asset,
  BASE_FEE,
  Horizon,
  Networks,
  Operation,
  TransactionBuilder,
} from '@stellar/stellar-sdk';
import { z } from 'zod';

/**
 * Validates a Stellar public key (G...).
 */
export const stellarPublicKeySchema = z
  .string()
  .regex(/^G[0-9A-Z]{55}$/, 'Invalid Stellar public key');

/**
 * Validates a Stellar asset code (1-12 alphanumeric characters).
 */
export const assetCodeSchema = z
  .string()
  .min(1, 'Asset code is required')
  .max(12, 'Asset code must be 12 characters or less')
  .regex(/^[a-zA-Z0-9]{1,12}$/, 'Asset code must be alphanumeric');

export interface StellarNetworkConfig {
  horizonUrl: string;
  passphrase: string;
}

export const STELLAR_NETWORKS: Record<'PUBLIC' | 'TESTNET', StellarNetworkConfig> = {
  PUBLIC: {
    horizonUrl: 'https://horizon.stellar.org',
    passphrase: Networks.PUBLIC,
  },
  TESTNET: {
    horizonUrl: 'https://horizon-testnet.stellar.org',
    passphrase: Networks.TESTNET,
  },
};

/**
 * Resolves the active network configuration from Freighter.
 * Falls back to TESTNET only if no network is reported, but we prefer
 * to throw if Freighter is unavailable.
 */
export async function getNetworkConfig(): Promise<StellarNetworkConfig> {
  try {
    const network = await getNetwork();
    if (network === 'PUBLIC') {
      return STELLAR_NETWORKS.PUBLIC;
    }
    // If Freighter says TESTNET or something else, treat as TESTNET.
    return STELLAR_NETWORKS.TESTNET;
  } catch (error) {
    throw new Error('Unable to determine Stellar network. Is Freighter connected?', { cause: error });
  }
}

/**
 * Returns the current Stellar public key from the Freighter extension.
 * Throws if no wallet is connected.
 */
export async function getConnectedPublicKey(): Promise<string> {
  try {
    const publicKey = await getPublicKey();
    if (!publicKey) {
      throw new Error('Freighter returned an empty public key');
    }
    stellarPublicKeySchema.parse(publicKey);
    return publicKey;
  } catch (error) {
    throw new Error('Unable to access Freighter wallet. Please connect and unlock your wallet.', { cause: error });
  }
}

/**
 * Loads a Stellar account from Horizon.
 */
export async function loadAccount(publicKey: string): Promise<Horizon.AccountResponse> {
  stellarPublicKeySchema.parse(publicKey);
  const { horizonUrl } = await getNetworkConfig();
  const server = new Horizon.Server(horizonUrl);
  try {
    return await server.loadAccount(publicKey);
  } catch (error) {
    throw new Error('Could not load Stellar account. Check the public key and network.', { cause: error });
  }
}

export interface AssetBalance {
  assetCode: string;
  issuer?: string;
  balance: string;
  limit?: string;
  isNative: boolean;
  trustlineActive: boolean;
}

/**
 * Fetches and formats the asset balances for a Stellar account.
 */
export async function getAssetBalances(publicKey: string): Promise<AssetBalance[]> {
  const account = await loadAccount(publicKey);
  return account.balances.map((balance) => {
    const assetCode = balance.asset_code ?? 'XLM';
    const issuer = balance.asset_issuer;
    const isNative = assetCode === 'XLM';
    return {
      assetCode,
      issuer,
      balance: balance.balance,
      limit: balance.limit,
      isNative,
      trustlineActive: !isNative && balance.limit !== '0', // If limit > 0, trustline is active
    };
  });
}

/**
 * Builds an XDR transaction for adding (or updating) a trustline to the given asset.
 * Returns the base64 XDR string ready for signing with Freighter.
 */
export async function buildTrustlineTransaction(
  publicKey: string,
  assetCode: string,
  issuer: string
): Promise<string> {
  stellarPublicKeySchema.parse(publicKey);
  assetCodeSchema.parse(assetCode);
  stellarPublicKeySchema.parse(issuer);

  const { passphrase, horizonUrl } = await getNetworkConfig();
  const server = new Horizon.Server(horizonUrl);
  const account = await server.loadAccount(publicKey);

  const source = new Account(publicKey, account.sequence);
  const asset = new Asset(assetCode, issuer);

  const transaction = new TransactionBuilder(source, {
    fee: BASE_FEE,
    networkPassphrase: passphrase,
  })
    .addOperation(
      Operation.changeTrust({
        asset,
        limit: '922337203685.4775807', // Max trustline limit
      })
    )
    .setTimeout(180)
    .build();

  return transaction.toXDR();
}

/**
 * Signs an XDR transaction with Freighter and submits it to the network.
 * Returns the transaction hash.
 */
export async function signAndSubmitTransaction(xdr: string): Promise<string> {
  const { passphrase, horizonUrl } = await getNetworkConfig();
  const server = new Horizon.Server(horizonUrl);

  try {
    const signedXdr = await signTransaction(xdr, {
      networkPassphrase: passphrase,
    });
    const transaction = TransactionBuilder.fromXDR(signedXdr, passphrase);
    const result = await server.submitTransaction(transaction);
    return result.hash;
  } catch (error) {
    throw new Error(`Transaction signing or submission failed: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
  }
}
