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

function normaliseUnit(value: string): typeof UNITS[number] | '' {
  const unitValue = value.trim().toLowerCase();
  if (['package', 'packages', 'pack', 'packs', 'bungkus', 'pek'].includes(unitValue)) return 'packages';
  if (['portion', 'portions', 'serving', 'servings'].includes(unitValue)) return 'portions';
  if (['bowl', 'bowls', 'mangkuk'].includes(unitValue)) return 'bowls';
  if (['piece', 'pieces', 'pc', 'pcs', 'biji'].includes(unitValue)) return 'pieces';
  if (['set', 'sets'].includes(unitValue)) return 'sets';
  if (['kg', 'kilogram', 'kilograms'].includes(unitValue)) return 'kg';
  if (['litre', 'litres', 'liter', 'liters'].includes(unitValue)) return 'litres';
  return UNITS.includes(unitValue as typeof UNITS[number]) ? unitValue as typeof UNITS[number] : '';
}

// MVP location choices for the onboarding selector. The selected bazaar name
// is saved with its state and city; coordinates stay empty until a map-based
// location selection is used elsewhere in the product.
const BAZAAR_OPTIONS: Record<string, Record<string, string[]>> = {
  'Kuala Lumpur': {
    'Kuala Lumpur': ['Bazaar Ramadan Kampung Baru', 'Chow Kit Market', 'Jalan Tuanku Abdul Rahman market area', 'Setapak Night Market', 'Other local bazaar / market'],
  },
  Selangor: {
    'Shah Alam': ['Bazaar Ramadan Stadium Shah Alam', 'Section 7 Night Market', 'Uptown Shah Alam', 'Other local bazaar / market'],
    'Petaling Jaya': ['SS2 Night Market', 'Taman Megah Night Market', 'Kelana Jaya market area', 'Other local bazaar / market'],
    Klang: ['Klang Ramadan Bazaar', 'Klang Little India market area', 'Taman Sentosa Night Market', 'Other local bazaar / market'],
    'Subang Jaya': ['SS15 Night Market', 'USJ 1 Night Market', 'Subang Jaya market area', 'Other local bazaar / market'],
  },
  Perak: {
    Kampar: ['Kampar Night Market', 'Kampar Old Town market area', 'Taman Bandar Baru Kampar market area', 'Other local bazaar / market'],
    Ipoh: ['Bazaar Ramadan Stadium Perak', 'Gerbang Malam', 'Taman Canning Night Market', 'Other local bazaar / market'],
    Taiping: ['Taiping Night Market', 'Taiping Lake Gardens market area', 'Kamunting market area', 'Other local bazaar / market'],
  },
  Penang: {
    'George Town': ['Batu Ferringhi Night Market', 'Gurney Drive market area', 'Lebuh Campbell market area', 'Other local bazaar / market'],
    'Seberang Perai': ['Bazaar Ramadan Seberang Jaya', 'Bukit Mertajam market area', 'Permatang Pauh market area', 'Other local bazaar / market'],
  },
  Johor: {
    'Johor Bahru': ['Angsana Johor Bahru Night Market', 'Jalan Tan Hiok Nee market area', 'Taman Universiti Night Market', 'Other local bazaar / market'],
    'Batu Pahat': ['Batu Pahat Night Market', 'Dataran Penggaram market area', 'Tongkang Pechah market area', 'Other local bazaar / market'],
    Muar: ['Muar Night Market', 'Tanjung Emas market area', 'Bakri market area', 'Other local bazaar / market'],
  },
  Melaka: {
    'Melaka City': ['Jonker Walk Night Market', 'Klebang market area', 'Ayer Keroh market area', 'Other local bazaar / market'],
    'Alor Gajah': ['Alor Gajah market area', 'Masjid Tanah market area', 'Jasin market area', 'Other local bazaar / market'],
  },
  Kelantan: {
    'Kota Bharu': ['Pasar Siti Khadijah area', 'Stadium Sultan Muhammad IV bazaar area', 'Wakaf Che Yeh Night Market', 'Other local bazaar / market'],
    'Pasir Mas': ['Pasir Mas market area', 'Rantau Panjang market area', 'Other local bazaar / market'],
  },
  Terengganu: {
    'Kuala Terengganu': ['Pasar Payang area', 'Dataran Shahbandar market area', 'Chendering market area', 'Other local bazaar / market'],
    Kemaman: ['Chukai market area', 'Kemaman market area', 'Other local bazaar / market'],
  },
  Kedah: {
    'Alor Setar': ['Stadium Darul Aman area', 'Pekan Rabu market area', 'Taman Rakyat Mergong market area', 'Other local bazaar / market'],
    'Sungai Petani': ['Amanjaya market area', 'Taman Ria market area', 'Sungai Petani Night Market', 'Other local bazaar / market'],
  },
  Pahang: {
    Kuantan: ['Kuantan Ramadan Bazaar', 'Mahkota Square market area', 'Teluk Cempedak market area', 'Other local bazaar / market'],
    Temerloh: ['Temerloh market area', 'Mentakab market area', 'Other local bazaar / market'],
  },
  'Negeri Sembilan': {
    Seremban: ['Seremban Ramadan Bazaar', 'Seremban 2 market area', 'Rasah market area', 'Other local bazaar / market'],
    'Port Dickson': ['Port Dickson Waterfront market area', 'Lukut market area', 'Other local bazaar / market'],
  },
  Perlis: {
    Kangar: ['Kangar Ramadan Bazaar', 'Kuala Perlis market area', 'Arau market area', 'Other local bazaar / market'],
  },
  Sabah: {
    'Kota Kinabalu': ['Gaya Street Market', 'Asia City Night Market', 'Sembulan market area', 'Other local bazaar / market'],
    Sandakan: ['Sandakan Central Market', 'Taman Indah market area', 'Other local bazaar / market'],
  },
  Sarawak: {
    Kuching: ['Kuching Waterfront area', 'Satok market area', 'Stutong market area', 'Other local bazaar / market'],
    Miri: ['Miri market area', 'Taman Selera market area', 'Other local bazaar / market'],
  },
  Putrajaya: {
    Putrajaya: ['Presint 3 Ramadan Bazaar', 'Presint 9 market area', 'Presint 11 market area', 'Other local bazaar / market'],
  },
  Labuan: {
    Labuan: ['Labuan Ramadan Bazaar', 'Pasar Sentral area', 'Ujana Kewangan market area', 'Other local bazaar / market'],
  },
};

export default function Onboarding() {
  const { user, refreshProfile } = useAuth();
  const { lang, setLanguage, t } = useLanguage();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [selectedFoods, setSelectedFoods] = useState<string[]>([]);
  const [customFood, setCustomFood] = useState('');
  const [locationName, setLocationName] = useState('');
  const [state, setState] = useState('');
  const [city, setCity] = useState('');
  // Examples live only in placeholders. We do not show demo seller data as if
  // the user entered it.
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('');
  const [foodName, setFoodName] = useState('');
  const [sellingPrice, setSellingPrice] = useState('');
  const [estimatedCost, setEstimatedCost] = useState('');
  const [historyAnswer, setHistoryAnswer] = useState('');
  const [historyTranscript, setHistoryTranscript] = useState<string | null>(null);
  const [hasBusinessAnswer, setHasBusinessAnswer] = useState(false);
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
    return foodName.trim() || (selectedFoods.includes('Others') ? customFood.trim() : '');
  }

  function applyHistoryAnswer(answer: string) {
    const submittedAnswer = answer.trim();
    if (!submittedAnswer) {
      setHistoryNotice('Type or say your usual selling details first.');
      return;
    }

    setHistoryTranscript(submittedAnswer);
    setHistoryAnswer('');
    setHasBusinessAnswer(true);
    try {
      const extracted = extractSellingHistory(submittedAnswer);
      if (extracted.food_name) setFoodName(extracted.food_name);
      if (extracted.quantity !== null) setQuantity(String(extracted.quantity));
      if (extracted.unit) setUnit(normaliseUnit(extracted.unit));
      if (extracted.selling_price !== null) setSellingPrice(String(extracted.selling_price));
      if (extracted.estimated_cost !== null) setEstimatedCost(String(extracted.estimated_cost));
      setHistoryNotice('I filled in the details I could find. You can edit every field before continuing.');
    } catch {
      setHistoryNotice('Could not parse voice automatically. You can fill the fields manually below.');
    }
  }

  function canProceed(): boolean {
    if (step === 0) {
      return selectedFoods.length > 0 && (!selectedFoods.includes('Others') || customFood.trim().length > 0);
    }

    if (step === 1) {
      return state.length > 0 && city.length > 0 && locationName.length > 0;
    }

    if (step === 2) {
      return foodName.trim().length > 0
        && Number(quantity) > 0
        && unit.length > 0
        && sellingPrice.trim().length > 0
        && Number(sellingPrice) >= 0
        && estimatedCost.trim().length > 0
        && Number(estimatedCost) >= 0;
    }

    return true;
  }

  async function finishOnboarding() {
    setError('');
    setSaving(true);
    const onboardingData = {
      food_categories: selectedFoods,
      custom_food_name: selectedFoods.includes('Others') ? customFood.trim() : null,
      state,
      city,
      default_location_name: locationName.trim(),
      default_latitude: null,
      default_longitude: null,
      onboarding_usual_quantity: Number(quantity),
      onboarding_unit: unit,
      onboarding_selling_price: Number(sellingPrice),
      onboarding_estimated_cost: Number(estimatedCost),
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
    setState(nextState);
    setCity('');
    setLocationName('');
  }

  function selectCity(nextCity: string) {
    setCity(nextCity);
    setLocationName('');
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
                      <option value="" disabled>Choose a state</option>
                      {Object.keys(BAZAAR_OPTIONS).map(option => <option key={option} value={option}>{option}</option>)}
                    </select>
                  </div>
                  <div className="input-group">
                    <label className="input-label" htmlFor="onboarding-city">City</label>
                    <select id="onboarding-city" className="input-field select-field" value={city} onChange={event => selectCity(event.target.value)} disabled={!state}>
                      <option value="" disabled>Choose a city</option>
                      {citiesForSelectedState.map(option => <option key={option} value={option}>{option}</option>)}
                    </select>
                  </div>
                </div>
                <div className="input-group">
                  <label className="input-label" htmlFor="onboarding-bazaar">Bazaar / market</label>
                  <select id="onboarding-bazaar" className="input-field select-field" value={locationName} onChange={event => setLocationName(event.target.value)} disabled={!city}>
                    <option value="" disabled>Choose a bazaar or market</option>
                    {bazaarsForSelectedCity.map(option => <option key={option} value={option}>{option}</option>)}
                  </select>
                </div>
              </div>
            </section>
          )}

          {step === 2 && (
            <section className="onboarding-step">
              <h2 className="step-title">Tell us about your usual selling</h2>
              <p className="step-subtitle">Speak or type one sentence, for example: &quot;I sell nasi lemak. I usually prepare 110 packs, sell each for RM3, and my cost is RM1.20.&quot;</p>
              <div className="onboarding-voice-row">
                <VoiceInput language={preferredLang} onTranscript={applyHistoryAnswer} disabled={saving} />
                <div className="onboarding-voice-copy"><strong>Prefer typing?</strong><span>Type your usual selling details below and use the answer.</span></div>
              </div>
              <div className="setup-answer-row">
                <textarea className="setup-answer-input" aria-label="Describe your usual selling information" value={historyAnswer} onChange={event => setHistoryAnswer(event.target.value)} placeholder="e.g. I sell nasi lemak, prepare 110 packs, RM3 each" rows={3} />
                <Button type="button" variant="secondary" onClick={() => applyHistoryAnswer(historyAnswer)} disabled={!historyAnswer.trim()}>Use answer</Button>
              </div>
              {historyTranscript && (
                <section className="question-transcript onboarding-history-transcript" aria-live="polite">
                  <span>Transcript</span>
                  <p>{historyTranscript}</p>
                  <Button type="button" variant="ghost" size="sm" onClick={() => {
                    setHistoryAnswer(historyTranscript);
                    setHistoryTranscript(null);
                    setHasBusinessAnswer(false);
                    setHistoryNotice(null);
                    setFoodName('');
                    setQuantity('');
                    setUnit('');
                    setSellingPrice('');
                    setEstimatedCost('');
                  }}>Edit answer</Button>
                </section>
              )}
              {hasBusinessAnswer && (
                <>
                  {historyNotice && <p className="setup-answer-notice" role="status">{historyNotice}</p>}
                  <div className="onboarding-business-grid">
                    <Input label="Main food / item" value={foodName} onChange={event => setFoodName(event.target.value)} placeholder="e.g. Nasi lemak" />
                    <Input label="Usual quantity" type="number" min="0" inputMode="decimal" value={quantity} onChange={event => setQuantity(event.target.value)} placeholder="e.g. 110" />
                    <div className="input-group"><label className="input-label" htmlFor="onboarding-unit">Unit / package</label><select id="onboarding-unit" className="input-field" value={unit} onChange={event => setUnit(event.target.value)}><option value="">Choose a unit</option>{UNITS.map(item => <option key={item} value={item}>{item}</option>)}</select></div>
                    <Input label="Estimated selling price (RM)" type="number" min="0" step="0.01" inputMode="decimal" value={sellingPrice} onChange={event => setSellingPrice(event.target.value)} placeholder="e.g. 3.00" />
                    <Input label="Estimated cost per unit (RM)" type="number" min="0" step="0.01" inputMode="decimal" value={estimatedCost} onChange={event => setEstimatedCost(event.target.value)} placeholder="e.g. 1.20" />
                  </div>
                </>
              )}
            </section>
          )}

          {step === 3 && (
            <section className="onboarding-step">
              <h2 className="step-title">Choose your language</h2>
              <p className="step-subtitle">You can change this later from your profile.</p>
              <div className="language-options">
                <button type="button" aria-pressed={preferredLang === 'en'} className={`language-card ${preferredLang === 'en' ? 'language-card-selected' : ''}`} onClick={() => setPreferredLang('en')}><span className="language-code">EN</span><span className="language-name">English</span></button>
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
