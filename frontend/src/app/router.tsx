import { createBrowserRouter } from 'react-router-dom';
import { AppRoot } from './App';
import { RequireAuth, RequireLocation } from './guards';

// Core pages
import { HomePage } from '../pages/HomePage';
import { LoginPage } from '../pages/LoginPage';
import { RegisterPage } from '../pages/RegisterPage';
import { LocationSelectPage } from '../pages/LocationSelectPage';
import { FeedPage } from '../pages/FeedPage';
import { AdDetailsPage } from '../pages/AdDetailsPage';
import { MyAdsPage } from '../pages/MyAdsPage';
import { DraftCreatePage } from '../pages/DraftCreatePage';
import { DraftPhotosPage } from '../pages/DraftPhotosPage';

// Configuration pages (direct imports)
import { MenuPage } from '../pages/MenuPage/MenuPage';
import { SectionsPage } from '../pages/SectionsPage/SectionsPage';
import { SubscriptionsPage } from '../pages/SubscriptionsPage/SubscriptionsPage';
import { SettingsPage } from '../pages/SettingsPage/SettingsPage';

// Info / Settings (MVP)
import { InfoSettingsPage } from '../pages/InfoSettingsPage';

// Static pages
import { AboutPage } from '../pages/AboutPage/AboutPage';
import { RulesPage } from '../pages/RulesPage/RulesPage';
import { PartnersPage } from '../pages/PartnersPage/PartnersPage';

// DEV / DEBUG
import DraftPhotosPlayground from '../pages/dev/DraftPhotosPlayground';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppRoot />,
    children: [
      // ---- экран 1 (публично) ----
      { index: true, element: <HomePage /> },

      // ---- конфиг-хаб (публично) ----
      { path: 'menu', element: <MenuPage /> },

      // ---- Info / Settings (публично, guest vs auth внутри) ----
      { path: 'info', element: <InfoSettingsPage /> },

      // ---- конфиг-экраны (публично) ----
      { path: 'locations', element: <LocationSelectPage /> },
      { path: 'sections', element: <SectionsPage /> },
      { path: 'subscriptions', element: <SubscriptionsPage /> },
      { path: 'settings', element: <SettingsPage /> },

      // ---- статические страницы (публично) ----
      { path: 'about', element: <AboutPage /> },
      { path: 'rules', element: <RulesPage /> },
      { path: 'partners', element: <PartnersPage /> },

      // ---- auth страницы (публично) ----
      { path: 'login', element: <LoginPage /> },
      { path: 'register', element: <RegisterPage /> },

      // ---- dev (публично) ----
      { path: '__dev/draft-photos', element: <DraftPhotosPlayground /> },

      // ---- публичная зона (нужна локация, логин не нужен) ----
      {
        element: <RequireLocation />,
        children: [
          { path: 'feed', element: <FeedPage /> },
          { path: 'ads/:id', element: <AdDetailsPage /> }
        ]
      },

      // ---- приватная зона (нужны логин + локация) ----
      {
        element: <RequireAuth />,
        children: [
          {
            element: <RequireLocation />,
            children: [
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
