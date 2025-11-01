import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageCircle, Send, X, Sparkles } from "lucide-react";
import { toast } from "sonner";

const AIChatAssistant = () => {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Array<{ role: string; content: string }>>([
    { 
      role: "assistant", 
      content: "Hi! I'm your AI treasury assistant. Ask me anything about your portfolio, strategies, or actions!" 
    }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY;

  const handleSend = async () => {
    if (!input.trim() || !OPENAI_API_KEY) return;

    const userMessage = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: userMessage }]);
    setLoading(true);

    try {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: `You are Arc Treasury AI assistant. Help users manage their stablecoin treasury (USDC/EURC/XSGD). 
              Be concise, helpful, and actionable. Suggest specific actions when appropriate.
              Available actions: deposit, withdraw, rebalance, bridge, schedule payments.`
            },
            ...messages.map(m => ({ role: m.role, content: m.content })),
            { role: "user", content: userMessage }
          ],
          temperature: 0.7,
          max_tokens: 200,
        }),
      });

      const data = await response.json();
      const aiMessage = data.choices[0]?.message?.content || "Sorry, I couldn't process that.";
      
      setMessages(prev => [...prev, { role: "assistant", content: aiMessage }]);
    } catch (error) {
      console.error("Chat error:", error);
      toast.error("AI chat unavailable");
      setMessages(prev => [...prev, { 
        role: "assistant", 
        content: "Sorry, I'm having trouble connecting. Please try again." 
      }]);
    } finally {
      setLoading(false);
    }
  };

  if (!OPENAI_API_KEY) return null;

  return (
    <>
      {/* Floating Button */}
      <button 
        onClick={() => setOpen(!open)}
        className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-gradient-to-r from-primary to-accent shadow-lg hover:shadow-2xl hover:scale-110 transition-all z-50 flex items-center justify-center"
      >
        {open ? (
          <X className="w-6 h-6 text-white" />
        ) : (
          <MessageCircle className="w-6 h-6 text-white" />
        )}
      </button>

      {/* Chat Panel */}
      {open && (
        <div className="fixed bottom-24 right-6 w-96 h-[500px] modern-card rounded-2xl shadow-2xl flex flex-col z-50">
          {/* Header */}
          <div className="p-4 border-b border-border/50 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold">AI Assistant</h3>
              <p className="text-xs text-muted-foreground">Always here to help</p>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] p-3 rounded-2xl text-sm ${
                  msg.role === "user" 
                    ? "bg-gradient-to-r from-primary to-accent text-white" 
                    : "bg-secondary/50"
                }`}>
                  {msg.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-secondary/50 p-3 rounded-2xl text-sm">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" />
                    <div className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "0.1s" }} />
                    <div className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "0.2s" }} />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="p-4 border-t border-border/50">
            <div className="flex gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask anything..."
                className="h-10 text-sm"
                onKeyPress={(e) => e.key === "Enter" && !loading && handleSend()}
                disabled={loading}
              />
              <Button 
                onClick={handleSend}
                disabled={loading || !input.trim()}
                size="sm"
                className="gap-2 h-10 px-4"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default AIChatAssistant;

