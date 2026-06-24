import { createHash } from "node:crypto";

export type Severity = "info" | "warning" | "error" | "critical";

const CRITICAL_HINTS = [
  "outofmemory",
  "stackoverflow",
  "segfault",
  "fatal",
  "panic",
  "deadlock",
  "data loss",
  "corruption",
  "securityexception",
  "unauthorized",
];

const WARNING_HINTS = [
  "timeout",
  "retry",
  "deprecated",
  "slow",
  "throttle",
  "ratelimit",
  "rate limit",
];

const CATEGORY_RULES: { category: string; patterns: RegExp[] }[] = [
  { category: "database", patterns: [/sql/i, /database/i, /deadlock/i, /connection pool/i, /constraint/i, /pg|postgres|mysql|mongo/i] },
  { category: "network", patterns: [/timeout/i, /econn/i, /socket/i, /dns/i, /http/i, /network/i, /unreachable/i] },
  { category: "auth", patterns: [/auth/i, /token/i, /jwt/i, /unauthor/i, /forbidden/i, /permission/i, /credential/i] },
  { category: "validation", patterns: [/validation/i, /invalid/i, /schema/i, /parse/i, /malformed/i] },
  { category: "null-reference", patterns: [/nullreference/i, /undefined/i, /nullpointer/i, /cannot read propert/i, /none type/i] },
  { category: "memory", patterns: [/outofmemory/i, /memory/i, /heap/i, /leak/i] },
  { category: "configuration", patterns: [/config/i, /environment variable/i, /missing key/i, /not set/i] },
];

/** Infer severity from an explicit value, exception type and message text. */
export function inferSeverity(
  explicit: string | undefined,
  exceptionType: string,
  message: string
): Severity {
  if (explicit && ["info", "warning", "error", "critical"].includes(explicit)) {
    return explicit as Severity;
  }
  const haystack = `${exceptionType} ${message}`.toLowerCase();
  if (CRITICAL_HINTS.some((h) => haystack.includes(h))) return "critical";
  if (WARNING_HINTS.some((h) => haystack.includes(h))) return "warning";
  return "error";
}

/** Bucket the exception into a human category for filtering/grouping. */
export function inferCategory(exceptionType: string, message: string): string {
  const haystack = `${exceptionType} ${message}`;
  for (const rule of CATEGORY_RULES) {
    if (rule.patterns.some((p) => p.test(haystack))) return rule.category;
  }
  return "uncategorized";
}

/**
 * Stable fingerprint that groups "the same" error together:
 * exception type + the first line of the message with volatile bits stripped.
 */
export function fingerprint(
  appSlug: string,
  exceptionType: string,
  message: string
): string {
  const normalized = message
    .split("\n")[0]
    .replace(/0x[0-9a-f]+/gi, "0x?")
    .replace(/\b\d+\b/g, "#")
    .replace(/['"][^'"]*['"]/g, "?")
    .trim()
    .slice(0, 200);
  return createHash("sha1")
    .update(`${appSlug}|${exceptionType}|${normalized}`)
    .digest("hex")
    .slice(0, 16);
}
