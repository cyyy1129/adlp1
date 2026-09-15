// ============================================================
// Visual MVP dashboard. Forecast values are clearly labelled as preview data.
// ============================================================

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import BottomNavigation from '../components/BottomNavigation';
import Button from '../components/Button';
import { useAuth } from '../hooks/useAuth';
import { DEMO_METRICS, DEMO_WEATHER_CONTEXT, getDemoSustainabilityProgress } from '../lib/demoMetrics';
import { getSellerSetup } from '../services/sellingSetupService';

const DEMO_HISTORY = [
  { date: '12 Sep', food: 'Nasi ayam', detail: '118 portions sold' },
  { date: '5 Sep', food: 'Nasi lemak', detail: '103 portions sold' },
  { date: '4 Sep', food: 'Mee goreng', detail: '92 portions sold' },
];

function getInitial(name: string): string {
  return name.trim().charAt(0).toUpperCase() || 'B';
}

export default function Dashboard() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const sellerName = profile?.first_name?.trim() || profile?.username?.trim() || 'Pak Ali';
  const greeting = profile?.preferred_language === 'ms' ? 'Selamat pagi' : 'Good morning';
  const sustainabilityProgress = getDemoSustainabilityProgress();

  const savedBazaar = profile?.default_location_name?.trim() || null;
  const savedFood = profile?.custom_food_name?.trim()
    || profile?.food_categories?.find(category => category !== 'Others')?.trim()
    || null;

  // --- Dynamic State Variables ---
  const [sellingFood, setSellingFood] = useState(savedFood ?? 'Your food');
  const [sellingLocation, setSellingLocation] = useState(savedBazaar ?? DEMO_WEATHER_CONTEXT.fallbackLocation);
  const [prepRange, setPrepRange] = useState<{ min: number; max: number }>({
    min: DEMO_METRICS.preparationRange.minimum,
    max: DEMO_METRICS.preparationRange.maximum
  });

  // --- Fetch exactly matching your sellingSetupService ---
  useEffect(() => {
    if (user) {
      getSellerSetup(user.id).then(({ data }) => {
        if (data) {
          // 1. Update Food Name
          if (data.food_name) {
            const name = data.food_name.trim();
            setSellingFood(name.charAt(0).toUpperCase() + name.slice(1));
          }

          // 2. Update Location
          if (data.location_name) {
            setSellingLocation(data.location_name.trim());
          }

          // 3. Update Quantity (+/- 10% for the preparation range)
          if (data.quantity) {
            const qty = Number(data.quantity);
            setPrepRange({
              min: Math.floor(qty * 0.9),
              max: Math.ceil(qty * 1.1)
            });
          }
        }
      }).catch(err => console.error("Error fetching setup:", err));
    }
  }, [user]);

  return (
    <div className="dashboard-page demo-dashboard-page app-page-with-nav">
      <header className="dashboard-header demo-dashboard-header">
        <button type="button" className="demo-brand" onClick={() => navigate('/dashboard')} aria-label="Bleu dashboard">
          <span className="demo-brand-mark" aria-hidden="true">BL</span>
          <span>Bleu</span>
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
              <h2 id="demo-forecast-title">{sellingFood} at {sellingLocation}</h2>
              <p>Saturday, 5:00 PM - 10:00 PM</p>
            </div>
            <span className="demo-preview-chip">Preview</span>
          </div>

          <div className="demo-forecast-body">
            <div className="demo-forecast-number">
              <span>Recommended preparation range</span>
              <strong className="demo-forecast-range-value">{prepRange.min}-{prepRange.max}</strong>
              <b>{DEMO_METRICS.preparationRange.unit}</b>
              <small>Prepare within this range for the session.</small>
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

        <section className="demo-weather-card" aria-labelledby="demo-weather-title">
          <span className="demo-weather-icon" aria-hidden="true">☀</span>
          <div className="demo-weather-copy">
            <p className="demo-card-kicker">WEATHER — DEMO CONTEXT</p>
            <h2 id="demo-weather-title">Weather for {sellingLocation}</h2>

          </div>
          <div className="demo-weather-stat" aria-label={`Demo weather: ${DEMO_WEATHER_CONTEXT.condition}, ${DEMO_WEATHER_CONTEXT.temperature}`}>
            <strong>{DEMO_WEATHER_CONTEXT.temperature}</strong>
            <span>{DEMO_WEATHER_CONTEXT.condition}</span>
          </div>
          <div className="demo-weather-footer">
            <span>Rain chance <b>{DEMO_WEATHER_CONTEXT.rainChance}</b></span>
            <Button variant="ghost" size="sm" onClick={() => navigate('/question?mode=change')}>Change bazaar</Button>
          </div>
        </section>

        <section className="demo-dashboard-insights" aria-label="Preview business insights">
          <article className="demo-insight-card demo-insight-sales">
            <span className="demo-insight-icon" aria-hidden="true">RM</span>
            <div><small>How much cost you have saved</small><strong>RM{DEMO_METRICS.potentialSavings}</strong></div>
          </article>
          <article className="demo-insight-card demo-insight-accuracy">
            <span className="demo-insight-icon" aria-hidden="true">%</span>
            <div><small>Past forecast accuracy</small><strong>{DEMO_METRICS.pastForecastAccuracy}%</strong><p>Based on past history</p></div>
          </article>
        </section>

        <section className="demo-sustainability-card" aria-labelledby="sustainability-progress-title">
          <div className="demo-sustainability-icon" aria-hidden="true">S</div>
          <div className="demo-sustainability-copy">
            <p className="demo-card-kicker">SUSTAINABILITY</p>
            <h2 id="sustainability-progress-title">Sustainability progress</h2>
            <p>{DEMO_METRICS.potentialWasteAvoidedKg} kg potential waste avoided. Goal reached - your badge is unlocked in Profile.</p>
          </div>
          <strong>{sustainabilityProgress}%</strong>
          <div
            className="demo-sustainability-progress"
            role="progressbar"
            aria-label="Demo sustainability progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={sustainabilityProgress}
            aria-valuetext={`${sustainabilityProgress}% complete`}
          ><span style={{ width: `${sustainabilityProgress}%` }} /></div>
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