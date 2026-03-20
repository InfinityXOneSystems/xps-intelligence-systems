import { AppLayout } from "@/components/layout/AppLayout";
import { Brain, Send, Sparkles, BookOpen, Clock, Lightbulb, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState, useRef, useEffect } from "react";
import { api } from "@/lib/api";

const prompts = [
  { icon: Lightbulb, label: "Research a lead", desc: "Get AI-powered intelligence on any company" },
  { icon: Brain, label: "Draft outreach email", desc: "Create personalized cold outreach for a lead" },
  { icon: BookOpen, label: "Objection handling", desc: "Get rebuttals for common sales objections" },
  { icon: Clock, label: "Follow-up strategy", desc: "AI-recommended next steps for stale leads" },
];

interface ChatMessage {
  role: "assistant" | "user";
  content: string;
}

const initialMessages: ChatMessage[] = [
  { role: "assistant", content: "Good morning, Marcus! I've analyzed your pipeline overnight. Here are 3 key insights:\n\n1. **Gulf Coast Logistics** hasn't been contacted in 8 days — I recommend a follow-up call today with the new pricing sheet.\n\n2. **Ace Hardware** proposal is pending review. The decision-maker, Robert Chen, typically responds within 48 hours.\n\n3. Your territory close rate is up 4.2% this month. Great work on the Tampa Bay Brewing deal!" },
  { role: "user", content: "Draft a follow-up email for Gulf Coast Logistics" },
  { role: "assistant", content: "Here's a personalized follow-up for Diana Patel at Gulf Coast Logistics:\n\n**Subject:** Quick Update on Your Warehouse Floor Project — New Options Available\n\n**Body:**\nHi Diana,\n\nI hope this week is treating you well. I wanted to circle back on our conversation about upgrading the warehouse floors at your Jacksonville facility.\n\nSince we last spoke, we've completed a similar 45,000 sq ft warehouse project for a logistics company in the Tampa area — the results exceeded expectations with a 40% improvement in forklift durability ratings.\n\nI'd love to share some photos and the specific system we used. Would Thursday or Friday work for a quick 15-minute call?\n\nBest regards,\nMarcus Rivera\nXPS Xpress — Southeast Region" },
];

const AIAssistant = () => {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const handleSend = async (text?: string) => {
    const prompt = text ?? message;
    if (!prompt.trim() || isLoading) return;

    const userMessage: ChatMessage = { role: "user", content: prompt };
    setMessages((prev) => [...prev, userMessage]);
    setMessage("");
    setIsLoading(true);

    try {
      const data = await api.post<{ result: string }>("/ai/invoke", {
        prompt,
        context: { territory: "Southeast FL" },
      });
      setMessages((prev) => [...prev, { role: "assistant", content: data.result }]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `⚠️ Error: ${(err as Error).message}` },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AppLayout title="AI Assistant">
      <div className="flex gap-6 h-[calc(100vh-8rem)]">
        {/* Main Chat */}
        <div className="flex-1 flex flex-col bg-gradient-card border border-border rounded-xl overflow-hidden">
          {/* Chat Header */}
          <div className="border-b border-border px-5 py-3 flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2">
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            <div>
              <div className="text-sm font-semibold text-foreground">XPS AI Sales Assistant</div>
              <div className="text-xs text-muted-foreground">Context: Your territory · Pipeline · Lead data</div>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-auto p-5 space-y-5">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] rounded-xl px-4 py-3 text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-primary/20 text-foreground border border-gold"
                    : "bg-accent text-foreground border border-border"
                }`}>
                  <div className="whitespace-pre-line">{msg.content}</div>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-accent text-foreground border border-border rounded-xl px-4 py-3 flex items-center gap-2 text-sm">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  <span className="text-muted-foreground">Thinking...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="border-t border-border p-4">
            <div className="flex gap-2">
              <Input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                placeholder="Ask your AI assistant anything..."
                className="bg-card border-border"
                disabled={isLoading}
              />
              <Button variant="gold" size="icon" onClick={() => handleSend()} disabled={isLoading}>
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="hidden lg:block w-72 space-y-4">
          <div className="bg-gradient-card border border-border rounded-xl p-4">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Quick Actions</h3>
            <div className="space-y-2">
              {prompts.map((p) => (
                <button
                  key={p.label}
                  onClick={() => handleSend(p.label)}
                  className="w-full flex items-start gap-3 p-3 rounded-lg border border-border hover:border-gold hover:bg-accent transition-all text-left"
                >
                  <div className="rounded-lg bg-primary/10 p-1.5 shrink-0">
                    <p.icon className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <div>
                    <div className="text-xs font-medium text-foreground">{p.label}</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">{p.desc}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="bg-gradient-card border border-border rounded-xl p-4">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Your Context</h3>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between text-muted-foreground"><span>Territory</span><span className="text-foreground">Southeast FL</span></div>
              <div className="flex justify-between text-muted-foreground"><span>Active Leads</span><span className="text-foreground">47</span></div>
              <div className="flex justify-between text-muted-foreground"><span>Pending Proposals</span><span className="text-foreground">8</span></div>
              <div className="flex justify-between text-muted-foreground"><span>Follow-ups Due</span><span className="text-primary font-medium">5</span></div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default AIAssistant;
