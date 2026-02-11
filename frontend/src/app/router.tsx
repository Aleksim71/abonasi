import { createBrowserRouter } from 'react-router-dom';
import { AppRoot } from './App';
import { RequireAuth, RequireLocation } from './guards';

import { HomePage } from '../pages/HomePage';
import { LoginPage } from '../pages/LoginPage';
import { RegisterPage } from '../pages/RegisterPage';
import { LocationSelectPage } from '../pages/LocationSelectPage';
import { FeedPage } from '../pages/FeedPage';
import { AdDetailsPage } from '../pages/AdDetailsPage';
import { MyAdsPage } from '../pages/MyAdsPage';
import { DraftCreatePage } from '../pages/DraftCreatePage';
import { DraftPhotosPage } from '../pages/DraftPhotosPage';
import { InfoSettingsPage } from '../pages/InfoSettingsPage';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppRoot />,
    children: [
      { index: true, element: <HomePage /> },

      // public pages
      { path: 'info', element: <InfoSettingsPage /> },
      { path: 'login', element: <LoginPage /> },
      { path: 'register', element: <RegisterPage /> },

      // private zone
      {
        element: <RequireAuth />,
        children: [
          { path: 'locations', element: <LocationSelectPage /> },

          {
            element: <RequireLocation />,
            children: [
              { path: 'feed', element: <FeedPage /> },
              { path: 'ads/:id', element: <AdDetailsPage /> },
              { path: 'my-ads', element: <MyAdsPage /> },
              { path: 'draft/new', element: <DraftCreatePage /> },
              { path: 'draft/:id/photos', element: <DraftPhotosPage /> }
            ]
          }
        ]
      }
    ]
  }
]);
