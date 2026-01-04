import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { listLocations, type Location } from '../api/locations.api';
import { ApiError } from '../api/http';
import { ErrorBox } from '../ui/ErrorBox';
import { Loading } from '../ui/Loading';
import { useLocationStore } from '../store/location.store';

export function LocationSelectPage() {
  const nav = useNavigate();
  const { locationId, setLocation } = useLocationStore();

  const [locations, setLocations] = useState<Location[]>([]);
  const [selected, setSelected] = useState<string>(locationId ?? '');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const selectedLabel = useMemo(() => {
    const l = locations.find((x) => x.id === selected);
    return l ? `${l.country} / ${l.city} / ${l.district}` : '';
  }, [locations, selected]);

  useEffect(() => {
    let alive = true;
    (async () => {
      setError(null);
      setLoading(true);
      try {
        const data = await listLocations();
        if (!alive) return;
        setLocations(data);
      } catch (err) {
        const msg = err instanceof ApiError ? `${err.errorCode}: ${err.message}` : 'Unknown error';
        if (alive) setError(msg);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  function onConfirm() {
    if (!selected) return;
    setLocation(selected);
    nav('/feed', { replace: true });
  }

  return (
    <div className="card">
      <h2>Select location</h2>
      <p className="muted small">Pick one location to view the feed.</p>

      {error && <ErrorBox message={error} />}
      {loading && <Loading />}

      {!loading && (
        <div className="row" style={{ alignItems: 'flex-end' }}>
          <label>
            <div className="small muted">Location</div>
            <select className="input" value={selected} onChange={(e) => setSelected(e.target.value)}>
              <option value="">— choose —</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.country} / {l.city} / {l.district}
                </option>
              ))}
            </select>
          </label>

          <button className="btn" disabled={!selected} onClick={onConfirm}>
            Confirm
          </button>

          {selected && <span className="small muted">Selected: {selectedLabel}</span>}
        </div>
      )}
    </div>
  );
}
