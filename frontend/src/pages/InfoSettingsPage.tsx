// frontend/src/pages/InfoSettingsPage.tsx
// Экран "Инфо" — MVP (публичный, guest vs auth)

import { Link, useNavigate } from 'react-router-dom';
import './InfoSettingsPage.css';

// MVP-контракт: заменить на реальный auth-store при следующем шаге
type Viewer = {
  isAuth: boolean;
  email?: string;
  location?: string;
};

// TEMP: заменить на реальный источник
const viewer: Viewer = {
  isAuth: false,
  // email: 'user@mail.de',
  // location: 'Мюнхен',
};

export function InfoSettingsPage() {
  const navigate = useNavigate();

  function handleLogout() {
    navigate('/login');
  }

  return (
    <div className="info-page">
      <header className="info-header">
        <button
          className="info-back"
          type="button"
          onClick={() => navigate(-1)}
        >
          ← Назад
        </button>
        <h1 className="info-title">Инфо</h1>
      </header>

      <main className="info-content">
        {/* О ПРОЕКТЕ */}
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
              <span>{viewer.location ?? 'Не выбрана'}</span>
            </li>
          </ul>
        </section>

        {/* КАК ЭТО РАБОТАЕТ */}
        <section className="info-section">
          <h2>Как это работает</h2>
          <ul className="info-list">
            <li>Выберите город</li>
            <li>Создайте и опубликуйте объявление</li>
            <li>Люди поблизости смогут его увидеть</li>
          </ul>
        </section>

        {/* ЮРИДИЧЕСКАЯ ИНФОРМАЦИЯ */}
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

        {/* КОНТАКТЫ */}
        <section className="info-section">
          <h2>Контакты</h2>
          <ul className="info-links">
            <li>
              <a href="mailto:support@abonasi.app">
                support@abonasi.app
              </a>
            </li>
            <li>
              <a href="mailto:support@abonasi.app?subject=Abonasi%20bug%20report">
                Сообщить о проблеме
              </a>
            </li>
          </ul>
        </section>

        {/* ACCOUNT / ГОСТЬ */}
        {viewer.isAuth ? (
          <section className="info-section info-account">
            <h2>Аккаунт</h2>

            <ul className="info-meta">
              <li>
                <span>Email</span>
                <span>{viewer.email}</span>
              </li>
              <li>
                <span>Локация</span>
                <span>{viewer.location ?? 'Не выбрана'}</span>
              </li>
            </ul>

            <div className="info-actions">
              <Link className="btn secondary" to="/my-ads">
                Мои объявления
              </Link>
              <button
                className="btn danger"
                type="button"
                onClick={handleLogout}
              >
                Выйти
              </button>
            </div>
          </section>
        ) : (
          <section className="info-section info-guest">
            <p className="info-muted">
              Вы просматриваете приложение как гость.
            </p>

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
