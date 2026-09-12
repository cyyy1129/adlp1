// ============================================================
// Login Page
// ============================================================

import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../hooks/useLanguage';
import Button from '../components/Button';
import Input from '../components/Input';
import Card from '../components/Card';
import { isValidEmail } from '../lib/utils';

export default function Login() {
  const { login, user, profile, supabaseConfigured } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [generalError, setGeneralError] = useState('');

  // Already logged in — redirect
  if (user && profile) {
    return <Navigate to={profile.onboarding_completed ? '/dashboard' : '/onboarding'} replace />;
  }

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!email.trim()) e.email = t.required;
    else if (!isValidEmail(email)) e.email = t.invalidEmail;
    if (!password) e.password = t.required;
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(ev: FormEvent) {
    ev.preventDefault();
    setGeneralError('');
    if (!validate()) return;

    setLoading(true);
    const { error } = await login({ email, password });
    setLoading(false);

    if (error) {
      setGeneralError(t.loginFailed);
      return;
    }

    // Auth state change will trigger redirect via ProtectedRoute
    navigate('/dashboard');
  }

  return (
    <div className="auth-page">
      <div className="auth-container">
        {/* Brand */}
        <div className="auth-brand">
          <div className="brand-icon">🍜</div>
          <h1 className="brand-name">{t.appName}</h1>
          <p className="brand-tagline">{t.tagline}</p>
        </div>

        <Card variant="glass" padding="lg">
          <h2 className="auth-title">{t.welcomeBack}</h2>

          {!supabaseConfigured && (
            <div className="alert alert-warning">
              <span className="alert-icon">⚠️</span>
              <div>
                <strong>{t.supabaseNotConfigured}</strong>
                <p>{t.supabaseNotConfiguredDesc}</p>
              </div>
            </div>
          )}

          {generalError && (
            <div className="alert alert-error">
              <span className="alert-icon">✕</span>
              <span>{generalError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate>
            <Input
              label={t.email}
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              error={errors.email}
              placeholder="you@example.com"
              autoComplete="email"
            />

            <Input
              label={t.password}
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              error={errors.password}
              placeholder="••••••••"
              autoComplete="current-password"
            />

            <div className="auth-forgot">
              <Link to="/forgot-password">{t.forgotPassword}</Link>
            </div>

            <Button
              type="submit"
              fullWidth
              loading={loading}
              disabled={!supabaseConfigured}
              size="lg"
            >
              {t.signIn}
            </Button>
          </form>

          <p className="auth-switch">
            {t.noAccount}{' '}
            <Link to="/register">{t.signUp}</Link>
          </p>
        </Card>
      </div>
    </div>
  );
}
