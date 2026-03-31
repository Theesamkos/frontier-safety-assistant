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
  if (!db) return [];
  return db.select().from(aircraft);
}

export async function getAircraftById(id: number) {
  const db = await getDb();
  if (!db) return null;
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
  if (!db) throw new Error("DB unavailable");
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
  if (!db) return null;
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
  if (!db) return;
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
  if (!db) throw new Error("DB unavailable");
  await db.insert(inspectionSteps).values({ ...data, status: "pending" });
}

export async function getStepsByInspectionId(inspectionId: number) {
  const db = await getDb();
  if (!db) return [];
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
  if (!db) return;
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
  if (!db) throw new Error("DB unavailable");
  await db.insert(safetyAlerts).values(data);
}

export async function getAlertsByInspectionId(inspectionId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(safetyAlerts)
    .where(eq(safetyAlerts.inspectionId, inspectionId))
    .orderBy(desc(safetyAlerts.createdAt));
}

export async function acknowledgeAlert(alertId: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(safetyAlerts).set({ acknowledged: true }).where(eq(safetyAlerts.id, alertId));
}

// ── Compliance Reports ────────────────────────────────────────────────────────

export async function createComplianceReport(data: {
  inspectionId: number;
  reportNumber: string;
  content: object;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
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
  if (!db) return null;
  const result = await db.select().from(complianceReports)
    .where(eq(complianceReports.inspectionId, inspectionId)).limit(1);
  return result[0] ?? null;
}

// ── Supervisor Dashboard ──────────────────────────────────────────────────────

export async function getAllActiveInspections() {
  const db = await getDb();
  if (!db) return [];
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
