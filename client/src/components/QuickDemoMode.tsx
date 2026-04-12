import { useEffect, useRef, useState } from "react";
import { Square, Zap } from "lucide-react";

const MAX_DEMO_STEPS = 6;

interface QuickDemoModeProps {
  isActive: boolean;
  currentStep: number;
  isSubmitting: boolean;
  samples: Record<number, string>;
  onSubmit: (text: string) => void;
  onStop: () => void;
}

export function QuickDemoMode({
  isActive,
  currentStep,
  isSubmitting,
  samples,
  onSubmit,
  onStop,
}: QuickDemoModeProps) {
  const [demoCount, setDemoCount] = useState(0);
  const [waitingForAI, setWaitingForAI] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Detect when AI finishes responding
  useEffect(() => {
    if (!isActive || !waitingForAI || isSubmitting) return;
    setWaitingForAI(false);
  }, [isActive, waitingForAI, isSubmitting]);

  // Schedule next auto-submission
  useEffect(() => {
    if (!isActive || isDone || waitingForAI || isSubmitting) return;
    if (demoCount >= MAX_DEMO_STEPS) {
      setIsDone(true);
      return;
    }

    const delay = demoCount === 0 ? 1500 : 3500;

    timerRef.current = setTimeout(() => {
      const sample = samples[currentStep] ?? "Reading confirmed, proceeding to next step";
      onSubmit(sample);
      setWaitingForAI(true);
      setDemoCount((c) => c + 1);
    }, delay);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isActive, isDone, waitingForAI, isSubmitting, demoCount, currentStep, samples, onSubmit]);

  // Reset when deactivated
  useEffect(() => {
    if (!isActive) {
      setDemoCount(0);
      setWaitingForAI(false);
      setIsDone(false);
      if (timerRef.current) clearTimeout(timerRef.current);
    }
  }, [isActive]);

  if (!isActive) return null;

  const statusText = isDone
    ? "Demo complete — voice or type to continue"
    : isSubmitting || waitingForAI
    ? "AI processing…"
    : demoCount === 0
    ? "Starting in a moment…"
    : `Step ${demoCount} of ${MAX_DEMO_STEPS} complete, next in 3s…`;

  return (
    <div
      className="flex items-center gap-3 px-8 py-2.5 flex-shrink-0 border-b border-black/10"
      style={{ background: "oklch(62% 0.22 50)" }}
    >
      {/* Left: label */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
        <Zap size={12} className="text-white" />
        <span className="text-[11px] font-bold text-white uppercase tracking-widest">
          Auto Demo
        </span>
      </div>

      {/* Center: status */}
      <span className="text-[12px] text-white/80 flex-1 min-w-0 truncate hidden sm:block">
        {statusText}
      </span>

      {/* Progress dots */}
      <div className="hidden sm:flex items-center gap-1 flex-shrink-0">
        {Array.from({ length: MAX_DEMO_STEPS }).map((_, i) => (
          <div
            key={i}
            className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
              i < demoCount ? "bg-white" : "bg-white/30"
            }`}
          />
        ))}
      </div>

      {/* Stop button */}
      <button
        onClick={onStop}
        className="flex items-center gap-1.5 text-[11px] font-semibold text-white/80 hover:text-white border border-white/25 hover:border-white/50 rounded-lg px-3 py-1.5 transition-all flex-shrink-0"
      >
        <Square size={10} />
        Stop
      </button>
    </div>
  );
}
