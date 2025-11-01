import { LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string;
  change?: string;
  icon: LucideIcon;
  trend?: "up" | "down" | "neutral";
}

const StatCard = ({ title, value, change, icon: Icon, trend = "neutral" }: StatCardProps) => {
  const trendColor = {
    up: "text-success",
    down: "text-destructive",
    neutral: "text-muted-foreground",
  }[trend];

  return (
    <div className="glass-card rounded-xl p-6 hover:scale-105 transition-transform duration-300">
      <div className="flex items-start justify-between mb-4">
        <div className="p-3 rounded-lg bg-gradient-to-br from-primary/20 to-accent/20">
          <Icon className="w-5 h-5 text-primary" />
        </div>
        {change && (
          <span className={`text-sm font-medium ${trendColor}`}>{change}</span>
        )}
      </div>
      <h3 className="text-muted-foreground text-sm mb-1">{title}</h3>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );
};

export default StatCard;
