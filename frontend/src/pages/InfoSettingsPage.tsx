// frontend/src/pages/InfoSettingsPage.tsx
// Экран "Инфо" — MVP (публичный, guest vs auth)

import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../store/auth.store';
import './InfoSettingsPage.css';

function tryParseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function readLocationLabelFromLocalStorage(): string | null {
  // ✅ Добавь сюда свой ключ, если у тебя он другой.
  const keysToTry = [
    'location', // часто кладут объект/строку сюда
    'selectedLocation',
    'selected_location',
    'locationLabel',
    'location_label',
    'abonasi.location',
    'abonasi_location',
    'abonasi.location.selected',
  ];

  for (const key of keysToTry) {
    const raw = localStorage.getItem(key);
    if (!raw) continue;

    // 1) Если это уже “нормальная” строка (не JSON), вернём как label
    const trimmed = raw.trim();
    const looksLikeJson =
      trimmed.startsWith('{') || trimmed.startsWith('[') || trimmed.startsWith('"');

    if (!looksLikeJson) {
      // Пример: "Munich" или "Germany/Munich"
      return trimmed;
    }

    // 2) Если JSON — пытаемся распарсить и достать человекочитаемое поле
    const parsed = tryParseJson(trimmed);

    // Строка в JSON: "Munich"
    if (typeof parsed === 'string' && parsed.trim()) return parsed.trim();

    // Объект: { label/name/city/title/path: ... }
    if (parsed && typeof parsed === 'object') {
      const obj = parsed as Record<string, unknown>;
      const candidates = ['label', 'name', 'city', 'title', 'path'];

      for (const c of candidates) {
        const v = obj[c];
        if (typeof v === 'string' && v.trim()) return v.trim();
      }

      // Иногда кладут: { location: { label: ... } }
      const nested = obj.location;
      if (nested && typeof nested === 'object') {
        const n = nested as Record<string, unknown>;
        for (const c of candidates) {
          const v = n[c];
          if (typeof v === 'string' && v.trim()) return v.trim();
        }
      }
    }
  }

  return null;
}

export function InfoSettingsPage() {
  const nav = useNavigate();
  const { token, clearAuth } = useAuth();

  const isAuthed = Boolean(token);

  // MVP: читаем локацию один раз на рендер.
  // Если у тебя смена локации происходит без перезагрузки страницы,
  // позже сделаем подписку на стор/событие — но для MVP достаточно.
  const locationLabel = readLocationLabelFromLocalStorage();

  function onLogout() {
    // MVP: client-side logout (как в Layout)
    localStorage.removeItem('token');
    clearAuth();
    nav('/login', { replace: true });
  }

  return (
    <div className="info-page">
      <header className="info-header">
        <button className="info-back" type="button" onClick={() => nav(-1)}>
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
              <span>{locationLabel ?? 'Не выбрана'}</span>
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
              <a href="mailto:support@abonasi.app">support@abonasi.app</a>
            </li>
            <li>
              <a href="mailto:support@abonasi.app?subject=Abonasi%20bug%20report">
                Сообщить о проблеме
              </a>
            </li>
          </ul>
        </section>

        {/* ACCOUNT / ГОСТЬ */}
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
