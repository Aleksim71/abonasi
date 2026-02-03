// frontend/src/store/settings.store.tsx
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { useLocationStore } from './location.store';
import { useSectionsStore } from './sections.store';
import { useSubscriptionsStore } from './subscriptions.store';

export type UiLanguage = 'ru' | 'en' | 'de';

type SettingsState = {
  notificationsEnabled: boolean;
  language: UiLanguage;

  setNotificationsEnabled: (enabled: boolean) => void;
  setLanguage: (lang: UiLanguage) => void;

  /**
   * Сброс только настроек (язык/уведомления)
   */
  reset: () => void;

  /**
   * Сброс всей конфигурации приложения:
   * - location
   * - sections
   * - subscriptions
   * - settings
   */
  resetAll: () => void;
};

const INITIAL_SETTINGS_STATE: Pick<SettingsState, 'notificationsEnabled' | 'language'> = {
  notificationsEnabled: true,
  language: 'ru'
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      ...INITIAL_SETTINGS_STATE,

      setNotificationsEnabled: (enabled) => set({ notificationsEnabled: enabled }),
      setLanguage: (language) => set({ language }),

      reset: () => set({ ...INITIAL_SETTINGS_STATE }),

      resetAll: () => {
        // 1) Сбрасываем внешние конфиги
        useLocationStore.getState().reset();
        useSectionsStore.getState().reset();
        useSubscriptionsStore.getState().reset();

        // 2) Сбрасываем настройки
        get().reset();
      }
    }),
    {
      name: 'abonasi.settings.v1',
      version: 1,
      partialize: (s) => ({
        notificationsEnabled: s.notificationsEnabled,
        language: s.language
      })
    }
  )
);
