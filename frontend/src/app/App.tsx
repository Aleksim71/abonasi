import { Layout } from '../ui/Layout';
import { AuthProvider } from '../store/auth.store';
import { LocationProvider } from '../store/location.store';

export function AppRoot() {
  return (
    <AuthProvider>
      <LocationProvider>
        <Layout />
      </LocationProvider>
    </AuthProvider>
  );
}
