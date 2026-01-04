import React, { createContext, useContext, useMemo, useState } from 'react';
import { clearLocationId, getLocationId, setLocationId } from '../utils/storage';

type LocationState = {
  locationId: string | null;
  setLocation: (id: string) => void;
  clearLocation: () => void;
};

const LocationCtx = createContext<LocationState | null>(null);

export function LocationProvider({ children }: { children: React.ReactNode }) {
  const [locationIdState, setLocationIdState] = useState<string | null>(() => getLocationId());

  const value = useMemo<LocationState>(() => ({
    locationId: locationIdState,
    setLocation: (id) => {
      setLocationId(id);
      setLocationIdState(id);
    },
    clearLocation: () => {
      clearLocationId();
      setLocationIdState(null);
    }
  }), [locationIdState]);

  return <LocationCtx.Provider value={value}>{children}</LocationCtx.Provider>;
}

export function useLocationStore() {
  const ctx = useContext(LocationCtx);
  if (!ctx) throw new Error('useLocationStore must be used within LocationProvider');
  return ctx;
}
