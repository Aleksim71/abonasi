// src/pages/SectionsPage/SectionsPage.tsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useLocationStore } from '../../store/location.store';
import { SECTIONS } from '../../store/sections.constants';
import { useSectionsStore } from '../../store/sections.store';
import './SectionsPage.css';

export function SectionsPage() {
  const nav = useNavigate();

  const hasLocation = useLocationStore((state) => state.hasLocation());
  const locationLabel = useLocationStore((state) => state.asLabel());

  const selectedKeys = useSectionsStore((state) => state.selectedKeys);
  const toggle = useSectionsStore((state) => state.toggle);
  const selectedLabel = useSectionsStore((state) => state.asLabel());

  return (
    <main className="screen">
      <header className="header" aria-label="Шапка">
        <button
          className="iconBtn"
          type="button"
          aria-label="Назад"
          onClick={() => nav(-1)}
        >
          <span className="backArrow" aria-hidden="true" />
        </button>

        <h1 className="title">Разделы</h1>

        <span aria-hidden="true" />
      </header>

      {!hasLocation ? (
        <section className="blocker" aria-label="Локация не выбрана">
          <h2 className="blockerTitle">Сначала выберите локацию</h2>
          <p className="blockerText">
            Разделы зависят от вашей локации. Выберите город, чтобы продолжить.
          </p>

          <button
            className="primaryBtn"
            type="button"
            onClick={() => nav('/locations')}
          >
            Выбрать локацию
          </button>
        </section>
      ) : (
        <>
          <p className="hint">
            Выберите интересующие вас разделы. Можно выбрать несколько.
          </p>

          <p className="meta">
            Локация: <strong>{locationLabel || '—'}</strong>
          </p>

          <section aria-label="Список разделов">
            <div className="list">
              {SECTIONS.map((item) => {
                const isSelected = selectedKeys.includes(item.key);
                return (
                  <button
                    key={item.key}
                    type="button"
                    className={`row ${isSelected ? 'rowSelected' : ''}`}
                    onClick={() => toggle(item.key)}
                    aria-label={`${item.title}${isSelected ? ', выбран' : ''}`}
                  >
                    <span className="rowTitle">{item.title}</span>
                    <span
                      className={`check ${isSelected ? 'checkVisible' : ''}`}
                      aria-hidden="true"
                    />
                  </button>
                );
              })}
            </div>
          </section>

          <p className="footerNote">
            Выбрано: <strong>{selectedLabel}</strong>
          </p>
        </>
      )}
    </main>
  );
}
