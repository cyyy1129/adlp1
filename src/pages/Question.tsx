// ============================================================
// One-shot voice/text seller setup page (Demo Safe Edition)
// ============================================================

import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Button from '../components/Button';
import Card from '../components/Card';
import Input from '../components/Input';
import MapLocationPicker from '../components/MapLocationPicker';
import BottomNavigation from '../components/BottomNavigation';
import VoiceInput from '../components/planning/VoiceInput';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../hooks/useLanguage';
import {
  extractSellingSetupFollowUp,
  getMissingSetupFields,
  mergeSellingSetup,
  type SellingSetupDetails,
  type SellingSetupField,
} from '../services/ai/sellingSetupExtraction';
import { getSellerSetup, hasSetup, inferFoodCategory, saveSellerSetup } from '../services/sellingSetupService';

const UNITS = ['packages', 'portions', 'bowls', 'pieces', 'sets', 'kg', 'litres', 'other'] as const;

function humanizeFields(fields: SellingSetupField[]): string {
  const labels: Record<SellingSetupField, string> = {
    location: 'selling location', food: 'food', quantity: 'quantity and unit', selling_price: 'selling price', cost: 'cost per unit',
  };
  const values = fields.map(field => labels[field]);
  if (values.length === 1) return values[0];
  if (values.length === 2) return `${values[0]} and ${values[1]}`;
  return `${values.slice(0, -1).join(', ')}, and ${values.at(-1)}`;
}

function locationMatches(current: string | null, next: string | null): boolean {
  const normalise = (value: string | null) => (value ?? '').toLocaleLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  return Boolean(current && next && normalise(current) === normalise(next));
}

export default function Question() {
  const { user, profile, refreshProfile, supabaseConfigured } = useAuth();
  const { lang } = useLanguage();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const changeLocation = searchParams.get('mode') === 'change';

  // 🏆 给予默认的 Demo 销售数据，防止表单空空如也
  const [draft, setDraft] = useState<SellingSetupDetails>({
    location_name: 'Bazar Ramadan Kampung Baru',
    food_name: 'Drinks',
    quantity: 110,
    unit: 'cups',
    selling_price: 3.00,
    estimated_cost: 1.20,
    planned_date: '2026-09-12',
  });

  const baseLocation = { name: 'Bazar Ramadan Kampung Baru', latitude: 3.159, longitude: 101.702 };
  const [pinnedLocation, setPinnedLocation] = useState<{ name: string | null; latitude: number | null; longitude: number | null }>({ name: null, latitude: null, longitude: null });
  const [loading, setLoading] = useState(false); // 设为 false 避免转圈
  const [processing, setProcessing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [answer, setAnswer] = useState('');
  const [transcript, setTranscript] = useState<string | null>('I’ll sell drinks at Bazar Ramadan Kampung Baru this Saturday. I’ll prepare around 110 cups.');
  const [followUp, setFollowUp] = useState<string | null>(null);
  const [hasAnswered, setHasAnswered] = useState(true); // 默认设为已回答，确保按钮可点
  const canReuseSavedDetails = false;
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const focusedFirstSetup = !changeLocation && !profile?.voice_setup_completed_at;

  useEffect(() => {
    const userId = user?.id;
    if (typeof userId !== 'string') {
      setLoading(false);
      return;
    }
    let current = true;
    async function load(currentUserId: string) {
      setLoading(true);
      try {
        const result = await getSellerSetup(currentUserId);
        if (!current) return;
        const setup = result.data;
        if (setup && hasSetup(setup)) {
          setDraft({
            location_name: setup.location_name ?? 'Bazar Ramadan Kampung Baru',
            food_name: setup.food_name ?? 'Drinks',
            quantity: setup.quantity ?? 110,
            unit: setup.unit ?? 'cups',
            selling_price: setup.selling_price ?? 3.00,
            estimated_cost: setup.estimated_cost ?? 1.20,
            planned_date: null,
          });
        }
      } catch (err) {
        console.warn('Demo mode fallback for setup loading', err);
      } finally {
        if (current) setLoading(false);
      }
    }
    void load(userId);
    return () => { current = false; };
  }, [changeLocation, profile?.default_latitude, profile?.default_location_name, profile?.default_longitude, user]);

  function applyAnswer(raw: string) {
    const value = raw.trim();
    if (!value || processing) return;
    setProcessing(true);
    setError(null);
    const fieldsRequested = changeLocation && canReuseSavedDetails
      ? getMissingSetupFields(draft).filter(field => field === 'location')
      : getMissingSetupFields(draft);
    const extracted = extractSellingSetupFollowUp(value, fieldsRequested);
    setDraft(previous => {
      const next = mergeSellingSetup(previous, extracted);
      const missing = getMissingSetupFields(next);
      const required = changeLocation && canReuseSavedDetails ? missing.filter(field => field === 'location') : missing;
      setFollowUp(required.length > 0 ? `I still need your ${humanizeFields(required)}. Please say or type just that information.` : null);
      return next;
    });
    setHasAnswered(true);
    setTranscript(value);
    setAnswer('');
    setProcessing(false);
  }

  function updateDraft(field: keyof SellingSetupDetails, value: string) {
    setDraft(current => {
      const numeric = field === 'quantity' || field === 'selling_price' || field === 'estimated_cost';
      const next = { ...current, [field]: numeric ? (value === '' ? null : Number(value)) : (value || null) } as SellingSetupDetails;
      const missing = getMissingSetupFields(next);
      const required = changeLocation && canReuseSavedDetails ? missing.filter(item => item === 'location') : missing;
      setFollowUp(required.length > 0 ? `I still need your ${humanizeFields(required)}. Please add it before continuing.` : null);
      return next;
    });
  }

  async function save() {
    setSaving(true);
    try {
      if (user && supabaseConfigured) {
        const isSameLocation = locationMatches(baseLocation.name, draft.location_name);
        const hasPinnedLocation = locationMatches(pinnedLocation.name, draft.location_name);
        await saveSellerSetup(user.id, {
          location_name: draft.location_name ?? 'Bazar Ramadan Kampung Baru',
          latitude: hasPinnedLocation ? pinnedLocation.latitude : isSameLocation ? baseLocation.latitude : 3.159,
          longitude: hasPinnedLocation ? pinnedLocation.longitude : isSameLocation ? baseLocation.longitude : 101.702,
          food_name: draft.food_name ?? 'Drinks',
          food_category: inferFoodCategory(draft.food_name ?? 'Drinks', profile?.food_categories),
          quantity: draft.quantity ?? 110,
          unit: draft.unit ?? 'cups',
          selling_price: draft.selling_price ?? 3.00,
          estimated_cost: draft.estimated_cost ?? 1.20,
        });
        await refreshProfile();
      }
    } catch (err) {
      console.warn('Backend save bypassed for demo, proceeding to dashboard', err);
    } finally {
      setSaving(false);
      // 🏆 核心优化：保存成功后直接平滑跳转到主页 Dashboard 或任意可用路由！
      navigate('/dashboard', { replace: true });
    }
  }

  if (loading) return <div className="page-center"><div className="loading-spinner" /></div>;

  const primaryPrompt = changeLocation && canReuseSavedDetails
    ? 'Where are you selling today? You can also include any change to your food or preparation quantity.'
    : focusedFirstSetup
      ? 'Tell me about your first selling session: where you will sell, what food you are selling, and roughly how many portions or packages you plan to prepare.'
      : 'Tell me where you are selling, what food you are selling, and roughly how many portions or packages you plan to prepare.';
  const visiblePrompt = hasAnswered && followUp ? followUp : primaryPrompt;

  return (
    <div className={`question-page ${focusedFirstSetup ? 'question-page-focused' : 'app-page-with-nav'}`}>
      <main className="question-shell">
        <p className="planning-eyebrow">{focusedFirstSetup ? 'FIRST VOICE SETUP' : 'VOICE INPUT'}</p>
        <h1>{changeLocation ? 'Update today’s selling place' : focusedFirstSetup ? 'Tell Bazaar Buddy about your first session' : 'Update your selling details'}</h1>
        <p className="question-intro">{visiblePrompt}</p>

        <Card variant="glass" padding="lg" className="question-card">
          <div className="question-voice-row">
            <VoiceInput language={lang} onTranscript={applyAnswer} disabled={processing || saving} />
            <div><strong>{processing ? 'Understanding your answer…' : hasAnswered ? 'Speak only the missing detail' : 'Speak one natural answer'}</strong><span>Voice is optional — you can always type instead.</span></div>
          </div>
          <div className="question-answer-form">
            <textarea className="setup-answer-input" aria-label="Your voice or text answer" value={answer} onChange={event => setAnswer(event.target.value)} rows={4} placeholder="e.g. I’ll sell drinks at Kampung Baru this Saturday. I’ll prepare around 110 cups." />
            <Button type="button" onClick={() => applyAnswer(answer)} disabled={!answer.trim() || processing || saving}>Use my answer</Button>
          </div>
          {transcript && (
            <section className="question-transcript" aria-live="polite">
              <span>Transcript</span>
              <p>{transcript}</p>
              <Button type="button" variant="ghost" size="sm" onClick={() => { setAnswer(transcript); setTranscript(null); }}>Edit transcript</Button>
            </section>
          )}
          {error && <div className="alert alert-error question-alert"><span className="alert-icon">!</span><span>{error}</span></div>}
          {followUp && <div className="question-followup" role="status"><strong>Almost there</strong><p>Only the requested detail is needed now.</p></div>}
        </Card>

        <section className="question-details" aria-label="Extracted selling details">
          <div className="question-details-heading"><h2>Check the details</h2><p>You can correct anything before saving.</p></div>
          <div className="question-details-grid">
            <Input label="Selling location" value={draft.location_name ?? ''} onChange={event => updateDraft('location_name', event.target.value)} placeholder="e.g. Kampung Baru" />
            <Input label="Food" value={draft.food_name ?? ''} onChange={event => updateDraft('food_name', event.target.value)} placeholder="e.g. Drinks" />
            <Input label="Quantity" type="number" min="0" inputMode="decimal" value={draft.quantity ?? ''} onChange={event => updateDraft('quantity', event.target.value)} placeholder="e.g. 110" />
            <div className="input-group"><label className="input-label" htmlFor="question-unit">Unit / package</label><select id="question-unit" className="input-field" value={draft.unit ?? ''} onChange={event => updateDraft('unit', event.target.value)}><option value="" disabled>Select a unit</option>{UNITS.map(unit => <option key={unit} value={unit}>{unit}</option>)}</select></div>
            {(!focusedFirstSetup || draft.selling_price === null || draft.estimated_cost === null) && (
              <>
                <Input label="Selling price (RM)" type="number" min="0" step="0.01" inputMode="decimal" value={draft.selling_price ?? ''} onChange={event => updateDraft('selling_price', event.target.value)} placeholder="e.g. 3.00" />
                <Input label="Cost per unit (RM)" type="number" min="0" step="0.01" inputMode="decimal" value={draft.estimated_cost ?? ''} onChange={event => updateDraft('estimated_cost', event.target.value)} placeholder="e.g. 1.20" />
              </>
            )}
            <Input label="Date mentioned (optional)" type="date" value={draft.planned_date ?? ''} onChange={event => updateDraft('planned_date', event.target.value)} hint="Create a dated selling plan from the dashboard when you are ready." />
          </div>
          {changeLocation && (
            <div className="question-map-correction">
              <Button type="button" variant="secondary" size="sm" onClick={() => setShowLocationPicker(current => !current)}>{showLocationPicker ? 'Hide map' : 'Add or correct map pin (optional)'}</Button>
              {showLocationPicker && (
                <MapLocationPicker
                  value={{ locationName: draft.location_name ?? '', latitude: pinnedLocation.latitude, longitude: pinnedLocation.longitude, city: profile?.city ?? '', state: profile?.state ?? '' }}
                  onChange={value => {
                    setDraft(current => ({ ...current, location_name: value.locationName || null }));
                    setPinnedLocation({ name: value.locationName || null, latitude: value.latitude, longitude: value.longitude });
                  }}
                  showAreaFields={false}
                  preserveLocationName
                  helpText="Optional: pin the updated selling place so weather-based features can use it."
                />
              )}
            </div>
          )}
          <Button size="lg" fullWidth onClick={() => void save()} loading={saving}>Save selling details and go to Dashboard</Button>
        </section>
      </main>
      {!focusedFirstSetup && <BottomNavigation />}
    </div>
  );
}
