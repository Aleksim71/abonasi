import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { LOCATIONS } from './location.constants';

type LocationState = {
  selectedId?: string;

  setLocation: (id: string) => void;

  hasLocation: () => boolean;
  asLabel: () => string;

  reset: () => void;
};

const INITIAL: Pick<LocationState, 'selectedId'> = {
  selectedId: undefined
};

export const useLocationStore = create<LocationState>()(
  persist(
    (set, get) => ({
      ...INITIAL,

      setLocation: (id) => set({ selectedId: id }),

      hasLocation: () => Boolean(get().selectedId),

      asLabel: () => {
        const id = get().selectedId;
        if (!id) return '';
        const found = LOCATIONS.find((x) => x.id === id);
        return found ? found.label : id;
      },

      reset: () => set({ ...INITIAL })
    }),
    {
      name: 'abonasi.location.v1',
      version: 1,
      partialize: (s) => ({ selectedId: s.selectedId })
    }
  )
);
