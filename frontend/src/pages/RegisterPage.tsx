import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import * as AuthApi from '../api/auth.api';
import { ApiError } from '../api/http';
import { ErrorBox } from '../ui/ErrorBox';
import { Loading } from '../ui/Loading';
import { useAuth } from '../store/auth.store';
import { getLocationId } from '../utils/storage';

export function RegisterPage() {
  const nav = useNavigate();
  const { setAuth } = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { token } = await AuthApi.register({ name, email, password });
      localStorage.setItem('token', token);
      const me = await AuthApi.me();
      setAuth(token, me);

      const loc = getLocationId();
      nav(loc ? '/feed' : '/locations', { replace: true });
    } catch (err) {
      const msg = err instanceof ApiError ? `${err.errorCode}: ${err.message}` : 'Unknown error';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card">
      <h2>Register</h2>
      <p className="muted small">
        Have an account? <Link to="/login">Login</Link>
      </p>

      {error && <ErrorBox message={error} />}

      <form onSubmit={onSubmit} className="row" style={{ alignItems: 'flex-end' }}>
        <label>
          <div className="small muted">Name</div>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label>
          <div className="small muted">Email</div>
          <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label>
          <div className="small muted">Password</div>
          <input
            className="input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <button className="btn" disabled={loading || !name || !email || !password}>
          Create account
        </button>
      </form>

      {loading && <Loading />}
    </div>
  );
}
