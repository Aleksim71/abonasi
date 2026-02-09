import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import * as AuthApi from '../api/auth.api';
import { ApiError } from '../api/http';
import { ErrorBox } from '../ui/ErrorBox';
import { Loading } from '../ui/Loading';
import { useAuth } from '../store/auth.store';
import { useLocationStore } from '../store/location.store';

export function LoginPage() {
  const nav = useNavigate();
  const { setAuth } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { token, user } = await AuthApi.login({ email, password });

      // Store token early so subsequent requests can use it
      localStorage.setItem('token', token);

      // Correct order: (user, token)
      setAuth(user, token);

      const hasLoc = useLocationStore.getState().hasLocation();
      nav(hasLoc ? '/feed' : '/locations', { replace: true });
    } catch (err) {
      const msg = err instanceof ApiError ? `${err.errorCode}: ${err.message}` : 'Unknown error';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card">
      <h2>Login</h2>
      <p className="muted small">
        No account? <Link to="/register">Register</Link>
      </p>

      {error && <ErrorBox message={error} />}

      <form onSubmit={onSubmit} className="form">
        <label className="label">
          Email
          <input
            className="input"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>

        <label className="label">
          Password
          <input
            className="input"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>

        <button className="btn" type="submit" disabled={loading}>
          {loading ? <Loading /> : 'Login'}
        </button>
      </form>
    </div>
  );
}
