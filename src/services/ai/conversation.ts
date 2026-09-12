// ============================================================
// Conversation content and state helpers, kept separate from the UI.
// ============================================================

import type { Profile, SellerFood } from '../../types/database';
import type { FoodOption, PlanningDraft, PlanningStep, SellingSchedule } from '../../types/planning';

type Language = 'en' | 'ms';

export function getFoodOptions(profile: Profile | null, savedFoods: SellerFood[]): FoodOption[] {
  const options = new Map<string, FoodOption>();

  for (const food of savedFoods) {
    const option: FoodOption = {
      food_name: food.food_name,
      food_category: food.food_category,
      seller_food_id: food.id,
      source: 'saved-item',
    };
    options.set(`${option.food_category}:${option.food_name}`.toLowerCase(), option);
  }

  for (const category of profile?.food_categories ?? []) {
    if (category === 'Others') continue;
    const option: FoodOption = {
      food_name: category,
      food_category: category,
      seller_food_id: null,
      source: 'onboarding',
    };
    const key = `${option.food_category}:${option.food_name}`.toLowerCase();
    if (!options.has(key)) options.set(key, option);
  }

  const customName = profile?.custom_food_name?.trim();
  if (customName) {
    const option: FoodOption = {
      food_name: customName,
      food_category: 'Others',
      seller_food_id: null,
      source: 'onboarding',
    };
    const key = `${option.food_category}:${option.food_name}`.toLowerCase();
    if (!options.has(key)) options.set(key, option);
  }

  return [...options.values()];
}

export function getQuestion(step: PlanningStep, language: Language, foodOptions: FoodOption[], profile: Profile | null): string {
  const locationHint = profile?.city ? ` ${profile.city}${profile.state ? `, ${profile.state}` : ''}` : '';

  if (language === 'ms') {
    switch (step) {
      case 'ASK_SCHEDULE':
        return 'Bila anda bercadang untuk berniaga? Contoh: “Sabtu ini dari 5 petang hingga 10 malam.”';
      case 'ASK_LOCATION':
        return `Di manakah anda akan berniaga? Nama tempat atau gerai sudah mencukupi${locationHint ? ` — saya tahu kawasan anda di${locationHint}` : ''}.`;
      case 'ASK_FOOD':
        return foodOptions.length === 1
          ? `Adakah anda akan menjual ${foodOptions[0].food_name}?`
          : 'Apakah makanan yang akan anda jual untuk sesi ini?';
      default:
        return '';
    }
  }

  switch (step) {
    case 'ASK_SCHEDULE':
      return 'When are you planning to sell? You can say, “This Saturday from 5pm to 10pm.”';
    case 'ASK_LOCATION':
      return `Where will you be selling? A place or stall name is enough${locationHint ? ` — I know your usual area is${locationHint}` : ''}.`;
    case 'ASK_FOOD':
      return foodOptions.length === 1
        ? `Are you going to sell ${foodOptions[0].food_name}?`
        : 'What food will you be selling for this session?';
    default:
      return '';
  }
}

export function getRetryMessage(language: Language): string {
  return language === 'ms'
    ? 'Tiada masalah — cuba sebut atau taipkan sekali lagi.'
    : 'No problem — please say or type it again.';
}

export function getMissingInfoMessage(missing: string[], error: string | null, language: Language): string {
  if (error) return error;
  const needed = missing.join(' and ');
  return language === 'ms'
    ? `Saya masih perlukan ${needed}. Sila cuba sekali lagi.`
    : `I still need ${needed}. Please try again.`;
}

export function formatSchedule(schedule: SellingSchedule, language: Language): string {
  const date = new Date(`${schedule.date}T12:00:00`);
  const locale = language === 'ms' ? 'ms-MY' : 'en-MY';
  const dateText = new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long' }).format(date);
  const timeFormatter = new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit' });
  const [startHour, startMinute] = schedule.start_time.split(':').map(Number);
  const [endHour, endMinute] = schedule.end_time.split(':').map(Number);
  const start = timeFormatter.format(new Date(2000, 0, 1, startHour, startMinute));
  const end = timeFormatter.format(new Date(2000, 0, 1, endHour, endMinute));
  return `${dateText}, ${start} – ${end}`;
}

export function getProgress(step: PlanningStep): number {
  if (step === 'ASK_SCHEDULE' || step === 'CONFIRM_SCHEDULE') return 1;
  if (step === 'ASK_LOCATION' || step === 'CONFIRM_LOCATION') return 2;
  return 3;
}

export function isPlanComplete(draft: PlanningDraft): boolean {
  return Boolean(draft.schedule && draft.location && draft.food);
}
