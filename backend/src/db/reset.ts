import { pool } from "./pool.js";
import { es, EXCEPTIONS_INDEX } from "../es/client.js";

/**
 * Wipes all operational data: every config table (except users) and the
 * Elasticsearch exceptions index. Useful to clear demo/dummy data.
 * Run with `npm run reset`. Pass `--users` to also remove users.
 */
async function reset() {
  const alsoUsers = process.argv.includes("--users");

  console.log("Clearing configuration tables...");
  await pool.query(`
    TRUNCATE
      alert_escalations,
      alerts,
      escalation_rules,
      thresholds,
      notification_group_channels,
      notification_groups,
      notification_channels,
      applications,
      teams
    RESTART IDENTITY CASCADE;
  `);
  if (alsoUsers) {
    await pool.query(`TRUNCATE users RESTART IDENTITY CASCADE;`);
    console.log("✓ Users cleared too.");
  }

  console.log("Deleting Elasticsearch exceptions index...");
  try {
    await es.indices.delete({ index: EXCEPTIONS_INDEX });
  } catch {
    /* index may not exist */
  }

  await pool.end();
  console.log("✓ Reset complete. Run `npm run seed` to recreate the admin user / index.");
}

reset().catch((err) => {
  console.error("Reset failed:", err);
  process.exit(1);
});
