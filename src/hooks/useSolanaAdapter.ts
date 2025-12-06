import { useMemo } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { Connection } from '@solana/web3.js';

/**
 * Hook to create a Solana adapter for Bridge Kit
 * Bridge Kit SDK expects a specific adapter format for Solana
 */
export function useSolanaAdapter() {
  const { publicKey, signTransaction, signAllTransactions, connected } = useWallet();
  const { connection } = useConnection();

  const solanaAdapter = useMemo(() => {
    if (!publicKey || !signTransaction || !connected) {
      return null;
    }

    return {
      publicKey,
      signTransaction,
      signAllTransactions,
      connection,
    };
  }, [publicKey, signTransaction, signAllTransactions, connected, connection]);

  return {
    solanaAdapter,
    solanaPublicKey: publicKey,
    solanaConnected: connected,
    solanaConnection: connection,
  };
}

export default useSolanaAdapter;
