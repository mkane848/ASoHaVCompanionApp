import { Navigate, Route, Routes } from 'react-router-dom';
import { useMe } from './lib/useMe.js';
import LoginPage from './pages/LoginPage.js';
import HomePage from './pages/HomePage.js';
import CharacterSheetPage from './pages/CharacterSheetPage.js';
import CampaignPage from './pages/CampaignPage.js';
import CreateCharacterPage from './pages/CreateCharacterPage.js';
import AdminPanelPage from './pages/AdminPanelPage.js';
import AppShell from './components/AppShell.js';
import styles from './App.module.css';

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
      <Routes>
        <Route path="/" element={<HomePage me={data} />} />
        <Route path="/c/:campaignId" element={<CampaignPage me={data} />} />
        <Route path="/c/:campaignId/create-character" element={<CreateCharacterPage me={data} />} />
        <Route path="/c/:campaignId/sheet" element={<CharacterSheetPage me={data} />} />
        <Route path="/admin" element={<AdminPanelPage me={data} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  );
}
