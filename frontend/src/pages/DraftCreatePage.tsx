import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as AdsApi from '../api/ads.api';
import { ApiError } from '../api/http';
import { ErrorBox } from '../ui/ErrorBox';
import { Loading } from '../ui/Loading';
import { useLocationStore } from '../store/location.store';

export function DraftCreatePage() {
  const nav = useNavigate();
  const { locationId } = useLocationStore();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!locationId) return;
    setError(null);
    setLoading(true);
    try {
      const draft = await AdsApi.createDraft({ locationId, title, description });
      nav(`/draft/${draft.id}/photos`, { replace: true });
    } catch (err) {
      const msg = err instanceof ApiError ? `${err.errorCode}: ${err.message}` : 'Unknown error';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card">
      <h2>Create draft</h2>

      {error && <ErrorBox message={error} />}

      <form onSubmit={onSubmit}>
        <div className="row" style={{ alignItems: 'flex-end' }}>
          <label>
            <div className="small muted">Title</div>
            <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>
          <button className="btn" disabled={loading || !title}>
            Create
          </button>
        </div>

        <label style={{ display: 'block', marginTop: 12 }}>
          <div className="small muted">Description (optional)</div>
          <textarea
            className="input"
            style={{ width: '100%', minHeight: 120 }}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
      </form>

      {loading && <Loading />}
    </div>
  );
}
