import assert from "node:assert/strict";
import test from "node:test";
import { buildLgpdRetentionDryRunOutput, parseLgpdRetentionDryRunArgs } from "./lgpdRetentionCli";

const input = {
  now: "2026-05-16T12:00:00.000Z",
  deliveries: [
    {
      id: "delivery-secret-id",
      status: "ENTREGUE",
      createdAt: "2024-04-01T10:00:00.000Z",
      deliveredAt: "2024-04-10T10:00:00.000Z",
    },
  ],
  deviceTokens: [{ id: "token-secret-id", active: true, lastSeenAt: "2026-01-01T10:00:00.000Z" }],
};

test("builds LGPD dry-run JSON output without exposing record ids", () => {
  const output = buildLgpdRetentionDryRunOutput(input, {
    requestedBy: "admin@example.com",
  });
  const payload = JSON.parse(output);

  assert.equal(payload.mode, "dry-run");
  assert.equal(payload.requestedBy, "admin@example.com");
  assert.equal(payload.planGeneratedAt, "2026-05-16T12:00:00.000Z");
  assert.equal(payload.impact.totalActions, 2);
  assert.deepEqual(payload.impact.byCategory, [
    { category: "entregas", action: "anonymize", count: 1 },
    { category: "tokens_notificacao", action: "deactivate", count: 1 },
  ]);
  assert.doesNotMatch(output, /delivery-secret-id|token-secret-id/);
});

test("builds LGPD dry-run CSV output with formula-safe requester", () => {
  const output = buildLgpdRetentionDryRunOutput(input, {
    format: "csv",
    requestedBy: "=admin@example.com",
  });

  assert.match(output, /"contexto_lgpd"/);
  assert.match(output, /"modo","dry-run"/);
  assert.match(output, /"solicitado_por","'=admin@example.com"/);
  assert.match(output, /"entregas","anonymize","1"/);
  assert.doesNotMatch(output, /delivery-secret-id|token-secret-id/);
});

test("parses LGPD dry-run CLI arguments", () => {
  assert.deepEqual(
    parseLgpdRetentionDryRunArgs([
      "--input",
      "input.json",
      "--out",
      "impact.csv",
      "--format",
      "csv",
      "--requested-by",
      "admin@example.com",
    ]),
    {
      inputPath: "input.json",
      outputPath: "impact.csv",
      format: "csv",
      requestedBy: "admin@example.com",
    },
  );
  assert.deepEqual(
    parseLgpdRetentionDryRunArgs(["input=input.json", "out=impact.csv", "format=csv", "requestedBy=admin@example.com"]),
    {
      inputPath: "input.json",
      outputPath: "impact.csv",
      format: "csv",
      requestedBy: "admin@example.com",
    },
  );
  assert.throws(() => parseLgpdRetentionDryRunArgs(["--format", "xml"]), /json ou csv/);
});
