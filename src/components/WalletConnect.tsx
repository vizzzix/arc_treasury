import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { Button } from "@/components/ui/button";
import { Wallet, LogOut } from "lucide-react";

export const WalletConnect = () => {
  const account = useAccount();
  const address = account?.address;
  const isConnected = account?.isConnected ?? false;

  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  if (isConnected && address) {
    return (
      <Button 
        onClick={() => disconnect()}
        variant="outline" 
        className="border-primary/30 hover:bg-primary/10 font-medium"
      >
        <Wallet className="w-4 h-4 mr-2" />
        {formatAddress(address)}
        <LogOut className="w-4 h-4 ml-2" />
      </Button>
    );
  }

  const handleConnect = () => {
    const firstConnector = connectors[0];
    if (firstConnector) {
      connect({ connector: firstConnector });
    }
  };

  return (
    <Button 
      onClick={handleConnect}
      className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium shadow-glow hover:shadow-glow-lg transition-all"
    >
      <Wallet className="w-4 h-4 mr-2" />
      Connect Wallet
    </Button>
  );
};
