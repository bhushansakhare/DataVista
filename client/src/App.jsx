import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import LandingPage from './pages/LandingPage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import RegisterPage from './pages/RegisterPage.jsx';
import OnboardingPage from './pages/OnboardingPage.jsx';
import DashboardListPage from './pages/DashboardListPage.jsx';
import SheetImportPage from './pages/SheetImportPage.jsx';
import DashboardBuilderPage from './pages/DashboardBuilderPage.jsx';
import DashboardWizardPage from './pages/DashboardWizardPage.jsx';
import DashboardViewPage from './pages/DashboardViewPage.jsx';
import SharedDashboardPage from './pages/SharedDashboardPage.jsx';
import SuperAdminPage from './pages/SuperAdminPage.jsx';
import SheetsPage from './pages/SheetsPage.jsx';
import AppLayout from './components/layout/AppLayout.jsx';

function Protected({ children, role }) {
  const { user, loading } = useAuth();
  if (loading) return <FullPageLoader />;
  if (!user) return <Navigate to="/login" replace />;
  if (role && user.role !== role) return <Navigate to="/app" replace />;
  return children;
}

function FullPageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="h-10 w-10 rounded-full border-2 border-brand-500/20 border-t-brand-500 animate-spin" />
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/s/:token" element={<SharedDashboardPage />} />
      <Route path="/onboarding" element={<Protected><OnboardingPage /></Protected>} />
      <Route element={<Protected><AppLayout /></Protected>}>
        <Route path="/app" element={<DashboardListPage />} />
        <Route path="/app/sheets" element={<SheetsPage />} />
        <Route path="/app/sheets/import" element={<SheetImportPage />} />
        <Route path="/app/dashboards/new/:sheetId" element={<DashboardWizardPage />} />
        <Route path="/app/dashboards/:id" element={<DashboardViewPage />} />
        <Route path="/app/dashboards/:id/edit" element={<DashboardBuilderPage />} />
        <Route path="/app/admin" element={<Protected role="superadmin"><SuperAdminPage /></Protected>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
