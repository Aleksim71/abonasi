// frontend/src/pages/PartnersPage/PartnersPage.tsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import './PartnersPage.css';

export function PartnersPage() {
  const nav = useNavigate();

  return (
    <main className="screen">
      <header className="header" aria-label="Шапка">
        <h1 className="title">Для партнёров</h1>
        <button className="link" type="button" onClick={() => nav(-1)}>
          Назад
        </button>
      </header>

      <section className="panel" aria-label="Партнёрская программа">
        <p className="muted">
          Здесь будет партнёрская программа (QR-коды / реферальные ссылки). Пока — заглушка, чтобы
          пункт меню не вёл в 404.
        </p>
      </section>
    </main>
  );
}
