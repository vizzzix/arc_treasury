import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface ScheduledPayment {
  id: string;
  label: string;
  amount: string;
  token: string;
  nextDate: Date;
  frequency: "once" | "daily" | "weekly" | "monthly";
  condition?: "always" | "if_profit" | "if_balance_above";
}

const ScheduledPayments = () => {
  const [payments, setPayments] = useState<ScheduledPayment[]>([
    {
      id: "1",
      label: "Monthly Rent",
      amount: "500",
      token: "USDC",
      nextDate: new Date("2025-12-01"),
      frequency: "monthly",
      condition: "always"
    }
  ]);

  const handleDelete = (id: string) => {
    setPayments(prev => prev.filter(p => p.id !== id));
    toast.success("Scheduled payment removed");
  };

  return (
    <Card className="p-5 border border-border/50">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-primary" />
          <div>
            <h3 className="font-semibold text-sm">Scheduled Payments</h3>
            <p className="text-xs text-muted-foreground">AI-powered auto-withdrawals</p>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        {payments.map((payment) => (
          <div key={payment.id} className="p-3 rounded-xl border border-border/50 hover:bg-secondary/30 transition-colors">
            <div className="flex justify-between items-start mb-2">
              <div>
                <p className="font-medium text-sm">{payment.label}</p>
                <p className="text-xs text-muted-foreground">
                  {payment.amount} {payment.token} • {payment.frequency}
                </p>
              </div>
              <button 
                onClick={() => handleDelete(payment.id)}
                className="text-destructive hover:bg-destructive/10 p-1 rounded"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
            
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">
                Next: {payment.nextDate.toLocaleDateString()}
              </span>
              <span className="text-primary">🤖 AI Ready</span>
            </div>
          </div>
        ))}

        <Button 
          variant="outline" 
          size="sm"
          className="w-full gap-2 h-9 mt-2"
          onClick={() => toast.info("Schedule payment feature coming soon!")}
        >
          <Plus className="w-3.5 h-3.5" />
          Add Payment
        </Button>
      </div>
    </Card>
  );
};

export default ScheduledPayments;

