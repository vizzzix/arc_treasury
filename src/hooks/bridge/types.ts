import { SUPPORTED_NETWORKS } from '@/lib/constants';

export type BridgeNetwork = keyof typeof SUPPORTED_NETWORKS;

export interface BridgeParams {
  fromNetwork: BridgeNetwork;
  toNetwork: BridgeNetwork;
  amount: string;
}

export interface PendingBurn {
  txHash: string;
  fromNetwork: BridgeNetwork;
  toNetwork: BridgeNetwork;
  amount: string;
  timestamp: number;
}

export interface BridgeState {
  isBridging: boolean;
  isClaiming: boolean;
  error: string | null;
  mintConfirmed: boolean;
  pendingBurn: PendingBurn | null;
}
