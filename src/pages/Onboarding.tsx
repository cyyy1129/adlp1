// ============================================================
// Onboarding Page — 3-step wizard
// ============================================================

import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../hooks/useLanguage';
import Button from '../components/Button';
import Input from '../components/Input';
import Card from '../components/Card';
import StepIndicator from '../components/StepIndicator';
import MapLocationPicker from "../components/MapLocationPicker";
import { completeOnboarding } from '../services/profileService';
import { FOOD_CATEGORIES } from '../lib/utils';

export default function Onboarding() {
  const { user, profile, supabaseConfigured, refreshProfile } =
    useAuth();

  const { t, lang, setLanguage } = useLanguage();
  const navigate = useNavigate();

  const [step, setStep] = useState(0);

  const [selectedFoods, setSelectedFoods] =
    useState<string[]>([]);

  const [customFood, setCustomFood] = useState('');

  // ----------------------------------------------------------
  // Location
  // ----------------------------------------------------------

  const [locationName, setLocationName] = useState('');
  const [latitude, setLatitude] = useState<number | null>(
    null
  );
  const [longitude, setLongitude] =
    useState<number | null>(null);

  const [state, setState] = useState('');
  const [city, setCity] = useState('');

  const [preferredLang, setPreferredLang] =
    useState<'en' | 'ms'>(lang);

  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // Redirect if not logged in
  if (!user && supabaseConfigured) {
    return <Navigate to="/login" replace />;
  }

  // Already onboarded
  if (profile?.onboarding_completed) {
    return <Navigate to="/dashboard" replace />;
  }

  const steps = [
    { label: t.stepFood, icon: '🍜' },
    { label: t.stepLocation, icon: '📍' },
    { label: t.stepLanguage, icon: '🌐' },
  ];

  function toggleFood(category: string) {
    setSelectedFoods(prev =>
      prev.includes(category)
        ? prev.filter(f => f !== category)
        : [...prev, category]
    );
  }

  function handleLocationChange(location: {
    locationName: string;
    latitude: number | null;
    longitude: number | null;
    city: string;
    state: string;
  }) {
    setLocationName(location.locationName);
    setLatitude(location.latitude);
    setLongitude(location.longitude);

    // Keep existing database fields populated.
    setCity(location.city);
    setState(location.state);
  }

  function canProceed(): boolean {
    switch (step) {
      case 0:
        return (
          selectedFoods.length > 0 &&
          (!selectedFoods.includes('Others') ||
            customFood.trim().length > 0)
        );

      case 1:
        return (
          locationName.trim().length > 0 &&
          latitude !== null &&
          longitude !== null
        );

      case 2:
        return true;

      default:
        return false;
    }
  }

  async function handleComplete() {
    if (!user) return;

    setError('');
    setSaving(true);

    const { error: err } =
      await completeOnboarding(user.id, {
        food_categories: selectedFoods,
        custom_food_name: selectedFoods.includes('Others')
          ? customFood.trim()
          : null,

        // These are now obtained automatically from
        // the selected Google Maps location.
        state: state || null,
        city: city || null,

        preferred_language: preferredLang,
      });

    if (err) {
      setError(err);
      setSaving(false);
      return;
    }

    setLanguage(preferredLang);

    await refreshProfile();

    navigate('/dashboard');
  }

  function handleNext() {
    if (step < 2) {
      setStep(step + 1);
    } else {
      handleComplete();
    }
  }

  function handleBack() {
    if (step > 0) {
      setStep(step - 1);
    }
  }

  // Food category emoji map
  const foodIcons: Record<string, string> = {
    Noodles: '🍜',
    'Rice dishes': '🍚',
    Drinks: '🥤',
    Desserts: '🍰',
    Snacks: '🥟',
    'Grilled food': '🍢',
    Bakery: '🍞',
    Others: '✨',
  };

  return (
    <div className="onboarding-page">
      <div className="onboarding-container">
        <div className="onboarding-header">
          <h1>{t.onboardingTitle}</h1>
          <p>{t.onboardingSubtitle}</p>
        </div>

        <StepIndicator
          steps={steps}
          currentStep={step}
        />

        <Card
          variant="glass"
          padding="lg"
          className="onboarding-card"
        >
          {error && (
            <div className="alert alert-error">
              <span className="alert-icon">✕</span>
              <span>{error}</span>
            </div>
          )}

          {/* ==================================================
              Step 0: Food
              ================================================== */}

          {step === 0 && (
            <div className="onboarding-step">
              <h2 className="step-title">
                {t.foodTitle}
              </h2>

              <p className="step-subtitle">
                {t.foodSubtitle}
              </p>

              <div className="food-grid">
                {FOOD_CATEGORIES.map(cat => (
                  <button
                    key={cat}
                    type="button"
                    className={`food-chip ${selectedFoods.includes(cat)
                      ? 'food-chip-selected'
                      : ''
                      }`}
                    onClick={() => toggleFood(cat)}
                  >
                    <span className="food-chip-icon">
                      {foodIcons[cat]}
                    </span>

                    <span className="food-chip-label">
                      {cat}
                    </span>
                  </button>
                ))}
              </div>

              {selectedFoods.includes('Others') && (
                <div className="custom-food-input">
                  <Input
                    label={t.customFoodLabel}
                    value={customFood}
                    onChange={e =>
                      setCustomFood(e.target.value)
                    }
                    placeholder={
                      t.customFoodPlaceholder
                    }
                  />
                </div>
              )}
            </div>
          )}

          {/* ==================================================
              Step 1: Location
              ================================================== */}

          {step === 1 && (
            <div className="onboarding-step">
              <h2 className="step-title">
                {t.locationTitle}
              </h2>

              <p className="step-subtitle">
                {t.locationSubtitle}
              </p>

              <MapLocationPicker
                value={{
                  locationName,
                  latitude,
                  longitude,
                  city,
                  state,
                }}
                onChange={handleLocationChange}
              />
            </div>
          )}

          {/* ==================================================
              Step 2: Language
              ================================================== */}

          {step === 2 && (
            <div className="onboarding-step">
              <h2 className="step-title">
                {t.languageTitle}
              </h2>

              <p className="step-subtitle">
                {t.languageSubtitle}
              </p>

              <div className="language-options">
                <button
                  type="button"
                  className={`language-card ${preferredLang === 'en'
                    ? 'language-card-selected'
                    : ''
                    }`}
                  onClick={() =>
                    setPreferredLang('en')
                  }
                >
                  <span className="language-flag">
                    🇬🇧
                  </span>

                  <span className="language-name">
                    {t.english}
                  </span>
                </button>

                <button
                  type="button"
                  className={`language-card ${preferredLang === 'ms'
                    ? 'language-card-selected'
                    : ''
                    }`}
                  onClick={() =>
                    setPreferredLang('ms')
                  }
                >
                  <span className="language-flag">
                    🇲🇾
                  </span>

                  <span className="language-name">
                    {t.bahasaMelayu}
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* ==================================================
              Navigation
              ================================================== */}

          <div className="onboarding-nav">
            {step > 0 && (
              <Button
                variant="ghost"
                onClick={handleBack}
                size="lg"
              >
                {t.back}
              </Button>
            )}

            <div className="onboarding-nav-spacer" />

            <Button
              onClick={handleNext}
              disabled={!canProceed()}
              loading={saving}
              size="lg"
            >
              {step === 2 ? t.done : t.next}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}