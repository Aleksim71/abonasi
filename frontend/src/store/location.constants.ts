// frontend/src/store/location.constants.ts

export type LocationItem = {
  country?: string;
  city?: string;
  district?: string;
};

export const INITIAL_LOCATION_STATE: LocationItem = {
  country: undefined,
  city: undefined,
  district: undefined,
};

export function formatLocation(loc: Partial<LocationItem>): string {
  return [loc.country, loc.city, loc.district].filter(Boolean).join(', ');
}
