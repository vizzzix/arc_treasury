import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TREASURY_AVATARS } from "@/types/treasury";
import { toast } from "sonner";

interface CreateTreasuryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (name: string, avatar: string) => Promise<void>;
  loading: boolean;
}

const CreateTreasuryModal = ({ open, onOpenChange, onCreate, loading }: CreateTreasuryModalProps) => {
  const [name, setName] = useState("");
  const [selectedAvatar, setSelectedAvatar] = useState(TREASURY_AVATARS[0]);

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error("Please enter a treasury name");
      return;
    }

    await onCreate(name, selectedAvatar);
    setName("");
    setSelectedAvatar(TREASURY_AVATARS[0]);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-card border-border/50 max-w-md">
        <DialogHeader>
          <DialogTitle>Create Your Treasury</DialogTitle>
          <DialogDescription>
            Give your treasury a name and choose an avatar
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Treasury Name */}
          <div className="space-y-2">
            <Label>Treasury Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., My Savings, Investment Fund..."
              maxLength={30}
              className="glass-card"
            />
            <p className="text-xs text-muted-foreground">
              {name.length}/30 characters
            </p>
          </div>

          {/* Avatar Selection */}
          <div className="space-y-3">
            <Label>Choose Avatar</Label>
            <div className="grid grid-cols-8 gap-2">
              {TREASURY_AVATARS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => setSelectedAvatar(emoji)}
                  className={`
                    w-10 h-10 text-2xl rounded-lg transition-all
                    hover:scale-110 hover:bg-primary/10
                    ${selectedAvatar === emoji 
                      ? 'bg-primary/20 ring-2 ring-primary scale-110' 
                      : 'bg-secondary/50'
                    }
                  `}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          {/* Preview */}
          <div className="modern-card p-4">
            <p className="text-xs text-muted-foreground mb-2">Preview</p>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center text-2xl">
                {selectedAvatar}
              </div>
              <div>
                <p className="font-semibold">{name || "Treasury Name"}</p>
                <p className="text-xs text-muted-foreground">
                  50% USDC • 30% EURC • 20% XSGD
                </p>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="glass-card">
            Cancel
          </Button>
          <Button 
            onClick={handleCreate}
            disabled={loading || !name.trim()}
            className="bg-gradient-to-r from-primary to-accent hover:opacity-90"
          >
            {loading ? "Creating..." : "Create Treasury"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CreateTreasuryModal;

