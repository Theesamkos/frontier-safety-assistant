import { boolean, int, json, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const aircraft = mysqlTable("aircraft", {
  id: int("id").autoincrement().primaryKey(),
  tailNumber: varchar("tail_number", { length: 20 }).notNull().unique(),
  model: varchar("model", { length: 100 }).notNull(),
  manufacturer: varchar("manufacturer", { length: 100 }).notNull(),
  industry: mysqlEnum("industry", ["aviation", "manufacturing"]).default("aviation").notNull(),
  specs: json("specs").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Aircraft = typeof aircraft.$inferSelect;

export const inspections = mysqlTable("inspections", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: varchar("session_id", { length: 64 }).notNull().unique(),
  aircraftId: int("aircraft_id").notNull(),
  inspectorName: varchar("inspector_name", { length: 200 }),
  status: mysqlEnum("status", ["in_progress", "completed", "aborted"]).default("in_progress"),
  totalSteps: int("total_steps").default(0),
  completedSteps: int("completed_steps").default(0),
  safetyChecksPassed: int("safety_checks_passed").default(0),
  safetyChecksFailed: int("safety_checks_failed").default(0),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});

export type Inspection = typeof inspections.$inferSelect;
export type InsertInspection = typeof inspections.$inferInsert;

export const inspectionSteps = mysqlTable("inspection_steps", {
  id: int("id").autoincrement().primaryKey(),
  inspectionId: int("inspection_id").notNull(),
  stepNumber: int("step_number").notNull(),
  category: varchar("category", { length: 100 }).notNull(),
  stepName: varchar("step_name", { length: 200 }).notNull(),
  workerInput: text("worker_input"),
  aiResponse: text("ai_response"),
  status: mysqlEnum("status", ["pending", "in_progress", "passed", "failed", "skipped"]).default("pending"),
  readingValue: varchar("reading_value", { length: 100 }),
  readingUnit: varchar("reading_unit", { length: 50 }),
  isInSpec: boolean("is_in_spec"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type InspectionStep = typeof inspectionSteps.$inferSelect;

export const safetyAlerts = mysqlTable("safety_alerts", {
  id: int("id").autoincrement().primaryKey(),
  inspectionId: int("inspection_id").notNull(),
  stepId: int("step_id"),
  severity: mysqlEnum("severity", ["critical", "warning", "info"]).notNull(),
  title: varchar("title", { length: 200 }).notNull(),
  message: text("message").notNull(),
  parameter: varchar("parameter", { length: 100 }),
  actualValue: varchar("actual_value", { length: 100 }),
  expectedRange: varchar("expected_range", { length: 100 }),
  acknowledged: boolean("acknowledged").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type SafetyAlert = typeof safetyAlerts.$inferSelect;

export const complianceReports = mysqlTable("compliance_reports", {
  id: int("id").autoincrement().primaryKey(),
  inspectionId: int("inspection_id").notNull().unique(),
  reportNumber: varchar("report_number", { length: 64 }).notNull().unique(),
  faaFormType: varchar("faa_form_type", { length: 50 }).default("8130-3"),
  content: json("content").notNull(),
  generatedAt: timestamp("generated_at").defaultNow().notNull(),
});

export type ComplianceReport = typeof complianceReports.$inferSelect;
