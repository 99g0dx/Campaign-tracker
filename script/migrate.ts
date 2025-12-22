#!/usr/bin/env tsx
import { drizzle } from "drizzle-orm/node-postgres";
import pkg from "pg";
const { Pool } = pkg;
import * as schema from "../shared/schema";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

console.log("Connecting to database...");
const pool = new Pool({ connectionString });
const db = drizzle(pool, { schema });

console.log("Running migrations...");

async function migrate() {
  try {
    // Check if tables exist by running a simple query
    const result = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
    `);

    console.log(`Found ${result.rows.length} existing tables`);
    console.log("Tables:", result.rows.map(r => r.table_name).join(", "));

    console.log("\nMigration check complete!");
    console.log("Run 'npm run db:push' to apply schema changes");

    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error("Migration error:", error);
    await pool.end();
    process.exit(1);
  }
}

migrate();
