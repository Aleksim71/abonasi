import { Link } from 'react-router-dom';
import './MenuPage.css';

export function MenuPage() {
  return (
    <div className="menu-page">
      <h1 className="menu-title">Menu</h1>

      <nav className="menu-list">
        {/* Основное */}
        <Link className="menu-item" to="/feed">
          Feed
        </Link>

        <Link className="menu-item" to="/locations">
          Location
        </Link>

        {/* 🆕 Info / Settings */}
        <Link className="menu-item" to="/info">
          Info / Settings
        </Link>

        {/* Конфигурация */}
        <Link className="menu-item" to="/settings">
          Settings
        </Link>

        <Link className="menu-item" to="/rules">
          Rules
        </Link>

        <Link className="menu-item" to="/about">
          About project
        </Link>

        <Link className="menu-item" to="/partners">
          For partners
        </Link>
      </nav>
    </div>
  );
}
