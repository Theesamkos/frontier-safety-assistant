/**
 * Migration + Seed script:
 * 1. Adds `industry` column to aircraft table if missing
 * 2. Seeds Nucor Steel equipment
 * Run via: pnpm tsx server/migrate-and-seed.ts
 */
import mysql from "mysql2/promise";

async function run() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL!);

  // 1. Check if industry column exists
  const [cols] = await conn.execute("SHOW COLUMNS FROM aircraft LIKE 'industry'") as [mysql.RowDataPacket[], unknown];
  if (cols.length === 0) {
    console.log("Adding industry column...");
    await conn.execute("ALTER TABLE aircraft ADD COLUMN industry ENUM('aviation', 'manufacturing') NOT NULL DEFAULT 'aviation'");
    console.log("Column added.");
  } else {
    console.log("Industry column already exists.");
  }

  // 2. Check existing aircraft
  const [existing] = await conn.execute("SELECT tail_number FROM aircraft") as [mysql.RowDataPacket[], unknown];
  const existingTails = new Set(existing.map((r: mysql.RowDataPacket) => r.tail_number as string));
  console.log("Existing aircraft:", Array.from(existingTails));

  // 3. Seed Nucor EAF
  if (!existingTails.has("NUC-EAF-01")) {
    const eafSpecs = JSON.stringify({
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
    });
    await conn.execute(
      "INSERT INTO aircraft (tail_number, model, manufacturer, industry, specs) VALUES (?, ?, ?, ?, ?)",
      ["NUC-EAF-01", "Electric Arc Furnace Unit 1", "Nucor Steel", "manufacturing", eafSpecs]
    );
    console.log("Seeded NUC-EAF-01");
  } else {
    console.log("SKIP: NUC-EAF-01 already exists");
  }

  // 4. Seed Ladle Refining Furnace
  if (!existingTails.has("NUC-LADLE-01")) {
    const ladleSpecs = JSON.stringify({
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
    });
    await conn.execute(
      "INSERT INTO aircraft (tail_number, model, manufacturer, industry, specs) VALUES (?, ?, ?, ?, ?)",
      ["NUC-LADLE-01", "Ladle Refining Furnace", "Nucor Steel", "manufacturing", ladleSpecs]
    );
    console.log("Seeded NUC-LADLE-01");
  } else {
    console.log("SKIP: NUC-LADLE-01 already exists");
  }

  // 5. Verify final state
  const [final] = await conn.execute("SELECT tail_number, model, industry FROM aircraft") as [mysql.RowDataPacket[], unknown];
  console.log("\nFinal aircraft list:");
  final.forEach((r: mysql.RowDataPacket) => console.log(`  ${r.tail_number} | ${r.model} | ${r.industry}`));

  await conn.end();
  console.log("\nDone!");
  process.exit(0);
}

run().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
