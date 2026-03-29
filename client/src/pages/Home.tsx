import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { Mic, Shield, FileText, Activity, ChevronRight, Plane, AlertTriangle, CheckCircle2, Zap } from "lucide-react";

export default function Home() {
  const [, navigate] = useLocation();
  const [selectedAircraftId, setSelectedAircraftId] = useState<number | null>(null);
  const [inspectorName, setInspectorName] = useState("");
  const [isStarting, setIsStarting] = useState(false);

  const { data: aircraftList, isLoading: aircraftLoading } = trpc.aircraft.list.useQuery();

  const startInspection = trpc.inspection.start.useMutation({
    onSuccess: (data) => {
      navigate(`/inspection/${data.sessionId}`);
    },
    onError: () => {
      toast.error("Failed to start inspection. Please try again.");
      setIsStarting(false);
    },
  });

  const handleStart = () => {
    if (!selectedAircraftId) {
      toast.error("Please select an aircraft to inspect.");
      return;
    }
    if (!inspectorName.trim()) {
      toast.error("Please enter your name as the inspector.");
      return;
    }
    setIsStarting(true);
    startInspection.mutate({ aircraftId: selectedAircraftId, inspectorName: inspectorName.trim() });
  };

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      {/* Background grid */}
      <div className="fixed inset-0 pointer-events-none" style={{
        backgroundImage: `radial-gradient(circle at 50% 0%, oklch(0.65 0.22 250 / 0.06) 0%, transparent 60%),
          linear-gradient(oklch(0.22 0.02 250 / 0.3) 1px, transparent 1px),
          linear-gradient(90deg, oklch(0.22 0.02 250 / 0.3) 1px, transparent 1px)`,
        backgroundSize: "100% 100%, 60px 60px, 60px 60px",
      }} />

      {/* Nav */}
      <nav className="relative z-10 flex items-center justify-between px-6 py-4 border-b border-border/50">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center">
            <Shield className="w-4 h-4 text-primary" />
          </div>
          <span className="font-semibold text-foreground tracking-tight">SafetyFirst</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/25 font-mono">v1.0</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground hidden sm:block">Powered by Frontier Audio AI</span>
          <div className="flex items-center gap-1.5 text-xs text-emerald-400">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            System Online
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative z-10 max-w-6xl mx-auto px-6 pt-20 pb-16">
        <div className="flex flex-col items-center text-center">
          {/* Badge */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-primary/30 bg-primary/10 text-primary text-xs font-medium mb-8">
            <Zap className="w-3 h-3" />
            AI-Powered Pre-Flight Inspection System
          </div>

          {/* Headline */}
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-none mb-6">
            <span className="text-foreground">Make Frontline</span>
            <br />
            <span className="gradient-text">Workers Superhuman</span>
          </h1>

          <p className="text-lg text-muted-foreground max-w-2xl mb-12 leading-relaxed">
            Real-time AI guidance for aircraft pre-flight inspections. Voice-driven, safety-validated, FAA-compliant. Built for the ramp — not the boardroom.
          </p>

          {/* Feature pills */}
          <div className="flex flex-wrap justify-center gap-3 mb-16">
            {[
              { icon: Mic, label: "Voice Command Interface" },
              { icon: Shield, label: "Real-Time Safety Validation" },
              { icon: AlertTriangle, label: "Proactive Alert System" },
              { icon: FileText, label: "FAA Compliance Reports" },
              { icon: Activity, label: "Live Metrics Dashboard" },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-card border border-border text-sm text-muted-foreground">
                <Icon className="w-3.5 h-3.5 text-primary" />
                {label}
              </div>
            ))}
          </div>
        </div>

        {/* Inspection Launcher Card */}
        <div className="max-w-2xl mx-auto">
          <div className="glass-card p-8 glow-blue">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center">
                <Plane className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h2 className="font-semibold text-foreground">Launch Inspection</h2>
                <p className="text-xs text-muted-foreground">Select aircraft and begin pre-flight walkthrough</p>
              </div>
            </div>

            <div className="space-y-4">
              {/* Inspector Name */}
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wider">Inspector Name</label>
                <input
                  type="text"
                  value={inspectorName}
                  onChange={(e) => setInspectorName(e.target.value)}
                  placeholder="Enter your name..."
                  className="w-full px-4 py-3 rounded-xl bg-secondary/50 border border-border text-foreground placeholder:text-muted-foreground/50 text-sm focus:outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/10 transition-all"
                />
              </div>

              {/* Aircraft Selector */}
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wider">Select Aircraft</label>
                {aircraftLoading ? (
                  <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-secondary/50 border border-border text-muted-foreground text-sm">
                    <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                    Loading aircraft...
                  </div>
                ) : (
                  <div className="grid gap-2">
                    {aircraftList?.map((ac) => (
                      <button
                        key={ac.id}
                        onClick={() => setSelectedAircraftId(ac.id)}
                        className={`flex items-center justify-between px-4 py-3 rounded-xl border text-left transition-all ${
                          selectedAircraftId === ac.id
                            ? "border-primary/60 bg-primary/10 text-foreground glow-blue"
                            : "border-border bg-secondary/30 text-muted-foreground hover:border-border/80 hover:bg-secondary/50"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${selectedAircraftId === ac.id ? "bg-primary/20" : "bg-muted"}`}>
                            <Plane className={`w-4 h-4 ${selectedAircraftId === ac.id ? "text-primary" : "text-muted-foreground"}`} />
                          </div>
                          <div>
                            <div className={`font-medium text-sm ${selectedAircraftId === ac.id ? "text-foreground" : "text-muted-foreground"}`}>
                              {ac.manufacturer} {ac.model}
                            </div>
                            <div className="text-xs text-muted-foreground font-mono">{ac.tailNumber}</div>
                          </div>
                        </div>
                        {selectedAircraftId === ac.id && (
                          <CheckCircle2 className="w-4 h-4 text-primary" />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Start Button */}
              <button
                onClick={handleStart}
                disabled={isStarting || !selectedAircraftId || !inspectorName.trim()}
                className="w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm transition-all hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed glow-blue"
              >
                {isStarting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                    Initializing Inspection...
                  </>
                ) : (
                  <>
                    <Mic className="w-4 h-4" />
                    Begin Pre-Flight Inspection
                    <ChevronRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Stats bar */}
      <section className="relative z-10 border-t border-border/50 py-10">
        <div className="max-w-5xl mx-auto px-6 grid grid-cols-2 sm:grid-cols-4 gap-6">
          {[
            { value: "20", label: "Inspection Steps", sub: "FAA-compliant checklist" },
            { value: "< 2s", label: "AI Response Time", sub: "Real-time guidance" },
            { value: "100%", label: "Spec Coverage", sub: "All critical parameters" },
            { value: "Auto", label: "Report Generation", sub: "FAA Form 8130-3" },
          ].map(({ value, label, sub }) => (
            <div key={label} className="text-center">
              <div className="text-3xl font-bold gradient-text mb-1">{value}</div>
              <div className="text-sm font-medium text-foreground">{label}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="relative z-10 max-w-5xl mx-auto px-6 py-16">
        <h2 className="text-2xl font-bold text-center text-foreground mb-10">How It Works</h2>
        <div className="grid sm:grid-cols-3 gap-6">
          {[
            {
              step: "01",
              icon: Plane,
              title: "Select Aircraft",
              desc: "Choose from our fleet of simulated aircraft with real manufacturer specifications loaded automatically.",
            },
            {
              step: "02",
              icon: Mic,
              title: "Voice-Driven Walkthrough",
              desc: "Speak your readings naturally. The AI validates against specs in real-time and guides your next step.",
            },
            {
              step: "03",
              icon: FileText,
              title: "Auto-Generate Report",
              desc: "Complete the inspection and instantly generate an FAA Form 8130-3 compliant compliance document.",
            },
          ].map(({ step, icon: Icon, title, desc }) => (
            <div key={step} className="glass-card p-6 relative overflow-hidden">
              <div className="absolute top-4 right-4 text-5xl font-black text-primary/5 select-none">{step}</div>
              <div className="w-10 h-10 rounded-xl bg-primary/15 border border-primary/25 flex items-center justify-center mb-4">
                <Icon className="w-5 h-5 text-primary" />
              </div>
              <h3 className="font-semibold text-foreground mb-2">{title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-border/50 py-6 px-6 text-center">
        <p className="text-xs text-muted-foreground">
          Built for <span className="text-primary font-medium">Frontier Audio</span> — Making Frontline Workers Superhuman
          <span className="mx-2 text-border">·</span>
          Simulated data for demonstration purposes
        </p>
      </footer>
    </div>
  );
}
