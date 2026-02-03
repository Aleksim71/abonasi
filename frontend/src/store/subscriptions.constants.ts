// frontend/src/store/subscriptions.constants.ts

export type SubscriptionPlan = {
  key: 'basic' | 'plus' | 'pro';
  title: string;
  priceText: string;
  description: string;
};

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    key: 'basic',
    title: 'Базовая',
    priceText: '0 € / мес',
    description: 'Уведомления по выбранным разделам.'
  },
  {
    key: 'plus',
    title: 'Плюс',
    priceText: '2 € / мес',
    description: 'Больше лимиты, приоритетные уведомления.'
  },
  {
    key: 'pro',
    title: 'Профи',
    priceText: '5 € / мес',
    description: 'Максимум возможностей и гибкие настройки.'
  }
];

export const INITIAL_SUBSCRIPTIONS_STATE = {
  selectedPlanKey: undefined as SubscriptionPlan['key'] | undefined
};
