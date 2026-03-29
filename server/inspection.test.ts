import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock database helpers
vi.mock("./db", () => ({
  getAllAircraft: vi.fn().mockResolvedValue([
    {
      id: 1,
      tailNumber: "N737DL",
      model: "Boeing 737-800",
      manufacturer: "Boeing",
      specs: {
        hydraulic_pressure_min: 2800,
        hydraulic_pressure_max: 3200,
        hydraulic_pressure_unit: "PSI",
        fuel_min_pct: 15,
        nose_tire_pressure_min: 175,
        nose_tire_pressure_max: 200,
        nose_tire_pressure_unit: "PSI",
        main_tire_pressure_min: 195,
        main_tire_pressure_max: 215,
        main_tire_pressure_unit: "PSI",
        engine_oil_min_qt: 6,
        engine_oil_max_qt: 22,
        engine_oil_unit: "QT",
        brake_temp_max_c: 150,
      },
      createdAt: new Date(),
    },
  ]),
  getAircraftById: vi.fn().mockResolvedValue({
    id: 1,
    tailNumber: "N737DL",
    model: "Boeing 737-800",
    manufacturer: "Boeing",
    specs: {
      hydraulic_pressure_min: 2800,
      hydraulic_pressure_max: 3200,
      hydraulic_pressure_unit: "PSI",
      fuel_min_pct: 15,
      nose_tire_pressure_min: 175,
      nose_tire_pressure_max: 200,
      nose_tire_pressure_unit: "PSI",
      main_tire_pressure_min: 195,
      main_tire_pressure_max: 215,
      main_tire_pressure_unit: "PSI",
      engine_oil_min_qt: 6,
      engine_oil_max_qt: 22,
      engine_oil_unit: "QT",
      brake_temp_max_c: 150,
    },
    createdAt: new Date(),
  }),
  createInspection: vi.fn().mockResolvedValue({
    id: 1,
    sessionId: "test-session-123",
    aircraftId: 1,
    inspectorName: "John Doe",
    status: "in_progress",
    totalSteps: 20,
    completedSteps: 0,
    safetyChecksPassed: 0,
    safetyChecksFailed: 0,
    startedAt: new Date(),
    completedAt: null,
  }),
  createInspectionStep: vi.fn().mockResolvedValue(undefined),
  getInspectionBySessionId: vi.fn().mockResolvedValue({
    id: 1,
    sessionId: "test-session-123",
    aircraftId: 1,
    inspectorName: "John Doe",
    status: "in_progress",
    totalSteps: 20,
    completedSteps: 5,
    safetyChecksPassed: 4,
    safetyChecksFailed: 1,
    startedAt: new Date(),
    completedAt: null,
  }),
  getStepsByInspectionId: vi.fn().mockResolvedValue([
    {
      id: 16,
      inspectionId: 1,
      stepNumber: 16,
      category: "Hydraulic System",
      stepName: "Check hydraulic fluid levels and pressure",
      workerInput: null,
      aiResponse: null,
      status: "pending",
      readingValue: null,
      readingUnit: null,
      isInSpec: null,
      completedAt: null,
      createdAt: new Date(),
    },
  ]),
  updateInspectionStep: vi.fn().mockResolvedValue(undefined),
  updateInspectionProgress: vi.fn().mockResolvedValue(undefined),
  createSafetyAlert: vi.fn().mockResolvedValue(undefined),
  getAlertsByInspectionId: vi.fn().mockResolvedValue([]),
  acknowledgeAlert: vi.fn().mockResolvedValue(undefined),
  createComplianceReport: vi.fn().mockImplementation(async (data: { inspectionId: number; reportNumber: string; content: object }) => ({
    id: 1,
    inspectionId: data.inspectionId,
    reportNumber: data.reportNumber,
    faaFormType: "8130-3",
    content: data.content,
    generatedAt: new Date(),
  })),
  getReportByInspectionId: vi.fn().mockResolvedValue(null),
  upsertUser: vi.fn(),
  getUserByOpenId: vi.fn(),
}));

// Mock LLM
vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn().mockResolvedValue({
    choices: [{ message: { content: "Step confirmed. Hydraulic pressure 3050 PSI is within specification. Proceed to engine oil check." } }],
  }),
}));

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

describe("aircraft router", () => {
  it("lists all aircraft", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.aircraft.list();
    expect(result).toHaveLength(1);
    expect(result[0]?.tailNumber).toBe("N737DL");
    expect(result[0]?.model).toBe("Boeing 737-800");
  });

  it("gets aircraft by id", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.aircraft.getById({ id: 1 });
    expect(result?.manufacturer).toBe("Boeing");
    expect(result?.tailNumber).toBe("N737DL");
  });
});

describe("inspection router — start", () => {
  it("starts a new inspection and returns sessionId", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.inspection.start({
      aircraftId: 1,
      inspectorName: "John Doe",
    });
    expect(result.sessionId).toBeDefined();
    expect(result.totalSteps).toBe(20);
  });
});

describe("inspection router — getState", () => {
  it("returns inspection state for valid session", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.inspection.getState({ sessionId: "test-session-123" });
    expect(result.inspection.sessionId).toBe("test-session-123");
    expect(result.aircraft?.tailNumber).toBe("N737DL");
    expect(result.steps).toHaveLength(1);
  });
});

describe("inspection router — submitStep", () => {
  it("submits a step with in-spec hydraulic reading and returns AI response", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.inspection.submitStep({
      sessionId: "test-session-123",
      stepNumber: 16,
      workerInput: "Hydraulic pressure 3050 PSI, fluid level normal",
    });
    expect(result.aiResponse).toBeTruthy();
    expect(result.isInSpec).toBe(true);
    expect(result.newAlerts).toHaveLength(0);
  });

  it("detects out-of-spec hydraulic pressure and generates alert", async () => {
    const { getStepsByInspectionId } = await import("./db");
    vi.mocked(getStepsByInspectionId).mockResolvedValueOnce([{
      id: 16,
      inspectionId: 1,
      stepNumber: 16,
      category: "Hydraulic System",
      stepName: "Check hydraulic fluid levels and pressure",
      workerInput: null,
      aiResponse: null,
      status: "pending",
      readingValue: null,
      readingUnit: null,
      isInSpec: null,
      completedAt: null,
      createdAt: new Date(),
    }]);

    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.inspection.submitStep({
      sessionId: "test-session-123",
      stepNumber: 16,
      workerInput: "Hydraulic pressure 2400 PSI",
    });
    expect(result.isInSpec).toBe(false);
    expect(result.newAlerts.length).toBeGreaterThan(0);
    expect(result.newAlerts[0]?.severity).toBe("critical");
    expect(result.newAlerts[0]?.title).toContain("Hydraulic");
  });
});

describe("safety validation — tire pressure", () => {
  it("flags low nose tire pressure as warning", async () => {
    const { getStepsByInspectionId } = await import("./db");
    vi.mocked(getStepsByInspectionId).mockResolvedValueOnce([{
      id: 4,
      inspectionId: 1,
      stepNumber: 4,
      category: "Exterior Walk-Around",
      stepName: "Check nose landing gear and tire pressure",
      workerInput: null,
      aiResponse: null,
      status: "pending",
      readingValue: null,
      readingUnit: null,
      isInSpec: null,
      completedAt: null,
      createdAt: new Date(),
    }]);

    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.inspection.submitStep({
      sessionId: "test-session-123",
      stepNumber: 4,
      workerInput: "Nose tire pressure 150 PSI",
    });
    expect(result.isInSpec).toBe(false);
    expect(result.newAlerts[0]?.parameter).toContain("Tire");
  });
});

describe("safety validation — engine oil", () => {
  it("flags critically low engine oil", async () => {
    const { getStepsByInspectionId } = await import("./db");
    vi.mocked(getStepsByInspectionId).mockResolvedValueOnce([{
      id: 17,
      inspectionId: 1,
      stepNumber: 17,
      category: "Engine",
      stepName: "Verify engine oil levels — Engine 1",
      workerInput: null,
      aiResponse: null,
      status: "pending",
      readingValue: null,
      readingUnit: null,
      isInSpec: null,
      completedAt: null,
      createdAt: new Date(),
    }]);

    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.inspection.submitStep({
      sessionId: "test-session-123",
      stepNumber: 17,
      workerInput: "Engine 1 oil level 3 QT",
    });
    expect(result.isInSpec).toBe(false);
    expect(result.newAlerts[0]?.severity).toBe("critical");
    expect(result.newAlerts[0]?.title).toContain("Oil");
  });
});

describe("alerts router", () => {
  it("acknowledges an alert", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.alerts.acknowledge({ alertId: 1 });
    expect(result.success).toBe(true);
  });
});

describe("report router", () => {
  it("generates a compliance report for a completed inspection", async () => {
    const { getInspectionBySessionId, getStepsByInspectionId, getAircraftById } = await import("./db");

    // Mock a completed inspection
    vi.mocked(getInspectionBySessionId).mockResolvedValueOnce({
      id: 1,
      sessionId: "test-session-123",
      aircraftId: 1,
      inspectorName: "John Doe",
      status: "completed",
      totalSteps: 20,
      completedSteps: 20,
      safetyChecksPassed: 18,
      safetyChecksFailed: 2,
      startedAt: new Date("2026-03-29T10:00:00Z"),
      completedAt: new Date("2026-03-29T11:30:00Z"),
    });

    // Mock completed steps
    vi.mocked(getStepsByInspectionId).mockResolvedValueOnce([
      { id: 1, inspectionId: 1, stepNumber: 1, category: "Documentation", stepName: "Verify aircraft logbook", workerInput: "Logbook current", aiResponse: "Confirmed", status: "passed", readingValue: null, readingUnit: null, isInSpec: true, completedAt: new Date(), createdAt: new Date() },
      { id: 16, inspectionId: 1, stepNumber: 16, category: "Hydraulic System", stepName: "Check hydraulic pressure", workerInput: "3050 PSI", aiResponse: "In spec", status: "passed", readingValue: "3050", readingUnit: "PSI", isInSpec: true, completedAt: new Date(), createdAt: new Date() },
    ]);

    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.report.generate({ sessionId: "test-session-123" });

    expect(result.reportNumber).toMatch(/^FAA-8130-/);
    expect(result.faaFormType).toBe("8130-3");
    expect(result.content).toBeDefined();
    const content = result.content as Record<string, unknown>;
    expect(content.reportMetadata).toBeDefined();
    expect(content.aircraftInfo).toBeDefined();
    expect(content.inspectionSummary).toBeDefined();
    expect(content.stepDetails).toBeDefined();
    expect(content.safetyFindings).toBeDefined();
  });

  it("returns existing report if already generated", async () => {
    const { getReportByInspectionId } = await import("./db");

    vi.mocked(getReportByInspectionId).mockResolvedValueOnce({
      id: 1,
      inspectionId: 1,
      reportNumber: "FAA-8130-EXISTING",
      faaFormType: "8130-3",
      content: { reportMetadata: { reportNumber: "FAA-8130-EXISTING" } },
      generatedAt: new Date(),
    });

    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.report.get({ sessionId: "test-session-123" });

    expect(result?.reportNumber).toBe("FAA-8130-EXISTING");
  });
});

describe("auth router", () => {
  it("returns null user when not authenticated", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.me();
    expect(result).toBeNull();
  });
});
