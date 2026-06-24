#!/usr/bin/env node
// Simulates Applications 1-4 POSTing exceptions to the central /ingest endpoint.
// Usage: node scripts/send-sample-errors.mjs [count] [baseUrl]

const count = Number(process.argv[2] ?? 50);
const base = process.argv[3] ?? "http://localhost:4000";

const apps = [
  { app: "payment-gateway-us", env: "production" },
  { app: "auth-service-core", env: "production" },
  { app: "inventory-db-sync", env: "production" },
  { app: "frontend-webapp", env: "production" },
];

const errors = [
  { type: "NullReferenceException", message: "Object reference not set to an instance of an object", severity: "critical" },
  { type: "TimeoutException", message: "Database connection timeout after 30000ms" },
  { type: "TokenExpiredException", message: "JWT validation failed: token expired", severity: "warning" },
  { type: "TypeError", message: "Cannot read properties of undefined (reading 'id')", severity: "warning" },
  { type: "DataIntegrityError", message: "Foreign key constraint violation on table orders" },
  { type: "OutOfMemoryError", message: "Java heap space exhausted", severity: "critical" },
];

const hosts = ["prod-web-01", "prod-web-04", "db-core-02", "eu-worker-1"];
const rand = (a) => a[Math.floor(Math.random() * a.length)];

let ok = 0;
for (let i = 0; i < count; i++) {
  const a = rand(apps);
  const e = rand(errors);
  try {
    const res = await fetch(`${base}/ingest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        app: a.app,
        environment: a.env,
        type: e.type,
        message: e.message,
        severity: e.severity,
        host: rand(hosts),
        userId: `user_${Math.floor(Math.random() * 9999)}`,
        stack: `at ${e.type} (service.js:${10 + i})\n  at handler (router.js:42)`,
      }),
    });
    if (res.ok) ok++;
  } catch (err) {
    console.error("Failed to reach", base, "-", err.message);
    break;
  }
}
console.log(`Sent ${ok}/${count} sample exceptions to ${base}/ingest`);
