import { Shield, Zap } from "lucide-react";

interface ArcBadgeProps {
  variant?: "verified" | "gas" | "testnet";
  className?: string;
}

const ArcBadge = ({ variant = "verified", className = "" }: ArcBadgeProps) => {
  const badges = {
    verified: {
      icon: Shield,
      text: "Arc Verified",
      bgColor: "bg-gradient-to-r from-primary/10 to-accent/10",
      borderColor: "border-primary/30",
      textColor: "text-primary",
    },
    gas: {
      icon: Zap,
      text: "USDC Gas",
      bgColor: "bg-gradient-to-r from-success/10 to-success/5",
      borderColor: "border-success/30",
      textColor: "text-success",
    },
    testnet: {
      icon: Shield,
      text: "Arc Testnet",
      bgColor: "bg-gradient-to-r from-warning/10 to-warning/5",
      borderColor: "border-warning/30",
      textColor: "text-warning",
    },
  };

  const badge = badges[variant];
  const Icon = badge.icon;

  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full ${badge.bgColor} border ${badge.borderColor} ${className}`}>
      <Icon className={`w-3.5 h-3.5 ${badge.textColor}`} />
      <span className={`text-xs font-semibold ${badge.textColor}`}>
        {badge.text}
      </span>
    </div>
  );
};

export default ArcBadge;

