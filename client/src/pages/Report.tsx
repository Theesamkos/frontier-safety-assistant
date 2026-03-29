import { trpc } from "@/lib/trpc";
import { useParams, useLocation } from "wouter";
import { Shield, CheckCircle2, XCircle, AlertTriangle, FileText, Home, Download, Printer, Clock, Plane, User, Hash } from "lucide-react";

interface ReportContent {
  reportMetadata: {
    reportNumber: string;
    formType: string;
    generatedAt: string;
    generatedBy: string;
    regulatoryBasis: string;
  };
  aircraftInfo: {
    tailNumber: string;
    model: string;
    manufacturer: string;
  };
  inspectionSummary: {
    inspectorName: string;
    startTime: string;
    completionTime: string;
    totalSteps: number;
    completedSteps: number;
    passedSteps: number;
    failedSteps: number;
    overallStatus: string;
  };
  stepDetails: Array<{
    stepNumber: number;
    category: string;
    stepName: string;
    status: string;
    workerInput: string;
    readingValue: string | null;
    isInSpec: boolean | null;
    completedAt: string;
  }>;
  safetyFindings: Array<{
    severity: string;
    title: string;
    message: string;
    parameter: string | null;
    actualValue: string | null;
    expectedRange: string | null;
    acknowledged: boolean;
    timestamp: string;
  }>;
  certificationStatement: string;
}

export default function Report() {
  const params = useParams<{ sessionId: string }>();
  const sessionId = params.sessionId;
  const [, navigate] = useLocation();

  const { data: report, isLoading } = trpc.report.get.useQuery({ sessionId });

  const handlePrint = () => window.print();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          <p className="text-muted-foreground">Loading compliance report...</p>
        </div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-foreground mb-2">Report Not Found</h2>
          <p className="text-muted-foreground mb-6">This report has not been generated yet.</p>
          <button onClick={() => navigate("/")} className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium">
            Return Home
          </button>
        </div>
      </div>
    );
  }

  const content = report.content as unknown as ReportContent;
  const { reportMetadata, aircraftInfo, inspectionSummary, stepDetails, safetyFindings, certificationStatement } = content;
  const isAirworthy = inspectionSummary.overallStatus === "AIRWORTHY";
  const isHold = inspectionSummary.overallStatus.startsWith("HOLD");

  const statusColor = isAirworthy ? "text-emerald-400" : isHold ? "text-red-400" : "text-amber-400";
  const statusBg = isAirworthy ? "bg-emerald-400/10 border-emerald-400/30" : isHold ? "bg-red-400/10 border-red-400/30" : "bg-amber-400/10 border-amber-400/30";

  const categoryGroups = stepDetails.reduce<Record<string, typeof stepDetails>>((acc, step) => {
    if (!acc[step.category]) acc[step.category] = [];
    acc[step.category].push(step);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-border/60 bg-card/50 backdrop-blur-sm sticky top-0 z-10 print:hidden">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/")} className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors">
            <Home className="w-4 h-4" />
          </button>
          <div className="w-px h-4 bg-border" />
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary" />
            <span className="font-semibold text-sm text-foreground">FAA Compliance Report</span>
          </div>
          <span className="font-mono text-xs text-muted-foreground">{report.reportNumber}</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handlePrint} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:border-border/80 text-xs transition-colors">
            <Printer className="w-3.5 h-3.5" />
            Print
          </button>
          <button onClick={handlePrint} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 transition-opacity">
            <Download className="w-3.5 h-3.5" />
            Download PDF
          </button>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Report Header */}
        <div className="glass-card p-8 mb-6">
          <div className="flex items-start justify-between mb-6">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-10 h-10 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center">
                  <Shield className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-foreground">{reportMetadata.formType}</h1>
                  <p className="text-xs text-muted-foreground">Airworthiness Approval Tag</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed max-w-md">{reportMetadata.regulatoryBasis}</p>
            </div>
            <div className={`px-4 py-2 rounded-xl border text-center ${statusBg}`}>
              <div className={`text-lg font-bold ${statusColor}`}>{inspectionSummary.overallStatus}</div>
              <div className="text-xs text-muted-foreground mt-0.5">Disposition</div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-6 border-t border-border/40">
            <div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                <Hash className="w-3 h-3" />
                Report Number
              </div>
              <div className="font-mono text-xs text-foreground">{report.reportNumber}</div>
            </div>
            <div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                <Plane className="w-3 h-3" />
                Aircraft
              </div>
              <div className="text-xs text-foreground">{aircraftInfo.manufacturer} {aircraftInfo.model}</div>
              <div className="font-mono text-xs text-muted-foreground">{aircraftInfo.tailNumber}</div>
            </div>
            <div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                <User className="w-3 h-3" />
                Inspector
              </div>
              <div className="text-xs text-foreground">{inspectionSummary.inspectorName}</div>
            </div>
            <div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                <Clock className="w-3 h-3" />
                Generated
              </div>
              <div className="text-xs text-foreground">{new Date(reportMetadata.generatedAt).toLocaleString()}</div>
            </div>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          {[
            { label: "Total Steps", value: inspectionSummary.totalSteps, color: "text-foreground" },
            { label: "Completed", value: inspectionSummary.completedSteps, color: "text-primary" },
            { label: "Passed", value: inspectionSummary.passedSteps, color: "text-emerald-400" },
            { label: "Failed", value: inspectionSummary.failedSteps, color: "text-red-400" },
          ].map(({ label, value, color }) => (
            <div key={label} className="metric-card text-center">
              <div className={`text-3xl font-bold ${color}`}>{value}</div>
              <div className="text-xs text-muted-foreground mt-1">{label}</div>
            </div>
          ))}
        </div>

        {/* Safety Findings */}
        {safetyFindings.length > 0 && (
          <div className="glass-card p-6 mb-6">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <h2 className="font-semibold text-foreground">Safety Findings ({safetyFindings.length})</h2>
            </div>
            <div className="space-y-3">
              {safetyFindings.map((finding, i) => (
                <div key={i} className={`rounded-xl p-4 ${
                  finding.severity === "critical" ? "alert-critical" :
                  finding.severity === "warning" ? "alert-warning" : "alert-info"
                }`}>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium uppercase ${
                          finding.severity === "critical" ? "bg-red-400/20 text-red-400" :
                          finding.severity === "warning" ? "bg-amber-400/20 text-amber-400" : "bg-blue-400/20 text-blue-400"
                        }`}>{finding.severity}</span>
                        <span className="text-sm font-semibold">{finding.title}</span>
                      </div>
                      <p className="text-sm opacity-80 leading-relaxed">{finding.message}</p>
                      {finding.actualValue && (
                        <div className="mt-2 flex items-center gap-3 text-xs">
                          <span>Actual: <span className="font-mono font-semibold">{finding.actualValue}</span></span>
                          <span className="opacity-50">|</span>
                          <span>Expected: <span className="font-mono">{finding.expectedRange}</span></span>
                        </div>
                      )}
                    </div>
                    <div className="text-xs text-right opacity-60 flex-shrink-0">
                      <div>{finding.acknowledged ? "✓ Acknowledged" : "Unresolved"}</div>
                      <div className="font-mono">{new Date(finding.timestamp).toLocaleTimeString()}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step Details by Category */}
        <div className="glass-card p-6 mb-6">
          <div className="flex items-center gap-2 mb-6">
            <CheckCircle2 className="w-4 h-4 text-primary" />
            <h2 className="font-semibold text-foreground">Inspection Step Details</h2>
          </div>
          <div className="space-y-6">
            {Object.entries(categoryGroups).map(([category, catSteps]) => (
              <div key={category}>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                  <div className="w-4 h-px bg-border flex-1" />
                  {category}
                  <div className="w-4 h-px bg-border flex-1" />
                </h3>
                <div className="space-y-2">
                  {catSteps.map((step) => (
                    <div key={step.stepNumber} className="flex items-start gap-3 p-3 rounded-xl bg-secondary/20 border border-border/40">
                      <div className="flex-shrink-0 mt-0.5">
                        {step.status === "passed" ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        ) : step.status === "failed" ? (
                          <XCircle className="w-4 h-4 text-red-400" />
                        ) : (
                          <div className="w-4 h-4 rounded-full border border-border" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-mono text-xs text-muted-foreground">{step.stepNumber.toString().padStart(2, "0")}</span>
                          <span className="text-sm font-medium text-foreground">{step.stepName}</span>
                          {step.readingValue && (
                            <span className={`ml-auto text-xs font-mono px-2 py-0.5 rounded-full ${
                              step.isInSpec ? "bg-emerald-400/15 text-emerald-400" : "bg-red-400/15 text-red-400"
                            }`}>{step.readingValue}</span>
                          )}
                        </div>
                        {step.workerInput && (
                          <p className="text-xs text-muted-foreground italic">"{step.workerInput}"</p>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground/50 flex-shrink-0 font-mono">
                        {new Date(step.completedAt).toLocaleTimeString()}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Certification */}
        <div className={`glass-card p-6 mb-6 ${isAirworthy ? "border-emerald-400/30" : "border-red-400/30"}`}>
          <div className="flex items-center gap-2 mb-4">
            <Shield className={`w-4 h-4 ${isAirworthy ? "text-emerald-400" : "text-red-400"}`} />
            <h2 className="font-semibold text-foreground">Certification Statement</h2>
          </div>
          <p className={`text-sm leading-relaxed ${isAirworthy ? "text-emerald-400/90" : "text-red-400/90"}`}>
            {certificationStatement}
          </p>
          <div className="mt-6 pt-6 border-t border-border/40 grid grid-cols-2 gap-8">
            <div>
              <div className="text-xs text-muted-foreground mb-2">Inspector Signature</div>
              <div className="h-10 border-b border-dashed border-border/60 flex items-end pb-1">
                <span className="text-sm text-muted-foreground/40 italic">Digital signature pending</span>
              </div>
              <div className="text-xs text-muted-foreground mt-1">{inspectionSummary.inspectorName}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-2">Date & Time</div>
              <div className="h-10 border-b border-dashed border-border/60 flex items-end pb-1">
                <span className="text-sm text-foreground">{new Date(inspectionSummary.completionTime).toLocaleString()}</span>
              </div>
              <div className="text-xs text-muted-foreground mt-1">UTC {new Date(inspectionSummary.completionTime).toISOString()}</div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-xs text-muted-foreground py-4">
          <p>Generated by {reportMetadata.generatedBy}</p>
          <p className="mt-1 opacity-60">This document is for demonstration purposes. Not for actual aircraft operations.</p>
        </div>
      </div>
    </div>
  );
}
