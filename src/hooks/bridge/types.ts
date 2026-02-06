import { SUPPORTED_NETWORKS } from '@/lib/constants';

export type BridgeNetwork = keyof typeof SUPPORTED_NETWORKS;

export interface BridgeParams {
  fromNetwork: BridgeNetwork;
  toNetwork: BridgeNetwork;
  amount: string;
}

export interface BridgeTransaction {
  hash: string;
  network: string;
  explorerUrl: string;
  status: 'pending' | 'success' | 'failed';
  step: string;
}

export interface PendingBurn {
  txHash: string;
  fromNetwork: BridgeNetwork;
  toNetwork: BridgeNetwork;
  amount: string;
  timestamp: number;
}

export interface BridgeFee {
  type: 'gas' | 'provider' | 'relayer';
  amount: string;
  token: string;
}

export interface BridgeEstimate {
  amount: string;
  token: string;
  source: { chain: string };
  destination: { chain: string };
  fees: BridgeFee[];
  totalFees: string;
}

export interface BridgeStep {
  name: 'approve' | 'burn' | 'fetchAttestation' | 'mint';
  state: 'pending' | 'success' | 'error';
  txHash?: string;
  error?: string;
}

export interface LastBridgeResult {
  state: 'pending' | 'success' | 'error';
  steps: BridgeStep[];
  source: { address: string; chain: string };
  destination: { address: string; chain: string };
}

export interface BridgeState {
  isBridging: boolean;
  isClaiming: boolean;
  isEstimating: boolean;
  error: string | null;
  result: any | null;
  transactions: BridgeTransaction[];
  mintConfirmed: boolean;
  pendingBurn: PendingBurn | null;
  estimate: BridgeEstimate | null;
  steps: BridgeStep[];
  lastResult: LastBridgeResult | null;
}
