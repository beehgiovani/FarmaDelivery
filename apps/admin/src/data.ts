import type { Courier, Delivery, StoreUnit } from "./types";

export const stores: StoreUnit[] = [
  {
    name: "Asturias",
    code: "Loja 1",
    address: "Av. dos Caicaras, 1171 - Asturias",
    queue: 0,
    color: "#0f766e",
    baseType: "compartilhada",
    weeklyHours: buildWeeklyHours("08:00", "23:00"),
    coordinates: { lat: -24.003825377135037, lng: -46.27390399967142 },
  },
  {
    name: "Morrinhos",
    code: "Loja 2",
    address: "Rua Poeta Augusto Frederico Schimidt, 10 - Jardim Brasil, Morrinhos",
    queue: 0,
    color: "#2563eb",
    baseType: "compartilhada",
    weeklyHours: buildWeeklyHours("08:00", "22:00"),
    coordinates: { lat: -23.964168794468087, lng: -46.248774250478476 },
  },
  {
    name: "Santa Rosa",
    code: "Loja 3",
    address: "Rua Jose Vaz Porto, 588 - proximo a Praca do Povo, Santa Rosa",
    queue: 0,
    color: "#7c3aed",
    baseType: "compartilhada",
    weeklyHours: buildWeeklyHours("08:00", "22:00"),
    coordinates: { lat: -23.997109238797034, lng: -46.281454771363265 },
  },
  {
    name: "Santo Antonio",
    code: "Loja 4",
    address: "Alameda das Tulipas, 660 - Santo Antonio",
    queue: 0,
    color: "#c2410c",
    baseType: "compartilhada",
    weeklyHours: buildWeeklyHours("08:00", "22:00"),
    coordinates: { lat: -23.988665940641404, lng: -46.27191884702851 },
  },
  {
    name: "Pereque",
    code: "Loja 5",
    address: "Av. Rio Amazonas, 151 - Praia do Pereque, Pereque",
    queue: 0,
    color: "#be123c",
    baseType: "dedicada",
    weeklyHours: buildWeeklyHours("08:00", "22:00"),
    coordinates: { lat: -23.936657123533344, lng: -46.18317681991032 },
  },
];

export const deliveries: Delivery[] = [];

export const couriers: Courier[] = [];

function buildWeeklyHours(opensAt: string, closesAt: string) {
  return Array.from({ length: 7 }, (_, dayOfWeek) => ({
    dayOfWeek,
    opensAt,
    closesAt,
    closed: false,
  }));
}
