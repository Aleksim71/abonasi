// frontend/src/pages/InfoSettingsPage.tsx
// Экран "Инфо" — MVP (публичный, guest vs auth)

import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../store/auth.store';
import { useLocationStore } from '../store/location.store';
import './InfoSettingsPage.css';

type LocationStoreShape = {
  selectedId: string | null;

  // Если в сторе есть готовая “человекочитаемая” строка — используем её.
  // Если этих полей нет в реальном сторе — TypeScript это не сломает,
  // потому что мы читаем их через селектор с приведением к этому shape
  // (но без any).
  selectedLabel?: string | null;
  selectedName?: string | null;
};

export function InfoSettingsPage() {
  const nav = useNavigate();
  const { token, clearAuth } = useAuth();

  const isAuthed = Boolean(token);

  // ✅ Источник истины как в RequireLocation
  const selectedId = useLocationStore((s) => (s as unknown as LocationStoreShape).selectedId);

  // ✅ Пытаемся взять “готовую” подпись, если стор её предоставляет
  const selectedLabel = useLocationStore((s) => {
    const st = s as unknown as LocationStoreShape;
    return st.selectedLabel ?? st.selectedName ?? null;
  });

  function onLogout() {
    localStorage.removeItem('token');
    clearAuth();
    nav('/login', { replace: true });
  }

  const locationText = selectedId ? (selectedLabel ?? selectedId) : 'Не выбрана';

  return (
    <div className="info-page">
      <header className="info-header">
        <button className="info-back" type="button" onClick={() => nav(-1)}>
          ← Назад
        </button>
        <h1 className="info-title">Инфо</h1>
      </header>

      <main className="info-content">
        <section className="info-section">
          <h2>О Abonasi</h2>
          <p>
            Abonasi — локальная доска объявлений для районов и городов.
            <br />
            Простые объявления. Без шума. Без алгоритмов.
          </p>

          <ul className="info-meta">
            <li>
              <span>Версия</span>
              <span>v0.x</span>
            </li>
            <li>
              <span>Локация</span>
              <span>{locationText}</span>
            </li>
          </ul>
        </section>

        <section className="info-section">
          <h2>Как это работает</h2>
          <ul className="info-list">
            <li>Выберите город</li>
            <li>Создайте и опубликуйте объявление</li>
            <li>Люди поблизости смогут его увидеть</li>
          </ul>
        </section>

        <section className="info-section">
          <h2>Правовая информация</h2>
          <ul className="info-links">
            <li>
              <Link to="/legal/terms">Условия использования</Link>
            </li>
            <li>
              <Link to="/legal/privacy">Политика конфиденциальности</Link>
            </li>
            <li>
              <Link to="/legal/imprint">Импринт</Link>
            </li>
          </ul>
        </section>

        <section className="info-section">
          <h2>Контакты</h2>
          <ul className="info-links">
            <li>
              <a href="mailto:support@abonasi.app">support@abonasi.app</a>
            </li>
            <li>
              <a href="mailto:support@abonasi.app?subject=Abonasi%20bug%20report">
                Сообщить о проблеме
              </a>
            </li>
          </ul>
        </section>

        {isAuthed ? (
          <section className="info-section info-account">
            <h2>Аккаунт</h2>

            <div className="info-actions">
              <Link className="btn secondary" to="/my-ads">
                Мои объявления
              </Link>
              <button className="btn danger" type="button" onClick={onLogout}>
                Выйти
              </button>
            </div>
          </section>
        ) : (
          <section className="info-section info-guest">
            <p className="info-muted">Вы просматриваете приложение как гость.</p>

            <div className="info-actions">
              <Link className="btn primary" to="/login">
                Войти
              </Link>
              <Link className="btn secondary" to="/register">
                Регистрация
              </Link>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
