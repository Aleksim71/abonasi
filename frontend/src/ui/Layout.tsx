import { Link, NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../store/auth.store';
import { useLocationStore } from '../store/location.store';

export function Layout() {
  const { token, user, logout } = useAuth();
  const { locationId, clearLocation } = useLocationStore();

  return (
    <div>
      <header className="card" style={{ borderRadius: 0, borderLeft: 0, borderRight: 0 }}>
        <div className="container">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <Link to="/" style={{ textDecoration: 'none' }}>
              <strong>Abonasi</strong>
            </Link>

            <div className="row">
              {token ? (
                <>
                  <NavLink to="/feed">Feed</NavLink>
                  <NavLink to="/my-ads">My Ads</NavLink>
                  <NavLink to="/locations">Location</NavLink>
                  <button
                    className="btn"
                    onClick={() => {
                      clearLocation();
                    }}
                    title="Clear location selection"
                  >
                    Clear location
                  </button>
                  <button className="btn" onClick={logout}>
                    Logout
                  </button>
                </>
              ) : (
                <>
                  <NavLink to="/login">Login</NavLink>
                  <NavLink to="/register">Register</NavLink>
                </>
              )}
            </div>
          </div>

          <div className="small muted" style={{ marginTop: 8 }}>
            {token ? (
              <span>
                user: {user?.email ?? '…'} | locationId: {locationId ?? '—'}
              </span>
            ) : (
              <span>not authenticated</span>
            )}
          </div>
        </div>
      </header>

      <main className="container">
        <Outlet />
      </main>
    </div>
  );
}
