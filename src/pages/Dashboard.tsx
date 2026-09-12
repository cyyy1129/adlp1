// ============================================================
// Visual MVP dashboard. Forecast values are clearly labelled as preview data.
// ============================================================

import { useNavigate } from 'react-router-dom';
import BottomNavigation from '../components/BottomNavigation';
import Button from '../components/Button';
import { useAuth } from '../hooks/useAuth';

const DEMO_HISTORY = [
  { date: '12 Sep', food: 'Nasi ayam', detail: '118 portions sold' },
  { date: '5 Sep', food: 'Nasi lemak', detail: '103 portions sold' },
  { date: '4 Sep', food: 'Mee goreng', detail: '92 portions sold' },
];

function getInitial(name: string): string {
  return name.trim().charAt(0).toUpperCase() || 'B';
}

export default function Dashboard() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const sellerName = profile?.first_name?.trim() || profile?.username?.trim() || 'Pak Ali';
  const greeting = profile?.preferred_language === 'ms' ? 'Selamat pagi' : 'Good morning';

  return (
    <div className="dashboard-page demo-dashboard-page app-page-with-nav">
      <header className="dashboard-header demo-dashboard-header">
        <button type="button" className="demo-brand" onClick={() => navigate('/dashboard')} aria-label="Bazaar Buddy dashboard">
          <span className="demo-brand-mark" aria-hidden="true">BB</span>
          <span>Bazaar Buddy</span>
        </button>
        <button type="button" className="demo-dashboard-account" onClick={() => navigate('/profile')}>
          <span className="demo-dashboard-avatar" aria-hidden="true">{getInitial(sellerName)}</span>
          <span>Account</span>
        </button>
      </header>

      <main className="demo-dashboard-shell">
        <section className="demo-dashboard-welcome" aria-labelledby="dashboard-welcome-title">
          <span className="demo-data-label">DEMO DASHBOARD</span>
          <h1 id="dashboard-welcome-title">{greeting}, {sellerName}</h1>
          <p>A simple view of your next selling session.</p>
        </section>

        <section className="demo-forecast-card" aria-labelledby="demo-forecast-title">
          <div className="demo-forecast-card-top">
            <div>
              <p className="demo-card-kicker">NEXT SELLING SESSION</p>
              <h2 id="demo-forecast-title">Nasi lemak at Kampung Baru</h2>
              <p>Saturday, 5:00 PM - 10:00 PM</p>
            </div>
            <span className="demo-preview-chip">Preview</span>
          </div>

          <div className="demo-forecast-body">
            <div className="demo-forecast-number">
              <span>Recommended preparation</span>
              <strong>124</strong>
              <b>portions</b>
              <small>Expected demand: 112-128 portions</small>
            </div>
            <div className="demo-demand-chart" aria-hidden="true">
              <svg viewBox="0 0 260 126" preserveAspectRatio="none">
                <path className="demo-chart-area" d="M0 111 C31 98 43 104 65 80 C91 51 106 76 132 61 C161 44 173 54 194 28 C217 7 235 26 260 10 L260 126 L0 126 Z" />
                <path className="demo-chart-line" d="M0 111 C31 98 43 104 65 80 C91 51 106 76 132 61 C161 44 173 54 194 28 C217 7 235 26 260 10" />
                <circle cx="194" cy="28" r="4.5" className="demo-chart-point" />
              </svg>
              <div><span>Last 3 sessions</span><b>Demand trend</b></div>
            </div>
          </div>

          <div className="demo-forecast-card-bottom">
            <Button size="sm" onClick={() => navigate('/recommendation?demo=1')}>View forecast</Button>
          </div>
        </section>

        <section className="demo-dashboard-insights" aria-label="Preview business insights">
          <article className="demo-insight-card demo-insight-sales">
            <span className="demo-insight-icon" aria-hidden="true">RM</span>
            <div><small>Expected sales</small><strong>RM184</strong><p>Preview for this session</p></div>
          </article>
          <article className="demo-insight-card demo-insight-waste">
            <span className="demo-insight-icon" aria-hidden="true">+</span>
            <div><small>Potential waste avoided</small><strong>1.8 kg</strong><p>Demo sustainability insight</p></div>
          </article>
        </section>

        <section className="demo-history-section" aria-labelledby="demo-history-title">
          <div className="demo-section-heading">
            <div><p className="demo-card-kicker">RECENT HISTORY</p><h2 id="demo-history-title">Your latest sessions</h2></div>
            <Button variant="ghost" size="sm" onClick={() => navigate('/question?mode=change')}>Update details</Button>
          </div>
          <p className="demo-history-note">Sample rows for the dashboard layout. Real completed sessions remain available in the existing history flow.</p>
          <div className="demo-history-list">
            {DEMO_HISTORY.map(item => (
              <article className="demo-history-row" key={item.date}>
                <time>{item.date}</time>
                <div><strong>{item.food}</strong><span>{item.detail}</span></div>
                <span className="demo-history-chevron" aria-hidden="true">&rsaquo;</span>
              </article>
            ))}
          </div>
        </section>
      </main>
      <BottomNavigation />
    </div>
  );
}
