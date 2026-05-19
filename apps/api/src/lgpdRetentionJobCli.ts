import { pathToFileURL } from "node:url";
import { prisma } from "./prisma";
import { deleteLocalProofBinary, runLgpdRetentionJob } from "./lgpdRetentionJob";

type CliArgs = {
  apply: boolean;
  deleteProofBinaries: boolean;
};

export function parseLgpdRetentionJobArgs(args: string[]): CliArgs {
  const parsed: CliArgs = {
    apply: false,
    deleteProofBinaries: false,
  };

  for (const arg of args) {
    if (arg === "--apply" || arg === "apply=true") {
      parsed.apply = true;
      continue;
    }
    if (arg === "--delete-proof-binaries" || arg === "deleteProofBinaries=true") {
      parsed.deleteProofBinaries = true;
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      throw new Error(usage());
    }
    throw new Error(`Argumento desconhecido: ${arg}\n${usage()}`);
  }

  return parsed;
}

async function runCli() {
  try {
    const args = parseLgpdRetentionJobArgs(process.argv.slice(2));
    const result = await runLgpdRetentionJob(prisma as unknown as Parameters<typeof runLgpdRetentionJob>[0], {
      apply: args.apply,
      deleteProofBinary: args.deleteProofBinaries ? deleteLocalProofBinary : undefined,
    });

    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : "Falha ao executar rotina LGPD."}\n`);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

function usage() {
  return [
    "Uso: npm run lgpd:retention --workspace apps/api -- [--apply] [--delete-proof-binaries]",
    "",
    "Sem --apply, a rotina roda em dry-run e nao altera banco/arquivos.",
    "--delete-proof-binaries so tem efeito junto de --apply e remove os arquivos fisicos planejados.",
  ].join("\n");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void runCli();
}
