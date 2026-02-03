// frontend/src/pages/RulesPage/RulesPage.tsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import './RulesPage.css';

export function RulesPage() {
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

        <h1 className="pageTitle">Правила</h1>

        <div className="headerSpacer" aria-hidden="true" />
      </header>

      <section className="content">
        <div className="card">
          <h2 className="h2">Общие принципы</h2>
          <ul className="list">
            <li>Пишите честно и по делу: что продаёте/ищете, цена, условия.</li>
            <li>Уважайте соседей: без спама и дублирования.</li>
            <li>Не публикуйте личные данные в открытом виде.</li>
          </ul>
        </div>

        <div className="card">
          <h2 className="h2">Запрещено</h2>
          <ul className="list">
            <li>Мошенничество, ввод в заблуждение, фейковые предложения.</li>
            <li>Разжигание ненависти, угрозы, травля.</li>
            <li>Незаконные товары/услуги.</li>
          </ul>
        </div>

        <div className="card">
          <h2 className="h2">Модерация</h2>
          <p className="p">
            На MVP-этапе правила могут быть упрощены. В будущем добавим систему
            жалоб, блокировок и историю действий.
          </p>
        </div>
      </section>
    </main>
  );
}
