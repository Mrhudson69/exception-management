import { pool } from "./pool.js";
import { ensureExceptionsIndex } from "../es/client.js";

/**
 * Prepares a fresh install: ensures the Elasticsearch index exists. No users or
 * demo data are created — on first run the UI shows a setup wizard that creates
 * the initial admin account (and optional SMTP) interactively.
 */
async function seed() {
  await ensureExceptionsIndex();
  console.log("✓ Elasticsearch index ready.");
  console.log("  No admin user is seeded — open the app and complete first-run setup.");
  await pool.end();
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
