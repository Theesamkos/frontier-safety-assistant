import { trpc } from "@/lib/trpc";
import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import {
  Mic, Shield, FileText, Activity, Plane, AlertTriangle,
  CheckCircle2, ArrowRight, Flame, Zap, Users,
} from "lucide-react";

type Industry = "aviation" | "manufacturing";

const INDUSTRY_CONFIG = {
  aviation: {
    label: "Aviation",
    badge: "Aviation Pre-Flight AI",
    tagline: "Real-time AI guidance for aircraft pre-flight inspections. Voice-driven, safety-validated, FAA-compliant. Built for the ramp — not the boardroom.",
    accentColor: "oklch(52% 0.24 25)",
    icon: Plane,
    features: [
      { icon: Mic, label: "Hold SPACE to speak your readings" },
      { icon: Shield, label: "Real-time safety validation against Boeing/Airbus specs" },
      { icon: AlertTriangle, label: "Critical alerts with visual severity indicators" },
      { icon: FileText, label: "Auto-generate FAA Form 8130-3 compliance reports" },
      { icon: Activity, label: "Live metrics: completion, safety checks, time saved" },
    ],
    stats: [
      { n: "20", l: "Steps" },
      { n: "<2s", l: "AI Response" },
      { n: "100%", l: "Spec Coverage" },
      { n: "Auto", l: "FAA Report" },
    ],
    cardTitle: "Launch Inspection",
    cardSubtitle: "Select aircraft and begin pre-flight walkthrough",
    selectorLabel: "Select Aircraft",
    ctaLabel: "Begin Pre-Flight Inspection",
    reportType: "FAA Form 8130-3",
  },
  manufacturing: {
    label: "Steel Mill",
    badge: "Nucor Steel Manufacturing AI",
    tagline: "Real-time AI guidance for EAF and Ladle Furnace pre-heat inspections. OSHA-compliant, voice-driven, safety-validated. Built for the mill floor — not the office.",
    accentColor: "oklch(62% 0.22 50)",
    icon: Flame,
    features: [
      { icon: Mic, label: "Hold SPACE to speak your readings" },
      { icon: Shield, label: "Real-time validation against Nucor EAF/Ladle specs" },
      { icon: AlertTriangle, label: "LOTO verification and critical safety alerts" },
      { icon: FileText, label: "Auto-generate OSHA 1910.147 LOTO compliance reports" },
      { icon: Activity, label: "Live metrics: heat number, temp, pressure, flow rates" },
    ],
    stats: [
      { n: "20", l: "Steps" },
      { n: "<2s", l: "AI Response" },
      { n: "OSHA", l: "Compliant" },
      { n: "Auto", l: "LOTO Report" },
    ],
    cardTitle: "Launch Inspection",
    cardSubtitle: "Select equipment and begin pre-heat walkthrough",
    selectorLabel: "Select Equipment",
    ctaLabel: "Begin Pre-Heat Inspection",
    reportType: "OSHA 1910.147",
  },
};

export default function Home() {
  const [, navigate] = useLocation();
  const [selectedAircraftId, setSelectedAircraftId] = useState<number | null>(null);
  const [inspectorName, setInspectorName] = useState("");
  const [isStarting, setIsStarting] = useState(false);
  const [activeIndustry, setActiveIndustry] = useState<Industry>("aviation");

  const { data: aircraftList, isLoading: aircraftLoading } = trpc.aircraft.list.useQuery();

  const filteredAircraft = useMemo(() => {
    return aircraftList?.filter((ac) => (ac as { industry?: string }).industry === activeIndustry) ?? [];
  }, [aircraftList, activeIndustry]);

  const startInspection = trpc.inspection.start.useMutation({
    onSuccess: (data) => navigate(`/inspection/${data.sessionId}`),
    onError: () => { toast.error("Failed to start inspection. Please try again."); setIsStarting(false); },
  });

  const handleStart = () => {
    if (!selectedAircraftId) { toast.error(`Please select ${activeIndustry === "aviation" ? "an aircraft" : "equipment"} to inspect.`); return; }
    if (!inspectorName.trim()) { toast.error("Please enter your name as the inspector."); return; }
    setIsStarting(true);
    startInspection.mutate({ aircraftId: selectedAircraftId, inspectorName: inspectorName.trim() });
  };

  const handleIndustrySwitch = (industry: Industry) => {
    setActiveIndustry(industry);
    setSelectedAircraftId(null);
  };

  const cfg = INDUSTRY_CONFIG[activeIndustry];
  const IndustryIcon = cfg.icon;

  const getEquipmentIcon = (ac: { manufacturer: string; model: string }) => {
    if (ac.manufacturer === "Boeing") return "B7";
    if (ac.manufacturer === "Airbus") return "A3";
    if (ac.model.includes("Electric Arc")) return "EAF";
    if (ac.model.includes("Ladle")) return "LRF";
    return ac.manufacturer.slice(0, 2).toUpperCase();
  };

  return (
    <div className="min-h-screen" style={{ background: "oklch(97% 0.006 80)", fontFamily: "'Bricolage Grotesque', 'Inter', sans-serif" }}>

      {/* ══ NAV ══ */}
      <nav className="flex items-center justify-between px-8 py-4 bg-[oklch(12%_0.015_250)] sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-white rounded-md flex items-center justify-center">
            <span className="text-[oklch(12%_0.015_250)] text-[10px] font-black">SF</span>
          </div>
          <span className="text-white font-black text-[15px] tracking-tight">SafetyFirst</span>
          <span className="text-[10px] font-mono bg-white/10 border border-white/15 rounded-full px-2.5 py-0.5 text-white/60">v1.0</span>
        </div>
        <div className="flex items-center gap-4">
          <a
            href="/supervisor"
            className="hidden sm:flex items-center gap-1.5 text-[11px] font-semibold text-white/60 hover:text-white transition-colors"
          >
            <Users size={13} />
            Supervisor Dashboard
          </a>
          <span className="text-white/20 hidden sm:block">|</span>
          <span className="text-[12px] text-white/50 hidden sm:block">Powered by Frontier Audio AI</span>
          <div className="flex items-center gap-1.5 text-[11px] font-mono">
            <div className="w-1.5 h-1.5 rounded-full bg-[oklch(55%_0.2_145)] animate-pulse" />
            <span className="text-[oklch(55%_0.2_145)]">System Online</span>
          </div>
        </div>
      </nav>

      {/* ══ INDUSTRY TABS ══ */}
      <div className="border-b border-[oklch(88%_0.01_80)] bg-white">
        <div className="max-w-7xl mx-auto px-8">
          <div className="flex gap-0">
            {(["aviation", "manufacturing"] as Industry[]).map((ind) => {
              const isActive = activeIndustry === ind;
              const IndIcon = ind === "aviation" ? Plane : Flame;
              return (
                <button
                  key={ind}
                  onClick={() => handleIndustrySwitch(ind)}
                  className={`flex items-center gap-2.5 px-6 py-4 text-[13px] font-bold border-b-2 transition-all ${
                    isActive
                      ? "border-[oklch(12%_0.015_250)] text-[oklch(12%_0.015_250)]"
                      : "border-transparent text-[oklch(55%_0.012_250)] hover:text-[oklch(30%_0.015_250)]"
                  }`}
                >
                  <IndIcon size={15} />
                  {ind === "aviation" ? "Aviation · Delta / Boeing" : "Manufacturing · Nucor Steel"}
                  {isActive && (
                    <span className="ml-1 text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full" style={{ background: "oklch(12% 0.015 250)", color: "white" }}>
                      Active
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ══ HERO ══ */}
      <section className="max-w-7xl mx-auto px-8 pt-16 pb-16 grid lg:grid-cols-2 gap-16 items-start">

        {/* Left: Copy */}
        <div>
          <div
            className="inline-flex items-center gap-2 text-white rounded-full px-4 py-2 text-[11px] font-bold uppercase tracking-widest mb-8"
            style={{ background: "oklch(12% 0.015 250)" }}
          >
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: cfg.accentColor }} />
            {cfg.badge}
          </div>

          <h1 className="font-black leading-[0.92] tracking-[-0.04em] mb-8" style={{ fontSize: "clamp(52px, 7vw, 88px)", color: "oklch(12% 0.015 250)" }}>
            Make<br />
            Frontline<br />
            Workers<br />
            <span style={{ color: cfg.accentColor }}>Superhuman.</span>
          </h1>

          <p className="text-[16px] leading-relaxed mb-10 max-w-md" style={{ color: "oklch(40% 0.012 250)" }}>
            {cfg.tagline}
          </p>

          {/* Feature list */}
          <div className="flex flex-col gap-3">
            {cfg.features.map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0" style={{ background: "oklch(12% 0.015 250)" }}>
                  <Icon size={13} className="text-white" />
                </div>
                <span className="text-[13px]" style={{ color: "oklch(30% 0.015 250)" }}>{label}</span>
              </div>
            ))}
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-4 gap-4 mt-12 pt-10 border-t border-[oklch(88%_0.01_80)]">
            {cfg.stats.map(({ n, l }) => (
              <div key={l}>
                <div className="text-[28px] font-black leading-none tracking-tight" style={{ color: "oklch(12% 0.015 250)" }}>{n}</div>
                <div className="text-[10px] font-bold uppercase tracking-widest mt-1" style={{ color: "oklch(68% 0.01 250)" }}>{l}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Launch card */}
        <div className="lg:sticky lg:top-24">
          <div className="bg-white border border-[oklch(88%_0.01_80)] rounded-2xl overflow-hidden shadow-[0_4px_40px_oklch(12%_0.015_250/0.08)]">

            {/* Card header */}
            <div className="px-7 py-5" style={{ background: "oklch(12% 0.015 250)" }}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-white/10 border border-white/15 rounded-xl flex items-center justify-center">
                  <IndustryIcon size={16} className="text-white" />
                </div>
                <div>
                  <div className="text-white font-bold text-[15px]">{cfg.cardTitle}</div>
                  <div className="text-white/50 text-[11px] mt-0.5">{cfg.cardSubtitle}</div>
                </div>
              </div>
            </div>

            <div className="px-7 py-6 space-y-5">
              {/* Inspector Name */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: "oklch(50% 0.012 250)" }}>
                  Inspector Name
                </label>
                <input
                  type="text"
                  value={inspectorName}
                  onChange={(e) => setInspectorName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleStart()}
                  placeholder="Enter your full name..."
                  className="w-full px-4 py-3 rounded-xl bg-[oklch(97%_0.006_80)] border-[1.5px] border-[oklch(88%_0.01_80)] text-[14px] font-medium text-[oklch(12%_0.015_250)] placeholder:text-[oklch(68%_0.01_250)] outline-none focus:border-[oklch(12%_0.015_250)] focus:shadow-[0_0_0_3px_oklch(12%_0.015_250/0.07)] transition-all"
                />
              </div>

              {/* Equipment Selector */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: "oklch(50% 0.012 250)" }}>
                  {cfg.selectorLabel}
                </label>
                {aircraftLoading ? (
                  <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-[oklch(97%_0.006_80)] border border-[oklch(88%_0.01_80)] text-[13px]" style={{ color: "oklch(50% 0.012 250)" }}>
                    <div className="w-4 h-4 border-2 border-[oklch(88%_0.01_80)] border-t-[oklch(12%_0.015_250)] rounded-full animate-spin" />
                    Loading equipment…
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {filteredAircraft.map((ac) => {
                      const selected = selectedAircraftId === ac.id;
                      const iconText = getEquipmentIcon(ac);
                      return (
                        <button
                          key={ac.id}
                          onClick={() => setSelectedAircraftId(ac.id)}
                          className={`flex items-center justify-between px-4 py-3.5 rounded-xl border-[1.5px] text-left transition-all ${
                            selected
                              ? "border-[oklch(12%_0.015_250)] bg-[oklch(12%_0.015_250)]"
                              : "border-[oklch(88%_0.01_80)] bg-[oklch(97%_0.006_80)] hover:border-[oklch(75%_0.01_80)]"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-9 rounded-lg flex items-center justify-center text-[9px] font-black ${selected ? "bg-white/15 text-white" : "bg-[oklch(88%_0.01_80)] text-[oklch(30%_0.015_250)]"}`}>
                              {iconText}
                            </div>
                            <div>
                              <div className={`font-bold text-[13px] ${selected ? "text-white" : "text-[oklch(12%_0.015_250)]"}`}>
                                {ac.manufacturer} {ac.model}
                              </div>
                              <div className={`font-mono text-[11px] mt-0.5 ${selected ? "text-white/60" : "text-[oklch(50%_0.012_250)]"}`}>
                                {ac.tailNumber}
                              </div>
                            </div>
                          </div>
                          {selected ? (
                            <CheckCircle2 size={16} className="text-white flex-shrink-0" />
                          ) : (
                            <ArrowRight size={14} className="flex-shrink-0" style={{ color: "oklch(68% 0.01 250)" }} />
                          )}
                        </button>
                      );
                    })}
                    {filteredAircraft.length === 0 && !aircraftLoading && (
                      <div className="px-4 py-3 rounded-xl bg-[oklch(97%_0.006_80)] border border-[oklch(88%_0.01_80)] text-[13px] text-center" style={{ color: "oklch(55% 0.012 250)" }}>
                        No equipment found for this industry.
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Voice hint */}
              <div className="flex items-center gap-2.5 px-4 py-3 bg-[oklch(97%_0.006_80)] border border-[oklch(88%_0.01_80)] rounded-xl">
                <div className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0" style={{ background: "oklch(12% 0.015 250)" }}>
                  <Mic size={11} className="text-white" />
                </div>
                <p className="text-[11px]" style={{ color: "oklch(40% 0.012 250)" }}>
                  <span className="font-bold text-[oklch(12%_0.015_250)]">Hold SPACE</span> to speak your readings during inspection. Works on desktop and tablet.
                </p>
              </div>

              {/* CTA */}
              <button
                onClick={handleStart}
                disabled={isStarting || !selectedAircraftId || !inspectorName.trim()}
                className="w-full flex items-center justify-center gap-2.5 px-6 py-4 rounded-xl text-white font-bold text-[14px] hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                style={{ background: cfg.accentColor }}
              >
                {isStarting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Initializing Inspection…
                  </>
                ) : (
                  <>
                    <Mic size={16} />
                    {cfg.ctaLabel}
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Trust note */}
          <p className="text-center text-[11px] mt-4" style={{ color: "oklch(60% 0.01 250)" }}>
            Simulated data · Built for <span className="font-semibold text-[oklch(12%_0.015_250)]">Frontier Audio</span> interview demo
          </p>
        </div>
      </section>

      {/* ══ HOW IT WORKS ══ */}
      <section className="border-t border-[oklch(88%_0.01_80)] bg-white py-20 px-8">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-end justify-between mb-12">
            <h2 className="font-black text-[36px] leading-tight tracking-tight" style={{ color: "oklch(12% 0.015 250)" }}>
              How It<br />Works
            </h2>
            <p className="text-[13px] max-w-xs text-right" style={{ color: "oklch(50% 0.012 250)" }}>
              {activeIndustry === "aviation"
                ? "Three steps from aircraft selection to FAA-compliant documentation"
                : "Three steps from equipment selection to OSHA-compliant documentation"}
            </p>
          </div>
          <div className="grid sm:grid-cols-3 gap-6">
            {(activeIndustry === "aviation" ? [
              { step: "01", icon: Plane, title: "Select Aircraft", desc: "Choose from Boeing 737-800 or Airbus A320 with real manufacturer specs pre-loaded — hydraulic pressure, tire PSI, oil levels, brake temps.", accent: "oklch(52% 0.24 25)" },
              { step: "02", icon: Mic, title: "Voice Walkthrough", desc: "Hold SPACE to speak your readings. AI validates against specs in real-time, triggers safety alerts, and guides your next step proactively.", accent: "oklch(68% 0.17 65)" },
              { step: "03", icon: FileText, title: "Generate Report", desc: "Complete the inspection and instantly generate an FAA Form 8130-3 compliant document with airworthiness disposition and certification.", accent: "oklch(55% 0.2 145)" },
            ] : [
              { step: "01", icon: Flame, title: "Select Equipment", desc: "Choose from Nucor EAF Unit 1 or Ladle Refining Furnace with real Nucor specs — operating temps, cooling water pressure, hydraulic systems.", accent: "oklch(62% 0.22 50)" },
              { step: "02", icon: Mic, title: "Voice Walkthrough", desc: "Hold SPACE to speak your readings. AI validates against Nucor specs in real-time, enforces LOTO procedures, and guides each step.", accent: "oklch(68% 0.17 65)" },
              { step: "03", icon: FileText, title: "Generate Report", desc: "Complete the inspection and instantly generate an OSHA 1910.147 LOTO verification document cleared for production operations.", accent: "oklch(55% 0.2 145)" },
            ]).map(({ step, icon: Icon, title, desc, accent }) => (
              <div key={step} className="relative overflow-hidden rounded-2xl border border-[oklch(88%_0.01_80)] p-7" style={{ background: "oklch(97% 0.006 80)" }}>
                <div className="absolute top-5 right-5 text-[64px] font-black leading-none select-none" style={{ color: `${accent}15` }}>{step}</div>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-5" style={{ background: `${accent}15`, border: `1.5px solid ${accent}30` }}>
                  <Icon size={18} style={{ color: accent }} />
                </div>
                <h3 className="font-black text-[18px] mb-3 tracking-tight" style={{ color: "oklch(12% 0.015 250)" }}>{title}</h3>
                <p className="text-[13px] leading-relaxed" style={{ color: "oklch(40% 0.012 250)" }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ INDUSTRIES BANNER ══ */}
      <section className="border-t border-[oklch(88%_0.01_80)] py-14 px-8" style={{ background: "oklch(12% 0.015 250)" }}>
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-8">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-2">Industries Served</div>
            <div className="text-white font-black text-[24px] tracking-tight">Aviation & Steel Manufacturing</div>
            <div className="text-white/50 text-[13px] mt-1">Delta Airlines · Nucor Steel · Boeing · Airbus</div>
          </div>
          <div className="flex gap-6">
            <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl px-5 py-4">
              <Plane size={20} className="text-white/70" />
              <div>
                <div className="text-white font-bold text-[13px]">Aviation</div>
                <div className="text-white/40 text-[11px]">FAA 14 CFR Part 43</div>
              </div>
            </div>
            <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl px-5 py-4">
              <Flame size={20} className="text-white/70" />
              <div>
                <div className="text-white font-bold text-[13px]">Steel Mill</div>
                <div className="text-white/40 text-[11px]">OSHA 29 CFR 1910.147</div>
              </div>
            </div>
            <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl px-5 py-4">
              <Zap size={20} className="text-white/70" />
              <div>
                <div className="text-white font-bold text-[13px]">Expanding</div>
                <div className="text-white/40 text-[11px]">Oil & Gas, Mining</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══ FOOTER ══ */}
      <footer className="bg-[oklch(8%_0.015_250)] py-8 px-8 text-center">
        <p className="text-[12px] text-white/40">
          Built for <span className="text-white/70 font-semibold">Frontier Audio</span> — Making Frontline Workers Superhuman
          <span className="mx-3 text-white/20">·</span>
          Simulated data for demonstration purposes
        </p>
      </footer>
    </div>
  );
}
