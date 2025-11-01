import { ethers } from "ethers";
import { toast } from "sonner";

// Circle CCTP Contract Addresses
const CCTP_CONTRACTS = {
  ethereum: {
    tokenMessenger: "0xBd3fa81B58Ba92a82136038B25aDec7066af3155",
    usdc: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    chainId: "0x1",
    domain: 0
  },
  polygon: {
    tokenMessenger: "0x9daF8c91AEFAE50b9c0E69629D3F6Ca40cA3B3FE",
    usdc: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
    chainId: "0x89",
    domain: 7
  },
  base: {
    tokenMessenger: "0x1682Ae6375C4E4A97e4B583BC394c861A46D8962",
    usdc: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    chainId: "0x2105",
    domain: 6
  },
  arbitrum: {
    tokenMessenger: "0x19330d10D9Cc8751218eaf51E8885D058642E08A",
    usdc: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
    chainId: "0xa4b1",
    domain: 3
  }
};

const ARC_DOMAIN = 999; // Placeholder - нужно узнать реальный domain для Arc

const TOKEN_MESSENGER_ABI = [
  "function depositForBurn(uint256 amount, uint32 destinationDomain, bytes32 mintRecipient, address burnToken) external returns (uint64)",
];

const ERC20_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function balanceOf(address account) external view returns (uint256)",
  "function allowance(address owner, address spender) external view returns (uint256)"
];

export async function bridgeUSDCToArc(
  fromChain: "ethereum" | "polygon" | "base" | "arbitrum",
  amount: string,
  recipientAddress: string
): Promise<{ success: boolean; txHash?: string; error?: string }> {
  try {
    const provider = new ethers.BrowserProvider(window.ethereum);
    const currentChainId = await provider.send("eth_chainId", []);
    
    // Switch to source chain if needed
    if (currentChainId !== CCTP_CONTRACTS[fromChain].chainId) {
      toast.info(`Switching to ${fromChain}...`);
      try {
        await provider.send("wallet_switchEthereumChain", [
          { chainId: CCTP_CONTRACTS[fromChain].chainId }
        ]);
      } catch (error: any) {
        if (error.code === 4902) {
          toast.error(`Please add ${fromChain} network to MetaMask first`);
          return { success: false, error: "Network not added" };
        }
        throw error;
      }
    }

    const signer = await provider.getSigner();
    const amountWei = ethers.parseUnits(amount, 6);
    
    // Check balance
    const usdcContract = new ethers.Contract(
      CCTP_CONTRACTS[fromChain].usdc,
      ERC20_ABI,
      signer
    );
    
    const balance = await usdcContract.balanceOf(recipientAddress);
    if (balance < amountWei) {
      toast.error(`Insufficient USDC balance on ${fromChain}`);
      return { success: false, error: "Insufficient balance" };
    }

    // Approve USDC
    toast.info("Step 1/3: Approving USDC...");
    const allowance = await usdcContract.allowance(
      recipientAddress, 
      CCTP_CONTRACTS[fromChain].tokenMessenger
    );
    
    if (allowance < amountWei) {
      const approveTx = await usdcContract.approve(
        CCTP_CONTRACTS[fromChain].tokenMessenger,
        amountWei
      );
      await approveTx.wait();
      toast.success("✅ USDC approved!");
    }

    // Burn USDC on source chain
    toast.info("Step 2/3: Burning USDC on source chain...");
    const messengerContract = new ethers.Contract(
      CCTP_CONTRACTS[fromChain].tokenMessenger,
      TOKEN_MESSENGER_ABI,
      signer
    );

    const mintRecipient = ethers.zeroPadValue(recipientAddress, 32);
    
    const burnTx = await messengerContract.depositForBurn(
      amountWei,
      ARC_DOMAIN,
      mintRecipient,
      CCTP_CONTRACTS[fromChain].usdc
    );

    toast.info("Step 3/3: Waiting for confirmation...");
    const receipt = await burnTx.wait();
    
    toast.success(
      `Bridge initiated! USDC will be minted on Arc in ~15 minutes`,
      {
        duration: 10000,
        action: {
          label: "View Transaction",
          onClick: () => {
            const explorer = fromChain === "ethereum" ? "etherscan.io" :
                           fromChain === "polygon" ? "polygonscan.com" :
                           fromChain === "base" ? "basescan.org" : "arbiscan.io";
            window.open(`https://${explorer}/tx/${burnTx.hash}`, '_blank');
          }
        }
      }
    );

    return { success: true, txHash: burnTx.hash };
  } catch (error: any) {
    console.error("Bridge error:", error);
    
    let errorMessage = "Bridge failed";
    if (error.message?.includes("user rejected")) {
      errorMessage = "Transaction rejected";
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    toast.error(errorMessage);
    return { success: false, error: errorMessage };
  }
}

export function getChainName(chainId: string): string {
  const names: { [key: string]: string } = {
    "0x1": "Ethereum",
    "0x89": "Polygon",
    "0x2105": "Base",
    "0xa4b1": "Arbitrum"
  };
  return names[chainId] || "Unknown";
}

