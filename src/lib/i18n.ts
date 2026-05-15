import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

import en from '../locales/en.json'
import sk from '../locales/sk.json'

// Detect browser/stored language preference
function detectLanguage(): string {
  const stored = localStorage.getItem('peakpass_lang')
  if (stored === 'sk' || stored === 'en') return stored

  const browser = navigator.language?.toLowerCase()
  if (browser?.startsWith('sk')) return 'sk'
  return 'en'
}

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      sk: { translation: sk },
    },
    lng:          detectLanguage(),
    fallbackLng:  'en',
    interpolation: {
      escapeValue: false,
    },
    // Enable pluralisation with _plural suffix
    pluralSeparator: '_',
  })

export function setLanguage(lang: 'en' | 'sk') {
  localStorage.setItem('peakpass_lang', lang)
  i18n.changeLanguage(lang)
}

export default i18n
