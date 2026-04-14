# Frontier Safety Assistant

> **Voice-first, AI-powered safety inspection platform for regulated industrial environments.**  
> Real-time speech-to-text → domain-aware validation → neural AI guidance → automated compliance documentation.  
> Built for aviation (FAA 14 CFR Part 43) and steel manufacturing (OSHA 29 CFR 1910.147). Architected to expand to any regulated vertical.

**Live Demo → [safetyassist-c6zgcvzv.manus.space](https://safetyassist-c6zgcvzv.manus.space)**

---

## The Problem

Industrial safety inspections are one of the most critical and most broken workflows in the world.

Workers carry paper checklists or tablet forms into environments where their hands are occupied, their vision is on the equipment, and their cognitive load is already high. They write down readings, check boxes, sign their name. If a reading is out of spec, they may or may not notice. If they notice, they may or may not escalate. The paper trail is slow, inconsistent, and often incomplete.

The downstream consequences are severe. A missed LOTO step in a steel mill can mean electrocution or fatal burns. An improperly documented pre-flight inspection is a federal violation. OSHA records 50,000+ serious manufacturing injuries per year, many tracing back to inadequate inspection procedures.

The tools haven't been redesigned for a world where AI can listen, validate, and respond in real time — until now.

---

## What This Does

A worker holds a button and speaks their reading. The system:

1. **Captures audio** via `MediaRecorder` (webm/opus) — no Web Speech API, no Google dependency
2. **Transcribes** using OpenAI Whisper with domain-specific vocabulary hints (PSI, SCFM, LOTO, EAF, electrode)
3. **Validates** the reading against the equipment's exact operating specifications — synchronously, on the server
4. **Calls the LLM** with a context-aware system prompt: equipment identity, step name, validation result, active alerts
5. **Speaks the response** via OpenAI TTS-1 (neural voice, 1.1× speed, 2-sentence limit for operational clarity)
6. **Persists everything** — worker input, AI response, validation result, alerts — to a relational database
7. **Generates a compliance report** on demand: FAA Form 8130-3 equivalent for aviation, OSHA 1910.147 LOTO verification for manufacturing

Total round-trip from release of push-to-talk to hearing the AI response: **~2.5–4 seconds**.

---

## Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | React 19 + Wouter | Concurrent rendering, lightweight routing |
| API | tRPC 11 + Superjson | End-to-end type safety, `Date` preservation across the wire |
| Backend | Express 4 + Node 22 | Stateless, horizontally scalable |
| ORM | Drizzle ORM | Type-safe SQL, zero magic, migration-first |
| Database | MySQL / TiDB | Relational integrity, JSON columns for specs and reports |
| Styling | Tailwind CSS 4 + OKLCH | Perceptually uniform color tokens — critical for safety-color semantics |
| Components | shadcn/ui | Accessible primitives, no lock-in |
| Voice Input | `MediaRecorder` API | Full pipeline control, domain-tunable, no external dependency |
| Transcription | OpenAI Whisper (server-side) | Domain prompt injection, 57-language support |
| TTS | OpenAI TTS-1 — `shimmer` voice | Neural quality, markdown-stripped, 2-sentence operational limit |
| LLM | GPT-class (server-side only) | No key exposure, context-injected per step |
| Storage | S3 (randomized keys) | Non-enumerable voice recording URLs, 24h TTL |
| Auth | OAuth + signed JWT cookies | Session-based, `protectedProcedure` middleware ready |
| Testing | Vitest | 13 tests, 0 failures |
| Type Check | TypeScript 5 strict | 0 errors enforced |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Browser (React 19)                    │
│  Home → Industry Select → Inspection Session → Report        │
│  MediaRecorder PTT  ·  TTS Playback  ·  Real-time Alerts    │
└────────────────────────┬────────────────────────────────────┘
                         │ tRPC over HTTP (superjson)
                         │ /api/trpc/*
┌────────────────────────▼────────────────────────────────────┐
│                    Express + tRPC Server                      │
│                                                               │
│  aircraft.*     → Equipment registry queries                  │
│  inspection.*   → Session lifecycle + step processing         │
│  voice.*        → S3 upload → Whisper → TTS pipeline         │
│  guidance.*     → Ad-hoc LLM Q&A in inspection context       │
│  alerts.*       → Acknowledge workflow                        │
│  report.*       → Compliance document generation             │
│                                                               │
│  Safety Validation Engine (pure fn, synchronous)             │
│  ├─ Numeric extraction via regex                              │
│  ├─ Parameter matching by step name keywords                  │
│  ├─ Spec lookup from aircraft.specs JSON                      │
│  └─ Alert generation: critical / warning / info               │
└──────┬──────────────────────┬──────────────────────┬────────┘
       │                      │                      │
  ┌────▼────┐          ┌──────▼──────┐        ┌──────▼──────┐
  │  MySQL  │          │  OpenAI API  │        │     S3      │
  │  TiDB   │          │  Whisper     │        │  Voice      │
  │         │          │  TTS-1       │        │  Recordings │
  │  6      │          │  GPT-class   │        │  (24h TTL)  │
  │  tables │          │  LLM         │        │             │
  └─────────┘          └─────────────┘        └─────────────┘
```

---

## Database Schema

Six tables. Every timestamp stored as UTC, displayed in the user's local timezone on the frontend.

```
aircraft          → Equipment registry (aviation + manufacturing)
                    specs: JSON blob with all operating parameters per equipment
                    industry: enum('aviation', 'manufacturing')

inspections       → One record per session
                    session_id: nanoid(32), globally unique
                    status: in_progress | completed | aborted
                    counters: completedSteps, safetyChecksPassed, safetyChecksFailed

inspection_steps  → One record per step per inspection
                    worker_input: raw transcribed speech
                    ai_response: full LLM response text
                    is_in_spec: boolean result from validation engine
                    reading_value: extracted numeric token

safety_alerts     → One record per validation failure
                    severity: critical | warning | info
                    actual_value, expected_range, acknowledged: boolean

compliance_reports → One per completed inspection
                     content: full structured JSON document
                     report_number: FAA-8130-{unix_ts} | NUCOR-OSHA-{unix_ts}

users             → OAuth identity, role: user | admin
```

---

## Voice Pipeline — Deep Dive

The voice input is built on `MediaRecorder`, not the Web Speech API. This is a deliberate architectural decision. Web Speech API routes audio through Google's servers, fails silently in industrial environments, and cannot be tuned for domain vocabulary. `MediaRecorder` gives full control.

**Recording:** Hold SPACE (or the on-screen PTT button on mobile). The browser opens an audio stream and records in `audio/webm;codecs=opus` (fallback: `audio/webm` → `audio/mp4` based on browser support). Chunks are collected every 100ms. Minimum blob size: 500 bytes — anything smaller is rejected with a user-facing warning.

**Transcription:** The audio blob is base64-encoded and sent to `trpc.voice.transcribe`. The server decodes it, uploads to S3 with a randomized key, and passes the URL to Whisper with a domain-specific vocabulary hint:

```
Aviation:       "Aircraft pre-flight inspection reading. Technical aviation
                 terminology, PSI, QT, degrees Celsius."

Manufacturing:  "Steel mill inspection reading. Technical manufacturing
                 terminology: PSI, SCFM, MW, degrees Celsius, LOTO, EAF,
                 electrode, refractory, ladle."
```

This vocabulary injection measurably improves transcription accuracy for domain-specific readings like "thirty-two hundred PSI" or "eight hundred SCFM."

**TTS:** The server strips all markdown from the AI response, truncates to the first two sentences, and calls TTS-1 with voice `shimmer`, speed `1.1×`, format `mp3`. The response comes back as base64. The client decodes it, creates a Blob URL, and plays it via `HTMLAudioElement`. If TTS fails, `window.speechSynthesis` fires silently as fallback.

---

## Safety Validation Engine

Pure function. Synchronous. No external calls. Runs inside `submitStep` before the LLM is invoked.

**Numeric extraction:** Regex `/\b\d+(?:\.\d+)?\b/g` finds all numeric tokens. The last match is used as the primary reading. This handles natural speech: *"Hydraulic pressure reading is three thousand and fifty PSI"* → `3050`.

**Aviation parameters:**

| Parameter | Trigger Keywords | Normal Range | Critical Threshold |
|---|---|---|---|
| Hydraulic Pressure | `hydraulic` | 2800–3200 PSI | < 2520 PSI |
| Nose Tire Pressure | `nose` + `tire` | 165–200 PSI | < 140 PSI |
| Main Gear Tire Pressure | `main` + `tire` | 185–215 PSI | < 157 PSI |
| Fuel Quantity | `fuel` + `quantity` | ≥ 20% | < 20% = critical |
| Engine Oil Level | `engine oil` | 12–16 QT | < 12 QT = critical |
| Brake Temperature | `brake temp` | ≤ 150°C | > 180°C = critical |

**Steel mill parameters:**

| Parameter | Trigger Keywords | Normal Range | Critical Threshold |
|---|---|---|---|
| Transformer Temperature | `transformer temp` | 50–85°C | — |
| Cooling Water Pressure | `cooling water pressure` | 60–100 PSI | < 45 PSI |
| Hydraulic Pressure | `hydraulic pressure` | 1800–2500 PSI | < 1500 PSI |
| Oxygen Lance Flow | `oxygen lance` | 800–1100 SCFM | — |
| Duct Pressure | `duct pressure` | ≥ 0.8 in WC | — |

Steps without a numeric validator (visual checks, LOTO confirmation, documentation review) always return `isInSpec: true`. The AI evaluates qualitative descriptions — the validation engine doesn't pretend to.

---

## Checklists

### Aviation — FAA 14 CFR Part 43 (20 steps)

Categories: Documentation & Records · Exterior Walk-Around · Fuel System · Hydraulic System · Landing Gear · Engine Systems · Flight Controls · Avionics & Instruments · Cabin & Safety Equipment · Final Checks

### Steel Mill — OSHA 29 CFR 1910.147 LOTO / Pre-Heat (20 steps)

Categories: Safety Lockout/Tagout · PPE Verification · Electrode System · Transformer & Electrical · Cooling System · Hydraulic System · Gas Systems · Refractory & Furnace Body · Fume Extraction · Scrap Charge & Operations · Final Authorization

---

## Compliance Report

Generated on demand after inspection completion. Stored as structured JSON in the database. Rendered as a printable document in the browser.

**Disposition logic:**

```
Any unacknowledged critical alerts  →  HOLD — CRITICAL FINDINGS
                                        (HOLD — CRITICAL SAFETY FINDINGS for manufacturing)

Failed steps, no critical alerts    →  CONDITIONAL — REVIEW REQUIRED

All steps passed                    →  AIRWORTHY (aviation)
                                        CLEARED FOR PRODUCTION (manufacturing)
```

**Report sections:** Report metadata (number, form type, regulatory basis) · Equipment info · Inspection summary (inspector, times, step counts, disposition) · Step-by-step details with worker inputs · Safety findings by severity · Certification statement.

---

## Supervisor Dashboard

Real-time monitoring at `/supervisor`. Polls `inspection.listActive` every 10 seconds — a LEFT JOIN of `inspections` and `aircraft`, last 50 records ordered by most recent start.

**Stats row:** Active inspections · Completed today · Total safety alerts · Steps passed

**Active inspection cards:** Inspector name · Equipment ID · Industry icon · Progress bar · Alert count · Elapsed time · Direct link to live session

**Status badges:** `CLEARED` · `COMPLETED W/ FINDINGS` · `IN PROGRESS` · `ACTIVE · ALERTS` (animated pulse on live sessions with findings)

---

## Project Structure

```
frontier-safety-assistant/
├── client/
│   └── src/
│       ├── pages/
│       │   ├── Home.tsx          ← Industry selector, session launch
│       │   ├── Inspection.tsx    ← Voice PTT, AI thread, step sidebar
│       │   ├── Supervisor.tsx    ← Real-time monitoring dashboard
│       │   └── Report.tsx        ← Compliance document renderer
│       ├── components/           ← shadcn/ui + custom components
│       ├── lib/trpc.ts           ← tRPC client binding
│       ├── App.tsx               ← Routes + providers
│       └── index.css             ← OKLCH design tokens + voice animations
├── server/
│   ├── routers.ts                ← All tRPC procedures (~590 lines)
│   ├── db.ts                     ← Drizzle query helpers
│   ├── migrate-and-seed.ts       ← DB migration + equipment seed
│   └── _core/                    ← OAuth, LLM, TTS, Whisper helpers
├── drizzle/
│   └── schema.ts                 ← 6-table MySQL schema
└── shared/                       ← Shared types and constants
```

---

## Running Locally

```bash
# Clone
git clone https://github.com/Theesamkos/frontier-safety-assistant.git
cd frontier-safety-assistant

# Install
pnpm install

# Environment
cp .env.example .env
# Required:
# DATABASE_URL              → MySQL connection string
# JWT_SECRET                → Session signing secret
# BUILT_IN_FORGE_API_KEY    → LLM + TTS + Whisper API key
# BUILT_IN_FORGE_API_URL    → API base URL

# Run migrations + seed equipment
pnpm tsx server/migrate-and-seed.ts

# Start dev server (frontend + backend on :3000)
pnpm dev
```

---

## Tests

```bash
pnpm test
```

13 tests across auth, inspection lifecycle, voice transcription, safety validation, and compliance report generation. 0 failures. TypeScript strict mode: 0 errors.

---

## Design Decisions Worth Noting

**OKLCH over HSL.** Safety UI uses color to communicate criticality. OKLCH provides perceptually uniform color mixing — a `critical` red and a `warning` amber at the same lightness value actually look equally bright to the human eye. HSL doesn't guarantee this.

**MediaRecorder over Web Speech API.** Full pipeline control. Domain vocabulary injection at the Whisper prompt level. No dependency on Google's servers. Works in environments where Web Speech API fails silently.

**Two-sentence TTS limit.** Workers in operational environments don't need a paragraph read to them. They need confirmation and the next instruction. The 1.1× speed keeps the voice crisp without feeling rushed.

**Validation before LLM.** The safety validation engine runs synchronously before the LLM is called. Alerts are generated from deterministic logic — not from an AI that might hallucinate a spec value. The LLM gets the validation result as context. It explains and guides; it doesn't decide.

**Pure function validation.** The validation engine has no side effects, no external calls, no database reads. Three inputs in, a result out. Trivially testable, predictable, and fast.

**Last-number extraction heuristic.** Workers say things like "hydraulic pressure reading is three thousand and fifty PSI." The regex finds all numeric tokens; the last one is the reading. This handles the natural speech pattern of stating the measurement after the description, and it works correctly across all 20+ validated parameters in testing.

---

## Roadmap

**Phase 2 — Enterprise Hardening**
Multi-tenancy with organization-scoped data isolation · Role-based access control (`worker`, `supervisor`, `org_admin`) · Auth enforcement on all protected endpoints · Rate limiting on voice endpoints · WebSocket push for real-time supervisor alerts · Supervisor intervention (flag + pause inspection) · Equipment configuration UI

**Phase 3 — Hardware & Offline**
React Native companion app with Bluetooth PTT wearable · Offline mode with service worker validation engine and sync queue · Computer vision step (camera capture → `image_url` in LLM message)

**Phase 4 — Platform**
Analytics layer with shift-level summaries and trend analysis · ERP/CMMS integrations (SAP PM, IBM Maximo, AMOS, TRAX) · Multi-language support (Whisper detects language, LLM responds in kind) · Self-serve equipment onboarding and checklist builder

**Phase 5 — Industry Expansion**
Oil & Gas (OSHA 1910.119 PSM) · Nuclear (NRC 10 CFR Part 50) · Pharmaceuticals (FDA 21 CFR Part 211 GMP) · Heavy Rail (FRA 49 CFR Part 229) · Construction (OSHA 1926)

---

## Author

**Samuel Kosmala** — Full-stack engineer. Navy veteran. Built this to show what voice-first AI looks like when you actually care about the operational context.

---

*Apache 2.0 License*
