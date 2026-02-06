import { useAccount } from 'wagmi';
import { useCircleWallet } from '@/providers/CircleWalletProvider';

export type WalletType = 'external' | 'circle' | null;

interface UnifiedWallet {
  address: string | undefined;
  isConnected: boolean;
  isLoading: boolean;
  walletType: WalletType;
  circleWalletId: string | null;
  disconnect: () => void;
}

/**
 * Unified wallet hook that works with both external wallets (MetaMask)
 * and Circle Developer Controlled Wallets (Google/Email login).
 *
 * Priority: external wallet takes precedence if both are connected.
 */
export function useUnifiedWallet(): UnifiedWallet {
  const externalAccount = useAccount();
  const circleWallet = useCircleWallet();

  // External wallet (MetaMask, WalletConnect) takes priority
  if (externalAccount?.isConnected && externalAccount?.address) {
    return {
      address: externalAccount.address,
      isConnected: true,
      isLoading: false,
      walletType: 'external',
      circleWalletId: null,
      disconnect: () => {}, // wagmi disconnect is handled by WalletConnect component
    };
  }

  // Circle wallet (Google/Email login)
  if (circleWallet.isConnected && circleWallet.address) {
    return {
      address: circleWallet.address as `0x${string}`,
      isConnected: true,
      isLoading: circleWallet.isLoading,
      walletType: 'circle',
      circleWalletId: circleWallet.walletId,
      disconnect: circleWallet.signOut,
    };
  }

  return {
    address: undefined,
    isConnected: false,
    isLoading: circleWallet.isLoading,
    walletType: null,
    circleWalletId: null,
    disconnect: () => {},
  };
}
