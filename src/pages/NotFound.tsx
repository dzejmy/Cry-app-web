import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Mountain } from 'lucide-react'

function LostHikerSvg() {
  return (
    <svg viewBox="0 0 160 140" fill="none" className="w-44 h-36 mx-auto" aria-hidden="true">
      {/* Sky gradient bg */}
      <rect width="160" height="140" rx="20" fill="#dbeafe" />
      {/* Mountains */}
      <polygon points="80,20 130,90 30,90" fill="#93c5fd" />
      <polygon points="80,20 100,52 60,52" fill="#bfdbfe" />
      <polygon points="80,20 90,36 70,36" fill="white" />
      <polygon points="30,45 65,90 0,90" fill="#bfdbfe" />
      <polygon points="125,38 155,90 95,90" fill="#93c5fd" />
      {/* Ground */}
      <rect x="0" y="90" width="160" height="50" rx="0" fill="#86efac" />
      <rect x="0" y="110" width="160" height="30" rx="0" fill="#4ade80" />
      {/* Hiker figure */}
      <circle cx="80" cy="78" r="6" fill="#1e40af" />
      <rect x="77" y="84" width="6" height="14" rx="3" fill="#1e40af" />
      <line x1="73" y1="88" x2="87" y2="88" stroke="#1e40af" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="77" y1="98" x2="74" y2="106" stroke="#1e40af" strokeWidth="2" strokeLinecap="round" />
      <line x1="83" y1="98" x2="86" y2="106" stroke="#1e40af" strokeWidth="2" strokeLinecap="round" />
      {/* Stick */}
      <line x1="86" y1="84" x2="94" y2="110" stroke="#92400e" strokeWidth="2" strokeLinecap="round" />
      {/* Question marks floating */}
      <text x="30" y="60" fontSize="14" fontWeight="800" fill="#3b82f6" opacity="0.5">?</text>
      <text x="118" y="55" fontSize="12" fontWeight="800" fill="#3b82f6" opacity="0.4">?</text>
      <text x="105" y="75" fontSize="10" fontWeight="800" fill="#3b82f6" opacity="0.3">?</text>
    </svg>
  )
}

export default function NotFound() {
  const { t } = useTranslation()

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-6 text-center pb-24">
      <LostHikerSvg />

      <div className="mt-6 mb-2 flex items-center gap-2 text-violet-400">
        <Mountain className="w-4 h-4" />
        <span className="text-xs font-semibold tracking-widest uppercase">PeakPass</span>
      </div>

      <h1 className="text-5xl font-black text-gray-900 mb-2">404</h1>
      <h2 className="text-lg font-bold text-gray-700 mb-2">{t('errors.notFound')}</h2>
      <p className="text-sm text-gray-400 max-w-xs mb-8">{t('errors.notFoundDesc')}</p>

      <Link
        to="/"
        className="inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white font-semibold px-6 py-3 rounded-xl transition-colors"
      >
        {t('errors.goHome')}
      </Link>
    </div>
  )
}
