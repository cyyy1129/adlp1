// ============================================================
// Main AI-guided selling-plan conversation.
// Confirmations update local draft state only; Supabase is written once
// the seller explicitly saves the final confirmed plan.
// ============================================================

import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Button from '../components/Button';
import MapLocationPicker from '../components/MapLocationPicker';
import ChatMessage from '../components/planning/ChatMessage';
import ConfirmationCard from '../components/planning/ConfirmationCard';
import VoiceInput from '../components/planning/VoiceInput';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../hooks/useLanguage';
import { extractPlanningInput } from '../services/ai/aiService';
import { extractLocationSuggestion } from '../services/ai/extraction';
import { formatSchedule, getFoodOptions, getMissingInfoMessage, getProgress, getQuestion, getRetryMessage, isPlanComplete } from '../services/ai/conversation';
import { getSellerFoods, saveSellingPlan } from '../services/planningService';
import { getSellerSetup, hasSetup, malaysiaToday, type SellerSetup } from '../services/sellingSetupService';
import type { SellerFood } from '../types/database';
import type { FoodOption, FoodSelection, PlanningDraft, PlanningStep, SellingLocation, SellingSchedule } from '../types/planning';

interface ChatLine {
  id: number;
  role: 'assistant' | 'user';
  text: string;
}

type PendingConfirmation =
  | { field: 'schedule'; value: SellingSchedule }
  | { field: 'location'; value: SellingLocation }
  | { field: 'food'; value: FoodSelection };

const EMPTY_DRAFT: PlanningDraft = {
  schedule: null,
  location: null,
  food: null,
};

function getInputPlaceholder(step: PlanningStep): string {
  if (step === 'ASK_SCHEDULE') return 'e.g. This Saturday from 5pm to 10pm';
  if (step === 'ASK_LOCATION') return 'e.g. Bazar Ramadan Kg Baru';
  return 'Type the food name';
}

export default function Planning() {
  const { user, profile, logout, supabaseConfigured } = useAuth();
  const { lang, toggleLanguage, t } = useLanguage();
  const [step, setStep] = useState<PlanningStep>('ASK_SCHEDULE');
  const [draft, setDraft] = useState<PlanningDraft>(EMPTY_DRAFT);
  const [pending, setPending] = useState<PendingConfirmation | null>(null);
  const [messages, setMessages] = useState<ChatLine[]>([]);
  const [sellerFoods, setSellerFoods] = useState<SellerFood[]>([]);
  const [savedSetup, setSavedSetup] = useState<SellerSetup | null>(null);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [customFoodMode, setCustomFoodMode] = useState(false);
  const [flowNotice, setFlowNotice] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedPlanId, setSavedPlanId] = useState<string | null>(null);
  const [suggestedLocation, setSuggestedLocation] = useState<string | null>(null);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const nextMessageId = useRef(0);
  const initialised = useRef(false);

  const foodOptions = useMemo(() => getFoodOptions(profile, sellerFoods), [profile, sellerFoods]);
  const progress = getProgress(step);
  const acceptsText = step === 'ASK_SCHEDULE' || step === 'ASK_LOCATION' || (step === 'ASK_FOOD' && customFoodMode);

  function appendMessage(role: ChatLine['role'], text: string) {
    nextMessageId.current += 1;
    setMessages(current => [...current, { id: nextMessageId.current, role, text }]);
  }

  function ask(nextStep: 'ASK_SCHEDULE' | 'ASK_LOCATION' | 'ASK_FOOD', suggestedAnswer = '') {
    setInput(suggestedAnswer);
    setStep(nextStep);
    const question = nextStep === 'ASK_LOCATION' && suggestedAnswer
      ? `I also heard “${suggestedAnswer}”. Please confirm or edit the selling location.`
      : getQuestion(nextStep, lang, foodOptions, profile);
    appendMessage('assistant', question);
  }

  useEffect(() => {
    if (initialised.current || (supabaseConfigured && !profile)) return;
    initialised.current = true;
    appendMessage('assistant', lang === 'ms'
      ? 'Hai! Saya akan bantu anda merancang satu sesi jualan ringkas.'
      : 'Hi! I’ll help you set up one simple selling session.');
    appendMessage('assistant', getQuestion('ASK_SCHEDULE', lang, foodOptions, profile));
    // The welcome must be created once only; later profile/food changes should not repeat it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, supabaseConfigured]);

  useEffect(() => {
    if (!user) return;
    let isCurrent = true;
    void Promise.all([getSellerFoods(user.id), getSellerSetup(user.id)]).then(([foodsResult, setupResult]) => {
      if (!isCurrent) return;
      if (foodsResult.error) setFlowNotice('Saved food items could not be loaded. Your onboarding choices are still available.');
      if (setupResult.error) setFlowNotice('Your saved setup could not be loaded. You can still plan this session manually.');
      setSellerFoods(foodsResult.data);
      setSavedSetup(setupResult.data);
    });
    return () => { isCurrent = false; };
  }, [user]);

  const useConfirmedSetup = Boolean(
    profile?.daily_location_confirmed_on === malaysiaToday()
    && hasSetup(savedSetup)
  );

  async function handleRawAnswer(rawInput: string, fromVoice = false) {
    const value = rawInput.trim();
    if (!value || isProcessing || !acceptsText) return;
    const activeStep = step;
    const field = activeStep === 'ASK_SCHEDULE' ? 'schedule' : activeStep === 'ASK_LOCATION' ? 'location' : 'food';

    appendMessage('user', fromVoice ? `🎙️ ${value}` : value);
    setInput('');
    setIsProcessing(true);
    setFlowNotice(null);

    const result = await extractPlanningInput({ field, input: value });
    setIsProcessing(false);

    if (result.fallbackNotice) setFlowNotice(result.fallbackNotice);
    if (result.error || !result.data) {
      appendMessage('assistant', getMissingInfoMessage(result.missing, result.error, lang));
      return;
    }

    if (field === 'schedule') {
      setSuggestedLocation(extractLocationSuggestion(value));
      setPending({ field, value: result.data as SellingSchedule });
      setStep('CONFIRM_SCHEDULE');
      appendMessage('assistant', lang === 'ms' ? 'Saya dengar perkara ini. Sila semak sebelum saya teruskan.' : 'Here’s what I understood. Please check it before I continue.');
    } else if (field === 'location') {
      setPending({ field, value: result.data as SellingLocation });
      setShowLocationPicker(false);
      setStep('CONFIRM_LOCATION');
      appendMessage('assistant', lang === 'ms' ? 'Sila sahkan lokasi ini.' : 'Please confirm this location.');
    } else {
      setPending({ field, value: result.data as FoodSelection });
      setStep('CONFIRM_FOOD');
      appendMessage('assistant', lang === 'ms' ? 'Sila sahkan makanan ini.' : 'Please confirm this food.');
    }
  }

  function selectFood(option: FoodOption) {
    if (isProcessing) return;
    appendMessage('user', option.food_name);
    setPending({ field: 'food', value: option });
    setCustomFoodMode(false);
    setStep('CONFIRM_FOOD');
    appendMessage('assistant', lang === 'ms' ? 'Sila sahkan makanan ini.' : 'Please confirm this food.');
  }

  function confirmPending() {
    if (!pending) return;

    if (pending.field === 'schedule') {
      const schedule = pending.value;
      setPending(null);
      if (useConfirmedSetup && savedSetup?.seller_food_id && savedSetup.location_name && savedSetup.food_name && savedSetup.food_category) {
        setDraft({
          schedule,
          location: {
            location_name: savedSetup.location_name,
            latitude: savedSetup.latitude,
            longitude: savedSetup.longitude,
          },
          food: {
            seller_food_id: savedSetup.seller_food_id,
            food_name: savedSetup.food_name,
            food_category: savedSetup.food_category,
          },
        });
        setStep('PLAN_READY');
        appendMessage('assistant', lang === 'ms'
          ? 'Saya akan menggunakan lokasi dan makanan tersimpan anda untuk sesi ini. Sila semak pelan sebelum menyimpan.'
          : 'I’ll use your confirmed saved location and food for this session. Please review the plan before saving.');
        return;
      }
      setDraft(current => ({ ...current, schedule }));
      ask('ASK_LOCATION', suggestedLocation ?? '');
      return;
    }
    if (pending.field === 'location') {
      setDraft(current => ({ ...current, location: pending.value }));
      setPending(null);
      ask('ASK_FOOD');
      return;
    }

    setDraft(current => ({ ...current, food: pending.value }));
    setPending(null);
    setStep('PLAN_READY');
    appendMessage('assistant', lang === 'ms'
      ? 'Semua maklumat penting sudah disahkan. Sila semak pelan anda sebelum menyimpannya.'
      : 'All the important details are confirmed. Please review your plan before saving it.');
  }

  function editPending() {
    if (!pending) return;
    const field = pending.field;
    setPending(null);
    setShowLocationPicker(false);
    setCustomFoodMode(field === 'food');
    if (field === 'schedule') ask('ASK_SCHEDULE');
    if (field === 'location') ask('ASK_LOCATION');
    if (field === 'food') ask('ASK_FOOD');
    appendMessage('assistant', getRetryMessage(lang));
  }

  function updatePendingLocation(value: { locationName: string; latitude: number | null; longitude: number | null }) {
    setPending(current => {
      if (!current || current.field !== 'location') return current;
      return {
        field: 'location',
        value: {
          location_name: value.locationName.trim() || current.value.location_name,
          latitude: value.latitude,
          longitude: value.longitude,
        },
      };
    });
  }

  async function handleSave() {
    if (!isPlanComplete(draft)) {
      setSaveError('Please confirm every detail before saving.');
      return;
    }
    if (!user) {
      setSaveError('This no-sign-in preview keeps your onboarding choices in this browser. Saving selling plans requires a connected Supabase seller account.');
      return;
    }
    setSaveError(null);
    setIsSaving(true);
    setStep('SAVING');
    const { data, error } = await saveSellingPlan(user.id, draft);
    setIsSaving(false);

    if (error || !data) {
      setSaveError(error ?? 'Your plan could not be saved. Please try again.');
      setStep('PLAN_READY');
      return;
    }

    setSavedPlanId(data.planId);
    setStep('COMPLETE');
    appendMessage('assistant', lang === 'ms' ? 'Pelan jualan anda sudah disimpan.' : 'Your selling plan has been saved.');
  }

  function editFinalPlan() {
    setSaveError(null);
    ask('ASK_SCHEDULE');
  }

  return (
    <div className="planning-page">
      <header className="dashboard-header">
        <div className="dashboard-header-left">
          <span className="brand-icon-sm" aria-hidden="true">🍜</span>
          <span className="brand-name-sm">{t.appName}</span>
        </div>
        <div className="dashboard-header-right">
          <button className="lang-toggle" onClick={toggleLanguage} title="Toggle language" aria-label="Toggle application language">
            {lang === 'en' ? '🇬🇧 EN' : '🇲🇾 BM'}
          </button>
          {profile && <Link to="/profile" className="header-profile-link">Profile</Link>}
          {user && <Button variant="ghost" size="sm" onClick={logout}>{t.logout}</Button>}
        </div>
      </header>

      <main className="planning-shell">
        <section className="planning-heading">
          <p className="planning-eyebrow">SELLING SESSION</p>
          <h1>{lang === 'ms' ? 'Rancang jualan anda' : 'Plan your selling session'}</h1>
          <p>{lang === 'ms' ? 'Jawab beberapa soalan ringkas. Anda boleh menaip atau bercakap.' : 'Answer a few short questions. You can type or speak.'}</p>
        </section>

        {!supabaseConfigured && (
          <div className="alert alert-warning planning-alert">
            <span className="alert-icon">⚠️</span>
            <span>Supabase is not configured. You can try the conversation, but saving is unavailable.</span>
          </div>
        )}
        {flowNotice && <div className="alert alert-warning planning-alert"><span className="alert-icon">⚠️</span><span>{flowNotice}</span></div>}

        <div className="planning-progress" aria-label={`Step ${progress} of 3`}>
          {['Date & time', 'Location', 'Food'].map((label, index) => (
            <div key={label} className={`planning-progress-step ${index + 1 <= progress ? 'planning-progress-active' : ''}`}>
              <span>{index + 1}</span><small>{label}</small>
            </div>
          ))}
        </div>

        <section className="planning-chat" aria-live="polite">
          {messages.map(message => (
            <ChatMessage key={message.id} role={message.role}>{message.text}</ChatMessage>
          ))}

          {isProcessing && <ChatMessage role="assistant"><span className="planning-thinking">Extracting the details…</span></ChatMessage>}

          {step === 'CONFIRM_SCHEDULE' && pending?.field === 'schedule' && (
            <ConfirmationCard title={lang === 'ms' ? 'Butiran sesi' : 'Session details'} onConfirm={confirmPending} onEdit={editPending}>
              <strong>{formatSchedule(pending.value, lang)}</strong>
            </ConfirmationCard>
          )}

          {step === 'CONFIRM_LOCATION' && pending?.field === 'location' && (
            <ConfirmationCard title={lang === 'ms' ? 'Lokasi jualan' : 'Selling location'} onConfirm={confirmPending} onEdit={editPending}>
              <strong>{pending.value.location_name}</strong>
              {pending.value.latitude !== null && pending.value.longitude !== null ? (
                <span className="planning-confirmation-hint">Map pin added. Weather can use this location.</span>
              ) : (
                <span className="planning-confirmation-hint">A map pin is optional, but lets us check real weather for this session.</span>
              )}
              {!showLocationPicker && pending.value.latitude === null && pending.value.longitude === null && (
                <Button type="button" variant="secondary" size="sm" onClick={() => setShowLocationPicker(true)}>Add map pin</Button>
              )}
              {showLocationPicker && (
                <div className="planning-location-picker">
                  <MapLocationPicker
                    value={{
                      locationName: pending.value.location_name,
                      latitude: pending.value.latitude,
                      longitude: pending.value.longitude,
                      city: profile?.city ?? '',
                      state: profile?.state ?? '',
                    }}
                    onChange={updatePendingLocation}
                    showAreaFields={false}
                    preserveLocationName
                    helpText="Tap your actual selling spot to add coordinates. We will not guess a location if you skip this."
                  />
                </div>
              )}
            </ConfirmationCard>
          )}

          {step === 'ASK_FOOD' && (
            <div className="planning-food-options" aria-label="Food choices">
              {foodOptions.map(option => (
                <button type="button" key={`${option.food_category}-${option.food_name}`} className="planning-food-option" onClick={() => selectFood(option)}>
                  <span>🍽️</span>
                  <span>{foodOptions.length === 1 ? `Yes, ${option.food_name}` : option.food_name}</span>
                </button>
              ))}
              {!customFoodMode && (
                <button type="button" className="planning-food-option planning-food-option-secondary" onClick={() => setCustomFoodMode(true)}>
                  <span>＋</span><span>{foodOptions.length ? 'Different food' : 'Add food'}</span>
                </button>
              )}
            </div>
          )}

          {step === 'CONFIRM_FOOD' && pending?.field === 'food' && (
            <ConfirmationCard title={lang === 'ms' ? 'Makanan untuk dijual' : 'Food to sell'} onConfirm={confirmPending} onEdit={editPending}>
              <strong>{pending.value.food_name}</strong>
              <span className="planning-confirmation-hint">{pending.value.food_category}</span>
            </ConfirmationCard>
          )}

          {step === 'PLAN_READY' && isPlanComplete(draft) && (
            <section className="planning-summary" aria-label="Confirmed selling plan">
              <p className="planning-confirmation-label">{lang === 'ms' ? 'Pelan anda' : 'Your confirmed plan'}</p>
              <dl>
                <div><dt>Date & time</dt><dd>{formatSchedule(draft.schedule!, lang)}</dd></div>
                <div><dt>Location</dt><dd>{draft.location!.location_name}</dd></div>
                <div><dt>Food</dt><dd>{draft.food!.food_name}</dd></div>
              </dl>
              {saveError && <p className="planning-save-error" role="alert">{saveError}</p>}
              <div className="planning-confirmation-actions">
                <Button onClick={handleSave} loading={isSaving}>Save selling plan</Button>
                <Button variant="secondary" onClick={editFinalPlan}>Edit a detail</Button>
              </div>
            </section>
          )}

          {step === 'SAVING' && <div className="planning-saving">Saving your confirmed plan…</div>}

          {step === 'COMPLETE' && (
            <section className="planning-complete">
              <div className="success-icon">✓</div>
              <h2>{lang === 'ms' ? 'Pelan disimpan' : 'Plan saved'}</h2>
              <p>{lang === 'ms' ? 'Sesi jualan anda sedia untuk langkah seterusnya.' : 'Your selling session is ready for the next step.'}</p>
              {savedPlanId && <span className="planning-plan-id">Plan reference: {savedPlanId.slice(0, 8)}</span>}
              {savedPlanId && (
                <Link to={`/plans/${savedPlanId}/recommendation`} className="planning-forecast-link">
                  <Button size="md">View demand estimate</Button>
                </Link>
              )}
            </section>
          )}
        </section>

        {acceptsText && (
          <section className="planning-composer" aria-label="Answer the current question">
            <VoiceInput language={lang} onTranscript={transcript => { void handleRawAnswer(transcript, true); }} disabled={isProcessing} />
            <form onSubmit={event => { event.preventDefault(); void handleRawAnswer(input); }} className="planning-text-form">
              <input
                className="planning-text-input"
                value={input}
                onChange={event => setInput(event.target.value)}
                placeholder={getInputPlaceholder(step)}
                disabled={isProcessing}
                aria-label="Type your answer"
              />
              <Button type="submit" disabled={!input.trim() || isProcessing}>Send</Button>
            </form>
          </section>
        )}
      </main>
    </div>
  );
}
