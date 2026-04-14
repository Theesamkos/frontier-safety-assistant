import { and, desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, aircraft, complianceReports, inspectionSteps, inspections, safetyAlerts, users } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ── In-Memory Fallback (used when no MySQL is available) ─────────────────────
const FALLBACK_AIRCRAFT = [
  {
    id: 1, tailNumber: "N737DL", model: "Boeing 737-800", manufacturer: "Boeing",
    industry: "aviation" as const,
    specs: {
      hydraulicPressure: { min: 2800, max: 3200, unit: "PSI", critical_low: 2500 },
      tirePressure: { min: 180, max: 220, unit: "PSI" },
      oilLevel: { min: 12, max: 16, unit: "QT" },
      brakeTemp: { min: 0, max: 100, unit: "C", critical_high: 150 },
      fuelCapacity: { total: 6875, unit: "GAL" },
    },
    createdAt: new Date(),
  },
  {
    id: 2, tailNumber: "N320UA", model: "Airbus A320-200", manufacturer: "Airbus",
    industry: "aviation" as const,
    specs: {
      hydraulicPressure: { min: 2800, max: 3200, unit: "PSI", critical_low: 2500 },
      tirePressure: { min: 185, max: 215, unit: "PSI" },
      oilLevel: { min: 11, max: 15, unit: "QT" },
      brakeTemp: { min: 0, max: 100, unit: "C", critical_high: 150 },
      fuelCapacity: { total: 6300, unit: "GAL" },
    },
    createdAt: new Date(),
  },
  {
    id: 3, tailNumber: "NUC-EAF-01", model: "Electric Arc Furnace Unit 1", manufacturer: "Nucor Steel",
    industry: "manufacturing" as const,
    specs: {
      furnaceCapacity: "150 tons",
      operatingTemp: { min: 2700, max: 3100, unit: "F", critical_high: 3200 },
      electrodeCurrentNominal: { min: 40000, max: 60000, unit: "A" },
      coolingWaterPressure: { min: 60, max: 90, unit: "PSI", critical_low: 45 },
      hydraulicPressure: { min: 2000, max: 2500, unit: "PSI", critical_low: 1800 },
      ductPressure: { min: 0.5, max: 2.0, unit: "inH2O" },
      transformerTemp: { min: 0, max: 85, unit: "C", critical_high: 95 },
      oxygenLanceFlow: { min: 800, max: 1200, unit: "SCFM" },
      facility: "Nucor Steel Charlotte, NC", shift: "Day Shift",
      heatNumber: "H-2847", supervisor: "J. RODRIGUEZ",
    },
    createdAt: new Date(),
  },
  {
    id: 4, tailNumber: "NUC-LADLE-01", model: "Ladle Refining Furnace", manufacturer: "Nucor Steel",
    industry: "manufacturing" as const,
    specs: {
      ladleCapacity: "150 tons",
      steelTemp: { min: 2850, max: 3050, unit: "F", critical_high: 3100 },
      argonFlowRate: { min: 20, max: 80, unit: "SCFM" },
      alloyHopperPressure: { min: 30, max: 60, unit: "PSI" },
      electrodeGap: { min: 4, max: 8, unit: "inches" },
      powerInput: { min: 15, max: 25, unit: "MW" },
      slagDepth: { min: 6, max: 14, unit: "inches" },
      facility: "Nucor Steel Charlotte, NC", shift: "Day Shift",
      heatNumber: "H-2848", supervisor: "J. RODRIGUEZ",
    },
    createdAt: new Date(),
  },
];

// In-memory stores for when no DB is available
let _memIdCounter = 100;
const _memInspections: any[] = [];
const _memSteps: any[] = [];
const _memAlerts: any[] = [];
const _memReports: any[] = [];
const _useMemory = () => !process.env.DATABASE_URL;

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;
  try {
    const values: InsertUser = { openId: user.openId };
    const updateSet: Record<string, unknown> = {};
    const textFields = ["name", "email", "loginMethod"] as const;
    textFields.forEach(field => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    });
    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }
    if (!values.lastSignedIn) values.lastSignedIn = new Date();
    if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
    await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ── Aircraft ──────────────────────────────────────────────────────────────────

export async function getAllAircraft() {
  const db = await getDb();
  if (!db) return FALLBACK_AIRCRAFT;
  return db.select().from(aircraft);
}

export async function getAircraftById(id: number) {
  const db = await getDb();
  if (!db) return FALLBACK_AIRCRAFT.find((a) => a.id === id) ?? null;
  const result = await db.select().from(aircraft).where(eq(aircraft.id, id)).limit(1);
  return result[0] ?? null;
}

// ── Inspections ───────────────────────────────────────────────────────────────

export async function createInspection(data: {
  sessionId: string;
  aircraftId: number;
  inspectorName: string;
  totalSteps: number;
}) {
  const db = await getDb();
  if (!db) {
    const row = {
      id: ++_memIdCounter, sessionId: data.sessionId, aircraftId: data.aircraftId,
      inspectorName: data.inspectorName, totalSteps: data.totalSteps,
      completedSteps: 0, safetyChecksPassed: 0, safetyChecksFailed: 0,
      status: "in_progress" as const, startedAt: new Date(), completedAt: null,
    };
    _memInspections.push(row);
    return row;
  }
  await db.insert(inspections).values({
    sessionId: data.sessionId,
    aircraftId: data.aircraftId,
    inspectorName: data.inspectorName,
    totalSteps: data.totalSteps,
    status: "in_progress",
  });
  const result = await db.select().from(inspections).where(eq(inspections.sessionId, data.sessionId)).limit(1);
  return result[0]!;
}

export async function getInspectionBySessionId(sessionId: string) {
  const db = await getDb();
  if (!db) return _memInspections.find((i) => i.sessionId === sessionId) ?? null;
  const result = await db.select().from(inspections).where(eq(inspections.sessionId, sessionId)).limit(1);
  return result[0] ?? null;
}

export async function updateInspectionProgress(inspectionId: number, data: {
  completedSteps?: number;
  safetyChecksPassed?: number;
  safetyChecksFailed?: number;
  status?: "in_progress" | "completed" | "aborted";
  completedAt?: Date;
}) {
  const db = await getDb();
  if (!db) {
    const row = _memInspections.find((i) => i.id === inspectionId);
    if (row) Object.assign(row, data);
    return;
  }
  await db.update(inspections).set(data).where(eq(inspections.id, inspectionId));
}

// ── Inspection Steps ──────────────────────────────────────────────────────────

export async function createInspectionStep(data: {
  inspectionId: number;
  stepNumber: number;
  category: string;
  stepName: string;
}) {
  const db = await getDb();
  if (!db) {
    _memSteps.push({
      id: ++_memIdCounter, ...data, status: "pending",
      workerInput: null, aiResponse: null, readingValue: null, readingUnit: null,
      isInSpec: null, completedAt: null, createdAt: new Date(),
    });
    return;
  }
  await db.insert(inspectionSteps).values({ ...data, status: "pending" });
}

export async function getStepsByInspectionId(inspectionId: number) {
  const db = await getDb();
  if (!db) return _memSteps.filter((s) => s.inspectionId === inspectionId).sort((a: any, b: any) => a.stepNumber - b.stepNumber);
  return db.select().from(inspectionSteps)
    .where(eq(inspectionSteps.inspectionId, inspectionId))
    .orderBy(inspectionSteps.stepNumber);
}

export async function updateInspectionStep(stepId: number, data: {
  workerInput?: string;
  aiResponse?: string;
  status?: "pending" | "in_progress" | "passed" | "failed" | "skipped";
  readingValue?: string;
  readingUnit?: string;
  isInSpec?: boolean;
  completedAt?: Date;
}) {
  const db = await getDb();
  if (!db) {
    const row = _memSteps.find((s) => s.id === stepId);
    if (row) Object.assign(row, data);
    return;
  }
  await db.update(inspectionSteps).set(data).where(eq(inspectionSteps.id, stepId));
}

// ── Safety Alerts ─────────────────────────────────────────────────────────────

export async function createSafetyAlert(data: {
  inspectionId: number;
  stepId?: number;
  severity: "critical" | "warning" | "info";
  title: string;
  message: string;
  parameter?: string;
  actualValue?: string;
  expectedRange?: string;
}) {
  const db = await getDb();
  if (!db) {
    _memAlerts.push({ id: ++_memIdCounter, ...data, acknowledged: false, createdAt: new Date() });
    return;
  }
  await db.insert(safetyAlerts).values(data);
}

export async function getAlertsByInspectionId(inspectionId: number) {
  const db = await getDb();
  if (!db) return _memAlerts.filter((a) => a.inspectionId === inspectionId).sort((a: any, b: any) => b.createdAt - a.createdAt);
  return db.select().from(safetyAlerts)
    .where(eq(safetyAlerts.inspectionId, inspectionId))
    .orderBy(desc(safetyAlerts.createdAt));
}

export async function acknowledgeAlert(alertId: number) {
  const db = await getDb();
  if (!db) {
    const row = _memAlerts.find((a) => a.id === alertId);
    if (row) row.acknowledged = true;
    return;
  }
  await db.update(safetyAlerts).set({ acknowledged: true }).where(eq(safetyAlerts.id, alertId));
}

// ── Compliance Reports ────────────────────────────────────────────────────────

export async function createComplianceReport(data: {
  inspectionId: number;
  reportNumber: string;
  content: object;
}) {
  const db = await getDb();
  if (!db) {
    const row = {
      id: ++_memIdCounter, inspectionId: data.inspectionId,
      reportNumber: data.reportNumber, content: data.content,
      faaFormType: "8130-3", generatedAt: new Date(),
    };
    _memReports.push(row);
    return row;
  }
  await db.insert(complianceReports).values({
    inspectionId: data.inspectionId,
    reportNumber: data.reportNumber,
    content: data.content,
    faaFormType: "8130-3",
  });
  const result = await db.select().from(complianceReports)
    .where(eq(complianceReports.inspectionId, data.inspectionId)).limit(1);
  return result[0]!;
}

export async function getReportByInspectionId(inspectionId: number) {
  const db = await getDb();
  if (!db) return _memReports.find((r) => r.inspectionId === inspectionId) ?? null;
  const result = await db.select().from(complianceReports)
    .where(eq(complianceReports.inspectionId, inspectionId)).limit(1);
  return result[0] ?? null;
}

// ── Supervisor Dashboard ──────────────────────────────────────────────────────

export async function getAllActiveInspections() {
  const db = await getDb();
  if (!db) {
    return _memInspections.map((i) => {
      const ac = FALLBACK_AIRCRAFT.find((a) => a.id === i.aircraftId);
      return { ...i, tailNumber: ac?.tailNumber, model: ac?.model, manufacturer: ac?.manufacturer };
    }).sort((a: any, b: any) => b.startedAt - a.startedAt);
  }
  // Get all inspections with aircraft info, ordered by most recent
  const results = await db
    .select({
      id: inspections.id,
      sessionId: inspections.sessionId,
      aircraftId: inspections.aircraftId,
      inspectorName: inspections.inspectorName,
      status: inspections.status,
      totalSteps: inspections.totalSteps,
      completedSteps: inspections.completedSteps,
      safetyChecksPassed: inspections.safetyChecksPassed,
      safetyChecksFailed: inspections.safetyChecksFailed,
      startedAt: inspections.startedAt,
      completedAt: inspections.completedAt,
      tailNumber: aircraft.tailNumber,
      model: aircraft.model,
      manufacturer: aircraft.manufacturer,
    })
    .from(inspections)
    .leftJoin(aircraft, eq(inspections.aircraftId, aircraft.id))
    .orderBy(desc(inspections.startedAt))
    .limit(50);
  return results;
}
