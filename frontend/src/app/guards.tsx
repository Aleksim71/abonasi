import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../store/auth.store';
import { useLocationStore } from '../store/location.store';

export function RequireAuth() {
  const { token } = useAuth();
  if (!token) return <Navigate to="/login" replace />;
  return <Outlet />;
}

export function RequireLocation() {
  const { locationId } = useLocationStore();
  if (!locationId) return <Navigate to="/locations" replace />;
  return <Outlet />;
}
