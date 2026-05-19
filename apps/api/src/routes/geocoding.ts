import type { FastifyInstance } from "fastify";
import { requireAuth } from "../auth";
import { geocodeAddressQuerySchema } from "../contracts";
import { validationError } from "../http";

type NominatimPlace = {
  lat: string;
  lon: string;
  display_name: string;
  importance?: number;
};

type GeocodeInput = typeof geocodeAddressQuerySchema._output;

type GeocodePlace = {
  latitude: number;
  longitude: number;
  label: string;
  confidence: number | null;
};

type GeocodeResponse = GeocodePlace & {
  query: string;
  alternatives: GeocodePlace[];
  source?: "cache";
};

type GeocodeCacheEntry = {
  expiresAt: number;
  value: GeocodeResponse;
};

const GEOCODE_CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 30;
const GEOCODE_CACHE_MAX_ENTRIES = 500;
const NOMINATIM_MIN_INTERVAL_MS = 1100;
const geocodeCache = new Map<string, GeocodeCacheEntry>();
let nextNominatimRequestAt = 0;

/** Registra busca autenticada de coordenadas para preencher endereco de entrega no painel. */
export async function geocodingRoutes(app: FastifyInstance) {
  app.get("/geocode/address", async (request, reply) => {
    const session = await requireAuth(request, reply, ["ADMIN", "GERENTE"]);
    if (!session) return;

    const parsed = geocodeAddressQuerySchema.safeParse(request.query);
    if (!parsed.success) return validationError(reply, parsed.error);

    const cacheKey = buildGeocodeCacheKey(parsed.data);
    const cached = readGeocodeCache(cacheKey);
    if (cached) return { ...cached, source: "cache" };

    const queries = buildGeocodeQueries(parsed.data);

    try {
      const places = (await searchNominatimUntilFound(queries))
        .filter((place, index, all) => all.findIndex((item) => item.label === place.label) === index)
        .sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0));

      const best = places[0];
      if (!best) {
        return reply.status(404).send({
          error: "ADDRESS_NOT_FOUND",
          message: "Nao encontramos coordenadas para esse endereco. Confira rua, numero e bairro.",
        });
      }

      const payload: GeocodeResponse = {
        query: queries[0],
        ...best,
        alternatives: places.slice(1, 4),
      };
      writeGeocodeCache(cacheKey, payload);
      return payload;
    } catch (error) {
      app.log.error({ error }, "geocode address error");
      return reply.status(503).send({
        error: "GEOCODER_FAILED",
        message: "Nao foi possivel buscar coordenadas agora.",
      });
    }
  });
}

/** Monta buscas progressivas, da mais precisa ate uma alternativa por bairro/cidade. */
export function buildGeocodeQueries(input: GeocodeInput): string[] {
  const street = expandStreetAbbreviation(input.street);
  return [
    [street, input.number, input.neighborhood, input.city, input.state, "Brasil"].filter(Boolean).join(" "),
    [`${street} ${input.number}`, input.city, input.state, "Brasil"].filter(Boolean).join(", "),
    [street, input.neighborhood, input.city, input.state, "Brasil"].filter(Boolean).join(", "),
  ];
}

/** Consulta alternativas uma por vez para respeitar o limite publico do Nominatim. */
async function searchNominatimUntilFound(queries: string[]): Promise<GeocodePlace[]> {
  for (const query of queries) {
    const places = await searchNominatim(query);
    if (places.length > 0) return places;
  }
  return [];
}

/** Consulta Nominatim com User-Agent identificavel e retorna somente coordenadas validas. */
async function searchNominatim(query: string): Promise<GeocodePlace[]> {
  const params = new URLSearchParams({
    format: "jsonv2",
    q: query,
    limit: "5",
    addressdetails: "1",
    countrycodes: "br",
  });

  await waitForNominatimSlot();

  const response = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
    headers: {
      "User-Agent": "Drogaria Santo Antonio/0.1 (Drogaria Santo Antonio)",
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Nominatim returned ${response.status}`);
  }

  return ((await response.json()) as NominatimPlace[])
    .map((place) => ({
      latitude: Number(place.lat),
      longitude: Number(place.lon),
      label: place.display_name,
      confidence: place.importance ?? null,
    }))
    .filter((place) => Number.isFinite(place.latitude) && Number.isFinite(place.longitude));
}

/** Mantem uma fila simples por processo para nao ultrapassar 1 requisicao por segundo. */
async function waitForNominatimSlot() {
  const now = Date.now();
  const waitMs = Math.max(0, nextNominatimRequestAt - now);
  nextNominatimRequestAt = Math.max(now, nextNominatimRequestAt) + NOMINATIM_MIN_INTERVAL_MS;
  if (waitMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }
}

/** Cria chave estavel do cache considerando rua, numero, bairro, cidade e estado. */
function buildGeocodeCacheKey(input: GeocodeInput): string {
  return [input.street, input.number, input.neighborhood ?? "", input.city, input.state]
    .map(normalizeCachePart)
    .join("|");
}

/** Normaliza partes do endereco para aumentar chance de reaproveitar cache. */
function normalizeCachePart(value: string): string {
  return expandStreetAbbreviation(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Le cache em memoria e renova a ordem para remover primeiro os itens menos recentes. */
function readGeocodeCache(key: string): GeocodeResponse | null {
  const entry = geocodeCache.get(key);
  if (!entry) return null;

  if (entry.expiresAt < Date.now()) {
    geocodeCache.delete(key);
    return null;
  }

  geocodeCache.delete(key);
  geocodeCache.set(key, entry);
  return entry.value;
}

/** Grava resultado no cache com limite de tamanho para nao crescer indefinidamente. */
function writeGeocodeCache(key: string, value: GeocodeResponse) {
  geocodeCache.set(key, { expiresAt: Date.now() + GEOCODE_CACHE_TTL_MS, value });

  while (geocodeCache.size > GEOCODE_CACHE_MAX_ENTRIES) {
    const oldestKey = geocodeCache.keys().next().value;
    if (!oldestKey) break;
    geocodeCache.delete(oldestKey);
  }
}

/** Expande abreviacoes comuns digitadas pela loja antes da busca externa. */
function expandStreetAbbreviation(street: string) {
  return street
    .trim()
    .replace(/^av\.?\s+/i, "Avenida ")
    .replace(/^r\.?\s+/i, "Rua ");
}
