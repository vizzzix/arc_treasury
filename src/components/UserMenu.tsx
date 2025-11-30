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
import { User, Gift, LogOut, Wallet, ChevronDown, ArrowLeftRight, ArrowDownUp, Coins, LayoutDashboard } from "lucide-react";
import { useTokenBalance } from "@/hooks/useTokenBalance";
import { TOKEN_ADDRESSES } from "@/lib/constants";

export const UserMenu = () => {
  const navigate = useNavigate();
  const account = useAccount();
  const { disconnect } = useDisconnect();
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
        <Button variant="outline" className="gap-2 rounded-xl border-white/10 bg-white/5 hover:bg-white/10 backdrop-blur-sm">
          <Wallet className="w-4 h-4" />
          {shortAddress}
          <ChevronDown className="w-4 h-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 rounded-xl bg-background/95 backdrop-blur-xl border-white/10 shadow-xl">
        <DropdownMenuLabel className="text-sm font-semibold text-foreground/80">My Account</DropdownMenuLabel>

        <div className="px-3 py-3 mx-2 my-1 rounded-lg bg-white/5 border border-white/10">
          <div className="flex items-center gap-2 mb-2">
            <Coins className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Balances</span>
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

        <DropdownMenuSeparator className="bg-white/10 my-2" />
        <DropdownMenuItem onClick={() => navigate("/dashboard")} className="cursor-pointer mx-2 rounded-lg hover:bg-white/5 focus:bg-white/5">
          <LayoutDashboard className="w-4 h-4 mr-2" />
          Dashboard
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate("/swap")} className="cursor-pointer mx-2 rounded-lg hover:bg-white/5 focus:bg-white/5">
          <ArrowDownUp className="w-4 h-4 mr-2" />
          Swap USDC/EURC
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate("/bridge")} className="cursor-pointer mx-2 rounded-lg hover:bg-white/5 focus:bg-white/5">
          <ArrowLeftRight className="w-4 h-4 mr-2" />
          Bridge Assets
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate("/profile")} className="cursor-pointer mx-2 rounded-lg hover:bg-white/5 focus:bg-white/5">
          <User className="w-4 h-4 mr-2" />
          Profile & Settings
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate("/rewards")} className="cursor-pointer mx-2 rounded-lg hover:bg-white/5 focus:bg-white/5">
          <Gift className="w-4 h-4 mr-2" />
          Rewards & Referrals
        </DropdownMenuItem>
        <DropdownMenuSeparator className="bg-white/10 my-2" />
        <DropdownMenuItem onClick={() => disconnect()} className="cursor-pointer mx-2 mb-1 rounded-lg text-red-500 hover:text-red-400 hover:bg-red-500/10 focus:bg-red-500/10 focus:text-red-400">
          <LogOut className="w-4 h-4 mr-2" />
          Disconnect
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
