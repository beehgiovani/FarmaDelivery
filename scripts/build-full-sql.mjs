import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputPath = resolve(root, "database/full-setup.sql");

const files = [
  "supabase/migrations/20260514011500_init_farmadelivery.sql",
  "supabase/migrations/20260514013000_store_hours.sql",
  "supabase/migrations/20260515041000_assignments.sql",
  "supabase/migrations/20260515052000_courier_device_tokens.sql",
  "supabase/migrations/20260515054000_delivery_notification_event.sql",
  "supabase/migrations/20260515193000_delivery_proofs.sql",
  "supabase/migrations/20260517120000_delivery_deadline_tier.sql",
  "supabase/migrations/20260517143000_delivery_daily_sequence.sql",
  "supabase/seed.sql",
  "supabase/store-hours-seed.sql",
  "supabase/policies.sql",
  "supabase/realtime.sql",
];

const sections = files.map((file) => {
  const absolutePath = resolve(root, file);
  if (!existsSync(absolutePath)) {
    throw new Error(`Missing SQL source: ${file}`);
  }

  return [
    "",
    "-- ============================================================================",
    `-- Source: ${file}`,
    "-- ============================================================================",
    "",
    readFileSync(absolutePath, "utf8"),
  ].join("\n");
});

const header = `-- FarmaDelivery consolidated database setup
-- Generated from current SQL files in /supabase
-- Use this as a full bootstrap/reference file.
-- Incremental migration files remain the source of chronological change history.
-- Regenerate with: npm run db:sql:full

`;

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, header + sections.join("\n"), "utf8");
console.log(`Full SQL setup written to ${outputPath}`);
