import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router';
import { useMe } from './lib/useMe.js';
import LoginPage from './pages/LoginPage.js';
import HomePage from './pages/HomePage.js';
import CharacterSheetPage from './pages/CharacterSheetPage.js';
import CampaignPage from './pages/CampaignPage.js';
import AppShell from './components/AppShell.js';
import styles from './App.module.css';

// Split out of the main bundle: Combat is only relevant mid-session, Content Admin's
// schema-driven CRUD (library editing, changelog, user/campaign management) is designer/admin-only,
// and character creation is a one-time-per-character screen — none belongs in the chunk every
// player downloads just to open their character sheet. CreateCharacterPage also pulls in
// react-hook-form/@hookform/resolvers, which otherwise ship to every player unconditionally
// (README judgment call 22; TechStackAudit.md D3/C3).
const CombatPage = lazy(() => import('./pages/CombatPage.js'));
const AdventuresPage = lazy(() => import('./pages/AdventuresPage.js'));
const AdminPanelPage = lazy(() => import('./pages/AdminPanelPage.js'));
const CreateCharacterPage = lazy(() => import('./pages/CreateCharacterPage.js'));

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
          <Route path="/c/:campaignId/adventure" element={<AdventuresPage />} />
          <Route path="/admin" element={<AdminPanelPage me={data} />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </AppShell>
  );
}
