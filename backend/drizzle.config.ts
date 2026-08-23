import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/schema.ts",
  out: "../drizzle/migrations",
  dialect: "mysql",
  dbCredentials: { url: process.env.DATABASE_URL || "mysql://root:password@127.0.0.1:3306/avhisafe" },
  strict: true,
  verbose: true,
});
