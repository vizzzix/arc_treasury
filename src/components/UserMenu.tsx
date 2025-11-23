import { useAccount, useDisconnect } from "wagmi";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { User, Gift, LogOut, Wallet, ChevronDown, Sparkles, ArrowLeftRight, Coins } from "lucide-react";
import { useUserPoints } from "@/hooks/useUserPoints";
import { useTokenBalance } from "@/hooks/useTokenBalance";
import { TOKEN_ADDRESSES } from "@/lib/constants";

export const UserMenu = () => {
  const navigate = useNavigate();
  const account = useAccount();
  const { disconnect } = useDisconnect();
  const { formattedPoints, isLoading: isLoadingPoints } = useUserPoints();
  const isConnected = account?.isConnected ?? false;
  const address = account?.address;

  // Get balances
  const { balance: usdcBalance, isLoading: isLoadingUSDC } = useTokenBalance({
    tokenAddress: TOKEN_ADDRESSES.arcTestnet.USDC,
    decimals: 18, // Native USDC uses 18 decimals (native currency)
  });

  const { balance: eurcBalance, isLoading: isLoadingEURC } = useTokenBalance({
    tokenAddress: TOKEN_ADDRESSES.arcTestnet.EURC,
    decimals: 6,
  });

  if (!isConnected || !address) {
    return null;
  }

  const shortAddress = `${address.slice(0, 6)}...${address.slice(-4)}`;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Wallet className="w-4 h-4" />
          {shortAddress}
          <ChevronDown className="w-4 h-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>My Account</DropdownMenuLabel>

        <div className="px-2 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <div className="flex flex-col">
              <span className="text-xs text-muted-foreground">Your Points</span>
              <span className="text-lg font-bold text-primary">
                {isLoadingPoints ? "..." : formattedPoints}
              </span>
            </div>
          </div>
        </div>

        <div className="px-2 py-3 border-b border-border">
          <div className="flex items-center gap-2 mb-2">
            <Coins className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground">Wallet Balances</span>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">USDC</span>
              <span className="text-sm font-medium">
                {isLoadingUSDC ? "..." : usdcBalance}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">EURC</span>
              <span className="text-sm font-medium">
                {isLoadingEURC ? "..." : eurcBalance}
              </span>
            </div>
          </div>
        </div>

        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => navigate("/bridge")} className="cursor-pointer">
          <ArrowLeftRight className="w-4 h-4 mr-2" />
          Bridge Assets
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate("/profile")} className="cursor-pointer">
          <User className="w-4 h-4 mr-2" />
          Profile & Settings
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate("/rewards")} className="cursor-pointer">
          <Gift className="w-4 h-4 mr-2" />
          Rewards & Referrals
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => disconnect()} className="cursor-pointer text-red-600 dark:text-red-400">
          <LogOut className="w-4 h-4 mr-2" />
          Disconnect
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
