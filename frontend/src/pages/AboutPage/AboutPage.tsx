// frontend/src/pages/AboutPage/AboutPage.tsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import './AboutPage.css';

export function AboutPage() {
  const nav = useNavigate();

  return (
    <main className="screen">
      <header className="pageHeader" aria-label="Шапка">
        <button
          className="iconBtn"
          type="button"
          onClick={() => nav(-1)}
          aria-label="Назад"
          title="Назад"
        >
          ←
        </button>

        <h1 className="pageTitle">О проекте</h1>

        <div className="headerSpacer" aria-hidden="true" />
      </header>

      <section className="content">
        <div className="card">
          <h2 className="h2">Abonasi</h2>
          <p className="p">
            Локальная доска объявлений для вашего города и района. Идея простая:
            меньше шума, больше полезного — объявления рядом с вами.
          </p>
        </div>

        <div className="card">
          <h2 className="h2">Как это работает</h2>
          <ul className="list">
            <li>Вы выбираете локацию (город/район).</li>
            <li>Выбираете интересующие разделы.</li>
            <li>Настраиваете подписки и получаете уведомления.</li>
          </ul>
        </div>

        <div className="card">
          <h2 className="h2">MVP-версия</h2>
          <p className="p">
            Сейчас это ранняя версия: мы собираем основу экранов, сохраняем
            выборы в браузере и проверяем UX.
          </p>
        </div>
      </section>
    </main>
  );
}
