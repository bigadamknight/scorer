import { Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { UpdateBanner } from './components/UpdateBanner';
import { LoginPage } from './pages/Login';
import { HomePage } from './pages/Home';
import { SetupPage } from './pages/Setup';
import { ScorePage } from './pages/Score';
import { StatsPage } from './pages/Stats';
import { ReportPage } from './pages/Report';

export default function App() {
  const { authed, handleLogin, handleLogout } = useAuth();
  const navigate = useNavigate();

  if (authed === null) {
    return <div className="grid min-h-dvh place-items-center text-faint">Loading…</div>;
  }

  if (!authed) {
    return (
      <>
        <UpdateBanner />
        <LoginPage onLogin={handleLogin} />
      </>
    );
  }

  return (
    <>
      <UpdateBanner />
      <Routes>
        <Route
          path="/"
          element={
            <HomePage
              onLogout={async () => {
                await handleLogout();
                navigate('/');
              }}
            />
          }
        />
        <Route path="/setup" element={<SetupPage />} />
        <Route path="/match/:id/score" element={<ScorePage />} />
        <Route path="/match/:id/stats/:team" element={<StatsPage />} />
        <Route path="/match/:id/report" element={<ReportPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
