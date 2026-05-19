import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const schemaPath = resolve(root, "database/schema-full.sql");
const sql = readFileSync(schemaPath, "utf8");

const publicReadableTables = new Set(["Store", "StoreWeeklyHours", "StoreDateOverride"]);
const ignoredTables = new Set(["_prisma_migrations"]);

const tables = uniqueMatches(sql, /CREATE\s+TABLE(?:\s+IF\s+NOT\s+EXISTS)?\s+(?:public\.)?"([^"]+)"/gi).filter(
  (table) => !ignoredTables.has(table),
);
const rlsTables = new Set(uniqueMatches(sql, /ALTER\s+TABLE\s+(?:public\.)?"([^"]+)"\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY/gi));
const commentedTables = new Set(uniqueMatches(sql, /COMMENT\s+ON\s+TABLE\s+(?:public\.)?"([^"]+)"/gi));
const policies = uniquePolicyMatches(sql);

const missingRls = tables.filter((table) => !rlsTables.has(table));
const missingComments = tables.filter((table) => !commentedTables.has(table));
const publicPoliciesOnSensitiveTables = policies.filter((policy) => !publicReadableTables.has(policy.table) && /\bTO\s+anon\b/i.test(policy.body));

const report = {
  schema: "database/schema-full.sql",
  tables: tables.length,
  rlsEnabled: rlsTables.size,
  comments: commentedTables.size,
  policies: policies.map(({ name, table }) => ({ name, table })),
  publicReadableTables: [...publicReadableTables],
  missingRls,
  missingComments,
  publicPoliciesOnSensitiveTables: publicPoliciesOnSensitiveTables.map(({ name, table }) => ({ name, table })),
};

process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);

if (missingRls.length || missingComments.length || publicPoliciesOnSensitiveTables.length) {
  process.exitCode = 1;
}

function uniqueMatches(source, pattern) {
  return [...new Set([...source.matchAll(pattern)].map((match) => match[1]))].sort();
}

function uniquePolicyMatches(source) {
  const matches = [...source.matchAll(/CREATE\s+POLICY\s+"([^"]+)"\s+ON\s+(?:public\.)?"([^"]+)"([\s\S]*?);/gi)].map((match) => ({
    name: match[1],
    table: match[2],
    body: match[3],
  }));

  return matches.sort((left, right) => left.table.localeCompare(right.table) || left.name.localeCompare(right.name));
}
