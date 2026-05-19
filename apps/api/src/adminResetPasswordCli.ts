import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { hashPassword } from "./passwordHash";
import type { SupabaseUser } from "./supabaseRest";

type ResetArgs = {
  password?: string;
  email?: string;
  phone?: string;
  id?: string;
  allAdmins: boolean;
};

type ResetTarget = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
};

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

loadEnvFile(resolve(root, "env/api.env"));
loadEnvFile(resolve(root, "apps/api/.env"));

const args = parseResetArgs(process.argv.slice(2));

if (!args.password || args.password.length < 8) {
  exitWithUsage("Informe uma nova senha com pelo menos 8 caracteres.");
}

await resetAdminPassword(args);

export function parseResetArgs(argv: string[]): ResetArgs {
  const parsed: ResetArgs = {
    allAdmins: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--all-admins" || arg === "allAdmins=true") {
      parsed.allAdmins = true;
      continue;
    }

    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const value = argv[index + 1];
      index += 1;
      assignArg(parsed, key, value);
      continue;
    }

    const [key, ...valueParts] = arg.split("=");
    if (valueParts.length > 0) {
      assignArg(parsed, key, valueParts.join("="));
    }
  }

  return parsed;
}

function assignArg(parsed: ResetArgs, key: string, value?: string) {
  if (!value) return;
  if (key === "password" || key === "senha") parsed.password = value;
  if (key === "email") parsed.email = value;
  if (key === "phone" || key === "telefone") parsed.phone = value;
  if (key === "id" || key === "userId") parsed.id = value;
}

async function resetAdminPassword(args: ResetArgs) {
  const passwordHash = hashPassword(args.password!);

  try {
    const { prisma } = await import("./prisma");
    const targets = await prisma.user.findMany({
      where: adminWhere(args),
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
      },
    });
    assertResetTargets(targets, args);

    for (const target of targets) {
      await prisma.user.update({
        where: { id: target.id },
        data: { passwordHash },
      });
    }

    await prisma.$disconnect();
    printResetSummary(targets, "prisma");
    return;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`Reset via Prisma falhou, tentando Supabase REST: ${message}`);
  }

  const { canUseSupabaseRest, supabaseRest } = await import("./supabaseRest");
  if (!canUseSupabaseRest()) {
    throw new Error("Supabase REST server credentials are not configured.");
  }

  const users = await supabaseRest<Array<SupabaseUser>>("User", {
    query: `select=id,name,email,phone,role,active&${adminRestFilter(args)}`,
  });
  const targets = users.map((user) => ({
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
  }));
  assertResetTargets(targets, args);

  for (const target of targets) {
    await supabaseRest("User", {
      method: "PATCH",
      query: `id=eq.${target.id}`,
      body: {
        passwordHash,
      },
    });
  }

  printResetSummary(targets, "supabase-rest");
}

function adminWhere(args: ResetArgs) {
  return {
    role: "ADMIN" as const,
    active: true,
    ...(args.id ? { id: args.id } : {}),
    ...(args.email ? { email: args.email } : {}),
    ...(args.phone ? { phone: args.phone } : {}),
  };
}

function adminRestFilter(args: ResetArgs) {
  const filters = ["role=eq.ADMIN", "active=eq.true"];
  if (args.id) filters.push(`id=eq.${encodeURIComponent(args.id)}`);
  if (args.email) filters.push(`email=eq.${encodeURIComponent(args.email)}`);
  if (args.phone) filters.push(`phone=eq.${encodeURIComponent(args.phone)}`);
  return filters.join("&");
}

function assertResetTargets(targets: ResetTarget[], args: ResetArgs) {
  if (targets.length === 0) {
    throw new Error("Nenhum admin ativo encontrado para resetar.");
  }
  if (targets.length > 1 && !args.allAdmins && !args.email && !args.phone && !args.id) {
    throw new Error(
      `Foram encontrados ${targets.length} admins ativos. Informe email=..., telefone=... ou id=..., ou use --all-admins.`,
    );
  }
}

function printResetSummary(targets: ResetTarget[], source: string) {
  const labels = targets.map((target) => target.email ?? target.phone ?? target.id).join(", ");
  console.log(`Senha resetada com sucesso via ${source} para: ${labels}`);
}

function loadEnvFile(path: string) {
  if (!existsSync(path)) return;
  const content = readFileSync(path, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator === -1) continue;

    const key = trimmed.slice(0, separator).trim();
    const rawValue = trimmed.slice(separator + 1).trim();
    if (!key || process.env[key]) continue;
    process.env[key] = unquoteEnvValue(rawValue);
  }
}

function unquoteEnvValue(value: string) {
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  return value;
}

function exitWithUsage(message: string): never {
  console.error(message);
  console.error("Uso: npm run admin:reset-password -- password=NovaSenhaSegura [email=admin@exemplo.com]");
  process.exit(1);
}
