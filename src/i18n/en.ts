// ============================================================
// English translations
// ============================================================

const en = {
  // Common
  appName: 'Bazaar Buddy',
  tagline: 'Smart demand planning for micro F&B sellers',
  loading: 'Loading...',
  save: 'Save',
  cancel: 'Cancel',
  next: 'Next',
  back: 'Back',
  done: 'Done',
  confirm: 'Confirm',
  or: 'or',

  // Supabase not configured
  supabaseNotConfigured: 'Supabase is not configured',
  supabaseNotConfiguredDesc: 'Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file to enable authentication and data features.',

  // Auth
  login: 'Log In',
  register: 'Create Account',
  logout: 'Log Out',
  forgotPassword: 'Forgot Password?',
  resetPassword: 'Reset Password',
  email: 'Email',
  password: 'Password',
  confirmPassword: 'Confirm Password',
  firstName: 'First Name',
  lastName: 'Last Name',
  username: 'Username',
  phone: 'Phone Number',
  noAccount: "Don't have an account?",
  haveAccount: 'Already have an account?',
  signUp: 'Sign Up',
  signIn: 'Sign In',
  backToLogin: 'Back to Login',
  resetEmailSent: 'Password reset email sent! Check your inbox.',
  verifyEmail: 'Please check your email to verify your account before logging in.',
  welcomeBack: 'Welcome back',
  createYourAccount: 'Create your account',
  resetYourPassword: 'Reset your password',
  enterEmailReset: 'Enter your email and we\'ll send you a reset link.',
  sendResetLink: 'Send Reset Link',

  // Validation
  required: 'This field is required',
  invalidEmail: 'Please enter a valid email address',
  invalidPhone: 'Please enter a valid Malaysian phone number',
  invalidUsername: 'Username must be 3-20 characters (letters, numbers, underscore)',
  weakPassword: 'Password must be at least 8 characters with uppercase, lowercase, and a number',
  passwordMismatch: 'Passwords do not match',
  loginFailed: 'Invalid email or password',
  registrationFailed: 'Registration failed. Please try again.',
  networkError: 'Network error. Please check your connection.',

  // Onboarding
  onboardingTitle: 'Let\'s set up your profile',
  onboardingSubtitle: 'Just a few quick steps to get started',

  stepFood: 'What you sell',
  stepLocation: 'Your location',
  stepLanguage: 'Language',

  foodTitle: 'What do you sell?',
  foodSubtitle: 'Select all categories that apply',
  customFoodLabel: 'Custom food name',
  customFoodPlaceholder: 'e.g. Satay, Apam Balik...',

  locationTitle: 'Where do you sell?',
  locationSubtitle: 'Help us tailor recommendations to your area',
  state: 'State / Negeri',
  city: 'City',
  selectState: 'Select your state',
  cityPlaceholder: 'e.g. Petaling Jaya',

  languageTitle: 'Preferred Language',
  languageSubtitle: 'Choose your preferred language',
  english: 'English',
  bahasaMelayu: 'Bahasa Melayu',

  // Dashboard
  dashboard: 'Dashboard',
  welcomeUser: 'Welcome, {name}!',
  dashboardPlaceholder: 'Your demand planning dashboard will appear here.',
  yourProfile: 'Your Profile',
  sellingCategories: 'Selling Categories',
  location: 'Location',
  language: 'Language',
  comingSoon: 'Coming Soon',
  planningFeatures: 'AI-powered demand forecasting, weather insights, and smart selling recommendations are being built.',
};

export default en;
export type TranslationKeys = typeof en;
