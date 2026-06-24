import { Client } from "@elastic/elasticsearch";
import { config } from "../config.js";

export const es = new Client({ node: config.elasticsearch.url });

export const EXCEPTIONS_INDEX = config.elasticsearch.index;

const mapping = {
  mappings: {
    properties: {
      app_slug: { type: "keyword" },
      app_id: { type: "keyword" },
      app_name: { type: "keyword" },
      environment: { type: "keyword" },
      severity: { type: "keyword" },
      category: { type: "keyword" },
      exception_type: { type: "keyword" },
      message: { type: "text", fields: { raw: { type: "keyword", ignore_above: 1024 } } },
      stack_trace: { type: "text" },
      fingerprint: { type: "keyword" },
      host: { type: "keyword" },
      user_id: { type: "keyword" },
      release: { type: "keyword" },
      tags: { type: "object", enabled: true },
      timestamp: { type: "date" },
      received_at: { type: "date" },
    },
  },
} as const;

/** Ensure the exceptions index exists with the right mapping. */
export async function ensureExceptionsIndex(): Promise<void> {
  const exists = await es.indices.exists({ index: EXCEPTIONS_INDEX });
  if (!exists) {
    await es.indices.create({ index: EXCEPTIONS_INDEX, ...mapping });
    console.log(`✓ Created Elasticsearch index "${EXCEPTIONS_INDEX}"`);
  }
}
