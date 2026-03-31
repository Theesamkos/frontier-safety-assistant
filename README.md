# Safety-First Workflow Assistant

> **AI-powered aircraft pre-flight inspection simulator built for the Frontier Audio interview demo.**
> Voice-driven. Safety-validated. FAA-compliant. Built for the ramp — not the boardroom.

---

## Overview

Safety-First is a full-stack web application that demonstrates how voice AI can make frontline workers superhuman. It simulates a real-time aircraft pre-flight inspection workflow where a ramp worker can complete an entire 20-step FAA inspection using only their voice — no keyboard, no mouse, no looking at a screen.

Built in under 12 hours as a demonstration of execution speed, real-world problem understanding, and production-quality engineering.

---

## Key Features

| Feature | Description |
|---|---|
| **Voice PTT** | Hold SPACE to record via MediaRecorder API, release to transcribe via Whisper |
| **AI Guidance** | Context-aware step-by-step instructions powered by OpenAI |
| **Safety Validation** | Real-time checks against Boeing/Airbus specs (hydraulic PSI, tire pressure, oil levels, brake temp) |
| **TTS Readback** | AI reads every response aloud via OpenAI TTS — fully hands-free |
| **FAA Report** | Auto-generates FAA Form 8130-3 compliance report from inspection session |
| **Safety Alerts** | CRITICAL/WARNING/INFO alerts with active + history tabs |
| **Live Metrics** | Progress ring, safety checks passed/failed, time elapsed, active alert count |
| **Two Aircraft** | Boeing 737-800 (N737DL) and Airbus A320-200 (N320UA) with real specs |

---

## Tech Stack

```
Frontend:   React 19 + TypeScript + Tailwind CSS 4 + Vite
Backend:    Node.js + Express + tRPC 11
Database:   MySQL (TiDB) + Drizzle ORM
AI:         OpenAI GPT (guidance) + Whisper (transcription) + TTS-1 (voice)
Storage:    AWS S3 (audio uploads)
Auth:       Manus OAuth
Testing:    Vitest (13/13 tests passing)
```

---

## Architecture

```
client/
  src/
    pages/
      Home.tsx          ← Landing page + aircraft selector
      Inspection.tsx    ← Main inspection simulator (voice PTT, AI chat, metrics)
      Report.tsx        ← FAA Form 8130-3 compliance report

server/
  routers.ts            ← tRPC procedures (inspection, AI, voice, alerts, reports)
  db.ts                 ← Query helpers
  _core/
    llm.ts              ← OpenAI LLM integration
    voiceTranscription.ts ← Whisper transcription

drizzle/
  schema.ts             ← Database tables (aircraft, inspections, steps, alerts, reports)
```

---

## Voice Flow

```
User holds SPACE
    → MediaRecorder captures audio (WebM/MP4)
    → Audio uploaded to S3
    → S3 URL sent to backend voice.transcribe endpoint
    → Whisper API transcribes speech to text
    → Text auto-fills and auto-submits
    → AI generates contextual inspection guidance
    → Backend voice.speak endpoint calls OpenAI TTS-1
    → Base64 MP3 returned and played via HTMLAudioElement
    → Worker hears next steps without looking at screen
```

---

## Safety Validation Logic

The system validates worker inputs against real aircraft specifications:

| Parameter | Aircraft | Normal Range | Critical Threshold |
|---|---|---|---|
| Hydraulic Pressure | B737-800 | 2,800–3,200 PSI | < 2,500 PSI |
| Nose Tire Pressure | B737-800 | 170–210 PSI | < 150 PSI |
| Main Tire Pressure | B737-800 | 195–215 PSI | < 170 PSI |
| Engine Oil Level | B737-800 | 10–19 QT | < 8 QT |
| Brake Temperature | B737-800 | < 300°C | > 500°C |
| Fuel Level | B737-800 | 20–100% | < 15% |

---

## Running Locally

```bash
# Install dependencies
pnpm install

# Set environment variables
cp .env.example .env

# Run database migrations
pnpm drizzle-kit generate && pnpm drizzle-kit migrate

# Start development server
pnpm dev

# Run tests
pnpm test
```

---

## Why This Matters

Frontier Audio is building a voice AI wearable to make frontline workers superhuman. This demo shows exactly what that product could do for aviation ground operations:

- **Zero screen time** during inspection — workers keep eyes on the aircraft
- **Proactive safety validation** — not just a checklist, but active spec checking
- **Automatic compliance documentation** — FAA reports generated from voice interactions
- **Predictive guidance** — AI knows the inspection state and tells workers what's next

The gap competitors miss: existing tools (Beekeeper, Axonify, aiOla) are **reactive** — workers ask, tools answer. This system is **proactive** — it knows where you are, validates what you report, and tells you what comes next before you ask.

---

## Built By

**Samuel Kosmala** — Full-stack engineer, Navy veteran, AI builder.
Built for the Frontier Audio / Gauntlet AI Cohort 4 interview, March 2026.
