import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { QuickDemoMode } from "@/components/QuickDemoMode";
import { toast } from "sonner";
import {
  Mic, ChevronRight, AlertTriangle, CheckCircle2,
  FileText, Home, Shield, Send, Keyboard
} from "lucide-react";

// ── TTS Hook (Neural voice via backend OpenAI TTS) ────────────────────────────────────────
function useTTS() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const speakMutation = trpc.voice.speak.useMutation();

  const speak = useCallback(async (text: string) => {
    // Stop any currently playing audio
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current = null;
    }
    // Truncate to keep responses concise for demo
    const truncated = text.slice(0, 600);
    try {
      const result = await speakMutation.mutateAsync({ text: truncated, voice: "shimmer" });
      const binary = atob(result.audioBase64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], { type: result.mimeType });
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => URL.revokeObjectURL(url);
      audio.play().catch(() => {}); // user gesture may be needed on first load
    } catch {
      // Silently fall back to browser TTS if neural TTS fails
      if (window.speechSynthesis) {
        const utt = new SpeechSynthesisUtterance(text.slice(0, 300));
        utt.rate = 1.0;
        window.speechSynthesis.speak(utt);
      }
    }
  }, [speakMutation]);

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current = null;
    }
    window.speechSynthesis?.cancel();
  }, []);

  return { speak, stop };
}

// ── Voice Hook ────────────────────────────────────────────────────────────────────────────────
function useVoiceControl(
  onTranscript: (text: string) => void,
  onTranscribing: (v: boolean) => void
) {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const spaceHeldRef = useRef(false);
  const streamRef = useRef<MediaStream | null>(null);

  const transcribeMutation = trpc.voice.transcribe.useMutation({
    onSuccess: (data) => {
      if (data.text?.trim()) {
        onTranscript(data.text.trim());
        toast.success(`Heard: "${data.text.trim().slice(0, 60)}${data.text.trim().length > 60 ? '…' : ''}"`, { duration: 2500 });
      } else {
        toast.warning("No speech detected. Hold SPACE longer and speak clearly.");
      }
      onTranscribing(false);
    },
    onError: (err) => {
      toast.error(`Transcription failed: ${err.message}`);
      onTranscribing(false);
    },
  });

  useEffect(() => {
    setIsSupported(!!navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === "function");
  }, []);

  const startListening = useCallback(async () => {
    if (isListening) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "audio/mp4";
      const recorder = new MediaRecorder(stream, { mimeType });
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.start(100);
      mediaRecorderRef.current = recorder;
      setIsListening(true);
    } catch (err: any) {
      toast.error(err.name === "NotAllowedError"
        ? "Microphone permission denied. Please allow mic access in browser settings."
        : `Mic error: ${err.message}`);
    }
  }, [isListening]);

  const stopListening = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || !isListening) return;
    const mimeType = recorder.mimeType;
    recorder.onstop = async () => {
      streamRef.current?.getTracks().forEach(t => t.stop());
      streamRef.current = null;
      const blob = new Blob(chunksRef.current, { type: mimeType });
      if (blob.size < 500) {
        toast.warning("Recording too short. Hold SPACE longer.");
        onTranscribing(false);
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = (reader.result as string).split(",")[1];
        onTranscribing(true);
        transcribeMutation.mutate({ audioBase64: base64, mimeType: mimeType.split(";")[0] });
      };
      reader.readAsDataURL(blob);
    };
    recorder.stop();
    mediaRecorderRef.current = null;
    setIsListening(false);
  }, [isListening, transcribeMutation, onTranscribing]);

  // Spacebar PTT — always fires (no text input in voice-only mode)
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code !== "Space" || e.repeat) return;
      e.preventDefault(); // prevent page scroll
      if (!spaceHeldRef.current) { spaceHeldRef.current = true; startListening(); }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code !== "Space" || !spaceHeldRef.current) return;
      e.preventDefault();
      spaceHeldRef.current = false;
      stopListening();
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, [startListening, stopListening]);

  return { isListening, isSupported, isTranscribing: transcribeMutation.isPending, startListening, stopListening };
}

// ── Sample inputs per step ─────────────────────────────────────────────────
const AVIATION_SAMPLES: Record<number, string> = {
  1: "Logbook reviewed, last maintenance 3 days ago, all entries current",
  2: "Airworthiness certificate valid, registration N737DL confirmed",
  3: "Nose section clear, no visible damage, radome intact",
  4: "Nose tire pressure 185 PSI, gear strut compressed normally",
  5: "Left engine inlet clear, fan blades inspected, no FOD",
  6: "Left main gear tire pressure 205 PSI, no visible wear",
  7: "Left wing leading edge clear, fuel cap secure, no leaks",
  8: "Left aileron and flaps move freely, no damage",
  9: "Total fuel 82%, left 41% right 41%, balanced",
  10: "No fuel leaks detected, fuel appears clean",
  11: "Tail section intact, elevator and rudder move freely",
  12: "APU exhaust clear, all access panels secured",
  13: "Right wing clear, control surfaces operational",
  14: "Right main gear tire pressure 198 PSI, brakes appear good",
  15: "Right engine inlet clear, fan blades normal",
  16: "Hydraulic pressure 3050 PSI, fluid level normal",
  17: "Engine 1 oil level 14 QT, within normal range",
  18: "Engine 2 oil level 13 QT, within normal range",
  19: "Brake temperature 45 C, wear indicators green",
  20: "Pre-flight inspection complete, aircraft ready for service",
};

const STEEL_MILL_SAMPLES: Record<number, string> = {
  1: "LOTO complete, all energy sources isolated, padlocks applied, tags attached",
  2: "PPE verified, arc flash suit on, face shield down, heat-resistant gloves on",
  3: "Electrode arms inspected, no visible cracks or mechanical damage",
  4: "Transformer temperature 72 degrees Celsius, cooling system running normal",
  5: "Cooling water pressure 78 PSI, all panels showing normal flow",
  6: "Water-cooled roof and sidewall panels inspected, no leaks detected",
  7: "Hydraulic pressure 2200 PSI, electrode positioning system nominal",
  8: "Hydraulic fluid level full, no leaks observed at fittings or hoses",
  9: "Oxygen lance flow 950 SCFM, pressure at 85 PSI, nominal",
  10: "Natural gas pressure 45 PSI, carbon injection system pressure 52 PSI",
  11: "Furnace shell and roof refractory inspected, no hot spots or cracks",
  12: "Tap hole clear, slag door operational, no blockage",
  13: "Duct pressure 1.2 inches water column, baghouse fans running",
  14: "Fume extraction system checked, all dampers open and operational",
  15: "Scrap charge weight 148 tons, heat number H-2847 logged, composition verified",
  16: "Scrap bucket integrity confirmed, crane clearance verified, area clear",
  17: "Power-on sequence verified, electrode positioning confirmed at home position",
  18: "Target heat temperature 2950 degrees Fahrenheit, alloy additions schedule confirmed",
  19: "Emergency power-off tested, quench system pressure 95 PSI, ready",
  20: "Pre-heat checklist complete, heat number H-2847, supervisor sign-off obtained",
};

// ── Message types ──────────────────────────────────────────────────────────
interface ChatMessage {
  id: string;
  role: "worker" | "ai" | "system";
  content: string;
  ts: string;
  isAlert?: boolean;
  streaming?: boolean;
}

// ── Main ───────────────────────────────────────────────────────────────────
export default function Inspection() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [, navigate] = useLocation();

  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentStep, setCurrentStep] = useState(1);
  const [elapsed, setElapsed] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const threadRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [showTextInput, setShowTextInput] = useState(false);

  // Demo mode — activated via ?demo=true URL param
  const [demoMode, setDemoMode] = useState(
    () => new URLSearchParams(window.location.search).get("demo") === "true"
  );

  // "Heard: X" visual indicator — shown for 4s after voice transcription
  const [lastHeard, setLastHeard] = useState<string | null>(null);
  const lastHeardTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: state, refetch } = trpc.inspection.getState.useQuery(
    { sessionId: sessionId! },
    { enabled: !!sessionId, refetchInterval: 4000 }
  );

  const submitStep = trpc.inspection.submitStep.useMutation();
  const generateReport = trpc.report.generate.useMutation({
    onSuccess: () => navigate(`/report/${sessionId}`),
    onError: () => toast.error("Failed to generate report"),
  });
  const acknowledgeAlert = trpc.alerts.acknowledge.useMutation({ onSuccess: () => refetch() });

  const inspection = state?.inspection;
  const steps = state?.steps ?? [];
  const alerts = state?.alerts ?? [];
  const unacked = alerts.filter((a: any) => !a.acknowledged);
  const acked = alerts.filter((a: any) => a.acknowledged);
  const critical = unacked.filter((a: any) => a.severity === "critical");
  const completed = steps.filter((s: any) => s.status === "passed" || s.status === "failed").length;
  const passed = steps.filter((s: any) => s.status === "passed").length;
  const failed = steps.filter((s: any) => s.status === "failed").length;
  const total = inspection?.totalSteps ?? 20;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  const industry = (state?.aircraft as { industry?: string })?.industry ?? "aviation";
  const isManufacturing = industry === "manufacturing";

  // Timer
  useEffect(() => {
    const t = setInterval(() => setElapsed(s => s + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const fmt = (s: number) => `${Math.floor(s / 60)}m ${s % 60}s`;

  // Auto-scroll
  useEffect(() => {
    if (threadRef.current) threadRef.current.scrollTop = threadRef.current.scrollHeight;
  }, [messages]);

  // Welcome
  useEffect(() => {
    if (state && messages.length === 0) {
      const a = state.aircraft;
      setMessages([{
        id: "welcome",
        role: "ai",
        content: isManufacturing
          ? `Pre-heat inspection initiated for ${a?.manufacturer ?? ""} ${a?.model ?? ""} (${a?.tailNumber ?? ""}). I'll guide you through all ${total} OSHA-compliant steps. Begin with Step 1: Verify LOTO procedures are complete — all energy sources isolated.`
          : `Pre-flight inspection initiated for ${a?.manufacturer ?? ""} ${a?.model ?? ""} (${a?.tailNumber ?? ""}). I'll guide you through all ${total} steps. Begin with Step 1: Verify aircraft logbook and maintenance records.`,
        ts: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      }]);
    }
  }, [state]);

  // TTS
  const { speak, stop: stopTTS } = useTTS();

  // Voice — auto-submit on transcript
  const handleTranscript = useCallback((text: string) => {
    // Directly submit without putting text in the input box
    if (!text.trim() || !sessionId) return;

    // Show "Heard: X" visual indicator for 4 seconds
    setLastHeard(text.trim());
    if (lastHeardTimer.current) clearTimeout(lastHeardTimer.current);
    lastHeardTimer.current = setTimeout(() => setLastHeard(null), 4000);

    const ts = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const workerMsg: ChatMessage = {
      id: `w-${Date.now()}`,
      role: 'worker',
      content: text.trim(),
      ts,
    };
    setMessages(prev => [...prev, workerMsg]);
    // Trigger submit with the transcribed text directly
    setVoiceSubmitText(text.trim());
  }, [sessionId]);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [voiceSubmitText, setVoiceSubmitText] = useState<string | null>(null);
  const { isListening, isSupported, startListening, stopListening } = useVoiceControl(handleTranscript, setIsTranscribing);

  // Core submit — accepts text directly (for voice) or reads from input state (for keyboard)
  const submitText = useCallback(async (text: string) => {
    if (!text.trim() || isSubmitting || !sessionId) return;
    setIsSubmitting(true);

    // Streaming placeholder
    const placeholderId = `ai-${Date.now()}`;
    setMessages(prev => [...prev, { id: placeholderId, role: 'ai', content: '', ts: '', streaming: true }]);

    try {
      const result = await submitStep.mutateAsync({ sessionId, stepNumber: currentStep, workerInput: text });
      const aiText = result.aiResponse ?? 'Reading recorded.';
      const isAlert = result.isInSpec === false;
      const finalTs = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      if (isAlert && result.newAlerts?.length) {
        result.newAlerts.forEach((al: any) => {
          al.severity === 'critical'
            ? toast.error(al.title, { description: al.message?.slice(0, 80) })
            : toast.warning(al.title, { description: al.message?.slice(0, 80) });
        });
      }

      // Replace placeholder — show full text immediately, no typewriter cursor artifact
      setMessages(prev => prev.map(m => m.id === placeholderId
        ? { ...m, content: aiText, streaming: false, isAlert, ts: finalTs }
        : m
      ));

      // TTS: read the AI response aloud
      speak(aiText);

      if (result.nextStepNumber) setCurrentStep(result.nextStepNumber);
      if (result.isComplete) {
        const reportLabel = isManufacturing ? 'OSHA compliance report' : 'FAA compliance report';
        const completeMsg = `Inspection complete. All steps finished. Generate your ${reportLabel} now.`;
        setMessages(prev => [...prev, {
          id: `sys-${Date.now()}`, role: 'system',
          content: `✅ Inspection complete. Generate your ${reportLabel}.`,
          ts: finalTs,
        }]);
        speak(completeMsg);
      }
      await refetch();
    } catch {
      setMessages(prev => prev.map(m => m.id === placeholderId
        ? { ...m, content: 'Unable to process reading. Please try again.', streaming: false, ts: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
        : m
      ));
    } finally {
      setIsSubmitting(false);
    }
  }, [isSubmitting, sessionId, currentStep, submitStep, refetch, speak]);

  // Keyboard submit — reads from input state
  const handleSubmit = useCallback(async () => {
    if (!input.trim()) return;
    const text = input.trim();
    setInput('');
    const ts = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setMessages(prev => [...prev, { id: `w-${Date.now()}`, role: 'worker', content: text, ts }]);
    await submitText(text);
  }, [input, submitText]);

  // Voice auto-submit — fires when voiceSubmitText is set
  useEffect(() => {
    if (!voiceSubmitText) return;
    setVoiceSubmitText(null);
    submitText(voiceSubmitText);
  }, [voiceSubmitText, submitText]);

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(); }
  };

  // Group steps by category
  const byCategory = steps.reduce<Record<string, any[]>>((acc, s: any) => {
    if (!acc[s.category]) acc[s.category] = [];
    acc[s.category].push(s);
    return acc;
  }, {});

  const stepNum = String(currentStep).padStart(2, "0");
  const currentStepData = steps.find((s: any) => s.stepNumber === currentStep) ?? steps[0];

  if (!state) {
    return (
      <div className="h-screen flex items-center justify-center" style={{ background: "oklch(8% 0.005 60)", fontFamily: "'Inter', system-ui, sans-serif" }}>
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-[oklch(85%_0.06_75)] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm font-mono" style={{ color: "oklch(50% 0.008 70)" }}>Loading inspection…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ background: "oklch(8% 0.005 60)", fontFamily: "'Inter', system-ui, sans-serif" }}>

      {/* ══ TOP BAR ══ */}
      <header className="flex items-stretch h-[52px] bg-[oklch(14%_0.005_60)] border-b border-[oklch(16%_0.006_60)] flex-shrink-0">
        {/* Brand */}
        <div className="flex items-center gap-2.5 px-5 border-r border-[oklch(16%_0.006_60)]">
          <div className="w-7 h-7 bg-[oklch(85%_0.06_75)] rounded-lg flex items-center justify-center">
            <span className="text-[oklch(8%_0.005_60)] text-[10px] font-bold">SF</span>
          </div>
          <span className="text-[13px] font-medium tracking-wide text-[oklch(95%_0.005_80)] hidden sm:block">Frontier</span>
        </div>

        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 px-4 border-r border-[oklch(16%_0.006_60)] text-[12px]" style={{ color: "oklch(45% 0.008 70)" }}>
          <button onClick={() => navigate("/")} className="hover:text-[oklch(95%_0.005_80)] transition-colors flex items-center gap-1">
            <Home size={11} /> Home
          </button>
          <ChevronRight size={11} />
          <span className="font-mono text-[oklch(85%_0.06_75)]">{state.aircraft?.tailNumber}</span>
          <ChevronRight size={11} />
          <span className="font-medium text-[oklch(92%_0.005_80)]">Inspection</span>
        </div>

        {/* Critical alert */}
        {critical.length > 0 ? (
          <div className="flex items-center gap-3 px-4 bg-[oklch(28%_0.12_25)] flex-1 animate-slide-down">
            <span className="inline-flex items-center gap-1 bg-[oklch(62%_0.20_25/0.2)] border border-[oklch(62%_0.20_25/0.3)] rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-[oklch(62%_0.20_25)]">
              ⚠ Critical
            </span>
            <span className="text-[13px] font-semibold text-[oklch(92%_0.005_80)] truncate">{critical[0].parameter}</span>
            {critical[0].actualValue && (
              <span className="font-mono text-[11px] text-[oklch(70%_0.005_70)] hidden md:block">
                {critical[0].actualValue} · Spec: {critical[0].expectedRange}
              </span>
            )}
            <button
              onClick={() => acknowledgeAlert.mutate({ alertId: critical[0].id })}
              className="ml-auto text-[11px] text-[oklch(70%_0.005_70)] border border-[oklch(45%_0.008_70/0.25)] rounded px-3 py-1 hover:bg-[oklch(14%_0.005_60)] transition-colors font-mono whitespace-nowrap"
            >
              Acknowledge →
            </button>
          </div>
        ) : <div className="flex-1" />}

        {/* Right actions */}
        <div className="flex items-center gap-2 px-4 border-l border-[oklch(16%_0.006_60)]">
          <span className="font-mono text-[11px] bg-[oklch(18%_0.006_60)] border border-[oklch(22%_0.006_60)] rounded px-2.5 py-1 text-[oklch(50%_0.008_70)]">
            <span className="text-[oklch(95%_0.005_80)] font-bold">{stepNum}</span> / {String(total).padStart(2, "0")}
          </span>
          <button
            onClick={() => { if (!generateReport.isPending) generateReport.mutate({ sessionId: sessionId! }); }}
            disabled={generateReport.isPending}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-[oklch(85%_0.06_75)] rounded-lg text-[12px] font-semibold text-[oklch(8%_0.005_60)] hover:opacity-90 disabled:opacity-50 transition-opacity whitespace-nowrap"
          >
            <FileText size={13} />
            {generateReport.isPending ? "Generating…" : isManufacturing ? "OSHA Report" : "FAA Report"}
          </button>
        </div>
      </header>

      {/* ══ QUICK DEMO BANNER ══ */}
      <QuickDemoMode
        isActive={demoMode}
        currentStep={currentStep}
        totalSteps={total}
        isSubmitting={isSubmitting}
        samples={isManufacturing ? STEEL_MILL_SAMPLES : AVIATION_SAMPLES}
        onSubmit={(text) => {
          const ts = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
          setMessages((prev) => [...prev, { id: `w-${Date.now()}`, role: "worker", content: text, ts }]);
          submitText(text);
        }}
        onStop={() => setDemoMode(false)}
      />

      {/* ══ 3-COLUMN BODY ══ */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── LEFT: CHECKLIST ── */}
        <aside className="w-[220px] flex-shrink-0 bg-[oklch(10%_0.005_60)] border-r border-[oklch(16%_0.006_60)] flex flex-col overflow-hidden">
          {/* Progress */}
          <div className="px-4 py-4 border-b border-[oklch(16%_0.006_60)]">
            <p className="label-caps mb-2">Checklist</p>
            <div className="flex items-baseline gap-1">
              <span className="text-[38px] font-bold leading-none tracking-tight text-[oklch(95%_0.005_80)]">{completed}</span>
              <span className="text-[16px] font-medium" style={{ color: "oklch(45% 0.012 70)" }}>/ {total}</span>
            </div>
            <div className="h-[3px] bg-[oklch(16%_0.006_60)] rounded-full mt-2.5 overflow-hidden">
              <div className="h-full bg-[oklch(85%_0.06_75)] rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
            </div>
          </div>

          {/* Steps */}
          <div className="flex-1 overflow-y-auto">
            {Object.entries(byCategory).map(([cat, catSteps]) => (
              <div key={cat}>
                <div className="px-4 py-2 text-[9px] font-medium uppercase tracking-[0.12em] bg-[oklch(14%_0.005_60)] border-b border-[oklch(18%_0.006_60)] sticky top-0" style={{ color: "oklch(45% 0.008 70)" }}>
                  {cat}
                </div>
                {catSteps.map((step: any) => {
                  const isActive = step.stepNumber === currentStep;
                  const done = step.status === "passed" || step.status === "failed";
                  return (
                    <button
                      key={step.id}
                      onClick={() => setCurrentStep(step.stepNumber)}
                      className={`w-full flex items-center gap-2 px-4 py-2.5 text-left border-b border-[oklch(18%_0.006_60)] transition-colors ${
                        isActive ? "bg-[oklch(85%_0.06_75/0.1)] border-l-2 border-l-[oklch(85%_0.06_75)]" : "hover:bg-[oklch(14%_0.005_60)]"
                      }`}
                    >
                      <div className={`w-4 h-4 rounded-[3px] flex-shrink-0 flex items-center justify-center text-[8px] border ${
                        step.status === "passed" ? "bg-[oklch(65%_0.15_155)] border-[oklch(65%_0.15_155)] text-white" :
                        step.status === "failed" ? "bg-[oklch(62%_0.20_25)] border-[oklch(62%_0.20_25)] text-white" :
                        isActive ? "bg-[oklch(85%_0.06_75)] border-[oklch(85%_0.06_75)]" : "border-[oklch(25%_0.006_60)]"
                      }`}>
                        {step.status === "passed" && "✓"}
                        {step.status === "failed" && "✗"}
                      </div>
                      <span className={`text-[11px] flex-1 leading-tight ${
                        isActive ? "text-[oklch(85%_0.06_75)] font-semibold" : done ? "text-[oklch(40%_0.008_70)]" : "text-[oklch(70%_0.005_70)]"
                      }`}>
                        {step.stepName}
                      </span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </aside>

        {/* ── CENTER: WORKSPACE ── */}
        <main className="flex-1 flex flex-col overflow-hidden bg-[oklch(9%_0.005_60)]">

          {/* Step hero */}
          <div className="bg-[oklch(14%_0.005_60)] border-b border-[oklch(16%_0.006_60)] px-10 pt-8 pb-7 flex-shrink-0 relative overflow-hidden">
            <div className="ghost-number">{stepNum}</div>
            <div className="flex items-center gap-2 mb-2 relative z-10">
              <div className={`w-2 h-2 rounded-full ${
                currentStepData?.status === "in_progress" ? "bg-[oklch(85%_0.06_75)] animate-pulse-dot" : "bg-[oklch(65%_0.15_155)]"
              }`} />
              <span className="label-caps text-[oklch(85%_0.06_75)]">
                Step {stepNum} · {currentStepData?.category ?? ""}
              </span>
            </div>
            <h1 className="display-md text-[oklch(95%_0.005_80)] relative z-10 max-w-lg">
              {currentStepData?.stepName ?? "Loading…"}
            </h1>
          </div>

          {/* Spec alert strip */}
          {unacked.length > 0 && (
            <div className="flex border-b border-[oklch(16%_0.006_60)] flex-shrink-0 overflow-x-auto">
              {unacked.slice(0, 3).map((al: any) => (
                <div key={al.id} className={`flex-1 min-w-[160px] px-5 py-3 border-r border-[oklch(16%_0.006_60)] last:border-r-0 ${
                  al.severity === "critical" ? "spec-card-critical" :
                  al.severity === "warning" ? "spec-card-warning" : "spec-card-info"
                }`}>
                  <div className={`label-caps mb-1 ${
                    al.severity === "critical" ? "text-[oklch(62%_0.20_25)]" :
                    al.severity === "warning" ? "text-[oklch(85%_0.06_75)]" : "text-[oklch(60%_0.15_250)]"
                  }`}>
                    {al.severity === "critical" ? "⚠ Critical" : al.severity === "warning" ? "⚡ Warning" : "ℹ Info"}
                  </div>
                  <div className="text-[11px] mb-1" style={{ color: "oklch(50% 0.008 70)" }}>{al.parameter}</div>
                  {al.actualValue && (
                    <div className={`font-mono text-[24px] font-bold leading-none ${
                      al.severity === "critical" ? "text-[oklch(62%_0.20_25)]" : "text-[oklch(85%_0.06_75)]"
                    }`}>
                      {al.actualValue}
                    </div>
                  )}
                  {al.expectedRange && (
                    <div className="font-mono text-[10px] mt-1" style={{ color: "oklch(45% 0.008 70)" }}>
                      SPEC {al.expectedRange}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Voice-Only PTT Bar */}
          <div className="bg-[oklch(14%_0.005_60)] border-b border-[oklch(16%_0.006_60)] px-10 py-6 flex-shrink-0">
            <div className="flex items-center gap-4">
              {/* Big PTT mic button */}
              <button
                onMouseDown={startListening}
                onMouseUp={stopListening}
                onTouchStart={startListening}
                onTouchEnd={stopListening}
                disabled={isTranscribing}
                className={`relative w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 transition-all select-none ${
                  isTranscribing
                    ? "bg-[oklch(40%_0.10_250)] text-white cursor-wait"
                    : isListening
                    ? "bg-[oklch(85%_0.06_75)] text-[oklch(8%_0.005_60)] voice-recording-glow-steel"
                    : "bg-[oklch(85%_0.06_75)] text-[oklch(8%_0.005_60)] hover:opacity-90 active:scale-95"
                }`}
                title="Hold to speak (or hold SPACE)"
              >
                {isTranscribing ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : isListening ? (
                  <span className="voice-waveform voice-waveform-steel">
                    <span /><span /><span /><span /><span />
                  </span>
                ) : <Mic size={22} />}
              </button>

              {/* Status + hint */}
              <div className="flex-1 min-w-0">
                <div className="text-[15px] font-semibold text-[oklch(95%_0.005_80)] leading-tight">
                  {isTranscribing ? "Processing your voice…" :
                   isListening ? "Listening — release SPACE to send" :
                   isSubmitting ? "AI is responding…" :
                   "Hold SPACE to speak"}
                </div>
                <div className="text-[11px] font-mono mt-0.5" style={{ color: "oklch(45% 0.008 70)" }}>
                  {isListening ? (
                    <span className="font-semibold text-[oklch(85%_0.06_75)]">● REC {isManufacturing ? "| STEEL MILL" : "| AVIATION"}</span>
                  ) : (
                    <span>Step {stepNum} · {currentStepData?.category ?? ""} · {isManufacturing ? "OSHA 1910.147" : "FAA 14 CFR Part 43"}</span>
                  )}
                </div>
              </div>

              {/* Type fallback toggle — keyboard escape hatch when voice isn't an option */}
              <button
                onClick={() => { setShowTextInput((v) => !v); setTimeout(() => inputRef.current?.focus(), 50); }}
                className={`flex items-center gap-1.5 px-3.5 py-2.5 border rounded-xl text-[12px] font-semibold transition-all whitespace-nowrap flex-shrink-0 ${
                  showTextInput
                    ? "bg-[oklch(85%_0.06_75/0.12)] border-[oklch(85%_0.06_75/0.35)] text-[oklch(85%_0.06_75)]"
                    : "bg-[oklch(18%_0.006_60)] border-[oklch(22%_0.006_60)] text-[oklch(70%_0.005_70)] hover:border-[oklch(30%_0.006_60)]"
                }`}
                title="Toggle keyboard input"
              >
                <Keyboard size={12} /> Type
              </button>

              {/* Sample button for demo */}
              <button
                onClick={() => {
                  const SAMPLES = isManufacturing ? STEEL_MILL_SAMPLES : AVIATION_SAMPLES;
                  const sample = SAMPLES[currentStep] ?? "";
                  if (!sample || isSubmitting) return;
                  const ts = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                  setMessages(prev => [...prev, { id: `w-${Date.now()}`, role: 'worker', content: sample, ts }]);
                  setVoiceSubmitText(sample);
                }}
                disabled={isSubmitting || isListening || isTranscribing}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-[oklch(18%_0.006_60)] border border-[oklch(22%_0.006_60)] rounded-xl text-[12px] font-semibold text-[oklch(70%_0.005_70)] hover:bg-[oklch(18%_0.006_60)] disabled:opacity-40 transition-all whitespace-nowrap flex-shrink-0"
              >
                <Send size={12} /> Use sample
              </button>
            </div>

            {/* Text input fallback — for accessibility, noisy environments, or mic failure */}
            {showTextInput && (
              <div className="mt-3 flex items-center gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKey}
                  placeholder={`Type reading for Step ${stepNum} and press Enter…`}
                  disabled={isSubmitting || isListening || isTranscribing}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-[oklch(10%_0.005_60)] border border-[oklch(18%_0.006_60)] text-[13px] font-mono text-[oklch(95%_0.005_80)] placeholder:text-[oklch(30%_0.006_60)] outline-none focus:border-[oklch(85%_0.06_75)] focus:shadow-[0_0_0_3px_oklch(85%_0.06_75/0.08)] transition-all disabled:opacity-50"
                />
                <button
                  onClick={handleSubmit}
                  disabled={!input.trim() || isSubmitting || isListening || isTranscribing}
                  className="px-4 py-2.5 rounded-xl text-[12px] font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 flex items-center gap-1.5"
                  style={{ background: "oklch(85% 0.06 75)", color: "oklch(8% 0.005 60)" }}
                >
                  <Send size={12} /> Send
                </button>
              </div>
            )}

            {/* "Heard: X" indicator — appears for 4s after voice transcription */}
            {lastHeard && (
              <div className="mt-3 flex items-center gap-2 px-4 py-2 bg-[oklch(18%_0.03_155)] border border-[oklch(50%_0.12_155/0.25)] rounded-xl text-[12px]">
                <CheckCircle2 size={13} className="text-[oklch(65%_0.15_155)] flex-shrink-0" />
                <span className="font-semibold text-[oklch(65%_0.15_155)] flex-shrink-0">Heard:</span>
                <span className="font-mono text-[oklch(82%_0.005_70)] truncate">
                  &ldquo;{lastHeard.slice(0, 90)}{lastHeard.length > 90 ? "…" : ""}&rdquo;
                </span>
              </div>
            )}
          </div>

          {/* AI Thread */}
          <div ref={threadRef} className="flex-1 overflow-y-auto px-6 py-6 flex flex-col gap-5">
            {messages.length === 0 && (
              <div className="flex items-center justify-center h-full text-center">
                <div>
                  <div className="w-12 h-12 bg-[oklch(85%_0.06_75/0.12)] border border-[oklch(85%_0.06_75/0.2)] rounded-xl flex items-center justify-center mx-auto mb-3">
                    <Shield size={20} className="text-[oklch(85%_0.06_75)]" />
                  </div>
                  <p className="text-[13px] font-semibold text-[oklch(95%_0.005_80)]">Ready for Step {stepNum}</p>
                  <p className="text-[12px] mt-1" style={{ color: "oklch(45% 0.008 70)" }}>Hold SPACE to speak your reading</p>
                </div>
              </div>
            )}
            {messages.map((msg) => {
              if (msg.role === "system") {
                return (
                  <div key={msg.id} className="w-full py-2.5 px-4 bg-[oklch(18%_0.03_155)] border border-[oklch(50%_0.12_155/0.25)] rounded-xl text-[12px] font-semibold text-[oklch(65%_0.15_155)] text-center">
                    {msg.content}
                  </div>
                );
              }
              const isWorker = msg.role === "worker";
              return (
                <div key={msg.id} className={`flex items-end gap-2.5 w-full ${isWorker ? "flex-row-reverse" : "flex-row"}`}>
                  {/* Avatar */}
                  <div className={`w-7 h-7 rounded-lg flex-shrink-0 flex items-center justify-center text-[9px] font-bold self-start mt-0.5 ${
                    isWorker
                      ? "bg-[oklch(85%_0.06_75/0.15)] border border-[oklch(85%_0.06_75/0.25)] text-[oklch(85%_0.06_75)]"
                      : "bg-[oklch(16%_0.006_60)] text-[oklch(60%_0.005_70)]"
                  }`}>
                    {isWorker ? "ME" : "AI"}
                  </div>
                  {/* Bubble + timestamp */}
                  <div className={`flex flex-col gap-1 min-w-0 ${isWorker ? "items-end" : "items-start"}`} style={{ maxWidth: "72%" }}>
                    <div className={`px-4 py-3 rounded-2xl text-[13px] leading-relaxed break-words ${
                      isWorker
                        ? "bg-[oklch(85%_0.06_75)] text-[oklch(8%_0.005_60)] font-mono text-[12px] rounded-br-sm"
                        : msg.isAlert
                        ? "bg-[oklch(18%_0.04_25)] border-[1.5px] border-[oklch(50%_0.15_25/0.3)] text-[oklch(85%_0.005_70)] rounded-bl-sm"
                        : "bg-[oklch(12%_0.008_60)] border border-[oklch(18%_0.006_60)] text-[oklch(85%_0.005_70)] rounded-bl-sm"
                    }`}>
                      {msg.streaming ? (
                        <div className="flex gap-1.5 items-center py-1">
                          <div className="w-1.5 h-1.5 bg-[oklch(30%_0.006_60)] rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                          <div className="w-1.5 h-1.5 bg-[oklch(30%_0.006_60)] rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                          <div className="w-1.5 h-1.5 bg-[oklch(30%_0.006_60)] rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                        </div>
                      ) : msg.content}
                    </div>
                    <div className="text-[10px] font-mono px-1" style={{ color: "oklch(35% 0.006 60)" }}>
                      {msg.ts}{!isWorker && " · AI"}{msg.isAlert && " · ⚠"}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </main>

        {/* ── RIGHT PANEL ── */}
        <aside className="w-[300px] flex-shrink-0 bg-[oklch(10%_0.005_60)] border-l border-[oklch(16%_0.006_60)] flex flex-col overflow-hidden">
          {/* Aircraft ID */}
          <div className="px-5 py-4 border-b border-[oklch(16%_0.006_60)] flex-shrink-0">
            <div className="text-[42px] font-bold leading-none tracking-[-0.05em] text-[oklch(95%_0.005_80)]">
              {state.aircraft?.tailNumber ?? "N/A"}
            </div>
            <div className="text-[12px] mt-1" style={{ color: "oklch(45% 0.008 70)" }}>
              {state.aircraft?.manufacturer} {state.aircraft?.model}
            </div>
            <div className="grid grid-cols-2 gap-3 mt-4">
              {(isManufacturing ? [
                { k: "Heat #", v: "H-2847" },
                { k: "Facility", v: "Charlotte, NC" },
                { k: "Shift", v: "Day Shift" },
                { k: "Inspector", v: state.inspection?.inspectorName ?? "—" },
              ] : [
                { k: "Flight", v: "DL 2847" },
                { k: "Route", v: "ATL → ORD" },
                { k: "ETD", v: "16:45 CDT" },
                { k: "Inspector", v: state.inspection?.inspectorName ?? "—" },
              ]).map(({ k, v }) => (
                <div key={k}>
                  <div className="label-caps mb-0.5">{k}</div>
                  <div className="font-mono text-[12px] font-semibold text-[oklch(85%_0.005_70)]">{v}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Stats row */}
          <div className="flex border-b border-[oklch(16%_0.006_60)] flex-shrink-0">
            {[
              { n: `${pct}%`, l: "Done", c: "text-[oklch(85%_0.06_75)]" },
              { n: passed, l: "Passed", c: "text-[oklch(65%_0.15_155)]" },
              { n: failed, l: "Alerts", c: "text-[oklch(62%_0.20_25)]" },
              { n: fmt(elapsed), l: "Time", c: "text-[oklch(95%_0.005_80)]" },
            ].map(({ n, l, c }) => (
              <div key={l} className="flex-1 py-3 text-center border-r border-[oklch(16%_0.006_60)] last:border-r-0">
                <div className={`text-[20px] font-bold leading-none tracking-tight ${c}`}>{n}</div>
                <div className="label-caps mt-1">{l}</div>
              </div>
            ))}
          </div>

          {/* Alerts */}
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
            <p className="label-caps">Active Alerts</p>
            {unacked.length === 0 ? (
              <div className="flex items-center gap-2 py-3 px-3 bg-[oklch(18%_0.03_155)] border border-[oklch(50%_0.12_155/0.25)] rounded-xl">
                <CheckCircle2 size={14} className="text-[oklch(65%_0.15_155)]" />
                <span className="text-[12px] text-[oklch(65%_0.15_155)] font-semibold">All systems nominal</span>
              </div>
            ) : (
              unacked.map((al: any) => (
                <div key={al.id} className="rounded-xl overflow-hidden border border-[oklch(18%_0.006_60)]">
                  <div className={`px-3.5 py-2.5 flex items-center gap-2 text-[11px] font-semibold ${
                    al.severity === "critical" ? "bg-[oklch(18%_0.04_25)] text-[oklch(62%_0.20_25)] border-b border-[oklch(50%_0.15_25/0.3)]" :
                    al.severity === "warning" ? "bg-[oklch(18%_0.03_65)] text-[oklch(85%_0.06_75)] border-b border-[oklch(60%_0.10_65/0.3)]" : "bg-[oklch(18%_0.025_250)] text-[oklch(60%_0.15_250)] border-b border-[oklch(50%_0.15_250/0.3)]"
                  }`}>
                    <AlertTriangle size={12} />
                    {al.severity.toUpperCase()} — {al.parameter}
                  </div>
                  <div className="px-3.5 py-2.5 bg-[oklch(14%_0.005_60)] text-[11px] leading-relaxed" style={{ color: "oklch(70% 0.01 70)" }}>
                    {al.message}
                    {al.actualValue && (
                      <div className={`font-mono text-[12px] font-semibold mt-1.5 ${
                        al.severity === "critical" ? "text-[oklch(62%_0.20_25)]" : "text-[oklch(85%_0.06_75)]"
                      }`}>
                        Reading: {al.actualValue} · Spec: {al.expectedRange}
                      </div>
                    )}
                    <button
                      onClick={() => acknowledgeAlert.mutate({ alertId: al.id })}
                      className="mt-2 text-[10px] font-mono underline hover:text-[oklch(85%_0.06_75)] transition-colors"
                      style={{ color: "oklch(45% 0.008 70)" }}
                    >
                      Acknowledge
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Predicted next */}
          <div className="px-4 py-3.5 border-t border-[oklch(16%_0.006_60)] flex-shrink-0">
            <p className="label-caps mb-3">Up Next</p>
            {steps.slice(
              steps.findIndex((s: any) => s.stepNumber === currentStep) + 1,
              steps.findIndex((s: any) => s.stepNumber === currentStep) + 4
            ).map((step: any, i: number) => (
              <div key={step.id} className="flex gap-2.5 py-2 border-b border-[oklch(18%_0.006_60)] last:border-b-0 text-[11px]" style={{ color: "oklch(65% 0.01 70)" }}>
                <span className="font-mono text-[10px] font-semibold w-5 flex-shrink-0 pt-0.5" style={{ color: "oklch(35% 0.006 60)" }}>
                  {String(currentStep + 1 + i).padStart(2, "0")}
                </span>
                <span>{step.stepName}</span>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}
