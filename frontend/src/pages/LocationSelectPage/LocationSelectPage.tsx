import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { LOCATIONS } from '../../store/location.constants';
import { useLocationStore } from '../../store/location.store';

import './LocationSelectPage.css';

export function LocationSelectPage() {
  const nav = useNavigate();

  const currentId = useLocationStore((s) => s.selectedId);
  const [selectedId, setSelectedId] = useState<string>(currentId ?? '');

  const canConfirm = Boolean(selectedId);

  const selectedLabel = useMemo(() => {
    if (!selectedId) return '';
    const found = LOCATIONS.find((x) => x.id === selectedId);
    return found ? found.label : '';
  }, [selectedId]);

  function onConfirm() {
    if (!selectedId) return;
    useLocationStore.getState().setLocation(selectedId);
    nav('/');
  }

  return (
    <main className="screen">
      <header className="header" aria-label="Шапка">
        <button className="back" type="button" onClick={() => nav('/')}>
          ←
        </button>
        <h1 className="title">Локация</h1>
        <div className="headerSpacer" />
      </header>

      <section className="panel" aria-label="Выбор локации">
        <p className="hint">
          Выберите город/район — от этого зависят лента и подписки.
        </p>

        <label className="field">
          <span className="fieldLabel">Локация</span>
          <select
            className="select"
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
          >
            <option value="">— выбрать —</option>
            {LOCATIONS.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.label}
              </option>
            ))}
          </select>
        </label>

        {selectedLabel && (
          <div className="preview" aria-label="Текущий выбор">
            Выбрано: <strong>{selectedLabel}</strong>
          </div>
        )}

        <div className="actions">
          <button
            className="primary"
            type="button"
            disabled={!canConfirm}
            onClick={onConfirm}
          >
            Подтвердить
          </button>
        </div>
      </section>
    </main>
  );
}
