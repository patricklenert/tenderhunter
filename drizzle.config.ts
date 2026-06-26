import type { Config } from "drizzle-kit";

export default {
  schema: ["./lib/schema.ts", "./lib/auth-schema.ts"],
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgresql://tenderhunter:tenderhunter@localhost:5432/tenderhunter",
  },
} satisfies Config;
