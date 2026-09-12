// ============================================================
// Dashboard — Placeholder page
// ============================================================

import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../hooks/useLanguage';
import Button from '../components/Button';
import Card from '../components/Card';

export default function Dashboard() {
  const { profile, logout, supabaseConfigured } = useAuth();
  const { t, lang, toggleLanguage } = useLanguage();

  const displayName = profile?.first_name || 'User';
  const welcome = t.welcomeUser.replace('{name}', displayName);

  return (
    <div className="dashboard-page">
      {/* Top bar */}
      <header className="dashboard-header">
        <div className="dashboard-header-left">
          <span className="brand-icon-sm">🍜</span>
          <span className="brand-name-sm">{t.appName}</span>
        </div>
        <div className="dashboard-header-right">
          <button
            className="lang-toggle"
            onClick={toggleLanguage}
            title="Toggle language"
          >
            {lang === 'en' ? '🇬🇧 EN' : '🇲🇾 BM'}
          </button>
          <Button variant="ghost" size="sm" onClick={logout}>
            {t.logout}
          </Button>
        </div>
      </header>

      <main className="dashboard-main">
        <h1 className="dashboard-welcome">{welcome}</h1>

        {!supabaseConfigured && (
          <div className="alert alert-warning" style={{ marginBottom: '1rem' }}>
            <span className="alert-icon">⚠️</span>
            <div>
              <strong>{t.supabaseNotConfigured}</strong>
              <p>{t.supabaseNotConfiguredDesc}</p>
            </div>
          </div>
        )}

        {/* Profile summary */}
        {profile && (
          <Card variant="glass" padding="md" className="dashboard-profile-card">
            <h3>{t.yourProfile}</h3>
            <div className="profile-info-grid">
              <div className="profile-info-item">
                <span className="profile-info-label">{t.sellingCategories}</span>
                <div className="profile-tags">
                  {profile.food_categories?.map((cat: string) => (
                    <span key={cat} className="profile-tag">{cat}</span>
                  ))}
                  {profile.custom_food_name && (
                    <span className="profile-tag profile-tag-custom">{profile.custom_food_name}</span>
                  )}
                </div>
              </div>
              <div className="profile-info-item">
                <span className="profile-info-label">{t.location}</span>
                <span className="profile-info-value">
                  {profile.city}, {profile.state}
                </span>
              </div>
              <div className="profile-info-item">
                <span className="profile-info-label">{t.language}</span>
                <span className="profile-info-value">
                  {profile.preferred_language === 'en' ? t.english : t.bahasaMelayu}
                </span>
              </div>
            </div>
          </Card>
        )}

        {/* Coming soon placeholder */}
        <Card variant="outlined" padding="lg" className="dashboard-coming-soon">
          <div className="coming-soon-content">
            <div className="coming-soon-icon">📊</div>
            <h3>{t.comingSoon}</h3>
            <p>{t.planningFeatures}</p>
          </div>
        </Card>
      </main>
    </div>
  );
}
