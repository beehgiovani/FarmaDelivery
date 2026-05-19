import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import {
  buildLgpdRetentionImpactCsv,
  buildLgpdRetentionPlan,
  summarizeLgpdRetentionImpact,
  type LgpdRetentionPlanInput,
} from "./lgpdRetention";

export type LgpdRetentionDryRunFormat = "json" | "csv";

export type LgpdRetentionDryRunOptions = {
  format?: LgpdRetentionDryRunFormat;
  requestedBy?: string;
};

export function buildLgpdRetentionDryRunOutput(input: LgpdRetentionPlanInput, options: LgpdRetentionDryRunOptions = {}) {
  const plan = buildLgpdRetentionPlan(input);
  const format = options.format ?? "json";

  if (format === "csv") {
    return buildLgpdRetentionImpactCsv(plan, {
      requestedBy: options.requestedBy,
      dryRun: true,
    });
  }

  return JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      mode: "dry-run",
      requestedBy: options.requestedBy ?? null,
      planGeneratedAt: plan.generatedAt,
      impact: summarizeLgpdRetentionImpact(plan),
    },
    null,
    2,
  );
}

type CliArgs = {
  inputPath?: string;
  outputPath?: string;
  format: LgpdRetentionDryRunFormat;
  requestedBy?: string;
};

export function parseLgpdRetentionDryRunArgs(args: string[]): CliArgs {
  const parsed: CliArgs = { format: "json" };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const value = args[index + 1];
    const [key, inlineValue] = arg.includes("=") ? arg.split(/=(.*)/s, 2) : [arg, undefined];

    if (key === "input" || key === "in") {
      if (!inlineValue) throw new Error("Informe o caminho em input=<arquivo>.");
      parsed.inputPath = inlineValue;
      continue;
    }
    if (key === "out" || key === "output") {
      if (!inlineValue) throw new Error("Informe o caminho em out=<arquivo>.");
      parsed.outputPath = inlineValue;
      continue;
    }
    if (key === "format") {
      if (inlineValue !== "json" && inlineValue !== "csv") throw new Error("format deve ser json ou csv.");
      parsed.format = inlineValue;
      continue;
    }
    if (key === "requestedBy" || key === "requested-by") {
      if (!inlineValue) throw new Error("Informe o valor em requestedBy=<identificacao>.");
      parsed.requestedBy = inlineValue;
      continue;
    }

    if (arg === "--input" || arg === "-i") {
      if (!value) throw new Error("Informe o caminho apos --input.");
      parsed.inputPath = value;
      index += 1;
      continue;
    }
    if (arg === "--out" || arg === "-o") {
      if (!value) throw new Error("Informe o caminho apos --out.");
      parsed.outputPath = value;
      index += 1;
      continue;
    }
    if (arg === "--format" || arg === "-f") {
      if (value !== "json" && value !== "csv") throw new Error("--format deve ser json ou csv.");
      parsed.format = value;
      index += 1;
      continue;
    }
    if (arg === "--requested-by") {
      if (!value) throw new Error("Informe o valor apos --requested-by.");
      parsed.requestedBy = value;
      index += 1;
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      throw new Error(usage());
    }

    throw new Error(`Argumento desconhecido: ${arg}\n${usage()}`);
  }

  return parsed;
}

function runCli() {
  try {
    const args = parseLgpdRetentionDryRunArgs(process.argv.slice(2));
    const input = readInput(args.inputPath);
    const output = buildLgpdRetentionDryRunOutput(JSON.parse(input) as LgpdRetentionPlanInput, {
      format: args.format,
      requestedBy: args.requestedBy,
    });

    if (args.outputPath) {
      writeFileSync(args.outputPath, output, "utf8");
      return;
    }
    process.stdout.write(`${output}\n`);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : "Falha no dry-run LGPD."}\n`);
    process.exitCode = 1;
  }
}

function readInput(inputPath?: string) {
  if (inputPath) return readFileSync(inputPath, "utf8");
  return readFileSync(0, "utf8");
}

function usage() {
  return [
    "Uso: npm run lgpd:dry-run --workspace apps/api -- input=plano.json format=json",
    "",
    "Opcoes:",
    "  input=<arquivo>       Caminho do JSON de entrada. Se omitido, le stdin.",
    "  out=<arquivo>         Caminho de saida. Se omitido, escreve no stdout.",
    "  format=json|csv       Formato de saida. Padrao: json.",
    "  requestedBy=<texto>   Identificacao operacional de quem pediu o dry-run.",
  ].join("\n");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCli();
}
