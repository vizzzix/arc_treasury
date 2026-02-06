import { useUnifiedWallet } from "@/hooks/useUnifiedWallet";
import { UserMenu } from "./UserMenu";
import { WalletConnect } from "./WalletConnect";

export const WalletHeader = () => {
  const { isConnected } = useUnifiedWallet();
  return isConnected ? <UserMenu /> : <WalletConnect />;
};
