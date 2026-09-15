// ============================================================
// One-shot voice/text seller setup page (Demo Safe Edition)
// ============================================================

import { useState } from 'react';
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
  EMPTY_DETAILS,
  extractSellingSetupFollowUp,
  getMissingSetupFields,
  mergeSellingSetup,
  type SellingSetupDetails,
  type SellingSetupField,
} from '../services/ai/sellingSetupExtraction';
import { inferFoodCategory, saveSellerSetup } from '../services/sellingSetupService';

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

function normaliseUnit(value: string | null | undefined): string | null | undefined {
  if (!value) return value;
  const unit = value.trim().toLowerCase();
  if (['pack', 'packs', 'package', 'packages', 'bungkus', 'pek'].includes(unit)) return 'packages';
  if (['portion', 'portions', 'serving', 'servings'].includes(unit)) return 'portions';
  if (['bowl', 'bowls', 'mangkuk'].includes(unit)) return 'bowls';
  if (['piece', 'pieces', 'pc', 'pcs', 'biji'].includes(unit)) return 'pieces';
  if (['set', 'sets'].includes(unit)) return 'sets';
  if (['kilogram', 'kilograms'].includes(unit)) return 'kg';
  if (['litre', 'liter', 'liters'].includes(unit)) return 'litres';
  return unit;
}

export default function Question() {
  const { user, profile, refreshProfile, supabaseConfigured } = useAuth();
  const { lang } = useLanguage();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const changeLocation = searchParams.get('mode') === 'change';

  const [draft, setDraft] = useState<SellingSetupDetails>(EMPTY_DETAILS);

  const [pinnedLocation, setPinnedLocation] = useState<{ name: string | null; latitude: number | null; longitude: number | null }>({ name: null, latitude: null, longitude: null });
  const [processing, setProcessing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [answer, setAnswer] = useState('');
  const [transcript, setTranscript] = useState<string | null>(null);
  const [followUp, setFollowUp] = useState<string | null>(null);
  const [hasAnswered, setHasAnswered] = useState(false);
  const canReuseSavedDetails = false;
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const focusedFirstSetup = !changeLocation && !profile?.voice_setup_completed_at;

  function applyAnswer(raw: string) {
    const value = raw.trim();
    if (!value || processing) return;
    setProcessing(true);
    setError(null);
    const fieldsRequested = changeLocation && canReuseSavedDetails
      ? getMissingSetupFields(draft).filter(field => field === 'location')
      : getMissingSetupFields(draft);
    const extracted = extractSellingSetupFollowUp(value, fieldsRequested);
    const normalisedExtraction = { ...extracted, unit: normaliseUnit(extracted.unit) };
    setDraft(previous => {
      const next = mergeSellingSetup(previous, normalisedExtraction);
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
    if (!hasAnswered) {
      setError('Please type or record your selling details before continuing.');
      return;
    }

    const missing = getMissingSetupFields(draft);
    if (missing.length > 0) {
      setFollowUp(`I still need your ${humanizeFields(missing)}. Please add it before continuing.`);
      setError('Please complete the missing selling details before saving.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      if (user && supabaseConfigured) {
        // 1. We now capture the error returned from your database
        const { error: saveError } = await saveSellerSetup(user.id, {
          location_name: draft.location_name!,
          latitude: pinnedLocation.name === draft.location_name ? pinnedLocation.latitude : null,
          longitude: pinnedLocation.name === draft.location_name ? pinnedLocation.longitude : null,
          food_name: draft.food_name!,
          food_category: inferFoodCategory(draft.food_name!, profile?.food_categories),
          quantity: draft.quantity!,
          unit: draft.unit!,
          selling_price: draft.selling_price!,
          estimated_cost: draft.estimated_cost!,
        });

        // 2. If the database rejects it, SHOW the error and STOP the redirect
        if (saveError) {
          setError(`Save failed: ${saveError}`);
          setSaving(false);
          return;
        }

        await refreshProfile();
      } else {
        setError("Error: You are not logged in or Supabase is not connected.");
        setSaving(false);
        return;
      }
    } catch (err) {
      console.warn('Could not save seller setup', err);
      setError('We could not save your details right now. Please try again.');
      setSaving(false);
      return;
    }

    // 3. Only redirect to the dashboard if it actually saved successfully!
    navigate('/dashboard', { replace: true });
  }
  const primaryPrompt = changeLocation && canReuseSavedDetails ? 'Where are you selling today? You can also tell me if your food or preparation quantity has changed.' : focusedFirstSetup ? 'Tell me about your selling plan: where you will sell, what food you are selling, and approximately how many portions or packages you plan to prepare. For example: "I’ll sell nasi lemak at Kampung Baru this Saturday and prepare around 100 packs."' : 'Tell me where you are selling, what food you are selling, and approximately how many portions or packages you plan to prepare. For example: "I’ll sell nasi lemak at Kampung Baru this Saturday and prepare around 100 packs."'; const visiblePrompt = hasAnswered && followUp ? followUp : primaryPrompt;


  return (
    <div className={`question-page ${focusedFirstSetup ? 'question-page-focused' : 'app-page-with-nav'}`}>
      <main className="question-shell">
        <p className="planning-eyebrow">{focusedFirstSetup ? 'FIRST VOICE SETUP' : 'VOICE INPUT'}</p>
        <h1>{changeLocation ? 'Update today’s selling place' : focusedFirstSetup ? 'Tell Bleu about your first session' : 'Update your selling details'}</h1>
        <p className="question-intro">{visiblePrompt}</p>

        <Card variant="glass" padding="lg" className="question-card">
          <div className="question-voice-row">
            <VoiceInput language={lang} onTranscript={applyAnswer} disabled={processing || saving} />
            <div><strong>{processing ? 'Understanding your answer…' : hasAnswered ? 'Speak only the missing detail' : 'Speak one natural answer'}</strong><span>Voice is optional — you can always type instead.</span></div>
          </div>
          <div className="question-answer-form">
            <textarea className="setup-answer-input" aria-label="Your voice or text answer" value={answer} onChange={event => setAnswer(event.target.value)} rows={4} placeholder="e.g. I’ll sell nasi lemak at Kampung Baru this Saturday. I’ll prepare around 110 packs, sell each for RM8, and my cost is RM4." />
            <Button type="button" onClick={() => applyAnswer(answer)} disabled={!answer.trim() || processing || saving}>Use my answer</Button>
          </div>
          {transcript && (
            <section className="question-transcript" aria-live="polite">
              <span>Transcript</span>
              <p>{transcript}</p>
              <Button type="button" variant="ghost" size="sm" onClick={() => { setAnswer(transcript); setTranscript(null); setDraft(EMPTY_DETAILS); setFollowUp(null); setHasAnswered(false); }}>Edit transcript</Button>
            </section>
          )}
          {error && <div className="alert alert-error question-alert"><span className="alert-icon">!</span><span>{error}</span></div>}
          {followUp && <div className="question-followup" role="status"><strong>Almost there</strong><p>Only the requested detail is needed now.</p></div>}
        </Card>

        {hasAnswered && <section className="question-details" aria-label="Extracted selling details">
          <div className="question-details-heading"><h2>Check the details</h2><p>You can correct anything before saving.</p></div>
          <div className="question-details-grid">
            <Input label="Selling location" value={draft.location_name ?? ''} onChange={event => updateDraft('location_name', event.target.value)} placeholder="e.g. Kampung Baru" />
            <Input label="Food" value={draft.food_name ?? ''} onChange={event => updateDraft('food_name', event.target.value)} placeholder="e.g. Nasi lemak" />
            <Input label="Quantity" type="number" min="0" inputMode="decimal" value={draft.quantity ?? ''} onChange={event => updateDraft('quantity', event.target.value)} placeholder="e.g. 110" />
            <div className="input-group"><label className="input-label" htmlFor="question-unit">Unit / package</label><select id="question-unit" className="input-field" value={draft.unit ?? ''} onChange={event => updateDraft('unit', event.target.value)}><option value="" disabled>Select a unit</option>{UNITS.map(unit => <option key={unit} value={unit}>{unit}</option>)}</select></div>
            <Input label="Selling price (RM)" type="number" min="0" step="0.01" inputMode="decimal" value={draft.selling_price ?? ''} onChange={event => updateDraft('selling_price', event.target.value)} placeholder="e.g. 3.00" />
            <Input label="Cost per unit (RM)" type="number" min="0" step="0.01" inputMode="decimal" value={draft.estimated_cost ?? ''} onChange={event => updateDraft('estimated_cost', event.target.value)} placeholder="e.g. 1.20" />
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
        </section>}
      </main>
      {!focusedFirstSetup && <BottomNavigation />}
    </div>
  );
}
