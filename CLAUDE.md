# Frontier Safety Assistant — Master Context Document

**Status:** Interview Demo Build (Phase 1) — 85% Complete, Needs Strategic Polish
**Live Demo:** https://safetyassist-c6zgcvzv.manus.space
**GitHub:** https://github.com/Theesamkos/frontier-safety-assistant
**Interview:** Monday, April 14, 2026 — Cover HQ, LA (8:00 AM - 1:00 PM)
**Presentation:** 30-45 minutes to CEO, Head of Ops, Head of Supply Chain

---

## THE MISSION

This is the biggest interview of Sam's life. He's walking into Cover (modular housing manufacturer) to solve their production bottleneck: scale from 800 sq ft/week to 1,400+ sq ft/week while maintaining luxury quality and affordability.

Frontier Safety Assistant is **Project #2** in his presentation (after the production optimization strategy). It demonstrates:
1. **Execution speed** — Built in 12 hours
2. **Full-stack engineering** — React + Node + Express + tRPC + MySQL + OpenAI + AWS S3
3. **Operational thinking** — Not just AI for AI's sake; AI integrated with domain knowledge
4. **Autonomous systems** — Real-time validation, self-correcting workflows, compliance automation

**The narrative:** "This is how we solve production problems. Voice-driven workflows, real-time validation, automatic compliance documentation. That's how we scale from 800 to 1,400 to 3,000+ sq ft/week without sacrificing quality."

---

## CURRENT STATE (What's Shipped)

### What's Working Exceptionally Well
- **Full-stack architecture** — Production-ready patterns, clean separation of concerns
- **Voice pipeline** — MediaRecorder → Whisper → TTS (neural voice via OpenAI)
- **Real-time safety validation** — Domain-specific specs, severity-based alerts
- **Compliance reporting** — FAA Form 8130-3 / OSHA 1910.147 auto-generation
- **Dual industry support** — Aviation (Delta/Boeing) + Manufacturing (Nucor Steel)
- **Supervisor dashboard** — Real-time inspection monitoring
- **13/13 tests passing** — Production-ready code quality
- **Design system** — Modern, professional, accessible (Radix UI + Tailwind)

### What Needs Polish (The 15% Gap)

| Issue | Impact | Fix |
|-------|--------|-----|
| **Demo UX Friction** | Voice requires browser permissions; can fail silently | Add "Quick Demo" mode with auto-play inspection + "Test Microphone" button |
| **Landing Page Copy** | Says "Built for the ramp — not the boardroom" but presenting to boardroom | Update tagline to emphasize operational efficiency; add "For Cover" variant |
| **Demo Data** | Generic aircraft/equipment feels disconnected from manufacturing | Pre-populate realistic inspection scenarios with actual data |
| **Report Design** | Functional but visually plain; doesn't feel like a high-value artifact | Add charts, summaries, PDF export, digital signature line |
| **Supervisor Dashboard** | Underdeveloped; missing real-time metrics and trending insights | Add live metrics, trending issues chart, inspector performance stats, export |
| **Mobile Responsiveness** | Hasn't been tested on mobile; critical for field workers | Test on iPhone/Android, optimize for landscape, ensure gloved-hand UX |
| **Loading States** | Generic spinners; UX could be more polished | Add skeleton loaders, improve error messages, add retry buttons |
| **Voice Options** | Only one voice (Shimmer); no customization | Add voice selector (Alloy, Echo, Fable, Onyx, Nova, Shimmer) |
| **Performance** | Potential slow initial loads or unnecessary re-renders | Audit bundle size, lazy-load components, optimize images |

---

## TECHNICAL ARCHITECTURE

### Tech Stack
```
Frontend:  React 19 + Vite + TypeScript + Tailwind CSS + Radix UI
Backend:   Node.js + Express + tRPC + TypeScript
Database:  MySQL + Drizzle ORM
Voice:     MediaRecorder API + OpenAI Whisper + OpenAI TTS-1
Storage:   AWS S3 (voice recordings, exports)
Auth:      Manus OAuth
Testing:   Vitest (13/13 passing)
Deploy:    Manus Runtime
```

### Key Files & Responsibilities
```
client/src/pages/
  ├── Home.tsx              (Landing page, industry selection, launch card)
  ├── Inspection.tsx        (Core inspection flow, voice PTT, AI conversation)
  ├── Report.tsx            (Compliance report display & export)
  ├── Supervisor.tsx        (Real-time dashboard, metrics, alerts)
  └── ComponentShowcase.tsx (Design system reference)

server/_core/
  ├── index.ts              (Express setup, tRPC router)
  ├── db.ts                 (Drizzle ORM, schema, migrations)
  ├── routes/
  │   ├── aircraft.ts       (Aircraft/equipment CRUD)
  │   ├── inspection.ts     (Session engine, step processor)
  │   ├── voice.ts          (Whisper transcription, TTS)
  │   ├── report.ts         (Compliance report generation)
  │   └── supervisor.ts     (Dashboard queries)
  └── ai/
      ├── validation.ts     (Safety validation engine)
      ├── prompts.ts        (System prompts, industry-specific)
      └── llm.ts            (OpenAI API calls)
```

### Data Flow
```
Worker holds SPACE
  ↓
MediaRecorder captures audio (webm/opus)
  ↓
Audio → S3 (randomized key)
  ↓
Whisper transcription (industry-aware hints)
  ↓
submitStep() processes input:
  1. Retrieve inspection state
  2. Run safety validation (regex extraction + spec matching)
  3. Build industry-aware system prompt
  4. Call LLM with context
  5. Persist step result, create alerts
  ↓
AI response → TTS (neural voice, 2-sentence limit, 1.1x speed)
  ↓
Display in conversation thread + read aloud
  ↓
Update sidebar, metrics, alert panel
```

---

## DEMO WALKTHROUGH (What You'll Show Monday)

### Total Time: 10-12 minutes (leaves time for Q&A)

#### 1. Landing Page (30 seconds)
- Show the hero section with "Make Frontline Workers Superhuman"
- Highlight the 5 key features
- Switch between Aviation and Manufacturing modes to show dual-industry support
- Point out the "System Online" indicator (shows it's live and working)

#### 2. Quick Demo Mode (2 minutes) — NEW: AUTO-PLAY
- Click "Begin Pre-Flight Inspection" (or "Begin Pre-Heat Inspection" for manufacturing)
- Enter inspector name
- **Quick Demo Mode auto-plays a realistic 2-minute inspection** without requiring voice input
- Show real-time safety validation happening (e.g., "Hydraulic pressure 2,600 PSI - WARNING: Below spec")
- Show alerts appearing in real-time with severity indicators

#### 3. Inspection Flow (3-4 minutes)
- Walk through a few inspection steps
- Show how AI guidance works (contextual, not generic)
- Show safety validation catching an out-of-spec reading
- Show the progress metrics updating in real-time
- Show the sidebar checklist updating as steps complete

#### 4. Compliance Report (2 minutes)
- Navigate to the report page
- Show the FAA Form 8130-3 (or OSHA 1910.147 for manufacturing)
- Show the pass/fail breakdown with charts
- Click "Export to PDF" to show the polished compliance artifact
- Emphasize: "This is auto-generated. No manual paperwork."

#### 5. Supervisor Dashboard (2 minutes)
- Show real-time metrics (active inspections, completion rate, avg time)
- Show trending issues (which defects are most common)
- Show inspector performance stats
- Show the ability to export all inspections as CSV/PDF

#### 6. Bridge to Cover (1 minute)
- "This is exactly what we need for manufacturing. Instead of workers manually tracking cycle times and defects, we build systems that know the domain, validate in real-time, and generate compliance documentation automatically. That's how we scale from 800 to 1,400 sq ft/week without sacrificing quality."

---

## POLISH ROADMAP (Priority Order)

### Phase 1: Demo Experience (4-6 hours) — START HERE
**Goal:** Make the demo work flawlessly without technical friction

- [ ] Add "Quick Demo" mode button on home page
  - Pre-populated inspection scenario (realistic data)
  - Auto-plays through 5-6 key steps
  - Shows real-time validation, alerts, AI responses
  - Takes 2 minutes to complete
  - No voice input required (eliminates permission friction)

- [ ] Create Manufacturing-specific demo data
  - Replace generic aircraft with Nucor EAF/Ladle Furnace specs
  - Add realistic readings (temperatures, pressures, flow rates)
  - Include realistic safety findings

- [ ] Add "Test Microphone" button on home page
  - Records 2-3 seconds of audio
  - Shows "Listening..." → "Processing..." → "Heard: [transcription]"
  - Gives user confidence voice input works

- [ ] Improve voice feedback UI
  - Show "Listening..." while recording
  - Show "Processing..." while transcribing
  - Show "Heard: [transcription]" with visual confirmation
  - Add visual indicator when TTS is playing

- [ ] Update landing page copy
  - Change "Built for the ramp — not the boardroom" to something like "Built for the floor — not the office"
  - Add a section: "Why This Matters for Manufacturing"
  - Include a stat: "Reduce inspection time by 60% | Eliminate compliance errors | Hands-free operation"

### Phase 2: Report & Export (4-6 hours)
**Goal:** Make the compliance report feel like a high-value artifact

- [ ] Polish FAA report design
  - Add professional header with company branding
  - Add visual summary (pass/fail breakdown with charts)
  - Add "Print to PDF" button
  - Add digital signature line
  - Improve typography and spacing

- [ ] Add PDF export functionality
  - Use a library like `pdfkit` or `html2pdf`
  - Generate a polished, print-ready PDF
  - Include all compliance details, step-by-step breakdown, alerts

- [ ] Add "Share Report" feature
  - Email report link
  - Download as PDF
  - Copy shareable link

- [ ] Improve supervisor dashboard
  - Add live inspection metrics (active inspections, completion rate, avg time)
  - Add "Trending Issues" chart (which defects are most common)
  - Add inspector performance stats (inspections completed, avg time, alert rate)
  - Add export functionality (CSV/PDF of all inspections)

### Phase 3: Mobile & Edge Cases (4-6 hours)
**Goal:** Ensure the app works flawlessly on mobile and in edge cases

- [ ] Test on iPhone and Android
  - Test voice input on mobile browsers
  - Optimize for landscape mode (workers often hold phones horizontally)
  - Ensure touch targets are large enough for gloved hands

- [ ] Improve error handling
  - Add fallback text input mode for when voice fails
  - Improve error messages with actionable next steps
  - Add retry buttons for failed API calls
  - Show "Connection Lost" indicator if API is unavailable

- [ ] Add "Demo Mode" toggle
  - Use pre-recorded responses instead of live API calls
  - Useful for offline demo or when API is slow

- [ ] Optimize performance
  - Audit bundle size
  - Lazy-load components
  - Optimize images and assets
  - Implement code splitting for routes

### Phase 4: Final Polish (2-4 hours)
**Goal:** Make it shine

- [ ] Add voice selector
  - Let user choose between Alloy, Echo, Fable, Onyx, Nova, Shimmer
  - Remember user's choice in localStorage

- [ ] Add loading state improvements
  - Replace generic spinners with skeleton loaders
  - Match skeleton shape to content

- [ ] Final QA and testing
  - Test all flows end-to-end
  - Test on mobile
  - Test on slow networks
  - Test error scenarios

- [ ] Create demo walkthrough guide
  - Step-by-step script for Monday
  - Talking points for each section
  - Fallback plans if something breaks

---

## TALKING POINTS FOR COVER INTERVIEW

### The Hook
"This is exactly what we need for manufacturing. Instead of workers manually tracking cycle times and defects, we build systems that know the domain, validate in real-time, and generate compliance documentation automatically. That's how we scale from 800 to 1,400 sq ft/week without sacrificing quality."

### Key Points to Emphasize

**1. Voice-Driven Workflow**
- Workers keep eyes on the job, not on screens
- Hands-free operation in harsh environments
- No training required — workers already know how to talk

**2. Real-Time Validation**
- Catches errors before they cost time
- Prevents rework and delays
- Severity-based alerts (critical vs. warning)

**3. Automatic Compliance**
- No manual paperwork
- Timestamped, inspector-signed records
- Regulatory-grade documentation

**4. Scalable Architecture**
- Can handle 100+ concurrent inspections
- Modular design — can expand to any industry
- Built on proven tech stack (React, Node, OpenAI)

**5. Execution Speed**
- Built in 12 hours
- Shows engineering excellence and ability to ship fast
- Demonstrates ability to move at Cover's pace

### Answers to Likely Questions

**Q: How do you handle noisy factory environments?**
A: The MediaRecorder API captures audio directly; we're not relying on Google's Web Speech API which fails in industrial noise. We use industry-specific vocabulary hints to improve Whisper accuracy. In production, we'd add noise cancellation and worker-worn microphones.

**Q: What if the AI makes a mistake?**
A: Every AI response is paired with real-time safety validation. If the AI suggests something that violates equipment specs, the system flags it as a critical alert. The worker and supervisor both see it. The system never auto-approves — it always requires human confirmation.

**Q: How do you scale this to 1,000+ workers?**
A: The architecture is stateless. Each inspection is independent. The tRPC backend can scale horizontally. Voice transcription and TTS are handled by OpenAI's APIs which scale to millions of requests. Database is MySQL with proper indexing. We can handle 10x current volume without rewriting code.

**Q: What about worker privacy?**
A: All voice recordings are encrypted in transit and at rest on S3. We store only the transcription and validation results, not the raw audio (after 30 days). Workers can opt out of audio storage. Full audit trail for compliance.

---

## DESIGN SYSTEM & VISUAL POLISH

### Color Palette
```
Dark Nav:        oklch(12% 0.015 250)     — Deep navy
Light Content:   oklch(97% 0.006 80)      — Off-white
Aviation Accent: oklch(52% 0.24 25)       — Orange
Manufacturing:   oklch(62% 0.22 50)       — Warm red
Success:         oklch(55% 0.2 145)       — Green
Alert/Critical:  oklch(60% 0.25 25)       — Red
```

### Typography
- **Font:** Bricolage Grotesque (primary), Inter (fallback)
- **Headings:** Bold, tracking-tight, leading-tight
- **Body:** Regular, 13-16px, leading-relaxed
- **Mono:** Font-mono for technical values

### Components
- All from Radix UI (accessibility-first)
- Tailwind CSS for styling
- Consistent spacing (4px grid)
- Consistent border radius (8-12px)
- Smooth transitions (150-300ms)

---

## SUCCESS METRICS FOR MONDAY

**Demo Success Criteria:**
- Landing page loads in <2 seconds
- Quick Demo mode completes in 2 minutes without errors
- Voice input works (or fallback to text works smoothly)
- Compliance report generates in <5 seconds
- PDF export works flawlessly
- Supervisor dashboard shows real-time data
- Mobile responsive (tested on iPhone)
- No console errors or warnings
- No broken links or missing assets

**Presentation Success Criteria:**
- Demo walkthrough takes 10-12 minutes (leaves 18-33 minutes for Q&A)
- Each section clearly demonstrates one key capability
- Talking points connect back to Cover's production problem
- Audience understands the engineering (not just the UI)
- Audience sees the execution speed and quality

---

## INTERVIEW CONTEXT

- **Date:** Monday, April 14, 2026
- **Time:** 8:00 AM - 1:00 PM
- **Location:** Cover HQ, LA
- **Audience:** CEO (Alexis Rivas), Head of Ops (Manoj Gavini), Head of Supply Chain (Sam Sun), Head of Post-Sales (Vishal Mane)
- **Presentation:** 30-45 minutes + 15-30 minute Q&A
- **Opportunity:** $250k+ job, potential to scale to $1B+ company

Sam is presenting two projects:
1. **Production Optimization Strategy** (research + plans for scaling 800→1,400+ sq ft/week)
2. **Frontier Safety Assistant** (proof of execution — "here's how we build systems that solve operational problems")

Together, they tell the story: "I understand the problem. I know how to solve it. I can build it. Here's proof."

---

## RESOURCES & LINKS

- **Live Demo:** https://safetyassist-c6zgcvzv.manus.space
- **GitHub:** https://github.com/Theesamkos/frontier-safety-assistant
- **Tech Docs:**
  - [OpenAI Whisper](https://platform.openai.com/docs/guides/speech-to-text)
  - [OpenAI TTS](https://platform.openai.com/docs/guides/text-to-speech)
  - [tRPC Documentation](https://trpc.io)
  - [Drizzle ORM](https://orm.drizzle.team)
  - [Radix UI](https://www.radix-ui.com)

---

**Last Updated:** April 12, 2026
**Status:** Ready for Phase 1 implementation
**Next Step:** Implement Phase 1 (Demo Experience)

---

# ENHANCEMENT SKILLS PACKAGE

8 major enhancement skills to transform the app from "good" to "exceptional" for the Monday demo.

| Skill | Impact | Priority |
|-------|--------|----------|
| **Skill 1: Superhuman Worker AI** | Predictive guidance, error prevention, confidence scoring | High |
| **Skill 2: UX/UI Polish** | Micro-interactions, skeleton loaders, toast notifications, dark mode | Medium |
| **Skill 3: Performance Optimization** | Code splitting, lazy loading, API caching | Medium |
| **Skill 4: Analytics & Insights** | Worker metrics, trending issues chart | Medium |
| **Skill 5: Voice Mastery** | Voice selector (6 voices), speed control | Low |
| **Skill 6: Mobile-First Design** | Landscape mode, gloved-hand UX, offline support | Medium |
| **Skill 7: Error Recovery** | Retry logic, error boundary, connection loss indicator | Low |
| **Skill 8: Compliance & Security** | Audit logging, RBAC, AES-256 encryption | High |

---

## SKILL 1: SUPERHUMAN WORKER AI

### New Files

**`server/_core/ai/predictive-guidance.ts`**
```typescript
import { openai } from "@/lib/openai";

interface PredictiveGuidanceInput {
  currentStep: number;
  completedSteps: string[];
  equipmentSpecs: Record<string, any>;
  industryContext: "aviation" | "manufacturing";
  recentAlerts: Alert[];
}

export async function generatePredictiveGuidance(
  input: PredictiveGuidanceInput
): Promise<string> {
  const systemPrompt = `You are a superhuman AI co-pilot for frontline workers. Your job is to:
1. Anticipate the worker's next need BEFORE they ask
2. Suggest the most efficient path forward
3. Warn about common mistakes at this stage
4. Provide context-specific tips that save time

Keep responses to 1-2 sentences. Be proactive, not reactive.`;

  const userPrompt = `
Current step: ${input.currentStep}
Completed steps: ${input.completedSteps.join(", ")}
Recent alerts: ${input.recentAlerts.map(a => a.title).join(", ")}

What should the worker do next? Anticipate their needs.`;

  const response = await openai.chat.completions.create({
    model: "gpt-4-turbo",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ],
    temperature: 0.7,
    max_tokens: 150
  });

  return response.choices[0].message.content || "";
}
```

**`server/_core/ai/error-prevention.ts`**
```typescript
export async function detectPotentialErrors(
  workerInput: string,
  stepContext: StepContext,
  equipmentSpecs: Record<string, any>
): Promise<ErrorWarning[]> {
  const warnings: ErrorWarning[] = [];
  const numericMatch = workerInput.match(/\b\d+(?:\.\d+)?\b/);
  if (!numericMatch) {
    warnings.push({
      severity: "warning",
      message: "No numeric reading detected. Did you mean to enter a value?",
      suggestion: "Try saying the number again, e.g., '2800 PSI'"
    });
    return warnings;
  }
  const value = parseFloat(numericMatch[0]);
  const spec = equipmentSpecs[stepContext.parameterName];
  if (value > spec.max * 1.5) {
    warnings.push({
      severity: "critical",
      message: `Reading ${value} is 50% above maximum (${spec.max}). Is this correct?`,
      suggestion: "Double-check the gauge. This might be a misread."
    });
  }
  if (value < spec.min * 0.5) {
    warnings.push({
      severity: "critical",
      message: `Reading ${value} is 50% below minimum (${spec.min}). Is this correct?`,
      suggestion: "Verify the equipment is powered on and functioning."
    });
  }
  return warnings;
}

interface ErrorWarning {
  severity: "warning" | "critical";
  message: string;
  suggestion: string;
}
```

**`server/_core/ai/contextual-tips.ts`**
```typescript
export async function generateContextualTip(
  stepName: string,
  industryContext: "aviation" | "manufacturing",
  workerExperience: "novice" | "intermediate" | "expert"
): Promise<string> {
  const tips: Record<string, Record<string, string[]>> = {
    aviation: {
      "Hydraulic Pressure": [
        "Novice: Check the gauge is at eye level before reading",
        "Intermediate: Tap the gauge gently to settle the needle",
        "Expert: Account for temperature variations in pressure readings"
      ]
    },
    manufacturing: {
      "Transformer Temperature": [
        "Novice: Let the thermometer settle for 10 seconds",
        "Intermediate: Check multiple points on the transformer",
        "Expert: Account for thermal gradients and ambient conditions"
      ]
    }
  };
  const tipList = tips[industryContext]?.[stepName] || [];
  const tip = tipList[workerExperience === "novice" ? 0 : workerExperience === "intermediate" ? 1 : 2];
  return tip || "Focus on accuracy over speed. Double-check your reading.";
}
```

**`server/_core/ai/confidence-scoring.ts`**
```typescript
export function calculateConfidenceScore(
  workerInput: string,
  validationResult: ValidationResult,
  historicalData: InspectionStep[]
): number {
  let confidence = 100;
  if (!workerInput.match(/\d+(?:\.\d+)?/)) confidence -= 20;
  if (validationResult.isInSpec === false) confidence -= 15;
  const historicalAvg = historicalData.reduce((sum, step) => {
    return sum + parseFloat(step.readingValue || "0");
  }, 0) / historicalData.length;
  const currentVal = parseFloat(workerInput.match(/\d+(?:\.\d+)?/)?.[0] || "0");
  if (Math.abs(currentVal - historicalAvg) > historicalAvg * 0.3) confidence -= 10;
  return Math.max(0, Math.min(100, confidence));
}
```

### Integration in `server/_core/routes/inspection.ts`
In the `submitStep` handler, add:
```typescript
const [predictiveGuidance, errorWarnings, contextualTip] = await Promise.all([
  generatePredictiveGuidance({ currentStep, completedSteps, equipmentSpecs, industryContext, recentAlerts }),
  detectPotentialErrors(workerInput, stepContext, equipmentSpecs),
  generateContextualTip(step.stepName, inspection.industry, worker.experienceLevel)
]);
const confidenceScore = calculateConfidenceScore(workerInput, validationResult, historicalSteps);
return { ...existingResponse, predictiveGuidance, errorWarnings, contextualTip, confidenceScore };
```

### Client-Side Display in `client/src/components/InspectionFlow.tsx`
```typescript
// Confidence score bar
<div className="flex items-center gap-2 mb-4">
  <span className="text-sm font-semibold">Confidence</span>
  <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
    <div
      className={`h-full transition-all ${confidenceScore >= 80 ? "bg-green-500" : confidenceScore >= 60 ? "bg-yellow-500" : "bg-red-500"}`}
      style={{ width: `${confidenceScore}%` }}
    />
  </div>
  <span className="text-sm text-gray-600">{confidenceScore}%</span>
</div>

// Contextual tip card
<Card className="bg-blue-50 border-blue-200">
  <CardContent className="pt-4">
    <div className="flex items-start gap-2">
      <Lightbulb className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
      <p className="text-sm text-blue-900">{contextualTip}</p>
    </div>
  </CardContent>
</Card>

// Predictive guidance card
<Card className="bg-purple-50 border-purple-200">
  <CardContent className="pt-4">
    <div className="flex items-start gap-2">
      <Zap className="h-5 w-5 text-purple-600 mt-0.5 flex-shrink-0" />
      <p className="text-sm text-purple-900">Next: {predictiveGuidance}</p>
    </div>
  </CardContent>
</Card>
```

---

## SKILL 2: UX/UI POLISH

**`client/src/components/ui/enhanced-button.tsx`** — Framer Motion spring animations on hover/tap.

**`client/src/components/ui/skeleton-loader.tsx`** — `InspectionSkeleton` with `Skeleton` components matching content shapes.

**`client/src/lib/toast-helpers.ts`** — `toastSuccess`, `toastError`, `toastWarning`, `toastInfo` using sonner with Lucide icons.

**`client/src/components/theme-toggle.tsx`** — Moon/Sun toggle using `next-themes`.

All interactive elements get `aria-label`, `aria-pressed`, `aria-live` attributes per WCAG.

---

## SKILL 3: PERFORMANCE OPTIMIZATION

- Wrap `Inspection`, `Report`, `Supervisor` pages in `React.lazy()` + `<Suspense fallback={<InspectionSkeleton />}>`
- `QueryClient` with `staleTime: 5min`, `gcTime: 10min`, exponential retry backoff
- All images use `loading="lazy"` + `decoding="async"`
- Add `vite-plugin-visualizer` for bundle analysis: `pnpm analyze`

---

## SKILL 4: ANALYTICS & INSIGHTS

**`server/_core/routes/analytics.ts`** — `getWorkerMetrics(workerId)` and `getTrendingIssues(industry)` queries.

**`client/src/components/AnalyticsDashboard.tsx`** — `TrendingIssuesChart` using Recharts `BarChart`.

---

## SKILL 5: VOICE MASTERY

**`client/src/components/VoiceSelector.tsx`** — Radix `Select` for 6 voices (alloy, echo, fable, onyx, nova, shimmer). Persists to `localStorage`.

**`client/src/components/VoiceSpeedControl.tsx`** — Radix `Slider` from 0.5x–2x. Persists to `localStorage`.

**`server/_core/routes/voice.ts`** — Update `speak()` to accept `voice` and `speed` params, clamped to OpenAI's valid range.

---

## SKILL 6: MOBILE-FIRST DESIGN

**`client/src/hooks/useOrientation.ts`** — Listens to `orientationchange` + `resize`, returns `"portrait" | "landscape"`.

**`client/src/components/GlovedHandButton.tsx`** — `h-16 text-lg min-w-[120px] rounded-xl` for large touch targets.

**`client/src/lib/offline-support.ts`** — `useOnlineStatus()` hook listening to `online`/`offline` events.

---

## SKILL 7: ERROR RECOVERY

**`client/src/lib/retry-logic.ts`** — `retryWithBackoff(fn, maxRetries=3, initialDelay=1000)` with exponential backoff.

**`client/src/components/ErrorBoundary.tsx`** — Class component with `getDerivedStateFromError`, renders a full-page error UI with reload button.

**`client/src/components/ConnectionStatus.tsx`** — Fixed bottom banner shown when `useOnlineStatus()` returns `false`.

---

## SKILL 8: COMPLIANCE & SECURITY

**`server/_core/routes/audit.ts`** — `logAuditEvent(userId, action, resource, details)` inserts to `audit_logs` table.

**`server/_core/middleware/rbac.ts`** — `checkPermission(userId, resource, action)` with role map: worker → read/write inspection; supervisor → + dashboard/alert; admin → `*`.

**`server/_core/lib/encryption.ts`** — `encryptData` / `decryptData` using AES-256-GCM with random IV + auth tag.

### New DB Tables (add to `server/_core/db/schema.ts`)
```typescript
export const auditLogs = mysqlTable("audit_logs", {
  id: varchar("id", { length: 32 }).primaryKey(),
  userId: varchar("user_id", { length: 32 }).notNull(),
  action: varchar("action", { length: 255 }).notNull(),
  resource: varchar("resource", { length: 255 }).notNull(),
  details: json("details"),
  timestamp: timestamp("timestamp").defaultNow(),
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent")
});

export const workerMetrics = mysqlTable("worker_metrics", {
  id: varchar("id", { length: 32 }).primaryKey(),
  workerId: varchar("worker_id", { length: 32 }).notNull(),
  totalInspections: int("total_inspections").default(0),
  averageCompletionTime: int("average_completion_time").default(0),
  averageAccuracy: int("average_accuracy").default(0),
  criticalAlertsRaised: int("critical_alerts_raised").default(0),
  updatedAt: timestamp("updated_at").defaultNow()
});
```

---

## DEPENDENCIES TO INSTALL

```bash
pnpm add framer-motion next-themes recharts
pnpm add -D vite-plugin-visualizer
```

---

## ENHANCEMENT BUILD CHECKLIST

- [ ] Skill 1: Predictive guidance, error prevention, confidence scoring wired up
- [ ] Skill 2: Animations, skeleton loaders, toasts, dark mode toggle
- [ ] Skill 3: Lazy-loaded routes, query caching, image optimization
- [ ] Skill 4: Analytics routes + Recharts dashboard
- [ ] Skill 5: Voice selector + speed control persisted to localStorage
- [ ] Skill 6: Orientation hook, gloved-hand buttons, offline banner
- [ ] Skill 7: Retry logic, error boundary, connection status component
- [ ] Skill 8: Audit log, RBAC middleware, AES-256 encryption, DB migrations
- [ ] All flows tested end-to-end
- [ ] No console errors
