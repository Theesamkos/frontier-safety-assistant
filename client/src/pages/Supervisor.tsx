import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import {
  Activity, AlertTriangle, CheckCircle2, Clock, Flame, Plane,
  RefreshCw, Shield, Users, XCircle, ArrowLeft, Eye, Download, TrendingUp,
} from "lucide-react";

type InspectionRow = {
  id: number;
  sessionId: string;
  aircraftId: number;
  inspectorName: string;
  status: string;
  totalSteps: number | null;
  completedSteps: number | null;
  safetyChecksPassed: number | null;
  safetyChecksFailed: number | null;
  startedAt: Date | null;
  completedAt: Date | null;
  tailNumber: string | null;
  model: string | null;
  manufacturer: string | null;
};

function getIndustryFromModel(model: string | null): "aviation" | "manufacturing" {
  if (!model) return "aviation";
  const lower = model.toLowerCase();
  if (lower.includes("furnace") || lower.includes("ladle") || lower.includes("eaf")) return "manufacturing";
  return "aviation";
}

function formatDuration(start: Date | null, end: Date | null): string {
  if (!start) return "—";
  const s = new Date(start);
  const e = end ? new Date(end) : new Date();
  const diffMs = e.getTime() - s.getTime();
  const mins = Math.floor(diffMs / 60000);
  const secs = Math.floor((diffMs % 60000) / 1000);
  if (mins >= 60) return `${Math.floor(mins / 60)}h ${mins % 60}m`;
  return `${mins}m ${secs}s`;
}

function formatTime(dt: Date | null): string {
  if (!dt) return "—";
  return new Date(dt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function StatusBadge({ status, failed }: { status: string; failed: number | null }) {
  const hasCritical = (failed ?? 0) > 0;
  if (status === "completed") {
    return hasCritical
      ? <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-[oklch(18%_0.03_65)] text-[oklch(85%_0.06_75)] border border-[oklch(60%_0.10_65/0.3)]"><XCircle size={10} /> COMPLETED W/ FINDINGS</span>
      : <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-[oklch(18%_0.03_155)] text-[oklch(65%_0.15_155)] border border-[oklch(50%_0.12_155/0.3)]"><CheckCircle2 size={10} /> CLEARED</span>;
  }
  if (status === "in_progress") {
    return hasCritical
      ? <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-[oklch(18%_0.04_25)] text-[oklch(62%_0.20_25)] border border-[oklch(50%_0.15_25/0.3)] animate-pulse"><AlertTriangle size={10} /> ACTIVE · ALERTS</span>
      : <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-[oklch(18%_0.025_250)] text-[oklch(60%_0.15_250)] border border-[oklch(50%_0.15_250/0.3)]"><Activity size={10} /> IN PROGRESS</span>;
  }
  return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-[oklch(18%_0.008_60)] text-[oklch(50%_0.008_70)] border border-[oklch(18%_0.006_60)]">{status.toUpperCase()}</span>;
}

export default function Supervisor() {
  const [, navigate] = useLocation();
  const { data: inspections, isLoading, refetch, dataUpdatedAt } = trpc.inspection.listActive.useQuery(undefined, {
    refetchInterval: 10000, // auto-refresh every 10 seconds
  });

  const activeInspections = (inspections as InspectionRow[] | undefined)?.filter(i => i.status === "in_progress") ?? [];
  const completedToday = (inspections as InspectionRow[] | undefined)?.filter(i => i.status === "completed") ?? [];
  const totalAlerts = (inspections as InspectionRow[] | undefined)?.reduce((sum, i) => sum + (i.safetyChecksFailed ?? 0), 0) ?? 0;
  const totalPassed = (inspections as InspectionRow[] | undefined)?.reduce((sum, i) => sum + (i.safetyChecksPassed ?? 0), 0) ?? 0;

  const lastRefresh = dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "—";

  // Computed: avg completion time
  const avgCompletionMs = completedToday.length > 0
    ? completedToday.reduce((sum, i) => {
        if (!i.startedAt || !i.completedAt) return sum;
        return sum + (new Date(i.completedAt).getTime() - new Date(i.startedAt).getTime());
      }, 0) / completedToday.length
    : 0;
  const avgMin = Math.floor(avgCompletionMs / 60000);
  const avgSec = Math.floor((avgCompletionMs % 60000) / 1000);
  const avgTimeStr = avgCompletionMs > 0 ? `${avgMin}m ${avgSec}s` : "—";

  // Computed: inspector performance (inspections per inspector)
  const inspectorMap = new Map<string, { count: number; alerts: number; passed: number }>();
  (inspections as InspectionRow[] | undefined)?.forEach(i => {
    const existing = inspectorMap.get(i.inspectorName) ?? { count: 0, alerts: 0, passed: 0 };
    existing.count++;
    existing.alerts += i.safetyChecksFailed ?? 0;
    existing.passed += i.safetyChecksPassed ?? 0;
    inspectorMap.set(i.inspectorName, existing);
  });
  const inspectorStats = Array.from(inspectorMap.entries()).map(([name, stats]) => ({ name, ...stats })).sort((a, b) => b.count - a.count);

  // CSV export
  const handleExportCSV = () => {
    if (!inspections || (inspections as InspectionRow[]).length === 0) return;
    const rows = (inspections as InspectionRow[]).map(i => [
      getIndustryFromModel(i.model),
      i.tailNumber ?? "",
      `${i.manufacturer ?? ""} ${i.model ?? ""}`,
      i.inspectorName,
      i.status,
      `${i.completedSteps ?? 0}/${i.totalSteps ?? 0}`,
      `${i.safetyChecksPassed ?? 0}`,
      `${i.safetyChecksFailed ?? 0}`,
      formatDuration(i.startedAt, i.completedAt),
      i.startedAt ? new Date(i.startedAt).toISOString() : "",
      i.completedAt ? new Date(i.completedAt).toISOString() : "",
    ]);
    const header = ["Industry","Tail Number","Equipment","Inspector","Status","Progress","Passed","Alerts","Duration","Started","Completed"];
    const csv = [header, ...rows].map(r => r.map(c => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `frontier-inspections-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen" style={{ background: "oklch(8% 0.005 60)", fontFamily: "'Inter', system-ui, sans-serif" }}>

      {/* ══ NAV ══ */}
      <nav className="flex items-center justify-between px-8 py-4 border-b border-[oklch(16%_0.006_60)] sticky top-0 z-50 backdrop-blur-xl" style={{ background: "oklch(8% 0.005 60 / 0.85)" }}>
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-1.5 text-[oklch(45%_0.008_70)] hover:text-[oklch(80%_0.005_70)] text-[12px] transition-colors"
          >
            <ArrowLeft size={14} />
            Back
          </button>
          <div className="w-px h-4 bg-[oklch(18%_0.006_60)]" />
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-[oklch(85%_0.06_75)] rounded-lg flex items-center justify-center">
              <span className="text-[oklch(8%_0.005_60)] text-[10px] font-bold">SF</span>
            </div>
            <span className="text-[oklch(95%_0.005_80)] font-medium text-[14px] tracking-wide">Frontier Safety</span>
            <span className="text-[10px] font-mono bg-[oklch(14%_0.005_60)] border border-[oklch(18%_0.006_60)] rounded-full px-2.5 py-0.5 text-[oklch(40%_0.008_70)]">Supervisor</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={handleExportCSV}
            disabled={!inspections || (inspections as InspectionRow[]).length === 0}
            className="flex items-center gap-1.5 text-[oklch(45%_0.008_70)] hover:text-[oklch(80%_0.005_70)] text-[11px] transition-colors disabled:opacity-40"
          >
            <Download size={12} />
            Export CSV
          </button>
          <button
            onClick={() => refetch()}
            className="flex items-center gap-1.5 text-[oklch(45%_0.008_70)] hover:text-[oklch(80%_0.005_70)] text-[11px] transition-colors"
          >
            <RefreshCw size={12} />
            Refresh
          </button>
          <div className="text-[11px] text-[oklch(30%_0.006_60)] font-mono">Last: {lastRefresh}</div>
          <div className="flex items-center gap-1.5 text-[11px] font-mono">
            <div className="w-1.5 h-1.5 rounded-full bg-[oklch(65%_0.15_155)] animate-pulse" />
            <span className="text-[oklch(65%_0.15_155)]">Live</span>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-8 py-10">

        {/* ══ HEADER ══ */}
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-2">
            <Users size={22} className="text-[oklch(85%_0.06_75)]" />
            <h1 className="font-semibold text-[32px] tracking-tight" style={{ fontFamily: "'DM Serif Display', Georgia, serif", color: "oklch(95% 0.005 80)" }}>
              Supervisor Dashboard
            </h1>
          </div>
          <p className="text-[14px]" style={{ color: "oklch(50% 0.008 70)" }}>
            Real-time monitoring of all active and recent inspections — Aviation & Steel Manufacturing
          </p>
        </div>

        {/* ══ STATS ROW ══ */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10">
          {[
            { label: "Active Inspections", value: activeInspections.length.toString(), icon: Activity, color: "oklch(60% 0.15 250)", bg: "oklch(17% 0.02 250)" },
            { label: "Completed Today", value: completedToday.length.toString(), icon: CheckCircle2, color: "oklch(65% 0.15 155)", bg: "oklch(17% 0.02 155)" },
            { label: "Safety Alerts", value: totalAlerts.toString(), icon: AlertTriangle, color: totalAlerts > 0 ? "oklch(62% 0.20 25)" : "oklch(50% 0.008 70)", bg: totalAlerts > 0 ? "oklch(17% 0.03 25)" : "oklch(12% 0.008 60)" },
            { label: "Steps Passed", value: totalPassed.toString(), icon: Shield, color: "oklch(65% 0.15 155)", bg: "oklch(17% 0.02 155)" },
          ].map(({ label, value, icon: Icon, color, bg }) => (
            <div key={label} className="rounded-2xl border border-[oklch(18%_0.006_60)] p-5" style={{ background: bg }}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-medium uppercase tracking-widest" style={{ color: "oklch(50% 0.008 70)" }}>{label}</span>
                <Icon size={15} style={{ color }} />
              </div>
              <div className="text-[36px] font-bold leading-none tracking-tight" style={{ color: "oklch(95% 0.005 80)" }}>{value}</div>
            </div>
          ))}
        </div>

        {/* ══ INSPECTOR PERFORMANCE & INSIGHTS ══ */}
        {inspectorStats.length > 0 && (
          <div className="grid sm:grid-cols-2 gap-4 mb-10">
            {/* Inspector Performance */}
            <div className="rounded-2xl border border-[oklch(18%_0.006_60)] p-5" style={{ background: "oklch(12% 0.008 60)" }}>
              <div className="flex items-center gap-2 mb-4">
                <Users size={14} className="text-[oklch(85%_0.06_75)]" />
                <h3 className="font-semibold text-[14px] text-[oklch(95%_0.005_80)]">Inspector Performance</h3>
              </div>
              <div className="space-y-2.5">
                {inspectorStats.slice(0, 5).map((insp) => (
                  <div key={insp.name} className="flex items-center justify-between py-2 border-b border-[oklch(16%_0.006_60)] last:border-b-0">
                    <div>
                      <div className="text-[13px] font-medium text-[oklch(95%_0.005_80)]">{insp.name}</div>
                      <div className="text-[11px] text-[oklch(45%_0.008_70)]">
                        {insp.count} inspection{insp.count !== 1 ? "s" : ""} · {insp.passed} passed · {insp.alerts} alert{insp.alerts !== 1 ? "s" : ""}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-12 h-1.5 rounded-full overflow-hidden" style={{ background: "oklch(16% 0.006 60)" }}>
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${insp.passed + insp.alerts > 0 ? Math.round((insp.passed / (insp.passed + insp.alerts)) * 100) : 100}%`,
                            background: insp.alerts > 0 ? "oklch(85% 0.06 75)" : "oklch(65% 0.15 155)",
                          }}
                        />
                      </div>
                      <span className="text-[10px] font-mono text-[oklch(50%_0.008_70)]">
                        {insp.passed + insp.alerts > 0 ? Math.round((insp.passed / (insp.passed + insp.alerts)) * 100) : 100}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Operational Insights */}
            <div className="rounded-2xl border border-[oklch(18%_0.006_60)] p-5" style={{ background: "oklch(12% 0.008 60)" }}>
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp size={14} className="text-[oklch(85%_0.06_75)]" />
                <h3 className="font-semibold text-[14px] text-[oklch(95%_0.005_80)]">Operational Insights</h3>
              </div>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="label-caps">Avg Completion Time</span>
                  <span className="font-mono text-[16px] font-bold text-[oklch(95%_0.005_80)]">{avgTimeStr}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="label-caps">Pass Rate</span>
                  <span className="font-mono text-[16px] font-bold text-[oklch(65%_0.15_155)]">
                    {totalPassed + totalAlerts > 0 ? Math.round((totalPassed / (totalPassed + totalAlerts)) * 100) : 100}%
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="label-caps">Alert Rate</span>
                  <span className={`font-mono text-[16px] font-bold ${totalAlerts > 0 ? "text-[oklch(62%_0.20_25)]" : "text-[oklch(50%_0.008_70)]"}`}>
                    {totalPassed + totalAlerts > 0 ? Math.round((totalAlerts / (totalPassed + totalAlerts)) * 100) : 0}%
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="label-caps">Total Inspections</span>
                  <span className="font-mono text-[16px] font-bold text-[oklch(95%_0.005_80)]">{(inspections as InspectionRow[] | undefined)?.length ?? 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="label-caps">Industries</span>
                  <div className="flex gap-1.5">
                    {(inspections as InspectionRow[] | undefined)?.some(i => getIndustryFromModel(i.model) === "aviation") && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[oklch(85%_0.06_75)] bg-[oklch(18%_0.02_75)] border border-[oklch(60%_0.10_75/0.3)] rounded-full px-2 py-0.5">
                        <Plane size={9} /> Aviation
                      </span>
                    )}
                    {(inspections as InspectionRow[] | undefined)?.some(i => getIndustryFromModel(i.model) === "manufacturing") && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[oklch(85%_0.06_75)] bg-[oklch(18%_0.02_75)] border border-[oklch(60%_0.10_75/0.3)] rounded-full px-2 py-0.5">
                        <Flame size={9} /> Steel
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ══ ACTIVE INSPECTIONS ══ */}
        {activeInspections.length > 0 && (
          <div className="mb-10">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-2 h-2 rounded-full bg-[oklch(60%_0.15_250)] animate-pulse" />
              <h2 className="font-semibold text-[18px] tracking-tight" style={{ color: "oklch(95% 0.005 80)" }}>
                Active Inspections
              </h2>
              <span className="text-[11px] font-bold text-[oklch(60%_0.15_250)] bg-[oklch(18%_0.025_250)] border border-[oklch(50%_0.15_250/0.3)] rounded-full px-2 py-0.5">{activeInspections.length}</span>
            </div>
            <div className="grid gap-3">
              {activeInspections.map((insp) => {
                const industry = getIndustryFromModel(insp.model);
                const progress = insp.totalSteps ? Math.round(((insp.completedSteps ?? 0) / insp.totalSteps) * 100) : 0;
                return (
                  <div key={insp.id} className="bg-[oklch(12%_0.008_60)] border border-[oklch(18%_0.006_60)] rounded-2xl p-5">
                    <div className="flex items-start justify-between gap-4 mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "oklch(85% 0.06 75 / 0.1)", border: "1px solid oklch(85% 0.06 75 / 0.2)" }}>
                          {industry === "manufacturing"
                            ? <Flame size={18} className="text-[oklch(85%_0.06_75)]" />
                            : <Plane size={18} className="text-[oklch(85%_0.06_75)]" />}
                        </div>
                        <div>
                          <div className="font-semibold text-[15px] text-[oklch(95%_0.005_80)]">
                            {insp.manufacturer} {insp.model}
                          </div>
                          <div className="font-mono text-[11px] mt-0.5" style={{ color: "oklch(45% 0.008 70)" }}>
                            {insp.tailNumber} · Inspector: {insp.inspectorName}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <StatusBadge status={insp.status} failed={insp.safetyChecksFailed} />
                        <button
                          onClick={() => navigate(`/inspection/${insp.sessionId}`)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold border border-[oklch(18%_0.006_60)] text-[oklch(70%_0.005_70)] hover:border-[oklch(85%_0.06_75)] hover:text-[oklch(85%_0.06_75)] transition-all"
                        >
                          <Eye size={11} />
                          View
                        </button>
                      </div>
                    </div>
                    {/* Progress bar */}
                    <div className="mb-3">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] font-medium uppercase tracking-widest" style={{ color: "oklch(50% 0.008 70)" }}>Progress</span>
                        <span className="text-[11px] font-semibold" style={{ color: "oklch(95% 0.005 80)" }}>{insp.completedSteps ?? 0} / {insp.totalSteps ?? 0} steps</span>
                      </div>
                      <div className="h-2 rounded-full overflow-hidden" style={{ background: "oklch(16% 0.006 60)" }}>
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${progress}%`,
                            background: (insp.safetyChecksFailed ?? 0) > 0 ? "oklch(62% 0.20 25)" : "oklch(65% 0.15 155)",
                          }}
                        />
                      </div>
                    </div>
                    {/* Metrics */}
                    <div className="flex items-center gap-5 text-[11px]">
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 size={12} className="text-[oklch(65%_0.15_155)]" />
                        <span style={{ color: "oklch(60% 0.01 70)" }}>{insp.safetyChecksPassed ?? 0} passed</span>
                      </div>
                      {(insp.safetyChecksFailed ?? 0) > 0 && (
                        <div className="flex items-center gap-1.5">
                          <AlertTriangle size={12} className="text-[oklch(62%_0.20_25)]" />
                          <span className="font-bold text-[oklch(62%_0.20_25)]">{insp.safetyChecksFailed} alerts</span>
                        </div>
                      )}
                      <div className="flex items-center gap-1.5">
                        <Clock size={12} style={{ color: "oklch(45% 0.008 70)" }} />
                        <span style={{ color: "oklch(50% 0.008 70)" }}>Started {formatTime(insp.startedAt)} · {formatDuration(insp.startedAt, null)} elapsed</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ══ COMPLETED INSPECTIONS ══ */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <h2 className="font-semibold text-[18px] tracking-tight" style={{ color: "oklch(95% 0.005 80)" }}>
              Recent Inspections
            </h2>
            <span className="text-[11px] font-bold text-[oklch(50%_0.008_70)] bg-[oklch(18%_0.008_60)] border border-[oklch(18%_0.006_60)] rounded-full px-2 py-0.5">{(inspections as InspectionRow[] | undefined)?.length ?? 0} total</span>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-16 gap-3" style={{ color: "oklch(50% 0.008 70)" }}>
              <div className="w-5 h-5 border-2 border-[oklch(18%_0.006_60)] border-t-[oklch(85%_0.06_75)] rounded-full animate-spin" />
              Loading inspections…
            </div>
          ) : !inspections || (inspections as InspectionRow[]).length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4" style={{ background: "oklch(12% 0.008 60)" }}>
                <Users size={24} style={{ color: "oklch(50% 0.008 70)" }} />
              </div>
              <div className="font-semibold text-[16px] mb-2" style={{ color: "oklch(95% 0.005 80)" }}>No inspections yet</div>
              <div className="text-[13px] mb-6" style={{ color: "oklch(50% 0.008 70)" }}>
                Start an inspection from the home page to see it appear here.
              </div>
              <button
                onClick={() => navigate("/")}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-semibold transition-all hover:opacity-90"
                style={{ background: "oklch(85% 0.06 75)", color: "oklch(8% 0.005 60)" }}
              >
                <Plane size={14} />
                Start an Inspection
              </button>
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-[oklch(18%_0.006_60)] bg-[oklch(12%_0.008_60)]">
              <table className="w-full text-[13px]">
                <thead>
                  <tr style={{ background: "oklch(14% 0.005 60)", borderBottom: "1px solid oklch(16% 0.006 60)" }}>
                    {["Industry", "Equipment", "Inspector", "Progress", "Alerts", "Duration", "Status", ""].map((h) => (
                      <th key={h} className="px-5 py-3.5 text-left text-[10px] font-medium uppercase tracking-widest" style={{ color: "oklch(50% 0.008 70)" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(inspections as InspectionRow[]).map((insp, idx) => {
                    const industry = getIndustryFromModel(insp.model);
                    const progress = insp.totalSteps ? Math.round(((insp.completedSteps ?? 0) / insp.totalSteps) * 100) : 0;
                    return (
                      <tr
                        key={insp.id}
                        className="transition-colors hover:bg-[oklch(14%_0.008_60)]"
                        style={{ borderBottom: idx < (inspections as InspectionRow[]).length - 1 ? "1px solid oklch(16% 0.006 60)" : "none" }}
                      >
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            {industry === "manufacturing"
                              ? <Flame size={13} className="text-[oklch(85%_0.06_75)]" />
                              : <Plane size={13} className="text-[oklch(85%_0.06_75)]" />}
                            <span className="font-semibold text-[11px] uppercase tracking-wide text-[oklch(85%_0.06_75)]">
                              {industry === "manufacturing" ? "Steel" : "Aviation"}
                            </span>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <div className="font-semibold text-[oklch(95%_0.005_80)]">{insp.model}</div>
                          <div className="font-mono text-[11px] mt-0.5" style={{ color: "oklch(45% 0.008 70)" }}>{insp.tailNumber}</div>
                        </td>
                        <td className="px-5 py-4" style={{ color: "oklch(70% 0.01 70)" }}>{insp.inspectorName}</td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ background: "oklch(16% 0.006 60)" }}>
                              <div className="h-full rounded-full" style={{ width: `${progress}%`, background: (insp.safetyChecksFailed ?? 0) > 0 ? "oklch(62% 0.20 25)" : "oklch(65% 0.15 155)" }} />
                            </div>
                            <span className="text-[11px] font-semibold" style={{ color: "oklch(85% 0.01 70)" }}>{progress}%</span>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          {(insp.safetyChecksFailed ?? 0) > 0
                            ? <span className="font-bold text-[oklch(62%_0.20_25)]">{insp.safetyChecksFailed} ⚠</span>
                            : <span style={{ color: "oklch(35% 0.006 60)" }}>—</span>}
                        </td>
                        <td className="px-5 py-4 font-mono text-[11px]" style={{ color: "oklch(50% 0.008 70)" }}>
                          {formatDuration(insp.startedAt, insp.completedAt)}
                        </td>
                        <td className="px-5 py-4">
                          <StatusBadge status={insp.status} failed={insp.safetyChecksFailed} />
                        </td>
                        <td className="px-5 py-4">
                          <button
                            onClick={() => navigate(`/inspection/${insp.sessionId}`)}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-semibold border border-[oklch(18%_0.006_60)] text-[oklch(70%_0.005_70)] hover:border-[oklch(85%_0.06_75)] hover:text-[oklch(85%_0.06_75)] transition-all"
                          >
                            <Eye size={10} />
                            View
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ══ FOOTER ══ */}
      <footer className="mt-16 bg-[oklch(6%_0.005_60)] py-6 px-8 text-center border-t border-[oklch(12%_0.005_60)]">
        <p className="text-[12px] text-[oklch(30%_0.006_60)]">
          Frontier Safety Supervisor · Auto-refreshes every 10 seconds · Built for <span className="text-[oklch(85%_0.06_75)] font-medium">Frontier Audio</span>
        </p>
      </footer>
    </div>
  );
}
