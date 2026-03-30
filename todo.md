# Safety-First Workflow Assistant — TODO

## Backend / Database
- [x] Database schema: inspections, inspection_steps, alerts, compliance_reports
- [x] Aircraft data seed: realistic specs (hydraulic, fuel, landing gear, etc.)
- [x] tRPC router: inspection CRUD (start, update step, complete)
- [x] tRPC router: AI guidance endpoint (context-aware step responses)
- [x] tRPC router: safety validation endpoint (check readings against specs)
- [x] tRPC router: compliance report generation (FAA-format)
- [x] tRPC router: metrics aggregation (completion %, safety checks, time saved)
- [x] Smart number extraction regex (handles "Engine 1 oil level 3 QT" → 3)

## Frontend — Design System
- [x] Dark premium theme (deep navy/charcoal + electric blue accents)
- [x] Global CSS variables and typography (Inter + JetBrains Mono fonts)
- [x] Custom utilities: glass-card, gradient-text, glow-*, status-*, alert-*, voice-input, metric-card
- [x] Custom animations: slide-in-up, flash-alert, pulse-ring
- [x] Responsive layout (mobile + tablet + desktop)

## Frontend — Landing Page
- [x] Hero section with gradient tagline and CTA
- [x] Feature highlights (voice AI, safety validation, compliance docs)
- [x] Simulated aircraft selector (Boeing 737, Airbus A320)
- [x] Inspector name input + "Start Inspection" entry point
- [x] Stats bar + "How It Works" section

## Frontend — Inspection Simulator
- [x] Voice-like command input (mic icon, submit, keyboard shortcut)
- [x] AI response panel with in-spec/out-of-spec badges
- [x] Step-by-step inspection checklist (left sidebar)
- [x] Current step highlight with pulse-ring indicator
- [x] Sample input shortcuts for demo purposes
- [x] Real-time safety validation feedback inline

## Frontend — Safety Alert System
- [x] Alert panel (CRITICAL / WARNING / INFO levels with glow effects)
- [x] Out-of-spec reading detection and visual flash
- [x] Dismiss / acknowledge alerts
- [x] Critical alert toast notifications

## Frontend — Live Metrics Dashboard
- [x] Completion percentage ring chart (SVG)
- [x] Safety checks passed/failed counters
- [x] Estimated time saved calculation
- [x] Active alerts count
- [x] Progress bar in header

## Frontend — Compliance Report
- [x] FAA Form 8130-3 structured document
- [x] Airworthiness disposition badge (AIRWORTHY / HOLD / CONDITIONAL)
- [x] Step details grouped by category
- [x] Safety findings with severity badges
- [x] Certification statement with signature lines
- [x] Print / download buttons

## Testing
- [x] Vitest: inspection router unit tests (start, getState, submitStep)
- [x] Vitest: safety validation logic tests (hydraulic, tire pressure, engine oil)
- [x] Vitest: aircraft router tests
- [x] Vitest: alerts acknowledge test
- [x] Vitest: auth router test
- [x] All 11 tests passing, zero TypeScript errors

## UI Redesign + Voice Control (Round 2)
- [ ] Implement Bricolage Grotesque + JetBrains Mono typography system
- [ ] Redesign global CSS with cream/white/off-white + red/green/amber design tokens
- [ ] Redesign landing page (Home.tsx) — bold hero, aircraft selector cards
- [ ] Redesign Inspection page (Inspection.tsx) — radical layout, ghost number, spec cards, top-bar alert
- [ ] Redesign Report page (Report.tsx) — clean document-style FAA report
- [ ] CRITICAL FIX: Replace Web Speech API (network error) with MediaRecorder + Whisper backend transcription
- [ ] Spacebar PTT: hold to record via MediaRecorder, release to POST audio to /api/transcribe, auto-fill input and submit
- [ ] Visual recording indicator (waveform animation + red pulsing border on input)
- [ ] Add visual voice recording indicator (pulsing ring, waveform, status overlay)
- [ ] Ensure full mobile/tablet responsive layout

## Critical UX Fixes (Demo Polish)
- [ ] Fix chat bubble overlap — ME bubbles floating over AI responses (layout/z-index issue)
- [ ] Remove blinking cursors from all chat messages (typewriter effect leaving cursor artifact)
- [ ] Auto-submit after voice transcription — no Enter key needed, send immediately on transcribe success
- [ ] Add Text-to-Speech (Web Speech API SpeechSynthesis) — AI reads back every response aloud after it arrives

## TTS Voice Quality Fix
- [ ] Replace browser speechSynthesis (robotic) with OpenAI TTS API (tts-1, voice: "nova") via backend
- [ ] Backend tRPC endpoint: calls OpenAI TTS, returns audio as base64 or streams audio
- [ ] Frontend: receives audio, plays via HTMLAudioElement — clear, calm, professional voice

## Voice Quality Fix v2 (Critical — Interview Blocker)
- [ ] Switch TTS voice from "nova" to "onyx" (deep, calm, authoritative male)
- [ ] Add spoken text pre-processor: strip to 1-2 short sentences, remove all markdown, remove filler
- [ ] Increase TTS speed to 1.1x for crisp operational delivery
- [ ] Test voice in browser before delivering
