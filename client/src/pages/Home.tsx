import { trpc } from "@/lib/trpc";
import { useState, useMemo, useRef } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import {
  Mic, Shield, FileText, Activity, Plane, AlertTriangle,
  CheckCircle2, ArrowRight, Flame, Zap, Users, ChevronDown,
} from "lucide-react";

type Industry = "aviation" | "manufacturing";

const INDUSTRY_CONFIG = {
  aviation: {
    label: "Aviation",
    badge: "Pre-Flight AI",
    tagline: "Voice-driven aircraft inspections with real-time safety validation and automatic FAA compliance documentation.",
    icon: Plane,
    cardTitle: "Pre-Flight Walkthrough",
    cardSubtitle: "Voice-guided · FAA-validated",
    selectorLabel: "Select Aircraft",
    ctaLabel: "Begin Pre-Flight Inspection",
    reportType: "FAA Form 8130-3",
    compliance: "FAA 14 CFR Part 43",
  },
  manufacturing: {
    label: "Steel Mill",
    badge: "Manufacturing AI",
    tagline: "Precision EAF and Ladle Furnace pre-heat inspections with OSHA-compliant LOTO verification.",
    icon: Flame,
    cardTitle: "Pre-Heat Verification",
    cardSubtitle: "Voice-guided · LOTO-enforced",
    selectorLabel: "Select Equipment",
    ctaLabel: "Begin Pre-Heat Inspection",
    reportType: "OSHA 1910.147",
    compliance: "OSHA 29 CFR 1910.147",
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

  const quickDemoMutation = trpc.inspection.start.useMutation({
    onSuccess: (data) => navigate(`/inspection/${data.sessionId}?demo=true`),
    onError: () => { toast.error("Failed to start demo. Please try again."); setIsStarting(false); },
  });

  const handleQuickDemo = () => {
    const mfgEquipment = aircraftList?.filter((ac) => (ac as { industry?: string }).industry === "manufacturing");
    if (!mfgEquipment?.length) { toast.error("Equipment list not loaded yet — please wait a moment."); return; }
    setIsStarting(true);
    quickDemoMutation.mutate({ aircraftId: mfgEquipment[0].id, inspectorName: "Demo Inspector" });
  };

  // ── Mic Test ────────────────────────────────────────────────────────────────
  const [showMicTest, setShowMicTest] = useState(false);
  const [micTestState, setMicTestState] = useState<"idle" | "recording" | "processing" | "result" | "error">("idle");
  const [micTestResult, setMicTestResult] = useState("");
  const [micCountdown, setMicCountdown] = useState(3);
  const micChunksRef = useRef<Blob[]>([]);
  const micStreamRef = useRef<MediaStream | null>(null);
  const micCountdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const transcribeMic = trpc.voice.transcribe.useMutation({
    onSuccess: (data) => {
      setMicTestResult(data.text?.trim() || "(no speech detected)");
      setMicTestState("result");
    },
    onError: () => {
      setMicTestResult("Transcription failed — check your API key and try again.");
      setMicTestState("error");
    },
  });

  const handleMicTest = async () => {
    if (micTestState === "recording" || micTestState === "processing") return;
    setMicTestResult("");
    setMicCountdown(3);
    setMicTestState("recording");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;
      micChunksRef.current = [];
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "audio/mp4";
      const recorder = new MediaRecorder(stream, { mimeType });
      recorder.ondataavailable = (e) => { if (e.data.size > 0) micChunksRef.current.push(e.data); };
      recorder.onstop = () => {
        micStreamRef.current?.getTracks().forEach((t) => t.stop());
        const blob = new Blob(micChunksRef.current, { type: mimeType });
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = (reader.result as string).split(",")[1];
          setMicTestState("processing");
          transcribeMic.mutate({ audioBase64: base64, mimeType: mimeType.split(";")[0] });
        };
        reader.readAsDataURL(blob);
      };
      recorder.start();
      let remaining = 3;
      micCountdownRef.current = setInterval(() => {
        remaining -= 1;
        setMicCountdown(remaining);
        if (remaining <= 0) { if (micCountdownRef.current) clearInterval(micCountdownRef.current); }
      }, 1000);
      setTimeout(() => {
        if (micCountdownRef.current) clearInterval(micCountdownRef.current);
        recorder.stop();
      }, 3000);
    } catch (err: any) {
      setMicTestState("error");
      setMicTestResult(
        err.name === "NotAllowedError"
          ? "Microphone permission denied — allow mic access in browser settings."
          : `Error: ${err.message}`
      );
    }
  };

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
    <div className="min-h-screen bg-background" style={{ fontFamily: "var(--font-sans)" }}>

      {/* ══════════════════════════════════════════════════════════════════════
          NAV — minimal, confident
      ══════════════════════════════════════════════════════════════════════ */}
      <nav className="flex items-center justify-between px-8 lg:px-12 py-5 sticky top-0 z-50 backdrop-blur-xl border-b border-[oklch(14%_0.005_60)]" style={{ background: "oklch(8% 0.005 60 / 0.9)" }}>
        <div className="flex items-center gap-6">
          {/* Logo mark */}
          <div className="flex items-center gap-2.5">
            <div className="relative">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "oklch(85% 0.06 75)" }}>
                <Shield size={16} style={{ color: "oklch(8% 0.005 60)" }} />
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-[oklch(65%_0.15_155)] border-2 border-[oklch(8%_0.005_60)]" />
            </div>
            <div className="leading-none">
              <div className="text-[15px] font-semibold tracking-tight text-[oklch(95%_0.005_80)]">Frontier</div>
              <div className="text-[10px] font-medium text-[oklch(45%_0.008_70)] tracking-wide">SAFETY</div>
            </div>
          </div>

          {/* Industry toggle — inline pill */}
          <div className="hidden sm:flex items-center bg-[oklch(12%_0.005_60)] rounded-full p-0.5 border border-[oklch(16%_0.006_60)]">
            {(["aviation", "manufacturing"] as Industry[]).map((ind) => {
              const isActive = activeIndustry === ind;
              const IndIcon = ind === "aviation" ? Plane : Flame;
              return (
                <button
                  key={ind}
                  onClick={() => handleIndustrySwitch(ind)}
                  className={`flex items-center gap-1.5 px-4 py-1.5 text-[11px] font-semibold rounded-full transition-all ${
                    isActive
                      ? "bg-[oklch(85%_0.06_75)] text-[oklch(8%_0.005_60)]"
                      : "text-[oklch(45%_0.008_70)] hover:text-[oklch(70%_0.005_70)]"
                  }`}
                >
                  <IndIcon size={11} />
                  {ind === "aviation" ? "Aviation" : "Manufacturing"}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-4">
          <a href="/supervisor" className="hidden sm:flex items-center gap-1.5 text-[11px] font-medium text-[oklch(40%_0.008_70)] hover:text-[oklch(85%_0.06_75)] transition-colors">
            <Users size={12} />
            Supervisor
          </a>
          <div className="flex items-center gap-1.5 text-[11px] font-mono">
            <div className="w-1.5 h-1.5 rounded-full bg-[oklch(65%_0.15_155)] animate-pulse" />
            <span className="text-[oklch(65%_0.15_155)]">Online</span>
          </div>
        </div>
      </nav>

      {/* ══════════════════════════════════════════════════════════════════════
          HERO — one bold statement, no feature list clutter
      ══════════════════════════════════════════════════════════════════════ */}
      <section className="relative max-w-7xl mx-auto px-8 lg:px-12 pt-20 sm:pt-28 pb-20 grid lg:grid-cols-[1fr_420px] gap-16 xl:gap-24 items-start">

        <div className="hero-glow -top-48 left-0" />

        {/* Left: headline + proof points */}
        <div className="relative z-10">
          <div className="animate-fade-in-up">
            <div className="inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] mb-10 border" style={{ borderColor: "oklch(85% 0.06 75 / 0.15)", color: "oklch(85% 0.06 75)", background: "oklch(85% 0.06 75 / 0.04)" }}>
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "oklch(85% 0.06 75)" }} />
              {cfg.badge} · {cfg.compliance}
            </div>
          </div>

          <h1 className="animate-fade-in-up delay-100" style={{ fontFamily: "var(--font-display)", fontSize: "clamp(3rem, 7vw, 5.5rem)", fontWeight: 400, letterSpacing: "-0.03em", lineHeight: 1.0 }}>
            <span className="text-[oklch(95%_0.005_80)]">Safety.</span><br />
            <span className="text-[oklch(95%_0.005_80)]">Verified in</span><br />
            <span style={{ color: "oklch(85% 0.06 75)" }}>real time.</span>
          </h1>

          <p className="text-[15px] leading-relaxed mt-8 max-w-lg animate-fade-in-up delay-200" style={{ color: "oklch(50% 0.008 70)" }}>
            {cfg.tagline}
          </p>

          {/* Proof metrics — horizontal, not a grid of boxes */}
          <div className="flex items-center gap-8 mt-12 animate-fade-in-up delay-300">
            {[
              { value: "60%", label: "faster inspections" },
              { value: "0", label: "compliance errors" },
              { value: "<2s", label: "AI response time" },
            ].map(({ value, label }) => (
              <div key={label} className="flex items-baseline gap-2">
                <span className="text-[28px] font-bold tracking-tight text-[oklch(95%_0.005_80)]">{value}</span>
                <span className="text-[11px] text-[oklch(40%_0.008_70)]">{label}</span>
              </div>
            ))}
          </div>

          {/* Quick Demo — prominent, not buried */}
          <div className="flex items-center gap-4 mt-12 animate-fade-in-up delay-400">
            <button
              onClick={handleQuickDemo}
              disabled={isStarting || aircraftLoading || !aircraftList?.some((ac) => (ac as { industry?: string }).industry === "manufacturing")}
              className="flex items-center gap-2.5 px-6 py-3.5 rounded-xl text-[13px] font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90"
              style={{ background: "oklch(85% 0.06 75)", color: "oklch(8% 0.005 60)" }}
            >
              <Zap size={15} />
              Watch 2-Min Demo
            </button>
            <button
              onClick={() => { setShowMicTest((v) => !v); setMicTestState("idle"); setMicTestResult(""); }}
              className="flex items-center gap-2 px-5 py-3.5 rounded-xl text-[13px] font-semibold border border-[oklch(20%_0.006_60)] text-[oklch(60%_0.005_70)] hover:border-[oklch(35%_0.006_60)] hover:text-[oklch(85%_0.06_75)] transition-all"
            >
              <Mic size={14} />
              {showMicTest ? "Hide mic test" : "Test Microphone"}
            </button>
          </div>

          {/* Mic test — inline, not in a card */}
          {showMicTest && (
            <div className="mt-5 rounded-xl border border-[oklch(18%_0.006_60)] bg-[oklch(12%_0.008_60)] px-5 py-4 max-w-md animate-fade-in-up">
              <button
                onClick={handleMicTest}
                disabled={micTestState === "recording" || micTestState === "processing"}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-[12px] font-semibold transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                style={{ background: micTestState === "recording" ? "oklch(62% 0.20 25)" : "oklch(85% 0.06 75)", color: micTestState === "recording" ? "white" : "oklch(8% 0.005 60)" }}
              >
                {micTestState === "recording" ? (
                  <><div className="w-2.5 h-2.5 rounded-full bg-white animate-pulse" /> Recording… {micCountdown}s</>
                ) : micTestState === "processing" ? (
                  <><div className="w-4 h-4 border-2 border-black/20 border-t-black/60 rounded-full animate-spin" /> Processing…</>
                ) : (
                  <><Mic size={13} /> {micTestState === "result" || micTestState === "error" ? "Test Again (3 sec)" : "Record 3 Seconds"}</>
                )}
              </button>
              {micTestState === "result" && (
                <div className="flex items-start gap-2 mt-3 px-3 py-2.5 bg-[oklch(18%_0.03_155)] border border-[oklch(50%_0.12_155/0.3)] rounded-lg">
                  <CheckCircle2 size={12} className="text-[oklch(65%_0.15_155)] mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-[oklch(65%_0.15_155)]">Heard</p>
                    <p className="text-[12px] font-mono text-[oklch(85%_0.005_70)] mt-0.5">"{micTestResult}"</p>
                  </div>
                </div>
              )}
              {micTestState === "error" && (
                <div className="flex items-start gap-2 mt-3 px-3 py-2.5 bg-[oklch(18%_0.04_25)] border border-[oklch(50%_0.15_25/0.3)] rounded-lg">
                  <AlertTriangle size={12} className="text-[oklch(62%_0.20_25)] mt-0.5 flex-shrink-0" />
                  <p className="text-[12px] text-[oklch(82%_0.005_70)]">{micTestResult}</p>
                </div>
              )}
              {micTestState === "idle" && (
                <p className="text-[11px] text-center mt-2 text-[oklch(40%_0.008_70)]">Speak a reading — e.g. "Hydraulic pressure 3050 PSI"</p>
              )}
            </div>
          )}
        </div>

        {/* Right: Launch card — clean, premium */}
        <div className="lg:sticky lg:top-24 animate-fade-in-up delay-200">
          <div className="glass-card overflow-hidden">

            {/* Card header */}
            <div className="px-6 py-4 bg-[oklch(10%_0.005_60)] border-b border-[oklch(16%_0.006_60)]">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "oklch(85% 0.06 75 / 0.1)", border: "1px solid oklch(85% 0.06 75 / 0.15)" }}>
                  <IndustryIcon size={14} className="text-[oklch(85%_0.06_75)]" />
                </div>
                <div>
                  <div className="text-[oklch(95%_0.005_80)] font-semibold text-[14px]">{cfg.cardTitle}</div>
                  <div className="text-[oklch(45%_0.008_70)] text-[11px]">{cfg.cardSubtitle}</div>
                </div>
              </div>
            </div>

            <div className="px-6 py-5 space-y-4">
              {/* Inspector Name */}
              <div>
                <label className="block text-[10px] font-medium uppercase tracking-widest mb-1.5 text-[oklch(45%_0.008_70)]">
                  Inspector Name
                </label>
                <input
                  type="text"
                  value={inspectorName}
                  onChange={(e) => setInspectorName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleStart()}
                  placeholder="Enter your full name..."
                  className="w-full px-4 py-2.5 rounded-lg bg-[oklch(10%_0.005_60)] border border-[oklch(18%_0.006_60)] text-[13px] font-medium text-[oklch(95%_0.005_80)] placeholder:text-[oklch(30%_0.006_60)] outline-none focus:border-[oklch(85%_0.06_75)] focus:shadow-[0_0_0_3px_oklch(85%_0.06_75/0.08)] transition-all"
                />
              </div>

              {/* Equipment Selector */}
              <div>
                <label className="block text-[10px] font-medium uppercase tracking-widest mb-1.5 text-[oklch(45%_0.008_70)]">
                  {cfg.selectorLabel}
                </label>
                {aircraftLoading ? (
                  <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[oklch(10%_0.005_60)] border border-[oklch(18%_0.006_60)] text-[12px] text-[oklch(45%_0.008_70)]">
                    <div className="w-3.5 h-3.5 border-2 border-[oklch(18%_0.006_60)] border-t-[oklch(85%_0.06_75)] rounded-full animate-spin" />
                    Loading…
                  </div>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    {filteredAircraft.map((ac) => {
                      const selected = selectedAircraftId === ac.id;
                      const iconText = getEquipmentIcon(ac);
                      return (
                        <button
                          key={ac.id}
                          onClick={() => setSelectedAircraftId(ac.id)}
                          className={`flex items-center justify-between px-3.5 py-3 rounded-lg border text-left transition-all ${
                            selected
                              ? "border-[oklch(85%_0.06_75)] bg-[oklch(85%_0.06_75/0.06)]"
                              : "border-[oklch(18%_0.006_60)] bg-[oklch(10%_0.005_60)] hover:border-[oklch(30%_0.006_60)]"
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <div className={`w-9 h-8 rounded-md flex items-center justify-center text-[9px] font-bold ${selected ? "bg-[oklch(85%_0.06_75/0.15)] text-[oklch(85%_0.06_75)]" : "bg-[oklch(16%_0.006_60)] text-[oklch(45%_0.008_70)]"}`}>
                              {iconText}
                            </div>
                            <div>
                              <div className={`font-semibold text-[12px] ${selected ? "text-[oklch(85%_0.06_75)]" : "text-[oklch(95%_0.005_80)]"}`}>
                                {ac.manufacturer} {ac.model}
                              </div>
                              <div className={`font-mono text-[10px] ${selected ? "text-[oklch(85%_0.06_75/0.6)]" : "text-[oklch(45%_0.008_70)]"}`}>
                                {ac.tailNumber}
                              </div>
                            </div>
                          </div>
                          {selected ? (
                            <CheckCircle2 size={14} className="text-[oklch(85%_0.06_75)] flex-shrink-0" />
                          ) : (
                            <ArrowRight size={12} className="flex-shrink-0 text-[oklch(25%_0.006_60)]" />
                          )}
                        </button>
                      );
                    })}
                    {filteredAircraft.length === 0 && !aircraftLoading && (
                      <div className="px-4 py-2.5 rounded-lg bg-[oklch(10%_0.005_60)] border border-[oklch(18%_0.006_60)] text-[12px] text-center text-[oklch(45%_0.008_70)]">
                        No equipment found for this industry.
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* CTA */}
              <button
                onClick={handleStart}
                disabled={isStarting || !selectedAircraftId || !inspectorName.trim()}
                className="w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-semibold text-[13px] hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                style={{ background: "oklch(85% 0.06 75)", color: "oklch(8% 0.005 60)" }}
              >
                {isStarting ? (
                  <><div className="w-4 h-4 border-2 border-black/20 border-t-black/60 rounded-full animate-spin" /> Initializing…</>
                ) : (
                  <>{cfg.ctaLabel} <ArrowRight size={15} /></>
                )}
              </button>
            </div>
          </div>

          {/* Trust text */}
          <p className="text-center text-[10px] mt-3 text-[oklch(25%_0.006_60)]">
            Simulated data · Voice-powered · {cfg.compliance}
          </p>
        </div>
      </section>

      {/* Scroll indicator */}
      <div className="flex justify-center pb-8 animate-fade-in-up delay-500">
        <ChevronDown size={18} className="text-[oklch(25%_0.006_60)] animate-bounce" />
      </div>

      <div className="divider-glow" />

      {/* ══════════════════════════════════════════════════════════════════════
          CAPABILITIES — replaces the old feature bullet list
      ══════════════════════════════════════════════════════════════════════ */}
      <section className="py-24 px-8 lg:px-12" style={{ background: "oklch(10% 0.005 60)" }}>
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4 mb-16">
            <div>
              <div className="label-caps mb-3">What it does</div>
              <h2 className="display-lg text-[oklch(95%_0.005_80)]">
                Every inspection,<br />end to end.
              </h2>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-px bg-[oklch(16%_0.006_60)] rounded-2xl overflow-hidden">
            {[
              { icon: Mic, title: "Voice Input", desc: "Speak your readings hands-free. Whisper AI converts speech to structured data with industry-specific vocabulary.", accent: false },
              { icon: Shield, title: "Safety Validation", desc: "Every reading checked against equipment specs in real-time. Out-of-spec values trigger severity-graded alerts instantly.", accent: true },
              { icon: AlertTriangle, title: "Critical Alerts", desc: "Visual and audio alerts by severity — critical, warning, info. Nothing gets missed, nothing gets ignored.", accent: false },
              { icon: FileText, title: "Compliance Reports", desc: `Auto-generate ${activeIndustry === "aviation" ? "FAA Form 8130-3" : "OSHA 1910.147 LOTO"} documentation. Print-ready, timestamped, inspector-signed.`, accent: false },
            ].map(({ icon: Icon, title, desc, accent }) => (
              <div
                key={title}
                className="p-7 relative"
                style={{ background: accent ? "oklch(14% 0.01 75)" : "oklch(12% 0.008 60)" }}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-5 ${accent ? "bg-[oklch(85%_0.06_75/0.15)]" : "bg-[oklch(16%_0.006_60)]"}`}>
                  <Icon size={18} className={accent ? "text-[oklch(85%_0.06_75)]" : "text-[oklch(60%_0.005_70)]"} />
                </div>
                <h3 className="font-semibold text-[15px] mb-2 text-[oklch(95%_0.005_80)]">{title}</h3>
                <p className="text-[12px] leading-relaxed text-[oklch(45%_0.008_70)]">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="divider-glow" />

      {/* ══════════════════════════════════════════════════════════════════════
          HOW IT WORKS — 3 steps, bolder design
      ══════════════════════════════════════════════════════════════════════ */}
      <section className="py-24 px-8 lg:px-12" style={{ background: "oklch(8% 0.005 60)" }}>
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <div className="label-caps mb-3">Process</div>
            <h2 className="display-lg text-[oklch(95%_0.005_80)]">Three steps. Zero paperwork.</h2>
          </div>

          <div className="grid sm:grid-cols-3 gap-6">
            {(activeIndustry === "aviation" ? [
              { step: "01", icon: Plane, title: "Select Aircraft", desc: "Choose from Boeing 737-800 or Airbus A320 with real manufacturer specs pre-loaded." },
              { step: "02", icon: Mic, title: "Voice Walkthrough", desc: "Speak your readings. AI validates against specs in real-time and guides your next step." },
              { step: "03", icon: FileText, title: "Generate Report", desc: "Instantly generate FAA Form 8130-3 with airworthiness disposition and certification." },
            ] : [
              { step: "01", icon: Flame, title: "Select Equipment", desc: "Choose Nucor EAF Unit 1 or Ladle Refining Furnace with real Nucor specs loaded." },
              { step: "02", icon: Mic, title: "Voice Walkthrough", desc: "Speak your readings. AI validates against Nucor specs, enforces LOTO, guides each step." },
              { step: "03", icon: FileText, title: "Generate Report", desc: "Instantly generate an OSHA 1910.147 LOTO verification cleared for production." },
            ]).map(({ step, icon: Icon, title, desc }) => (
              <div key={step} className="relative overflow-hidden rounded-2xl border border-[oklch(16%_0.006_60)] p-8" style={{ background: "oklch(12% 0.008 60)" }}>
                <div className="ghost-number">{step}</div>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-5 bg-[oklch(14%_0.005_60)] border border-[oklch(18%_0.006_60)]">
                  <Icon size={18} className="text-[oklch(85%_0.06_75)]" />
                </div>
                <h3 className="font-semibold text-[17px] mb-2.5 tracking-tight text-[oklch(95%_0.005_80)]">{title}</h3>
                <p className="text-[13px] leading-relaxed text-[oklch(45%_0.008_70)]">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="divider-glow" />

      {/* ══════════════════════════════════════════════════════════════════════
          INDUSTRIES — compact, no cards grid
      ══════════════════════════════════════════════════════════════════════ */}
      <section className="py-16 px-8 lg:px-12" style={{ background: "oklch(10% 0.005 60)" }}>
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
          <div>
            <div className="label-caps mb-2">Industries</div>
            <div className="text-[22px] font-semibold tracking-tight text-[oklch(95%_0.005_80)]" style={{ fontFamily: "var(--font-display)" }}>Aviation & Steel Manufacturing</div>
          </div>
          <div className="flex items-center gap-6 text-[12px] text-[oklch(45%_0.008_70)]">
            <span className="flex items-center gap-1.5"><Plane size={13} className="text-[oklch(85%_0.06_75)]" /> Boeing · Airbus · FAA</span>
            <span className="text-[oklch(18%_0.006_60)]">|</span>
            <span className="flex items-center gap-1.5"><Flame size={13} className="text-[oklch(85%_0.06_75)]" /> Nucor Steel · OSHA</span>
            <span className="text-[oklch(18%_0.006_60)]">|</span>
            <span className="flex items-center gap-1.5"><Activity size={13} className="text-[oklch(85%_0.06_75)]" /> Expanding</span>
          </div>
        </div>
      </section>

      {/* ══ FOOTER ══ */}
      <footer className="py-6 px-8 text-center border-t border-[oklch(12%_0.005_60)]" style={{ background: "oklch(6% 0.005 60)" }}>
        <p className="text-[11px] text-[oklch(25%_0.006_60)]">
          <span className="text-[oklch(85%_0.06_75)] font-medium">Frontier Safety</span> — AI-powered inspection workflows
          <span className="mx-2">·</span>
          Demonstration build
        </p>
      </footer>
    </div>
  );
}
