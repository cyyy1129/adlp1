// ============================================================
// Register Page
// ============================================================

import { useState, type FormEvent } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../hooks/useLanguage';
import Button from '../components/Button';
import Input from '../components/Input';
import Card from '../components/Card';
import { isValidEmail, isValidPhone, isStrongPassword, isValidUsername } from '../lib/utils';

export default function Register() {
  const { register, user, supabaseConfigured } = useAuth();
  const { t } = useLanguage();

  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    username: '',
    phone: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [generalError, setGeneralError] = useState('');
  const [success, setSuccess] = useState(false);

  // Already logged in
  if (user && !success) {
    return <Navigate to="/dashboard" replace />;
  }

  function update(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }));
    // Clear error on edit
    if (errors[field]) {
      setErrors(prev => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  }

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!form.firstName.trim()) e.firstName = t.required;
    if (!form.lastName.trim()) e.lastName = t.required;
    if (!form.username.trim()) e.username = t.required;
    else if (!isValidUsername(form.username)) e.username = t.invalidUsername;
    if (!form.phone.trim()) e.phone = t.required;
    else if (!isValidPhone(form.phone)) e.phone = t.invalidPhone;
    if (!form.email.trim()) e.email = t.required;
    else if (!isValidEmail(form.email)) e.email = t.invalidEmail;
    if (!form.password) e.password = t.required;
    else if (!isStrongPassword(form.password)) e.password = t.weakPassword;
    if (!form.confirmPassword) e.confirmPassword = t.required;
    else if (form.password !== form.confirmPassword) e.confirmPassword = t.passwordMismatch;
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(ev: FormEvent) {
    ev.preventDefault();
    setGeneralError('');
    if (!validate()) return;

    setLoading(true);
    const { error, needsVerification } = await register({
      firstName: form.firstName,
      lastName: form.lastName,
      username: form.username,
      phone: form.phone,
      email: form.email,
      password: form.password,
    });
    setLoading(false);

    if (error) {
      setGeneralError(error);
      return;
    }

    if (needsVerification) {
      setSuccess(true);
    }
  }

  if (success) {
    return (
      <div className="auth-page">
        <div className="auth-container">
          <div className="auth-brand">
            <div className="brand-icon">✉️</div>
            <h1 className="brand-name">{t.appName}</h1>
          </div>
          <Card variant="glass" padding="lg">
            <div className="success-message">
              <div className="success-icon">✓</div>
              <h2>{t.register}</h2>
              <p>{t.verifyEmail}</p>
              <Link to="/login">
                <Button variant="secondary" fullWidth size="lg">
                  {t.backToLogin}
                </Button>
              </Link>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-brand">
          <div className="brand-icon">🍜</div>
          <h1 className="brand-name">{t.appName}</h1>
        </div>

        <Card variant="glass" padding="lg">
          <h2 className="auth-title">{t.createYourAccount}</h2>

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
            <div className="form-row">
              <Input
                label={t.firstName}
                value={form.firstName}
                onChange={e => update('firstName', e.target.value)}
                error={errors.firstName}
                placeholder="Ahmad"
                autoComplete="given-name"
              />
              <Input
                label={t.lastName}
                value={form.lastName}
                onChange={e => update('lastName', e.target.value)}
                error={errors.lastName}
                placeholder="Ibrahim"
                autoComplete="family-name"
              />
            </div>

            <Input
              label={t.username}
              value={form.username}
              onChange={e => update('username', e.target.value)}
              error={errors.username}
              placeholder="ahmad_food"
              autoComplete="username"
            />

            <Input
              label={t.phone}
              type="tel"
              value={form.phone}
              onChange={e => update('phone', e.target.value)}
              error={errors.phone}
              placeholder="012-345 6789"
              autoComplete="tel"
            />

            <Input
              label={t.email}
              type="email"
              value={form.email}
              onChange={e => update('email', e.target.value)}
              error={errors.email}
              placeholder="you@example.com"
              autoComplete="email"
            />

            <Input
              label={t.password}
              type="password"
              value={form.password}
              onChange={e => update('password', e.target.value)}
              error={errors.password}
              placeholder="••••••••"
              autoComplete="new-password"
              hint="Min 8 chars, uppercase, lowercase, number"
            />

            <Input
              label={t.confirmPassword}
              type="password"
              value={form.confirmPassword}
              onChange={e => update('confirmPassword', e.target.value)}
              error={errors.confirmPassword}
              placeholder="••••••••"
              autoComplete="new-password"
            />

            <Button
              type="submit"
              fullWidth
              loading={loading}
              disabled={!supabaseConfigured}
              size="lg"
            >
              {t.signUp}
            </Button>
          </form>

          <p className="auth-switch">
            {t.haveAccount}{' '}
            <Link to="/login">{t.signIn}</Link>
          </p>
        </Card>
      </div>
    </div>
  );
}
