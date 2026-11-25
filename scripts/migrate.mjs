// Applies db/migrations/*.sql in order against DATABASE_URL.
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";
import "dotenv/config";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dir = join(root, "db", "migrations");
const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}
const sql = postgres(url, { ssl: "require" });
const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
for (const f of files) {
  console.log(`Applying ${f}...`);
  await sql.unsafe(readFileSync(join(dir, f), "utf8"));
  console.log(`  done`);
}
await sql.end();
console.log("Migrations complete.");
