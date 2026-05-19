import { randomBytes } from "node:crypto";

const args = parseArgs(process.argv.slice(2));
const secret = randomBytes(args.bytes).toString("base64url");

if (args.check) {
  process.stdout.write(
    `${JSON.stringify(
      {
        ok: secret.length >= 43,
        variable: "API_SESSION_SECRET",
        randomBytes: args.bytes,
        characters: secret.length,
      },
      null,
      2,
    )}\n`,
  );
} else {
  process.stdout.write(`API_SESSION_SECRET="${secret}"\n`);
}

function parseArgs(rawArgs) {
  const parsed = {
    bytes: 64,
    check: false,
  };

  for (const arg of rawArgs) {
    if (arg === "--help" || arg === "-h") {
      process.stdout.write("Uso: npm run secret:session -- [bytes=64] [--check]\n");
      process.exit(0);
    }
    if (arg === "--check") {
      parsed.check = true;
      continue;
    }
    if (arg.startsWith("bytes=")) {
      parsed.bytes = Number(arg.slice("bytes=".length));
      continue;
    }
    throw new Error(`Argumento desconhecido: ${arg}`);
  }

  if (!Number.isInteger(parsed.bytes) || parsed.bytes < 32) {
    throw new Error("bytes deve ser um inteiro de pelo menos 32.");
  }

  return parsed;
}
