import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import * as LocationsApi from '../../api/locations.api';
import { ApiError } from '../../api/http';
import { useLocationStore } from '../../store/location.store';
import { ErrorBox } from '../../ui/ErrorBox';
import { Loading } from '../../ui/Loading';

import './LocationSelectPage.css';

type Option = { id: string; label: string };

export function LocationSelectPage() {
  const nav = useNavigate();

  const currentId = useLocationStore((s) => s.selectedId);
  const currentLabel = useLocationStore((s) => s.selectedLabel);

  const [options, setOptions] = useState<Option[]>([]);
  const [selectedId, setSelectedId] = useState<string>(currentId ?? '');
  const [selectedLabel, setSelectedLabel] = useState<string>(currentLabel ?? '');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canConfirm = Boolean(selectedId);

  useEffect(() => {
    let alive = true;

    (async () => {
      setError(null);
      setLoading(true);
      try {
        // MVP: фиксируем Munich/Germany (позже сделаем выбор страны/города)
        const list = await LocationsApi.listLocations({ country: 'Germany', city: 'Munich' });

        if (!alive) return;

        const opts = list
          .map((x) => ({
            id: x.id, // UUID
            label: `${x.city} · ${x.district}`
          }))
          .sort((a, b) => a.label.localeCompare(b.label));

        setOptions(opts);

        const found = opts.find((o) => o.id === selectedId);
        if (found) setSelectedLabel(found.label);
      } catch (e) {
        const msg = e instanceof ApiError ? `${e.errorCode}: ${e.message}` : 'Unknown error';
        if (alive) setError(msg);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const previewLabel = useMemo(() => {
    if (!selectedId) return '';
    const found = options.find((o) => o.id === selectedId);
    return found?.label || selectedLabel || '';
  }, [options, selectedId, selectedLabel]);

  function onConfirm() {
    if (!selectedId) return;
    const found = options.find((o) => o.id === selectedId);
    useLocationStore.getState().setLocation(selectedId, found?.label || previewLabel || selectedId);
    nav('/', { replace: true });
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
        <p className="hint">Выберите город/район — от этого зависят лента и подписки.</p>

        {error && <ErrorBox message={error} />}
        {loading && <Loading />}

        {!loading && (
          <label className="field">
            <span className="fieldLabel">Локация</span>
            <select
              className="select"
              value={selectedId}
              onChange={(e) => {
                const id = e.target.value;
                setSelectedId(id);
                const found = options.find((o) => o.id === id);
                setSelectedLabel(found?.label || '');
              }}
            >
              <option value="">— выбрать —</option>
              {options.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
        )}

        {previewLabel && (
          <div className="preview" aria-label="Текущий выбор">
            Выбрано: <strong>{previewLabel}</strong>
          </div>
        )}

        <div className="actions">
          <button className="primary" type="button" disabled={!canConfirm} onClick={onConfirm}>
            Подтвердить
          </button>
        </div>
      </section>
    </main>
  );
}
