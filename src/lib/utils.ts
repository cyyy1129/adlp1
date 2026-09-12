// ============================================================
// Utility helpers
// ============================================================

/** Simple email regex for client-side validation */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/** Malaysian phone: starts with 0 or +60, 9–13 digits */
export function isValidPhone(phone: string): boolean {
  const cleaned = phone.replace(/[\s\-()]/g, '');
  return /^(\+?60|0)\d{8,11}$/.test(cleaned);
}

/** Password: at least 8 chars, 1 uppercase, 1 lowercase, 1 number */
export function isStrongPassword(password: string): boolean {
  return password.length >= 8 &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /\d/.test(password);
}

/** Username: 3-20 chars, alphanumeric + underscore */
export function isValidUsername(username: string): boolean {
  return /^[a-zA-Z0-9_]{3,20}$/.test(username);
}

/** Malaysian states for onboarding dropdown */
export const MALAYSIAN_STATES = [
  'Johor',
  'Kedah',
  'Kelantan',
  'Melaka',
  'Negeri Sembilan',
  'Pahang',
  'Perak',
  'Perlis',
  'Pulau Pinang',
  'Sabah',
  'Sarawak',
  'Selangor',
  'Terengganu',
  'Wilayah Persekutuan Kuala Lumpur',
  'Wilayah Persekutuan Putrajaya',
  'Wilayah Persekutuan Labuan',
];

/** Food categories for onboarding */
export const FOOD_CATEGORIES = [
  'Noodles',
  'Rice dishes',
  'Drinks',
  'Desserts',
  'Snacks',
  'Grilled food',
  'Bakery',
  'Others',
] as const;

export type FoodCategory = typeof FOOD_CATEGORIES[number];
