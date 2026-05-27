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
import AiAssistantPage from './pages/AiAssistantPage.jsx';
// TemplatesPage import removed — Auto Dashboard Builder replaces it.
import SettingsPage from './pages/SettingsPage.jsx';
import IntegrationsPage from './pages/IntegrationsPage.jsx';
import OAuthSuccessPage from './pages/OAuthSuccessPage.jsx';
import ForgotPasswordPage from './pages/ForgotPasswordPage.jsx';
import ResetPasswordPage from './pages/ResetPasswordPage.jsx';
import PricingPage from './pages/PricingPage.jsx';
import SelectPlanPage from './pages/SelectPlanPage.jsx';
import CheckoutPage from './pages/CheckoutPage.jsx';
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
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/pricing" element={<PricingPage />} />
      <Route path="/s/:token" element={<SharedDashboardPage />} />
      <Route path="/oauth-success" element={<OAuthSuccessPage />} />
      <Route path="/select-plan" element={<Protected><SelectPlanPage /></Protected>} />
      <Route path="/checkout/:planId" element={<Protected><CheckoutPage /></Protected>} />
      <Route path="/onboarding" element={<Protected><OnboardingPage /></Protected>} />
      <Route element={<Protected><AppLayout /></Protected>}>
        <Route path="/app" element={<DashboardListPage />} />
        <Route path="/app/ai" element={<AiAssistantPage />} />
        {/* Templates UI removed. Legacy bookmark → AI Assistant. */}
        <Route path="/app/templates" element={<Navigate to="/app/ai" replace />} />
        {/* Auto Dashboard removed. Legacy bookmark → AI Assistant. */}
        <Route path="/app/auto-dashboard" element={<Navigate to="/app/ai" replace />} />
        <Route path="/app/integrations" element={<IntegrationsPage />} />
        <Route path="/app/settings" element={<SettingsPage />} />
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
