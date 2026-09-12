// ============================================================
// Seller profile and simple completed-session history.
// ============================================================

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Button from '../components/Button';
import { getHistoryReflection, getUserHistory, type HistoryEntry } from '../services/historyService';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../hooks/useLanguage';

function formatHistoryDate(value: string, language: 'en' | 'ms'): string {
  return new Intl.DateTimeFormat(language === 'ms' ? 'ms-MY' : 'en-MY', {
    day: 'numeric', month: 'short', year: 'numeric',
  }).format(new Date(`${value}T12:00:00`));
}

export default function Profile() {
  const { user, profile, logout, supabaseConfigured } = useAuth();
  const { lang, t, toggleLanguage } = useLanguage();
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [historyError, setHistoryError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let current = true;
    async function loadHistory() {
      setLoadingHistory(true);
      const result = await getUserHistory(user!.id);
      if (!current) return;
      setHistory(result.data);
      setHistoryError(result.error);
      setLoadingHistory(false);
    }
    void loadHistory();
    return () => { current = false; };
  }, [user]);

  const foodLabels = [
    ...(profile?.food_categories ?? []).filter(category => category !== 'Others'),
    ...(profile?.custom_food_name ? [profile.custom_food_name] : []),
  ];

  return (
    <div className="profile-page">
      <header className="dashboard-header">
        <div className="dashboard-header-left"><span className="brand-icon-sm" aria-hidden="true">🍜</span><span className="brand-name-sm">{t.appName}</span></div>
        <div className="dashboard-header-right">
          <button className="lang-toggle" onClick={toggleLanguage} title="Toggle language">{lang === 'en' ? '🇬🇧 EN' : '🇲🇾 BM'}</button>
          <Button variant="ghost" size="sm" onClick={logout}>{t.logout}</Button>
        </div>
      </header>

      <main className="profile-shell">
        <Link to="/dashboard" className="forecast-back">← Back to planning</Link>
        <section className="profile-heading"><p className="planning-eyebrow">SELLER PROFILE</p><h1>Your profile & history</h1></section>

        {!supabaseConfigured && <div className="alert alert-warning"><span className="alert-icon">!</span><span>Supabase is not configured. Profile history is unavailable.</span></div>}

        <section className="profile-card">
          <h2>Profile</h2>
          <dl className="profile-details">
            <div><dt>Name</dt><dd>{profile ? `${profile.first_name} ${profile.last_name}` : '—'}</dd></div>
            <div><dt>Username</dt><dd>{profile?.username ?? '—'}</dd></div>
            <div><dt>Phone</dt><dd>{profile?.phone ?? '—'}</dd></div>
            <div><dt>Email</dt><dd>{profile?.email ?? user?.email ?? '—'}</dd></div>
            <div><dt>State</dt><dd>{profile?.state ?? '—'}</dd></div>
            <div><dt>City</dt><dd>{profile?.city ?? '—'}</dd></div>
            <div><dt>Preferred language</dt><dd>{profile?.preferred_language === 'ms' ? 'Bahasa Melayu' : 'English'}</dd></div>
          </dl>
          <div className="profile-foods"><span>Food categories</span><div>{foodLabels.length > 0 ? foodLabels.map(food => <b key={food}>{food}</b>) : '—'}</div></div>
        </section>

        <section className="profile-history-section">
          <h2>History</h2>
          {loadingHistory ? (
            <div className="profile-history-loading"><div className="loading-spinner" /><span>Loading selling history…</span></div>
          ) : historyError ? (
            <div className="alert alert-error"><span className="alert-icon">!</span><span>{historyError}</span></div>
          ) : (
            <>
              <article className="profile-reflection"><p className="planning-confirmation-label">Simple reflection</p><p>{getHistoryReflection(history)}</p></article>
              {history.length === 0 ? (
                <div className="profile-empty-history"><strong>No completed selling sessions yet.</strong><p>Record a selling result after your next session to build your history.</p><Link to="/dashboard"><Button variant="secondary">Plan a session</Button></Link></div>
              ) : (
                <div className="profile-history-list">
                  {history.map(entry => (
                    <article key={entry.selling_plan_id} className="profile-history-card">
                      <div className="profile-history-top"><strong>{formatHistoryDate(entry.selling_date, lang)}</strong><span className={`profile-crowd profile-crowd-${entry.crowd_level.toLowerCase()}`}>{entry.crowd_level}</span></div>
                      <h3>{entry.food_name}</h3>
                      <p>{entry.location_name ?? 'Location not set'}</p>
                      <dl>
                        <div><dt>Prepared</dt><dd>{entry.prepared_quantity} {entry.unit}</dd></div>
                        <div><dt>Leftover</dt><dd>{entry.leftover_quantity} {entry.unit}</dd></div>
                        <div><dt>Estimated sold</dt><dd>{entry.estimated_sold_quantity} {entry.unit}</dd></div>
                      </dl>
                      <Link to={`/plans/${entry.selling_plan_id}/check-in`} className="profile-history-edit">Update result</Link>
                    </article>
                  ))}
                </div>
              )}
            </>
          )}
        </section>
      </main>
    </div>
  );
}
