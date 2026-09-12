import { BrowserRouter, Navigate, Route, Routes, useParams } from 'react-router-dom';
import { AuthProvider } from './hooks/useAuth';
import { LanguageProvider } from './hooks/useLanguage';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import Subscription from './pages/Subscription';
import Onboarding from './pages/Onboarding';
import Dashboard from './pages/Dashboard';
import ForecastRecommendation from './pages/ForecastRecommendation';
import Profile from './pages/Profile';
import Planning from './pages/Planning';
import Question from './pages/Question';
import RecommendationPreview from './pages/RecommendationPreview';

function LegacyCheckinRedirect() {
  const { planId } = useParams<{ planId: string }>();
  return <Navigate to={planId ? `/profile?checkinPlan=${encodeURIComponent(planId)}` : '/profile'} replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <LanguageProvider>
          <Routes>
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/subscription" element={<Subscription />} />

            {/* 🟢 开放所有主要页面，取消强行重定向 */}
            <Route path="/onboarding" element={<Onboarding />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/question" element={<Question />} />
            <Route path="/recommendation" element={<RecommendationPreview />} />
            <Route path="/planning" element={<Planning />} />
            <Route path="/plans/:planId/recommendation" element={<ForecastRecommendation />} />
            <Route path="/plans/:planId/check-in" element={<LegacyCheckinRedirect />} />
            <Route path="/profile" element={<Profile />} />

            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </LanguageProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
