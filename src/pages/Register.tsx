// ============================================================
// Register Page
// ============================================================

import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../hooks/useLanguage';
import Button from '../components/Button';
import Input from '../components/Input';
import Card from '../components/Card';
import { isValidEmail, isValidPhone, isStrongPassword, isValidUsername } from '../lib/utils';

export default function Register() {
  const { register, user, supabaseConfigured } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    firstName: '', lastName: '', username: '', phone: '', email: '', password: '', confirmPassword: '', referralCode: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [generalError, setGeneralError] = useState('');
  const [registrationInProgress, setRegistrationInProgress] = useState(false);
  const [needsVerification, setNeedsVerification] = useState(false);

  // A new account may receive a session immediately. The route gate below
  // still sends an unfinished profile through onboarding exactly once.
  if (user && !registrationInProgress) return <Navigate to="/dashboard" replace />;

  function update(field: keyof typeof form, value: string) {
    setForm(previous => ({ ...previous, [field]: value }));
    if (errors[field]) {
      setErrors(previous => {
        const next = { ...previous };
        delete next[field];
        return next;
      });
    }
  }

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (!form.firstName.trim()) next.firstName = t.required;
    if (!form.lastName.trim()) next.lastName = t.required;
    if (!form.username.trim()) next.username = t.required;
    else if (!isValidUsername(form.username)) next.username = t.invalidUsername;
    if (!form.phone.trim()) next.phone = t.required;
    else if (!isValidPhone(form.phone)) next.phone = t.invalidPhone;
    if (!form.email.trim()) next.email = t.required;
    else if (!isValidEmail(form.email)) next.email = t.invalidEmail;
    if (!form.password) next.password = t.required;
    else if (!isStrongPassword(form.password)) next.password = t.weakPassword;
    if (!form.confirmPassword) next.confirmPassword = t.required;
    else if (form.password !== form.confirmPassword) next.confirmPassword = t.passwordMismatch;
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setGeneralError('');
    if (!validate()) return;
    setLoading(true);
    setRegistrationInProgress(true);
    const { error, needsVerification: verificationRequired } = await register({
      firstName: form.firstName,
      lastName: form.lastName,
      username: form.username,
      phone: form.phone,
      email: form.email,
      password: form.password,
    });
    setLoading(false);
    if (error) {
      setRegistrationInProgress(false);
      setGeneralError(error);
      return;
    }
    if (verificationRequired) {
      setRegistrationInProgress(false);
      setNeedsVerification(true);
      return;
    }
    // With email confirmation disabled, Supabase may create a session here.
    // Start onboarding directly in that case; the route gate sends an
    // unauthenticated account to Login instead. The optional subscription
    // preview remains available as its own route, but is not a required step.
    navigate('/onboarding', { replace: true });
  }

  if (needsVerification) {
    return (
      <div className="auth-page">
        <div className="auth-container">
          <div className="auth-brand"><div className="brand-icon" aria-hidden="true">✉</div><h1 className="brand-name">{t.appName}</h1></div>
          <Card variant="glass" padding="lg">
            <div className="success-message">
              <div className="success-icon">✓</div>
              <h2>{t.register}</h2>
              <p>{t.verifyEmail}</p>
              <Link to="/login"><Button variant="secondary" fullWidth size="lg">{t.backToLogin}</Button></Link>
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
          <div className="brand-icon" aria-hidden="true">🍜</div>
          <h1 className="brand-name">{t.appName}</h1>
        </div>
        <Card variant="glass" padding="lg">
          <h2 className="auth-title">{t.createYourAccount}</h2>
          {!supabaseConfigured && (
            <div className="alert alert-warning"><span className="alert-icon">!</span><div><strong>{t.supabaseNotConfigured}</strong><p>{t.supabaseNotConfiguredDesc}</p></div></div>
          )}
          {generalError && <div className="alert alert-error"><span className="alert-icon">!</span><span>{generalError}</span></div>}
          <form onSubmit={handleSubmit} noValidate>
            <div className="form-row">
              <Input label={t.firstName} value={form.firstName} onChange={event => update('firstName', event.target.value)} error={errors.firstName} placeholder="Ahmad" autoComplete="given-name" />
              <Input label={t.lastName} value={form.lastName} onChange={event => update('lastName', event.target.value)} error={errors.lastName} placeholder="Ibrahim" autoComplete="family-name" />
            </div>
            <Input label={t.username} value={form.username} onChange={event => update('username', event.target.value)} error={errors.username} placeholder="ahmad_food" autoComplete="username" />
            <Input label={t.phone} type="tel" value={form.phone} onChange={event => update('phone', event.target.value)} error={errors.phone} placeholder="012-345 6789" autoComplete="tel" />
            <Input label={t.email} type="email" value={form.email} onChange={event => update('email', event.target.value)} error={errors.email} placeholder="you@example.com" autoComplete="email" />
            <Input label={t.password} type="password" value={form.password} onChange={event => update('password', event.target.value)} error={errors.password} placeholder="••••••••" autoComplete="new-password" hint="Min 8 chars, uppercase, lowercase, number" />
            <Input label={t.confirmPassword} type="password" value={form.confirmPassword} onChange={event => update('confirmPassword', event.target.value)} error={errors.confirmPassword} placeholder="••••••••" autoComplete="new-password" />
            <Input label="Referral Code (Optional)" value={form.referralCode} onChange={event => update('referralCode', event.target.value)} placeholder="Enter referral code" autoComplete="off" hint="Optional — referrals and bonus credits are coming soon." />
            <Button type="submit" fullWidth loading={loading} disabled={!supabaseConfigured} size="lg">{t.signUp}</Button>
          </form>
          <p className="auth-switch">{t.haveAccount} <Link to="/login">{t.signIn}</Link></p>
        </Card>
      </div>
    </div>
  );
}
