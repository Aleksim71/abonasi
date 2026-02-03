// frontend/src/pages/SettingsPage/SettingsPage.tsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useSettingsStore, type UiLanguage } from '../../store/settings.store';
import './SettingsPage.css';

function languageLabel(lang: UiLanguage): string {
  if (lang === 'ru') return 'Русский';
  if (lang === 'en') return 'English';
  return 'Deutsch';
}

export function SettingsPage() {
  const nav = useNavigate();

  const notificationsEnabled = useSettingsStore((s) => s.notificationsEnabled);
  const language = useSettingsStore((s) => s.language);

  const setNotificationsEnabled = useSettingsStore((s) => s.setNotificationsEnabled);
  const setLanguage = useSettingsStore((s) => s.setLanguage);
  const resetAll = useSettingsStore((s) => s.resetAll);

  const onResetAll = () => {
    const ok = window.confirm(
      'Сбросить всю конфигурацию?\n\nБудут сброшены:\n— локация\n— разделы\n— подписки\n— настройки'
    );
    if (!ok) return;

    resetAll();
    nav('/', { replace: true });
  };

  return (
    <main className="settingsScreen">
      <header className="settingsHeader" aria-label="Шапка настроек">
        <button
          type="button"
          className="settingsBack"
          onClick={() => nav(-1)}
          aria-label="Назад"
          title="Назад"
        >
          ←
        </button>

        <h1 className="settingsTitle">Настройки</h1>
      </header>

      <section className="settingsGroup" aria-label="Уведомления">
        <div className="settingsCard">
          <div className="settingsCardTop">
            <div className="settingsCardTitle">Уведомления</div>

            <label className="switch" aria-label="Включить уведомления">
              <input
                type="checkbox"
                checked={notificationsEnabled}
                onChange={(e) => setNotificationsEnabled(e.target.checked)}
              />
              <span className="switchTrack" aria-hidden="true" />
            </label>
          </div>

          <div className="settingsCardMeta">
            Включить push/письма по подпискам
          </div>
        </div>
      </section>

      <section className="settingsGroup" aria-label="Язык">
        <div className="settingsCard">
          <div className="settingsCardTop">
            <div>
              <div className="settingsCardTitle">Язык</div>
              <div className="settingsCardMeta">Интерфейс приложения</div>
            </div>

            <select
              className="settingsSelect"
              value={language}
              onChange={(e) => setLanguage(e.target.value as UiLanguage)}
              aria-label="Язык интерфейса"
            >
              <option value="ru">Русский</option>
              <option value="en">English</option>
              <option value="de">Deutsch</option>
            </select>
          </div>

          <div className="settingsHint">
            Сейчас: <strong>{languageLabel(language)}</strong>
          </div>
        </div>
      </section>

      <section className="settingsGroup" aria-label="Сброс конфигурации">
        <div className="settingsCard settingsCardDanger">
          <div className="settingsCardTop">
            <div>
              <div className="settingsCardTitle">Сбросить конфигурацию</div>
              <div className="settingsCardMeta">
                Локация, разделы, подписки и настройки
              </div>
            </div>

            <button
              type="button"
              className="dangerBtn"
              onClick={onResetAll}
              aria-label="Сбросить"
            >
              Сбросить
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
