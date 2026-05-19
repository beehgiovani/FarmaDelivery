import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const schemaPath = resolve(root, "apps/api/prisma/schema.prisma");
const outputPath = resolve(root, "docs/database-schema.sql");

const quotedSchemaPath = `"${schemaPath}"`;
const sql = execSync(
  `npm exec -w apps/api -- prisma migrate diff --from-empty --to-schema-datamodel ${quotedSchemaPath} --script`,
  {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  },
);

const header = `-- FarmaDelivery database schema snapshot
-- Source: apps/api/prisma/schema.prisma
-- Regenerate with: npm run db:schema:snapshot
-- Do not edit manually; update Prisma schema first.

`;

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, header + sql, "utf8");

console.log(`Schema snapshot written to ${outputPath}`);
