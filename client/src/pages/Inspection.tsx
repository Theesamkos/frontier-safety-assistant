import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Mic, MicOff, ChevronRight, AlertTriangle, CheckCircle2,
  FileText, Home, Clock, Shield, Send
} from "lucide-react";

// ── TTS Hook ──────────────────────────────────────────────────────────────
function useTTS() {
  const speak = useCallback((text: string) => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    // Strip markdown bold/asterisks and clean up for speech
    const clean = text
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/#{1,6}\s/g, '')
      .replace(/`([^`]+)`/g, '$1')
      .slice(0, 500); // keep it concise for demo
    const utt = new SpeechSynthesisUtterance(clean);
    utt.rate = 1.05;
    utt.pitch = 1.0;
    utt.volume = 1.0;
    // Prefer a clear English voice
    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find(v => v.lang === 'en-US' && v.name.includes('Google')) ||
      voices.find(v => v.lang === 'en-US') ||
      voices.find(v => v.lang.startsWith('en'));
    if (preferred) utt.voice = preferred;
    window.speechSynthesis.speak(utt);
  }, []);
  const stop = useCallback(() => window.speechSynthesis?.cancel(), []);
  return { speak, stop };
}

// ── Voice Hook ─────────────────────────────────────────────────────────────
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
const SAMPLES: Record<number, string> = {
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
        content: `Pre-flight inspection initiated for ${a?.manufacturer ?? ""} ${a?.model ?? ""} (${a?.tailNumber ?? ""}). I'll guide you through all ${total} steps. Begin with Step 1: Verify aircraft logbook and maintenance records.`,
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
        const completeMsg = 'Inspection complete. All steps finished. Generate your FAA compliance report now.';
        setMessages(prev => [...prev, {
          id: `sys-${Date.now()}`, role: 'system',
          content: '✅ Inspection complete. Generate your FAA compliance report.',
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
      <div className="h-screen flex items-center justify-center" style={{ background: "oklch(97% 0.006 80)", fontFamily: "'Bricolage Grotesque', sans-serif" }}>
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-[oklch(12%_0.015_250)] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm font-mono" style={{ color: "oklch(50% 0.012 250)" }}>Loading inspection…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ background: "oklch(97% 0.006 80)", fontFamily: "'Bricolage Grotesque', 'Inter', sans-serif" }}>

      {/* ══ TOP BAR ══ */}
      <header className="flex items-stretch h-[52px] bg-white border-b border-[oklch(88%_0.01_80)] flex-shrink-0">
        {/* Brand */}
        <div className="flex items-center gap-2.5 px-5 border-r border-[oklch(88%_0.01_80)]">
          <div className="w-7 h-7 bg-[oklch(12%_0.015_250)] rounded-md flex items-center justify-center">
            <span className="text-white text-[10px] font-black">SF</span>
          </div>
          <span className="text-[13px] font-black tracking-tight text-[oklch(12%_0.015_250)] hidden sm:block">SafetyFirst</span>
        </div>

        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 px-4 border-r border-[oklch(88%_0.01_80)] text-[12px]" style={{ color: "oklch(50% 0.012 250)" }}>
          <button onClick={() => navigate("/")} className="hover:text-[oklch(12%_0.015_250)] transition-colors flex items-center gap-1">
            <Home size={11} /> Home
          </button>
          <ChevronRight size={11} />
          <span className="font-mono">{state.aircraft?.tailNumber}</span>
          <ChevronRight size={11} />
          <span className="font-semibold text-[oklch(12%_0.015_250)]">Pre-Flight</span>
        </div>

        {/* Critical alert */}
        {critical.length > 0 ? (
          <div className="flex items-center gap-3 px-4 bg-[oklch(52%_0.24_25)] flex-1 animate-slide-down">
            <span className="inline-flex items-center gap-1 bg-white/20 border border-white/30 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-white">
              ⚠ Critical
            </span>
            <span className="text-[13px] font-semibold text-white truncate">{critical[0].parameter}</span>
            {critical[0].actualValue && (
              <span className="font-mono text-[11px] text-white/70 hidden md:block">
                {critical[0].actualValue} · Spec: {critical[0].expectedRange}
              </span>
            )}
            <button
              onClick={() => acknowledgeAlert.mutate({ alertId: critical[0].id })}
              className="ml-auto text-[11px] text-white/70 border border-white/25 rounded px-3 py-1 hover:bg-white/15 transition-colors font-mono whitespace-nowrap"
            >
              Acknowledge →
            </button>
          </div>
        ) : <div className="flex-1" />}

        {/* Right actions */}
        <div className="flex items-center gap-2 px-4 border-l border-[oklch(88%_0.01_80)]">
          <span className="font-mono text-[11px] bg-[oklch(94%_0.008_80)] border border-[oklch(88%_0.01_80)] rounded px-2.5 py-1 text-[oklch(50%_0.012_250)]">
            <span className="text-[oklch(12%_0.015_250)] font-bold">{stepNum}</span> / {String(total).padStart(2, "0")}
          </span>
          <button
            onClick={() => { if (!generateReport.isPending) generateReport.mutate({ sessionId: sessionId! }); }}
            disabled={generateReport.isPending}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-[oklch(52%_0.24_25)] rounded-lg text-[12px] font-bold text-white hover:opacity-90 disabled:opacity-50 transition-opacity whitespace-nowrap"
          >
            <FileText size={13} />
            {generateReport.isPending ? "Generating…" : "FAA Report"}
          </button>
        </div>
      </header>

      {/* ══ 3-COLUMN BODY ══ */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── LEFT: CHECKLIST ── */}
        <aside className="w-[200px] flex-shrink-0 bg-white border-r border-[oklch(88%_0.01_80)] flex flex-col overflow-hidden">
          {/* Progress */}
          <div className="px-4 py-4 border-b border-[oklch(88%_0.01_80)]">
            <p className="label-caps mb-2" style={{ color: "oklch(50% 0.012 250)" }}>Checklist</p>
            <div className="flex items-baseline gap-1">
              <span className="text-[38px] font-black leading-none tracking-tight text-[oklch(12%_0.015_250)]">{completed}</span>
              <span className="text-[16px] font-medium" style={{ color: "oklch(68% 0.01 250)" }}>/ {total}</span>
            </div>
            <div className="h-[3px] bg-[oklch(88%_0.01_80)] rounded-full mt-2.5 overflow-hidden">
              <div className="h-full bg-[oklch(12%_0.015_250)] rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
            </div>
          </div>

          {/* Steps */}
          <div className="flex-1 overflow-y-auto">
            {Object.entries(byCategory).map(([cat, catSteps]) => (
              <div key={cat}>
                <div className="px-4 py-2 text-[9px] font-bold uppercase tracking-[0.12em] bg-white border-b border-[oklch(91%_0.008_80)] sticky top-0" style={{ color: "oklch(68% 0.01 250)" }}>
                  {cat}
                </div>
                {catSteps.map((step: any) => {
                  const isActive = step.stepNumber === currentStep;
                  const done = step.status === "passed" || step.status === "failed";
                  return (
                    <button
                      key={step.id}
                      onClick={() => setCurrentStep(step.stepNumber)}
                      className={`w-full flex items-center gap-2 px-4 py-2.5 text-left border-b border-[oklch(91%_0.008_80)] transition-colors ${
                        isActive ? "bg-[oklch(12%_0.015_250)]" : "hover:bg-[oklch(94%_0.008_80)]"
                      }`}
                    >
                      <div className={`w-4 h-4 rounded-[3px] flex-shrink-0 flex items-center justify-center text-[8px] border ${
                        step.status === "passed" ? "bg-[oklch(55%_0.2_145)] border-[oklch(55%_0.2_145)] text-white" :
                        step.status === "failed" ? "bg-[oklch(52%_0.24_25)] border-[oklch(52%_0.24_25)] text-white" :
                        isActive ? "bg-white border-white" : "border-[oklch(82%_0.012_80)]"
                      }`}>
                        {step.status === "passed" && "✓"}
                        {step.status === "failed" && "✗"}
                      </div>
                      <span className={`text-[11px] flex-1 leading-tight ${
                        isActive ? "text-white font-semibold" : done ? "text-[oklch(50%_0.012_250)]" : "text-[oklch(30%_0.015_250)]"
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
        <main className="flex-1 flex flex-col overflow-hidden bg-[oklch(97%_0.006_80)]">

          {/* Step hero */}
          <div className="bg-white border-b border-[oklch(88%_0.01_80)] px-8 pt-6 pb-5 flex-shrink-0 relative overflow-hidden">
            <div className="ghost-number">{stepNum}</div>
            <div className="flex items-center gap-2 mb-2 relative z-10">
              <div className={`w-2 h-2 rounded-full ${
                currentStepData?.status === "in_progress" ? "bg-[oklch(52%_0.24_25)] animate-pulse-dot" : "bg-[oklch(55%_0.2_145)]"
              }`} />
              <span className="label-caps text-[oklch(52%_0.24_25)]">
                Step {stepNum} · {currentStepData?.category ?? ""}
              </span>
            </div>
            <h1 className="display-md text-[oklch(12%_0.015_250)] relative z-10 max-w-lg">
              {currentStepData?.stepName ?? "Loading…"}
            </h1>
          </div>

          {/* Spec alert strip */}
          {unacked.length > 0 && (
            <div className="flex border-b border-[oklch(88%_0.01_80)] flex-shrink-0 overflow-x-auto">
              {unacked.slice(0, 3).map((al: any) => (
                <div key={al.id} className={`flex-1 min-w-[160px] px-5 py-3 border-r border-[oklch(88%_0.01_80)] last:border-r-0 ${
                  al.severity === "critical" ? "spec-card-critical" :
                  al.severity === "warning" ? "spec-card-warning" : "spec-card-info"
                }`}>
                  <div className={`label-caps mb-1 ${
                    al.severity === "critical" ? "text-[oklch(52%_0.24_25)]" :
                    al.severity === "warning" ? "text-[oklch(68%_0.17_65)]" : "text-[oklch(55%_0.2_250)]"
                  }`}>
                    {al.severity === "critical" ? "⚠ Critical" : al.severity === "warning" ? "⚡ Warning" : "ℹ Info"}
                  </div>
                  <div className="text-[11px] mb-1" style={{ color: "oklch(50% 0.012 250)" }}>{al.parameter}</div>
                  {al.actualValue && (
                    <div className={`font-mono text-[24px] font-bold leading-none ${
                      al.severity === "critical" ? "text-[oklch(52%_0.24_25)]" : "text-[oklch(68%_0.17_65)]"
                    }`}>
                      {al.actualValue}
                    </div>
                  )}
                  {al.expectedRange && (
                    <div className="font-mono text-[10px] mt-1" style={{ color: "oklch(50% 0.012 250)" }}>
                      SPEC {al.expectedRange}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Voice-Only PTT Bar */}
          <div className="bg-white border-b border-[oklch(88%_0.01_80)] px-8 py-5 flex-shrink-0">
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
                    ? "bg-[oklch(45%_0.18_250)] text-white cursor-wait"
                    : isListening
                    ? "bg-[oklch(52%_0.24_25)] text-white shadow-[0_0_0_6px_oklch(52%_0.24_25/0.2)]"
                    : "bg-[oklch(12%_0.015_250)] text-white hover:opacity-90 active:scale-95"
                }`}
                title="Hold to speak (or hold SPACE)"
              >
                {isTranscribing ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : isListening ? (
                  <span className="voice-waveform">
                    <span /><span /><span /><span /><span />
                  </span>
                ) : <Mic size={22} />}
              </button>

              {/* Status + hint */}
              <div className="flex-1 min-w-0">
                <div className="text-[15px] font-bold text-[oklch(12%_0.015_250)] leading-tight">
                  {isTranscribing ? "Processing your voice…" :
                   isListening ? "Listening — release SPACE to send" :
                   isSubmitting ? "AI is responding…" :
                   "Hold SPACE to speak"}
                </div>
                <div className="text-[11px] font-mono mt-0.5" style={{ color: "oklch(60% 0.012 250)" }}>
                  {isListening ? (
                    <span className="text-[oklch(52%_0.24_25)] font-semibold">● REC</span>
                  ) : (
                    <span>Step {stepNum} · {currentStepData?.category ?? ""} · Voice only mode</span>
                  )}
                </div>
              </div>

              {/* Sample button for demo */}
              <button
                onClick={() => {
                  const sample = SAMPLES[currentStep] ?? "";
                  if (!sample || isSubmitting) return;
                  const ts = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                  setMessages(prev => [...prev, { id: `w-${Date.now()}`, role: 'worker', content: sample, ts }]);
                  setVoiceSubmitText(sample);
                }}
                disabled={isSubmitting || isListening || isTranscribing}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-[oklch(94%_0.008_80)] border border-[oklch(88%_0.01_80)] rounded-xl text-[12px] font-semibold text-[oklch(30%_0.015_250)] hover:bg-[oklch(88%_0.01_80)] disabled:opacity-40 transition-all whitespace-nowrap flex-shrink-0"
              >
                <Send size={12} /> Use sample
              </button>
            </div>
          </div>

          {/* AI Thread */}
          <div ref={threadRef} className="flex-1 overflow-y-auto px-6 py-6 flex flex-col gap-5">
            {messages.length === 0 && (
              <div className="flex items-center justify-center h-full text-center">
                <div>
                  <div className="w-12 h-12 bg-[oklch(12%_0.015_250)] rounded-xl flex items-center justify-center mx-auto mb-3">
                    <Shield size={20} className="text-white" />
                  </div>
                  <p className="text-[13px] font-semibold text-[oklch(12%_0.015_250)]">Ready for Step {stepNum}</p>
                  <p className="text-[12px] mt-1" style={{ color: "oklch(50% 0.012 250)" }}>Hold SPACE to speak your reading</p>
                </div>
              </div>
            )}
            {messages.map((msg) => {
              if (msg.role === "system") {
                return (
                  <div key={msg.id} className="w-full py-2.5 px-4 bg-[oklch(96%_0.04_145)] border border-[oklch(55%_0.2_145/0.25)] rounded-xl text-[12px] font-semibold text-[oklch(55%_0.2_145)] text-center">
                    {msg.content}
                  </div>
                );
              }
              const isWorker = msg.role === "worker";
              return (
                <div key={msg.id} className={`flex items-end gap-2.5 w-full ${isWorker ? "flex-row-reverse" : "flex-row"}`}>
                  {/* Avatar */}
                  <div className={`w-7 h-7 rounded-lg flex-shrink-0 flex items-center justify-center text-[9px] font-black self-start mt-0.5 ${
                    isWorker
                      ? "bg-[oklch(94%_0.008_80)] border border-[oklch(88%_0.01_80)] text-[oklch(30%_0.015_250)]"
                      : "bg-[oklch(12%_0.015_250)] text-white"
                  }`}>
                    {isWorker ? "ME" : "AI"}
                  </div>
                  {/* Bubble + timestamp */}
                  <div className={`flex flex-col gap-1 min-w-0 ${isWorker ? "items-end" : "items-start"}`} style={{ maxWidth: "72%" }}>
                    <div className={`px-4 py-3 rounded-2xl text-[13px] leading-relaxed break-words ${
                      isWorker
                        ? "bg-[oklch(12%_0.015_250)] text-white font-mono text-[12px] rounded-br-sm"
                        : msg.isAlert
                        ? "bg-[oklch(97%_0.02_25)] border-[1.5px] border-[oklch(52%_0.24_25/0.35)] text-[oklch(12%_0.015_250)] rounded-bl-sm"
                        : "bg-white border border-[oklch(88%_0.01_80)] text-[oklch(12%_0.015_250)] rounded-bl-sm"
                    }`}>
                      {msg.streaming ? (
                        <div className="flex gap-1.5 items-center py-1">
                          <div className="w-1.5 h-1.5 bg-[oklch(50%_0.012_250)] rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                          <div className="w-1.5 h-1.5 bg-[oklch(50%_0.012_250)] rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                          <div className="w-1.5 h-1.5 bg-[oklch(50%_0.012_250)] rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                        </div>
                      ) : msg.content}
                    </div>
                    <div className="text-[10px] font-mono px-1" style={{ color: "oklch(68% 0.01 250)" }}>
                      {msg.ts}{!isWorker && " · AI"}{msg.isAlert && " · ⚠"}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </main>

        {/* ── RIGHT PANEL ── */}
        <aside className="w-[300px] flex-shrink-0 bg-white border-l border-[oklch(88%_0.01_80)] flex flex-col overflow-hidden">
          {/* Aircraft ID */}
          <div className="px-5 py-4 border-b border-[oklch(88%_0.01_80)] flex-shrink-0">
            <div className="text-[42px] font-black leading-none tracking-[-0.05em] text-[oklch(12%_0.015_250)]">
              {state.aircraft?.tailNumber ?? "N/A"}
            </div>
            <div className="text-[12px] mt-1" style={{ color: "oklch(50% 0.012 250)" }}>
              {state.aircraft?.manufacturer} {state.aircraft?.model}
            </div>
            <div className="grid grid-cols-2 gap-3 mt-4">
              {[
                { k: "Flight", v: "DL 2847" },
                { k: "Route", v: "ATL → ORD" },
                { k: "ETD", v: "16:45 CDT" },
                { k: "Inspector", v: state.inspection?.inspectorName ?? "S. MOECKEL" },
              ].map(({ k, v }) => (
                <div key={k}>
                  <div className="label-caps mb-0.5" style={{ color: "oklch(68% 0.01 250)" }}>{k}</div>
                  <div className="font-mono text-[12px] font-semibold text-[oklch(12%_0.015_250)]">{v}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Stats row */}
          <div className="flex border-b border-[oklch(88%_0.01_80)] flex-shrink-0">
            {[
              { n: `${pct}%`, l: "Done", c: "text-[oklch(68%_0.17_65)]" },
              { n: passed, l: "Passed", c: "text-[oklch(55%_0.2_145)]" },
              { n: failed, l: "Alerts", c: "text-[oklch(52%_0.24_25)]" },
              { n: fmt(elapsed), l: "Time", c: "text-[oklch(12%_0.015_250)]" },
            ].map(({ n, l, c }) => (
              <div key={l} className="flex-1 py-3 text-center border-r border-[oklch(88%_0.01_80)] last:border-r-0">
                <div className={`text-[20px] font-black leading-none tracking-tight ${c}`}>{n}</div>
                <div className="label-caps mt-1" style={{ color: "oklch(68% 0.01 250)" }}>{l}</div>
              </div>
            ))}
          </div>

          {/* Alerts */}
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
            <p className="label-caps" style={{ color: "oklch(50% 0.012 250)" }}>Active Alerts</p>
            {unacked.length === 0 ? (
              <div className="flex items-center gap-2 py-3 px-3 bg-[oklch(96%_0.04_145)] border border-[oklch(55%_0.2_145/0.2)] rounded-xl">
                <CheckCircle2 size={14} className="text-[oklch(55%_0.2_145)]" />
                <span className="text-[12px] text-[oklch(55%_0.2_145)] font-semibold">All systems nominal</span>
              </div>
            ) : (
              unacked.map((al: any) => (
                <div key={al.id} className="rounded-xl overflow-hidden border border-[oklch(88%_0.01_80)]">
                  <div className={`px-3.5 py-2.5 flex items-center gap-2 text-[11px] font-bold text-white ${
                    al.severity === "critical" ? "bg-[oklch(52%_0.24_25)]" :
                    al.severity === "warning" ? "bg-[oklch(68%_0.17_65)]" : "bg-[oklch(55%_0.2_250)]"
                  }`}>
                    <AlertTriangle size={12} />
                    {al.severity.toUpperCase()} — {al.parameter}
                  </div>
                  <div className="px-3.5 py-2.5 bg-white text-[11px] leading-relaxed" style={{ color: "oklch(30% 0.015 250)" }}>
                    {al.message}
                    {al.actualValue && (
                      <div className={`font-mono text-[12px] font-semibold mt-1.5 ${
                        al.severity === "critical" ? "text-[oklch(52%_0.24_25)]" : "text-[oklch(68%_0.17_65)]"
                      }`}>
                        Reading: {al.actualValue} · Spec: {al.expectedRange}
                      </div>
                    )}
                    <button
                      onClick={() => acknowledgeAlert.mutate({ alertId: al.id })}
                      className="mt-2 text-[10px] font-mono underline hover:text-[oklch(12%_0.015_250)] transition-colors"
                      style={{ color: "oklch(50% 0.012 250)" }}
                    >
                      Acknowledge
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Predicted next */}
          <div className="px-4 py-3.5 border-t border-[oklch(88%_0.01_80)] flex-shrink-0">
            <p className="label-caps mb-3" style={{ color: "oklch(50% 0.012 250)" }}>Up Next</p>
            {steps.slice(
              steps.findIndex((s: any) => s.stepNumber === currentStep) + 1,
              steps.findIndex((s: any) => s.stepNumber === currentStep) + 4
            ).map((step: any, i: number) => (
              <div key={step.id} className="flex gap-2.5 py-2 border-b border-[oklch(91%_0.008_80)] last:border-b-0 text-[11px]" style={{ color: "oklch(30% 0.015 250)" }}>
                <span className="font-mono text-[10px] font-semibold w-5 flex-shrink-0 pt-0.5" style={{ color: "oklch(68% 0.01 250)" }}>
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
