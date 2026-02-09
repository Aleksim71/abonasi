import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../store/auth.store';

import './HomePage.css';

export function HomePage() {
  const nav = useNavigate();
  const { token } = useAuth();

  const isAuthed = Boolean(token);

  return (
    <div className="home">
      <h1 className="home__title">Объявления твоего района</h1>

      <div className="home__actions" aria-label="Действия">
        <button type="button" className="home__btn home__btn--primary" onClick={() => nav('/feed')}>
          Просмотреть объявления
        </button>

        {isAuthed ? (
          <button type="button" className="home__btn" onClick={() => nav('/my-ads')}>
            Мои объявления
          </button>
        ) : (
          <button type="button" className="home__btn" onClick={() => nav('/login')}>
            Создать объявление
          </button>
        )}
      </div>
    </div>
  );
}
