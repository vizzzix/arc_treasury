import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { useWallet } from "@/contexts/WalletContext";
import { useTheme } from "@/contexts/ThemeContext";
import { User, Mail, Twitter, Shield, Copy, Check } from "lucide-react";
import { toast } from "sonner";

interface UserProfile {
  email: string;
  twitter: string;
  twoFactorEnabled: boolean;
  notificationsEnabled: boolean;
}

const Settings = () => {
  const { address, isConnected } = useWallet();
  const { theme, toggleTheme } = useTheme();
  const [profile, setProfile] = useState<UserProfile>({
    email: "",
    twitter: "",
    twoFactorEnabled: false,
    notificationsEnabled: true,
  });
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);

  // Load profile from localStorage
  useEffect(() => {
    if (address) {
      const savedProfile = localStorage.getItem(`profile_${address}`);
      if (savedProfile) {
        setProfile(JSON.parse(savedProfile));
      }
    }
  }, [address]);

  const handleSave = async () => {
    if (!address) return;
    
    setSaving(true);
    try {
      localStorage.setItem(`profile_${address}`, JSON.stringify(profile));
      toast.success("Profile updated successfully!");
    } catch (error) {
      toast.error("Failed to save profile");
    } finally {
      setSaving(false);
    }
  };


  if (!isConnected) {
    return (
      <div className="min-h-screen pt-24 pb-12 px-4">
        <div className="container mx-auto max-w-4xl">
          <Card className="modern-card p-12 text-center">
            <User className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-2xl font-bold mb-2">Connect Your Wallet</h2>
            <p className="text-muted-foreground">
              Please connect your wallet to access settings
            </p>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-24 pb-12 px-4">
      <div className="container mx-auto max-w-4xl space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-4xl font-bold mb-2">Settings</h1>
          <p className="text-muted-foreground">Manage your account and preferences</p>
        </div>

        {/* Profile Section */}
        <Card className="modern-card p-6">
          <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
            <User className="w-5 h-5" />
            Profile
          </h2>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="wallet">Wallet Address</Label>
              <div className="flex gap-2">
                <Input
                  id="wallet"
                  value={address || ""}
                  readOnly
                  className="glass-card font-mono"
                />
                <Button
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText(address || "");
                    toast.success("Address copied!");
                  }}
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="twitter">Twitter Handle (Optional)</Label>
              <div className="flex gap-2">
                <Twitter className="w-5 h-5 text-muted-foreground mt-2" />
                <Input
                  id="twitter"
                  value={profile.twitter}
                  onChange={(e) => setProfile({ ...profile, twitter: e.target.value })}
                  placeholder="@username"
                  className="glass-card"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Connect your Twitter for exclusive rewards
              </p>
            </div>

            <Button
              onClick={handleSave}
              disabled={saving}
              className="w-full bg-gradient-to-r from-primary to-accent hover:opacity-90"
            >
              {saving ? "Saving..." : "Save Profile"}
            </Button>
          </div>
        </Card>


        {/* Security Settings */}
        <Card className="modern-card p-6">
          <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Security & Privacy
          </h2>

          <div className="space-y-6">
            {/* 2FA Placeholder */}
            <div className="p-4 rounded-lg bg-secondary/30 border border-border/50">
              <div className="flex items-center justify-between mb-2">
                <div className="flex-1">
                  <h3 className="font-semibold mb-1">Two-Factor Authentication</h3>
                  <p className="text-sm text-muted-foreground">
                    Enhanced security for your treasury
                  </p>
                </div>
                <div className="px-3 py-1 rounded-full bg-warning/10 border border-warning/20 text-xs font-semibold text-warning">
                  Coming Soon
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Two-factor authentication will be available in the next release for added security.
              </p>
            </div>

            <Separator />

            {/* Notifications Toggle */}
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <h3 className="font-semibold mb-1">Email Notifications</h3>
                <p className="text-sm text-muted-foreground">
                  Receive alerts for deposits, withdrawals, and rebalancing
                </p>
              </div>
              <Switch
                checked={profile.notificationsEnabled}
                onCheckedChange={(checked) =>
                  setProfile({ ...profile, notificationsEnabled: checked })
                }
              />
            </div>

            <Separator />

            {/* Theme Toggle */}
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <h3 className="font-semibold mb-1">Dark Mode</h3>
                <p className="text-sm text-muted-foreground">
                  Switch between light and dark themes
                </p>
              </div>
              <Switch
                checked={theme === "dark"}
                onCheckedChange={toggleTheme}
              />
            </div>
          </div>
        </Card>

      </div>
    </div>
  );
};

export default Settings;

