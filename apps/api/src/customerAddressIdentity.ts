export type CustomerAddressComparable = {
  street: string;
  number: string;
  complement?: string | null;
  neighborhood?: string | null;
};

export type CustomerAddressInput = CustomerAddressComparable;

export function findMatchingCustomerAddress<T extends CustomerAddressComparable>(
  addresses: T[],
  data: CustomerAddressInput,
) {
  const wanted = normalizeAddressIdentity(data);
  return addresses.find((address) => normalizeAddressIdentity(address) === wanted);
}

export function normalizeAddressIdentity(address: CustomerAddressComparable) {
  return [address.street, address.number, address.neighborhood ?? "", address.complement ?? ""]
    .map(normalizeAddressPart)
    .join("|");
}

export function addressHasDifferentCoordinates(
  address: { latitude?: number | string | null; longitude?: number | string | null },
  coordinates: { latitude: number; longitude: number },
) {
  const latitude = Number(address.latitude);
  const longitude = Number(address.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return true;
  return latitude !== coordinates.latitude || longitude !== coordinates.longitude;
}

function normalizeAddressPart(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}
