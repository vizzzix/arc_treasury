import { initiateDeveloperControlledWalletsClient } from '@circle-fin/developer-controlled-wallets';

export function initiateCircleSdk() {
  const apiKey = process.env.CircleAPI;
  const entitySecret = process.env.CIRCLE_ENTITY_SECRET;

  if (!apiKey || !entitySecret) {
    throw new Error('Missing CircleAPI or CIRCLE_ENTITY_SECRET env vars');
  }

  return initiateDeveloperControlledWalletsClient({
    apiKey,
    entitySecret,
  });
}

export async function createWalletSet(sdk: ReturnType<typeof initiateDeveloperControlledWalletsClient>, name: string) {
  const response = await sdk.createWalletSet({ name });
  const walletSet = response.data?.walletSet;
  if (!walletSet?.id) throw new Error('Failed to create wallet set');
  return walletSet.id;
}

export async function createWallet(
  sdk: ReturnType<typeof initiateDeveloperControlledWalletsClient>,
  walletSetId: string,
  blockchains: string[]
) {
  const response = await sdk.createWallets({
    walletSetId,
    blockchains,
    count: 1,
    accountType: 'EOA',
  });
  const wallet = response.data?.wallets?.[0];
  if (!wallet) throw new Error('Failed to create wallet');
  return wallet;
}

export async function getWallet(sdk: ReturnType<typeof initiateDeveloperControlledWalletsClient>, walletId: string) {
  const response = await sdk.getWallet({ id: walletId });
  const wallet = response.data?.wallet;
  if (!wallet) throw new Error('Wallet not found');
  return wallet;
}

export async function getWalletBalance(sdk: ReturnType<typeof initiateDeveloperControlledWalletsClient>, walletId: string) {
  const response = await sdk.getWalletTokenBalance({ id: walletId });
  return response.data?.tokenBalances || [];
}
