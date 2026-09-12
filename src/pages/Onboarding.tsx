// ============================================================
// One-time, four-step seller onboarding (Demo Safe Edition)
// ============================================================

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../components/Button';
import Card from '../components/Card';
import Input from '../components/Input';
import StepIndicator from '../components/StepIndicator';
import VoiceInput from '../components/planning/VoiceInput';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../hooks/useLanguage';
import { extractSellingHistory } from '../services/ai/sellingSetupExtraction';
import { saveLocalOnboarding } from '../services/localOnboardingService';
import { completeOnboarding } from '../services/profileService';
import { inferFoodCategory } from '../services/sellingSetupService';
import { FOOD_CATEGORIES } from '../lib/utils';

const UNITS = ['packages', 'portions', 'bowls', 'pieces', 'sets', 'kg', 'litres', 'other'] as const;

// MVP location choices for the onboarding selector. The selected bazaar name
// is saved with its state and city; coordinates stay empty until a map-based
// location selection is used elsewhere in the product.
const BAZAAR_OPTIONS: Record<string, Record<string, string[]>> = {
  'Kuala Lumpur': { 'Kuala Lumpur': ['Bazaar Ramadan Kampung Baru', 'Chow Kit Market'] },
  Selangor: { 'Shah Alam': ['Bazaar Ramadan Stadium Shah Alam'], 'Petaling Jaya': ['SS2 Night Market'] },
  Perak: { Kampar: ['Kampar Night Market'], Ipoh: ['Bazaar Ramadan Stadium Perak'] },
  Penang: { 'George Town': ['Batu Ferringhi Night Market'], 'Seberang Perai': ['Bazaar Ramadan Seberang Jaya'] },
  Johor: { 'Johor Bahru': ['Angsana Johor Bahru Night Market'] },
  Melaka: { 'Melaka City': ['Jonker Walk Night Market'] },
  Kelantan: { 'Kota Bharu': ['Pasar Siti Khadijah area'] },
  Terengganu: { 'Kuala Terengganu': ['Pasar Payang area'] },
  Kedah: { 'Alor Setar': ['Stadium Darul Aman area'] },
  Pahang: { Kuantan: ['Kuantan Ramadan Bazaar'] },
  'Negeri Sembilan': { Seremban: ['Seremban Ramadan Bazaar'] },
  Perlis: { Kangar: ['Kangar Ramadan Bazaar'] },
  Sabah: { 'Kota Kinabalu': ['Gaya Street Market'] },
  Sarawak: { Kuching: ['Kuching Waterfront area'] },
  Putrajaya: { Putrajaya: ['Presint 3 Ramadan Bazaar'] },
  Labuan: { Labuan: ['Labuan Ramadan Bazaar'] },
};

export default function Onboarding() {
  const { user, refreshProfile } = useAuth();
  const { lang, setLanguage, t } = useLanguage();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [selectedFoods, setSelectedFoods] = useState<string[]>(['Drinks']); // 默认选一个，方便Demo
  const [customFood, setCustomFood] = useState('');
  const [locationName, setLocationName] = useState('Bazaar Ramadan Kampung Baru');
  const [state, setState] = useState('Kuala Lumpur');
  const [city, setCity] = useState('Kuala Lumpur');
  const [quantity, setQuantity] = useState('110');
  const [unit, setUnit] = useState('cups');
  const [foodName, setFoodName] = useState('Drinks');
  const [sellingPrice, setSellingPrice] = useState('3.00');
  const [estimatedCost, setEstimatedCost] = useState('1.20');
  const [historyAnswer, setHistoryAnswer] = useState('');
  const [historyNotice, setHistoryNotice] = useState<string | null>(null);
  const [preferredLang, setPreferredLang] = useState<'en' | 'ms'>(lang);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // 🏆 彻底移除所有可能导致闪退的 profile?.onboarding_completed 拦截！

  const steps = [
    { label: 'Food', icon: '🍜' },
    { label: 'Location', icon: '📍' },
    { label: 'Business', icon: '🧾' },
    { label: 'Language', icon: '🌐' },
  ];

  function toggleFood(category: string) {
    setSelectedFoods(current => current.includes(category)
      ? current.filter(item => item !== category)
      : [...current, category]);
  }

  function getResolvedFoodName(): string {
    return foodName.trim() || (selectedFoods.includes('Others') ? customFood.trim() : 'Drinks');
  }

  function applyHistoryAnswer(answer: string) {
    setHistoryAnswer(answer);
    try {
      const extracted = extractSellingHistory(answer);
      if (extracted.food_name) setFoodName(extracted.food_name);
      if (extracted.quantity !== null) setQuantity(String(extracted.quantity));
      if (extracted.unit) setUnit(extracted.unit);
      if (extracted.selling_price !== null) setSellingPrice(String(extracted.selling_price));
      if (extracted.estimated_cost !== null) setEstimatedCost(String(extracted.estimated_cost));
      setHistoryNotice('I filled in your usual selling details. Please check them before continuing.');
    } catch {
      setHistoryNotice('Could not parse voice automatically. You can fill the fields manually below.');
    }
  }

  function canProceed(): boolean {
    return true; // 🏆 Demo 期间解除所有禁用限制，确保 Next 按钮永远可点！
  }

  async function finishOnboarding() {
    setError('');
    setSaving(true);
    const onboardingData = {
      food_categories: selectedFoods,
      custom_food_name: selectedFoods.includes('Others') ? customFood.trim() : null,
      state: state || 'Kuala Lumpur',
      city: city || 'Kuala Lumpur',
      default_location_name: locationName.trim() || 'Bazar Ramadan Kampung Baru',
      default_latitude: null,
      default_longitude: null,
      onboarding_usual_quantity: Number(quantity) || 110,
      onboarding_unit: unit || 'cups',
      onboarding_selling_price: Number(sellingPrice) || 3,
      onboarding_estimated_cost: Number(estimatedCost) || 1.2,
      food_name: getResolvedFoodName(),
      food_category: inferFoodCategory(getResolvedFoodName(), selectedFoods),
      preferred_language: preferredLang,
    };

    try {
      if (!user) {
        saveLocalOnboarding(onboardingData);
      } else {
        await completeOnboarding(user.id, onboardingData);
      }
      setLanguage(preferredLang);
      if (user) await refreshProfile();
    } catch (err) {
      console.warn('Onboarding completion warning (bypassed for demo):', err);
    } finally {
      setSaving(false);
      navigate('/dashboard', { replace: true }); // 🏆 改为直接去 dashboard 或 question
    }
  }

  function next() {
    setError('');
    if (step < steps.length - 1) setStep(current => current + 1);
    else void finishOnboarding();
  }

  const citiesForSelectedState = Object.keys(BAZAAR_OPTIONS[state] ?? {});
  const bazaarsForSelectedCity = BAZAAR_OPTIONS[state]?.[city] ?? [];

  function selectState(nextState: string) {
    const nextCity = Object.keys(BAZAAR_OPTIONS[nextState] ?? {})[0] ?? '';
    const nextBazaar = BAZAAR_OPTIONS[nextState]?.[nextCity]?.[0] ?? '';
    setState(nextState);
    setCity(nextCity);
    setLocationName(nextBazaar);
  }

  function selectCity(nextCity: string) {
    const nextBazaar = BAZAAR_OPTIONS[state]?.[nextCity]?.[0] ?? '';
    setCity(nextCity);
    setLocationName(nextBazaar);
  }

  const foodIcons: Record<string, string> = {
    Noodles: '🍜',
    'Rice dishes': '🍚',
    Desserts: '🍰',
    Snacks: '🥟',
    'Grilled food': '🍢',
    Bakery: '🥖',
    Others: '✳️',
  };

  return (
    <div className="onboarding-page">
      <div className="onboarding-container">
        <div className="onboarding-header">
          <p className="planning-eyebrow">GET STARTED</p>
          <h1>Tell us a little about your stall</h1>
          <p>Four short steps, then you can set up your selling details with voice or text.</p>
        </div>

        <StepIndicator steps={steps} currentStep={step} />
        <Card variant="glass" padding="lg" className="onboarding-card">
          {error && <div className="alert alert-error"><span className="alert-icon">!</span><span>{error}</span></div>}

          {step === 0 && (
            <section className="onboarding-step">
              <h2 className="step-title">What type of food do you sell?</h2>
              <p className="step-subtitle">Choose the food categories that best describe your stall.</p>
              <div className="food-grid">
                {FOOD_CATEGORIES.map(category => (
                  <button
                    key={category}
                    type="button"
                    aria-pressed={selectedFoods.includes(category)}
                    className={`food-chip ${selectedFoods.includes(category) ? 'food-chip-selected' : ''}`}
                    onClick={() => toggleFood(category)}
                  >
                    <span className="food-chip-icon">{foodIcons[category] || '🍽️'}</span>
                    <span className="food-chip-label">{category}</span>
                  </button>
                ))}
              </div>
              {selectedFoods.includes('Others') && (
                <div className="custom-food-input">
                  <Input label="What food do you sell?" value={customFood} onChange={event => setCustomFood(event.target.value)} placeholder="e.g. Apam balik" />
                </div>
              )}
            </section>
          )}

          {step === 1 && (
            <section className="onboarding-step">
              <h2 className="step-title">Where do you usually sell?</h2>
              <p className="step-subtitle">Choose your state, city, and usual bazaar.</p>
              <div className="onboarding-location-selector">
                <div className="onboarding-location-grid">
                  <div className="input-group">
                    <label className="input-label" htmlFor="onboarding-state">State</label>
                    <select id="onboarding-state" className="input-field select-field" value={state} onChange={event => selectState(event.target.value)}>
                      {Object.keys(BAZAAR_OPTIONS).map(option => <option key={option} value={option}>{option}</option>)}
                    </select>
                  </div>
                  <div className="input-group">
                    <label className="input-label" htmlFor="onboarding-city">City</label>
                    <select id="onboarding-city" className="input-field select-field" value={city} onChange={event => selectCity(event.target.value)}>
                      {citiesForSelectedState.map(option => <option key={option} value={option}>{option}</option>)}
                    </select>
                  </div>
                </div>
                <div className="input-group">
                  <label className="input-label" htmlFor="onboarding-bazaar">Bazaar / market</label>
                  <select id="onboarding-bazaar" className="input-field select-field" value={locationName} onChange={event => setLocationName(event.target.value)}>
                    {bazaarsForSelectedCity.map(option => <option key={option} value={option}>{option}</option>)}
                  </select>
                </div>
              </div>
            </section>
          )}

          {step === 2 && (
            <section className="onboarding-step">
              <h2 className="step-title">Tell us about your usual selling</h2>
              <p className="step-subtitle">You can speak one sentence, for example: “I sell drinks. I usually prepare 110 cups, sell each for RM3, and my cost is RM1.20.”</p>
              <div className="onboarding-voice-row">
                <VoiceInput language={preferredLang} onTranscript={applyHistoryAnswer} disabled={saving} />
                <div className="onboarding-voice-copy"><strong>Prefer typing?</strong><span>Type your usual selling details below and use the answer.</span></div>
              </div>
              <div className="setup-answer-row">
                <textarea className="setup-answer-input" aria-label="Describe your usual selling information" value={historyAnswer} onChange={event => setHistoryAnswer(event.target.value)} placeholder="e.g. I sell drinks, prepare 110 cups, RM3 each" rows={3} />
                <Button type="button" variant="secondary" onClick={() => applyHistoryAnswer(historyAnswer)} disabled={!historyAnswer.trim()}>Use answer</Button>
              </div>
              {historyNotice && <p className="setup-answer-notice" role="status">{historyNotice}</p>}
              <div className="onboarding-business-grid">
                <Input label="Main food / item" value={foodName} onChange={event => setFoodName(event.target.value)} placeholder="e.g. Drinks" />
                <Input label="Usual quantity" type="number" min="0" inputMode="decimal" value={quantity} onChange={event => setQuantity(event.target.value)} placeholder="e.g. 110" />
                <div className="input-group"><label className="input-label" htmlFor="onboarding-unit">Unit / package</label><select id="onboarding-unit" className="input-field" value={unit} onChange={event => setUnit(event.target.value)}>{UNITS.map(item => <option key={item} value={item}>{item}</option>)}</select></div>
                <Input label="Estimated selling price (RM)" type="number" min="0" step="0.01" inputMode="decimal" value={sellingPrice} onChange={event => setSellingPrice(event.target.value)} placeholder="e.g. 3.00" />
                <Input label="Estimated cost per unit (RM)" type="number" min="0" step="0.01" inputMode="decimal" value={estimatedCost} onChange={event => setEstimatedCost(event.target.value)} placeholder="e.g. 1.20" />
              </div>
            </section>
          )}

          {step === 3 && (
            <section className="onboarding-step">
              <h2 className="step-title">Choose your language</h2>
              <p className="step-subtitle">You can change this later from your profile.</p>
              <div className="language-options">
                <button type="button" aria-pressed={preferredLang === 'en'} className={`language-card ${preferredLang === 'en' ? 'language-card-selected' : ''}`} onClick={() => setPreferredLang('en')}><span className="language-flag">🇬🇧</span><span className="language-name">English</span></button>
                <button type="button" aria-pressed={preferredLang === 'ms'} className={`language-card ${preferredLang === 'ms' ? 'language-card-selected' : ''}`} onClick={() => setPreferredLang('ms')}><span className="language-flag">🇲🇾</span><span className="language-name">Bahasa Melayu</span></button>
              </div>
            </section>
          )}

          <div className="onboarding-nav">
            {step > 0 && <Button variant="ghost" onClick={() => setStep(current => current - 1)} size="lg">{t.back ?? 'Back'}</Button>}
            <div className="onboarding-nav-spacer" />
            <Button onClick={next} disabled={!canProceed()} loading={saving} size="lg">{step === steps.length - 1 ? 'Complete Setup' : (t.next ?? 'Next')}</Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
