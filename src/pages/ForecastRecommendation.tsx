// ============================================================
// Mobile-first, explainable demand-estimate result page.
// ============================================================

import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Button from '../components/Button';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../hooks/useLanguage';
import { getEventService } from '../services/events/eventService';
import { getHolidayService } from '../services/context/holidayService';
import { getTransitContext } from '../services/context/transitService';
import { calculateForecast } from '../services/forecast/forecastEngine';
import { getForecastPlanContext, getSavedForecast, saveForecastResult } from '../services/forecast/forecastDataService';
import { getPublicBenchmarkEvidence } from '../services/forecast/publicBenchmarkService';
import { getPricingService } from '../services/pricing/pricingService';
import { getHistoricalWeatherService } from '../services/weather/historicalWeatherService';
import { getWeatherService } from '../services/weather/weatherService';
import type { ForecastPlanContext, ForecastResult } from '../types/forecast';

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
        setError(contextResult.error ?? 'Forecast context could not be loaded.');
        setLoading(false);
        return;
      }
      setContext(contextResult.data);

      const savedResult = await getSavedForecast(planId!);
      if (!current) return;
      if (savedResult.data) {
        setForecast(savedResult.data);
        setLoading(false);
        return;
      }

      const request = {
        date: contextResult.data.plan.plan_date,
        start_time: contextResult.data.plan.start_time,
        end_time: contextResult.data.plan.end_time,
        latitude: contextResult.data.plan.latitude,
        longitude: contextResult.data.plan.longitude,
        location_name: contextResult.data.plan.location_name,
      };
      const [weather, historicalWeather, eventResult, priceInsight, publicBenchmarkResult, calendarContext, transitContext] = await Promise.all([
        getWeatherService().getForecast(request),
        getHistoricalWeatherService().getHistoricalContext(request),
        getEventService().getNearbyEvents(request),
        getPricingService().getInsight({
          food_name: contextResult.data.food.food_name,
          food_category: contextResult.data.food.food_category,
          location_name: contextResult.data.plan.location_name,
        }),
        getPublicBenchmarkEvidence(contextResult.data),
        getHolidayService().getContext(contextResult.data.plan.plan_date, contextResult.data.seller_state),
        getTransitContext(contextResult.data.plan.location_name, contextResult.data.plan.plan_date),
      ]);
      if (!current) return;

      if (!publicBenchmarkResult.data) {
        setError(publicBenchmarkResult.error ?? 'Public benchmark data could not be loaded.');
        setLoading(false);
        return;
      }
      if (publicBenchmarkResult.error) setPersistenceNotice(`Public benchmark data was unavailable: ${publicBenchmarkResult.error}. Continuing without it.`);

      const calculated = calculateForecast({
        context: contextResult.data,
        publicBenchmark: publicBenchmarkResult.data,
        weather,
        historicalWeather,
        calendarContext,
        transitContext,
        events: eventResult.events,
        eventsAvailability: eventResult.availability,
        priceInsight,
      });
      setForecast(calculated);
      const saveResult = await saveForecastResult(planId!, contextResult.data.food.id, calculated);
      if (!current) return;
      if (saveResult.error) setPersistenceNotice(`Forecast shown, but it could not be saved: ${saveResult.error}`);
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
          <p className="planning-confirmation-label">{isPublicBenchmark ? 'Public benchmark reference' : 'Recommended preparation'}</p>
          {forecast.is_estimate_available ? (
            <>
              <div className="forecast-range">{forecast.estimated_min}–{forecast.estimated_max} <span>{forecast.unit}</span></div>
              <p className="forecast-prepare">
                {isPublicBenchmark ? 'Revenue-equivalent benchmark: ' : 'Prepare around '}
                <strong>{forecast.recommended_quantity} {forecast.unit}</strong>
              </p>
              {isPublicBenchmark && <p className="forecast-prepare">This is for the published bazaar period, not a claim about one session’s item-level units sold.</p>}
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
        </section>

        {persistenceNotice && <div className="alert alert-warning forecast-notice"><span className="alert-icon">!</span><span>{persistenceNotice}</span></div>}

        <section className="forecast-section">
          <h2>Why this estimate?</h2>
          {forecast.is_estimate_available && (
            <div className="forecast-calculation">
              <span>{isPublicBenchmark ? 'Public benchmark:' : 'Personal empirical baseline:'} {forecast.baseline_quantity} {forecast.unit}</span>
              <span>Method: {forecast.source_type === 'personalized' ? 'private completed sessions' : 'validated public benchmark'}</span>
            </div>
          )}
          <ul className="forecast-facts">
            {forecast.explanation_facts.map(fact => <li key={fact}>{fact}</li>)}
          </ul>
          <div className="forecast-signal-list">
            {forecast.signals.map(signal => (
              <article key={signal.kind} className={`forecast-signal forecast-signal-${signal.availability}`}>
                <div><strong>{signal.label}</strong><span>{signal.detail}</span></div>
                <b>{signal.role === 'context_only' ? 'Context only' : signal.role === 'baseline' ? 'Baseline' : 'Calibration'}</b>
              </article>
            ))}
          </div>
          <p className="forecast-disclaimer">{forecast.methodology} Confidence is a product evidence indicator, not a scientific probability.</p>
        </section>

        <section className="forecast-section">
          <h2>Evidence and sources</h2>
          <article className="forecast-provider-card">
            <strong>{forecast.evidence_level === 'benchmark_approximation' ? 'Public benchmark approximation' : forecast.evidence_level === 'personal_observations' ? 'Private seller observations' : 'Insufficient evidence'}</strong>
            <p>{forecast.public_benchmark.limitation}</p>
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
          <h2>Historical weather</h2>
          <article className="forecast-provider-card">
            <strong>{forecast.historical_weather.availability === 'available' ? 'Observed reference' : 'Unavailable'}</strong>
            <p>{forecast.historical_weather.summary}</p>
            {forecast.historical_weather.source_url && <a href={forecast.historical_weather.source_url} target="_blank" rel="noreferrer">Open source</a>}
          </article>
        </section>

        <section className="forecast-section">
          <h2>Public holiday and transit context</h2>
          <article className="forecast-provider-card">
            <strong>{forecast.calendar_context.holiday_name ?? (forecast.calendar_context.is_public_holiday === false ? 'No public holiday listed' : 'Holiday data unavailable')}</strong>
            <p>{forecast.calendar_context.summary}</p>
            {forecast.calendar_context.source_url && <a href={forecast.calendar_context.source_url} target="_blank" rel="noreferrer">Open source</a>}
          </article>
          <article className="forecast-provider-card">
            <strong>{forecast.transit_context.station_name ?? 'No reviewed transit link'}</strong>
            <p>{forecast.transit_context.summary}</p>
            {forecast.transit_context.source_url && <a href={forecast.transit_context.source_url} target="_blank" rel="noreferrer">Open source</a>}
          </article>
        </section>

        <section className="forecast-section">
          <h2>Price insight</h2>
          <article className="forecast-provider-card">
            <strong>{forecast.price_insight.availability === 'available' ? forecast.price_insight.source_name : 'Price reference unavailable'}</strong>
            <p>{forecast.price_insight.summary}</p>
            {forecast.price_insight.availability === 'available' && forecast.price_insight.item_name && forecast.price_insight.recent_price !== null && (
              <dl className="forecast-data-grid">
                <div><dt>Item</dt><dd>{forecast.price_insight.item_name}</dd></div>
                <div><dt>Recent reference</dt><dd>{formatCurrency(forecast.price_insight.recent_price)}{forecast.price_insight.unit ? ` / ${forecast.price_insight.unit}` : ''}</dd></div>
                {forecast.price_insight.price_date && <div><dt>Reference date</dt><dd>{forecast.price_insight.price_date}</dd></div>}
                {forecast.price_insight.sample_size && <div><dt>Observed records</dt><dd>{forecast.price_insight.sample_size}</dd></div>}
              </dl>
            )}
            {forecast.price_insight.reference_url && <a href={forecast.price_insight.reference_url} target="_blank" rel="noreferrer">Open reference</a>}
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
