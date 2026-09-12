import { useEffect, useState } from 'react';
import Button from '../Button';
import { useAuth } from '../../hooks/useAuth';
import {
  CHECKIN_UNITS,
  getDailyCheckin,
  getEstimatedSold,
  saveDailyCheckin,
} from '../../services/checkinService';
import { getForecastPlanContext } from '../../services/forecast/forecastDataService';
import type { ForecastPlanContext } from '../../types/forecast';
import type { CrowdLevel } from '../../types/database';

const CROWD_OPTIONS: CrowdLevel[] = ['Quiet', 'Normal', 'Packed'];

interface DailyCheckinPanelProps {
  planId: string | null;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('en-MY', { day: 'numeric', month: 'short', year: 'numeric' })
    .format(new Date(`${value}T12:00:00`));
}

export default function DailyCheckinPanel({ planId }: DailyCheckinPanelProps) {
  const { user, profile, supabaseConfigured } = useAuth();
  const [context, setContext] = useState<ForecastPlanContext | null>(null);
  const [loading, setLoading] = useState(Boolean(planId));
  const [loadError, setLoadError] = useState<string | null>(null);
  const [locationName, setLocationName] = useState('');
  const [prepared, setPrepared] = useState('');
  const [leftover, setLeftover] = useState('');
  const [unitChoice, setUnitChoice] = useState('');
  const [customUnit, setCustomUnit] = useState('');
  const [crowdLevel, setCrowdLevel] = useState<CrowdLevel | null>(null);
  const [hasExistingCheckin, setHasExistingCheckin] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const selectedPlanId = planId;
    const userId = user?.id;

    if (!selectedPlanId) {
      setContext(null);
      setLoading(false);
      setLoadError(null);
      setLocationName(profile?.default_location_name ?? '');
      setPrepared('');
      setLeftover('');
      setUnitChoice('');
      setCustomUnit('');
      setCrowdLevel(null);
      setHasExistingCheckin(false);
      setNotice(null);
      setError(null);
      return;
    }

    if (!userId || !supabaseConfigured) {
      setContext(null);
      setLoading(false);
      setLoadError('Sign in to load a selling session and save its result.');
      return;
    }

    const currentUserId = userId;
    const currentPlanId = selectedPlanId;

    let current = true;
    setLoading(true);
    setLoadError(null);
    setNotice(null);
    setError(null);

    async function loadCheckin() {
      const [contextResult, existingResult] = await Promise.all([
        getForecastPlanContext(currentUserId, currentPlanId),
        getDailyCheckin(currentUserId, currentPlanId),
      ]);
      if (!current) return;

      if (contextResult.error || !contextResult.data) {
        setContext(null);
        setLoadError(contextResult.error ?? 'This selling session could not be loaded.');
        setLoading(false);
        return;
      }

      if (existingResult.error) {
        setLoadError(existingResult.error);
      }

      const existing = existingResult.data;
      setContext(contextResult.data);
      setLocationName(existing?.location_name ?? contextResult.data.plan.location_name ?? profile?.default_location_name ?? '');
      setPrepared(existing ? String(existing.prepared_quantity) : '');
      setLeftover(existing ? String(existing.leftover_quantity) : '');
      setUnitChoice(existing?.unit && CHECKIN_UNITS.includes(existing.unit as typeof CHECKIN_UNITS[number]) ? existing.unit : '');
      setCustomUnit(existing?.unit && !CHECKIN_UNITS.includes(existing.unit as typeof CHECKIN_UNITS[number]) ? existing.unit : '');
      setCrowdLevel(existing?.crowd_level ?? null);
      setHasExistingCheckin(Boolean(existing));
      setLoading(false);
    }

    void loadCheckin();
    return () => { current = false; };
  }, [planId, profile?.default_location_name, supabaseConfigured, user]);

  const preparedNumber = Number(prepared);
  const leftoverNumber = Number(leftover);
  const estimatedSold = prepared.trim() !== '' && leftover.trim() !== ''
    && Number.isFinite(preparedNumber) && Number.isFinite(leftoverNumber)
    && preparedNumber >= 0 && leftoverNumber >= 0
    ? getEstimatedSold(preparedNumber, leftoverNumber)
    : null;
  const resolvedUnit = unitChoice === 'other' ? customUnit.trim() : unitChoice;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(null);
    setError(null);

    if (!locationName.trim()) {
      setError('Please enter the selling location.');
      return;
    }
    if (!prepared.trim() || !Number.isFinite(preparedNumber) || preparedNumber <= 0) {
      setError('Prepared quantity must be greater than zero.');
      return;
    }
    if (!leftover.trim() || !Number.isFinite(leftoverNumber) || leftoverNumber < 0) {
      setError('Leftover quantity cannot be negative.');
      return;
    }
    if (leftoverNumber > preparedNumber) {
      setError('Leftover quantity cannot be more than the prepared quantity.');
      return;
    }
    if (!resolvedUnit) {
      setError('Please select or enter a unit.');
      return;
    }
    if (!crowdLevel) {
      setError('Please choose how the crowd was.');
      return;
    }

    if (!user || !planId || !context) {
      setNotice('Your result is ready to review. Open a selling session recommendation to save it into your history.');
      return;
    }

    setSaving(true);
    const result = await saveDailyCheckin({
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

    if (result.error) {
      setError(result.error);
      return;
    }

    setHasExistingCheckin(true);
    setNotice('Selling result saved. It can now support future recommendations.');
  }

  return (
    <section className="profile-checkin-panel" id="daily-checkin" aria-labelledby="daily-checkin-title">
      <div className="profile-checkin-heading">
        <div>
          <p className="demo-card-kicker">AFTER SELLING</p>
          <h2 id="daily-checkin-title">Daily check-in</h2>
          <p>Record the actual outcome after your selling session so Bleu can compare it with the recommendation.</p>
        </div>
      </div>

      {!planId && (
        <div className="profile-checkin-empty" role="status">
          Enter the outcome below. Open a selling session&apos;s recommendation when you are ready to save it into your history.
        </div>
      )}

      {loading && <div className="profile-checkin-empty"><span className="loading-spinner" aria-hidden="true" /> Loading selling session…</div>}
      {loadError && <div className="alert alert-error"><span className="alert-icon">!</span><span>{loadError}</span></div>}

      {!loading && (!planId || context) && (
        <form className="checkin-form profile-checkin-form" onSubmit={handleSubmit} noValidate>
          {context && (
            <div className="profile-checkin-session">
              <strong>{context.food.food_name}</strong>
              <span>{context.plan.location_name ?? 'Location not set'} · {formatDate(context.plan.plan_date)}</span>
            </div>
          )}

          {hasExistingCheckin && <div className="alert alert-warning"><span className="alert-icon">!</span><span>You already recorded this session. Saving again updates the same result.</span></div>}

          <section className="checkin-card">
            <p className="planning-confirmation-label">Location</p>
            <h3>Where did you sell?</h3>
            <p>Confirm or correct the place name.</p>
            <input className="input-field" value={locationName} onChange={event => setLocationName(event.target.value)} placeholder="Selling location" aria-label="Selling location" />
          </section>

          <section className="checkin-card">
            <p className="planning-confirmation-label">Prepared quantity</p>
            <h3>How many portions did you prepare?</h3>
            <div className="checkin-quantity-row">
              <input className="input-field" type="number" min="0" step="any" inputMode="decimal" value={prepared} onChange={event => setPrepared(event.target.value)} placeholder="Quantity" aria-label="Prepared quantity" />
              <select className="input-field select-field" value={unitChoice} onChange={event => setUnitChoice(event.target.value)} aria-label="Prepared quantity unit">
                <option value="">Choose unit</option>
                {CHECKIN_UNITS.map(unit => <option key={unit} value={unit}>{unit}</option>)}
              </select>
            </div>
            {unitChoice === 'other' && <input className="input-field checkin-custom-unit" value={customUnit} onChange={event => setCustomUnit(event.target.value)} placeholder="Enter unit" aria-label="Other unit" />}
          </section>

          <section className="checkin-card">
            <p className="planning-confirmation-label">Leftovers</p>
            <h3>How many portions were left over?</h3>
            <div className="checkin-quantity-row">
              <input className="input-field" type="number" min="0" step="any" inputMode="decimal" value={leftover} onChange={event => setLeftover(event.target.value)} placeholder="Quantity" aria-label="Leftover quantity" />
              <div className="checkin-unit-readonly">{resolvedUnit || 'Same unit'}</div>
            </div>
          </section>

          <section className="checkin-card">
            <p className="planning-confirmation-label">Crowd</p>
            <h3>How was the crowd?</h3>
            <div className="checkin-crowd-options">
              {CROWD_OPTIONS.map(option => (
                <button key={option} type="button" className={`checkin-crowd-option ${crowdLevel === option ? 'checkin-crowd-selected' : ''}`} onClick={() => setCrowdLevel(option)} aria-pressed={crowdLevel === option}>
                  {option}
                </button>
              ))}
            </div>
          </section>

          <section className="checkin-sold-card" aria-live="polite">
            <p className="planning-confirmation-label">Actual sold</p>
            {estimatedSold === null
              ? <strong>Enter prepared and leftover quantities</strong>
              : <><strong>{estimatedSold} {resolvedUnit || 'units'}</strong><span>{prepared} prepared − {leftover} leftover</span></>}
          </section>

          {error && <div className="alert alert-error"><span className="alert-icon">!</span><span>{error}</span></div>}
          {notice && <div className="alert alert-success" role="status"><span className="alert-icon">✓</span><span>{notice}</span></div>}
          <Button type="submit" fullWidth size="lg" loading={saving}>
            {context ? (hasExistingCheckin ? 'Update selling result' : 'Save selling result') : 'Review selling result'}
          </Button>
        </form>
      )}
    </section>
  );
}
