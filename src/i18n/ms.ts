// ============================================================
// Bahasa Melayu translations
// ============================================================

import type { TranslationKeys } from './en';

const ms: TranslationKeys = {
  // Common
  appName: 'DemandLens',
  tagline: 'Perancangan permintaan pintar untuk peniaga F&B mikro',
  loading: 'Memuatkan...',
  save: 'Simpan',
  cancel: 'Batal',
  next: 'Seterusnya',
  back: 'Kembali',
  done: 'Selesai',
  confirm: 'Sahkan',
  or: 'atau',

  // Supabase not configured
  supabaseNotConfigured: 'Supabase belum dikonfigurasi',
  supabaseNotConfiguredDesc: 'Sila tetapkan VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY dalam fail .env anda.',

  // Auth
  login: 'Log Masuk',
  register: 'Cipta Akaun',
  logout: 'Log Keluar',
  forgotPassword: 'Lupa Kata Laluan?',
  resetPassword: 'Set Semula Kata Laluan',
  email: 'E-mel',
  password: 'Kata Laluan',
  confirmPassword: 'Sahkan Kata Laluan',
  firstName: 'Nama Pertama',
  lastName: 'Nama Akhir',
  username: 'Nama Pengguna',
  phone: 'Nombor Telefon',
  noAccount: 'Belum ada akaun?',
  haveAccount: 'Sudah ada akaun?',
  signUp: 'Daftar',
  signIn: 'Log Masuk',
  backToLogin: 'Kembali ke Log Masuk',
  resetEmailSent: 'E-mel set semula kata laluan telah dihantar! Semak peti masuk anda.',
  verifyEmail: 'Sila semak e-mel anda untuk mengesahkan akaun sebelum log masuk.',
  welcomeBack: 'Selamat kembali',
  createYourAccount: 'Cipta akaun anda',
  resetYourPassword: 'Set semula kata laluan anda',
  enterEmailReset: 'Masukkan e-mel anda dan kami akan hantar pautan set semula.',
  sendResetLink: 'Hantar Pautan Set Semula',

  // Validation
  required: 'Ruangan ini wajib diisi',
  invalidEmail: 'Sila masukkan alamat e-mel yang sah',
  invalidPhone: 'Sila masukkan nombor telefon Malaysia yang sah',
  invalidUsername: 'Nama pengguna mestilah 3-20 aksara (huruf, nombor, garis bawah)',
  weakPassword: 'Kata laluan mestilah sekurang-kurangnya 8 aksara dengan huruf besar, huruf kecil, dan nombor',
  passwordMismatch: 'Kata laluan tidak sepadan',
  loginFailed: 'E-mel atau kata laluan tidak sah',
  registrationFailed: 'Pendaftaran gagal. Sila cuba lagi.',
  networkError: 'Ralat rangkaian. Sila semak sambungan anda.',

  // Onboarding
  onboardingTitle: 'Mari sediakan profil anda',
  onboardingSubtitle: 'Hanya beberapa langkah untuk bermula',

  stepFood: 'Apa yang anda jual',
  stepLocation: 'Lokasi anda',
  stepLanguage: 'Bahasa',

  foodTitle: 'Apa yang anda jual?',
  foodSubtitle: 'Pilih semua kategori yang berkenaan',
  customFoodLabel: 'Nama makanan tersuai',
  customFoodPlaceholder: 'cth. Satay, Apam Balik...',

  locationTitle: 'Di mana anda berniaga?',
  locationSubtitle: 'Bantu kami sesuaikan cadangan untuk kawasan anda',
  state: 'Negeri',
  city: 'Bandar',
  selectState: 'Pilih negeri anda',
  cityPlaceholder: 'cth. Petaling Jaya',

  languageTitle: 'Bahasa Pilihan',
  languageSubtitle: 'Pilih bahasa pilihan anda',
  english: 'English',
  bahasaMelayu: 'Bahasa Melayu',

  // Dashboard
  dashboard: 'Papan Pemuka',
  welcomeUser: 'Selamat datang, {name}!',
  dashboardPlaceholder: 'Papan pemuka perancangan permintaan anda akan muncul di sini.',
  yourProfile: 'Profil Anda',
  sellingCategories: 'Kategori Jualan',
  location: 'Lokasi',
  language: 'Bahasa',
  comingSoon: 'Akan Datang',
  planningFeatures: 'Ramalan permintaan berkuasa AI, cerapan cuaca, dan cadangan jualan pintar sedang dibina.',
};

export default ms;
