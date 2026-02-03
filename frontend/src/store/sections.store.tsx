// frontend/src/store/sections.store.tsx
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  INITIAL_SECTIONS_STATE,
  type SectionKey,
  SECTIONS,
} from './sections.constants';

type SectionsState = {
  selectedKeys: SectionKey[];

  toggle: (key: SectionKey) => void;
  setSelected: (keys: SectionKey[]) => void;
  reset: () => void;

  asLabel: () => string;
  hasAny: () => boolean;
};

function uniq(keys: SectionKey[]): SectionKey[] {
  return Array.from(new Set(keys));
}

export const useSectionsStore = create<SectionsState>()(
  persist(
    (set, get) => ({
      ...INITIAL_SECTIONS_STATE,

      toggle: (key) =>
        set((state) => {
          const exists = state.selectedKeys.includes(key);
          const next = exists
            ? state.selectedKeys.filter((k) => k !== key)
            : [...state.selectedKeys, key];
          return { selectedKeys: uniq(next) };
        }),

      setSelected: (keys) => set({ selectedKeys: uniq(keys) }),

      reset: () => set({ ...INITIAL_SECTIONS_STATE }),

      asLabel: () => {
        const keys = get().selectedKeys;
        if (!keys.length) return 'Не выбрано';

        const map = new Map(SECTIONS.map((s) => [s.key, s.title] as const));
        return keys.map((k) => map.get(k) ?? k).join(', ');
      },

      hasAny: () => Boolean(get().selectedKeys.length),
    }),
    {
      name: 'abonasi.sections.v1',
      partialize: (state) => ({
        selectedKeys: state.selectedKeys,
      }),
      version: 1,
    }
  )
);
