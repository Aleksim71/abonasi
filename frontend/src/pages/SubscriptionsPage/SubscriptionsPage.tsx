// frontend/src/pages/SubscriptionsPage/SubscriptionsPage.tsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useLocationStore } from '../../store/location.store';
import { useSectionsStore } from '../../store/sections.store';
import { useSubscriptionsStore } from '../../store/subscriptions.store';
import { SUBSCRIPTION_PLANS } from '../../store/subscriptions.constants';
import './SubscriptionsPage.css';

export function SubscriptionsPage() {
  const nav = useNavigate();

  const hasLocation = useLocationStore((s) => s.hasLocation());
  const locationLabel = useLocationStore((s) => s.asLabel());

  const hasSections = useSectionsStore((s) => s.hasAny());
  const sectionsLabel = useSectionsStore((s) => s.asLabel());

  const selectedPlanKey = useSubscriptionsStore((s) => s.selectedPlanKey);
  const setPlan = useSubscriptionsStore((s) => s.setPlan);
  const label = useSubscriptionsStore((s) => s.asLabel());

  // ----- blockers -----
  if (!hasLocation) {
    return (
      <main className="screen">
        <header className="header" aria-label="Шапка">
          <h1 className="title">Подписки</h1>
        </header>

        <p className="description">
          Сначала выберите локацию — подписки зависят от вашего города/района.
        </p>

        <div className="list">
          <button className="card" type="button" onClick={() => nav('/locations')}>
            <div className="cardTitle">Выбрать локацию</div>
            <div className="cardPrice">Перейти к выбору</div>
          </button>
        </div>
      </main>
    );
  }

  if (!hasSections) {
    return (
      <main className="screen">
        <header className="header" aria-label="Шапка">
          <h1 className="title">Подписки</h1>
        </header>

        <p className="description">
          Сначала выберите разделы — подписка работает по выбранным категориям.
        </p>

        <div className="list">
          <button className="card" type="button" onClick={() => nav('/sections')}>
            <div className="cardTitle">Выбрать разделы</div>
            <div className="cardPrice">Перейти к выбору</div>
          </button>
        </div>
      </main>
    );
  }

  // ----- main -----
  return (
    <main className="screen">
      <header className="header" aria-label="Шапка">
        <h1 className="title">Подписки</h1>
      </header>

      <p className="description">
        Локация: <strong>{locationLabel || '—'}</strong> · Разделы:{' '}
        <strong>{sectionsLabel}</strong>
      </p>

      <div className="list" aria-label="Список тарифов">
        {SUBSCRIPTION_PLANS.map((plan) => {
          const isActive = plan.key === selectedPlanKey;
          return (
            <button
              key={plan.key}
              type="button"
              className={`card ${isActive ? 'active' : ''}`}
              onClick={() => setPlan(plan.key)}
              aria-label={`${plan.title}, ${plan.priceText}${isActive ? ', выбран' : ''}`}
            >
              <div className="cardTitle">{plan.title}</div>
              <div className="cardPrice">{plan.priceText}</div>
              <div className="hint">{plan.description}</div>
            </button>
          );
        })}
      </div>

      <p className="hint" style={{ marginTop: 18 }}>
        Текущее: <strong>{label}</strong>
      </p>

      <div style={{ height: 14 }} />

      <button
        className={`card ${selectedPlanKey ? 'active' : ''}`}
        type="button"
        onClick={() => nav('/')}
        disabled={!selectedPlanKey}
        aria-disabled={!selectedPlanKey}
      >
        <div className="cardTitle">Готово</div>
        <div className="cardPrice">
          {selectedPlanKey ? 'Вернуться в меню' : 'Сначала выберите тариф'}
        </div>
      </button>
    </main>
  );
}
