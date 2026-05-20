import type { StoreUnit, TeamRole, TeamUser } from "./types";

const initialPasswordAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

export type StoreAccessRow = {
  store: StoreUnit;
  users: TeamUser[];
};

export type CreatedAccessCard = {
  name: string;
  login: string;
  password: string;
  role: TeamRole;
  storeName: string;
};

export type AccessFlow = "counterReference" | "systemAccess" | "courierAccess";

export type AccessFormState = {
  name: string;
  employeeCode: string;
  phone: string;
  email: string;
  password: string;
  role: TeamRole;
  storeId: string;
};

export function activeStoreAccessUsers(users: TeamUser[]) {
  return users.filter((user) => user.active && user.role === "GERENTE" && user.store?.id);
}

export function requiresBaseStoreForRole(role: TeamRole) {
  return role === "GERENTE" || role === "MOTOBOY";
}

export function requiresLoginCredentialsForRole(role: TeamRole) {
  return role !== "BALCONISTA_CAIXA";
}

export function accessFlowForRole(role: TeamRole): AccessFlow {
  if (role === "BALCONISTA_CAIXA") return "counterReference";
  if (role === "MOTOBOY") return "courierAccess";
  return "systemAccess";
}

export function buildAccessFormForFlow(input: {
  flow: AccessFlow;
  current: AccessFormState;
  defaultStoreId?: string;
  initialPassword?: string;
}): AccessFormState {
  if (input.flow === "counterReference") {
    return {
      ...input.current,
      name: "",
      employeeCode: "",
      phone: "",
      email: "",
      password: "",
      role: "BALCONISTA_CAIXA",
      storeId: "",
    };
  }

  if (input.flow === "courierAccess") {
    return {
      ...input.current,
      name: "",
      employeeCode: "",
      phone: "",
      email: "",
      password: input.current.password || input.initialPassword || "",
      role: "MOTOBOY",
      storeId: input.current.storeId || input.defaultStoreId || "",
    };
  }

  return {
    ...input.current,
    name: "",
    employeeCode: "",
    phone: "",
    email: "",
    password: input.current.password || input.initialPassword || "",
    role: "GERENTE",
    storeId: input.current.storeId || input.defaultStoreId || "",
  };
}

export function buildStoreLoginAccessForm(input: { current: AccessFormState; store: StoreUnit; initialPassword: string }): AccessFormState {
  return {
    ...input.current,
    name: input.store.name,
    employeeCode: "",
    phone: "",
    email: "",
    password: input.initialPassword,
    role: "GERENTE",
    storeId: input.store.id ?? "",
  };
}

export function buildCounterReferenceName(input: { code?: string; name: string }) {
  const name = input.name.trim();
  const code = input.code?.trim();
  if (!name) return "";
  return code ? `${code} - ${name}` : name;
}

export function buildStoreAccessRows(stores: StoreUnit[], users: TeamUser[]): StoreAccessRow[] {
  const activeUsers = activeStoreAccessUsers(users);
  return stores.map((store) => ({
    store,
    users: activeUsers.filter((user) => user.store?.id === store.id || user.store?.name === store.name),
  }));
}

export function mergeStoreUnits(primary: StoreUnit[], extra: StoreUnit[]) {
  const seen = new Set<string>();
  return [...primary, ...extra].filter((store) => {
    const key = store.id ?? `${store.code}:${store.name}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function storeBaseLabel(baseType: StoreUnit["baseType"]) {
  return baseType === "dedicada" ? "Base dedicada" : "Base compartilhada";
}

export function formatStoreHours(store: StoreUnit) {
  const firstOpenDay = store.weeklyHours?.find((hours) => !hours.closed);
  if (!firstOpenDay) return "Horario pendente";
  return `${firstOpenDay.opensAt} as ${firstOpenDay.closesAt}`;
}

export function buildCreatedAccessCard(input: {
  name: string;
  email?: string | null;
  phone?: string | null;
  password: string;
  role: TeamRole;
  storeName: string;
}): CreatedAccessCard {
  return {
    name: input.name,
    login: (input.email?.trim() || input.phone?.trim() || "").trim(),
    password: input.password,
    role: input.role,
    storeName: input.storeName,
  };
}

export function generateInitialPassword(randomBytes = secureRandomBytes) {
  return `Farma${Array.from(randomBytes(10), (byte) => initialPasswordAlphabet[byte % initialPasswordAlphabet.length]).join("")}`;
}

function secureRandomBytes(length: number) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}
