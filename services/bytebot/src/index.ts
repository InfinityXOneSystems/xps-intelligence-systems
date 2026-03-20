/**
 * ByteBot Operator Service
 *
 * Orchestrates multi-step autonomous workflows for XPS Intelligence.
 * Logs all steps with timestamps and produces JSON performance reports.
 */

import type { ScrapedLead } from "../../scraper/src/scraper.js";

export interface WorkflowStep {
  name: string;
  action: () => Promise<unknown>;
  required?: boolean;
}

export interface StepLog {
  step: string;
  status: "running" | "completed" | "failed" | "skipped";
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
  result?: unknown;
  error?: string;
}

export interface PerformanceReport {
  workflowId: string;
  startedAt: string;
  completedAt: string;
  totalDurationMs: number;
  stepsTotal: number;
  stepsCompleted: number;
  stepsFailed: number;
  stepsSkipped: number;
  steps: StepLog[];
  outcome: "success" | "partial" | "failed";
}

export interface LeadReport {
  generatedAt: string;
  totalLeads: number;
  avgScore: number;
  topLeads: ScrapedLead[];
  industryBreakdown: Record<string, number>;
  locationBreakdown: Record<string, number>;
  recommendations: string[];
}

export class ByteBotOperator {
  private readonly tag = "[ByteBot]";

  private log(msg: string, data?: unknown): void {
    const ts = new Date().toISOString();
    if (data !== undefined) {
      console.log(`${ts} ${this.tag} ${msg}`, data);
    } else {
      console.log(`${ts} ${this.tag} ${msg}`);
    }
  }

  async executeWorkflow(steps: WorkflowStep[]): Promise<PerformanceReport> {
    const workflowId = `wf_${Date.now()}`;
    const startedAt = new Date().toISOString();
    this.log(`Starting workflow ${workflowId} with ${steps.length} steps`);

    const stepLogs: StepLog[] = [];
    let completed = 0;
    let failed = 0;
    let skipped = 0;

    for (const step of steps) {
      const stepLog: StepLog = {
        step: step.name,
        status: "running",
        startedAt: new Date().toISOString(),
      };
      stepLogs.push(stepLog);
      this.log(`Step: ${step.name} — starting`);

      const t0 = Date.now();
      try {
        const result = await step.action();
        stepLog.status = "completed";
        stepLog.result = result;
        stepLog.completedAt = new Date().toISOString();
        stepLog.durationMs = Date.now() - t0;
        this.log(`Step: ${step.name} — completed in ${stepLog.durationMs}ms`);
        completed++;
      } catch (err) {
        stepLog.status = "failed";
        stepLog.error = (err as Error).message;
        stepLog.completedAt = new Date().toISOString();
        stepLog.durationMs = Date.now() - t0;
        this.log(`Step: ${step.name} — FAILED: ${stepLog.error}`);
        failed++;

        if (step.required !== false) {
          // Mark remaining steps as skipped
          for (let i = stepLogs.length; i < steps.length; i++) {
            stepLogs.push({
              step: steps[i].name,
              status: "skipped",
              startedAt: new Date().toISOString(),
              completedAt: new Date().toISOString(),
              durationMs: 0,
            });
            skipped++;
          }
          break;
        }
      }
    }

    const completedAt = new Date().toISOString();
    const totalDurationMs = Date.now() - new Date(startedAt).getTime();

    const outcome: PerformanceReport["outcome"] =
      failed === 0 ? "success" : completed > 0 ? "partial" : "failed";

    const report: PerformanceReport = {
      workflowId,
      startedAt,
      completedAt,
      totalDurationMs,
      stepsTotal: steps.length,
      stepsCompleted: completed,
      stepsFailed: failed,
      stepsSkipped: skipped,
      steps: stepLogs,
      outcome,
    };

    this.log(`Workflow ${workflowId} finished — ${outcome} in ${totalDurationMs}ms`);
    return report;
  }

  async scrapeAndAnalyze(city: string, industry: string, keyword?: string): Promise<{
    leads: ScrapedLead[];
    report: PerformanceReport;
  }> {
    let leads: ScrapedLead[] = [];

    const report = await this.executeWorkflow([
      {
        name: "search_businesses",
        action: async () => {
          const { searchBusinesses } = await import("../../scraper/src/search-engine.js");
          const result = await searchBusinesses({
            city,
            state: "FL",
            industry,
            keyword,
            max_results: 30,
          });
          leads = result.leads;
          this.log(`Found ${leads.length} leads via ${result.source}`);
          return { count: leads.length, source: result.source };
        },
      },
      {
        name: "score_leads",
        required: false,
        action: async () => {
          leads = leads.map((lead) => ({
            ...lead,
            score: lead.score ?? this.computeScore(lead),
          }));
          return { scored: leads.length };
        },
      },
      {
        name: "generate_report",
        required: false,
        action: async () => {
          const report = this.generateLeadReport(leads);
          return report;
        },
      },
    ]);

    return { leads, report };
  }

  generateLeadReport(leads: ScrapedLead[]): LeadReport {
    const avgScore = leads.length > 0
      ? Math.round(leads.reduce((s, l) => s + (l.score ?? 50), 0) / leads.length)
      : 0;

    const topLeads = [...leads]
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
      .slice(0, 10);

    const industryBreakdown: Record<string, number> = {};
    const locationBreakdown: Record<string, number> = {};

    for (const lead of leads) {
      const industry = lead.vertical || "Unknown";
      const location = lead.location || "Unknown";
      industryBreakdown[industry] = (industryBreakdown[industry] ?? 0) + 1;
      locationBreakdown[location] = (locationBreakdown[location] ?? 0) + 1;
    }

    const recommendations: string[] = [];
    if (topLeads.length > 0) {
      recommendations.push(`Focus on top lead: ${topLeads[0].company_name} (score ${topLeads[0].score})`);
    }
    if (avgScore > 70) {
      recommendations.push("High-quality lead pool — prioritize immediate outreach.");
    } else if (avgScore < 50) {
      recommendations.push("Low average score — consider refining search criteria.");
    }
    if (leads.some((l) => l.phone)) {
      recommendations.push("Phone numbers available — schedule call campaign.");
    }
    if (leads.some((l) => l.email)) {
      recommendations.push("Email addresses available — prepare email sequence.");
    }

    return {
      generatedAt: new Date().toISOString(),
      totalLeads: leads.length,
      avgScore,
      topLeads,
      industryBreakdown,
      locationBreakdown,
      recommendations,
    };
  }

  async validateOutcome(action: string, result: unknown): Promise<{
    valid: boolean;
    issues: string[];
    score: number;
  }> {
    this.log(`Validating outcome for action: ${action}`);
    const issues: string[] = [];
    let score = 100;

    if (result === null || result === undefined) {
      issues.push("Result is null/undefined");
      score -= 50;
    }

    if (typeof result === "object" && result !== null) {
      const r = result as Record<string, unknown>;
      if ("error" in r) {
        issues.push(`Error in result: ${r.error}`);
        score -= 40;
      }
      if ("leads" in r && Array.isArray(r.leads) && r.leads.length === 0) {
        issues.push("No leads returned");
        score -= 20;
      }
    }

    const valid = score >= 60;
    this.log(`Validation result: score=${score}, valid=${valid}, issues=${issues.length}`);
    return { valid, issues, score };
  }

  private computeScore(lead: ScrapedLead): number {
    let score = 50;
    if (lead.phone) score += 10;
    if (lead.email) score += 15;
    if (lead.website) score += 10;
    if (lead.contact_name) score += 5;
    const raw = lead.raw_data as Record<string, unknown> | undefined;
    if (raw?.google_rating && Number(raw.google_rating) >= 4) score += 10;
    return Math.min(100, score);
  }
}

export default ByteBotOperator;
