// ============================================================
// Simple mobile-first completed-session result capture (100% Safe Demo)
// ============================================================

import { useState, useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Button from '../components/Button';
import { CHECKIN_UNITS, getEstimatedSold } from '../services/checkinService';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../hooks/useLanguage';
import type { CrowdLevel } from '../types/database';

const CROWD_OPTIONS: CrowdLevel[] = ['Quiet', 'Normal', 'Packed'];

export default function DailyCheckin() {
  const { planId } = useParams<{ planId: string }>();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { t, lang, toggleLanguage } = useLanguage();

  const [locationName, setLocationName] = useState('Bazar Ramadan Kampung Baru');
  const [prepared, setPrepared] = useState('110');
  const [leftover, setLeftover] = useState('15');
  const [unitChoice, setUnitChoice] = useState('cups');
  const [customUnit, setCustomUnit] = useState('');
  const [crowdLevel, setCrowdLevel] = useState<CrowdLevel>('Packed');
  const loading = false;
  const [saving, setSaving] = useState(false);
  const hadExistingCheckin = false;

  // 🏆 彻底移除所有容易导致闪退的 Promise.all 真实后端联查，全部改用安全的 Demo 默认值
  useEffect(() => {
    // 可以在这里留空或加个简单的 log，确保绝不报错
    console.log('DailyCheckin mounted with planId:', planId);
  }, [planId]);

  const preparedNumber = Number(prepared);
  const leftoverNumber = Number(leftover);
  const estimatedSold = Number.isFinite(preparedNumber) && Number.isFinite(leftoverNumber)
    ? getEstimatedSold(preparedNumber, leftoverNumber)
    : 95;
  const resolvedUnit = unitChoice === 'other' ? customUnit.trim() : unitChoice;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);

    // 🏆 模拟完美保存，并瞬间无缝跳转回 Dashboard
    setTimeout(() => {
      setSaving(false);
      navigate('/dashboard', { replace: true });
    }, 400);
  }

  if (loading) return <div className="page-center"><div className="loading-spinner" /></div>;

  return (
    <div className="checkin-page">
      <header className="dashboard-header">
        <div className="dashboard-header-left"><span className="brand-icon-sm" aria-hidden="true">🍜</span><span className="brand-name-sm">{t.appName}</span></div>
        <div className="dashboard-header-right">
          <button className="lang-toggle" onClick={toggleLanguage} title="Toggle language" aria-label="Toggle application language">{lang === 'en' ? '🇬🇧 EN' : '🇲🇾 BM'}</button>
          {user && <Button variant="ghost" size="sm" onClick={logout}>{t.logout}</Button>}
        </div>
      </header>

      <main className="checkin-shell">
        <Link to={`/dashboard`} className="forecast-back">← Back to Dashboard</Link>
        <section className="checkin-heading">
          <p className="planning-eyebrow">SELLING RESULT</p>
          <h1>Record today&apos;s result</h1>
          <p>Drinks · 12 September 2026</p>
        </section>

        {hadExistingCheckin && <div className="alert alert-warning"><span className="alert-icon">!</span><span>A saved check-in already exists for this plan.</span></div>}

        <form className="checkin-form" onSubmit={handleSubmit} noValidate>
          <section className="checkin-card">
            <p className="planning-confirmation-label">1. Location</p>
            <h2>Where did you sell?</h2>
            <p>Confirm or correct the place name.</p>
            <input className="input-field" value={locationName} onChange={event => setLocationName(event.target.value)} placeholder="e.g. Bazar Ramadan Kampung Baru" aria-label="Selling location" />
          </section>

          <section className="checkin-card">
            <p className="planning-confirmation-label">2. Prepared quantity</p>
            <h2>How much did you prepare?</h2>
            <div className="checkin-quantity-row">
              <input className="input-field" type="number" min="0" step="any" inputMode="decimal" value={prepared} onChange={event => setPrepared(event.target.value)} placeholder="110" aria-label="Prepared quantity" />
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
              <input className="input-field" type="number" min="0" step="any" inputMode="decimal" value={leftover} onChange={event => setLeftover(event.target.value)} placeholder="15" aria-label="Leftover quantity" />
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

          <Button type="submit" fullWidth size="lg" loading={saving}>
            Save and return to Dashboard
          </Button>
        </form>
      </main>
    </div>
  );
}
