// frontend/src/store/location.store.tsx
import { create } from 'zustand';
import {
  INITIAL_LOCATION_STATE,
  formatLocation,
  type LocationItem,
} from './location.constants';

type LocationState = LocationItem & {
  setCountry: (country: string | undefined) => void;
  setCity: (city: string | undefined) => void;
  setDistrict: (district: string | undefined) => void;
  reset: () => void;
  asLabel: () => string;
};

export const useLocationStore = create<LocationState>((set, get) => ({
  ...INITIAL_LOCATION_STATE,

  setCountry: (country) => set({ country }),
  setCity: (city) => set({ city }),
  setDistrict: (district) => set({ district }),

  reset: () => set({ ...INITIAL_LOCATION_STATE }),

  asLabel: () =>
    formatLocation({
      country: get().country,
      city: get().city,
      district: get().district,
    }),
}));
