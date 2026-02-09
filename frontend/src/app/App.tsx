// frontend/src/app/App.tsx
'use strict';

import React from 'react';
import { Outlet } from 'react-router-dom';
import { Layout } from '../ui/Layout';

export function AppRoot() {
  return (
    <Layout>
      <Outlet />
    </Layout>
  );
}
