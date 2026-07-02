import type { AuthUser } from "./auth.js";
import { one } from "../db/pool.js";

/**
 * The set of applications a user is allowed to see.
 *   all   -> no filtering; the user sees every application.
 *   slugs -> allowed application slugs (used to filter Elasticsearch by app_slug).
 *   ids   -> allowed application ids   (used to filter Postgres by application_id).
 */
export interface AppScope {
  all: boolean;
  slugs: string[];
  ids: string[];
}

const UNRESTRICTED: AppScope = { all: true, slugs: [], ids: [] };

/**
 * Resolve the current user's application scope. Admins and users with the
 * all_applications flag are unrestricted; everyone else is limited to the
 * applications assigned to them in user_applications.
 */
export async function getAppScope(user: AuthUser): Promise<AppScope> {
  if (user.role === "admin") return UNRESTRICTED;

  const row = await one<{ all_applications: boolean; slugs: string[]; ids: string[] }>(
    `SELECT u.all_applications,
            COALESCE(array_agg(a.slug) FILTER (WHERE a.id IS NOT NULL), '{}') AS slugs,
            COALESCE(array_agg(a.id::text) FILTER (WHERE a.id IS NOT NULL), '{}') AS ids
       FROM users u
       LEFT JOIN user_applications ua ON ua.user_id = u.id
       LEFT JOIN applications a ON a.id = ua.application_id
      WHERE u.id = $1
      GROUP BY u.id`,
    [user.id]
  );

  if (!row || row.all_applications) return UNRESTRICTED;
  return { all: false, slugs: row.slugs ?? [], ids: row.ids ?? [] };
}
