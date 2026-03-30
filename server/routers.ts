import { COOKIE_NAME } from "@shared/const";
import { TRPCError } from "@trpc/server";
import { nanoid } from "nanoid";
import { z } from "zod";
import {
  acknowledgeAlert,
  createComplianceReport,
  createInspection,
  createInspectionStep,
  createSafetyAlert,
  getAircraftById,
  getAlertsByInspectionId,
  getAllAircraft,
  getInspectionBySessionId,
  getReportByInspectionId,
  getStepsByInspectionId,
  updateInspectionProgress,
  updateInspectionStep,
} from "./db";
import { invokeLLM } from "./_core/llm";
import { transcribeAudio } from "./_core/voiceTranscription";
import { storagePut } from "./storage";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";

// ── Pre-flight inspection checklist template ──────────────────────────────────
const INSPECTION_CHECKLIST = [
  { stepNumber: 1, category: "Documentation", stepName: "Verify aircraft logbook and maintenance records" },
  { stepNumber: 2, category: "Documentation", stepName: "Check airworthiness certificate and registration" },
  { stepNumber: 3, category: "Exterior Walk-Around", stepName: "Inspect nose section and radome for damage" },
  { stepNumber: 4, category: "Exterior Walk-Around", stepName: "Check nose landing gear and tire pressure" },
  { stepNumber: 5, category: "Exterior Walk-Around", stepName: "Inspect left engine inlet and fan blades" },
  { stepNumber: 6, category: "Exterior Walk-Around", stepName: "Check left main landing gear and tire pressure" },
  { stepNumber: 7, category: "Exterior Walk-Around", stepName: "Inspect left wing leading edge and fuel cap" },
  { stepNumber: 8, category: "Exterior Walk-Around", stepName: "Check left wing trailing edge and control surfaces" },
  { stepNumber: 9, category: "Fuel System", stepName: "Verify total fuel quantity and balance" },
  { stepNumber: 10, category: "Fuel System", stepName: "Check for fuel leaks and contamination" },
  { stepNumber: 11, category: "Exterior Walk-Around", stepName: "Inspect tail section and empennage" },
  { stepNumber: 12, category: "Exterior Walk-Around", stepName: "Check APU exhaust and access panels" },
  { stepNumber: 13, category: "Exterior Walk-Around", stepName: "Inspect right wing and control surfaces" },
  { stepNumber: 14, category: "Exterior Walk-Around", stepName: "Check right main landing gear and tire pressure" },
  { stepNumber: 15, category: "Exterior Walk-Around", stepName: "Inspect right engine inlet and fan blades" },
  { stepNumber: 16, category: "Hydraulic System", stepName: "Check hydraulic fluid levels and pressure" },
  { stepNumber: 17, category: "Engine", stepName: "Verify engine oil levels — Engine 1" },
  { stepNumber: 18, category: "Engine", stepName: "Verify engine oil levels — Engine 2" },
  { stepNumber: 19, category: "Brakes", stepName: "Check brake temperature and wear indicators" },
  { stepNumber: 20, category: "Final Sign-Off", stepName: "Complete pre-flight inspection and sign maintenance log" },
];

// ── Safety validation helper ──────────────────────────────────────────────────
function validateReading(
  stepName: string,
  value: string,
  specs: Record<string, unknown>
): { isInSpec: boolean; alerts: Array<{ severity: "critical" | "warning" | "info"; title: string; message: string; parameter: string; actualValue: string; expectedRange: string }> } {
  const alerts: Array<{ severity: "critical" | "warning" | "info"; title: string; message: string; parameter: string; actualValue: string; expectedRange: string }> = [];
  // Extract the last standalone number from the value string (e.g. "Engine 1 oil level 3 QT" → 3)
  const numberMatches = value.match(/\b\d+(?:\.\d+)?\b/g);
  const numVal = numberMatches ? parseFloat(numberMatches[numberMatches.length - 1]!) : NaN;

  if (isNaN(numVal)) return { isInSpec: true, alerts: [] };

  const lower = stepName.toLowerCase();

  if (lower.includes("hydraulic")) {
    const min = specs.hydraulic_pressure_min as number;
    const max = specs.hydraulic_pressure_max as number;
    const unit = specs.hydraulic_pressure_unit as string;
    if (numVal < min) {
      alerts.push({
        severity: numVal < min * 0.9 ? "critical" : "warning",
        title: "Hydraulic Pressure Low",
        message: `Hydraulic pressure reading of ${numVal} ${unit} is below minimum specification. Immediate maintenance inspection required before flight.`,
        parameter: "Hydraulic Pressure",
        actualValue: `${numVal} ${unit}`,
        expectedRange: `${min}–${max} ${unit}`,
      });
    } else if (numVal > max) {
      alerts.push({
        severity: "warning",
        title: "Hydraulic Pressure High",
        message: `Hydraulic pressure of ${numVal} ${unit} exceeds maximum specification. Check for system over-pressurization.`,
        parameter: "Hydraulic Pressure",
        actualValue: `${numVal} ${unit}`,
        expectedRange: `${min}–${max} ${unit}`,
      });
    }
    return { isInSpec: alerts.length === 0, alerts };
  }

  if (lower.includes("nose") && lower.includes("tire")) {
    const min = specs.nose_tire_pressure_min as number;
    const max = specs.nose_tire_pressure_max as number;
    const unit = specs.nose_tire_pressure_unit as string;
    if (numVal < min || numVal > max) {
      alerts.push({
        severity: numVal < min * 0.85 ? "critical" : "warning",
        title: "Nose Tire Pressure Out of Spec",
        message: `Nose tire pressure ${numVal} ${unit} is outside the acceptable range. Adjust before flight.`,
        parameter: "Nose Tire Pressure",
        actualValue: `${numVal} ${unit}`,
        expectedRange: `${min}–${max} ${unit}`,
      });
    }
    return { isInSpec: alerts.length === 0, alerts };
  }

  if (lower.includes("main") && lower.includes("tire")) {
    const min = specs.main_tire_pressure_min as number;
    const max = specs.main_tire_pressure_max as number;
    const unit = specs.main_tire_pressure_unit as string;
    if (numVal < min || numVal > max) {
      alerts.push({
        severity: numVal < min * 0.85 ? "critical" : "warning",
        title: "Main Tire Pressure Out of Spec",
        message: `Main gear tire pressure ${numVal} ${unit} is outside the acceptable range.`,
        parameter: "Main Tire Pressure",
        actualValue: `${numVal} ${unit}`,
        expectedRange: `${min}–${max} ${unit}`,
      });
    }
    return { isInSpec: alerts.length === 0, alerts };
  }

  if (lower.includes("fuel") && lower.includes("quantity")) {
    const min = specs.fuel_min_pct as number;
    if (numVal < min) {
      alerts.push({
        severity: "critical",
        title: "Fuel Level Critical",
        message: `Fuel quantity ${numVal}% is below minimum required level of ${min}%. Flight cannot proceed.`,
        parameter: "Fuel Quantity",
        actualValue: `${numVal}%`,
        expectedRange: `≥${min}%`,
      });
    }
    return { isInSpec: alerts.length === 0, alerts };
  }

  if (lower.includes("engine oil") || (lower.includes("oil") && lower.includes("engine"))) {
    const min = specs.engine_oil_min_qt as number;
    const max = specs.engine_oil_max_qt as number;
    const unit = specs.engine_oil_unit as string;
    if (numVal < min) {
      alerts.push({
        severity: "critical",
        title: "Engine Oil Level Low",
        message: `Engine oil level ${numVal} ${unit} is below minimum specification of ${min} ${unit}. Do not dispatch.`,
        parameter: "Engine Oil",
        actualValue: `${numVal} ${unit}`,
        expectedRange: `${min}–${max} ${unit}`,
      });
    }
    return { isInSpec: alerts.length === 0, alerts };
  }

  if (lower.includes("brake temp")) {
    const max = specs.brake_temp_max_c as number;
    if (numVal > max) {
      alerts.push({
        severity: numVal > max * 1.2 ? "critical" : "warning",
        title: "Brake Temperature Elevated",
        message: `Brake temperature ${numVal}°C exceeds maximum of ${max}°C. Allow cooling before departure.`,
        parameter: "Brake Temperature",
        actualValue: `${numVal}°C`,
        expectedRange: `≤${max}°C`,
      });
    }
    return { isInSpec: alerts.length === 0, alerts };
  }

  return { isInSpec: true, alerts: [] };
}

// ── Compliance report generator ───────────────────────────────────────────────
function generateComplianceContent(
  inspection: Awaited<ReturnType<typeof getInspectionBySessionId>>,
  steps: Awaited<ReturnType<typeof getStepsByInspectionId>>,
  alerts: Awaited<ReturnType<typeof getAlertsByInspectionId>>,
  aircraftData: Awaited<ReturnType<typeof getAircraftById>>
) {
  const completedSteps = steps.filter(s => s.status === "passed" || s.status === "failed");
  const passedSteps = steps.filter(s => s.status === "passed");
  const failedSteps = steps.filter(s => s.status === "failed");
  const criticalAlerts = alerts.filter(a => a.severity === "critical");
  const now = new Date();

  return {
    reportMetadata: {
      reportNumber: `FAA-8130-${Date.now()}`,
      formType: "FAA Form 8130-3",
      generatedAt: now.toISOString(),
      generatedBy: "Safety-First Workflow Assistant v1.0",
      regulatoryBasis: "14 CFR Part 43 — Maintenance, Preventive Maintenance, Rebuilding, and Alteration",
    },
    aircraftInfo: {
      tailNumber: aircraftData?.tailNumber ?? "N/A",
      model: aircraftData?.model ?? "N/A",
      manufacturer: aircraftData?.manufacturer ?? "N/A",
    },
    inspectionSummary: {
      inspectorName: inspection?.inspectorName ?? "Unknown",
      startTime: inspection?.startedAt?.toISOString() ?? now.toISOString(),
      completionTime: now.toISOString(),
      totalSteps: inspection?.totalSteps ?? 0,
      completedSteps: completedSteps.length,
      passedSteps: passedSteps.length,
      failedSteps: failedSteps.length,
      overallStatus: criticalAlerts.length > 0 ? "HOLD — CRITICAL FINDINGS" : failedSteps.length > 0 ? "CONDITIONAL — REVIEW REQUIRED" : "AIRWORTHY",
    },
    stepDetails: completedSteps.map(s => ({
      stepNumber: s.stepNumber,
      category: s.category,
      stepName: s.stepName,
      status: s.status,
      workerInput: s.workerInput ?? "",
      readingValue: s.readingValue ? `${s.readingValue} ${s.readingUnit ?? ""}`.trim() : null,
      isInSpec: s.isInSpec,
      completedAt: s.completedAt?.toISOString() ?? now.toISOString(),
    })),
    safetyFindings: alerts.map(a => ({
      severity: a.severity,
      title: a.title,
      message: a.message,
      parameter: a.parameter,
      actualValue: a.actualValue,
      expectedRange: a.expectedRange,
      acknowledged: a.acknowledged,
      timestamp: a.createdAt?.toISOString() ?? now.toISOString(),
    })),
    certificationStatement: criticalAlerts.length === 0
      ? "I certify that this aircraft has been inspected in accordance with the applicable regulations and is approved for return to service."
      : "This aircraft has OPEN DISCREPANCIES that must be resolved before return to service. See safety findings above.",
  };
}

// ── Router ────────────────────────────────────────────────────────────────────
export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // ── Aircraft ──────────────────────────────────────────────────────────────
  aircraft: router({
    list: publicProcedure.query(async () => {
      return getAllAircraft();
    }),
    getById: publicProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
      return getAircraftById(input.id);
    }),
  }),

  // ── Inspection ────────────────────────────────────────────────────────────
  inspection: router({
    start: publicProcedure
      .input(z.object({
        aircraftId: z.number(),
        inspectorName: z.string().min(1),
      }))
      .mutation(async ({ input }) => {
        const sessionId = nanoid(32);
        const inspection = await createInspection({
          sessionId,
          aircraftId: input.aircraftId,
          inspectorName: input.inspectorName,
          totalSteps: INSPECTION_CHECKLIST.length,
        });

        // Pre-create all steps
        for (const step of INSPECTION_CHECKLIST) {
          await createInspectionStep({
            inspectionId: inspection.id,
            stepNumber: step.stepNumber,
            category: step.category,
            stepName: step.stepName,
          });
        }

        return { sessionId, inspectionId: inspection.id, totalSteps: INSPECTION_CHECKLIST.length };
      }),

    getState: publicProcedure
      .input(z.object({ sessionId: z.string() }))
      .query(async ({ input }) => {
        const inspection = await getInspectionBySessionId(input.sessionId);
        if (!inspection) throw new TRPCError({ code: "NOT_FOUND", message: "Inspection session not found" });

        const steps = await getStepsByInspectionId(inspection.id);
        const alerts = await getAlertsByInspectionId(inspection.id);
        const aircraftData = await getAircraftById(inspection.aircraftId);

        return { inspection, steps, alerts, aircraft: aircraftData };
      }),

    submitStep: publicProcedure
      .input(z.object({
        sessionId: z.string(),
        stepNumber: z.number(),
        workerInput: z.string(),
      }))
      .mutation(async ({ input }) => {
        const inspection = await getInspectionBySessionId(input.sessionId);
        if (!inspection) throw new TRPCError({ code: "NOT_FOUND" });

        const steps = await getStepsByInspectionId(inspection.id);
        const step = steps.find(s => s.stepNumber === input.stepNumber);
        if (!step) throw new TRPCError({ code: "NOT_FOUND", message: "Step not found" });

        const aircraftData = await getAircraftById(inspection.aircraftId);
        const specs = (aircraftData?.specs ?? {}) as Record<string, unknown>;

        // Validate reading
        const validation = validateReading(step.stepName, input.workerInput, specs);

        // Generate AI response
        const previousSteps = steps.filter(s => s.stepNumber < input.stepNumber && s.status !== "pending");
        const nextStep = INSPECTION_CHECKLIST.find(s => s.stepNumber === input.stepNumber + 1);

        const systemPrompt = `You are an expert aviation safety AI assistant embedded in a wearable device for aircraft pre-flight inspections. You guide maintenance technicians through FAA-compliant procedures with precision, authority, and care for safety.

Aircraft: ${aircraftData?.manufacturer} ${aircraftData?.model} (${aircraftData?.tailNumber})
Current Step ${input.stepNumber}/${INSPECTION_CHECKLIST.length}: ${step.stepName}
Category: ${step.category}
Reading In-Spec: ${validation.isInSpec}
${validation.alerts.length > 0 ? `SAFETY ALERTS: ${validation.alerts.map(a => a.title).join(", ")}` : ""}

Respond in 2-3 sentences. Be direct, technical, and authoritative. If there are safety issues, address them first. If everything is good, confirm and preview the next step. Do not use markdown headers. Use aviation terminology naturally.`;

        const userMessage = `Worker input for "${step.stepName}": "${input.workerInput}"`;

        let aiResponse = "";
        try {
          const llmResult = await invokeLLM({
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userMessage },
            ],
          });
          aiResponse = (llmResult as { choices: Array<{ message: { content: string } }> }).choices[0]?.message?.content ?? "";
        } catch (e) {
          aiResponse = validation.isInSpec
            ? `Step ${input.stepNumber} confirmed. ${nextStep ? `Proceed to: ${nextStep.stepName}.` : "All steps complete."}`
            : `⚠️ Out-of-spec reading detected. ${validation.alerts[0]?.message ?? "Review required before proceeding."}`;
        }

        // Save step result
        const newCompletedCount = (inspection.completedSteps ?? 0) + 1;
        const passedCount = validation.isInSpec
          ? (inspection.safetyChecksPassed ?? 0) + 1
          : (inspection.safetyChecksPassed ?? 0);
        const failedCount = !validation.isInSpec
          ? (inspection.safetyChecksFailed ?? 0) + 1
          : (inspection.safetyChecksFailed ?? 0);

        await updateInspectionStep(step.id, {
          workerInput: input.workerInput,
          aiResponse,
          status: validation.isInSpec ? "passed" : "failed",
          isInSpec: validation.isInSpec,
          completedAt: new Date(),
        });

        // Create safety alerts in DB
        for (const alert of validation.alerts) {
          await createSafetyAlert({
            inspectionId: inspection.id,
            stepId: step.id,
            ...alert,
          });
        }

        // Update inspection progress
        const isLastStep = input.stepNumber === INSPECTION_CHECKLIST.length;
        await updateInspectionProgress(inspection.id, {
          completedSteps: newCompletedCount,
          safetyChecksPassed: passedCount,
          safetyChecksFailed: failedCount,
          ...(isLastStep ? { status: "completed", completedAt: new Date() } : {}),
        });

        return {
          aiResponse,
          isInSpec: validation.isInSpec,
          newAlerts: validation.alerts,
          nextStepNumber: isLastStep ? null : input.stepNumber + 1,
          nextStepName: nextStep?.stepName ?? null,
          isComplete: isLastStep,
        };
      }),

    complete: publicProcedure
      .input(z.object({ sessionId: z.string() }))
      .mutation(async ({ input }) => {
        const inspection = await getInspectionBySessionId(input.sessionId);
        if (!inspection) throw new TRPCError({ code: "NOT_FOUND" });
        await updateInspectionProgress(inspection.id, { status: "completed", completedAt: new Date() });
        return { success: true };
      }),
  }),

  // ── AI Guidance ───────────────────────────────────────────────────────────
  guidance: router({
    ask: publicProcedure
      .input(z.object({
        sessionId: z.string(),
        question: z.string(),
        currentStepNumber: z.number(),
      }))
      .mutation(async ({ input }) => {
        const inspection = await getInspectionBySessionId(input.sessionId);
        if (!inspection) throw new TRPCError({ code: "NOT_FOUND" });

        const aircraftData = await getAircraftById(inspection.aircraftId);
        const currentStep = INSPECTION_CHECKLIST.find(s => s.stepNumber === input.currentStepNumber);

        const systemPrompt = `You are an expert aviation safety AI assistant. Answer questions about aircraft pre-flight inspections with technical precision.
Aircraft: ${aircraftData?.manufacturer} ${aircraftData?.model} (${aircraftData?.tailNumber})
Current inspection step: ${currentStep?.stepName ?? "Unknown"}
Keep answers concise (2-3 sentences), technical, and safety-focused.`;

        try {
          const llmResult = await invokeLLM({
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: input.question },
            ],
          });
          return { answer: (llmResult as { choices: Array<{ message: { content: string } }> }).choices[0]?.message?.content ?? "" };
        } catch {
          return { answer: "I'm unable to process that query right now. Please refer to the aircraft maintenance manual for guidance." };
        }
      }),
  }),

  // ── Alerts ────────────────────────────────────────────────────────────────
  alerts: router({
    acknowledge: publicProcedure
      .input(z.object({ alertId: z.number() }))
      .mutation(async ({ input }) => {
        await acknowledgeAlert(input.alertId);
        return { success: true };
      }),
  }),

  // ── Voice Transcription ────────────────────────────────────────────────────
  voice: router({
    transcribe: publicProcedure
      .input(z.object({
        audioBase64: z.string(),
        mimeType: z.string().default("audio/webm"),
      }))
      .mutation(async ({ input }) => {
        // Decode base64 audio and upload to S3
        const audioBuffer = Buffer.from(input.audioBase64, "base64");
        const fileKey = `voice-recordings/inspection-${Date.now()}-${Math.random().toString(36).slice(2)}.webm`;
        const { url: audioUrl } = await storagePut(fileKey, audioBuffer, input.mimeType);

        // Transcribe via Whisper
        const result = await transcribeAudio({
          audioUrl,
          language: "en",
          prompt: "Aircraft pre-flight inspection reading. Technical aviation terminology, PSI, QT, degrees Celsius.",
        });

        if ("error" in result) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: result.error });
        }

        return { text: result.text, language: result.language };
      }),

    speak: publicProcedure
      .input(z.object({
        text: z.string().max(4096),
        voice: z.enum(["alloy", "echo", "fable", "onyx", "nova", "shimmer"]).default("nova"),
      }))
      .mutation(async ({ input }) => {
        // Strip markdown symbols for cleaner speech
        const cleanText = input.text
          .replace(/\*\*(.*?)\*\*/g, "$1")
          .replace(/\*(.*?)\*/g, "$1")
          .replace(/`(.*?)`/g, "$1")
          .replace(/#{1,6}\s/g, "")
          .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
          .trim();

        const baseUrl = process.env.BUILT_IN_FORGE_API_URL?.endsWith("/")
          ? process.env.BUILT_IN_FORGE_API_URL
          : `${process.env.BUILT_IN_FORGE_API_URL}/`;

        const response = await fetch(`${baseUrl}v1/audio/speech`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${process.env.BUILT_IN_FORGE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "tts-1",
            input: cleanText,
            voice: input.voice,
            response_format: "mp3",
          }),
        });

        if (!response.ok) {
          const err = await response.text().catch(() => "");
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `TTS failed: ${response.status} ${err}`,
          });
        }

        const audioBuffer = Buffer.from(await response.arrayBuffer());
        const audioBase64 = audioBuffer.toString("base64");
        return { audioBase64, mimeType: "audio/mpeg" };
      }),
  }),

  // ── Compliance Report ─────────────────────────────────────────────────────
  report: router({
    generate: publicProcedure
      .input(z.object({ sessionId: z.string() }))
      .mutation(async ({ input }) => {
        const inspection = await getInspectionBySessionId(input.sessionId);
        if (!inspection) throw new TRPCError({ code: "NOT_FOUND" });

        // Check if already generated
        const existing = await getReportByInspectionId(inspection.id);
        if (existing) return existing;

        const steps = await getStepsByInspectionId(inspection.id);
        const alerts = await getAlertsByInspectionId(inspection.id);
        const aircraftData = await getAircraftById(inspection.aircraftId);

        const content = generateComplianceContent(inspection, steps, alerts, aircraftData);
        const reportNumber = `FAA-8130-${Date.now()}`;

        return createComplianceReport({
          inspectionId: inspection.id,
          reportNumber,
          content,
        });
      }),

    get: publicProcedure
      .input(z.object({ sessionId: z.string() }))
      .query(async ({ input }) => {
        const inspection = await getInspectionBySessionId(input.sessionId);
        if (!inspection) return null;
        return getReportByInspectionId(inspection.id);
      }),
  }),
});

export type AppRouter = typeof appRouter;
