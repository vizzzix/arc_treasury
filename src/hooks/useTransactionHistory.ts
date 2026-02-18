import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useUnifiedWallet } from './useUnifiedWallet';

export interface TransactionRecord {
  id: number;
  circle_tx_id: string;
  tx_type: string;
  status: string;
  wallet_address: string;
  wallet_id: string;
  tx_hash: string | null;
  amount: string | null;
  currency: string | null;
  error_reason: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

const TX_TYPE_LABELS: Record<string, string> = {
  'deposit-usdc': 'Deposit USDC',
  'deposit-eurc': 'Deposit EURC',
  'withdraw-usdc': 'Withdraw USDC',
  'withdraw-eurc': 'Withdraw EURC',
  'swap-usdc-eurc': 'Swap USDC → EURC',
  'swap-eurc-usdc': 'Swap EURC → USDC',
  'deposit-locked-usdc': 'Lock USDC',
  'deposit-locked-eurc': 'Lock EURC',
  'add-liquidity': 'Add Liquidity',
  'remove-liquidity': 'Remove Liquidity',
  'withdraw-locked': 'Unlock Position',
  'early-withdraw-locked': 'Early Withdraw',
  'claim-locked-yield': 'Claim Yield',
  'mint-badge': 'Mint Badge',
  'bridge-approve': 'Bridge Approve',
  'bridge-burn': 'Bridge Transfer',
  'bridge-claim': 'Bridge Claim',
  'approve': 'Token Approve',
};

export function getTxTypeLabel(txType: string): string {
  return TX_TYPE_LABELS[txType] || txType;
}

export function getTxStatusColor(status: string): string {
  switch (status) {
    case 'COMPLETE':
    case 'CONFIRMED':
      return 'text-green-500';
    case 'FAILED':
    case 'CANCELLED':
      return 'text-red-500';
    case 'PENDING':
    case 'QUEUED':
    case 'SENT':
      return 'text-yellow-500';
    default:
      return 'text-muted-foreground';
  }
}

interface UseTransactionHistoryReturn {
  transactions: TransactionRecord[];
  isLoading: boolean;
  error: string | null;
  hasMore: boolean;
  loadMore: () => void;
  refetch: () => void;
}

const PAGE_SIZE = 20;

export function useTransactionHistory(): UseTransactionHistoryReturn {
  const { address } = useUnifiedWallet();
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const fetchTransactions = useCallback(async (pageNum: number, append: boolean = false) => {
    if (!supabase || !address) {
      setIsLoading(false);
      return;
    }

    try {
      if (!append) setIsLoading(true);

      const from = pageNum * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      const { data, error: queryError } = await supabase
        .from('circle_transactions')
        .select('id, circle_tx_id, tx_type, status, wallet_address, wallet_id, tx_hash, amount, currency, error_reason, created_at, updated_at')
        .eq('wallet_address', address.toLowerCase())
        .order('created_at', { ascending: false })
        .range(from, to);

      if (queryError) throw queryError;

      const rows = (data || []) as TransactionRecord[];
      setTransactions(prev => append ? [...prev, ...rows] : rows);
      setHasMore(rows.length === PAGE_SIZE);
      setError(null);
    } catch (e: any) {
      setError(e.message || 'Failed to load history');
    } finally {
      setIsLoading(false);
    }
  }, [address]);

  // Initial load
  useEffect(() => {
    setPage(0);
    setTransactions([]);
    fetchTransactions(0);
  }, [fetchTransactions]);

  // Realtime subscription for live updates
  useEffect(() => {
    if (!supabase || !address) return;

    const channel = supabase
      .channel(`tx-history-${address.toLowerCase()}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'circle_transactions',
          filter: `wallet_address=eq.${address.toLowerCase()}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newTx = payload.new as TransactionRecord;
            setTransactions(prev => [newTx, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            const updated = payload.new as TransactionRecord;
            setTransactions(prev =>
              prev.map(tx => tx.circle_tx_id === updated.circle_tx_id ? updated : tx)
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [address]);

  const loadMore = useCallback(() => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchTransactions(nextPage, true);
  }, [page, fetchTransactions]);

  const refetch = useCallback(() => {
    setPage(0);
    fetchTransactions(0);
  }, [fetchTransactions]);

  return {
    transactions,
    isLoading,
    error,
    hasMore,
    loadMore,
    refetch,
  };
}
