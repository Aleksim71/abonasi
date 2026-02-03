// frontend/src/store/subscriptions.store.tsx
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  INITIAL_SUBSCRIPTIONS_STATE,
  SUBSCRIPTION_PLANS,
  type SubscriptionPlan
} from './subscriptions.constants';

type SubscriptionsState = {
  selectedPlanKey?: SubscriptionPlan['key'];

  setPlan: (key: SubscriptionPlan['key']) => void;
  reset: () => void;

  hasPlan: () => boolean;
  asLabel: () => string;
};

export const useSubscriptionsStore = create<SubscriptionsState>()(
  persist(
    (set, get) => ({
      ...INITIAL_SUBSCRIPTIONS_STATE,

      setPlan: (key) => set({ selectedPlanKey: key }),
      reset: () => set({ ...INITIAL_SUBSCRIPTIONS_STATE }),

      hasPlan: () => Boolean(get().selectedPlanKey),

      asLabel: () => {
        const key = get().selectedPlanKey;
        if (!key) return 'Не выбрано';
        const found = SUBSCRIPTION_PLANS.find((p) => p.key === key);
        return found ? `${found.title} · ${found.priceText}` : String(key);
      }
    }),
    {
      name: 'abonasi.subscriptions.v1',
      partialize: (s) => ({ selectedPlanKey: s.selectedPlanKey }),
      version: 1
    }
  )
);
