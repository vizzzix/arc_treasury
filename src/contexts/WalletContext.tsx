import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { ethers } from "ethers";
import { toast } from "sonner";

interface WalletContextType {
  address: string | null;
  isConnected: boolean;
  isConnecting: boolean;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
  balance: string | null;
}

const WalletContext = createContext<WalletContextType>({
  address: null,
  isConnected: false,
  isConnecting: false,
  connectWallet: async () => {},
  disconnectWallet: () => {},
  balance: null,
});

export const useWallet = () => useContext(WalletContext);

export const WalletProvider = ({ children }: { children: ReactNode }) => {
  const [address, setAddress] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [balance, setBalance] = useState<string | null>(null);

  const connectWallet = async () => {
    if (typeof window.ethereum === "undefined") {
      toast.error("Please install MetaMask or another Web3 wallet");
      return;
    }

    try {
      setIsConnecting(true);
      const provider = new ethers.BrowserProvider(window.ethereum);
      const accounts = await provider.send("eth_requestAccounts", []);
      
      if (accounts.length > 0) {
        const walletAddress = accounts[0];
        setAddress(walletAddress);
        
        // Get balance
        const balanceWei = await provider.getBalance(walletAddress);
        const balanceEth = ethers.formatEther(balanceWei);
        setBalance(parseFloat(balanceEth).toFixed(4));
        
        // Store in localStorage
        localStorage.setItem("walletAddress", walletAddress);
        
        toast.success("Wallet connected successfully");
      }
    } catch (error: any) {
      console.error("Error connecting wallet:", error);
      if (error.code === 4001) {
        toast.error("Connection rejected by user");
      } else {
        toast.error("Failed to connect wallet");
      }
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnectWallet = () => {
    setAddress(null);
    setBalance(null);
    localStorage.removeItem("walletAddress");
    toast.success("Wallet disconnected");
  };

  // Check for previously connected wallet on mount
  useEffect(() => {
    const checkConnection = async () => {
      const savedAddress = localStorage.getItem("walletAddress");
      if (savedAddress && typeof window.ethereum !== "undefined") {
        try {
          const provider = new ethers.BrowserProvider(window.ethereum);
          const accounts = await provider.send("eth_accounts", []);
          
          if (accounts.includes(savedAddress)) {
            setAddress(savedAddress);
            
            // Get balance
            const balanceWei = await provider.getBalance(savedAddress);
            const balanceEth = ethers.formatEther(balanceWei);
            setBalance(parseFloat(balanceEth).toFixed(4));
          } else {
            localStorage.removeItem("walletAddress");
          }
        } catch (error) {
          console.error("Error checking wallet connection:", error);
          localStorage.removeItem("walletAddress");
        }
      }
    };

    checkConnection();
  }, []);

  // Listen for account changes
  useEffect(() => {
    if (typeof window.ethereum !== "undefined") {
      const handleAccountsChanged = (accounts: string[]) => {
        if (accounts.length === 0) {
          disconnectWallet();
        } else if (accounts[0] !== address) {
          setAddress(accounts[0]);
          localStorage.setItem("walletAddress", accounts[0]);
        }
      };

      window.ethereum.on("accountsChanged", handleAccountsChanged);

      return () => {
        window.ethereum.removeListener("accountsChanged", handleAccountsChanged);
      };
    }
  }, [address]);

  const value = {
    address,
    isConnected: !!address,
    isConnecting,
    connectWallet,
    disconnectWallet,
    balance,
  };

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
};
