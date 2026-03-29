import { trpc } from "@/lib/trpc";
import { useState, useRef, useEffect, useCallback } from "react";
import { useLocation, useParams } from "wouter";
import { toast } from "sonner";
import {
  Mic, MicOff, Send, Shield, AlertTriangle, CheckCircle2,
  XCircle, Clock, Activity, ChevronRight, FileText, Home,
  Loader2, AlertCircle, Info, ChevronDown, ChevronUp, History
} from "lucide-react";

// Typewriter hook for streaming AI response effect
function useTypewriter(text: string, speed = 18) {
  const [displayed, setDisplayed] = useState("");
  const [done, setDone] = useState(false);
  useEffect(() => {
    setDisplayed("");
    setDone(false);
    if (!text) return;
    let i = 0;
    const interval = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) { clearInterval(interval); setDone(true); }
    }, speed);
    return () => clearInterval(interval);
  }, [text, speed]);
  return { displayed, done };
}

// Streaming AI message bubble
function StreamingAIMessage({ content, isInSpec }: { content: string; isInSpec?: boolean }) {
  const { displayed, done } = useTypewriter(content, 16);
  return (
    <div className="flex items-start gap-3 max-w-2xl">
      <div className="w-8 h-8 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center flex-shrink-0 mt-0.5">
        <Shield className="w-4 h-4 text-primary" />
      </div>
      <div className="glass-card px-4 py-3 rounded-2xl rounded-tl-sm">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-xs font-medium text-primary">Safety AI</span>
          {isInSpec === true && <span className="text-xs px-1.5 py-0.5 rounded-full bg-emerald-400/15 text-emerald-400 border border-emerald-400/25">✓ In Spec</span>}
          {isInSpec === false && <span className="text-xs px-1.5 py-0.5 rounded-full bg-red-400/15 text-red-400 border border-red-400/25">⚠ Out of Spec</span>}
        </div>
        <p className="text-sm text-foreground leading-relaxed">
          {displayed}
          {!done && <span className="inline-block w-0.5 h-4 bg-primary ml-0.5 animate-typing-cursor" />}
        </p>
      </div>
    </div>
  );
}

type StepStatus = "pending" | "in_progress" | "passed" | "failed" | "skipped";
type AlertSeverity = "critical" | "warning" | "info";

interface Message {
  id: string;
  role: "worker" | "ai" | "system";
  content: string;
  timestamp: Date;
  isInSpec?: boolean;
  stepNumber?: number;
}

const SAMPLE_INPUTS: Record<number, string[]> = {
  1: ["Logbook reviewed, last maintenance 3 days ago, all entries current"],
  2: ["Airworthiness certificate valid, registration N737DL confirmed"],
  3: ["Nose section clear, no visible damage, radome intact"],
  4: ["Nose tire pressure 185 PSI, gear strut compressed normally"],
  5: ["Left engine inlet clear, fan blades inspected, no FOD"],
  6: ["Left main gear tire pressure 205 PSI, no visible wear"],
  7: ["Left wing leading edge clear, fuel cap secure, no leaks"],
  8: ["Left aileron and flaps move freely, no damage"],
  9: ["Total fuel 82%, left 41% right 41%, balanced"],
  10: ["No fuel leaks detected, fuel appears clean, no contamination"],
  11: ["Tail section intact, elevator and rudder move freely"],
  12: ["APU exhaust clear, all access panels secured"],
  13: ["Right wing clear, control surfaces operational"],
  14: ["Right main gear tire pressure 198 PSI, brakes appear good"],
  15: ["Right engine inlet clear, fan blades normal"],
  16: ["Hydraulic pressure 3050 PSI, fluid level normal"],
  17: ["Engine 1 oil level 14 QT, within normal range"],
  18: ["Engine 2 oil level 13 QT, within normal range"],
  19: ["Brake temperature 45 C, wear indicators green"],
  20: ["Pre-flight inspection complete, aircraft ready for service"],
};

export default function Inspection() {
  const params = useParams<{ sessionId: string }>();
  const sessionId = params.sessionId;
  const [, navigate] = useLocation();

  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [isListening, setIsListening] = useState(false);
  const [showAlerts, setShowAlerts] = useState(true);
  const [showChecklist, setShowChecklist] = useState(true);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [generatingReport, setGeneratingReport] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { data: state, refetch } = trpc.inspection.getState.useQuery(
    { sessionId },
    { refetchInterval: 3000 }
  );

  const submitStep = trpc.inspection.submitStep.useMutation({
    onSuccess: (data) => {
      const aiMsg: Message = {
        id: `ai-${Date.now()}`,
        role: "ai",
        content: data.aiResponse,
        timestamp: new Date(),
        isInSpec: data.isInSpec,
      };
      setMessages(prev => [...prev, aiMsg]);

      if (!data.isInSpec && data.newAlerts.length > 0) {
        data.newAlerts.forEach(alert => {
          if (alert.severity === "critical") {
            toast.error(alert.title, { description: alert.message.slice(0, 80) + "..." });
          } else {
            toast.warning(alert.title, { description: alert.message.slice(0, 80) + "..." });
          }
        });
      }

      if (data.nextStepNumber) {
        setCurrentStep(data.nextStepNumber);
      }

      if (data.isComplete) {
        const sysMsg: Message = {
          id: `sys-${Date.now()}`,
          role: "system",
          content: "✅ Pre-flight inspection complete. All steps have been recorded. You may now generate the FAA compliance report.",
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, sysMsg]);
      }

      refetch();
      setIsSubmitting(false);
      setInput("");
    },
    onError: () => {
      toast.error("Failed to submit step. Please try again.");
      setIsSubmitting(false);
    },
  });

  const generateReport = trpc.report.generate.useMutation({
    onSuccess: () => {
      navigate(`/report/${sessionId}`);
    },
    onError: () => {
      toast.error("Failed to generate report.");
      setGeneratingReport(false);
    },
  });

  // Timer
  useEffect(() => {
    timerRef.current = setInterval(() => setElapsedSeconds(s => s + 1), 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  // Welcome message
  useEffect(() => {
    if (state && messages.length === 0) {
      const aircraft = state.aircraft;
      setMessages([{
        id: "welcome",
        role: "ai",
        content: `Pre-flight inspection initiated for ${aircraft?.manufacturer} ${aircraft?.model} (${aircraft?.tailNumber}). I'll guide you through all ${state.inspection.totalSteps} steps. Begin with Step 1: Verify aircraft logbook and maintenance records. Speak or type your findings.`,
        timestamp: new Date(),
      }]);
    }
  }, [state, messages.length]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = useCallback(() => {
    if (!input.trim() || isSubmitting) return;
    const workerMsg: Message = {
      id: `worker-${Date.now()}`,
      role: "worker",
      content: input.trim(),
      timestamp: new Date(),
      stepNumber: currentStep,
    };
    setMessages(prev => [...prev, workerMsg]);
    setIsSubmitting(true);
    submitStep.mutate({ sessionId, stepNumber: currentStep, workerInput: input.trim() });
  }, [input, isSubmitting, currentStep, sessionId, submitStep]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const useSampleInput = () => {
    const samples = SAMPLE_INPUTS[currentStep];
    if (samples) setInput(samples[0]);
    inputRef.current?.focus();
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const inspection = state?.inspection;
  const steps = state?.steps ?? [];
  const alerts = state?.alerts ?? [];
  const unackedAlerts = alerts.filter(a => !a.acknowledged);
  const ackedAlerts = alerts.filter(a => a.acknowledged);
  const criticalAlerts = unackedAlerts.filter(a => a.severity === "critical");
  const completionPct = inspection ? Math.round(((inspection.completedSteps ?? 0) / (inspection.totalSteps ?? 20)) * 100) : 0;
  const isComplete = inspection?.status === "completed";
  const [alertTab, setAlertTab] = useState<"active" | "history">("active");

  const acknowledgeAlert = trpc.alerts.acknowledge.useMutation({ onSuccess: () => refetch() });

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top bar */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-border/60 bg-card/50 backdrop-blur-sm sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/")} className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors">
            <Home className="w-4 h-4" />
          </button>
          <div className="w-px h-4 bg-border" />
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-primary" />
            <span className="font-semibold text-sm text-foreground hidden sm:block">
              {state?.aircraft?.manufacturer} {state?.aircraft?.model}
            </span>
            <span className="font-mono text-xs text-muted-foreground">{state?.aircraft?.tailNumber}</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Timer */}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="w-3.5 h-3.5" />
            <span className="font-mono">{formatTime(elapsedSeconds)}</span>
          </div>

          {/* Alert badge */}
          {criticalAlerts.length > 0 && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-destructive/15 border border-destructive/30 text-xs text-red-400 animate-flash">
              <AlertTriangle className="w-3 h-3" />
              {criticalAlerts.length} Critical
            </div>
          )}

          {/* Progress */}
          <div className="flex items-center gap-2">
            <div className="w-24 h-1.5 rounded-full bg-secondary overflow-hidden hidden sm:block">
              <div
                className="h-full rounded-full bg-primary transition-all duration-500"
                style={{ width: `${completionPct}%` }}
              />
            </div>
            <span className="text-xs font-mono text-muted-foreground">{completionPct}%</span>
          </div>

          {/* Generate Report */}
          {isComplete && (
            <button
              onClick={() => { setGeneratingReport(true); generateReport.mutate({ sessionId }); }}
              disabled={generatingReport}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 transition-opacity"
            >
              {generatingReport ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileText className="w-3 h-3" />}
              Generate Report
            </button>
          )}
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar — Checklist */}
        <aside className={`${showChecklist ? "w-72" : "w-12"} border-r border-border/60 flex flex-col bg-card/30 transition-all duration-300 hidden lg:flex`}>
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/40">
            {showChecklist && <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Checklist</span>}
            <button onClick={() => setShowChecklist(!showChecklist)} className="p-1 rounded hover:bg-secondary text-muted-foreground ml-auto">
              {showChecklist ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5 rotate-90" />}
            </button>
          </div>
          {showChecklist && (
            <div className="flex-1 overflow-y-auto py-2">
              {steps.map((step) => (
                <div
                  key={step.id}
                  className={`flex items-start gap-2.5 px-3 py-2 mx-2 rounded-lg mb-0.5 transition-all ${
                    step.stepNumber === currentStep && !isComplete
                      ? "bg-primary/10 border border-primary/25"
                      : "hover:bg-secondary/30"
                  }`}
                >
                  <div className="mt-0.5 flex-shrink-0">
                    {step.status === "passed" ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    ) : step.status === "failed" ? (
                      <XCircle className="w-3.5 h-3.5 text-red-400" />
                    ) : step.stepNumber === currentStep && !isComplete ? (
                      <div className="w-3.5 h-3.5 rounded-full border-2 border-primary pulse-ring" />
                    ) : (
                      <div className="w-3.5 h-3.5 rounded-full border border-border" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs text-muted-foreground/60 font-mono">{step.stepNumber.toString().padStart(2, "0")}</div>
                    <div className={`text-xs leading-tight ${
                      step.stepNumber === currentStep && !isComplete ? "text-foreground font-medium" :
                      step.status === "passed" ? "text-muted-foreground line-through" :
                      "text-muted-foreground"
                    }`}>
                      {step.stepName}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </aside>

        {/* Main chat area */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            {messages.map((msg, idx) => (
              <div key={msg.id} className={`flex ${msg.role === "worker" ? "justify-end" : "justify-start"} animate-slide-in-up`}>
                {msg.role === "ai" && (
                  // Use streaming typewriter for the most recent AI message only
                  idx === messages.filter(m => m.role !== "worker").length + messages.filter(m => m.role === "worker").length - 1 && idx === messages.length - 1
                    ? <StreamingAIMessage content={msg.content} isInSpec={msg.isInSpec} />
                    : <div className="flex items-start gap-3 max-w-2xl">
                        <div className="w-8 h-8 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Shield className="w-4 h-4 text-primary" />
                        </div>
                        <div className="glass-card px-4 py-3 rounded-2xl rounded-tl-sm">
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className="text-xs font-medium text-primary">Safety AI</span>
                            {msg.isInSpec === true && <span className="text-xs px-1.5 py-0.5 rounded-full bg-emerald-400/15 text-emerald-400 border border-emerald-400/25">✓ In Spec</span>}
                            {msg.isInSpec === false && <span className="text-xs px-1.5 py-0.5 rounded-full bg-red-400/15 text-red-400 border border-red-400/25">⚠ Out of Spec</span>}
                          </div>
                          <p className="text-sm text-foreground leading-relaxed">{msg.content}</p>
                          <span className="text-xs text-muted-foreground/50 mt-1 block">{msg.timestamp.toLocaleTimeString()}</span>
                        </div>
                      </div>
                )}
                {msg.role === "worker" && (
                  <div className="flex items-start gap-3 max-w-2xl">
                    <div className="bg-primary/15 border border-primary/25 px-4 py-3 rounded-2xl rounded-tr-sm">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-xs font-medium text-muted-foreground">You</span>
                        {msg.stepNumber && <span className="text-xs font-mono text-muted-foreground/50">Step {msg.stepNumber}</span>}
                      </div>
                      <p className="text-sm text-foreground">{msg.content}</p>
                      <span className="text-xs text-muted-foreground/50 mt-1 block">{msg.timestamp.toLocaleTimeString()}</span>
                    </div>
                    <div className="w-8 h-8 rounded-xl bg-secondary border border-border flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Mic className="w-4 h-4 text-muted-foreground" />
                    </div>
                  </div>
                )}
                {msg.role === "system" && (
                  <div className="w-full flex justify-center">
                    <div className="px-4 py-2 rounded-xl bg-emerald-400/10 border border-emerald-400/25 text-emerald-400 text-sm text-center max-w-lg">
                      {msg.content}
                    </div>
                  </div>
                )}
              </div>
            ))}
            {isSubmitting && (
              <div className="flex justify-start animate-slide-in-up">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center">
                    <Shield className="w-4 h-4 text-primary" />
                  </div>
                  <div className="glass-card px-4 py-3 rounded-2xl rounded-tl-sm">
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" />
                      <span className="text-sm text-muted-foreground">Analyzing reading...</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Current step indicator */}
          {!isComplete && (
            <div className="px-4 py-2 border-t border-border/40 bg-card/30">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <div className="w-2 h-2 rounded-full bg-primary pulse-ring" />
                <span className="font-mono text-primary">Step {currentStep}/{inspection?.totalSteps ?? 20}</span>
                <ChevronRight className="w-3 h-3" />
                <span className="text-foreground/80 truncate">
                  {steps.find(s => s.stepNumber === currentStep)?.stepName ?? "Loading..."}
                </span>
                <button
                  onClick={useSampleInput}
                  className="ml-auto text-xs text-primary/70 hover:text-primary underline underline-offset-2 flex-shrink-0"
                >
                  Use sample input
                </button>
              </div>
            </div>
          )}

          {/* Voice input */}
          {!isComplete && (
            <div className="p-4 border-t border-border/60 bg-card/50">
              <div className="voice-input flex items-end gap-3 p-3">
                <button
                  onClick={() => setIsListening(!isListening)}
                  className={`p-2.5 rounded-xl flex-shrink-0 transition-all ${
                    isListening
                      ? "bg-red-500/20 border border-red-500/40 text-red-400 pulse-ring"
                      : "bg-secondary border border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </button>
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Speak or type your inspection finding... (Enter to submit)"
                  rows={2}
                  className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/50 resize-none focus:outline-none leading-relaxed"
                />
                <button
                  onClick={handleSubmit}
                  disabled={!input.trim() || isSubmitting}
                  className="p-2.5 rounded-xl bg-primary text-primary-foreground flex-shrink-0 hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all glow-blue"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
              <p className="text-xs text-muted-foreground/40 mt-1.5 px-1">Press Enter to submit · Shift+Enter for new line</p>
            </div>
          )}
        </main>

        {/* Right sidebar — Metrics + Alerts */}
        <aside className="w-72 border-l border-border/60 flex flex-col bg-card/30 hidden xl:flex">
          {/* Metrics */}
          <div className="p-4 border-b border-border/40">
            <div className="flex items-center gap-2 mb-4">
              <Activity className="w-4 h-4 text-primary" />
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Live Metrics</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="metric-card text-center">
                <div className="text-2xl font-bold text-primary">{completionPct}%</div>
                <div className="text-xs text-muted-foreground mt-0.5">Complete</div>
              </div>
              <div className="metric-card text-center">
                <div className="text-2xl font-bold text-emerald-400">{inspection?.safetyChecksPassed ?? 0}</div>
                <div className="text-xs text-muted-foreground mt-0.5">Passed</div>
              </div>
              <div className="metric-card text-center">
                <div className="text-2xl font-bold text-red-400">{inspection?.safetyChecksFailed ?? 0}</div>
                <div className="text-xs text-muted-foreground mt-0.5">Failed</div>
              </div>
              <div className="metric-card text-center">
                <div className="text-2xl font-bold text-amber-400">{unackedAlerts.length}</div>
                <div className="text-xs text-muted-foreground mt-0.5">Alerts</div>
              </div>
            </div>

            {/* Progress ring */}
            <div className="flex justify-center mt-4">
              <div className="relative w-20 h-20">
                <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
                  <circle cx="40" cy="40" r="32" fill="none" stroke="oklch(0.22 0.02 250)" strokeWidth="6" />
                  <circle
                    cx="40" cy="40" r="32" fill="none"
                    stroke="oklch(0.65 0.22 250)"
                    strokeWidth="6"
                    strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 32}`}
                    strokeDashoffset={`${2 * Math.PI * 32 * (1 - completionPct / 100)}`}
                    className="transition-all duration-500"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-lg font-bold text-foreground">{inspection?.completedSteps ?? 0}</span>
                  <span className="text-xs text-muted-foreground">/{inspection?.totalSteps ?? 20}</span>
                </div>
              </div>
            </div>

            {/* Time saved estimate */}
            <div className="mt-3 p-3 rounded-xl bg-emerald-400/8 border border-emerald-400/20 text-center">
              <div className="text-lg font-bold text-emerald-400">
                ~{Math.max(0, Math.round(((inspection?.safetyChecksPassed ?? 0) * 2.5)))} min
              </div>
              <div className="text-xs text-muted-foreground">Estimated time saved</div>
            </div>
          </div>

          {/* Alerts */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Tabs */}
            <div className="flex items-center border-b border-border/40">
              <button
                onClick={() => setAlertTab("active")}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors ${
                  alertTab === "active" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <AlertTriangle className="w-3 h-3" />
                Active
                {unackedAlerts.length > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full bg-amber-400/20 text-amber-400 text-xs">{unackedAlerts.length}</span>
                )}
              </button>
              <button
                onClick={() => setAlertTab("history")}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors ${
                  alertTab === "history" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <History className="w-3 h-3" />
                History
                {ackedAlerts.length > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full bg-secondary text-muted-foreground text-xs">{ackedAlerts.length}</span>
                )}
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {alertTab === "active" ? (
                unackedAlerts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-24 text-center">
                    <CheckCircle2 className="w-6 h-6 text-emerald-400 mb-2" />
                    <p className="text-xs text-muted-foreground">No active alerts</p>
                  </div>
                ) : (
                  unackedAlerts.map((alert) => (
                    <div key={alert.id} className={`rounded-xl p-3 ${
                      alert.severity === "critical" ? "alert-critical glow-critical" :
                      alert.severity === "warning" ? "alert-warning glow-amber" : "alert-info"
                    } animate-slide-in-up`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          {alert.severity === "critical" ? <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" /> :
                           alert.severity === "warning" ? <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" /> :
                           <Info className="w-3.5 h-3.5 flex-shrink-0" />}
                          <span className="text-xs font-semibold">{alert.title}</span>
                        </div>
                        <button
                          onClick={() => acknowledgeAlert.mutate({ alertId: alert.id })}
                          className="text-xs opacity-60 hover:opacity-100 flex-shrink-0"
                        >
                          ✕
                        </button>
                      </div>
                      {alert.actualValue && (
                        <div className="mt-1.5 text-xs opacity-80">
                          <span className="font-mono">{alert.actualValue}</span>
                          <span className="mx-1 opacity-50">vs</span>
                          <span className="font-mono opacity-70">{alert.expectedRange}</span>
                        </div>
                      )}
                      <p className="text-xs opacity-70 mt-1 leading-relaxed line-clamp-2">{alert.message}</p>
                    </div>
                  ))
                )
              ) : (
                ackedAlerts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-24 text-center">
                    <History className="w-6 h-6 text-muted-foreground mb-2" />
                    <p className="text-xs text-muted-foreground">No resolved alerts yet</p>
                  </div>
                ) : (
                  ackedAlerts.map((alert) => (
                    <div key={alert.id} className="rounded-xl p-3 bg-secondary/20 border border-border/40 opacity-70">
                      <div className="flex items-center gap-1.5 mb-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                        <span className="text-xs font-semibold text-muted-foreground">{alert.title}</span>
                        <span className={`ml-auto text-xs px-1.5 py-0.5 rounded-full ${
                          alert.severity === "critical" ? "bg-red-400/10 text-red-400" :
                          alert.severity === "warning" ? "bg-amber-400/10 text-amber-400" : "bg-blue-400/10 text-blue-400"
                        }`}>{alert.severity}</span>
                      </div>
                      {alert.actualValue && (
                        <div className="text-xs text-muted-foreground/60 font-mono">
                          {alert.actualValue} vs {alert.expectedRange}
                        </div>
                      )}
                    </div>
                  ))
                )
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
