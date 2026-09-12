// ============================================================
// Forgot Password Page
// ============================================================

import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../hooks/useLanguage';
import Button from '../components/Button';
import Input from '../components/Input';
import Card from '../components/Card';
import { isValidEmail } from '../lib/utils';

export default function ForgotPassword() {
  const { resetPassword, supabaseConfigured } = useAuth();
  const { t } = useLanguage();

  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(ev: FormEvent) {
    ev.preventDefault();
    setError('');

    if (!email.trim() || !isValidEmail(email)) {
      setError(t.invalidEmail);
      return;
    }

    setLoading(true);
    const { error: err } = await resetPassword(email);
    setLoading(false);

    if (err) {
      setError(err);
      return;
    }

    setSent(true);
  }

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-brand">
          <div className="brand-icon">🔐</div>
          <h1 className="brand-name">{t.appName}</h1>
        </div>

        <Card variant="glass" padding="lg">
          <h2 className="auth-title">{t.resetYourPassword}</h2>

          {!supabaseConfigured && (
            <div className="alert alert-warning">
              <span className="alert-icon">⚠️</span>
              <div>
                <strong>{t.supabaseNotConfigured}</strong>
                <p>{t.supabaseNotConfiguredDesc}</p>
              </div>
            </div>
          )}

          {sent ? (
            <div className="success-message">
              <div className="success-icon">✓</div>
              <p>{t.resetEmailSent}</p>
              <Link to="/login">
                <Button variant="secondary" fullWidth size="lg">
                  {t.backToLogin}
                </Button>
              </Link>
            </div>
          ) : (
            <>
              <p className="auth-subtitle">{t.enterEmailReset}</p>

              {error && (
                <div className="alert alert-error">
                  <span className="alert-icon">✕</span>
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} noValidate>
                <Input
                  label={t.email}
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                />

                <Button
                  type="submit"
                  fullWidth
                  loading={loading}
                  disabled={!supabaseConfigured}
                  size="lg"
                >
                  {t.sendResetLink}
                </Button>
              </form>
            </>
          )}

          <p className="auth-switch">
            <Link to="/login">{t.backToLogin}</Link>
          </p>
        </Card>
      </div>
    </div>
  );
}
