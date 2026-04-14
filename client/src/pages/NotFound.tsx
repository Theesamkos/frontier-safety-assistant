import { AlertTriangle, Home } from "lucide-react";
import { useLocation } from "wouter";

export default function NotFound() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "oklch(8% 0.005 60)", fontFamily: "var(--font-sans)" }}>
      <div className="text-center max-w-md px-6">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6 bg-[oklch(18%_0.04_25)] border border-[oklch(50%_0.15_25/0.3)]">
          <AlertTriangle size={28} className="text-[oklch(62%_0.20_25)]" />
        </div>

        <div className="text-[64px] font-bold leading-none tracking-tight text-[oklch(95%_0.005_80)] mb-2" style={{ fontFamily: "var(--font-display)" }}>404</div>

        <h2 className="text-[18px] font-semibold text-[oklch(95%_0.005_80)] mb-3">Page Not Found</h2>

        <p className="text-[14px] text-[oklch(50%_0.008_70)] leading-relaxed mb-8">
          The page you're looking for doesn't exist or has been moved.
        </p>

        <button
          onClick={() => setLocation("/")}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-[13px] font-semibold hover:opacity-90 transition-opacity"
          style={{ background: "oklch(85% 0.06 75)", color: "oklch(8% 0.005 60)" }}
        >
          <Home size={14} />
          Go Home
        </button>
      </div>
    </div>
  );
}
