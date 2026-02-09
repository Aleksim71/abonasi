import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../store/auth.store';

import './Layout.css';

type MenuItem = {
  label: string;
  to: string;
  requireAuth?: boolean;
};

export function Layout({ children }: { children: React.ReactNode }) {
  const nav = useNavigate();
  const loc = useLocation();
  const { token, clearAuth } = useAuth();

  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const isAuthed = Boolean(token);

  const items: MenuItem[] = useMemo(
    () => [
      { label: 'Настройки', to: '/menu' },
      { label: 'Правила', to: '/rules' },
      { label: 'О проекте', to: '/about' },
      { label: 'Для партнёров', to: '/partners' }
    ],
    []
  );

  useEffect(() => {
    // close menu on route change
    setOpen(false);
  }, [loc.pathname]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    function onDocClick(e: MouseEvent) {
      if (!open) return;
      const t = e.target as Node | null;
      if (!t) return;
      if (menuRef.current?.contains(t)) return;
      if (btnRef.current?.contains(t)) return;
      setOpen(false);
    }
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('mousedown', onDocClick);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('mousedown', onDocClick);
    };
  }, [open]);

  function onLogout() {
    // MVP: client-side logout
    localStorage.removeItem('token');
    clearAuth();
    nav('/login', { replace: true });
  }

  return (
    <div className="l-page">
      <header className="l-header" aria-label="Верхняя панель">
        <Link className="l-brand" to="/" aria-label="На главную">
          Abonasi
        </Link>

        <div className="l-header-right">
          <button
            ref={btnRef}
            type="button"
            className="l-menu-btn"
            aria-label="Меню"
            aria-haspopup="menu"
            aria-expanded={open ? 'true' : 'false'}
            onClick={() => setOpen((v) => !v)}
          >
            ☰
          </button>

          {open && (
            <div ref={menuRef} className="l-menu" role="menu" aria-label="Меню">
              {items
                .filter((it) => (it.requireAuth ? isAuthed : true))
                .map((it) => (
                  <Link key={it.to} className="l-menu-item" to={it.to} role="menuitem">
                    {it.label}
                  </Link>
                ))}

              {isAuthed && (
                <button type="button" className="l-menu-item l-menu-item-danger" onClick={onLogout}>
                  Выйти
                </button>
              )}
            </div>
          )}
        </div>
      </header>

      <main className="l-main">{children}</main>
    </div>
  );
}
