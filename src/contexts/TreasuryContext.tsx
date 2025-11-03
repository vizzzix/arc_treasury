import { createContext, useContext, useState, useEffect, useMemo, useCallback, ReactNode } from "react";
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
  deleteTreasury: (treasuryAddr: string) => Promise<boolean>;
  getTokenBalance: (token: string) => Promise<string>;
  approveToken: (token: string, spender: string, amount: string) => Promise<boolean>;
  loadUserTreasuries: () => Promise<void>;
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
  deleteTreasury: async () => false,
  getTokenBalance: async () => "0",
  approveToken: async () => false,
  loadUserTreasuries: async () => {},
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

  // Кешируем provider для избежания повторного создания
  const provider = useMemo(() => {
    if (typeof window.ethereum === "undefined") return null;
    return new ethers.BrowserProvider(window.ethereum);
  }, []);

  const getSigner = useCallback(async () => {
    if (!provider) return null;
    return await provider.getSigner();
  }, [provider]);

  const getContract = useCallback(async (contractAddress: string, abi: any[]) => {
    try {
      if (!contractAddress || contractAddress === "0x0000000000000000000000000000000000000000") {
        console.error("Invalid contract address:", contractAddress);
        return null;
      }
      const signer = await getSigner();
      if (!signer) {
        console.error("No signer available");
        return null;
      }
      return new Contract(contractAddress, abi, signer);
    } catch (error) {
      console.error("Error creating contract:", error);
      return null;
    }
  }, [getSigner]);

  const refreshData = useCallback(async () => {
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
  }, [isConnected, address, getContract]);

  const createTreasury = useCallback(async (
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
  }, [getContract, refreshData]);

  const loadUserTreasuries = useCallback(async () => {
    if (!isConnected || !address) return;

    try {
      setLoading(true);
      const contract = await getContract(CONTRACT_ADDRESSES.AITreasury, AI_TREASURY_ABI);
      if (!contract) return;

      console.log("📊 Loading user treasuries from contract...");
      const treasuryAddresses = await contract.getUserTreasuries(address);
      console.log("✅ Found treasuries:", treasuryAddresses);

      // Load details for each treasury
      const loadedTreasuries: Treasury[] = [];
      for (const treasuryAddr of treasuryAddresses) {
        try {
          const details = await contract.getTreasuryDetails(treasuryAddr);
          
          // Load balances for each token
          const balances: { [token: string]: string } = {};
          for (const token of details[1]) {
            const balance = await contract.getTokenBalance(treasuryAddr, token);
            balances[token] = ethers.formatUnits(balance, 6);
          }

          loadedTreasuries.push({
            address: treasuryAddr,
            owner: details[0],
            tokens: details[1],
            totalValue: ethers.formatUnits(details[2], 6),
            balances,
          });
        } catch (error) {
          console.error(`Failed to load treasury ${treasuryAddr}:`, error);
        }
      }

      setTreasuries(loadedTreasuries);
      console.log("✅ Loaded", loadedTreasuries.length, "treasuries");
    } catch (error: any) {
      console.error("❌ Error loading user treasuries:", error);
    } finally {
      setLoading(false);
    }
  }, [isConnected, address, getContract]);

  const deposit = useCallback(async (treasuryAddr: string, token: string, amount: string): Promise<boolean> => {
    try {
      setLoading(true);
      console.log("💰 Starting deposit...");
      console.log("  Treasury:", treasuryAddr);
      console.log("  Token:", token);
      console.log("  Amount:", amount);

      const contract = await getContract(CONTRACT_ADDRESSES.AITreasury, AI_TREASURY_ABI);
      if (!contract) {
        toast.error("Failed to connect to contract");
        return false;
      }

      const amountWei = ethers.parseUnits(amount, 6);
      console.log("  Amount (wei):", amountWei.toString());
      
      // Check if token is supported
      const isSupported = await contract.supportedTokens(token);
      console.log("  Token supported:", isSupported);
      if (!isSupported) {
        toast.error("Token not supported in contract");
        return false;
      }

      // Check treasury exists
      const treasuryDetails = await contract.getTreasuryDetails(treasuryAddr);
      console.log("  Treasury owner:", treasuryDetails[0]);
      console.log("  Treasury tokens:", treasuryDetails[1]);
      
      toast.info("Sending deposit transaction...");
      const tx = await contract.deposit(treasuryAddr, token, amountWei);
      console.log("  Tx hash:", tx.hash);
      console.log("  🔗 View on ArcScan:", `https://testnet.arcscan.app/tx/${tx.hash}`);
      
      toast.info("Waiting for confirmation...");
      const receipt = await tx.wait();
      console.log("  ✅ Confirmed! Block:", receipt.blockNumber);
      console.log("  Gas used:", receipt.gasUsed.toString());

      toast.success(`Deposit successful! Gas: ${ethers.formatUnits(receipt.gasUsed, 6)} USDC`, {
        action: {
          label: "View on ArcScan",
          onClick: () => window.open(`https://testnet.arcscan.app/tx/${tx.hash}`, '_blank')
        }
      });
      
      await refreshData();
      return true;
    } catch (error: any) {
      console.error("❌ Error depositing:", error);
      
      // Parse error message
      let userMessage = "Failed to deposit";
      if (error.message) {
        if (error.message.includes("Token not supported")) {
          userMessage = "Token not supported in this treasury";
        } else if (error.message.includes("Token not in treasury allocation")) {
          userMessage = "Token not in treasury allocation. Create a new treasury with this token.";
        } else if (error.message.includes("transfer amount exceeds balance")) {
          userMessage = "Insufficient token balance in your wallet";
        } else if (error.message.includes("user rejected")) {
          userMessage = "Transaction rejected by user";
        } else {
          userMessage = error.reason || error.message;
        }
      }
      
      toast.error(userMessage);
      return false;
    } finally {
      setLoading(false);
    }
  }, [getContract, refreshData]);

  const withdraw = useCallback(async (treasuryAddr: string, token: string, amount: string): Promise<boolean> => {
    try {
      setLoading(true);
      console.log("💸 Starting withdrawal...");
      console.log("  Treasury:", treasuryAddr);
      console.log("  Token:", token);
      console.log("  Amount:", amount);

      const contract = await getContract(CONTRACT_ADDRESSES.AITreasury, AI_TREASURY_ABI);
      if (!contract) {
        toast.error("Failed to connect to contract");
        return false;
      }

      const amountWei = ethers.parseUnits(amount, 6);
      console.log("  Amount (wei):", amountWei.toString());

      // Check treasury balance
      const treasuryBalance = await contract.getTokenBalance(treasuryAddr, token);
      console.log("  Treasury balance:", ethers.formatUnits(treasuryBalance, 6));
      
      if (treasuryBalance < amountWei) {
        toast.error(`Insufficient treasury balance. Available: ${ethers.formatUnits(treasuryBalance, 6)}`);
        return false;
      }
      
      toast.info("Sending withdrawal transaction...");
      const tx = await contract.withdraw(treasuryAddr, token, amountWei);
      console.log("  Tx hash:", tx.hash);
      console.log("  🔗 View on ArcScan:", `https://testnet.arcscan.app/tx/${tx.hash}`);
      
      toast.info("Waiting for confirmation...");
      const receipt = await tx.wait();
      console.log("  ✅ Confirmed! Block:", receipt.blockNumber);
      console.log("  Gas used:", receipt.gasUsed.toString());

      toast.success(`Withdrawal successful! Gas: ${ethers.formatUnits(receipt.gasUsed, 6)} USDC`, {
        action: {
          label: "View on ArcScan",
          onClick: () => window.open(`https://testnet.arcscan.app/tx/${tx.hash}`, '_blank')
        }
      });
      
      await refreshData();
      return true;
    } catch (error: any) {
      console.error("❌ Error withdrawing:", error);
      
      let userMessage = "Failed to withdraw";
      if (error.message) {
        if (error.message.includes("Insufficient balance")) {
          userMessage = "Insufficient treasury balance";
        } else if (error.message.includes("user rejected")) {
          userMessage = "Transaction rejected by user";
        } else {
          userMessage = error.reason || error.message;
        }
      }
      
      toast.error(userMessage);
      return false;
    } finally {
      setLoading(false);
    }
  }, [getContract, refreshData]);

  const rebalance = useCallback(async (treasuryAddr: string): Promise<boolean> => {
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
  }, [getContract, refreshData]);

  const getTokenBalance = useCallback(async (token: string): Promise<string> => {
    console.log("🔍 getTokenBalance called with:", { token, address, isConnected });
    
    try {
      if (!address) {
        console.warn("⚠️ No address connected");
        return "0";
      }

      // Проверяем что адрес контракта валидный
      if (!token || token === "0x0000000000000000000000000000000000000000") {
        console.warn("⚠️ Invalid token address:", token);
        return "0";
      }

      console.log("📞 Creating contract for token:", token);
      const contract = await getContract(token, MOCK_ERC20_ABI);
      if (!contract) {
        console.error("❌ Contract not created");
        return "0";
      }

      console.log("📊 Fetching balance for", token, "from address:", address);
      const balance = await contract.balanceOf(address);
      console.log("💰 Raw balance:", balance.toString());
      
      const formatted = ethers.formatUnits(balance, 6);
      console.log("✅ Formatted balance:", formatted);
      
      return formatted;
    } catch (error: any) {
      console.error("❌ Error getting token balance:", error);
      console.error("Token:", token);
      console.error("Address:", address);
      console.error("Error details:", error.message);
      return "0";
    }
  }, [address, getContract]);

  const approveToken = useCallback(async (token: string, spender: string, amount: string): Promise<boolean> => {
    try {
      console.log("🔐 Approving token...");
      console.log("  Token:", token);
      console.log("  Spender:", spender);
      console.log("  Amount:", amount);

      const contract = await getContract(token, MOCK_ERC20_ABI);
      if (!contract) {
        toast.error("Failed to connect to token contract");
        return false;
      }

      const amountWei = ethers.parseUnits(amount, 6);
      console.log("  Amount in wei:", amountWei.toString());

      // Check current allowance
      const currentAllowance = await contract.allowance(address, spender);
      console.log("  Current allowance:", currentAllowance.toString());

      // If already approved enough, skip
      if (currentAllowance >= amountWei) {
        console.log("  ✅ Already approved!");
        toast.success("Token already approved!");
        return true;
      }
      
      toast.info("Approving token...");
      const tx = await contract.approve(spender, amountWei);
      console.log("  Approve tx:", tx.hash);
      
      const receipt = await tx.wait();
      console.log("  ✅ Approve confirmed!");

      // Verify allowance
      const newAllowance = await contract.allowance(address, spender);
      console.log("  New allowance:", newAllowance.toString());

      toast.success("Token approved!");
      return true;
    } catch (error: any) {
      console.error("❌ Error approving token:", error);
      toast.error(error.message || "Failed to approve token");
      return false;
    }
  }, [address, getContract]);

  const deleteTreasury = useCallback(async (treasuryAddr: string): Promise<boolean> => {
    try {
      setLoading(true);
      console.log("🗑️ Deleting treasury:", treasuryAddr);

      const contract = await getContract(CONTRACT_ADDRESSES.AITreasury, AI_TREASURY_ABI);
      if (!contract) {
        toast.error("Failed to connect to contract");
        return false;
      }

      // Check all balances are zero
      const details = await contract.getTreasuryDetails(treasuryAddr);
      for (const token of details[1]) {
        const balance = await contract.getTokenBalance(treasuryAddr, token);
        if (balance > 0) {
          toast.error("Cannot delete treasury with non-zero balance. Withdraw all funds first.");
          return false;
        }
      }

      toast.info("Deleting treasury...");
      const tx = await contract.deleteTreasury(treasuryAddr);
      console.log("  Tx hash:", tx.hash);
      
      await tx.wait();
      console.log("  ✅ Treasury deleted!");

      toast.success("Treasury deleted successfully!", {
        action: {
          label: "View on ArcScan",
          onClick: () => window.open(`https://testnet.arcscan.app/tx/${tx.hash}`, '_blank')
        }
      });

      // Remove from localStorage
      if (address) {
        const savedTreasury = localStorage.getItem(`treasury_${address}`);
        if (savedTreasury === treasuryAddr) {
          localStorage.removeItem(`treasury_${address}`);
          localStorage.removeItem(`treasury_metadata_${address}`);
        }
      }

      await loadUserTreasuries();
      return true;
    } catch (error: any) {
      console.error("❌ Error deleting treasury:", error);
      
      let userMessage = "Failed to delete treasury";
      if (error.message) {
        if (error.message.includes("Treasury has non-zero balance")) {
          userMessage = "Cannot delete treasury with funds. Withdraw all tokens first.";
        } else if (error.message.includes("user rejected")) {
          userMessage = "Transaction rejected by user";
        } else {
          userMessage = error.reason || error.message;
        }
      }
      
      toast.error(userMessage);
      return false;
    } finally {
      setLoading(false);
    }
  }, [address, getContract, loadUserTreasuries]);

  // Обновляем treasuries после создания нового
  useEffect(() => {
    if (isConnected && address) {
      refreshData();
      loadUserTreasuries();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected, address]); // Намеренно не включаем функции в зависимости для избежания лишних вызовов

  const value = useMemo(
    () => ({
      treasuries,
      loading,
      createTreasury,
      deposit,
      withdraw,
      rebalance,
      deleteTreasury,
      getTokenBalance,
      approveToken,
      loadUserTreasuries,
      totalValueLocked,
      totalTreasuries,
      totalYieldGenerated,
      refreshData,
    }),
    [
      treasuries,
      loading,
      createTreasury,
      deposit,
      withdraw,
      rebalance,
      deleteTreasury,
      getTokenBalance,
      approveToken,
      loadUserTreasuries,
      totalValueLocked,
      totalTreasuries,
      totalYieldGenerated,
      refreshData,
    ]
  );

  return <TreasuryContext.Provider value={value}>{children}</TreasuryContext.Provider>;
};

