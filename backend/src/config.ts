import dotenv from "dotenv";

dotenv.config();

export const config = {
  port: Number(process.env.PORT ?? 4000),
  nodeEnv: process.env.NODE_ENV ?? "development",
  corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:5173",
  databaseUrl:
    process.env.DATABASE_URL ?? "postgres://exmgmt:exmgmt@localhost:5433/exmgmt",
  elasticsearch: {
    url: process.env.ELASTICSEARCH_URL ?? "http://localhost:9200",
    index: process.env.ES_EXCEPTIONS_INDEX ?? "exceptions",
  },
  smtp: {
    host: process.env.SMTP_HOST ?? "",
    port: Number(process.env.SMTP_PORT ?? 587),
    user: process.env.SMTP_USER ?? "",
    pass: process.env.SMTP_PASS ?? "",
    from: process.env.SMTP_FROM ?? "Exception Platform <alerts@example.com>",
  },
  notificationsLive: (process.env.NOTIFICATIONS_LIVE ?? "false") === "true",
  jwtSecret: process.env.JWT_SECRET ?? "dev-insecure-change-me",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "7d",
};
