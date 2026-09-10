import { lazy, Suspense, useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router';
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
const WorldPage = lazy(() => import('./pages/WorldPage.js'));
const AdminPanelPage = lazy(() => import('./pages/AdminPanelPage.js'));
const CreateCharacterPage = lazy(() => import('./pages/CreateCharacterPage.js'));

// A first-time player following an emailed invite link may have to confirm their email address
// (a fresh Supabase Auth account, per the register() flow) in between landing here and actually
// being signed in — and Supabase's own confirmation-email redirect goes to whatever Site URL is
// configured for the project, which doesn't necessarily carry the `?invite=` query string they
// first arrived with. Stash it in sessionStorage the moment it's seen (0.37.0, Issue 17) so the
// code survives that round trip rather than being lost at exactly the moment a first-time player
// needs it to redeem the invite; restored once signed in if the URL has since lost it.
const PENDING_INVITE_KEY = 'asohav:pendingInviteCode';

export default function App() {
  const { data, isLoading, isError } = useMe();
  const authed = !!data && !isError;
  const location = useLocation();

  useEffect(() => {
    const invite = new URLSearchParams(location.search).get('invite');
    if (invite) {
      try { sessionStorage.setItem(PENDING_INVITE_KEY, invite); } catch { /* ignore */ }
    }
  }, [location.search]);

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

  let restoredInvite: string | null = null;
  if (location.pathname === '/' && !new URLSearchParams(location.search).get('invite')) {
    try {
      restoredInvite = sessionStorage.getItem(PENDING_INVITE_KEY);
      if (restoredInvite) sessionStorage.removeItem(PENDING_INVITE_KEY);
    } catch { /* ignore */ }
  }

  return (
    <AppShell me={data}>
      <Suspense fallback={<div className={styles.routeLoading}>Loading…</div>}>
        <Routes>
          {restoredInvite && <Route path="/" element={<Navigate to={`/?invite=${encodeURIComponent(restoredInvite)}`} replace />} />}
          <Route path="/" element={<HomePage me={data} />} />
          <Route path="/c/:campaignId" element={<CampaignPage me={data} />} />
          <Route path="/c/:campaignId/create-character" element={<CreateCharacterPage me={data} />} />
          <Route path="/c/:campaignId/sheet" element={<CharacterSheetPage me={data} />} />
          <Route path="/c/:campaignId/combat" element={<CombatPage me={data} />} />
          <Route path="/c/:campaignId/adventure" element={<AdventuresPage />} />
          <Route path="/c/:campaignId/world" element={<WorldPage />} />
          <Route path="/admin" element={<AdminPanelPage me={data} />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </AppShell>
  );
}
