import { trpc } from "@/lib/trpc";
import { useParams, useLocation } from "wouter";
import {
  Shield, CheckCircle2, XCircle, AlertTriangle, FileText,
  Home, Download, Printer, Clock, Plane, User, Hash, Flame, ChevronRight,
} from "lucide-react";

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
    industry?: string;
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
      <div className="min-h-screen flex items-center justify-center" style={{ background: "oklch(8% 0.005 60)", fontFamily: "var(--font-sans)" }}>
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-2 border-[oklch(18%_0.006_60)] border-t-[oklch(85%_0.06_75)] rounded-full animate-spin" />
          <p className="text-[14px] text-[oklch(50%_0.008_70)]">Loading compliance report...</p>
        </div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "oklch(8% 0.005 60)", fontFamily: "var(--font-sans)" }}>
        <div className="text-center">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 bg-[oklch(14%_0.005_60)] border border-[oklch(18%_0.006_60)]">
            <FileText className="w-6 h-6 text-[oklch(50%_0.008_70)]" />
          </div>
          <h2 className="text-[20px] font-semibold text-[oklch(95%_0.005_80)] mb-2">Report Not Found</h2>
          <p className="text-[14px] text-[oklch(50%_0.008_70)] mb-6">This report has not been generated yet.</p>
          <button onClick={() => navigate("/")} className="px-5 py-2.5 rounded-xl text-[13px] font-semibold hover:opacity-90 transition-opacity" style={{ background: "oklch(85% 0.06 75)", color: "oklch(8% 0.005 60)" }}>
            Return Home
          </button>
        </div>
      </div>
    );
  }

  const content = report.content as unknown as ReportContent;
  const { reportMetadata, aircraftInfo, inspectionSummary, stepDetails, safetyFindings, certificationStatement } = content;
  const isAirworthy = inspectionSummary.overallStatus === "AIRWORTHY" || inspectionSummary.overallStatus === "CLEARED FOR PRODUCTION";
  const isHold = inspectionSummary.overallStatus.startsWith("HOLD");
  const isManufacturing = aircraftInfo.industry === "manufacturing" || aircraftInfo.model?.toLowerCase().includes("furnace") || aircraftInfo.model?.toLowerCase().includes("ladle");

  const statusColor = isAirworthy ? "text-[oklch(65%_0.15_155)]" : isHold ? "text-[oklch(62%_0.20_25)]" : "text-[oklch(85%_0.06_75)]";
  const statusBg = isAirworthy
    ? "bg-[oklch(18%_0.03_155)] border-[oklch(50%_0.12_155/0.3)]"
    : isHold
    ? "bg-[oklch(18%_0.04_25)] border-[oklch(50%_0.15_25/0.3)]"
    : "bg-[oklch(18%_0.03_65)] border-[oklch(60%_0.10_65/0.3)]";

  const categoryGroups = stepDetails.reduce<Record<string, typeof stepDetails>>((acc, step) => {
    if (!acc[step.category]) acc[step.category] = [];
    acc[step.category].push(step);
    return acc;
  }, {});

  return (
    <div className="min-h-screen" style={{ background: "oklch(8% 0.005 60)", fontFamily: "var(--font-sans)" }}>

      {/* ══ NAV ══ */}
      <header className="flex items-center justify-between px-8 py-4 border-b border-[oklch(16%_0.006_60)] sticky top-0 z-50 backdrop-blur-xl print:hidden" style={{ background: "oklch(8% 0.005 60 / 0.85)" }}>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "oklch(85% 0.06 75)" }}>
              <span className="text-[10px] font-bold" style={{ color: "oklch(8% 0.005 60)" }}>SF</span>
            </div>
            <span className="text-[13px] font-medium tracking-wide text-[oklch(95%_0.005_80)] hidden sm:block">Frontier</span>
          </div>
          <ChevronRight size={11} className="text-[oklch(35%_0.006_60)]" />
          <button onClick={() => navigate("/")} className="text-[12px] text-[oklch(45%_0.008_70)] hover:text-[oklch(85%_0.06_75)] transition-colors flex items-center gap-1">
            <Home size={11} /> Home
          </button>
          <ChevronRight size={11} className="text-[oklch(35%_0.006_60)]" />
          <div className="flex items-center gap-2">
            <FileText size={13} className="text-[oklch(85%_0.06_75)]" />
            <span className="font-semibold text-[12px] text-[oklch(95%_0.005_80)]">{isManufacturing ? "OSHA Report" : "FAA Report"}</span>
          </div>
          <span className="font-mono text-[11px] text-[oklch(40%_0.008_70)] bg-[oklch(14%_0.005_60)] border border-[oklch(18%_0.006_60)] rounded-full px-2.5 py-0.5">{report.reportNumber}</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handlePrint} className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-[oklch(18%_0.006_60)] text-[oklch(70%_0.005_70)] hover:border-[oklch(85%_0.06_75)] hover:text-[oklch(85%_0.06_75)] text-[11px] font-semibold transition-all">
            <Printer size={12} />
            Print
          </button>
          <button onClick={handlePrint} className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[11px] font-semibold hover:opacity-90 transition-opacity" style={{ background: "oklch(85% 0.06 75)", color: "oklch(8% 0.005 60)" }}>
            <Download size={12} />
            Download PDF
          </button>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-10">

        {/* ══ REPORT HEADER ══ */}
        <div className="glass-card p-8 mb-6 animate-fade-in-up">
          <div className="flex items-start justify-between mb-6">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "oklch(85% 0.06 75 / 0.1)", border: "1px solid oklch(85% 0.06 75 / 0.2)" }}>
                  {isManufacturing ? <Flame size={18} className="text-[oklch(85%_0.06_75)]" /> : <Shield size={18} className="text-[oklch(85%_0.06_75)]" />}
                </div>
                <div>
                  <h1 className="text-[20px] font-bold text-[oklch(95%_0.005_80)]">{reportMetadata.formType}</h1>
                  <p className="text-[11px] text-[oklch(45%_0.008_70)]">{isManufacturing ? "LOTO Verification Report" : "Airworthiness Approval Tag"}</p>
                </div>
              </div>
              <p className="text-[12px] text-[oklch(45%_0.008_70)] leading-relaxed max-w-md">{reportMetadata.regulatoryBasis}</p>
            </div>
            <div className={`px-5 py-3 rounded-xl border text-center ${statusBg}`}>
              <div className={`text-[16px] font-bold ${statusColor}`}>{inspectionSummary.overallStatus}</div>
              <div className="text-[10px] text-[oklch(45%_0.008_70)] mt-0.5">Disposition</div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-6 border-t border-[oklch(18%_0.006_60)]">
            <div>
              <div className="flex items-center gap-1.5 label-caps mb-1.5">
                <Hash size={10} />
                Report Number
              </div>
              <div className="font-mono text-[12px] text-[oklch(95%_0.005_80)]">{report.reportNumber}</div>
            </div>
            <div>
              <div className="flex items-center gap-1.5 label-caps mb-1.5">
                {isManufacturing ? <Flame size={10} /> : <Plane size={10} />}
                {isManufacturing ? "Equipment" : "Aircraft"}
              </div>
              <div className="text-[12px] text-[oklch(95%_0.005_80)]">{aircraftInfo.manufacturer} {aircraftInfo.model}</div>
              <div className="font-mono text-[11px] text-[oklch(45%_0.008_70)]">{aircraftInfo.tailNumber}</div>
            </div>
            <div>
              <div className="flex items-center gap-1.5 label-caps mb-1.5">
                <User size={10} />
                Inspector
              </div>
              <div className="text-[12px] text-[oklch(95%_0.005_80)]">{inspectionSummary.inspectorName}</div>
            </div>
            <div>
              <div className="flex items-center gap-1.5 label-caps mb-1.5">
                <Clock size={10} />
                Generated
              </div>
              <div className="text-[12px] text-[oklch(95%_0.005_80)]">{new Date(reportMetadata.generatedAt).toLocaleString()}</div>
            </div>
          </div>
        </div>

        {/* ══ SUMMARY STATS ══ */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6 animate-fade-in-up delay-100">
          {[
            { label: "Total Steps", value: inspectionSummary.totalSteps, color: "text-[oklch(95%_0.005_80)]" },
            { label: "Completed", value: inspectionSummary.completedSteps, color: "text-[oklch(85%_0.06_75)]" },
            { label: "Passed", value: inspectionSummary.passedSteps, color: "text-[oklch(65%_0.15_155)]" },
            { label: "Failed", value: inspectionSummary.failedSteps, color: inspectionSummary.failedSteps > 0 ? "text-[oklch(62%_0.20_25)]" : "text-[oklch(50%_0.008_70)]" },
          ].map(({ label, value, color }) => (
            <div key={label} className="metric-card text-center">
              <div className={`text-[32px] font-bold leading-none tracking-tight ${color}`}>{value}</div>
              <div className="label-caps mt-2">{label}</div>
            </div>
          ))}
        </div>

        {/* ══ SAFETY FINDINGS ══ */}
        {safetyFindings.length > 0 && (
          <div className="glass-card p-6 mb-6 animate-fade-in-up delay-200">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle size={15} className="text-[oklch(85%_0.06_75)]" />
              <h2 className="font-semibold text-[16px] text-[oklch(95%_0.005_80)]">Safety Findings ({safetyFindings.length})</h2>
            </div>
            <div className="space-y-3">
              {safetyFindings.map((finding, i) => (
                <div key={i} className={`rounded-xl p-4 ${
                  finding.severity === "critical" ? "alert-critical" :
                  finding.severity === "warning" ? "alert-warning" : "alert-info"
                }`}>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wide ${
                          finding.severity === "critical" ? "bg-[oklch(62%_0.20_25/0.2)] text-[oklch(62%_0.20_25)]" :
                          finding.severity === "warning" ? "bg-[oklch(85%_0.06_75/0.2)] text-[oklch(85%_0.06_75)]" :
                          "bg-[oklch(60%_0.15_250/0.2)] text-[oklch(60%_0.15_250)]"
                        }`}>{finding.severity}</span>
                        <span className="text-[13px] font-semibold text-[oklch(95%_0.005_80)]">{finding.title}</span>
                      </div>
                      <p className="text-[12px] text-[oklch(70%_0.005_70)] leading-relaxed">{finding.message}</p>
                      {finding.actualValue && (
                        <div className="mt-2 flex items-center gap-3 text-[11px] font-mono">
                          <span className="text-[oklch(70%_0.005_70)]">Actual: <span className="font-semibold text-[oklch(95%_0.005_80)]">{finding.actualValue}</span></span>
                          <span className="text-[oklch(25%_0.006_60)]">|</span>
                          <span className="text-[oklch(70%_0.005_70)]">Expected: <span className="text-[oklch(85%_0.005_70)]">{finding.expectedRange}</span></span>
                        </div>
                      )}
                    </div>
                    <div className="text-[10px] text-right flex-shrink-0">
                      <div className={finding.acknowledged ? "text-[oklch(65%_0.15_155)]" : "text-[oklch(62%_0.20_25)]"}>
                        {finding.acknowledged ? "✓ Acknowledged" : "Unresolved"}
                      </div>
                      <div className="font-mono text-[oklch(35%_0.006_60)] mt-0.5">{new Date(finding.timestamp).toLocaleTimeString()}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ══ STEP DETAILS ══ */}
        <div className="glass-card p-6 mb-6 animate-fade-in-up delay-300">
          <div className="flex items-center gap-2 mb-6">
            <CheckCircle2 size={15} className="text-[oklch(85%_0.06_75)]" />
            <h2 className="font-semibold text-[16px] text-[oklch(95%_0.005_80)]">Inspection Step Details</h2>
          </div>
          <div className="space-y-6">
            {Object.entries(categoryGroups).map(([category, catSteps]) => (
              <div key={category}>
                <h3 className="label-caps mb-3 flex items-center gap-2">
                  <div className="h-px bg-[oklch(18%_0.006_60)] flex-1" />
                  {category}
                  <div className="h-px bg-[oklch(18%_0.006_60)] flex-1" />
                </h3>
                <div className="space-y-2">
                  {catSteps.map((step) => (
                    <div key={step.stepNumber} className="flex items-start gap-3 p-3.5 rounded-xl bg-[oklch(10%_0.005_60)] border border-[oklch(16%_0.006_60)]">
                      <div className="flex-shrink-0 mt-0.5">
                        {step.status === "passed" ? (
                          <CheckCircle2 size={14} className="text-[oklch(65%_0.15_155)]" />
                        ) : step.status === "failed" ? (
                          <XCircle size={14} className="text-[oklch(62%_0.20_25)]" />
                        ) : (
                          <div className="w-3.5 h-3.5 rounded-full border border-[oklch(25%_0.006_60)]" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-mono text-[10px] text-[oklch(40%_0.008_70)]">{step.stepNumber.toString().padStart(2, "0")}</span>
                          <span className="text-[12px] font-medium text-[oklch(95%_0.005_80)]">{step.stepName}</span>
                          {step.readingValue && (
                            <span className={`ml-auto text-[11px] font-mono px-2 py-0.5 rounded-full flex-shrink-0 ${
                              step.isInSpec ? "bg-[oklch(18%_0.03_155)] text-[oklch(65%_0.15_155)]" : "bg-[oklch(18%_0.04_25)] text-[oklch(62%_0.20_25)]"
                            }`}>{step.readingValue}</span>
                          )}
                        </div>
                        {step.workerInput && (
                          <p className="text-[11px] text-[oklch(45%_0.008_70)] italic">"{step.workerInput}"</p>
                        )}
                      </div>
                      <div className="text-[10px] text-[oklch(30%_0.006_60)] flex-shrink-0 font-mono">
                        {new Date(step.completedAt).toLocaleTimeString()}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ══ CERTIFICATION ══ */}
        <div className={`glass-card p-6 mb-6 animate-fade-in-up delay-400 ${isAirworthy ? "border-[oklch(50%_0.12_155/0.3)]" : "border-[oklch(50%_0.15_25/0.3)]"}`}>
          <div className="flex items-center gap-2 mb-4">
            <Shield size={15} className={isAirworthy ? "text-[oklch(65%_0.15_155)]" : "text-[oklch(62%_0.20_25)]"} />
            <h2 className="font-semibold text-[16px] text-[oklch(95%_0.005_80)]">Certification Statement</h2>
          </div>
          <p className={`text-[13px] leading-relaxed ${isAirworthy ? "text-[oklch(65%_0.15_155)]" : "text-[oklch(62%_0.20_25)]"}`}>
            {certificationStatement}
          </p>
          <div className="mt-6 pt-6 border-t border-[oklch(18%_0.006_60)] grid grid-cols-2 gap-8">
            <div>
              <div className="label-caps mb-2">Inspector Signature</div>
              <div className="h-10 border-b border-dashed border-[oklch(25%_0.006_60)] flex items-end pb-1">
                <span className="text-[12px] text-[oklch(30%_0.006_60)] italic">Digital signature pending</span>
              </div>
              <div className="text-[11px] text-[oklch(45%_0.008_70)] mt-1">{inspectionSummary.inspectorName}</div>
            </div>
            <div>
              <div className="label-caps mb-2">Date & Time</div>
              <div className="h-10 border-b border-dashed border-[oklch(25%_0.006_60)] flex items-end pb-1">
                <span className="text-[12px] text-[oklch(95%_0.005_80)]">{new Date(inspectionSummary.completionTime).toLocaleString()}</span>
              </div>
              <div className="text-[11px] text-[oklch(45%_0.008_70)] mt-1 font-mono">UTC {new Date(inspectionSummary.completionTime).toISOString()}</div>
            </div>
          </div>
        </div>

        {/* ══ FOOTER ══ */}
        <div className="text-center py-6 print:mt-8">
          <p className="text-[12px] text-[oklch(30%_0.006_60)]">
            Generated by <span className="text-[oklch(85%_0.06_75)] font-medium">Frontier Safety</span> — {reportMetadata.generatedBy}
          </p>
          <p className="text-[11px] text-[oklch(22%_0.006_60)] mt-1">
            This document is for demonstration purposes. Not for actual {isManufacturing ? "production" : "aircraft"} operations.
          </p>
        </div>
      </div>
    </div>
  );
}
