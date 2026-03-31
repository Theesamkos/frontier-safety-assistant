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
  getAllActiveInspections,
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

// ── Aviation Pre-flight Checklist (Boeing 737 / Airbus A320) ──────────────────
const AVIATION_CHECKLIST = [
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

// ── Nucor Steel Mill EAF/Ladle Pre-Heat Checklist ────────────────────────────
const STEEL_MILL_CHECKLIST = [
  { stepNumber: 1, category: "Safety Lockout/Tagout", stepName: "Verify LOTO procedures complete — all energy sources isolated" },
  { stepNumber: 2, category: "Safety Lockout/Tagout", stepName: "Confirm PPE compliance — arc flash suit, face shield, heat-resistant gloves" },
  { stepNumber: 3, category: "Electrical Systems", stepName: "Check electrode arms and clamps for mechanical damage" },
  { stepNumber: 4, category: "Electrical Systems", stepName: "Verify transformer temperature and cooling system status" },
  { stepNumber: 5, category: "Cooling Systems", stepName: "Check cooling water pressure and flow rate — all panels" },
  { stepNumber: 6, category: "Cooling Systems", stepName: "Inspect water-cooled roof and sidewall panels for leaks" },
  { stepNumber: 7, category: "Hydraulic Systems", stepName: "Verify hydraulic pressure — electrode positioning system" },
  { stepNumber: 8, category: "Hydraulic Systems", stepName: "Check hydraulic fluid levels and inspect for leaks" },
  { stepNumber: 9, category: "Gas Systems", stepName: "Verify oxygen lance flow rate and pressure" },
  { stepNumber: 10, category: "Gas Systems", stepName: "Check natural gas and carbon injection system pressures" },
  { stepNumber: 11, category: "Furnace Inspection", stepName: "Inspect furnace shell and roof refractory condition" },
  { stepNumber: 12, category: "Furnace Inspection", stepName: "Check tap hole and slag door condition" },
  { stepNumber: 13, category: "Environmental Controls", stepName: "Verify duct pressure and baghouse fan operation" },
  { stepNumber: 14, category: "Environmental Controls", stepName: "Check fume extraction system — all dampers operational" },
  { stepNumber: 15, category: "Scrap Charge", stepName: "Verify scrap charge weight and composition — heat number logged" },
  { stepNumber: 16, category: "Scrap Charge", stepName: "Confirm scrap bucket integrity and crane clearance" },
  { stepNumber: 17, category: "Power Systems", stepName: "Verify power-on sequence — electrode positioning confirmed" },
  { stepNumber: 18, category: "Process Parameters", stepName: "Confirm target heat temperature and alloy additions schedule" },
  { stepNumber: 19, category: "Emergency Systems", stepName: "Test emergency power-off and quench system readiness" },
  { stepNumber: 20, category: "Final Sign-Off", stepName: "Complete pre-heat checklist — supervisor sign-off and heat number logged" },
];

// ── Checklist selector ────────────────────────────────────────────────────────
function getChecklist(industry: string) {
  return industry === "manufacturing" ? STEEL_MILL_CHECKLIST : AVIATION_CHECKLIST;
}

// ── Aviation Safety Validation ────────────────────────────────────────────────
function validateAviationReading(
  stepName: string,
  value: string,
  specs: Record<string, unknown>
): { isInSpec: boolean; alerts: Array<{ severity: "critical" | "warning" | "info"; title: string; message: string; parameter: string; actualValue: string; expectedRange: string }> } {
  const alerts: Array<{ severity: "critical" | "warning" | "info"; title: string; message: string; parameter: string; actualValue: string; expectedRange: string }> = [];
  const numberMatches = value.match(/\b\d+(?:\.\d+)?\b/g);
  const numVal = numberMatches ? parseFloat(numberMatches[numberMatches.length - 1]!) : NaN;
  if (isNaN(numVal)) return { isInSpec: true, alerts: [] };
  const lower = stepName.toLowerCase();

  if (lower.includes("hydraulic")) {
    const min = specs.hydraulic_pressure_min as number;
    const max = specs.hydraulic_pressure_max as number;
    const unit = specs.hydraulic_pressure_unit as string;
    if (numVal < min) alerts.push({ severity: numVal < min * 0.9 ? "critical" : "warning", title: "Hydraulic Pressure Low", message: `Hydraulic pressure reading of ${numVal} ${unit} is below minimum specification. Immediate maintenance inspection required before flight.`, parameter: "Hydraulic Pressure", actualValue: `${numVal} ${unit}`, expectedRange: `${min}–${max} ${unit}` });
    else if (numVal > max) alerts.push({ severity: "warning", title: "Hydraulic Pressure High", message: `Hydraulic pressure of ${numVal} ${unit} exceeds maximum specification. Check for system over-pressurization.`, parameter: "Hydraulic Pressure", actualValue: `${numVal} ${unit}`, expectedRange: `${min}–${max} ${unit}` });
    return { isInSpec: alerts.length === 0, alerts };
  }
  if (lower.includes("nose") && lower.includes("tire")) {
    const min = specs.nose_tire_pressure_min as number; const max = specs.nose_tire_pressure_max as number; const unit = specs.nose_tire_pressure_unit as string;
    if (numVal < min || numVal > max) alerts.push({ severity: numVal < min * 0.85 ? "critical" : "warning", title: "Nose Tire Pressure Out of Spec", message: `Nose tire pressure ${numVal} ${unit} is outside the acceptable range. Adjust before flight.`, parameter: "Nose Tire Pressure", actualValue: `${numVal} ${unit}`, expectedRange: `${min}–${max} ${unit}` });
    return { isInSpec: alerts.length === 0, alerts };
  }
  if (lower.includes("main") && lower.includes("tire")) {
    const min = specs.main_tire_pressure_min as number; const max = specs.main_tire_pressure_max as number; const unit = specs.main_tire_pressure_unit as string;
    if (numVal < min || numVal > max) alerts.push({ severity: numVal < min * 0.85 ? "critical" : "warning", title: "Main Tire Pressure Out of Spec", message: `Main gear tire pressure ${numVal} ${unit} is outside the acceptable range.`, parameter: "Main Tire Pressure", actualValue: `${numVal} ${unit}`, expectedRange: `${min}–${max} ${unit}` });
    return { isInSpec: alerts.length === 0, alerts };
  }
  if (lower.includes("fuel") && lower.includes("quantity")) {
    const min = specs.fuel_min_pct as number;
    if (numVal < min) alerts.push({ severity: "critical", title: "Fuel Level Critical", message: `Fuel quantity ${numVal}% is below minimum required level of ${min}%. Flight cannot proceed.`, parameter: "Fuel Quantity", actualValue: `${numVal}%`, expectedRange: `≥${min}%` });
    return { isInSpec: alerts.length === 0, alerts };
  }
  if (lower.includes("engine oil") || (lower.includes("oil") && lower.includes("engine"))) {
    const min = specs.engine_oil_min_qt as number; const max = specs.engine_oil_max_qt as number; const unit = specs.engine_oil_unit as string;
    if (numVal < min) alerts.push({ severity: "critical", title: "Engine Oil Level Low", message: `Engine oil level ${numVal} ${unit} is below minimum specification of ${min} ${unit}. Do not dispatch.`, parameter: "Engine Oil", actualValue: `${numVal} ${unit}`, expectedRange: `${min}–${max} ${unit}` });
    return { isInSpec: alerts.length === 0, alerts };
  }
  if (lower.includes("brake temp")) {
    const max = specs.brake_temp_max_c as number;
    if (numVal > max) alerts.push({ severity: numVal > max * 1.2 ? "critical" : "warning", title: "Brake Temperature Elevated", message: `Brake temperature ${numVal}°C exceeds maximum of ${max}°C. Allow cooling before departure.`, parameter: "Brake Temperature", actualValue: `${numVal}°C`, expectedRange: `≤${max}°C` });
    return { isInSpec: alerts.length === 0, alerts };
  }
  return { isInSpec: true, alerts: [] };
}

// ── Steel Mill Safety Validation ─────────────────────────────────────────────
function validateSteelMillReading(
  stepName: string,
  value: string,
  specs: Record<string, unknown>
): { isInSpec: boolean; alerts: Array<{ severity: "critical" | "warning" | "info"; title: string; message: string; parameter: string; actualValue: string; expectedRange: string }> } {
  const alerts: Array<{ severity: "critical" | "warning" | "info"; title: string; message: string; parameter: string; actualValue: string; expectedRange: string }> = [];
  const numberMatches = value.match(/\b\d+(?:\.\d+)?\b/g);
  const numVal = numberMatches ? parseFloat(numberMatches[numberMatches.length - 1]!) : NaN;
  if (isNaN(numVal)) return { isInSpec: true, alerts: [] };
  const lower = stepName.toLowerCase();

  if (lower.includes("transformer temp")) {
    const tempSpec = specs.transformerTemp as { min: number; max: number; unit: string; critical_high: number } | undefined;
    if (tempSpec && numVal > tempSpec.critical_high) alerts.push({ severity: "critical", title: "Transformer Temperature Critical", message: `Transformer temperature ${numVal}°${tempSpec.unit} exceeds critical limit of ${tempSpec.critical_high}°${tempSpec.unit}. Shut down immediately.`, parameter: "Transformer Temperature", actualValue: `${numVal}°${tempSpec.unit}`, expectedRange: `≤${tempSpec.max}°${tempSpec.unit}` });
    else if (tempSpec && numVal > tempSpec.max) alerts.push({ severity: "warning", title: "Transformer Temperature Elevated", message: `Transformer temperature ${numVal}°${tempSpec.unit} exceeds normal operating range. Monitor closely.`, parameter: "Transformer Temperature", actualValue: `${numVal}°${tempSpec.unit}`, expectedRange: `${tempSpec.min}–${tempSpec.max}°${tempSpec.unit}` });
    return { isInSpec: alerts.length === 0, alerts };
  }
  if (lower.includes("cooling water pressure")) {
    const cwSpec = specs.coolingWaterPressure as { min: number; max: number; unit: string; critical_low: number } | undefined;
    if (cwSpec && numVal < cwSpec.critical_low) alerts.push({ severity: "critical", title: "Cooling Water Pressure Critical", message: `Cooling water pressure ${numVal} ${cwSpec.unit} is critically low. Risk of panel burnthrough. Halt operations immediately.`, parameter: "Cooling Water Pressure", actualValue: `${numVal} ${cwSpec.unit}`, expectedRange: `${cwSpec.min}–${cwSpec.max} ${cwSpec.unit}` });
    else if (cwSpec && numVal < cwSpec.min) alerts.push({ severity: "warning", title: "Cooling Water Pressure Low", message: `Cooling water pressure ${numVal} ${cwSpec.unit} is below minimum. Investigate before proceeding.`, parameter: "Cooling Water Pressure", actualValue: `${numVal} ${cwSpec.unit}`, expectedRange: `${cwSpec.min}–${cwSpec.max} ${cwSpec.unit}` });
    return { isInSpec: alerts.length === 0, alerts };
  }
  if (lower.includes("hydraulic pressure")) {
    const hydSpec = specs.hydraulicPressure as { min: number; max: number; unit: string; critical_low: number } | undefined;
    if (hydSpec && numVal < hydSpec.critical_low) alerts.push({ severity: "critical", title: "Hydraulic Pressure Critical", message: `Hydraulic pressure ${numVal} ${hydSpec.unit} is critically low. Electrode positioning system may fail.`, parameter: "Hydraulic Pressure", actualValue: `${numVal} ${hydSpec.unit}`, expectedRange: `${hydSpec.min}–${hydSpec.max} ${hydSpec.unit}` });
    else if (hydSpec && numVal < hydSpec.min) alerts.push({ severity: "warning", title: "Hydraulic Pressure Low", message: `Hydraulic pressure ${numVal} ${hydSpec.unit} is below minimum operating range.`, parameter: "Hydraulic Pressure", actualValue: `${numVal} ${hydSpec.unit}`, expectedRange: `${hydSpec.min}–${hydSpec.max} ${hydSpec.unit}` });
    return { isInSpec: alerts.length === 0, alerts };
  }
  if (lower.includes("oxygen lance")) {
    const o2Spec = specs.oxygenLanceFlow as { min: number; max: number; unit: string } | undefined;
    if (o2Spec && (numVal < o2Spec.min || numVal > o2Spec.max)) alerts.push({ severity: "warning", title: "Oxygen Lance Flow Out of Range", message: `Oxygen lance flow ${numVal} ${o2Spec.unit} is outside the optimal range. Adjust before charging.`, parameter: "Oxygen Lance Flow", actualValue: `${numVal} ${o2Spec.unit}`, expectedRange: `${o2Spec.min}–${o2Spec.max} ${o2Spec.unit}` });
    return { isInSpec: alerts.length === 0, alerts };
  }
  if (lower.includes("duct pressure")) {
    const ductSpec = specs.ductPressure as { min: number; max: number; unit: string } | undefined;
    if (ductSpec && numVal < ductSpec.min) alerts.push({ severity: "warning", title: "Duct Pressure Low", message: `Duct pressure ${numVal} ${ductSpec.unit} is below minimum. Fume extraction may be insufficient.`, parameter: "Duct Pressure", actualValue: `${numVal} ${ductSpec.unit}`, expectedRange: `${ductSpec.min}–${ductSpec.max} ${ductSpec.unit}` });
    return { isInSpec: alerts.length === 0, alerts };
  }
  return { isInSpec: true, alerts: [] };
}

// ── Unified validation router ─────────────────────────────────────────────────
function validateReading(
  stepName: string,
  value: string,
  specs: Record<string, unknown>,
  industry: string
) {
  return industry === "manufacturing"
    ? validateSteelMillReading(stepName, value, specs)
    : validateAviationReading(stepName, value, specs);
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
  const isManufacturing = (aircraftData as { industry?: string })?.industry === "manufacturing";

  return {
    reportMetadata: {
      reportNumber: isManufacturing ? `NUCOR-OSHA-${Date.now()}` : `FAA-8130-${Date.now()}`,
      formType: isManufacturing ? "OSHA 1910.147 LOTO Verification" : "FAA Form 8130-3",
      generatedAt: now.toISOString(),
      generatedBy: "Safety-First Workflow Assistant v1.0",
      regulatoryBasis: isManufacturing
        ? "OSHA 29 CFR 1910.147 — Control of Hazardous Energy (Lockout/Tagout)"
        : "14 CFR Part 43 — Maintenance, Preventive Maintenance, Rebuilding, and Alteration",
    },
    aircraftInfo: {
      tailNumber: aircraftData?.tailNumber ?? "N/A",
      model: aircraftData?.model ?? "N/A",
      manufacturer: aircraftData?.manufacturer ?? "N/A",
      industry: (aircraftData as { industry?: string })?.industry ?? "aviation",
    },
    inspectionSummary: {
      inspectorName: inspection?.inspectorName ?? "Unknown",
      startTime: inspection?.startedAt?.toISOString() ?? now.toISOString(),
      completionTime: now.toISOString(),
      totalSteps: inspection?.totalSteps ?? 0,
      completedSteps: completedSteps.length,
      passedSteps: passedSteps.length,
      failedSteps: failedSteps.length,
      overallStatus: criticalAlerts.length > 0
        ? (isManufacturing ? "HOLD — CRITICAL SAFETY FINDINGS" : "HOLD — CRITICAL FINDINGS")
        : failedSteps.length > 0
          ? "CONDITIONAL — REVIEW REQUIRED"
          : (isManufacturing ? "CLEARED FOR PRODUCTION" : "AIRWORTHY"),
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
      ? (isManufacturing
        ? "I certify that this equipment has been inspected in accordance with OSHA 29 CFR 1910.147 and applicable Nucor safety procedures. Equipment is cleared for production operations."
        : "I certify that this aircraft has been inspected in accordance with the applicable regulations and is approved for return to service.")
      : (isManufacturing
        ? "This equipment has OPEN SAFETY DISCREPANCIES that must be resolved before production operations. See safety findings above."
        : "This aircraft has OPEN DISCREPANCIES that must be resolved before return to service. See safety findings above."),
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
        const aircraftData = await getAircraftById(input.aircraftId);
        if (!aircraftData) throw new TRPCError({ code: "NOT_FOUND", message: "Aircraft not found" });
        const industry = (aircraftData as { industry?: string })?.industry ?? "aviation";
        const checklist = getChecklist(industry);

        const sessionId = nanoid(32);
        const inspection = await createInspection({
          sessionId,
          aircraftId: input.aircraftId,
          inspectorName: input.inspectorName,
          totalSteps: checklist.length,
        });

        for (const step of checklist) {
          await createInspectionStep({
            inspectionId: inspection.id,
            stepNumber: step.stepNumber,
            category: step.category,
            stepName: step.stepName,
          });
        }

        return { sessionId, inspectionId: inspection.id, totalSteps: checklist.length, industry };
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
        const industry = (aircraftData as { industry?: string })?.industry ?? "aviation";
        const checklist = getChecklist(industry);

        const validation = validateReading(step.stepName, input.workerInput, specs, industry);
        const previousSteps = steps.filter(s => s.stepNumber < input.stepNumber && s.status !== "pending");
        const nextStep = checklist.find(s => s.stepNumber === input.stepNumber + 1);

        const isManufacturing = industry === "manufacturing";
        const systemPrompt = isManufacturing
          ? `You are an expert steel manufacturing safety AI embedded in a wearable device for Nucor Steel workers. You guide operators through OSHA-compliant pre-heat inspection procedures with precision and authority.

Equipment: ${aircraftData?.manufacturer} ${aircraftData?.model} (ID: ${aircraftData?.tailNumber})
Current Step ${input.stepNumber}/${checklist.length}: ${step.stepName}
Category: ${step.category}
Reading In-Spec: ${validation.isInSpec}
${validation.alerts.length > 0 ? `SAFETY ALERTS: ${validation.alerts.map(a => a.title).join(", ")}` : ""}

Respond in 2-3 sentences. Be direct, technical, and authoritative. Use steel manufacturing terminology (LOTO, EAF, heat number, electrode, refractory, etc.). If there are safety issues, address them first with urgency. If everything is good, confirm and preview the next step.`
          : `You are an expert aviation safety AI assistant embedded in a wearable device for aircraft pre-flight inspections. You guide maintenance technicians through FAA-compliant procedures with precision, authority, and care for safety.

Aircraft: ${aircraftData?.manufacturer} ${aircraftData?.model} (${aircraftData?.tailNumber})
Current Step ${input.stepNumber}/${checklist.length}: ${step.stepName}
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
        } catch {
          aiResponse = validation.isInSpec
            ? `Step ${input.stepNumber} confirmed. ${nextStep ? `Proceed to: ${nextStep.stepName}.` : "All steps complete."}`
            : `⚠️ Out-of-spec reading detected. ${validation.alerts[0]?.message ?? "Review required before proceeding."}`;
        }

        const newCompletedCount = (inspection.completedSteps ?? 0) + 1;
        const passedCount = validation.isInSpec ? (inspection.safetyChecksPassed ?? 0) + 1 : (inspection.safetyChecksPassed ?? 0);
        const failedCount = !validation.isInSpec ? (inspection.safetyChecksFailed ?? 0) + 1 : (inspection.safetyChecksFailed ?? 0);

        await updateInspectionStep(step.id, {
          workerInput: input.workerInput,
          aiResponse,
          status: validation.isInSpec ? "passed" : "failed",
          isInSpec: validation.isInSpec,
          completedAt: new Date(),
        });

        for (const alert of validation.alerts) {
          await createSafetyAlert({ inspectionId: inspection.id, stepId: step.id, ...alert });
        }

        const isLastStep = input.stepNumber === checklist.length;
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

    // Supervisor dashboard — all active inspections
    listActive: publicProcedure.query(async () => {
      return getAllActiveInspections();
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
        const industry = (aircraftData as { industry?: string })?.industry ?? "aviation";
        const checklist = getChecklist(industry);
        const currentStep = checklist.find(s => s.stepNumber === input.currentStepNumber);
        const isManufacturing = industry === "manufacturing";

        const systemPrompt = isManufacturing
          ? `You are an expert steel manufacturing safety AI. Answer questions about EAF/Ladle pre-heat inspections with technical precision. Equipment: ${aircraftData?.manufacturer} ${aircraftData?.model}. Current step: ${currentStep?.stepName ?? "Unknown"}. Keep answers concise (2-3 sentences), technical, and safety-focused.`
          : `You are an expert aviation safety AI assistant. Answer questions about aircraft pre-flight inspections with technical precision. Aircraft: ${aircraftData?.manufacturer} ${aircraftData?.model} (${aircraftData?.tailNumber}). Current inspection step: ${currentStep?.stepName ?? "Unknown"}. Keep answers concise (2-3 sentences), technical, and safety-focused.`;

        try {
          const llmResult = await invokeLLM({
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: input.question },
            ],
          });
          return { answer: (llmResult as { choices: Array<{ message: { content: string } }> }).choices[0]?.message?.content ?? "" };
        } catch {
          return { answer: "I'm unable to process that query right now. Please refer to the equipment manual for guidance." };
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

  // ── Voice ─────────────────────────────────────────────────────────────────
  voice: router({
    transcribe: publicProcedure
      .input(z.object({
        audioBase64: z.string(),
        mimeType: z.string().default("audio/webm"),
        industry: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const audioBuffer = Buffer.from(input.audioBase64, "base64");
        const fileKey = `voice-recordings/inspection-${Date.now()}-${Math.random().toString(36).slice(2)}.webm`;
        const { url: audioUrl } = await storagePut(fileKey, audioBuffer, input.mimeType);

        const isManufacturing = input.industry === "manufacturing";
        const result = await transcribeAudio({
          audioUrl,
          language: "en",
          prompt: isManufacturing
            ? "Steel mill inspection reading. Technical manufacturing terminology: PSI, SCFM, MW, degrees Celsius, LOTO, EAF, electrode, refractory, ladle."
            : "Aircraft pre-flight inspection reading. Technical aviation terminology, PSI, QT, degrees Celsius.",
        });

        if ("error" in result) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: result.error });
        }

        return { text: result.text, language: result.language };
      }),

    speak: publicProcedure
      .input(z.object({
        text: z.string().max(4096),
        voice: z.enum(["alloy", "echo", "fable", "onyx", "nova", "shimmer"]).default("shimmer"),
      }))
      .mutation(async ({ input }) => {
        const stripped = input.text
          .replace(/\*\*(.*?)\*\*/g, "$1")
          .replace(/\*(.*?)\*/g, "$1")
          .replace(/`(.*?)`/g, "$1")
          .replace(/#{1,6}\s/g, "")
          .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
          .replace(/\n+/g, " ")
          .trim();

        const sentences = stripped.match(/[^.!?]+[.!?]+/g) || [stripped];
        const cleanText = sentences.slice(0, 2).join(" ").trim();

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
            speed: 1.1,
            response_format: "mp3",
          }),
        });

        if (!response.ok) {
          const err = await response.text().catch(() => "");
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `TTS failed: ${response.status} ${err}` });
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

        const existing = await getReportByInspectionId(inspection.id);
        if (existing) return existing;

        const steps = await getStepsByInspectionId(inspection.id);
        const alerts = await getAlertsByInspectionId(inspection.id);
        const aircraftData = await getAircraftById(inspection.aircraftId);

        const content = generateComplianceContent(inspection, steps, alerts, aircraftData);
        const isManufacturing = (aircraftData as { industry?: string })?.industry === "manufacturing";
        const reportNumber = isManufacturing ? `NUCOR-OSHA-${Date.now()}` : `FAA-8130-${Date.now()}`;

        return createComplianceReport({ inspectionId: inspection.id, reportNumber, content });
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
