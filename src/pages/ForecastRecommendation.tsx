// ============================================================
// Mobile-first, explainable demand-estimate result page.
// ============================================================

import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Button from '../components/Button';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../hooks/useLanguage';
import type { ForecastPlanContext, ForecastResult } from '../types/forecast';
import { getForecastPlanContext } from '../services/forecast/forecastDataService';

function formatDate(date: string, language: 'en' | 'ms'): string {
  return new Intl.DateTimeFormat(language === 'ms' ? 'ms-MY' : 'en-MY', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  }).format(new Date(`${date}T12:00:00`));
}

function formatTime(value: string | null, language: 'en' | 'ms'): string {
  if (!value) return 'Time not set';
  const [hours, minutes] = value.split(':').map(Number);
  return new Intl.DateTimeFormat(language === 'ms' ? 'ms-MY' : 'en-MY', {
    hour: 'numeric', minute: '2-digit',
  }).format(new Date(2000, 0, 1, hours, minutes));
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR' }).format(value);
}

export default function ForecastRecommendation() {
  const { planId } = useParams<{ planId: string }>();
  const { user, logout } = useAuth();
  const { lang, t, toggleLanguage } = useLanguage();
  const [context, setContext] = useState<ForecastPlanContext | null>(null);
  const [forecast, setForecast] = useState<ForecastResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [persistenceNotice, setPersistenceNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !planId) return;
    let current = true;

    async function load() {
      setLoading(true);
      setError(null);


      const contextResult = await getForecastPlanContext(user!.id, planId!);
      if (!current) return;
      if (contextResult.error || !contextResult.data) {
        setError('We could not load this selling plan. Please return to your plans and try again.');
        setLoading(false);
        return;
      }
      setContext(contextResult.data);

      const demoForecast: ForecastResult = {
        is_estimate_available: true,
        estimated_min: 80,
        estimated_max: 130,
        recommended_quantity: 110,
        unit: 'cups',
        confidence: {
          level: 'Medium',
          score: 0,
          comparable_records: 0,
          unavailable_context_signals: 0,
          detail: ''
        },
        source_type: 'public_benchmark',
        baseline_quantity: 90,
        low_data_message: '',
        explanation_facts: [
          'Bazaar Ramadan Kampung Baru experiences massive foot traffic on weekends.',
          'Cold drinks are the highest-selling category for breaking fast.',
          'Saturday evening sessions typically see a 20% increase in volume.'
        ],
        signals: [
          {
            kind: 'public_benchmark',
            label: 'DOSM data',
            detail: 'High market intensity for KL',
            role: 'baseline',
            availability: 'available'
          },
          {
            kind: 'holiday_context',
            label: 'Weekend Traffic',
            detail: 'Saturday adds 20% expected volume',
            role: 'personal_calibration',
            availability: 'available'
          },
          {
            kind: 'weather_context',
            label: 'Weather Forecast',
            detail: 'Clear evening, 29°C',
            role: 'personal_calibration',
            availability: 'available'
          }
        ],
        methodology: 'Calculated using official DOSM KL bazaar revenue benchmarks, scaled for average beverage units and weekend multipliers.',
        evidence_level: 'benchmark_approximation',
        public_benchmark: {
          availability: 'available',
          limitation: 'Derived from state-level (Kuala Lumpur) bazaar revenue averages.',
          sources: [
            {
              source_id: 'dosm-2025', source_url: 'https://dosm.gov.my', name: 'Statistics on Ramadan Bazaars 2025', publisher: 'DOSM', what_it_measures: 'State-level sales value and stall count',
              license: '', coverage_start: '', coverage_end: '', retrieved_at: '', data_role: 'benchmark'
            }
          ],
          quantity_basis: 'per_session', estimate_quantity: 0, estimated_min: 0, estimated_max: 0, sample_size: 0, population_variance: 0,
          selected_scope: '', sales_value_per_stall: 0, persons_engaged_per_stall: 0, serving_price: 0, price_basis: 'seller_declared_menu_price', methodology: ''
        },
        weather: {
          availability: 'available',
          condition: 'clear',
          period_start: '2026-09-15T18:00:00',
          period_end: '2026-09-15T22:00:00',
          summary: 'Clear evening, ideal for maximum bazaar traffic.',
          temperature_c: 29,
          precipitation_probability: 0,
          precipitation_mm: 0,
          weather_code: 0,
          source: 'Open-Meteo'
        },
        events: [
          {
            name: 'Kampung Baru Weekend Street Market', distance_km: 0.2, source: 'Local Registry',
            starts_at: '',
            source_url: ''
          }
        ],
        historical_weather: {
          availability: 'unavailable', summary: 'Historical weather context not applied for this estimate.', source_url: undefined,
          source: '',
          reference_date: '',
          temperature_c: 0,
          precipitation_mm: 0,
          weather_code: 0
        },
        calendar_context: {
          availability: 'available', is_public_holiday: false, holiday_name: 'Weekend', summary: 'Saturday session adds 20% expected volume.', source_url: undefined,
          source: ''
        },
        transit_context: {
          station_name: 'LRT Kampung Baru', summary: 'High transit activity expected. Station is within 500m walking distance.', source_url: 'https://data.gov.my'
        },
        price_insight: {
          availability: 'available', source_name: 'PriceCatcher', summary: 'Average drink price reference in KL is RM 3.00.',
          item_name: 'Air Balang / Minuman', recent_price: 3.00, unit: 'cup', reference_url: 'https://data.gov.my', price_date: '', sample_size: 0
        },
        total_adjustment: 0,
        comparable_strategy: '',
        comparable_records: 0,
        events_availability: 'available',
        model_name: '',
        model_version: ''
      };

      setForecast(demoForecast);
      setPersistenceNotice('Demo Mode: Forecast data is hardcoded for the presentation and will not be saved to the database.');
      setLoading(false);
    }

    void load();
    return () => { current = false; };
  }, [planId, user]);

  if (loading) {
    return <div className="page-center"><div className="loading-spinner" /></div>;
  }

  if (error || !context || !forecast) {
    return (
      <div className="forecast-page">
        <header className="dashboard-header">
          <span className="brand-name-sm">{t.appName}</span>
          <Link to="/dashboard"><Button variant="ghost" size="sm">Back to plan</Button></Link>
        </header>
        <main className="forecast-shell">
          <div className="alert alert-error"><span className="alert-icon">!</span><span>{error ?? 'Forecast unavailable.'}</span></div>
        </main>
      </div>
    );
  }

  const plan = context.plan;
  const food = context.food;
  const isPublicBenchmark = forecast.source_type === 'public_benchmark';
  const primarySignals = forecast.signals.filter(signal => signal.kind === 'personal_history' || signal.kind === 'public_benchmark');

  return (
    <div className="forecast-page">
      <header className="dashboard-header">
        <div className="dashboard-header-left">
          <span className="brand-icon-sm" aria-hidden="true">🍜</span>
          <span className="brand-name-sm">{t.appName}</span>
        </div>
        <div className="dashboard-header-right">
          <button className="lang-toggle" onClick={toggleLanguage} title="Toggle language">
            {lang === 'en' ? '🇬🇧 EN' : '🇲🇾 BM'}
          </button>
          <Link to="/profile" className="header-profile-link">Profile</Link>
          <Button variant="ghost" size="sm" onClick={logout}>{t.logout}</Button>
        </div>
      </header>

      <main className="forecast-shell">
        <Link to="/dashboard" className="forecast-back">← Back to plan</Link>
        <section className="forecast-heading">
          <p className="planning-eyebrow">DEMAND ESTIMATE</p>
          <h1>Your selling plan</h1>
        </section>

        <section className="forecast-plan-card">
          <h2>{food.food_name}</h2>
          <p>{plan.location_name ?? 'Location not set'}</p>
          <p>{formatDate(plan.plan_date, lang)}</p>
          <p>{formatTime(plan.start_time, lang)} – {formatTime(plan.end_time, lang)}</p>
        </section>

        <section className="forecast-result-card">
          <p className="planning-confirmation-label">Recommended preparation</p>
          {forecast.is_estimate_available ? (
            <>
              <div className="forecast-range">{forecast.estimated_min}–{forecast.estimated_max} <span>{forecast.unit}</span></div>
              <p className="forecast-prepare">
                Prepare around <strong>{forecast.recommended_quantity} {forecast.unit}</strong>
              </p>
              <div className={`forecast-confidence forecast-confidence-${forecast.confidence.level.toLowerCase()}`}>
                <span>Confidence</span><strong>{forecast.confidence.level}</strong>
              </div>
            </>
          ) : (
            <>
              <div className="forecast-no-number">No numerical estimate yet</div>
              <p className="forecast-prepare">{forecast.low_data_message}</p>
              <div className="forecast-confidence forecast-confidence-low"><span>Confidence</span><strong>Low</strong></div>
            </>
          )}
          <p className="forecast-disclaimer">This is an estimate, not a guarantee. Your actual selling result will help improve future recommendations.</p>
        </section>

        {persistenceNotice && <div className="alert alert-warning forecast-notice"><span className="alert-icon">!</span><span>{persistenceNotice}</span></div>}

        <section className="forecast-section">
          <h2>Why this estimate?</h2>
          {forecast.is_estimate_available && (
            <div className="forecast-calculation">
              <span>{isPublicBenchmark ? 'Public-session benchmark:' : 'Historical sales baseline:'} {forecast.baseline_quantity} {forecast.unit}</span>
              <span>Method: {forecast.source_type === 'personalized' ? 'private completed sessions' : 'validated public session observations'}</span>
            </div>
          )}
          <ul className="forecast-facts">
            {forecast.explanation_facts.map(fact => <li key={fact}>{fact}</li>)}
          </ul>
          {primarySignals.length > 0 && <div className="forecast-signal-list">
            {primarySignals.map(signal => (
              <article key={signal.kind} className={`forecast-signal forecast-signal-${signal.availability}`}>
                <div><strong>{signal.label}</strong><span>{signal.detail}</span></div>
                <b>{signal.role === 'context_only' ? 'Context only' : signal.role === 'baseline' ? 'Baseline' : 'Calibration'}</b>
              </article>
            ))}
          </div>}
          <p className="forecast-disclaimer">{forecast.methodology} Confidence is a product evidence indicator, not a scientific probability.</p>
        </section>

        <section className="forecast-section">
          <h2>Evidence and sources</h2>
          <article className="forecast-provider-card">
            <strong>{forecast.evidence_level === 'benchmark_approximation' ? 'Validated public session observations' : forecast.evidence_level === 'personal_observations' ? 'Private seller observations' : 'Current evidence'}</strong>
            <p>{forecast.public_benchmark.availability === 'available' ? forecast.public_benchmark.limitation : 'No compatible public session-level units-sold dataset is currently connected for this plan.'}</p>
            {forecast.public_benchmark.sources.map(source => (
              <p key={source.source_id}>
                <a href={source.source_url} target="_blank" rel="noreferrer">{source.name}</a> — {source.publisher}; measures {source.what_it_measures}
              </p>
            ))}
          </article>
        </section>

        <section className="forecast-section">
          <h2>Weather</h2>
          <article className="forecast-provider-card">
            <strong>{forecast.weather.condition ? forecast.weather.condition : 'Unavailable'}</strong>
            <p>{forecast.weather.summary}</p>
            {forecast.weather.availability === 'available' && (
              <dl className="forecast-data-grid">
                <div><dt>Temperature</dt><dd>{forecast.weather.temperature_c}°C</dd></div>
                <div><dt>Rain probability</dt><dd>{forecast.weather.precipitation_probability}%</dd></div>
                <div><dt>Precipitation</dt><dd>{forecast.weather.precipitation_mm} mm</dd></div>
                <div><dt>Weather code</dt><dd>{forecast.weather.weather_code}</dd></div>
              </dl>
            )}
            {forecast.weather.source && <small>Source: {forecast.weather.source}</small>}
          </article>
        </section>

        <section className="forecast-section">
          <h2>Nearby events</h2>
          {forecast.events.length > 0 ? (
            <div className="forecast-provider-list">
              {forecast.events.map(event => (
                <article key={`${event.name}-${event.starts_at ?? ''}`} className="forecast-provider-card">
                  <strong>{event.name}</strong>
                  <p>{event.distance_km === null ? 'Distance not supplied' : `${event.distance_km} km away`}</p>
                  <small>Source: {event.source}</small>
                  {event.source_url && <a href={event.source_url} target="_blank" rel="noreferrer">Open event source</a>}
                </article>
              ))}
            </div>
          ) : (
            <article className="forecast-provider-card"><strong>No nearby event data available.</strong><p>No event adjustment was applied.</p></article>
          )}
        </section>

        <section className="forecast-section">
          <h2>Public holiday and transit context</h2>
          <article className="forecast-provider-card">
            <strong>{forecast.calendar_context?.holiday_name ?? 'Holiday data unavailable'}</strong>
            <p>{forecast.calendar_context?.summary ?? 'Official public-holiday data is unavailable.'}</p>
            {forecast.calendar_context?.source_url && <a href={forecast.calendar_context.source_url} target="_blank" rel="noreferrer">Open source</a>}
          </article>
          <article className="forecast-provider-card">
            <strong>{forecast.transit_context?.station_name ?? 'No reviewed transit link'}</strong>
            <p>{forecast.transit_context?.summary ?? 'No reviewed location-to-station mapping is available. Rapid Rail data was not used.'}</p>
            {forecast.transit_context?.source_url && <a href={forecast.transit_context.source_url} target="_blank" rel="noreferrer">Open source</a>}
          </article>
        </section>

        <section className="forecast-section">
          <h2>Price insight</h2>
          <article className="forecast-provider-card">
            <strong>{forecast.price_insight?.availability === 'available' ? forecast.price_insight.source_name : 'Price reference unavailable'}</strong>
            <p>{forecast.price_insight?.summary ?? 'Price reference unavailable.'}</p>
            {forecast.price_insight?.availability === 'available' && forecast.price_insight.item_name && forecast.price_insight.recent_price !== null && (
              <dl className="forecast-data-grid">
                <div><dt>Item</dt><dd>{forecast.price_insight.item_name}</dd></div>
                <div><dt>Recent reference</dt><dd>{formatCurrency(forecast.price_insight.recent_price)}{forecast.price_insight.unit ? ` / ${forecast.price_insight.unit}` : ''}</dd></div>
              </dl>
            )}
            {forecast.price_insight?.reference_url && <a href={forecast.price_insight.reference_url} target="_blank" rel="noreferrer">Open reference</a>}
          </article>
        </section>

        <section className="forecast-checkin-cta">
          <p className="planning-confirmation-label">After you sell</p>
          <h2>Record what happened</h2>
          <p>Save prepared quantity, leftovers, and crowd level so future estimates can use this completed session.</p>
          <Link to={`/plans/${plan.id}/check-in`}><Button size="lg">Record selling result</Button></Link>
        </section>
      </main>
    </div>
  );
}