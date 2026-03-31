import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import {
  Activity, AlertTriangle, CheckCircle2, Clock, Flame, Plane,
  RefreshCw, Shield, Users, XCircle, ArrowLeft, Eye,
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
      ? <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200"><XCircle size={10} /> COMPLETED W/ FINDINGS</span>
      : <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200"><CheckCircle2 size={10} /> CLEARED</span>;
  }
  if (status === "in_progress") {
    return hasCritical
      ? <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-red-50 text-red-700 border border-red-200 animate-pulse"><AlertTriangle size={10} /> ACTIVE · ALERTS</span>
      : <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200"><Activity size={10} /> IN PROGRESS</span>;
  }
  return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-gray-100 text-gray-600 border border-gray-200">{status.toUpperCase()}</span>;
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

  return (
    <div className="min-h-screen" style={{ background: "oklch(97% 0.006 80)", fontFamily: "'Bricolage Grotesque', 'Inter', sans-serif" }}>

      {/* ══ NAV ══ */}
      <nav className="flex items-center justify-between px-8 py-4 bg-[oklch(12%_0.015_250)] sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-1.5 text-white/60 hover:text-white text-[12px] transition-colors"
          >
            <ArrowLeft size={14} />
            Back
          </button>
          <div className="w-px h-4 bg-white/20" />
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-white rounded-md flex items-center justify-center">
              <span className="text-[oklch(12%_0.015_250)] text-[10px] font-black">SF</span>
            </div>
            <span className="text-white font-black text-[15px] tracking-tight">SafetyFirst</span>
            <span className="text-[10px] font-mono bg-white/10 border border-white/15 rounded-full px-2.5 py-0.5 text-white/60">Supervisor</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => refetch()}
            className="flex items-center gap-1.5 text-white/60 hover:text-white text-[11px] transition-colors"
          >
            <RefreshCw size={12} />
            Refresh
          </button>
          <div className="text-[11px] text-white/40 font-mono">Last: {lastRefresh}</div>
          <div className="flex items-center gap-1.5 text-[11px] font-mono">
            <div className="w-1.5 h-1.5 rounded-full bg-[oklch(55%_0.2_145)] animate-pulse" />
            <span className="text-[oklch(55%_0.2_145)]">Live</span>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-8 py-10">

        {/* ══ HEADER ══ */}
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-2">
            <Users size={22} style={{ color: "oklch(12% 0.015 250)" }} />
            <h1 className="font-black text-[32px] tracking-tight" style={{ color: "oklch(12% 0.015 250)" }}>
              Supervisor Dashboard
            </h1>
          </div>
          <p className="text-[14px]" style={{ color: "oklch(50% 0.012 250)" }}>
            Real-time monitoring of all active and recent inspections — Aviation & Steel Manufacturing
          </p>
        </div>

        {/* ══ STATS ROW ══ */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10">
          {[
            { label: "Active Inspections", value: activeInspections.length.toString(), icon: Activity, color: "oklch(52% 0.22 250)", bg: "oklch(95% 0.02 250)" },
            { label: "Completed Today", value: completedToday.length.toString(), icon: CheckCircle2, color: "oklch(50% 0.2 145)", bg: "oklch(95% 0.02 145)" },
            { label: "Safety Alerts", value: totalAlerts.toString(), icon: AlertTriangle, color: totalAlerts > 0 ? "oklch(52% 0.24 25)" : "oklch(50% 0.01 250)", bg: totalAlerts > 0 ? "oklch(96% 0.02 25)" : "oklch(97% 0.006 80)" },
            { label: "Steps Passed", value: totalPassed.toString(), icon: Shield, color: "oklch(55% 0.2 145)", bg: "oklch(95% 0.02 145)" },
          ].map(({ label, value, icon: Icon, color, bg }) => (
            <div key={label} className="rounded-2xl border border-[oklch(88%_0.01_80)] p-5" style={{ background: bg }}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "oklch(55% 0.012 250)" }}>{label}</span>
                <Icon size={15} style={{ color }} />
              </div>
              <div className="text-[36px] font-black leading-none tracking-tight" style={{ color: "oklch(12% 0.015 250)" }}>{value}</div>
            </div>
          ))}
        </div>

        {/* ══ ACTIVE INSPECTIONS ══ */}
        {activeInspections.length > 0 && (
          <div className="mb-10">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
              <h2 className="font-black text-[18px] tracking-tight" style={{ color: "oklch(12% 0.015 250)" }}>
                Active Inspections
              </h2>
              <span className="text-[11px] font-bold text-blue-600 bg-blue-50 border border-blue-200 rounded-full px-2 py-0.5">{activeInspections.length}</span>
            </div>
            <div className="grid gap-3">
              {activeInspections.map((insp) => {
                const industry = getIndustryFromModel(insp.model);
                const progress = insp.totalSteps ? Math.round(((insp.completedSteps ?? 0) / insp.totalSteps) * 100) : 0;
                return (
                  <div key={insp.id} className="bg-white border border-[oklch(88%_0.01_80)] rounded-2xl p-5 shadow-[0_2px_16px_oklch(12%_0.015_250/0.05)]">
                    <div className="flex items-start justify-between gap-4 mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: industry === "manufacturing" ? "oklch(95% 0.03 50)" : "oklch(95% 0.02 250)" }}>
                          {industry === "manufacturing"
                            ? <Flame size={18} style={{ color: "oklch(62% 0.22 50)" }} />
                            : <Plane size={18} style={{ color: "oklch(52% 0.22 250)" }} />}
                        </div>
                        <div>
                          <div className="font-bold text-[15px]" style={{ color: "oklch(12% 0.015 250)" }}>
                            {insp.manufacturer} {insp.model}
                          </div>
                          <div className="font-mono text-[11px] mt-0.5" style={{ color: "oklch(55% 0.012 250)" }}>
                            {insp.tailNumber} · Inspector: {insp.inspectorName}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <StatusBadge status={insp.status} failed={insp.safetyChecksFailed} />
                        <button
                          onClick={() => navigate(`/inspection/${insp.sessionId}`)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold border border-[oklch(88%_0.01_80)] hover:border-[oklch(12%_0.015_250)] hover:bg-[oklch(12%_0.015_250)] hover:text-white transition-all"
                          style={{ color: "oklch(30% 0.015 250)" }}
                        >
                          <Eye size={11} />
                          View
                        </button>
                      </div>
                    </div>
                    {/* Progress bar */}
                    <div className="mb-3">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "oklch(55% 0.012 250)" }}>Progress</span>
                        <span className="text-[11px] font-bold" style={{ color: "oklch(12% 0.015 250)" }}>{insp.completedSteps ?? 0} / {insp.totalSteps ?? 0} steps</span>
                      </div>
                      <div className="h-2 rounded-full overflow-hidden" style={{ background: "oklch(92% 0.008 80)" }}>
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${progress}%`,
                            background: (insp.safetyChecksFailed ?? 0) > 0 ? "oklch(52% 0.24 25)" : "oklch(50% 0.2 145)",
                          }}
                        />
                      </div>
                    </div>
                    {/* Metrics */}
                    <div className="flex items-center gap-5 text-[11px]">
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 size={12} style={{ color: "oklch(50% 0.2 145)" }} />
                        <span style={{ color: "oklch(40% 0.012 250)" }}>{insp.safetyChecksPassed ?? 0} passed</span>
                      </div>
                      {(insp.safetyChecksFailed ?? 0) > 0 && (
                        <div className="flex items-center gap-1.5">
                          <AlertTriangle size={12} style={{ color: "oklch(52% 0.24 25)" }} />
                          <span className="font-bold" style={{ color: "oklch(52% 0.24 25)" }}>{insp.safetyChecksFailed} alerts</span>
                        </div>
                      )}
                      <div className="flex items-center gap-1.5">
                        <Clock size={12} style={{ color: "oklch(55% 0.012 250)" }} />
                        <span style={{ color: "oklch(40% 0.012 250)" }}>Started {formatTime(insp.startedAt)} · {formatDuration(insp.startedAt, null)} elapsed</span>
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
            <h2 className="font-black text-[18px] tracking-tight" style={{ color: "oklch(12% 0.015 250)" }}>
              Recent Inspections
            </h2>
            <span className="text-[11px] font-bold text-gray-600 bg-gray-100 border border-gray-200 rounded-full px-2 py-0.5">{(inspections as InspectionRow[] | undefined)?.length ?? 0} total</span>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-16 gap-3" style={{ color: "oklch(55% 0.012 250)" }}>
              <div className="w-5 h-5 border-2 border-[oklch(88%_0.01_80)] border-t-[oklch(12%_0.015_250)] rounded-full animate-spin" />
              Loading inspections…
            </div>
          ) : !inspections || (inspections as InspectionRow[]).length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4" style={{ background: "oklch(93% 0.008 80)" }}>
                <Users size={24} style={{ color: "oklch(55% 0.012 250)" }} />
              </div>
              <div className="font-bold text-[16px] mb-2" style={{ color: "oklch(30% 0.015 250)" }}>No inspections yet</div>
              <div className="text-[13px] mb-6" style={{ color: "oklch(55% 0.012 250)" }}>
                Start an inspection from the home page to see it appear here.
              </div>
              <button
                onClick={() => navigate("/")}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-bold text-white transition-all hover:opacity-90"
                style={{ background: "oklch(12% 0.015 250)" }}
              >
                <Plane size={14} />
                Start an Inspection
              </button>
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-[oklch(88%_0.01_80)] bg-white">
              <table className="w-full text-[13px]">
                <thead>
                  <tr style={{ background: "oklch(97% 0.006 80)", borderBottom: "1px solid oklch(88% 0.01 80)" }}>
                    {["Industry", "Equipment", "Inspector", "Progress", "Alerts", "Duration", "Status", ""].map((h) => (
                      <th key={h} className="px-5 py-3.5 text-left text-[10px] font-bold uppercase tracking-widest" style={{ color: "oklch(55% 0.012 250)" }}>{h}</th>
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
                        className="transition-colors hover:bg-[oklch(97%_0.006_80)]"
                        style={{ borderBottom: idx < (inspections as InspectionRow[]).length - 1 ? "1px solid oklch(92% 0.008 80)" : "none" }}
                      >
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            {industry === "manufacturing"
                              ? <Flame size={13} style={{ color: "oklch(62% 0.22 50)" }} />
                              : <Plane size={13} style={{ color: "oklch(52% 0.22 250)" }} />}
                            <span className="font-bold text-[11px] uppercase tracking-wide" style={{ color: industry === "manufacturing" ? "oklch(62% 0.22 50)" : "oklch(52% 0.22 250)" }}>
                              {industry === "manufacturing" ? "Steel" : "Aviation"}
                            </span>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <div className="font-bold" style={{ color: "oklch(12% 0.015 250)" }}>{insp.model}</div>
                          <div className="font-mono text-[11px] mt-0.5" style={{ color: "oklch(55% 0.012 250)" }}>{insp.tailNumber}</div>
                        </td>
                        <td className="px-5 py-4" style={{ color: "oklch(30% 0.015 250)" }}>{insp.inspectorName}</td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ background: "oklch(92% 0.008 80)" }}>
                              <div className="h-full rounded-full" style={{ width: `${progress}%`, background: (insp.safetyChecksFailed ?? 0) > 0 ? "oklch(52% 0.24 25)" : "oklch(50% 0.2 145)" }} />
                            </div>
                            <span className="text-[11px] font-bold" style={{ color: "oklch(30% 0.015 250)" }}>{progress}%</span>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          {(insp.safetyChecksFailed ?? 0) > 0
                            ? <span className="font-bold text-[oklch(52%_0.24_25)]">{insp.safetyChecksFailed} ⚠</span>
                            : <span style={{ color: "oklch(55% 0.012 250)" }}>—</span>}
                        </td>
                        <td className="px-5 py-4 font-mono text-[11px]" style={{ color: "oklch(40% 0.012 250)" }}>
                          {formatDuration(insp.startedAt, insp.completedAt)}
                        </td>
                        <td className="px-5 py-4">
                          <StatusBadge status={insp.status} failed={insp.safetyChecksFailed} />
                        </td>
                        <td className="px-5 py-4">
                          <button
                            onClick={() => navigate(`/inspection/${insp.sessionId}`)}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-bold border border-[oklch(88%_0.01_80)] hover:border-[oklch(12%_0.015_250)] hover:bg-[oklch(12%_0.015_250)] hover:text-white transition-all"
                            style={{ color: "oklch(30% 0.015 250)" }}
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
      <footer className="mt-16 bg-[oklch(8%_0.015_250)] py-6 px-8 text-center">
        <p className="text-[12px] text-white/40">
          SafetyFirst Supervisor Dashboard · Auto-refreshes every 10 seconds · Built for <span className="text-white/70 font-semibold">Frontier Audio</span>
        </p>
      </footer>
    </div>
  );
}
