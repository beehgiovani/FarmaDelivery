export type DeliveryScheduleMode = "agora" | "hoje" | "futuro";

export type DeliveryStoreHours = {
  dayOfWeek: number;
  opensAt: string;
  closesAt: string;
  closed: boolean;
};

/** Sugere um horario editavel para agilizar o preenchimento de entregas agendadas. */
export function buildDeliveryScheduleSuggestion(mode: DeliveryScheduleMode, now = new Date(), weeklyHours: DeliveryStoreHours[] = []) {
  if (mode === "agora") return "";

  if (mode === "hoje") {
    const suggestion = new Date(now);
    suggestion.setMinutes(0, 0, 0);
    suggestion.setHours(suggestion.getHours() + 1);
    return formatDateTimeLocalInput(moveToOpenStoreTime(suggestion, weeklyHours));
  }

  const suggestion = new Date(now);
  suggestion.setDate(suggestion.getDate() + 1);
  const openingTime = findOpeningTimeForDate(suggestion, weeklyHours) ?? "08:00";
  setTimeParts(suggestion, openingTime);
  return formatDateTimeLocalInput(moveToOpenStoreTime(suggestion, weeklyHours));
}

/** Formata o valor esperado por input datetime-local sem converter para UTC. */
export function formatDateTimeLocalInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hour}:${minute}`;
}

function moveToOpenStoreTime(candidate: Date, weeklyHours: DeliveryStoreHours[]) {
  if (!weeklyHours.length) return candidate;

  const adjusted = new Date(candidate);
  for (let offset = 0; offset < 8; offset += 1) {
    if (offset > 0) {
      adjusted.setDate(adjusted.getDate() + 1);
      adjusted.setHours(0, 0, 0, 0);
    }

    const hours = findHoursForDate(adjusted, weeklyHours);
    if (!hours || hours.closed) continue;

    const opensAt = minutesFromTime(hours.opensAt);
    const closesAt = minutesFromTime(hours.closesAt);
    const currentMinutes = adjusted.getHours() * 60 + adjusted.getMinutes();
    if (currentMinutes < opensAt) {
      setTimeParts(adjusted, hours.opensAt);
      return adjusted;
    }
    if (currentMinutes < closesAt) return adjusted;
  }

  return candidate;
}

function findOpeningTimeForDate(date: Date, weeklyHours: DeliveryStoreHours[]) {
  const hours = findHoursForDate(date, weeklyHours);
  return hours && !hours.closed ? hours.opensAt : undefined;
}

function findHoursForDate(date: Date, weeklyHours: DeliveryStoreHours[]) {
  return weeklyHours.find((hours) => hours.dayOfWeek === date.getDay());
}

function minutesFromTime(value: string) {
  const [hour = "0", minute = "0"] = value.split(":");
  return Number(hour) * 60 + Number(minute);
}

function setTimeParts(date: Date, time: string) {
  const [hour = "0", minute = "0"] = time.split(":");
  date.setHours(Number(hour), Number(minute), 0, 0);
}
