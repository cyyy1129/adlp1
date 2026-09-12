// ============================================================
// UI-only subscription and credit-package step for newly registered sellers.
// No payment, entitlement, or credit-balance logic lives here.
// ============================================================

import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Button from '../components/Button';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../hooks/useLanguage';

const CREDIT_PACKAGES = [
  { credits: 5, price: 'RM3', featured: false },
  { credits: 10, price: 'RM5', featured: true },
  { credits: 25, price: 'RM10', featured: false },
] as const;

export default function Subscription() {
  const { logout } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const [notice, setNotice] = useState<string | null>(null);
  const [continuing, setContinuing] = useState(false);
  const needsVerification = Boolean((location.state as { needsVerification?: boolean } | null)?.needsVerification);

  function chooseTrial() {
    setNotice('Free Trial selected. Your trial will be available after you log in. No subscription has been activated yet.');
  }

  function chooseCredits(credits: number) {
    setNotice(`${credits} credits selected. Payment integration coming soon.`);
  }

  async function continueToLogin() {
    setContinuing(true);
    // Supabase may create a session immediately after sign-up. Ending that
    // session preserves the required Subscription → Login handoff.
    await logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="subscription-page">
      <main className="subscription-shell" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', padding: '0 16px' }}>

        <header className="subscription-brand" style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div className="brand-icon" aria-hidden="true" style={{ fontSize: '2rem' }}>🍜</div>
          <h1 className="brand-name">{t.appName}</h1>
        </header>

        <section className="subscription-hero" aria-labelledby="subscription-title" style={{ textAlign: 'center', maxWidth: '600px', marginBottom: '40px' }}>
          <p className="planning-eyebrow" style={{ color: '#F97316', fontSize: '0.875rem', fontWeight: 'bold', letterSpacing: '0.05em', textTransform: 'uppercase' }}>WELCOME TO BLEU</p>
          <h2 id="subscription-title" style={{ fontSize: '1.75rem', fontWeight: 'bold', margin: '12px 0' }}>Choose how you would like to get started</h2>
          <p style={{ color: '#9CA3AF' }}>Start with a free month, or explore flexible credit packages. Payments and credits are preview-only for this MVP.</p>
          {needsVerification && <p className="subscription-verification" role="status">Check your email to verify your account, then continue to log in.</p>}
        </section>

        <div className="subscription-layout" style={{ width: '100%', maxWidth: '960px', marginBottom: '40px', alignItems: 'stretch' }}>

          {/* 左侧：Free Trial */}
          <section className="trial-card" aria-labelledby="trial-title" style={{
            display: 'flex',
            flexDirection: 'column',
            background: '#111827',
            padding: '32px',
            borderRadius: '16px',
            border: '1px solid #374151'
          }}>
            <div>
              <span className="subscription-badge" style={{ background: '#78350F', color: '#FDBA74', padding: '4px 12px', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 'bold' }}>BEST WAY TO START</span>
              <p className="trial-icon" aria-hidden="true" style={{ fontSize: '2rem', color: '#F97316', margin: '16px 0' }}>✦</p>
              <h2 id="trial-title" style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '12px' }}>1 Month Free Trial</h2>
              <p style={{ color: '#9CA3AF', marginBottom: '24px' }}>Try Bleu for one month and see how simple selling-session planning can be.</p>
              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px 0', display: 'flex', flexDirection: 'column', gap: '12px', color: '#E5E7EB' }}>
                <li>✓ Plan your selling sessions</li>
                <li>✓ Capture your results</li>
                <li>✓ Build your future selling history</li>
              </ul>
            </div>
            <div style={{ marginTop: 'auto' }}>
              <Button type="button" fullWidth size="lg" onClick={chooseTrial}>Start Free Trial</Button>
            </div>
          </section>

          {/* 右侧：Credit Packages */}
          <section className="credit-section" aria-labelledby="credit-title" style={{
            display: 'flex',
            flexDirection: 'column',
            background: '#111827',
            padding: '32px',
            borderRadius: '16px',
            border: '1px solid #374151'
          }}>
            <div className="subscription-section-heading" style={{ marginBottom: '24px' }}>
              <p className="planning-eyebrow" style={{ color: '#F97316', fontSize: '0.875rem', fontWeight: 'bold', letterSpacing: '0.05em', textTransform: 'uppercase' }}>FLEXIBLE OPTIONS</p>
              <h2 id="credit-title" style={{ fontSize: '1.5rem', fontWeight: 'bold', margin: '8px 0' }}>Credit Packages</h2>
              <p style={{ color: '#9CA3AF', fontSize: '0.875rem' }}>prices for the hackathon demo. You will not be charged.</p>
            </div>


            <div className="credit-package-grid">
              {CREDIT_PACKAGES.map(pkg => (
                <article key={pkg.credits} className={`credit-package ${pkg.featured ? 'credit-package-featured' : ''}`} style={{
                  flex: 1,
                  background: '#1F2937',
                  padding: '16px 8px',
                  borderRadius: '12px',
                  border: pkg.featured ? '1px solid #F97316' : '1px solid #374151',
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  position: 'relative',
                  overflow: 'visible' // 👈 核心修复：允许标签突破卡片边界显示
                }}>
                  {pkg.featured && (
                    <span style={{ // 👈 移除了容易打架的 class，纯靠内联
                      position: 'absolute',
                      top: '-12px',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      background: '#ea580c',
                      color: '#fff',
                      padding: '4px 12px',
                      borderRadius: '999px',
                      fontSize: '0.75rem',
                      fontWeight: 'bold',
                      whiteSpace: 'nowrap',
                      zIndex: 10,
                      lineHeight: '1'
                    }}>POPULAR</span>
                  )}
                  {/* 给带标签的卡片稍微加点 marginTop，防止字太挤 */}
                  <strong style={{ fontSize: '1.125rem', marginTop: pkg.featured ? '8px' : '0' }}>{pkg.credits} Credits</strong>
                  <span className="credit-price" style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{pkg.price}</span>
                  <span className="credit-note" style={{ fontSize: '0.75rem', color: '#6B7280', marginBottom: '8px' }}>Placeholder price</span>
                  <div style={{ marginTop: 'auto' }}>
                    <Button type="button" variant={pkg.featured ? 'primary' : 'secondary'} fullWidth onClick={() => chooseCredits(pkg.credits)}>Choose</Button>
                  </div>
                </article>
              ))}
            </div>
          </section>

        </div>

        <div className="subscription-bottom" style={{ width: '100%', maxWidth: '400px', textAlign: 'center' }}>
          {notice && <p className="subscription-notice" role="status" style={{ color: '#10B981', marginBottom: '16px' }}>{notice}</p>}
          <Button type="button" variant="secondary" size="lg" fullWidth loading={continuing} onClick={continueToLogin}>Continue to Login</Button>
          <p style={{ color: '#6B7280', fontSize: '0.875rem', marginTop: '16px' }}>Nothing is activated or charged on this page.</p>
        </div>
      </main>
    </div>
  );
}
