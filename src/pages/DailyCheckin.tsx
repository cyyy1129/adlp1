// ============================================================
// Simple mobile-first completed-session result capture.
// ============================================================

import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Button from '../components/Button';
import { CHECKIN_UNITS, getDailyCheckin, getEstimatedSold, saveDailyCheckin } from '../services/checkinService';
import { getForecastPlanContext } from '../services/forecast/forecastDataService';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../hooks/useLanguage';
import type { ForecastPlanContext } from '../types/forecast';
import type { CrowdLevel } from '../types/database';

const CROWD_OPTIONS: CrowdLevel[] = ['Quiet', 'Normal', 'Packed'];

export default function DailyCheckin() {
  const { planId } = useParams<{ planId: string }>();
  const { user, logout, supabaseConfigured } = useAuth();
  const { t, lang, toggleLanguage } = useLanguage();
  const [context, setContext] = useState<ForecastPlanContext | null>(null);
  const [locationName, setLocationName] = useState('');
  const [prepared, setPrepared] = useState('');
  const [leftover, setLeftover] = useState('');
  const [unitChoice, setUnitChoice] = useState('bowls');
  const [customUnit, setCustomUnit] = useState('');
  const [crowdLevel, setCrowdLevel] = useState<CrowdLevel>('Normal');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [hadExistingCheckin, setHadExistingCheckin] = useState(false);

  useEffect(() => {
    if (!user || !planId) return;
    let current = true;
    async function load() {
      setLoading(true);
      const [contextResult, checkinResult] = await Promise.all([
        getForecastPlanContext(user!.id, planId!),
        getDailyCheckin(user!.id, planId!),
      ]);
      if (!current) return;
      if (contextResult.error || !contextResult.data) {
        setError(contextResult.error ?? 'Selling plan not found.');
        setLoading(false);
        return;
      }
      if (checkinResult.error) {
        setError(`Could not load an existing check-in: ${checkinResult.error}`);
      }
      const planContext = contextResult.data;
      setContext(planContext);
      setLocationName(checkinResult.data?.location_name ?? planContext.plan.location_name ?? '');

      const existingUnit = checkinResult.data?.unit ?? planContext.food.unit;
      if (CHECKIN_UNITS.includes(existingUnit as typeof CHECKIN_UNITS[number])) {
        setUnitChoice(existingUnit);
      } else {
        setUnitChoice('other');
        setCustomUnit(existingUnit);
      }
      if (checkinResult.data) {
        setPrepared(String(checkinResult.data.prepared_quantity));
        setLeftover(String(checkinResult.data.leftover_quantity));
        setCrowdLevel(checkinResult.data.crowd_level);
        setHadExistingCheckin(true);
      }
      setLoading(false);
    }
    void load();
    return () => { current = false; };
  }, [planId, user]);

  const preparedNumber = Number(prepared);
  const leftoverNumber = Number(leftover);
  const estimatedSold = Number.isFinite(preparedNumber) && Number.isFinite(leftoverNumber)
    ? getEstimatedSold(preparedNumber, leftoverNumber)
    : null;
  const resolvedUnit = unitChoice === 'other' ? customUnit.trim() : unitChoice;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user || !planId || !context) return;
    setError(null);
    setSuccess(null);
    setSaving(true);
    const { data, error: saveError } = await saveDailyCheckin({
      user_id: user.id,
      selling_plan_id: planId,
      checkin_date: context.plan.plan_date,
      location_name: locationName,
      prepared_quantity: preparedNumber,
      leftover_quantity: leftoverNumber,
      unit: resolvedUnit,
      crowd_level: crowdLevel,
    });
    setSaving(false);

    if (data) {
      setHadExistingCheckin(true);
      setSuccess(`Saved. Estimated sold: ${data.estimated_sold_quantity} ${data.unit}.`);
    }
    if (saveError) setError(saveError);
  }

  if (loading) return <div className="page-center"><div className="loading-spinner" /></div>;

  if (error && !context) {
    return (
      <div className="checkin-page">
        <header className="dashboard-header"><span className="brand-name-sm">{t.appName}</span><Link to="/dashboard"><Button variant="ghost" size="sm">Back to plan</Button></Link></header>
        <main className="checkin-shell"><div className="alert alert-error"><span className="alert-icon">!</span><span>{error}</span></div></main>
      </div>
    );
  }

  return (
    <div className="checkin-page">
      <header className="dashboard-header">
        <div className="dashboard-header-left"><span className="brand-icon-sm" aria-hidden="true">🍜</span><span className="brand-name-sm">{t.appName}</span></div>
        <div className="dashboard-header-right">
          <button className="lang-toggle" onClick={toggleLanguage} title="Toggle language">{lang === 'en' ? '🇬🇧 EN' : '🇲🇾 BM'}</button>
          <Button variant="ghost" size="sm" onClick={logout}>{t.logout}</Button>
        </div>
      </header>

      <main className="checkin-shell">
        <Link to={`/plans/${planId}/recommendation`} className="forecast-back">← Back to estimate</Link>
        <section className="checkin-heading">
          <p className="planning-eyebrow">SELLING RESULT</p>
          <h1>Record today&apos;s result</h1>
          <p>{context?.food.food_name} · {context?.plan.plan_date}</p>
        </section>

        {!supabaseConfigured && <div className="alert alert-warning"><span className="alert-icon">!</span><span>Supabase is not configured, so this result cannot be saved yet.</span></div>}
        {hadExistingCheckin && <div className="alert alert-warning"><span className="alert-icon">!</span><span>A saved check-in already exists for this plan. Saving updates it instead of creating a duplicate.</span></div>}
        {error && <div className="alert alert-error"><span className="alert-icon">!</span><span>{error}</span></div>}
        {success && <div className="alert alert-success"><span className="alert-icon">✓</span><span>{success}</span></div>}

        <form className="checkin-form" onSubmit={handleSubmit} noValidate>
          <section className="checkin-card">
            <p className="planning-confirmation-label">1. Location</p>
            <h2>Where did you sell?</h2>
            <p>Confirm or correct the place name. A full address is not needed.</p>
            <input className="input-field" value={locationName} onChange={event => setLocationName(event.target.value)} placeholder="e.g. Kampar Night Market" aria-label="Selling location" />
          </section>

          <section className="checkin-card">
            <p className="planning-confirmation-label">2. Prepared quantity</p>
            <h2>How much did you prepare?</h2>
            <div className="checkin-quantity-row">
              <input className="input-field" type="number" min="0" step="any" inputMode="decimal" value={prepared} onChange={event => setPrepared(event.target.value)} placeholder="80" aria-label="Prepared quantity" />
              <select className="input-field select-field" value={unitChoice} onChange={event => setUnitChoice(event.target.value)} aria-label="Prepared quantity unit">
                {CHECKIN_UNITS.map(unit => <option key={unit} value={unit}>{unit}</option>)}
              </select>
            </div>
            {unitChoice === 'other' && <input className="input-field checkin-custom-unit" value={customUnit} onChange={event => setCustomUnit(event.target.value)} placeholder="Enter unit" aria-label="Other unit" />}
          </section>

          <section className="checkin-card">
            <p className="planning-confirmation-label">3. Leftovers</p>
            <h2>How much was left?</h2>
            <div className="checkin-quantity-row">
              <input className="input-field" type="number" min="0" step="any" inputMode="decimal" value={leftover} onChange={event => setLeftover(event.target.value)} placeholder="12" aria-label="Leftover quantity" />
              <div className="checkin-unit-readonly">{resolvedUnit || 'Unit'}</div>
            </div>
          </section>

          <section className="checkin-card">
            <p className="planning-confirmation-label">4. Crowd</p>
            <h2>How was the crowd?</h2>
            <div className="checkin-crowd-options">
              {CROWD_OPTIONS.map(option => (
                <button key={option} type="button" className={`checkin-crowd-option ${crowdLevel === option ? 'checkin-crowd-selected' : ''}`} onClick={() => setCrowdLevel(option)}>
                  {option}
                </button>
              ))}
            </div>
          </section>

          <section className="checkin-sold-card" aria-live="polite">
            <p className="planning-confirmation-label">Estimated sold</p>
            {estimatedSold === null ? <strong>Enter both quantities</strong> : <><strong>{estimatedSold} {resolvedUnit || 'units'}</strong><span>{prepared || '0'} prepared − {leftover || '0'} leftover</span></>}
          </section>

          <Button type="submit" fullWidth size="lg" loading={saving} disabled={!supabaseConfigured || saving}>
            {hadExistingCheckin ? 'Update selling result' : 'Save selling result'}
          </Button>
          {success && <Link to="/profile" className="checkin-history-link">View your history</Link>}
        </form>
      </main>
    </div>
  );
}
