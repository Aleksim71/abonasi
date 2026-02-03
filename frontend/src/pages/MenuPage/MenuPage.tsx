import React from 'react';
import { useNavigate } from 'react-router-dom';

import { useLocationStore } from '../../store/location.store';
import { useSectionsStore } from '../../store/sections.store';
import { useSubscriptionsStore } from '../../store/subscriptions.store';
import { useSettingsStore } from '../../store/settings.store';

import './MenuPage.css';

function languageLabel(lang: string): string {
  if (lang === 'ru') return 'Русский';
  if (lang === 'en') return 'English';
  if (lang === 'de') return 'Deutsch';
  return lang;
}

export function MenuPage() {
  const nav = useNavigate();

  const hasLocation = useLocationStore((s) => s.hasLocation());
  const locationLabel = useLocationStore((s) => s.asLabel());

  const hasSections = useSectionsStore((s) => s.hasAny());
  const sectionsLabel = useSectionsStore((s) => s.asLabel());

  const hasSubscription = useSubscriptionsStore((s) => s.hasPlan());
  const subscriptionLabel = useSubscriptionsStore((s) => s.asLabel());

  const uiLang = useSettingsStore((s) => s.language);
  const notificationsEnabled = useSettingsStore((s) => s.notificationsEnabled);

  const settingsMeta = `Язык: ${languageLabel(uiLang)} · Уведомления: ${
    notificationsEnabled ? 'Вкл' : 'Выкл'
  }`;

  return (
    <main className="screen">
      <header className="header" aria-label="Шапка">
        <h1 className="title">Abonasi</h1>
      </header>

      <div className="group" aria-label="Конфигурация">
        <button className="card" onClick={() => nav('/locations')}>
          <div className="cardTitle">Локация</div>
          {hasLocation && <div className="cardMeta">{locationLabel}</div>}
        </button>

        <button
          className="card"
          disabled={!hasLocation}
          onClick={() => nav('/sections')}
        >
          <div className="cardTitle">Разделы</div>
          {hasSections && <div className="cardMeta">{sectionsLabel}</div>}
        </button>

        <button
          className="card"
          disabled={!hasLocation || !hasSections}
          onClick={() => nav('/subscriptions')}
        >
          <div className="cardTitle">Подписки</div>
          {hasSubscription && (
            <div className="cardMeta">{subscriptionLabel}</div>
          )}
        </button>
      </div>

      <div className="group" aria-label="Настройки">
        <button className="card" onClick={() => nav('/settings')}>
          <div className="cardTitle">Настройки</div>
          <div className="cardMeta">{settingsMeta}</div>
        </button>
      </div>

      <div className="group" aria-label="Информация">
        <button className="card" onClick={() => nav('/about')}>
          <div className="cardTitle">О проекте</div>
        </button>

        <button className="card" onClick={() => nav('/rules')}>
          <div className="cardTitle">Правила</div>
        </button>
      </div>
    </main>
  );
}
