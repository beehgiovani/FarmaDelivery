import type { TeamUser } from "./types";

export type AttendantReferenceOption = {
  value: string;
  label: string;
};

export function parseAttendantReference(value: string) {
  const trimmed = value.trim();
  const match = trimmed.match(/^([A-Za-z0-9-]+)\s+-\s+(.+)$/);
  if (!match) return { code: "", name: trimmed };
  return {
    code: match[1].trim(),
    name: match[2].trim(),
  };
}

export function buildAttendantReferenceOptions(users: TeamUser[]): AttendantReferenceOption[] {
  return buildAttendantReferenceOptionsFromNames(
    users
      .filter((user) => user.active && user.role === "BALCONISTA_CAIXA")
      .map((user) => user.name),
  );
}

export function buildAttendantReferenceOptionsFromNames(names: string[]): AttendantReferenceOption[] {
  const seen = new Set<string>();
  return names
    .map((name) => name.trim())
    .filter(Boolean)
    .filter((name) => {
      const key = name.toLocaleLowerCase("pt-BR");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((left, right) => {
      const leftReference = parseAttendantReference(left);
      const rightReference = parseAttendantReference(right);
      return (
        leftReference.name.localeCompare(rightReference.name, "pt-BR", { sensitivity: "base" }) ||
        leftReference.code.localeCompare(rightReference.code, "pt-BR", { numeric: true, sensitivity: "base" })
      );
    })
    .map((value) => {
      const reference = parseAttendantReference(value);
      return {
        value,
        label: reference.code ? `${reference.name} - codigo ${reference.code}` : reference.name,
      };
    });
}
