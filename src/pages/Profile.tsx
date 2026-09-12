// ============================================================
// Account screen for the mobile MVP. The sustainability reward is a visual
// demo badge only; it does not claim measured impact.
// ============================================================

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import BottomNavigation from '../components/BottomNavigation';
import Button from '../components/Button';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../hooks/useLanguage';
import { getDemoSustainabilityProgress, hasDemoSustainabilityBadge } from '../lib/demoMetrics';
import { updateProfile } from '../services/profileService';

const DEMO_REFERRAL_CODE = 'BLEU-24';

const DEMO_CHECKIN_SNAPSHOTS = [
  { date: '12 Sep', prepared: 120, leftover: 8, sold: 112 },
  { date: '5 Sep', prepared: 110, leftover: 10, sold: 100 },
  { date: '29 Aug', prepared: 118, leftover: 14, sold: 104 },
];

function getInitials(firstName?: string | null, lastName?: string | null, username?: string | null): string {
  const initials = `${firstName?.trim().charAt(0) ?? ''}${lastName?.trim().charAt(0) ?? ''}`.trim();
  return initials || username?.trim().charAt(0).toUpperCase() || 'B';
}

function ArrowIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m9 18 6-6-6-6" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

export default function Profile() {
  const { user, profile, logout, refreshProfile, supabaseConfigured } = useAuth();
  const { lang, toggleLanguage } = useLanguage();
  const navigate = useNavigate();
  const [notice, setNotice] = useState<string | null>(null);
  const [savingLanguage, setSavingLanguage] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [sameLocationConfirmed, setSameLocationConfirmed] = useState(false);

  const sellerName = `${profile?.first_name ?? ''} ${profile?.last_name ?? ''}`.trim() || profile?.username || 'Bleu seller';
  const selectedLanguage = profile?.preferred_language === 'ms' ? 'Bahasa Melayu' : 'English';
  const sustainabilityProgress = getDemoSustainabilityProgress();

  async function handleLanguage() {
    const nextLanguage = lang === 'en' ? 'ms' : 'en';
    toggleLanguage();
    if (!user || !supabaseConfigured) {
      setNotice(`Language changed to ${nextLanguage === 'ms' ? 'Bahasa Melayu' : 'English'} on this device.`);
      return;
    }
    setSavingLanguage(true);
    const result = await updateProfile(user.id, { preferred_language: nextLanguage });
    setSavingLanguage(false);
    if (result.error) {
      setNotice('Language changed on this device, but could not be saved to your profile yet.');
      return;
    }
    await refreshProfile();
    setNotice('Preferred language saved.');
  }

  async function copyReferralCode() {
    try {
      await navigator.clipboard.writeText(DEMO_REFERRAL_CODE);
      setNotice('Demo referral code copied.');
    } catch {
      setNotice(`Demo referral code: ${DEMO_REFERRAL_CODE}`);
    }
  }

  async function handleLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  function confirmSameLocation() {
    setSameLocationConfirmed(true);
    setNotice('Same location selected for this demo session. Nothing was saved to your account.');
  }

  return (
    <div className="profile-page account-page app-page-with-nav">
      <header className="dashboard-header account-header">
        <button type="button" className="demo-brand" onClick={() => navigate('/dashboard')} aria-label="Back to Bleu dashboard">
          <span className="demo-brand-mark" aria-hidden="true">BL</span>
          <span>Bleu</span>
        </button>
        <span className="account-header-label">Account</span>
      </header>

      <main className="account-shell">
        <section className="account-identity" aria-labelledby="account-title">
          <div className="account-avatar-wrap">
            <div className="account-avatar" aria-hidden="true">{getInitials(profile?.first_name, profile?.last_name, profile?.username)}</div>
            {hasDemoSustainabilityBadge && <span className="sustainability-badge sustainability-badge-unlocked" title="Sustainability badge unlocked" aria-label="Sustainability badge unlocked">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M19.5 4.5C13.8 4.4 8.6 6.2 6.2 10.3c-1.5 2.6-.8 5.7 1.4 7.4 2.3 1.8 5.5 1.4 7.4-.7 3.1-3.6 3.6-8.7 4.5-12.5Z" strokeLinejoin="round" /><path d="M4 20c3.1-4.3 6.5-7 11.2-9.1" strokeLinecap="round" /></svg>
            </span>}
          </div>
          <div>
            <span className="demo-data-label">SELLER ACCOUNT</span>
            <h1 id="account-title">{sellerName}</h1>
            <p>{profile?.email ?? user?.email ?? 'Your Bleu account'}</p>
          </div>
        </section>

        <section className="sustainability-card" aria-labelledby="sustainability-title">
          <span className="sustainability-card-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9"><path d="M19.5 4.5C13.8 4.4 8.6 6.2 6.2 10.3c-1.5 2.6-.8 5.7 1.4 7.4 2.3 1.8 5.5 1.4 7.4-.7 3.1-3.6 3.6-8.7 4.5-12.5Z" strokeLinejoin="round" /><path d="M4 20c3.1-4.3 6.5-7 11.2-9.1" strokeLinecap="round" /></svg>
          </span>
          <div><p className="demo-card-kicker">{hasDemoSustainabilityBadge ? 'REWARD UNLOCKED' : 'REWARD PROGRESS'}</p><h2 id="sustainability-title">{hasDemoSustainabilityBadge ? 'Sustainability badge unlocked' : 'Work towards your sustainability badge'}</h2><p>{hasDemoSustainabilityBadge ? `${sustainabilityProgress}% complete in this hardcoded demo. Your badge is now shown on your profile.` : `${sustainabilityProgress}% complete in this hardcoded demo. Reach 100% to show the badge on your profile.`}</p></div>
        </section>

        <section className="account-location-prompt" aria-labelledby="same-location-title">
          <div>
            <p className="demo-card-kicker">TODAY'S SELLING PLACE</p>
            <h2 id="same-location-title">Are you still selling at the same place today?</h2>
            <p>{sameLocationConfirmed ? 'Kampung Baru is selected for this demo session.' : 'Demo saved location: Kampung Baru'}</p>
          </div>
          {sameLocationConfirmed ? (
            <span className="account-location-confirmed" role="status">Same place confirmed</span>
          ) : (
            <div className="account-location-actions">
              <Button size="sm" onClick={confirmSameLocation}>Yes, same place</Button>
              <Button size="sm" variant="secondary" onClick={() => navigate('/question?mode=change')}>No, change place</Button>
            </div>
          )}
          <small>This prompt does not update your saved location.</small>
        </section>

        <section className="account-menu" aria-label="Account settings">
          <div className="account-menu-row account-profile-row">
            <span className="account-menu-icon" aria-hidden="true">P</span>
            <div><strong>Profile</strong><small>{profile?.username ? `@${profile.username}` : 'Your seller account details'}</small></div>
          </div>
          <button type="button" className="account-menu-row" onClick={() => setShowSummary(current => !current)} aria-expanded={showSummary} aria-controls="daily-checkin-summary">
            <span className="account-menu-icon" aria-hidden="true">S</span>
            <div><strong>Summary</strong><small>{showSummary ? 'Hide check-in reflection' : 'View check-in reflection'}</small></div><ArrowIcon />
          </button>
          <button type="button" className="account-menu-row" onClick={() => void handleLanguage()} disabled={savingLanguage}>
            <span className="account-menu-icon" aria-hidden="true">A</span>
            <div><strong>Language</strong><small>{savingLanguage ? 'Saving language...' : selectedLanguage}</small></div><ArrowIcon />
          </button>
          <button type="button" className="account-menu-row" onClick={() => navigate('/question?mode=change')}>
            <span className="account-menu-icon" aria-hidden="true">B</span>
            <div><strong>Business details</strong><small>Update your selling details by voice or text</small></div><ArrowIcon />
          </button>
          <button type="button" className="account-menu-row" onClick={() => void copyReferralCode()}>
            <span className="account-menu-icon" aria-hidden="true">R</span>
            <div><strong>Referral code</strong><small>{DEMO_REFERRAL_CODE} - demo only</small></div><ArrowIcon />
          </button>
          <button type="button" className="account-menu-row account-logout-row" onClick={() => void handleLogout()}>
            <span className="account-menu-icon" aria-hidden="true">L</span>
            <div><strong>Log out</strong><small>Sign out from this device</small></div><ArrowIcon />
          </button>
        </section>

        {showSummary && (
          <section className="account-summary-panel" id="daily-checkin-summary" aria-labelledby="daily-checkin-summary-title">
            <div className="account-summary-heading">
              <div><p className="demo-card-kicker">DAILY CHECK-IN REFLECTION</p><h2 id="daily-checkin-summary-title">Your accumulated selling summary</h2></div>
            </div>
            <p className="account-summary-intro">This is a hardcoded example of the reflection that will eventually use your completed daily check-ins. It does not read or save any database data.</p>

            <div className="account-summary-stats" aria-label="Accumulated check-in totals">
              <article><span>Completed check-ins</span><strong>6</strong></article>
              <article><span>Average sold</span><strong>104 <small>packs</small></strong></article>
              <article><span>Average leftover</span><strong>10 <small>packs</small></strong></article>
            </div>

            <article className="account-reflection-card">
              <span aria-hidden="true">i</span>
              <p><strong>Reflection:</strong> Your recent Saturday sessions averaged about 104 packs sold. Keeping preparation close to 110 packs could help reduce leftover food while keeping a small buffer.</p>
            </article>

            <div className="account-summary-history" aria-label="Daily check-in history">
              {DEMO_CHECKIN_SNAPSHOTS.map(session => (
                <div key={session.date}>
                  <time>{session.date}</time>
                  <span>Prepared {session.prepared}</span>
                  <span>Leftover {session.leftover}</span>
                  <strong>{session.sold} sold</strong>
                </div>
              ))}
            </div>
          </section>
        )}

        {notice && <p className="account-notice" role="status">{notice}</p>}
      </main>
      <BottomNavigation />
    </div>
  );
}
