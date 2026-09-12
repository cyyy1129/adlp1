// ============================================================
// Hardcoded visual preview used by the MVP flow after Voice Input is saved.
// This is intentionally separate from the real evidence-based recommendation.
// ============================================================

import { useNavigate } from 'react-router-dom';
import BottomNavigation from '../components/BottomNavigation';
import Button from '../components/Button';
import { useAuth } from '../hooks/useAuth';

export default function RecommendationPreview() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const sellerName = profile?.first_name?.trim() || profile?.username?.trim() || 'there';

  return (
    <div className="recommendation-preview-page app-page-with-nav">
      <header className="dashboard-header recommendation-preview-header">
        <button type="button" className="demo-brand" onClick={() => navigate('/dashboard')} aria-label="Back to Bazaar Buddy dashboard">
          <span className="demo-brand-mark" aria-hidden="true">BB</span>
          <span>Bazaar Buddy</span>
        </button>
        <button type="button" className="recommendation-preview-close" onClick={() => navigate('/dashboard')}>Dashboard</button>
      </header>

      <main className="recommendation-preview-shell">
        <section className="recommendation-preview-intro" aria-labelledby="recommendation-preview-title">
          <span className="demo-data-label">HARD-CODED DEMO PREVIEW</span>
          <h1 id="recommendation-preview-title">Your forecast preview, {sellerName}</h1>
          <p>This is the flow and layout shown after saving Voice Input. It does not use live data or save a recommendation.</p>
        </section>

        <section className="recommendation-preview-plan" aria-labelledby="preview-plan-title">
          <p className="demo-card-kicker">SAMPLE SELLING PLAN</p>
          <h2 id="preview-plan-title">Nasi lemak</h2>
          <dl>
            <div><dt>Location</dt><dd>Kampung Baru</dd></div>
            <div><dt>Session</dt><dd>Saturday, 5:00 PM - 10:00 PM</dd></div>
          </dl>
        </section>

        <section className="recommendation-preview-result" aria-labelledby="preview-result-title">
          <span className="demo-preview-chip">Demo recommendation</span>
          <p>Recommended preparation</p>
          <h2 id="preview-result-title">124 <span>portions</span></h2>
          <div className="recommendation-preview-range"><span>Expected demand</span><strong>112-128 portions</strong></div>
          <div className="recommendation-preview-confidence"><span>Confidence</span><b>Preview only</b></div>
        </section>

        <section className="recommendation-preview-why" aria-labelledby="preview-why-title">
          <div><p className="demo-card-kicker">WHY THIS SCREEN</p><h2 id="preview-why-title">Forecast explanation</h2></div>
          <ul>
            <li><span aria-hidden="true">1</span><p>Hardcoded quantity so you can review the recommendation layout and flow.</p></li>
            <li><span aria-hidden="true">2</span><p>Weather, event and historical signals are intentionally not claimed as live data in this preview.</p></li>
            <li><span aria-hidden="true">3</span><p>The existing evidence-based forecast page is kept separately for the real plan flow.</p></li>
          </ul>
        </section>

        <section className="recommendation-preview-context" aria-label="Preview context">
          <article><span className="recommendation-context-icon" aria-hidden="true">W</span><div><strong>Weather</strong><small>Clear and warm - mock context</small></div></article>
          <article><span className="recommendation-context-icon" aria-hidden="true">E</span><div><strong>Nearby events</strong><small>No live event lookup in this demo</small></div></article>
        </section>

        <div className="recommendation-preview-actions">
          <Button size="lg" fullWidth onClick={() => navigate('/dashboard')}>Open dashboard</Button>
          <Button variant="secondary" fullWidth onClick={() => navigate('/question?mode=change')}>Edit voice input</Button>
        </div>
      </main>
      <BottomNavigation />
    </div>
  );
}
