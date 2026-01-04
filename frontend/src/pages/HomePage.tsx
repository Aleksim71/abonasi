import { Navigate } from 'react-router-dom';
import { useAuth } from '../store/auth.store';
import { useLocationStore } from '../store/location.store';

export function HomePage() {
  const { token } = useAuth();
  const { locationId } = useLocationStore();

  if (!token) return <Navigate to="/login" replace />;
  if (!locationId) return <Navigate to="/locations" replace />;
  return <Navigate to="/feed" replace />;
}
