import { useState, useEffect, useCallback } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Brain, Phone, Mail, MessageSquare, Calendar, Target, CheckCircle2, RefreshCw, ThumbsUp, ThumbsDown, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

interface Lead {
  id: string;
  company_name: string;
  contact_name?: string;
  email?: string;
  phone?: string;
  vertical?: string;
  location?: string;
  score?: number;
  stage?: string;
}

interface FollowUpItem {
  day: number;
  action: string;
}

interface SalesAnalysis {
  summary: string;
  recommended_action: "call" | "email" | "text";
  script: string;
  pricing_recommendation: string;
  proposal_outline: string;
  follow_up_schedule: FollowUpItem[];
}

const channelIcon = {
  call: Phone,
  email: Mail,
  text: MessageSquare,
};

const SalesFlow = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [analysis, setAnalysis] = useState<SalesAnalysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [executingAction, setExecutingAction] = useState<string | null>(null);
  const [feedbackOutcome, setFeedbackOutcome] = useState<string | null>(null);
  const [feedbackNotes, setFeedbackNotes] = useState("");
  const [sendingFeedback, setSendingFeedback] = useState(false);
  const { toast } = useToast();

  // Search leads
  useEffect(() => {
    if (!searchQuery.trim()) {
      setLeads([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const data = await api.get<{ leads: Lead[] }>(`/leads?search=${encodeURIComponent(searchQuery)}&limit=10`);
        setLeads(data.leads || []);
      } catch {
        setLeads([]);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const handleSelectLead = useCallback(async (lead: Lead) => {
    setSelectedLead(lead);
    setAnalysis(null);
    setFeedbackOutcome(null);
    setFeedbackNotes("");
    setSearchQuery(lead.company_name);
    setLeads([]);

    // Try to load existing analysis
    try {
      const data = await api.get<{ record: SalesAnalysis | null }>(`/sales-flow/${lead.id}`);
      if (data.record) setAnalysis(data.record as SalesAnalysis);
    } catch {
      // No existing analysis — user will click Analyze
    }
  }, []);

  const handleAnalyze = useCallback(async () => {
    if (!selectedLead) return;
    setAnalyzing(true);
    try {
      const data = await api.post<{ analysis: SalesAnalysis }>("/sales-flow/analyze", { lead_id: selectedLead.id });
      setAnalysis(data.analysis);
      toast({ title: "Analysis complete", description: `Recommended: ${data.analysis.recommended_action}` });
    } catch (err) {
      toast({ title: "Analysis failed", description: (err as Error).message, variant: "destructive" });
    } finally {
      setAnalyzing(false);
    }
  }, [selectedLead, toast]);

  const handleExecuteAction = useCallback(async (channel: string) => {
    if (!selectedLead || !analysis) return;
    setExecutingAction(channel);
    try {
      if (channel === "sms" && selectedLead.phone) {
        await api.post("/actions/sms", {
          lead_id: selectedLead.id,
          to_phone: selectedLead.phone,
          message: analysis.script.slice(0, 160),
          ai_generated: true,
        });
      } else if (channel === "email" && selectedLead.email) {
        await api.post("/actions/email", {
          lead_id: selectedLead.id,
          to_email: selectedLead.email,
          subject: `XPS Intelligence — Solution for ${selectedLead.company_name}`,
          body: analysis.script,
          ai_generated: true,
        });
      } else {
        // Log as communication note for call
        await api.post("/sales-flow/execute-action", {
          lead_id: selectedLead.id,
          action_type: "call",
          content: analysis.script,
          channel: "call",
        });
      }
      toast({ title: `${channel === "sms" ? "SMS" : channel === "email" ? "Email" : "Call script"} executed`, description: "Logged to communication history." });
    } catch (err) {
      toast({ title: "Action failed", description: (err as Error).message, variant: "destructive" });
    } finally {
      setExecutingAction(null);
    }
  }, [selectedLead, analysis, toast]);

  const handleScheduleFollowups = useCallback(async () => {
    if (!selectedLead || !analysis?.follow_up_schedule?.length) return;
    try {
      await api.post("/actions/schedule-followup", {
        lead_id: selectedLead.id,
        schedule: analysis.follow_up_schedule.map((item) => ({
          day: item.day,
          action: item.action,
          channel: "email",
        })),
      });
      toast({ title: "Follow-ups scheduled", description: `${analysis.follow_up_schedule.length} follow-ups queued.` });
    } catch (err) {
      toast({ title: "Schedule failed", description: (err as Error).message, variant: "destructive" });
    }
  }, [selectedLead, analysis, toast]);

  const handleFeedback = useCallback(async () => {
    if (!selectedLead || !feedbackOutcome) return;
    setSendingFeedback(true);
    try {
      const data = await api.post<{ updated_score: number; improvement_delta: number }>("/feedback/outcome", {
        lead_id: selectedLead.id,
        action_type: analysis?.recommended_action || "general",
        outcome: feedbackOutcome,
        notes: feedbackNotes || undefined,
      });
      toast({
        title: "Feedback recorded",
        description: `Lead score updated to ${data.updated_score} (${data.improvement_delta >= 0 ? "+" : ""}${data.improvement_delta})`,
      });
      setFeedbackOutcome(null);
      setFeedbackNotes("");
    } catch (err) {
      toast({ title: "Feedback failed", description: (err as Error).message, variant: "destructive" });
    } finally {
      setSendingFeedback(false);
    }
  }, [selectedLead, feedbackOutcome, feedbackNotes, analysis, toast]);

  const RecommendedIcon = analysis ? (channelIcon[analysis.recommended_action as keyof typeof channelIcon] ?? Phone) : Phone;

  return (
    <AppLayout title="Sales Flow">
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-foreground">AI Sales Operating Flow</h2>
          <p className="text-sm text-muted-foreground">Select a lead, generate AI analysis, execute actions, and track outcomes.</p>
        </div>

        {/* Lead Search */}
        <div className="bg-gradient-card border border-border rounded-xl p-5">
          <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" /> Select Lead
          </h3>
          <div className="relative">
            <Input
              placeholder="Search leads by company name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-card border-border"
            />
            {leads.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-lg z-10 max-h-60 overflow-y-auto">
                {leads.map((lead) => (
                  <button
                    key={lead.id}
                    onClick={() => handleSelectLead(lead)}
                    className="w-full text-left px-4 py-3 hover:bg-accent transition-colors border-b border-border/50 last:border-0"
                  >
                    <div className="text-sm font-medium text-foreground">{lead.company_name}</div>
                    <div className="text-xs text-muted-foreground">{lead.vertical} · {lead.location} · Score: {lead.score ?? "—"}</div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {selectedLead && (
            <div className="mt-3 flex items-center gap-3 p-3 bg-primary/5 rounded-lg border border-primary/20">
              <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
              <div className="min-w-0">
                <div className="text-sm font-semibold text-foreground">{selectedLead.company_name}</div>
                <div className="text-xs text-muted-foreground truncate">{selectedLead.vertical} · {selectedLead.location} · Stage: {selectedLead.stage}</div>
              </div>
              <Button
                className="ml-auto shrink-0"
                onClick={handleAnalyze}
                disabled={analyzing}
              >
                {analyzing ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <Brain className="h-4 w-4 mr-2" />}
                {analyzing ? "Analyzing..." : "Analyze"}
              </Button>
            </div>
          )}
        </div>

        {/* Analysis Panel */}
        {analysis && selectedLead && (
          <>
            {/* Summary + Recommended Action */}
            <div className="grid lg:grid-cols-2 gap-4">
              <div className="bg-gradient-card border border-border rounded-xl p-5">
                <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                  <Brain className="h-4 w-4 text-primary" /> AI Summary
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{analysis.summary}</p>

                <div className="mt-4 flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Recommended action:</span>
                  <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium capitalize">
                    <RecommendedIcon className="h-3.5 w-3.5" />
                    {analysis.recommended_action}
                  </span>
                </div>
              </div>

              <div className="bg-gradient-card border border-border rounded-xl p-5">
                <h3 className="text-sm font-semibold text-foreground mb-3">💰 Pricing Recommendation</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{analysis.pricing_recommendation}</p>

                <div className="mt-4">
                  <p className="text-xs font-semibold text-foreground mb-2">Proposal Outline</p>
                  <pre className="text-xs text-muted-foreground whitespace-pre-wrap">{analysis.proposal_outline}</pre>
                </div>
              </div>
            </div>

            {/* Script */}
            <div className="bg-gradient-card border border-border rounded-xl p-5">
              <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <RecommendedIcon className="h-4 w-4 text-primary" /> AI-Generated Script
              </h3>
              <pre className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed bg-card/50 rounded-lg p-4 border border-border/50">
                {analysis.script}
              </pre>
            </div>

            {/* Execute Actions */}
            <div className="bg-gradient-card border border-border rounded-xl p-5">
              <h3 className="text-sm font-semibold text-foreground mb-4">Execute Actions</h3>
              <div className="flex flex-wrap gap-3">
                <Button
                  variant="outline"
                  disabled={!selectedLead.phone || executingAction === "call"}
                  onClick={() => handleExecuteAction("call")}
                  title={!selectedLead.phone ? "No phone number available" : "Log call script"}
                >
                  {executingAction === "call" ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <Phone className="h-4 w-4 mr-2" />}
                  Log Call
                </Button>
                <Button
                  variant="outline"
                  disabled={!selectedLead.email || executingAction === "email"}
                  onClick={() => handleExecuteAction("email")}
                  title={!selectedLead.email ? "No email available" : "Send email"}
                >
                  {executingAction === "email" ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <Mail className="h-4 w-4 mr-2" />}
                  Send Email
                </Button>
                <Button
                  variant="outline"
                  disabled={!selectedLead.phone || executingAction === "sms"}
                  onClick={() => handleExecuteAction("sms")}
                  title={!selectedLead.phone ? "No phone number available" : "Send SMS"}
                >
                  {executingAction === "sms" ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <MessageSquare className="h-4 w-4 mr-2" />}
                  Send SMS
                </Button>
              </div>
              {!selectedLead.phone && !selectedLead.email && (
                <p className="text-xs text-muted-foreground mt-3">Add contact info to the lead to enable direct actions.</p>
              )}
            </div>

            {/* Follow-Up Schedule */}
            {analysis.follow_up_schedule?.length > 0 && (
              <div className="bg-gradient-card border border-border rounded-xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-primary" /> Follow-Up Schedule
                  </h3>
                  <Button size="sm" variant="outline" onClick={handleScheduleFollowups}>
                    <Calendar className="h-3.5 w-3.5 mr-1.5" /> Schedule All
                  </Button>
                </div>
                <div className="space-y-2">
                  {analysis.follow_up_schedule.map((item, i) => (
                    <div key={i} className="flex items-start gap-3 py-2 border-b border-border/50 last:border-0">
                      <span className="shrink-0 w-14 text-xs font-medium text-primary bg-primary/10 rounded px-2 py-0.5 text-center">
                        Day {item.day}
                      </span>
                      <span className="text-sm text-foreground">{item.action}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Feedback Panel */}
            <div className="bg-gradient-card border border-border rounded-xl p-5">
              <h3 className="text-sm font-semibold text-foreground mb-4">Record Outcome</h3>
              <div className="flex flex-wrap gap-2 mb-3">
                {(["positive", "neutral", "negative"] as const).map((outcome) => {
                  const Icon = outcome === "positive" ? ThumbsUp : outcome === "negative" ? ThumbsDown : Minus;
                  const activeClass = feedbackOutcome === outcome
                    ? outcome === "positive" ? "bg-green-500/20 border-green-500/50 text-green-400"
                    : outcome === "negative" ? "bg-red-500/20 border-red-500/50 text-red-400"
                    : "bg-yellow-500/20 border-yellow-500/50 text-yellow-400"
                    : "";
                  return (
                    <button
                      key={outcome}
                      onClick={() => setFeedbackOutcome(feedbackOutcome === outcome ? null : outcome)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium capitalize transition-all ${activeClass || "border-border text-muted-foreground hover:bg-accent"}`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {outcome}
                    </button>
                  );
                })}
              </div>
              {feedbackOutcome && (
                <div className="space-y-3">
                  <Input
                    placeholder="Optional notes about the outcome..."
                    value={feedbackNotes}
                    onChange={(e) => setFeedbackNotes(e.target.value)}
                    className="bg-card border-border text-sm"
                  />
                  <Button
                    size="sm"
                    onClick={handleFeedback}
                    disabled={sendingFeedback}
                  >
                    {sendingFeedback ? <RefreshCw className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />}
                    Record Feedback
                  </Button>
                </div>
              )}
            </div>
          </>
        )}

        {!selectedLead && (
          <div className="text-center py-16">
            <Brain className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-sm text-muted-foreground">Search for a lead above to begin the AI Sales Flow.</p>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default SalesFlow;
