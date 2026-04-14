import { useEffect, useRef, useState } from "react";
import { Square, Zap } from "lucide-react";

interface QuickDemoModeProps {
  isActive: boolean;
  currentStep: number;
  totalSteps: number;
  isSubmitting: boolean;
  samples: Record<number, string>;
  onSubmit: (text: string) => void;
  onStop: () => void;
}

export function QuickDemoMode({
  isActive,
  currentStep,
  totalSteps,
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
    if (demoCount >= totalSteps) {
      setIsDone(true);
      return;
    }

    // Fast first fire to establish the flow, tighter cadence after for a punchy demo
    const delay = demoCount === 0 ? 1200 : 2200;

    timerRef.current = setTimeout(() => {
      const sample = samples[currentStep];
      // Only auto-submit if we have a real sample for this step — never submit filler
      if (!sample) {
        setIsDone(true);
        return;
      }
      onSubmit(sample);
      setWaitingForAI(true);
      setDemoCount((c) => c + 1);
    }, delay);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isActive, isDone, waitingForAI, isSubmitting, demoCount, currentStep, samples, onSubmit, totalSteps]);

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
    ? "Demo complete — all steps verified"
    : isSubmitting || waitingForAI
    ? "AI processing…"
    : demoCount === 0
    ? "Starting in a moment…"
    : `Step ${demoCount} of ${totalSteps} · next in 2s`;

  // Cap progress dots to a reasonable count so the bar doesn't overflow on 20-step runs
  const DOT_COUNT = Math.min(totalSteps, 20);
  const dotsFilled = Math.round((demoCount / totalSteps) * DOT_COUNT);

  return (
    <div
      className="flex items-center gap-3 px-8 py-2.5 flex-shrink-0 border-b border-[oklch(18%_0.02_75)]"
      style={{ background: "oklch(12% 0.02 75)" }}
    >
      {/* Left: label */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <div className="w-2 h-2 rounded-full bg-[oklch(85%_0.06_75)] animate-pulse" />
        <Zap size={12} className="text-[oklch(85%_0.06_75)]" />
        <span className="text-[11px] font-semibold text-[oklch(85%_0.06_75)] uppercase tracking-widest">
          Auto Demo
        </span>
      </div>

      {/* Center: status */}
      <span className="text-[12px] text-[oklch(55%_0.005_70)] flex-1 min-w-0 truncate hidden sm:block">
        {statusText}
      </span>

      {/* Progress dots */}
      <div className="hidden sm:flex items-center gap-1 flex-shrink-0">
        {Array.from({ length: DOT_COUNT }).map((_, i) => (
          <div
            key={i}
            className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
              i < dotsFilled ? "bg-[oklch(85%_0.06_75)]" : "bg-[oklch(85%_0.06_75/0.2)]"
            }`}
          />
        ))}
      </div>

      {/* Stop button */}
      <button
        onClick={onStop}
        className="flex items-center gap-1.5 text-[11px] font-semibold text-[oklch(85%_0.06_75/0.8)] hover:text-[oklch(85%_0.06_75)] border border-[oklch(85%_0.06_75/0.25)] hover:border-[oklch(85%_0.06_75/0.5)] rounded-lg px-3 py-1.5 transition-all flex-shrink-0"
      >
        <Square size={10} />
        Stop
      </button>
    </div>
  );
}
