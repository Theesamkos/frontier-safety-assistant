/**
 * Seed script: inserts Nucor Steel equipment into the aircraft table.
 * Run via: pnpm tsx server/seed-nucor.ts
 */
import { drizzle } from "drizzle-orm/mysql2";
import { aircraft } from "../drizzle/schema";
import { eq } from "drizzle-orm";

const db = drizzle(process.env.DATABASE_URL!);

const nucorEquipment = [
  {
    tailNumber: "NUC-EAF-01",
    model: "Electric Arc Furnace Unit 1",
    manufacturer: "Nucor Steel",
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
      facility: "Nucor Steel Charlotte, NC",
      shift: "Day Shift",
      heatNumber: "H-2847",
      supervisor: "J. RODRIGUEZ",
    },
  },
  {
    tailNumber: "NUC-LADLE-01",
    model: "Ladle Refining Furnace",
    manufacturer: "Nucor Steel",
    industry: "manufacturing" as const,
    specs: {
      ladleCapacity: "150 tons",
      steelTemp: { min: 2850, max: 3050, unit: "F", critical_high: 3100 },
      argonFlowRate: { min: 20, max: 80, unit: "SCFM" },
      alloyHopperPressure: { min: 30, max: 60, unit: "PSI" },
      electrodeGap: { min: 4, max: 8, unit: "inches" },
      powerInput: { min: 15, max: 25, unit: "MW" },
      slagDepth: { min: 6, max: 14, unit: "inches" },
      facility: "Nucor Steel Charlotte, NC",
      shift: "Day Shift",
      heatNumber: "H-2848",
      supervisor: "J. RODRIGUEZ",
    },
  },
];

async function seed() {
  console.log("Checking existing aircraft...");
  const existing = await db.select({ tailNumber: aircraft.tailNumber }).from(aircraft);
  const existingTails = new Set(existing.map((r) => r.tailNumber));
  console.log("Existing:", Array.from(existingTails));

  for (const eq_item of nucorEquipment) {
    if (existingTails.has(eq_item.tailNumber)) {
      console.log(`  SKIP: ${eq_item.tailNumber} already exists`);
    } else {
      await db.insert(aircraft).values(eq_item);
      console.log(`  INSERTED: ${eq_item.tailNumber}`);
    }
  }

  const final = await db.select({ tailNumber: aircraft.tailNumber, model: aircraft.model, industry: aircraft.industry }).from(aircraft);
  console.log("\nFinal aircraft list:");
  final.forEach((r) => console.log(`  ${r.tailNumber} | ${r.model} | ${r.industry}`));
  console.log("\nSeed complete!");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
