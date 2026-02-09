import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type LocationState = {
  // IMPORTANT: selectedId MUST be UUID (как требует backend)
  selectedId?: string;
  selectedLabel?: string;

  setLocation: (id: string, label?: string) => void;

  hasLocation: () => boolean;
  asLabel: () => string;

  reset: () => void;
};

const INITIAL: Pick<LocationState, 'selectedId' | 'selectedLabel'> = {
  selectedId: undefined,
  selectedLabel: undefined
};

function isUuid(v: string | undefined): boolean {
  if (!v) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

export const useLocationStore = create<LocationState>()(
  persist(
    (set, get) => ({
      ...INITIAL,

      setLocation: (id, label) => set({ selectedId: id, selectedLabel: label }),

      hasLocation: () => Boolean(get().selectedId),

      asLabel: () => get().selectedLabel || get().selectedId || '',

      reset: () => set({ ...INITIAL })
    }),
    {
      // сохраняем тот же ключ, чтобы миграция сработала автоматически
      name: 'abonasi.location.v1',
      version: 2,

      migrate: (persisted: unknown) => {
        if (!isRecord(persisted)) return { ...INITIAL };

        const selectedIdRaw = persisted.selectedId;
        const selectedLabelRaw = persisted.selectedLabel;

        const selectedId = typeof selectedIdRaw === 'string' ? selectedIdRaw : undefined;
        const selectedLabel = typeof selectedLabelRaw === 'string' ? selectedLabelRaw : undefined;

        // если в storage был slug типа munich.center — сбрасываем
        if (selectedId && !isUuid(selectedId)) {
          return { ...INITIAL };
        }

        return { selectedId, selectedLabel };
      },

      partialize: (s) => ({ selectedId: s.selectedId, selectedLabel: s.selectedLabel })
    }
  )
);
