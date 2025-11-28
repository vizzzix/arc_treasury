import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Send, CheckCircle, ArrowLeft, Mail } from "lucide-react";
import { useAccount } from "wagmi";
import { useNavigate } from "react-router-dom";

const Support = () => {
  const { toast } = useToast();
  const account = useAccount();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!account?.address) {
      toast({
        title: "Connect Wallet",
        description: "Please connect your wallet to send a message",
        variant: "destructive",
      });
      return;
    }

    if (!email.trim()) {
      toast({
        title: "Email required",
        description: "Please enter your email address",
        variant: "destructive",
      });
      return;
    }

    if (!message.trim()) {
      toast({
        title: "Empty message",
        description: "Please write your message",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/support/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          category: "general",
          name: "User",
          email: email.trim(),
          subject: "Support Request",
          message,
          walletAddress: account.address,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to submit support request");
      }

      setIsSuccess(true);
      setMessage("");

      setTimeout(() => {
        setIsSuccess(false);
      }, 3000);
    } catch (error) {
      console.error("Error submitting support request:", error);
      toast({
        title: "Error",
        description: "Failed to send message. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <nav className="border-b border-border/30 bg-background/80 backdrop-blur-lg">
        <div className="container mx-auto px-6 py-4">
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-2 hover:text-primary transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back to Home</span>
          </button>
        </div>
      </nav>

      {/* Main Content */}
      <div className="container mx-auto px-6 py-12 max-w-2xl">
        <div className="w-full">
          {isSuccess ? (
            <div className="flex flex-col items-center justify-center space-y-6 animate-in fade-in zoom-in duration-500">
              <CheckCircle className="w-20 h-20 text-green-500" />
              <div className="text-center space-y-2">
                <h2 className="text-3xl font-bold">Message Sent!</h2>
                <p className="text-muted-foreground">
                  Thank you for reaching out. We'll respond soon.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-8">
              {/* Title */}
              <div className="text-center space-y-3">
                <h1 className="text-4xl md:text-5xl font-bold">
                  Get in Touch
                </h1>
                <p className="text-lg text-muted-foreground">
                  Have questions? We're here to help.
                </p>
              </div>

              {/* Wallet Info */}
              {account?.address ? (
                <div className="p-4 rounded-2xl bg-primary/5 border border-primary/20">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      Connected as
                    </span>
                    <div className="font-mono text-sm px-3 py-1.5 rounded-lg bg-background/50">
                      {account.address.slice(0, 6)}...{account.address.slice(-4)}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-6 rounded-2xl bg-yellow-500/10 border border-yellow-500/20 text-center">
                  <p className="text-sm text-yellow-600 dark:text-yellow-400">
                    ⚠️ Please connect your wallet to send a message
                  </p>
                </div>
              )}

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-3">
                  <label className="text-sm font-medium">
                    Your Email
                  </label>
                  <Input
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="text-base"
                    disabled={!account?.address}
                    required
                  />
                </div>

                <div className="space-y-3">
                  <label className="text-sm font-medium">
                    Your Message
                  </label>
                  <Textarea
                    placeholder="Tell us how we can help you..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={8}
                    maxLength={1000}
                    className="resize-none text-base"
                    disabled={!account?.address}
                  />
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-muted-foreground">
                      {message.length}/1000 characters
                    </span>
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={isSubmitting || !account?.address || !email.trim() || !message.trim()}
                  className="w-full h-12 text-base gap-2"
                  size="lg"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="w-5 h-5" />
                      Send Message
                    </>
                  )}
                </Button>
              </form>

              {/* Direct Contact */}
              <div className="p-6 rounded-2xl bg-muted/30 border border-border/50 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Mail className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Or email us directly at</p>
                    <a
                      href="mailto:info@arctreasury.biz"
                      className="text-lg font-medium text-primary hover:underline"
                    >
                      info@arctreasury.biz
                    </a>
                  </div>
                </div>
              </div>

              {/* Info */}
              <div className="text-center space-y-2">
                <p className="text-sm text-muted-foreground">
                  Your wallet address and email will be used to identify your request
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Support;
