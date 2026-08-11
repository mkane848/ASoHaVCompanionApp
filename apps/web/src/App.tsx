import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useMe } from './lib/useMe.js';
import LoginPage from './pages/LoginPage.js';
import HomePage from './pages/HomePage.js';
import CharacterSheetPage from './pages/CharacterSheetPage.js';
import CampaignPage from './pages/CampaignPage.js';
import CreateCharacterPage from './pages/CreateCharacterPage.js';
import AppShell from './components/AppShell.js';
import styles from './App.module.css';

// Split out of the main bundle: Combat is only relevant mid-session, and Content Admin's
// schema-driven CRUD (library editing, changelog, user/campaign management) is designer/admin-only
// — neither belongs in the chunk every player downloads just to open their character sheet.
const CombatPage = lazy(() => import('./pages/CombatPage.js'));
const AdminPanelPage = lazy(() => import('./pages/AdminPanelPage.js'));

export default function App() {
  const { data, isLoading, isError } = useMe();
  const authed = !!data && !isError;

  if (isLoading) {
    return (
      <div className={styles.loading}>
        Loading…
      </div>
    );
  }

  if (!authed) {
    return (
      <Routes>
        <Route path="*" element={<LoginPage />} />
      </Routes>
    );
  }

  return (
    <AppShell me={data}>
      <Suspense fallback={<div className={styles.routeLoading}>Loading…</div>}>
        <Routes>
          <Route path="/" element={<HomePage me={data} />} />
          <Route path="/c/:campaignId" element={<CampaignPage me={data} />} />
          <Route path="/c/:campaignId/create-character" element={<CreateCharacterPage me={data} />} />
          <Route path="/c/:campaignId/sheet" element={<CharacterSheetPage me={data} />} />
          <Route path="/c/:campaignId/combat" element={<CombatPage me={data} />} />
          <Route path="/admin" element={<AdminPanelPage me={data} />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </AppShell>
  );
}
