import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { ethers, BrowserProvider, Contract } from "ethers";
import { useWallet } from "./WalletContext";
import { CONTRACT_ADDRESSES } from "@/contracts/contractAddresses";
import { AI_TREASURY_ABI, MOCK_ERC20_ABI, STRATEGY_MANAGER_ABI } from "@/contracts/abis";
import { toast } from "sonner";

interface Treasury {
  address: string;
  owner: string;
  tokens: string[];
  totalValue: string;
  balances: { [token: string]: string };
}

interface TreasuryContextType {
  treasuries: Treasury[];
  loading: boolean;
  createTreasury: (tokens: string[], allocations: number[], rebalanceThreshold: number, autoYield: boolean) => Promise<string | null>;
  deposit: (treasuryAddr: string, token: string, amount: string) => Promise<boolean>;
  withdraw: (treasuryAddr: string, token: string, amount: string) => Promise<boolean>;
  rebalance: (treasuryAddr: string) => Promise<boolean>;
  getTokenBalance: (token: string) => Promise<string>;
  approveToken: (token: string, spender: string, amount: string) => Promise<boolean>;
  totalValueLocked: string;
  totalTreasuries: string;
  totalYieldGenerated: string;
  refreshData: () => Promise<void>;
}

const TreasuryContext = createContext<TreasuryContextType>({
  treasuries: [],
  loading: false,
  createTreasury: async () => null,
  deposit: async () => false,
  withdraw: async () => false,
  rebalance: async () => false,
  getTokenBalance: async () => "0",
  approveToken: async () => false,
  totalValueLocked: "0",
  totalTreasuries: "0",
  totalYieldGenerated: "0",
  refreshData: async () => {},
});

export const useTreasury = () => useContext(TreasuryContext);

export const TreasuryProvider = ({ children }: { children: ReactNode }) => {
  const { address, isConnected } = useWallet();
  const [treasuries, setTreasuries] = useState<Treasury[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalValueLocked, setTotalValueLocked] = useState("0");
  const [totalTreasuries, setTotalTreasuries] = useState("0");
  const [totalYieldGenerated, setTotalYieldGenerated] = useState("0");

  const getProvider = (): BrowserProvider | null => {
    if (typeof window.ethereum === "undefined") return null;
    return new ethers.BrowserProvider(window.ethereum);
  };

  const getSigner = async () => {
    const provider = getProvider();
    if (!provider) return null;
    return await provider.getSigner();
  };

  const getContract = async (contractAddress: string, abi: any[]) => {
    const signer = await getSigner();
    if (!signer) return null;
    return new Contract(contractAddress, abi, signer);
  };

  const refreshData = async () => {
    if (!isConnected || !address) return;

    try {
      setLoading(true);
      const contract = await getContract(CONTRACT_ADDRESSES.AITreasury, AI_TREASURY_ABI);
      if (!contract) return;

      // Get global stats
      const tvl = await contract.totalValueLocked();
      const totalTreas = await contract.totalTreasuries();
      const totalYield = await contract.totalYieldGenerated();

      setTotalValueLocked(ethers.formatUnits(tvl, 6));
      setTotalTreasuries(totalTreas.toString());
      setTotalYieldGenerated(ethers.formatUnits(totalYield, 6));

      // For now, we don't have a way to query user's treasuries
      // In a real implementation, you'd emit events and index them
      // or maintain a mapping of user => treasury addresses
    } catch (error: any) {
      console.error("Error refreshing data:", error);
    } finally {
      setLoading(false);
    }
  };

  const createTreasury = async (
    tokens: string[],
    allocations: number[],
    rebalanceThreshold: number,
    autoYield: boolean
  ): Promise<string | null> => {
    try {
      setLoading(true);
      const contract = await getContract(CONTRACT_ADDRESSES.AITreasury, AI_TREASURY_ABI);
      if (!contract) {
        toast.error("Failed to connect to contract");
        return null;
      }

      toast.info("Creating treasury...");
      
      const tx = await contract.createTreasury(tokens, allocations, rebalanceThreshold, autoYield);
      const receipt = await tx.wait();

      // Find the TreasuryCreated event
      const event = receipt.logs
        .map((log: any) => {
          try {
            return contract.interface.parseLog(log);
          } catch {
            return null;
          }
        })
        .find((e: any) => e && e.name === "TreasuryCreated");

      const treasuryAddress = event?.args?.treasuryAddress || "";

      toast.success("Treasury created successfully!");
      await refreshData();
      
      return treasuryAddress;
    } catch (error: any) {
      console.error("Error creating treasury:", error);
      toast.error(error.message || "Failed to create treasury");
      return null;
    } finally {
      setLoading(false);
    }
  };

  const deposit = async (treasuryAddr: string, token: string, amount: string): Promise<boolean> => {
    try {
      setLoading(true);
      const contract = await getContract(CONTRACT_ADDRESSES.AITreasury, AI_TREASURY_ABI);
      if (!contract) {
        toast.error("Failed to connect to contract");
        return false;
      }

      const amountWei = ethers.parseUnits(amount, 6);
      
      toast.info("Depositing...");
      const tx = await contract.deposit(treasuryAddr, token, amountWei);
      await tx.wait();

      toast.success("Deposit successful!");
      await refreshData();
      
      return true;
    } catch (error: any) {
      console.error("Error depositing:", error);
      toast.error(error.message || "Failed to deposit");
      return false;
    } finally {
      setLoading(false);
    }
  };

  const withdraw = async (treasuryAddr: string, token: string, amount: string): Promise<boolean> => {
    try {
      setLoading(true);
      const contract = await getContract(CONTRACT_ADDRESSES.AITreasury, AI_TREASURY_ABI);
      if (!contract) {
        toast.error("Failed to connect to contract");
        return false;
      }

      const amountWei = ethers.parseUnits(amount, 6);
      
      toast.info("Withdrawing...");
      const tx = await contract.withdraw(treasuryAddr, token, amountWei);
      await tx.wait();

      toast.success("Withdrawal successful!");
      await refreshData();
      
      return true;
    } catch (error: any) {
      console.error("Error withdrawing:", error);
      toast.error(error.message || "Failed to withdraw");
      return false;
    } finally {
      setLoading(false);
    }
  };

  const rebalance = async (treasuryAddr: string): Promise<boolean> => {
    try {
      setLoading(true);
      const contract = await getContract(CONTRACT_ADDRESSES.AITreasury, AI_TREASURY_ABI);
      if (!contract) {
        toast.error("Failed to connect to contract");
        return false;
      }

      toast.info("Rebalancing portfolio...");
      const tx = await contract.rebalance(treasuryAddr);
      await tx.wait();

      toast.success("Rebalance successful!");
      await refreshData();
      
      return true;
    } catch (error: any) {
      console.error("Error rebalancing:", error);
      toast.error(error.message || "Failed to rebalance");
      return false;
    } finally {
      setLoading(false);
    }
  };

  const getTokenBalance = async (token: string): Promise<string> => {
    try {
      if (!address) {
        console.log("No address connected");
        return "0";
      }

      // Проверяем что адрес контракта валидный
      if (!token || token === "0x0000000000000000000000000000000000000000") {
        console.log("Invalid token address:", token);
        return "0";
      }

      const contract = await getContract(token, MOCK_ERC20_ABI);
      if (!contract) {
        console.log("Contract not created");
        return "0";
      }

      console.log("Fetching balance for", token, "address:", address);
      const balance = await contract.balanceOf(address);
      const formatted = ethers.formatUnits(balance, 6);
      console.log("Balance:", formatted);
      return formatted;
    } catch (error: any) {
      console.error("Error getting token balance:", error);
      console.error("Token:", token);
      console.error("Address:", address);
      return "0";
    }
  };

  const approveToken = async (token: string, spender: string, amount: string): Promise<boolean> => {
    try {
      const contract = await getContract(token, MOCK_ERC20_ABI);
      if (!contract) {
        toast.error("Failed to connect to token contract");
        return false;
      }

      const amountWei = ethers.parseUnits(amount, 6);
      
      toast.info("Approving token...");
      const tx = await contract.approve(spender, amountWei);
      await tx.wait();

      toast.success("Token approved!");
      return true;
    } catch (error: any) {
      console.error("Error approving token:", error);
      toast.error(error.message || "Failed to approve token");
      return false;
    }
  };

  useEffect(() => {
    if (isConnected && address) {
      refreshData();
    }
  }, [isConnected, address]);

  const value = {
    treasuries,
    loading,
    createTreasury,
    deposit,
    withdraw,
    rebalance,
    getTokenBalance,
    approveToken,
    totalValueLocked,
    totalTreasuries,
    totalYieldGenerated,
    refreshData,
  };

  return <TreasuryContext.Provider value={value}>{children}</TreasuryContext.Provider>;
};

