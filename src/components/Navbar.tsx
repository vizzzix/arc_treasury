import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Wallet, LayoutDashboard, PlusCircle, BarChart3, LogOut, Copy, Check } from "lucide-react";
import { useWallet } from "@/contexts/WalletContext";
import { useState } from "react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
const Navbar = () => {
  const location = useLocation();
  const isActive = (path: string) => location.pathname === path;
  const { address, isConnected, isConnecting, connectWallet, disconnectWallet, balance } = useWallet();
  const [copied, setCopied] = useState(false);

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const copyAddress = () => {
    if (address) {
      navigator.clipboard.writeText(address);
      setCopied(true);
      toast.success("Address copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 glass-card border-b border-border/50">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center space-x-3 group">
          <img src="/logo.svg" alt="Arc Treasury" className="w-10 h-10 group-hover:scale-110 transition-transform" />
          <span className="font-bold text-xl gradient-text">Arc Treasury</span>
        </Link>

        <div className="hidden md:flex items-center space-x-1">
          <Link to="/dashboard">
            <Button
              variant={isActive("/dashboard") ? "default" : "ghost"}
              className="gap-2"
            >
              <LayoutDashboard className="w-4 h-4" />
              Dashboard
            </Button>
          </Link>
          <Link to="/create">
            <Button
              variant={isActive("/create") ? "default" : "ghost"}
              className="gap-2"
            >
              <PlusCircle className="w-4 h-4" />
              Create Treasury
            </Button>
          </Link>
          <Link to="/analytics">
            <Button
              variant={isActive("/analytics") ? "default" : "ghost"}
              className="gap-2"
            >
              <BarChart3 className="w-4 h-4" />
              Analytics
            </Button>
          </Link>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-primary/10 to-accent/10 border border-primary/20 glow-effect">
            <div className="w-2 h-2 rounded-full bg-success animate-pulse shadow-lg shadow-success/50" />
            <span className="text-sm font-medium">Arc Testnet</span>
          </div>
          
          {!isConnected ? (
            <Button 
              className="gap-2 bg-gradient-to-r from-primary to-accent hover:opacity-90 transition-all glow-effect hover:scale-105"
              onClick={connectWallet}
              disabled={isConnecting}
            >
              <Wallet className="w-4 h-4" />
              <span className="hidden sm:inline">
                {isConnecting ? "Connecting..." : "Connect Wallet"}
              </span>
            </Button>
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button className="gap-2 bg-gradient-to-r from-primary to-accent hover:opacity-90 transition-all glow-effect hover:scale-105">
                  <Wallet className="w-4 h-4" />
                  <span className="hidden sm:inline">{formatAddress(address!)}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64 modern-card border-border/50">
                <DropdownMenuLabel>
                  <div className="space-y-1">
                    <div className="text-xs text-muted-foreground">Wallet Address</div>
                    <div className="font-mono text-sm">{formatAddress(address!)}</div>
                    {balance && (
                      <div className="text-xs text-muted-foreground mt-2">
                        Balance: {balance} ETH
                      </div>
                    )}
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={copyAddress} className="cursor-pointer">
                  {copied ? (
                    <Check className="w-4 h-4 mr-2" />
                  ) : (
                    <Copy className="w-4 h-4 mr-2" />
                  )}
                  {copied ? "Copied!" : "Copy Address"}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={disconnectWallet} className="cursor-pointer text-destructive">
                  <LogOut className="w-4 h-4 mr-2" />
                  Disconnect
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
